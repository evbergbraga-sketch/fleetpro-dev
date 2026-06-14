// pipeline.js — Pipeline CRM (Fases 4 e 5)

let _plDados    = [];   // clientes com status_crm
let _plPerfis   = [];   // equipe para filtro responsável
let _plVisuAtual = 'kanban';

const _PL_STATUS = [
  { key:'interesse', label:'🟡 Interesse', cor:'#FAC775', bg:'rgba(250,199,117,.08)', border:'rgba(250,199,117,.25)' },
  { key:'potencial', label:'🔵 Potencial', cor:'#85B7EB', bg:'rgba(133,183,235,.08)', border:'rgba(133,183,235,.25)' },
  { key:'ativo',     label:'🟢 Ativo',     cor:'#C0DD97', bg:'rgba(192,221,151,.08)', border:'rgba(192,221,151,.25)' },
  { key:'reprovado', label:'🔴 Reprovado', cor:'#F09595', bg:'rgba(240,149,149,.08)', border:'rgba(240,149,149,.25)' },
  { key:'inativo',   label:'⚫ Inativo',   cor:'#B4B2A9', bg:'rgba(180,178,169,.08)', border:'rgba(180,178,169,.25)' },
];

async function iniciarPipeline(){
  // Carrega perfis para o filtro de responsável
  if(!_plPerfis.length){
    const {data} = await sb.from('perfis').select('id,nome,perfil').in('perfil',['admin','atendente']).order('nome');
    _plPerfis = data||[];
    const sel = document.getElementById('pl-responsavel');
    if(sel){
      sel.innerHTML = '<option value="">Todos responsáveis</option>' +
        _plPerfis.map(p=>`<option value="${p.id}">${p.nome.split(' ')[0]}</option>`).join('');
    }
  }
  await _plCarregarDados();
}

async function _plCarregarDados(){
  const {data,error} = await sb.from('clientes')
    .select('id,nome,telefone,status_crm,responsavel_id,followup_em,created_at,perfis(nome)')
    .neq('status_crm','sem_status')
    .not('status_crm','is',null)
    .order('nome');
  if(error){ console.warn('[pipeline]',error.message); return; }
  _plDados = data||[];
  _plRenderMetricas();
  renderPipeline();
}

function _plFiltrar(){
  const busca   = (document.getElementById('pl-busca')?.value||'').toLowerCase();
  const resp    = document.getElementById('pl-responsavel')?.value||'';
  const fu      = document.getElementById('pl-followup')?.value||'';
  const hoje    = new Date().toISOString().slice(0,10);

  return _plDados.filter(c=>{
    if(busca && !c.nome.toLowerCase().includes(busca) && !(c.telefone||'').includes(busca)) return false;
    if(resp && c.responsavel_id !== resp) return false;
    if(fu){
      const cfuDate = (c.followup_em||'').slice(0,10);
      if(fu==='hoje'     && cfuDate !== hoje)        return false;
      if(fu==='atrasado' && (cfuDate >= hoje || !cfuDate)) return false;
      if(fu==='pendente' && !cfuDate)                return false;
    }
    return true;
  });
}

function renderPipeline(){
  const dados = _plFiltrar();
  if(_plVisuAtual==='kanban') _plRenderKanban(dados);
  else                        _plRenderLista(dados);
}

function _plRenderKanban(dados){
  const kb = document.getElementById('pl-kanban');
  if(!kb) return;
  const hoje = new Date().toISOString().slice(0,10);

  kb.innerHTML = _PL_STATUS.map(s=>{
    const itens = dados.filter(c=>c.status_crm===s.key);
    const cards = itens.map(c=>{
      const resp = _plPerfis.find(p=>p.id===c.responsavel_id);
      const fu   = (c.followup_em||'').slice(0,10);
      let fuBadge = '';
      if(fu === hoje) fuBadge = `<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(245,185,66,.15);color:#f5b942;border:1px solid rgba(245,185,66,.3)">🔔 hoje</span>`;
      else if(fu && fu < hoje) fuBadge = `<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(240,149,149,.15);color:#F09595;border:1px solid rgba(240,149,149,.3)">⚠️ atrasado</span>`;
      else if(fu) fuBadge = `<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:var(--bg3);color:var(--muted2)">${fu.split('-').reverse().join('/')}</span>`;
      return `<div onclick="_plAbrirCliente('${c.id}')" style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='${s.cor}'" onmouseout="this.style.borderColor='var(--border2)'">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">${c.nome}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${c.telefone||'—'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${fuBadge}
          ${resp ? `<span style="font-size:10px;color:var(--muted2)">👤 ${resp.nome.split(' ')[0]}</span>` : ''}
        </div>
      </div>`;
    }).join('') || `<div style="font-size:12px;color:var(--muted2);text-align:center;padding:20px 0">—</div>`;

    return `<div style="background:var(--bg2);border-radius:12px;padding:12px;border:1px solid var(--border2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:${s.cor}">${s.label}</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);background:var(--bg3);padding:2px 8px;border-radius:999px">${itens.length}</div>
      </div>
      ${cards}
    </div>`;
  }).join('');
}

function _plRenderLista(dados){
  const tb = document.getElementById('pl-lista-tbody');
  if(!tb) return;
  const hoje = new Date().toISOString().slice(0,10);
  if(!dados.length){ tb.innerHTML='<tr class="empty-row"><td colspan="6">Nenhum lead encontrado</td></tr>'; return; }

  tb.innerHTML = dados.map(c=>{
    const s    = _PL_STATUS.find(x=>x.key===c.status_crm);
    const resp = _plPerfis.find(p=>p.id===c.responsavel_id);
    const fu   = (c.followup_em||'').slice(0,10);
    let fuTxt  = fu ? fu.split('-').reverse().join('/') : '—';
    let fuCor  = 'var(--text)';
    if(fu===hoje){ fuTxt='🔔 '+fuTxt; fuCor='#f5b942'; }
    else if(fu && fu<hoje){ fuTxt='⚠️ '+fuTxt; fuCor='#F09595'; }
    const criado = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—';
    return `<tr style="cursor:pointer" onclick="_plAbrirCliente('${c.id}')">
      <td>
        <div style="font-weight:500">${c.nome}</div>
        <div style="font-size:11px;color:var(--muted)">${c.telefone||'—'}</div>
      </td>
      <td><span style="font-size:11px;padding:3px 10px;border-radius:999px;font-weight:600;background:${s?.bg||'var(--bg2)'};color:${s?.cor||'var(--muted)'};border:1px solid ${s?.border||'var(--border2)'}">${s?.label||c.status_crm}</span></td>
      <td style="font-size:12px;color:var(--muted)">${resp ? resp.nome.split(' ')[0] : '—'}</td>
      <td style="font-size:12px;color:${fuCor}">${fuTxt}</td>
      <td style="font-size:12px;color:var(--muted)">${criado}</td>
      <td>
        <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();_plAbrirCliente('${c.id}')">💬 Chat</button>
      </td>
    </tr>`;
  }).join('');
}

function _plRenderMetricas(){
  const el = document.getElementById('pipeline-metricas');
  if(!el) return;
  const hoje = new Date().toISOString().slice(0,10);
  const total = _plDados.length;
  const ativos    = _plDados.filter(c=>c.status_crm==='ativo').length;
  const conversao = total ? Math.round(ativos/total*100) : 0;
  const fuHoje    = _plDados.filter(c=>(c.followup_em||'').slice(0,10)===hoje).length;
  const fuAtrasado= _plDados.filter(c=>{ const f=(c.followup_em||'').slice(0,10); return f && f<hoje; }).length;
  const semResp   = _plDados.filter(c=>!c.responsavel_id).length;

  el.innerHTML = [
    { val:total,       lbl:'Leads totais',        cor:'var(--accent)',  ico:'🎯' },
    { val:ativos,      lbl:'Ativos',               cor:'#C0DD97',        ico:'🟢' },
    { val:conversao+'%',lbl:'Taxa de conversão',   cor:'var(--gold,#f5b942)', ico:'📈' },
    { val:fuHoje,      lbl:'Follow-ups hoje',      cor:'#f5b942',        ico:'🔔' },
    { val:fuAtrasado,  lbl:'Follow-ups atrasados', cor:'#F09595',        ico:'⚠️' },
  ].map(m=>`
    <div class="card" style="text-align:center;padding:14px">
      <div style="font-size:20px;margin-bottom:4px">${m.ico}</div>
      <div style="font-size:24px;font-weight:800;color:${m.cor}">${m.val}</div>
      <div style="font-size:11px;color:var(--muted2);margin-top:2px">${m.lbl}</div>
    </div>`).join('');
}

function _plVisu(modo){
  _plVisuAtual = modo;
  document.getElementById('pl-kanban').style.display = modo==='kanban' ? 'grid' : 'none';
  document.getElementById('pl-lista').style.display  = modo==='lista'  ? 'block' : 'none';
  document.getElementById('pl-btn-kanban').className = modo==='kanban' ? 'btn btn-primary' : 'btn btn-ghost';
  document.getElementById('pl-btn-lista').className  = modo==='lista'  ? 'btn btn-primary' : 'btn btn-ghost';
  renderPipeline();
}

function _plAbrirCliente(id){
  goPage('chat');
  setTimeout(()=>{ if(typeof abrirChat==='function') abrirChat(id); }, 300);
}
