// ══ CRON — GERAR COBRANÇAS SANTANDER (N dias antes do vencimento) ══
//
// Diferente do Asaas (que gera cobranças futuras sozinho via "assinatura"),
// o Santander não tem esse conceito — cada cobranca_semanal vira UMA chamada
// de criação de boleto/PIX individual. Este cron varre as cobranças
// pendentes de locações marcadas com provedor_cobranca='santander' e cria
// a cobrança no banco DIAS_ANTECEDENCIA dias antes do vencimento.
//
// Roda a cada 6h (mesmo intervalo do cron de sync do Asaas hoje).

const DIAS_ANTECEDENCIA = 3; // ajustar conforme preferência do negócio

async function gerarCobrancasSantanderPendentes(){
  try{
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ANTECEDENCIA);
    const limiteStr = limite.toISOString().slice(0,10);

    const { data: pendentes, error } = await sb.from('cobrancas_semanais')
      .select('id, data_vencimento, locacoes!inner(provedor_cobranca)')
      .eq('status', 'pendente')
      .is('santander_cobranca_id', null)
      .eq('locacoes.provedor_cobranca', 'santander')
      .lte('data_vencimento', limiteStr);
    if(error) throw error;

    for(const c of (pendentes || [])){
      try{
        const resp = await fetch(`http://localhost:${process.env.PORT || 3001}/api/santander/criar-cobranca`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ cobranca_id: c.id }),
        });
        if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
        console.log(`[cron/santander] cobrança criada para ${c.id}`);
      }catch(e){
        console.error(`[cron/santander] falhou para cobranca ${c.id}:`, e.message);
      }
    }
  }catch(e){
    console.error('[cron/santander-gerar]', e.message);
  }
}

gerarCobrancasSantanderPendentes();
setInterval(gerarCobrancasSantanderPendentes, 6*60*60*1000); // a cada 6 horas
