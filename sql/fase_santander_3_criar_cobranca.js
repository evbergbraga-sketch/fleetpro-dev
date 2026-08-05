// ══ SANTANDER — CRIAR COBRANÇA HÍBRIDA (BOLETO + PIX) ══
//
// ⚠️ CONFIRMAR NO SWAGGER ANTES DE USAR EM PRODUÇÃO:
//   - path exato de criação de boleto/cobrança dentro do workspace
//   - nomes exatos dos campos do payload (os abaixo foram inferidos de docs
//     de terceiros que integram com essa mesma API, não da doc oficial)
//   - campo que ativa o QR Code PIX na mesma cobrança (boleto híbrido)
//
// Requer no .env:
//   SANTANDER_WORKSPACE_ID   (gerado no passo fase_santander_2_criar_workspace.js)
//   SANTANDER_CONVENIO
//   SANTANDER_ENV            (PRODUCTION ou TEST/sandbox, se aplicável)

const { getSantanderToken, _httpsRequest, _agenteSantander } = require('./fase_santander_1_auth');

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
    if(cobranca.santander_cobranca_id){
      return res.json({ok:true, message:'Cobrança já foi criada anteriormente no Santander', ja_existia:true});
    }

    const cliente = cobranca.locacoes?.clientes;
    if(!cliente?.cpf) return res.status(400).json({error:'Cliente sem CPF cadastrado — obrigatório para emissão'});

    const token = await getSantanderToken();
    // Regra de "nosso número" — AJUSTAR conforme exigência do Santander (tamanho/formato)
    const nossoNumero = `${cobranca.locacoes?.num_contrato || '0'}${String(cobranca.numero_semana).padStart(4,'0')}`;

    const body = JSON.stringify({
      environment: process.env.SANTANDER_ENV || 'PRODUCTION',
      nsuCode: cobranca.id,                          // identificador único nosso (idempotência)
      nsuDate: new Date().toISOString().slice(0,10),
      covenantCode: process.env.SANTANDER_CONVENIO,
      bankNumber: nossoNumero,
      dueDate: cobranca.data_vencimento,
      issueDate: new Date().toISOString().slice(0,10),
      nominalValue: Number(cobranca.valor).toFixed(2),
      payer: {
        name: cliente.nome,
        documentType: 'CPF',
        documentNumber: (cliente.cpf || '').replace(/\D/g,''),
        address: cliente.endereco_rua || '',
        neighborhood: cliente.endereco_bairro || '',
        city: cliente.endereco_cidade || '',
        state: cliente.endereco_uf || '',
        zipCode: (cliente.cep || '').replace(/\D/g,''),
      },
      // Ativa o PIX na mesma cobrança (boleto híbrido) — CONFIRMAR nome exato do campo
      key: process.env.SANTANDER_CHAVE_PIX || undefined,
    });

    const resp = await _httpsRequest({
      hostname: 'trust-open.api.santander.com.br',
      path: `/collection_bill_management/v2/workspaces/${process.env.SANTANDER_WORKSPACE_ID}/bank_slips`, // CONFIRMAR no Swagger
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
      santander_cobranca_id: resp.id || resp.bankNumber || null,
      santander_qrcode: resp.qrCodePix || resp.pix?.qrCode || null,
      santander_linha_digitavel: resp.digitableLine || null,
      santander_link_pdf: resp.bankSlipUrl || null,
    }).eq('id', cobranca_id);

    console.log(`[santander/criar-cobranca] OK — cobranca ${cobranca_id}`);
    res.json({ok:true, ...resp});
  }catch(e){
    console.error('[santander/criar-cobranca]', e.message);
    res.status(500).json({error: e.message});
  }
});
