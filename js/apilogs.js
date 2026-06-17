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
    { val:total,          lbl:'Total de chamadas',   sub:'histórico',      cor:'var(--accent)',
      svg:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>` },
    { val:hojeCount,      lbl:'Hoje',                sub:'requisições',    cor:'#4ADE80',
      svg:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
    { val:erros,          lbl:'Erros (4xx/5xx)',      sub:'total',          cor: erros>0?'#F87171':'var(--muted2)',
      svg:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` },
    { val:avgDur+'ms',    lbl:'Tempo médio',          sub:'de resposta',    cor:'#F5B942',
      svg:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
  ].map(m=>`
    <div class="card" style="padding:16px">
      <div style="color:${m.cor};margin-bottom:8px">${m.svg}</div>
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
    const statusIco = sc===429?'429':sc>=500?'5xx':sc>=400?'4xx':sc>=200?'2xx':'—';

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

// ── TABS ──
function _aplTab(tab){
  const logs = document.getElementById('apl-section-logs');
  const docs = document.getElementById('apl-section-docs');
  const btnLogs = document.getElementById('apl-tab-logs');
  const btnDocs = document.getElementById('apl-tab-docs');
  if(tab==='logs'){
    logs.style.display=''; docs.style.display='none';
    btnLogs.style.borderBottomColor='var(--accent)'; btnLogs.style.color='var(--accent)';
    btnDocs.style.borderBottomColor='transparent';   btnDocs.style.color='var(--muted)';
  } else {
    logs.style.display='none'; docs.style.display='';
    btnDocs.style.borderBottomColor='var(--accent)'; btnDocs.style.color='var(--accent)';
    btnLogs.style.borderBottomColor='transparent';   btnLogs.style.color='var(--muted)';
    _aplRenderDocs();
  }
}

// ── DOCUMENTAÇÃO ──
function _aplRenderDocs(){
  const el = document.getElementById('apl-docs-endpoints');
  if(!el || el.innerHTML) return; // já renderizou

  const endpoints = [
    { method:'POST', path:'/crm/leads', cor:'#4ADE80', bg:'rgba(74,222,128,.08)',
      desc:'Adiciona um novo lead no Pipeline CRM',
      params:[['nome','string','Sim','Nome ou apelido do lead'],['telefone','string','Sim','DDD + número (ex: 21999991234)'],['interesse','string','Não','carro | moto | ambos | indefinido'],['status_crm','string','Não','Label do status (ex: Interesse)'],['observacoes','string','Não','Nota inicial sobre o lead'],['origem','string','Não','Ex: Instagram, WhatsApp, Indicação']],
      req:'{"nome":"João Silva","telefone":"21999991234","interesse":"moto","status_crm":"Interesse","origem":"Instagram"}',
      res:'{"ok":true,"lead":{"id":"uuid","nome":"João Silva","tipo":"lead","status_crm":"Interesse"}}' },
    { method:'PATCH', path:'/crm/leads/:id/status', cor:'#60A5FA', bg:'rgba(96,165,250,.08)',
      desc:'Move um lead para outro status no pipeline',
      params:[['status','string','Sim','Label do status (ex: Potencial, Ativo)'],['nota','string','Não','Registra nota interna junto com a mudança']],
      req:'{"status":"Potencial","nota":"Demonstrou interesse forte"}',
      res:'{"ok":true,"nome":"João Silva","status_anterior":"Interesse","status_novo":"Potencial"}' },
    { method:'GET', path:'/veiculos/disponibilidade', cor:'#F5B942', bg:'rgba(245,185,66,.08)',
      desc:'Verifica quais veículos estão disponíveis',
      params:[['tipo','query','Não','carro | moto — filtra por tipo'],['data','query','Não','YYYY-MM-DD — considera buffer de 4h após devolução']],
      req:'GET /veiculos/disponibilidade?tipo=moto&data=2026-06-20',
      res:'{"ok":true,"resumo":{"disponiveis":4,"alugados":1,"manutencao":0},"disponiveis":[...]}' },
    { method:'GET', path:'/clientes/verificar', cor:'#F5B942', bg:'rgba(245,185,66,.08)',
      desc:'Verifica se um número ou CPF é cliente ativo',
      params:[['telefone','query','Sim*','DDD + número (ex: 21999991234)'],['cpf','query','Sim*','CPF sem pontuação (* um dos dois)']],
      req:'GET /clientes/verificar?telefone=21990331398',
      res:'{"encontrado":true,"tipo":"cliente","cliente_ativo":false,"locacao_ativa":null,"mensagem":"..."}' },
    { method:'GET', path:'/crm/status', cor:'#F5B942', bg:'rgba(245,185,66,.08)',
      desc:'Lista os status disponíveis no pipeline',
      params:[],
      req:'GET /crm/status',
      res:'{"ok":true,"status":[{"label":"Interesse","cor":"#F5B942","ordem":1},...]}' },
  ];

  const methCor = {GET:'#d97706',POST:'#16a34a',PATCH:'#2563eb'};
  const methBg  = {GET:'rgba(217,119,6,.1)',POST:'rgba(22,163,74,.1)',PATCH:'rgba(37,99,235,.1)'};

  el.innerHTML = endpoints.map(ep=>`
    <div style="border:1px solid var(--border2);border-radius:10px;overflow:hidden;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${ep.bg}">
        <span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;background:${methBg[ep.method]||'var(--bg2)'};color:${methCor[ep.method]||ep.cor};min-width:52px;text-align:center">${ep.method}</span>
        <code style="font-size:13px;font-weight:600;color:var(--text)">https://bridge.ruahsystems.com.br/api/v1${ep.path}</code>
      </div>
      <div style="padding:14px 16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${ep.desc}</div>
        ${ep.params.length ? `
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Parâmetros</div>
        <table style="width:100%;margin-bottom:12px;font-size:12px;border-collapse:collapse">
          <thead><tr style="background:var(--bg2)">
            <th style="padding:6px 10px;text-align:left;font-weight:600">Campo</th>
            <th style="padding:6px 10px;text-align:left;font-weight:600">Tipo</th>
            <th style="padding:6px 10px;text-align:left;font-weight:600">Obrig.</th>
            <th style="padding:6px 10px;text-align:left;font-weight:600">Descrição</th>
          </tr></thead>
          <tbody>${ep.params.map(p=>`
            <tr style="border-top:1px solid var(--border2)">
              <td style="padding:6px 10px"><code style="font-size:11px;background:var(--bg2);padding:2px 6px;border-radius:4px">${p[0]}</code></td>
              <td style="padding:6px 10px;color:var(--muted);font-size:11px">${p[1]}</td>
              <td style="padding:6px 10px;color:${p[2].startsWith('Sim')?'#4ADE80':'var(--muted2)'};font-size:11px;font-weight:600">${p[2]}</td>
              <td style="padding:6px 10px;color:var(--muted);font-size:12px">${p[3]}</td>
            </tr>`).join('')}</tbody>
        </table>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Exemplo</div>
            <code style="display:block;background:var(--bg2);padding:10px;border-radius:8px;font-size:11px;color:var(--text);word-break:break-all;line-height:1.5">${ep.req}</code>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Resposta (200)</div>
            <code style="display:block;background:var(--bg2);padding:10px;border-radius:8px;font-size:11px;color:var(--text);word-break:break-all;line-height:1.5">${ep.res}</code>
          </div>
        </div>
      </div>
    </div>`).join('');
}
