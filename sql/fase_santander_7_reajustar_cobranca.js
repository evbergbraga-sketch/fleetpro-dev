// ══ SANTANDER — REAJUSTAR VALOR/DATA DE BOLETO JÁ REGISTRADO ══
//
// Path e payload confirmados no manual oficial (seção "BANK SLIP |
// Comando de Instruções | PATCH"). Só se aplica a cobranças que JÁ têm
// santander_bank_number preenchido (já registradas de verdade no banco)
// — cobranças ainda não geradas são só atualizadas no nosso banco,
// nada a sincronizar aqui.

const { getSantanderToken, _httpsRequest, _agenteSantander, getSantanderHost, getSantanderClientId, getSantanderWorkspaceId } = require('./santander-auth');

app.post('/api/santander/reajustar-cobranca', async (req, res) => {
  try{
    const { cobranca_id, novo_valor, nova_data_vencimento } = req.body;
    if(!cobranca_id) return res.status(400).json({error:'cobranca_id é obrigatório'});
    if(novo_valor == null && !nova_data_vencimento){
      return res.status(400).json({error:'informe novo_valor ou nova_data_vencimento'});
    }

    const { data: cobranca } = await sb.from('cobrancas_semanais')
      .select('id, santander_bank_number').eq('id', cobranca_id).maybeSingle();
    if(!cobranca) return res.status(404).json({error:'Cobrança não encontrada'});
    if(!cobranca.santander_bank_number){
      return res.json({ok:true, ignorado:true, motivo:'ainda não registrada no Santander, nada a sincronizar'});
    }

    const token = await getSantanderToken();
    const payload = {
      covenantCode: process.env.SANTANDER_CONVENIO,
      bankNumber: cobranca.santander_bank_number,
    };
    if(novo_valor != null) payload.nominalValue = Number(novo_valor).toFixed(2);
    if(nova_data_vencimento) payload.dueDate = nova_data_vencimento;

    const body = JSON.stringify(payload);

    const resp = await _httpsRequest({
      hostname: getSantanderHost(),
      path: `/collection_bill_management/v2/workspaces/${getSantanderWorkspaceId()}/bank_slips`,
      method: 'PATCH',
      agent: _agenteSantander(),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
        'X-Application-Key': getSantanderClientId(),
      },
    }, body);

    console.log(`[santander/reajustar-cobranca] OK — cobranca ${cobranca_id} (bankNumber ${cobranca.santander_bank_number})`);
    res.json({ok:true, ...resp});
  }catch(e){
    console.error('[santander/reajustar-cobranca]', e.message);
    res.status(500).json({error: e.message});
  }
});
