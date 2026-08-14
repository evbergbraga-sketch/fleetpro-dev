// ══ CRON — MANTER JANELA DE 4 BOLETOS ABERTOS POR CONTRATO ══
//
// Motivação de negócio: o Santander não tem conceito de "assinatura"
// (como o Asaas tinha), então o banco não enxerga o fluxo futuro de
// recebíveis da empresa. Mantendo sempre N boletos registrados à frente,
// esse fluxo fica visível pro banco. Sugestão validada com o gerente.
//
// Regra: cada locação ativa com provedor_cobranca='santander' deve ter
// sempre exatamente JANELA_BOLETOS cobranças registradas e não pagas.
// Conforme o cliente paga, o cron repõe (registra a próxima da fila).
// Atraso NÃO gera reposição — a atrasada continua ocupando uma vaga da
// janela até ser paga (evita bola de neve de boletos abertos).
//
// Roda a cada 30 min. Independente da régua de WhatsApp (fase_santander_5),
// que continua notificando por data de vencimento, não por data de registro.

const JANELA_BOLETOS = 4;

async function manterJanelaBoletosSantander(){
  try{
    // Locações ativas que usam Santander
    const { data: locacoes, error: errLoc } = await sb.from('locacoes')
      .select('id, num_contrato')
      .eq('provedor_cobranca', 'santander')
      .eq('status', 'ativa');
    if(errLoc) throw errLoc;

    for(const loc of (locacoes || [])){
      try{
        // Quantas já estão registradas no Santander e ainda não pagas
        const { count: abertas, error: errCount } = await sb.from('cobrancas_semanais')
          .select('id', { count: 'exact', head: true })
          .eq('locacao_id', loc.id)
          .not('santander_bank_number', 'is', null)
          .neq('status', 'pago');
        if(errCount) throw errCount;

        const faltam = JANELA_BOLETOS - (abertas || 0);
        if(faltam <= 0) continue; // janela já cheia, nada a fazer

        // Próximas da fila: pendentes, ainda sem boleto, mais próximas de vencer
        const { data: proximas, error: errProx } = await sb.from('cobrancas_semanais')
          .select('id, numero_semana')
          .eq('locacao_id', loc.id)
          .eq('status', 'pendente')
          .is('santander_bank_number', null)
          .order('data_vencimento', { ascending: true })
          .limit(faltam);
        if(errProx) throw errProx;

        for(const c of (proximas || [])){
          try{
            const resp = await fetch(`http://localhost:${PORT}/api/santander/criar-cobranca`, {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ cobranca_id: c.id }),
            });
            if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
            console.log(`[janela/santander] boleto registrado — contrato #${loc.num_contrato} semana ${c.numero_semana}`);
          }catch(e){
            console.error(`[janela/santander] falhou p/ cobranca ${c.id} (contrato #${loc.num_contrato}):`, e.message);
          }
        }
      }catch(e){
        console.error(`[janela/santander] erro na locacao ${loc.id}:`, e.message);
      }
    }
  }catch(e){
    console.error('[janela/santander-geral]', e.message);
  }
}

manterJanelaBoletosSantander();
setInterval(manterJanelaBoletosSantander, 30*60*1000); // a cada 30 minutos

// Gatilho manual pra testes/depuração (mesmo padrão da régua)
app.post('/api/santander/janela-forcar', async (req, res) => {
  if(req.headers['x-secret'] !== 'FleetPro2025') return res.status(401).json({error:'unauthorized'});
  try{
    await manterJanelaBoletosSantander();
    res.json({ok:true, message:'Janela de boletos processada manualmente'});
  }catch(e){
    res.status(500).json({error: e.message});
  }
});
