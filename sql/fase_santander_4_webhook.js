// ══ SANTANDER — WEBHOOK DE CONFIRMAÇÃO DE PAGAMENTO ══
//
// Payload confirmado no manual oficial (seção 7 — Webhook). Campos reais:
//   function: "PAGAMENTO" | "ESTORNO"
//   paymentType: "SANTANDER" | "OUTROS BANCOS" | "PIX"
//   bankNumber: nosso número (é o que usamos para achar a cobrança)
//   covenant: código do convênio
//   payedValue, paymentDate, dueDate, nominalValue, etc.
//
// ⚠️ IMPORTANTE (ver manual, seção 7):
//   Pagamento via boleto/linha digitável é só "intenção de pagamento" —
//   pode ser estornado ao longo do dia. Só é definitivo no dia útil
//   seguinte, se não vier um webhook de ESTORNO. Pagamento via PIX/QRCode
//   já é definitivo quando o webhook chega. O Santander recomenda
//   complementar a conciliação com as rotas de consulta (GET), não confiar
//   só no webhook — isso ainda não está implementado aqui (TODO).
//
// ⚠️ Também confirmar: se existe validação de origem/assinatura da chamada
// (ex: IP allowlist, header secreto). Se existir, validar ANTES de processar.

app.post('/api/santander/webhook', async (req, res) => {
  try{
    // TODO: validar origem da chamada antes de processar

    const {
      function: tipoEvento, bankNumber, covenant, payedValue,
      paymentDate, paymentType, nominalValue,
    } = req.body || {};

    if(!bankNumber){
      // Corpo vazio (ou sem bankNumber) — confirmado por e-mail do time
      // técnico Santander (13/08/2026): eles testam a URL com POST de
      // corpo vazio antes de aceitar o cadastro do webhook, e esperam
      // 200 mesmo assim. Isso NÃO é uma notificação real de pagamento
      // (que sempre tem bankNumber), então responde OK sem tratar como
      // erro — não retry, não log de erro.
      return res.status(200).json({ok:true, recebido:true});
    }

    const { data: cobranca } = await sb.from('cobrancas_semanais')
      .select('*').eq('santander_bank_number', bankNumber).maybeSingle();
    if(!cobranca) return res.status(404).json({error:'Cobrança Santander não encontrada para bankNumber: '+bankNumber});

    // ── ESTORNO — reverte a baixa se o pagamento foi cancelado no mesmo dia ──
    if(tipoEvento === 'ESTORNO'){
      if(cobranca.status !== 'pago') return res.json({ok:true, ignorado:true, motivo:'cobrança não estava paga'});
      await sb.from('cobrancas_semanais').update({
        status: 'pendente', valor_pago: null, data_pagamento: null,
      }).eq('id', cobranca.id);
      if(cobranca.lancamento_id){
        await sb.from('lancamentos').update({
          cancelamento_motivo: 'Estorno via webhook Santander',
          cancelado_em: new Date().toISOString(),
        }).eq('id', cobranca.lancamento_id);
      }
      console.log(`[santander/webhook] ESTORNO — cobranca ${cobranca.id} revertida para pendente`);
      return res.json({ok:true, estornado:true, cobranca_id: cobranca.id});
    }

    if(tipoEvento !== 'PAGAMENTO'){
      return res.json({ok:true, ignorado:true, motivo:`function '${tipoEvento}' não tratada`});
    }
    if(cobranca.status === 'pago') return res.json({ok:true, message:'Cobrança já estava marcada como paga'});

    const valorFinal = payedValue != null ? Number(payedValue) : Number(nominalValue ?? cobranca.valor);
    // paymentDate vem no formato "AAAA-MM-DD-HH.MM.SS.NNNNNN" (não-ISO) — normaliza:
    let dataPag = new Date().toISOString();
    if(paymentDate){
      const m = String(paymentDate).match(/^(\d{4}-\d{2}-\d{2})-(\d{2})\.(\d{2})\.(\d{2})/);
      dataPag = m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}`).toISOString() : new Date().toISOString();
    }

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
      forma_pgto: paymentType === 'PIX' ? 'PIX' : 'Boleto',
      origem: 'santander',
    }).select().single();

    await sb.from('cobrancas_semanais').update({
      status: 'pago',
      valor_pago: valorFinal,
      data_pagamento: dataPag,
      lancamento_id: lanc?.id || null,
    }).eq('id', cobranca.id);

    console.log(`[santander/webhook] OK — locacao ${cobranca.locacao_id} semana ${cobranca.numero_semana} marcada como paga (R$ ${valorFinal}, via ${paymentType})`);
    res.json({ok:true, cobranca_id: cobranca.id});
  }catch(e){
    console.error('[santander/webhook]', e.message);
    res.status(500).json({error: e.message});
  }
});
