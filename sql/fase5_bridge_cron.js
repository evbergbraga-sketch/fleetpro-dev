// ══ CRON — MARCAR COBRANÇAS ATRASADAS (roda a cada 1h) ══
async function marcarCobrancasAtrasadas(){
  try{
    const hoje = new Date().toISOString().slice(0,10);
    const {data, error} = await sb.from('cobrancas_semanais')
      .update({status:'atrasado'})
      .eq('status','pendente')
      .lt('data_vencimento', hoje)
      .select('id');
    if(error) throw error;
    if(data?.length) console.log(`[cron] ${data.length} cobrança(s) marcada(s) como atrasada(s)`);
  }catch(e){ console.error('[cron/atrasados]', e.message); }
}
marcarCobrancasAtrasadas();
setInterval(marcarCobrancasAtrasadas, 60*60*1000); // a cada 1 hora
