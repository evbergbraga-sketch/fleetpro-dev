// ══ COBRANÇA — CONFIRMAR PAGAMENTO (via n8n) ══
app.post('/api/cobranca/pagamento', async (req, res) => {
  try{
    const { asaas_payment_id, asaas_subscription_id, valor_pago, data_pagamento } = req.body;
    if(!asaas_payment_id && !asaas_subscription_id){
      return res.status(400).json({error:'asaas_payment_id ou asaas_subscription_id é obrigatório'});
    }

    // 1) Tenta achar a cobrança já vinculada a esse payment_id (pagamentos recorrentes futuros)
    let cobranca = null;
    if(asaas_payment_id){
      const {data} = await sb.from('cobrancas_semanais')
        .select('*').eq('asaas_payment_id', asaas_payment_id).maybeSingle();
      cobranca = data || null;
    }

    // 2) Se não achou, busca a locação pelo subscription_id e pega a próxima cobrança pendente
    let locacaoId = cobranca?.locacao_id || null;
    if(!cobranca && asaas_subscription_id){
      const {data:loc} = await sb.from('locacoes')
        .select('id').eq('asaas_subscription_id', asaas_subscription_id).maybeSingle();
      if(!loc) return res.status(404).json({error:'Locação não encontrada para asaas_subscription_id informado'});
      locacaoId = loc.id;

      const {data:proxima} = await sb.from('cobrancas_semanais')
        .select('*')
        .eq('locacao_id', locacaoId)
        .eq('status','pendente')
        .order('numero_semana',{ascending:true})
        .limit(1)
        .maybeSingle();
      if(!proxima) return res.status(404).json({error:'Nenhuma cobrança pendente encontrada para esta locação'});
      cobranca = proxima;
    }

    if(!cobranca) return res.status(404).json({error:'Cobrança não encontrada'});
    if(cobranca.status==='pago') return res.json({ok:true, message:'Cobrança já estava marcada como paga', cobranca_id: cobranca.id});

    const valorFinal = valor_pago!=null ? Number(valor_pago) : Number(cobranca.valor);
    const dataPag = data_pagamento ? new Date(data_pagamento).toISOString() : new Date().toISOString();

    // Busca dados da locação para descrição do lançamento
    const {data:loc} = await sb.from('locacoes')
      .select('num_contrato, veiculo_id, cliente_id, veiculos(placa), clientes(nome)')
      .eq('id', cobranca.locacao_id).maybeSingle();

    // Cria lançamento financeiro
    const {data:lanc} = await sb.from('lancamentos').insert({
      tipo: 'receita',
      categoria: 'Aluguel',
      descricao: `Contrato #${loc?.num_contrato||''} — ${loc?.clientes?.nome||'Cliente'} — ${loc?.veiculos?.placa||''} — Semana ${cobranca.numero_semana}`,
      valor: valorFinal,
      data: dataPag.slice(0,10),
      veiculo_id: loc?.veiculo_id||null,
      locacao_id: cobranca.locacao_id,
      forma_pgto: 'PIX',
      origem: 'asaas',
    }).select().single();

    // Marca cobrança como paga
    await sb.from('cobrancas_semanais').update({
      status: 'pago',
      valor_pago: valorFinal,
      data_pagamento: dataPag,
      asaas_payment_id: asaas_payment_id || cobranca.asaas_payment_id || null,
      lancamento_id: lanc?.id || null,
    }).eq('id', cobranca.id);

    console.log(`[cobranca/pagamento] OK — locacao ${cobranca.locacao_id} semana ${cobranca.numero_semana} marcada como paga (R$ ${valorFinal})`);
    res.json({ok:true, cobranca_id: cobranca.id, numero_semana: cobranca.numero_semana, valor_pago: valorFinal});
  }catch(e){
    console.error('[cobranca/pagamento]', e.message);
    res.status(500).json({error: e.message});
  }
});
