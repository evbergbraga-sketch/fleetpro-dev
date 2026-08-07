// ══ SANTANDER — CRIAR COBRANÇA HÍBRIDA (BOLETO + PIX) ══
//
// Path e payload confirmados no "USERGUIDE - API DE COBRANÇA V2.1" oficial
// do Santander (seção 6.1 — BANK SLIP | Registro de Boletos | POST).
//
// Requer no .env:
//   SANTANDER_WORKSPACE_ID_SANDBOX / SANTANDER_WORKSPACE_ID_PRODUCAO
//   SANTANDER_CONVENIO       (código de 7 dígitos do beneficiário — ex: 0863038)
//   SANTANDER_CHAVE_PIX      (chave DICT cadastrada no Santander p/ receber PIX)
//   SANTANDER_CHAVE_PIX_TIPO (CPF | CNPJ | CELULAR | EMAIL | EVP)
//   SANTANDER_ENV             SANDBOX ou PRODUCAO — decide credenciais/host/workspace

const { getSantanderToken, _httpsRequest, _agenteSantander, getSantanderHost, getSantanderClientId, getSantanderWorkspaceId } = require('./fase_santander_1_auth');

// payer.name do Santander só aceita [A-Za-z0-9& ] — nem acento, nem hífen.
// Confirmado em teste real de produção (05/08/2026): um slice(0,40) simples
// pode cortar no meio de um hífen (ex: "... - NAO USAR") e ser rejeitado.
// Remove acentos primeiro (preserva legibilidade — "José" vira "Jose", não
// some) e só depois filtra caracteres não permitidos, antes de truncar.
function _limparNomeSantander(nome){
  return (nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9& ]/g, '')
    .trim()
    .slice(0, 40);
}

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
    // "Nosso número" inclui a tentativa (últimos 2 dígitos) — permite
    // reemitir (baixa+recriação) sem colidir com o nosso-número anterior,
    // já que documentKind RECIBO não aceita PATCH de nominalValue e o
    // reajuste de valor precisa baixar o antigo e criar um novo.
    const tentativa = cobranca.santander_tentativa || 1;
    const nossoNumero = `${cobranca.locacoes?.num_contrato || '0'}${String(cobranca.numero_semana).padStart(4,'0')}${String(tentativa).padStart(2,'0')}`;

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
      clientNumber: `SEM${cobranca.numero_semana}`, // "seu número" — livre; produção rejeita hífen (só [0-9A-Za-Z ])
      nominalValue: Number(cobranca.valor).toFixed(2),
      payer: {
        name: _limparNomeSantander(cliente.nome),
        documentType: 'CPF',
        documentNumber: (cliente.cpf || '').replace(/\D/g,''),
        address: cliente.endereco_rua || 'Não informado',
        neighborhood: cliente.endereco_bairro || 'Não informado',
        city: cliente.endereco_cidade || 'Não informado',
        state: cliente.endereco_uf || 'RJ',
        zipCode: (cliente.cep || '00000000').replace(/\D/g,'').replace(/(\d{5})(\d{3})/, '$1-$2'), // formato 00000-000 exigido em produção
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
      path: `/collection_bill_management/v2/workspaces/${getSantanderWorkspaceId()}/bank_slips`,
      method: 'POST',
      agent: _agenteSantander(),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
        'X-Application-Key': getSantanderClientId(),
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
