// ══ CRON — CONSULTAR PAGAMENTO PENDENTE A CADA 5 MIN (substituto
// temporário do webhook, enquanto ele estiver bloqueado em produção —
// ver pendência Talos) ══
//
// Só consulta cobranças que JÁ têm boleto registrado (santander_bank_number
// preenchido) e ainda não foram marcadas como pagas — normalmente é um
// número pequeno de linhas por vez, sem risco de sobrecarregar nada.

async function consultarPagamentosSantanderPendentes(){
  try{
    const { data: pendentes, error } = await sb.from('cobrancas_semanais')
      .select('id, locacoes!inner(provedor_cobranca)')
      .not('santander_bank_number', 'is', null)
      .neq('status', 'pago')
      .eq('locacoes.provedor_cobranca', 'santander');
    if(error) throw error;

    for(const c of (pendentes || [])){
      try{
        const resp = await fetch(`http://localhost:${PORT}/api/santander/consultar-pagamento/${c.id}`);
        const data = await resp.json();
        if(data.pago) console.log(`[cron/consultar-santander] pagamento detectado — cobranca ${c.id}`);
      }catch(e){
        console.error(`[cron/consultar-santander] falhou para cobranca ${c.id}:`, e.message);
      }
    }
  }catch(e){
    console.error('[cron/consultar-santander]', e.message);
  }
}

consultarPagamentosSantanderPendentes();
setInterval(consultarPagamentosSantanderPendentes, 5*60*1000); // a cada 5 minutos
