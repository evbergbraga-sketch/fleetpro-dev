// apilogs.js — Página de Logs da API (admin only)

let _aplDados = [];

async function iniciarApiLogs(){
  const tbody = document.getElementById('apl-tbody');
  if(tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">⏳ Carregando...</td></tr>`;

  const {data, error} = await sb.from('api_logs')
    .select('*')
    .order('created_at', {ascending: false})
    .limit(500);

  if(error){ console.warn('[apilogs]', error.message); return; }
  _aplDados = data||[];
  _aplRenderMetricas();
  renderApiLogs();
}

function _aplRenderMetricas(){
  const el = document.getElementById('apilogs-metricas');
  if(!el) return;

  const total     = _aplDados.length;
  const hoje      = new Date().toISOString().slice(0,10);
  const hojeCount = _aplDados.filter(l=>l.created_at?.slice(0,10)===hoje).length;
  const erros     = _aplDados.filter(l=>l.status_code>=400).length;
  const rateLimit = _aplDados.filter(l=>l.status_code===429).length;
  const avgDur    = _aplDados.filter(l=>l.duration_ms).length
    ? Math.round(_aplDados.filter(l=>l.duration_ms).reduce((s,l)=>s+(l.duration_ms||0),0) / _aplDados.filter(l=>l.duration_ms).length)
    : 0;

  el.innerHTML = [
    { val:total,          lbl:'Total de chamadas',   sub:'histórico',      ico:'📊', cor:'var(--accent)' },
    { val:hojeCount,      lbl:'Hoje',                sub:'requisições',    ico:'📅', cor:'#4ADE80' },
    { val:erros,          lbl:'Erros (4xx/5xx)',      sub:'total',          ico:'🔴', cor: erros>0?'#F87171':'var(--muted2)' },
    { val:avgDur+'ms',    lbl:'Tempo médio',          sub:'de resposta',    ico:'⚡', cor:'#F5B942' },
  ].map(m=>`
    <div class="card" style="padding:16px">
      <div style="font-size:22px;margin-bottom:6px">${m.ico}</div>
      <div style="font-size:24px;font-weight:800;color:${m.cor}">${m.val}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:2px">${m.lbl}</div>
      <div style="font-size:10px;color:var(--muted2)">${m.sub}</div>
    </div>`).join('');
}

function renderApiLogs(){
  const metodo = document.getElementById('apl-metodo')?.value||'';
  const status = document.getElementById('apl-status')?.value||'';
  const data   = document.getElementById('apl-data')?.value||'';
  const tbody  = document.getElementById('apl-tbody');
  const total  = document.getElementById('apl-total');
  if(!tbody) return;

  let filtrados = _aplDados.filter(l=>{
    if(metodo && l.method !== metodo) return false;
    if(status && String(l.status_code) !== status) return false;
    if(data   && l.created_at?.slice(0,10) !== data) return false;
    return true;
  });

  if(total) total.textContent = `${filtrados.length} registros`;

  if(!filtrados.length){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Nenhum log encontrado</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(l=>{
    const dt  = new Date(l.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
               +' '+new Date(l.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

    // Cor do método
    const metodoCor = {GET:'#F5B942',POST:'#4ADE80',PATCH:'#60A5FA',DELETE:'#F87171'}[l.method]||'var(--muted)';
    const metodoBg  = {GET:'rgba(245,185,66,.12)',POST:'rgba(74,222,128,.12)',PATCH:'rgba(96,165,250,.12)',DELETE:'rgba(248,113,113,.12)'}[l.method]||'var(--bg2)';

    // Cor do status
    const sc = l.status_code||0;
    const statusCor = sc>=500?'#F87171':sc>=400?'#F87171':sc>=200?'#4ADE80':'var(--muted)';
    const statusBg  = sc>=400?'rgba(248,113,113,.1)':'rgba(74,222,128,.1)';
    const statusIco = sc===429?'⚠️':sc>=500?'🔴':sc>=400?'🔴':'✅';

    const dur = l.duration_ms ? `${l.duration_ms}ms` : '—';

    return `<tr>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap">${dt}</td>
      <td><span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;background:${metodoBg};color:${metodoCor}">${l.method||'—'}</span></td>
      <td style="font-size:12px;font-family:monospace;color:var(--text);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.endpoint||'—'}</td>
      <td style="font-size:11px;color:var(--muted);font-family:monospace">${l.ip||'—'}</td>
      <td style="font-size:11px;color:var(--muted);font-family:monospace">${l.token_id||'—'}</td>
      <td><span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;background:${statusBg};color:${statusCor}">${statusIco} ${sc||'—'}</span></td>
      <td style="font-size:11px;color:var(--muted)">${dur}</td>
    </tr>`;
  }).join('');
}
