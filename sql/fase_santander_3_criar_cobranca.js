// ══ SANTANDER — CRIAR COBRANÇA HÍBRIDA (BOLETO + PIX) ══
//
// Path e payload confirmados no "USERGUIDE - API DE COBRANÇA V2.1" oficial
// do Santander (seção 6.1 — BANK SLIP | Registro de Boletos | POST).
//
// Requer no .env:
//   SANTANDER_WORKSPACE_ID   (gerado no passo fase_santander_2_criar_workspace.js)
//   SANTANDER_CONVENIO       (código de 7 dígitos do beneficiário — ex: 0863038)
//   SANTANDER_CHAVE_PIX      (chave DICT cadastrada no Santander p/ receber PIX)
//   SANTANDER_CHAVE_PIX_TIPO (CPF | CNPJ | CELULAR | EMAIL | EVP)
//   SANTANDER_ENV             PRODUCAO ou TESTE (não "PRODUCTION"/"TEST" — literal em português)

const { getSantanderToken, _httpsRequest, _agenteSantander, getSantanderHost } = require('./fase_santander_1_auth');

app.post('/api/santander/criar-cobranca', async (req, res) => {
  try{
    const { cobranca_id } = req.body;
    if(!cobranca_id) return res.status(400).json({error:'cobranca_id é obrigatório'});

    const { data: cobranca } = await sb.from('cobrancas_semanais')
      .select(`*, locacoes(num_contrato, cliente_id,
        clientes(nome, cpf, email, telefone, endereco_rua, endereco_numero,
                 endereco_bairro, endereco_cidade, endereco_uf, cep))`)
      .eq('id', cobranca_id).maybeSingle();
    if(!cobranca) return res.status(404).json({error:'Cobrança não encontrada'});
    if(cobranca.santander_bank_number){
      return res.json({ok:true, message:'Cobrança já foi criada anteriormente no Santander', ja_existia:true});
    }

    const cliente = cobranca.locacoes?.clientes;
    if(!cliente?.cpf) return res.status(400).json({error:'Cliente sem CPF cadastrado — obrigatório para emissão'});

    // "SANTANDER_ENV" (SANDBOX/PRODUCAO) escolhe o HOST da API (ver santander-auth.js).
    // O campo "environment" do payload abaixo é um conceito DIFERENTE, específico
    // do host de produção: só existe quando SANTANDER_ENV=PRODUCAO, e indica se o
    // registro deve ser real (PRODUCAO) ou só validado sem gravar (TESTE) — ver
    // manual seção 4.2. No host sandbox, tudo já é fictício por natureza, então
    // sempre mandamos "TESTE" aqui.
    const environment = (process.env.SANTANDER_ENV || 'SANDBOX').toUpperCase() === 'PRODUCAO'
      ? (process.env.SANTANDER_REGISTRO_MODO || 'TESTE') // ao ligar pra produção de vez, trocar p/ 'PRODUCAO' no .env
      : 'TESTE';

    // "Nosso número" — numérico, até 13 dígitos, único por convênio.
    // Usamos contrato + semana zero-padded. AJUSTAR se algum contrato tiver
    // num_contrato não-numérico ou se precisar de mais dígitos.
    const nossoNumero = `${cobranca.locacoes?.num_contrato || '0'}${String(cobranca.numero_semana).padStart(4,'0')}`;

    // nsuCode deve ser NUMÉRICO em produção (erro 1082 se não for) e único
    // por convênio/dia. Reaproveitamos o próprio nosso-número, que já é único.
    // Em ambiente TESTE, precisa começar com "TST" (nota 1 do manual).
    const nsuCode = environment === 'TESTE' ? `TST${nossoNumero}` : nossoNumero;

    const token = await getSantanderToken();

    const payload = {
      nsuCode,
      nsuDate: new Date().toISOString().slice(0,10),
      environment,
      covenantCode: process.env.SANTANDER_CONVENIO,
      issueDate: new Date().toISOString().slice(0,10),
      dueDate: cobranca.data_vencimento,
      bankNumber: nossoNumero,
      clientNumber: `SEM-${cobranca.numero_semana}`, // "seu número" — livre, usado só p/ referência nossa
      nominalValue: Number(cobranca.valor).toFixed(2),
      payer: {
        name: cliente.nome,
        documentType: 'CPF',
        documentNumber: (cliente.cpf || '').replace(/\D/g,''),
        address: cliente.endereco_rua || 'Não informado',
        neighborhood: cliente.endereco_bairro || 'Não informado',
        city: cliente.endereco_cidade || 'Não informado',
        state: cliente.endereco_uf || 'RJ',
        zipCode: (cliente.cep || '00000000').replace(/\D/g,''),
      },
      documentKind: 'RECIBO',   // espécie do documento — RECIBO é a mais próxima p/ cobrança recorrente de aluguel
      paymentType: 'REGISTRO',  // só aceita o valor nominal exato (sem range divergente)
      messages: [`Contrato #${cobranca.locacoes?.num_contrato||''} — Semana ${cobranca.numero_semana}`],
    };

    // Ativa o PIX na mesma cobrança (boleto híbrido / "Boleto SX") — só entra
    // se a chave PIX estiver configurada.
    if(process.env.SANTANDER_CHAVE_PIX && process.env.SANTANDER_CHAVE_PIX_TIPO){
      payload.key = {
        type: process.env.SANTANDER_CHAVE_PIX_TIPO,
        dictKey: process.env.SANTANDER_CHAVE_PIX,
      };
    }

    const body = JSON.stringify(payload);

    const resp = await _httpsRequest({
      hostname: getSantanderHost(),
      path: `/collection_bill_management/v2/workspaces/${process.env.SANTANDER_WORKSPACE_ID}/bank_slips`,
      method: 'POST',
      agent: _agenteSantander(),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
        'X-Application-Key': process.env.SANTANDER_CLIENT_ID,
      },
    }, body);

    await sb.from('cobrancas_semanais').update({
      santander_bank_number: nossoNumero,
      santander_barcode: resp.barCode || resp.barcode || null,
      santander_linha_digitavel: resp.digitableLine || resp.digitablLine || null,
      santander_qrcode: resp.qrCodePix || resp.qrcodePix || null,       // string "copia e cola" do PIX
      santander_qrcode_url: resp.qrCodeUrl || resp.qrcodeUrl || null,    // URL p/ exibir/consultar o QR
    }).eq('id', cobranca_id);

    console.log(`[santander/criar-cobranca] OK — cobranca ${cobranca_id} (nosso número ${nossoNumero})`);
    res.json({ok:true, bankNumber: nossoNumero, ...resp});
  }catch(e){
    console.error('[santander/criar-cobranca]', e.message);
    res.status(500).json({error: e.message});
  }
});
