// ══ SANTANDER — WEBHOOK DE CONFIRMAÇÃO DE PAGAMENTO ══
//
// ⚠️ CONFIRMAR NO SWAGGER/DOC DE WEBHOOK ANTES DE USAR:
//   - nomes exatos dos campos que o Santander envia no payload
//   - valores possíveis do campo de status (aqui assumido 'PAID'/'LIQUIDATED')
//   - se existe assinatura/validação de origem do webhook (ex: header secreto)
//     — se existir, adicionar validação ANTES de processar, para não aceitar
//     chamadas forjadas nesse endpoint
//
// Espelha a lógica de /api/cobranca/pagamento (Asaas, fase4) mas busca por
// santander_cobranca_id em vez de asaas_payment_id.

app.post('/api/santander/webhook', async (req, res) => {
  try{
    // TODO: validar origem da chamada (assinatura/header) antes de processar

    const { bankNumber, id: santanderId, paymentValue, paymentDate, status } = req.body;
    const statusPago = ['PAID','LIQUIDATED','PAGO']; // CONFIRMAR valores reais do Santander
    if(!statusPago.includes(status)){
      return res.json({ok:true, ignorado:true, motivo:`status '${status}' não é pagamento confirmado`});
    }

    const idBusca = santanderId || bankNumber;
    const { data: cobranca } = await sb.from('cobrancas_semanais')
      .select('*').eq('santander_cobranca_id', idBusca).maybeSingle();
    if(!cobranca) return res.status(404).json({error:'Cobrança Santander não encontrada para id: '+idBusca});
    if(cobranca.status === 'pago') return res.json({ok:true, message:'Cobrança já estava marcada como paga'});

    const valorFinal = paymentValue != null ? Number(paymentValue) : Number(cobranca.valor);
    const dataPag = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();

    const { data: loc } = await sb.from('locacoes')
      .select('num_contrato, veiculo_id, cliente_id, veiculos(placa), clientes(nome)')
      .eq('id', cobranca.locacao_id).maybeSingle();

    const { data: lanc } = await sb.from('lancamentos').insert({
      tipo: 'receita',
      categoria: 'Aluguel',
      descricao: `Contrato #${loc?.num_contrato||''} — ${loc?.clientes?.nome||'Cliente'} — ${loc?.veiculos?.placa||''} — Semana ${cobranca.numero_semana}`,
      valor: valorFinal,
      data: dataPag.slice(0,10),
      veiculo_id: loc?.veiculo_id || null,
      locacao_id: cobranca.locacao_id,
      forma_pgto: 'PIX', // ajustar dinamicamente se o payload distinguir boleto x pix
      origem: 'santander',
    }).select().single();

    await sb.from('cobrancas_semanais').update({
      status: 'pago',
      valor_pago: valorFinal,
      data_pagamento: dataPag,
      lancamento_id: lanc?.id || null,
    }).eq('id', cobranca.id);

    console.log(`[santander/webhook] OK — locacao ${cobranca.locacao_id} semana ${cobranca.numero_semana} marcada como paga (R$ ${valorFinal})`);
    res.json({ok:true, cobranca_id: cobranca.id});
  }catch(e){
    console.error('[santander/webhook]', e.message);
    res.status(500).json({error: e.message});
  }
});
