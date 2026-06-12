// ══ ASAAS — CRIAR ASSINATURA (via n8n) ══
app.post('/api/asaas/criar-assinatura', async (req, res) => {
  try{
    const { locacao_id, cliente, plano, data_inicio } = req.body;

    const resp = await fetch(process.env.N8N_ASAAS_WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ locacao_id, cliente, plano, data_inicio })
    });

    if(!resp.ok){
      throw new Error('n8n respondeu '+resp.status);
    }

    const result = await resp.json();
    // Esperado: { asaas_customer_id, asaas_subscription_id }
    res.json(result);
  }catch(e){
    console.error('[asaas/criar-assinatura]', e.message);
    res.status(500).json({ error: e.message });
  }
});
