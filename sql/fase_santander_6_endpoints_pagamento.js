// ══ ENDPOINTS PÚBLICOS PARA A PÁGINA pagar.html (sem login) ══
//
// A cobrança já foi criada antecipadamente pelo cron (fase_santander_5),
// então normalmente já existe santander_bank_number/qrcode/linha_digitavel
// quando o cliente abre o link. gerar-pix fica como FALLBACK para o caso
// raro de o cliente pagar antes do cron rodar (contrato criadíssimo em cima
// da hora) — reaproveita a mesma lógica de fase_santander_3.

// ── GET detalhes da cobrança (dados públicos, sem info sensível do cliente) ──
app.get('/api/pagamento/detalhes/:id', async (req, res) => {
  try{
    const { data: c } = await sb.from('cobrancas_semanais')
      .select(`id, numero_semana, data_vencimento, valor, status,
        santander_bank_number, santander_barcode, santander_linha_digitavel,
        santander_qrcode, santander_qrcode_url,
        locacoes(veiculos(marca, modelo))`)
      .eq('id', req.params.id).maybeSingle();
    if(!c) return res.status(404).json({error:'Cobrança não encontrada'});

    res.json({
      numero_semana: c.numero_semana,
      data_vencimento: c.data_vencimento,
      valor: c.valor,
      status: c.status,
      veiculo_nome: c.locacoes?.veiculos ? `${c.locacoes.veiculos.marca} ${c.locacoes.veiculos.modelo}` : null,
      ja_gerado: !!c.santander_bank_number,
      linha_digitavel: c.santander_linha_digitavel || null,
      codigo_barras: c.santander_barcode || null,
      pix_copia_cola: c.santander_qrcode || null,
      pix_qrcode_url: c.santander_qrcode_url || null,
    });
  }catch(e){
    console.error('[pagamento/detalhes]', e.message);
    res.status(500).json({error: e.message});
  }
});

// ── POST fallback: gera a cobrança na hora, se o cron ainda não gerou ──
app.post('/api/pagamento/gerar-pix/:id', async (req, res) => {
  try{
    const { data: c } = await sb.from('cobrancas_semanais')
      .select('id, santander_bank_number').eq('id', req.params.id).maybeSingle();
    if(!c) return res.status(404).json({error:'Cobrança não encontrada'});

    if(!c.santander_bank_number){
      // Reaproveita o endpoint interno de criação (fase_santander_3) via
      // chamada HTTP local, evitando duplicar a lógica.
      const resp = await fetch(`http://localhost:${process.env.PORT || 3001}/api/santander/criar-cobranca`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ cobranca_id: c.id }),
      });
      if(!resp.ok){
        const erro = await resp.json().catch(()=>({}));
        throw new Error(erro.error || 'Falha ao gerar cobrança no Santander');
      }
    }

    const { data: atualizado } = await sb.from('cobrancas_semanais')
      .select('santander_linha_digitavel, santander_barcode, santander_qrcode, santander_qrcode_url')
      .eq('id', c.id).maybeSingle();

    res.json({
      linha_digitavel: atualizado?.santander_linha_digitavel || null,
      codigo_barras: atualizado?.santander_barcode || null,
      pix_copia_cola: atualizado?.santander_qrcode || null,
      pix_qrcode_url: atualizado?.santander_qrcode_url || null,
    });
  }catch(e){
    console.error('[pagamento/gerar-pix]', e.message);
    res.status(500).json({error: e.message});
  }
});

// ── GET status — usado pelo polling da pagar.html a cada 4s ──
app.get('/api/pagamento/status/:id', async (req, res) => {
  try{
    const { data: c } = await sb.from('cobrancas_semanais')
      .select('status').eq('id', req.params.id).maybeSingle();
    if(!c) return res.status(404).json({error:'Cobrança não encontrada'});
    res.json({ pago: c.status === 'pago' });
  }catch(e){
    console.error('[pagamento/status]', e.message);
    res.status(500).json({error: e.message});
  }
});
