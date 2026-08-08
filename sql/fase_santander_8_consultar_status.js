// ══ SANTANDER — CONSULTAR STATUS REAL DE UM BOLETO (substituto do webhook
// enquanto ele estiver bloqueado em produção) ══
//
// Path confirmado no Swagger oficial: GET /bills?bankNumber=X&beneficiaryCode=Y
// Resposta traz status: 'Ativo' | 'Liquidado' | 'Liquidado Parcialmente' | 'Baixado'
//
// Se detectar pagamento (Liquidado/Liquidado Parcialmente) e nosso banco
// ainda não sabia disso, atualiza automaticamente — mesma lógica do
// webhook, só que sob demanda em vez de reativa.

const { getSantanderToken, _httpsRequest, _agenteSantander, getSantanderHost, getSantanderClientId } = require('./santander-auth');

app.get('/api/santander/consultar-pagamento/:cobranca_id', async (req, res) => {
  try{
    const { data: cobranca } = await sb.from('cobrancas_semanais')
      .select(`*, locacoes(num_contrato, veiculo_id, cliente_id, veiculos(placa), clientes(nome))`)
      .eq('id', req.params.cobranca_id).maybeSingle();
    if(!cobranca) return res.status(404).json({error:'Cobrança não encontrada'});
    if(!cobranca.santander_bank_number){
      return res.json({ok:true, registrado:false, motivo:'ainda não registrada no Santander'});
    }
    if(cobranca.status === 'pago'){
      return res.json({ok:true, status:'Liquidado', ja_marcado_pago:true});
    }

    const token = await getSantanderToken();
    const resp = await _httpsRequest({
      hostname: getSantanderHost(),
      path: `/collection_bill_management/v2/bills?bankNumber=${cobranca.santander_bank_number}&beneficiaryCode=${process.env.SANTANDER_CONVENIO}`,
      method: 'GET',
      agent: _agenteSantander(),
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Application-Key': getSantanderClientId(),
      },
    });

    const conteudo = resp._content || resp;
    const status = conteudo?.status || null;
    const pago = status === 'Liquidado' || status === 'Liquidado Parcialmente';

    if(pago){
      const valorPago = Number(conteudo.paidValue || cobranca.valor);
      const loc = cobranca.locacoes;

      const { data: lanc } = await sb.from('lancamentos').insert({
        tipo: 'receita',
        categoria: 'Aluguel',
        descricao: `Contrato #${loc?.num_contrato||''} — ${loc?.clientes?.nome||'Cliente'} — ${loc?.veiculos?.placa||''} — Semana ${cobranca.numero_semana} (via consulta manual)`,
        valor: valorPago,
        data: new Date().toISOString().slice(0,10),
        veiculo_id: loc?.veiculo_id || null,
        locacao_id: cobranca.locacao_id,
        forma_pgto: 'PIX/Boleto',
        origem: 'santander',
      }).select().single();

      await sb.from('cobrancas_semanais').update({
        status: 'pago',
        valor_pago: valorPago,
        data_pagamento: new Date().toISOString(),
        lancamento_id: lanc?.id || null,
      }).eq('id', cobranca.id);

      console.log(`[santander/consultar-pagamento] detectado pagamento — cobranca ${cobranca.id} marcada como paga`);
    }

    res.json({ ok:true, status, pago, detalhe: conteudo });
  }catch(e){
    console.error('[santander/consultar-pagamento]', e.message);
    res.status(500).json({error: e.message});
  }
});
