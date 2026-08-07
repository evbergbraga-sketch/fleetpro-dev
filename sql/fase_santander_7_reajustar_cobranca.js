// ══ SANTANDER — REAJUSTAR VALOR/DATA DE BOLETO JÁ REGISTRADO ══
//
// Só se aplica a cobranças que JÁ têm santander_bank_number preenchido
// (já registradas de verdade no banco) — cobranças ainda não geradas são
// só atualizadas no nosso banco, nada a sincronizar aqui.
//
// DATA: PATCH direto no bank_slip (campo dueDate) — sem restrição de
// tipo de documento, confirmado no manual.
//
// VALOR: documentKind RECIBO (o que usamos) NÃO permite PATCH de
// nominalValue — confirmado em teste real de produção (erro 596:
// "Especie de documento nao permite alteracao de valor nominal", só
// permitido pra BCC/BDP conforme o manual). Estratégia: BAIXAR o boleto
// antigo + criar um novo já com o valor certo. O "nosso número" muda
// (incrementa a tentativa) pra não colidir com o anterior, já baixado.

const { getSantanderToken, _httpsRequest, _agenteSantander, getSantanderHost, getSantanderClientId, getSantanderWorkspaceId } = require('./santander-auth');

app.post('/api/santander/reajustar-cobranca', async (req, res) => {
  try{
    const { cobranca_id, novo_valor, nova_data_vencimento } = req.body;
    if(!cobranca_id) return res.status(400).json({error:'cobranca_id é obrigatório'});
    if(novo_valor == null && !nova_data_vencimento){
      return res.status(400).json({error:'informe novo_valor ou nova_data_vencimento'});
    }

    const { data: cobranca } = await sb.from('cobrancas_semanais')
      .select('id, santander_bank_number, santander_tentativa').eq('id', cobranca_id).maybeSingle();
    if(!cobranca) return res.status(404).json({error:'Cobrança não encontrada'});
    if(!cobranca.santander_bank_number){
      return res.json({ok:true, ignorado:true, motivo:'ainda não registrada no Santander, nada a sincronizar'});
    }

    const token = await getSantanderToken();

    // ── Reajuste de DATA — PATCH direto, funciona pra qualquer documentKind ──
    if(nova_data_vencimento && novo_valor == null){
      const body = JSON.stringify({
        covenantCode: process.env.SANTANDER_CONVENIO,
        bankNumber: cobranca.santander_bank_number,
        dueDate: nova_data_vencimento,
      });
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
      console.log(`[santander/reajustar-cobranca] data OK — cobranca ${cobranca_id}`);
      return res.json({ok:true, tipo:'data', ...resp});
    }

    // ── Reajuste de VALOR — documentKind RECIBO não aceita PATCH de
    // nominalValue, precisa BAIXAR + recriar ──
    if(novo_valor != null){
      const bodyBaixa = JSON.stringify({
        covenantCode: process.env.SANTANDER_CONVENIO,
        bankNumber: cobranca.santander_bank_number,
        operation: 'BAIXAR',
      });
      await _httpsRequest({
        hostname: getSantanderHost(),
        path: `/collection_bill_management/v2/workspaces/${getSantanderWorkspaceId()}/bank_slips`,
        method: 'PATCH',
        agent: _agenteSantander(),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyBaixa),
          'Authorization': `Bearer ${token}`,
          'X-Application-Key': getSantanderClientId(),
        },
      }, bodyBaixa);
      console.log(`[santander/reajustar-cobranca] baixa OK — bankNumber antigo ${cobranca.santander_bank_number}`);

      // Limpa o registro local e incrementa a tentativa (gera nosso-número novo)
      await sb.from('cobrancas_semanais').update({
        valor: novo_valor,
        santander_bank_number: null,
        santander_barcode: null,
        santander_linha_digitavel: null,
        santander_qrcode: null,
        santander_qrcode_url: null,
        santander_tentativa: (cobranca.santander_tentativa || 1) + 1,
      }).eq('id', cobranca_id);

      // Recria via o próprio endpoint interno (evita duplicar a lógica de payload)
      const respCriar = await fetch(`http://localhost:${PORT}/api/santander/criar-cobranca`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ cobranca_id }),
      });
      const dataCriar = await respCriar.json();
      if(!respCriar.ok) throw new Error('Baixa OK, mas recriação falhou: '+(dataCriar.error||'erro desconhecido'));

      console.log(`[santander/reajustar-cobranca] valor OK — cobranca ${cobranca_id} recriada com novo bankNumber`);
      return res.json({ok:true, tipo:'valor', ...dataCriar});
    }
  }catch(e){
    console.error('[santander/reajustar-cobranca]', e.message);
    res.status(500).json({error: e.message});
  }
});
