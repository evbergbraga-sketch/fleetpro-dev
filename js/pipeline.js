// pipeline.js — Pipeline CRM redesenhado (Fases 4 e 5)

let _plDados     = [];
let _plPerfis    = [];
let _plVisuAtual = 'kanban';
let _plModalData = null; // cliente aberto no modal

const _PL_STATUS = [
  { key:'interesse', label:'Interesse', emoji:'🟡', cor:'#F5B942', bg:'rgba(245,185,66,.12)',  border:'rgba(245,185,66,.3)'  },
  { key:'potencial', label:'Potencial', emoji:'🔵', cor:'#60A5FA', bg:'rgba(96,165,250,.12)',  border:'rgba(96,165,250,.3)'  },
  { key:'ativo',     label:'Ativo',     emoji:'🟢', cor:'#4ADE80', bg:'rgba(74,222,128,.12)',  border:'rgba(74,222,128,.3)'  },
  { key:'reprovado', label:'Reprovado', emoji:'🔴', cor:'#F87171', bg:'rgba(248,113,113,.12)', border:'rgba(248,113,113,.3)' },
  { key:'inativo',   label:'Inativo',   emoji:'⚫', cor:'#9CA3AF', bg:'rgba(156,163,175,.12)', border:'rgba(156,163,175,.3)' },
];

const _PL_VEICULO = {
  carro:    { label:'Carro',  icon:'🚗' },
  moto:     { label:'Moto',   icon:'🏍️' },
  ambos:    { label:'Ambos',  icon:'🚗🏍️' },
  indefinido:{ label:'—',    icon:'' },
};

// ── INICIALIZAÇÃO ──
async function iniciarPipeline(){
  // Carrega status customizados do banco PRIMEIRO
  await _plCarregarStatus();
  _plMostrarConfigBtn();

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
    .select('id,nome,telefone,cpf,email,origem,observacoes,status_crm,responsavel_id,followup_em,motivo_perda,interesse_veiculo,created_at,perfis(nome)')
    .neq('status_crm','sem_status')
    .not('status_crm','is',null)
    .order('nome');
  if(error){ console.warn('[pipeline]',error.message); return; }
  _plDados = data||[];
  _plRenderMetricas();
  renderPipeline();
}

// ── FILTROS ──
function _plFiltrar(){
  const busca = (document.getElementById('pl-busca')?.value||'').toLowerCase();
  const resp  = document.getElementById('pl-responsavel')?.value||'';
  const fu    = document.getElementById('pl-followup')?.value||'';
  const hoje  = new Date().toISOString().slice(0,10);
  return _plDados.filter(c=>{
    if(busca && !c.nome.toLowerCase().includes(busca) && !(c.telefone||'').includes(busca)) return false;
    if(resp && c.responsavel_id !== resp) return false;
    if(fu){
      const d = (c.followup_em||'').slice(0,10);
      if(fu==='hoje'     && d !== hoje)         return false;
      if(fu==='atrasado' && (d>=hoje||!d))      return false;
      if(fu==='pendente' && !d)                 return false;
    }
    return true;
  });
}

function renderPipeline(){
  const dados = _plFiltrar();
  if(_plVisuAtual==='kanban') _plRenderKanban(dados);
  else                        _plRenderLista(dados);
}

// ── KANBAN ──
function _plRenderKanban(dados){
  const kb = document.getElementById('pl-kanban');
  if(!kb) return;
  const hoje = new Date().toISOString().slice(0,10);

  kb.innerHTML = _PL_STATUS.map(s=>{
    const itens = dados.filter(c=>c.status_crm===s.key);

    const cards = itens.map(c=>{
      const resp  = _plPerfis.find(p=>p.id===c.responsavel_id);
      const fu    = (c.followup_em||'').slice(0,10);
      const vei   = _PL_VEICULO[c.interesse_veiculo||'indefinido'];
      const ini   = c.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
      const cores = {interesse:'#92400E',potencial:'#1E3A5F',ativo:'#14532D',reprovado:'#7F1D1D',inativo:'#374151'};
      const bgIni = cores[s.key]||'#374151';

      let fuHtml = '';
      if(fu===hoje)       fuHtml = `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(245,185,66,.15);color:#F5B942;border:1px solid rgba(245,185,66,.3);font-weight:600">🔔 Follow-up hoje</span>`;
      else if(fu&&fu<hoje) fuHtml = `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(248,113,113,.15);color:#F87171;border:1px solid rgba(248,113,113,.3);font-weight:600">⚠️ Atrasado</span>`;
      else if(fu)          fuHtml = `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg3,rgba(0,0,0,.15));color:var(--muted2)">📅 ${fu.split('-').reverse().join('/')}</span>`;

      return `<div onclick="_plAbrirModal('${c.id}')"
        style="background:var(--card,#fff);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-bottom:8px;cursor:pointer;transition:all .18s;box-shadow:0 1px 3px rgba(0,0,0,.04)"
        onmouseover="this.style.borderColor='${s.cor}';this.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'"
        onmouseout="this.style.borderColor='var(--border2)';this.style.boxShadow='0 1px 3px rgba(0,0,0,.04)'">

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:${bgIni};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${ini}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nome}</div>
            <div style="font-size:11px;color:var(--muted)">${c.telefone||'—'}</div>
          </div>
          ${vei.icon ? `<div style="font-size:16px;flex-shrink:0" title="Interesse: ${vei.label}">${vei.icon}</div>` : ''}
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
          ${fuHtml}
          ${resp ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg2);color:var(--muted2);border:1px solid var(--border2)">👤 ${resp.nome.split(' ')[0]}</span>` : ''}
          ${c.origem ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg2);color:var(--muted2);border:1px solid var(--border2)">${c.origem}</span>` : ''}
        </div>
      </div>`;
    }).join('') || `<div style="font-size:12px;color:var(--muted2);text-align:center;padding:24px 0;opacity:.6">Nenhum lead</div>`;

    return `<div style="background:var(--bg2);border-radius:14px;padding:14px;border:1px solid var(--border2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border2)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:15px">${s.emoji}</span>
          <span style="font-size:13px;font-weight:700;color:var(--text)">${s.label}</span>
        </div>
        <span style="font-size:11px;font-weight:700;color:${s.cor};background:${s.bg};border:1px solid ${s.border};padding:2px 9px;border-radius:999px">${itens.length}</span>
      </div>
      ${cards}
    </div>`;
  }).join('');
}

// ── LISTA ──
function _plRenderLista(dados){
  const tb = document.getElementById('pl-lista-tbody');
  if(!tb) return;
  const hoje = new Date().toISOString().slice(0,10);
  if(!dados.length){ tb.innerHTML='<tr class="empty-row"><td colspan="7">Nenhum lead encontrado</td></tr>'; return; }
  tb.innerHTML = dados.map(c=>{
    const s    = _PL_STATUS.find(x=>x.key===c.status_crm);
    const resp = _plPerfis.find(p=>p.id===c.responsavel_id);
    const fu   = (c.followup_em||'').slice(0,10);
    const vei  = _PL_VEICULO[c.interesse_veiculo||'indefinido'];
    let fuTxt='—', fuCor='var(--text)';
    if(fu){ fuTxt=fu.split('-').reverse().join('/'); }
    if(fu===hoje){ fuTxt='🔔 '+fuTxt; fuCor='#F5B942'; }
    else if(fu&&fu<hoje){ fuTxt='⚠️ '+fuTxt; fuCor='#F87171'; }
    const criado = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—';
    return `<tr style="cursor:pointer" onclick="_plAbrirModal('${c.id}')">
      <td>
        <div style="font-weight:600">${c.nome}</div>
        <div style="font-size:11px;color:var(--muted)">${c.telefone||'—'}</div>
      </td>
      <td><span style="font-size:11px;padding:3px 10px;border-radius:999px;font-weight:600;background:${s?.bg||'var(--bg2)'};color:${s?.cor||'var(--muted)'};border:1px solid ${s?.border||'var(--border2)'}">${s?.emoji} ${s?.label||c.status_crm}</span></td>
      <td style="font-size:13px">${vei.icon} ${vei.icon ? vei.label : '—'}</td>
      <td style="font-size:12px;color:var(--muted)">${resp ? resp.nome.split(' ')[0] : '—'}</td>
      <td style="font-size:12px;color:${fuCor}">${fuTxt}</td>
      <td style="font-size:12px;color:var(--muted)">${criado}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();_plAbrirModal('${c.id}')">👁 Ver</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();_plIrChat('${c.id}')">💬</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── MÉTRICAS ──
function _plRenderMetricas(){
  const el = document.getElementById('pipeline-metricas');
  if(!el) return;
  const hoje  = new Date().toISOString().slice(0,10);
  const total = _plDados.length;
  const ativos    = _plDados.filter(c=>c.status_crm==='ativo').length;
  const interesse = _plDados.filter(c=>c.status_crm==='interesse').length;
  const fuHoje    = _plDados.filter(c=>(c.followup_em||'').slice(0,10)===hoje).length;
  const fuAtraso  = _plDados.filter(c=>{ const d=(c.followup_em||'').slice(0,10); return d&&d<hoje; }).length;
  const conversao = total ? Math.round(ativos/total*100) : 0;

  el.innerHTML = [
    { val:total,          lbl:'Total de leads',      cor:'var(--accent)',  ico:'🎯', sub:'no pipeline' },
    { val:interesse,      lbl:'Em interesse',         cor:'#F5B942',        ico:'🟡', sub:'aguardando' },
    { val:ativos,         lbl:'Leads ativos',         cor:'#4ADE80',        ico:'🟢', sub:'com contrato' },
    { val:conversao+'%',  lbl:'Taxa de conversão',    cor:'#60A5FA',        ico:'📈', sub:'interesse→ativo' },
    { val:fuHoje+fuAtraso,lbl:'Follow-ups pendentes', cor:fuHoje+fuAtraso>0?'#F87171':'var(--muted2)', ico:'🔔', sub:`${fuHoje} hoje · ${fuAtraso} atrasado${fuAtraso!==1?'s':''}` },
  ].map(m=>`
    <div class="card" style="padding:16px;position:relative;overflow:hidden">
      <div style="font-size:24px;margin-bottom:8px">${m.ico}</div>
      <div style="font-size:26px;font-weight:800;color:${m.cor};line-height:1">${m.val}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:4px">${m.lbl}</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">${m.sub}</div>
    </div>`).join('');
}

// ── MODAL LEAD ──
async function _plAbrirModal(id){
  const c = _plDados.find(x=>x.id===id);
  if(!c) return;
  _plModalData = c;
  const resp = _plPerfis.find(p=>p.id===c.responsavel_id);
  const s    = _PL_STATUS.find(x=>x.key===c.status_crm);
  const fu   = (c.followup_em||'').slice(0,10);
  const hoje = new Date().toISOString().slice(0,10);
  const vei  = _PL_VEICULO[c.interesse_veiculo||'indefinido'];
  const ini  = c.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();

  // Busca notas e encaminhamentos
  const [{data:notas},{data:encs}] = await Promise.all([
    sb.from('notas_internas').select('*,perfis(nome)').eq('cliente_id',id).order('created_at',{ascending:false}).limit(5),
    sb.from('encaminhamentos').select('*,perfis(nome)').eq('cliente_id',id).order('created_at',{ascending:false}).limit(5),
  ]);
  const hist = [...(notas||[]).map(n=>({...n,_t:'nota'})), ...(encs||[]).map(e=>({...e,_t:'enc'}))]
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  let fuBadge = '';
  if(fu===hoje)       fuBadge = `<span style="font-size:11px;padding:3px 10px;border-radius:999px;background:rgba(245,185,66,.15);color:#F5B942;border:1px solid rgba(245,185,66,.3);font-weight:600">🔔 Follow-up hoje</span>`;
  else if(fu&&fu<hoje) fuBadge = `<span style="font-size:11px;padding:3px 10px;border-radius:999px;background:rgba(248,113,113,.15);color:#F87171;border:1px solid rgba(248,113,113,.3);font-weight:600">⚠️ Follow-up atrasado</span>`;
  else if(fu)          fuBadge = `<span style="font-size:11px;padding:3px 10px;border-radius:999px;background:var(--bg2);color:var(--muted2);border:1px solid var(--border2)">📅 ${fu.split('-').reverse().join('/')}</span>`;

  const histHtml = hist.length ? hist.map(it=>{
    const dt  = new Date(it.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+new Date(it.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const quem = it.perfis?.nome?.split(' ')[0]||'';
    if(it._t==='enc') return `<div style="padding:8px 10px;background:rgba(99,102,241,.08);border-left:2px solid var(--accent);border-radius:0 8px 8px 0;font-size:12px;color:var(--text)">📨 → <strong>${it.setor_destino}</strong><br><span style="color:var(--muted);font-size:10px">${dt} · ${quem}</span></div>`;
    return `<div style="padding:8px 10px;background:var(--bg2);border-left:2px solid var(--border2);border-radius:0 8px 8px 0;font-size:12px;color:var(--text)">📝 ${it.texto}<br><span style="color:var(--muted);font-size:10px">${dt} · ${quem}</span></div>`;
  }).join('') : `<div style="font-size:12px;color:var(--muted2);text-align:center;padding:12px">Sem histórico</div>`;

  document.getElementById('pl-modal-body').innerHTML = `
    <!-- HEADER DO LEAD -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div style="width:52px;height:52px;border-radius:50%;background:${s?.bg||'var(--bg2)'};border:2px solid ${s?.cor||'var(--border2)'};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:${s?.cor||'var(--text)'};flex-shrink:0">${ini}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800;color:var(--text)">${c.nome}</div>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12px;padding:3px 12px;border-radius:999px;font-weight:600;background:${s?.bg};color:${s?.cor};border:1px solid ${s?.border}">${s?.emoji} ${s?.label}</span>
          ${vei.icon ? `<span style="font-size:12px;padding:3px 12px;border-radius:999px;background:var(--bg2);color:var(--text);border:1px solid var(--border2)">${vei.icon} ${vei.label}</span>` : ''}
          ${fuBadge}
        </div>
      </div>
    </div>

    <!-- GRID INFOS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Telefone</div>
        <div style="font-size:13px;color:var(--text)">${c.telefone||'—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Email</div>
        <div style="font-size:13px;color:var(--text);word-break:break-all">${c.email||'—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Responsável</div>
        <div style="font-size:13px;color:var(--text)">${resp ? '👤 '+resp.nome : '—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Origem</div>
        <div style="font-size:13px;color:var(--text)">${c.origem||'—'}</div>
      </div>
      ${c.motivo_perda ? `<div style="background:rgba(248,113,113,.08);border-radius:10px;padding:12px;border:1px solid rgba(248,113,113,.2);grid-column:span 2">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#F87171;margin-bottom:6px">Motivo de perda</div>
        <div style="font-size:13px;color:var(--text)">${c.motivo_perda}</div>
      </div>` : ''}
      ${c.observacoes ? `<div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2);grid-column:span 2">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:6px">Observações</div>
        <div style="font-size:13px;color:var(--text);line-height:1.5">${c.observacoes}</div>
      </div>` : ''}
    </div>

    <!-- ALTERAR STATUS + INTERESSE -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;border:1px solid var(--border2);margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:10px">Atualizar lead</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:11px;color:var(--muted2);margin-bottom:4px;display:block">Status CRM</label>
          <select id="plm-status" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
            ${_PL_STATUS.map(st=>`<option value="${st.key}"${st.key===c.status_crm?' selected':''}>${st.emoji} ${st.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--muted2);margin-bottom:4px;display:block">Interesse</label>
          <select id="plm-interesse" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
            <option value="indefinido"${(c.interesse_veiculo||'indefinido')==='indefinido'?' selected':''}>— Indefinido</option>
            <option value="carro"${c.interesse_veiculo==='carro'?' selected':''}>🚗 Carro</option>
            <option value="moto"${c.interesse_veiculo==='moto'?' selected':''}>🏍️ Moto</option>
            <option value="ambos"${c.interesse_veiculo==='ambos'?' selected':''}>🚗🏍️ Ambos</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--muted2);margin-bottom:4px;display:block">Follow-up em</label>
          <input type="date" id="plm-followup" value="${fu}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
        </div>
        <div style="display:flex;align-items:flex-end">
          <button onclick="_plModalSalvar()" style="width:100%;padding:9px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">💾 Salvar alterações</button>
        </div>
      </div>
    </div>

    <!-- NOTA RÁPIDA -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;border:1px solid var(--border2);margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:8px">Nota interna</div>
      <div style="display:flex;gap:8px">
        <input type="text" id="plm-nota" placeholder="Registrar uma observação..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
        <button onclick="_plModalNota()" style="padding:8px 14px;background:rgba(99,102,241,.15);color:var(--accent);border:1px solid rgba(99,102,241,.3);border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;font-weight:600">📝 Registrar</button>
      </div>
    </div>

    <!-- HISTÓRICO -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;border:1px solid var(--border2);margin-bottom:18px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:10px">Histórico</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto">${histHtml}</div>
    </div>

    <!-- AÇÕES -->
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button onclick="closeModal('pl-modal');_plIrChat('${c.id}')" style="flex:1;min-width:120px;padding:10px;background:rgba(74,222,128,.12);color:#4ADE80;border:1px solid rgba(74,222,128,.3);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">💬 Abrir chat</button>
      <button onclick="closeModal('pl-modal');editarCliente('${c.id}')" style="flex:1;min-width:120px;padding:10px;background:var(--bg2);color:var(--text);border:1px solid var(--border2);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">✏️ Editar perfil</button>
      ${c.tipo==='lead' ? `<button onclick="closeModal('pl-modal');abrirConverterCliente('${c.id}')" style="flex:1;min-width:120px;padding:10px;background:rgba(99,102,241,.12);color:var(--accent);border:1px solid rgba(99,102,241,.3);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">✅ Converter em cliente</button>` : ''}
    </div>
  `;

  document.getElementById('m-pl-modal')?.classList.add('show');
}

async function _plModalSalvar(){
  if(!_plModalData) return;
  const status   = document.getElementById('plm-status')?.value;
  const interesse= document.getElementById('plm-interesse')?.value;
  const followup = document.getElementById('plm-followup')?.value||null;
  try{
    await sb.from('clientes').update({status_crm:status, interesse_veiculo:interesse, followup_em:followup}).eq('id',_plModalData.id);
    // Atualiza local
    const idx = _plDados.findIndex(x=>x.id===_plModalData.id);
    if(idx>=0){ _plDados[idx].status_crm=status; _plDados[idx].interesse_veiculo=interesse; _plDados[idx].followup_em=followup; }
    notify('Lead atualizado!','success');
    closeModal('pl-modal');
    _plRenderMetricas();
    renderPipeline();
  }catch(e){ notify('Erro: '+e.message,'error'); }
}

async function _plModalNota(){
  if(!_plModalData) return;
  const inp   = document.getElementById('plm-nota');
  const texto = inp?.value?.trim();
  if(!texto){ notify('Digite uma nota','error'); return; }
  try{
    await sb.from('notas_internas').insert({cliente_id:_plModalData.id, texto, criado_por:currentUser?.id||null});
    if(inp) inp.value='';
    notify('Nota registrada!','success');
    // Reabre modal para atualizar histórico
    _plAbrirModal(_plModalData.id);
  }catch(e){ notify('Erro: '+e.message,'error'); }
}

function _plVisu(modo){
  _plVisuAtual = modo;
  document.getElementById('pl-kanban').style.display = modo==='kanban' ? 'grid' : 'none';
  document.getElementById('pl-lista').style.display  = modo==='lista'  ? 'block' : 'none';
  document.getElementById('pl-btn-kanban').className = modo==='kanban' ? 'btn btn-primary' : 'btn btn-ghost';
  document.getElementById('pl-btn-lista').className  = modo==='lista'  ? 'btn btn-primary' : 'btn btn-ghost';
  renderPipeline();
}

function _plIrChat(id){
  goPage('chat');
  setTimeout(()=>{ if(typeof abrirChat==='function') abrirChat(id); }, 300);
}

// ══ STATUS CUSTOMIZÁVEIS ══
let _plStatusDB = []; // carregado do banco

async function _plCarregarStatus(){
  const {data,error} = await sb.from('crm_status').select('*').eq('ativo',true).order('ordem');
  if(error){ console.warn('[crm_status]',error.message); return; }
  _plStatusDB = data||[];
  // Sobrescreve o array global _PL_STATUS com os dados do banco
  // Mantém compatibilidade com todo o resto do pipeline que usa _PL_STATUS
  _PL_STATUS.length = 0;
  _plStatusDB.forEach(s=>{
    _PL_STATUS.push({ key: s.label.toLowerCase().replace(/\s+/g,'-'), label: s.label, emoji: s.emoji, cor: s.cor, bg: s.bg||`rgba(96,165,250,.12)`, border: s.border||`rgba(96,165,250,.3)`, _id: s.id, _ordem: s.ordem });
  });
}

// Mostra botão configurar só para admin
function _plMostrarConfigBtn(){
  const btn = document.getElementById('pl-btn-config');
  if(btn) btn.style.display = currentPerfil?.perfil==='admin' ? '' : 'none';
}

// ── MODAL DE CONFIGURAÇÃO ──
async function _plAbrirConfig(){
  await _plCarregarStatus(); // refresh
  _plRenderConfigLista();
  document.getElementById('m-pl-config')?.classList.add('show');
}

function _plRenderConfigLista(){
  const lista = document.getElementById('pl-config-lista');
  if(!lista) return;

  lista.innerHTML = _plStatusDB.map((s,i)=>`
    <div id="plcfg-row-${s.id}" data-id="${s.id}" data-ordem="${s.ordem}"
      style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:8px;align-items:center;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:10px 12px">

      <!-- Setas reordenar -->
      <div style="display:flex;flex-direction:column;gap:2px">
        <button onclick="_plCfgMover('${s.id}',-1)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:0;line-height:1" ${i===0?'disabled style="opacity:.3"':''}>▲</button>
        <button onclick="_plCfgMover('${s.id}',1)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:0;line-height:1" ${i===_plStatusDB.length-1?'disabled style="opacity:.3"':''}>▼</button>
      </div>

      <!-- Emoji picker simples -->
      <input type="text" value="${s.emoji}" maxlength="2"
        onchange="_plCfgUpdate('${s.id}','emoji',this.value)"
        style="width:36px;font-size:18px;text-align:center;border:1px solid var(--border2);border-radius:6px;background:var(--card);color:var(--text);padding:4px">

      <!-- Label -->
      <input type="text" value="${s.label}"
        onchange="_plCfgUpdate('${s.id}','label',this.value)"
        style="flex:1;padding:7px 10px;border:1px solid var(--border2);border-radius:8px;background:var(--card);color:var(--text);font-size:13px;font-weight:500">

      <!-- Cor -->
      <input type="color" value="${s.cor}"
        oninput="_plCfgPreviewCor('${s.id}',this.value)"
        onchange="_plCfgUpdate('${s.id}','cor',this.value)"
        style="width:32px;height:32px;border:none;border-radius:6px;cursor:pointer;padding:0">

      <!-- Preview badge -->
      <span style="font-size:11px;padding:3px 10px;border-radius:999px;font-weight:600;background:${s.bg};color:${s.cor};border:1px solid ${s.border};white-space:nowrap">${s.emoji} ${s.label}</span>

      <!-- Remover -->
      <button onclick="_plCfgRemover('${s.id}','${s.label}')"
        style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:2px 4px;border-radius:6px;transition:.15s"
        onmouseover="this.style.color='#F87171'" onmouseout="this.style.color='var(--muted)'">✕</button>
    </div>`).join('');
}

async function _plCfgUpdate(id, campo, valor){
  const s = _plStatusDB.find(x=>x.id===id);
  if(!s) return;

  // Calcula bg e border a partir da cor hex
  let updateObj = { [campo]: valor };
  if(campo==='cor'){
    // Extrai r,g,b para gerar bg/border consistentes
    const r = parseInt(valor.slice(1,3),16);
    const g = parseInt(valor.slice(3,5),16);
    const b = parseInt(valor.slice(5,7),16);
    updateObj.bg     = `rgba(${r},${g},${b},.12)`;
    updateObj.border = `rgba(${r},${g},${b},.3)`;
    s.bg     = updateObj.bg;
    s.border = updateObj.border;
  }

  // Se renomear label: migra leads que tinham o label antigo
  if(campo==='label' && s.label !== valor){
    const oldLabel = s.label;
    const oldKey   = oldLabel.toLowerCase().replace(/\s+/g,'-');
    // Atualiza clientes que tinham o status antigo
    await sb.from('clientes').update({status_crm: valor}).eq('status_crm', oldKey);
    await sb.from('clientes').update({status_crm: valor}).eq('status_crm', oldLabel);
  }

  s[campo] = valor;
  await sb.from('crm_status').update(updateObj).eq('id', id);
  _plRenderConfigLista();
}

function _plCfgPreviewCor(id, cor){
  // Atualiza só o badge de preview em tempo real, sem salvar no banco
  const row    = document.querySelector(`[data-id="${id}"]`);
  const badge  = row?.querySelector('span[style*="border-radius:999px"]');
  if(!badge) return;
  const r = parseInt(cor.slice(1,3),16);
  const g = parseInt(cor.slice(3,5),16);
  const b = parseInt(cor.slice(5,7),16);
  badge.style.background = `rgba(${r},${g},${b},.12)`;
  badge.style.color      = cor;
  badge.style.borderColor= `rgba(${r},${g},${b},.3)`;
}

async function _plCfgMover(id, dir){
  const idx = _plStatusDB.findIndex(x=>x.id===id);
  if(idx===-1) return;
  const troca = idx + dir;
  if(troca < 0 || troca >= _plStatusDB.length) return;

  // Troca ordens
  const ordemA = _plStatusDB[idx].ordem;
  const ordemB = _plStatusDB[troca].ordem;
  _plStatusDB[idx].ordem   = ordemB;
  _plStatusDB[troca].ordem = ordemA;

  await Promise.all([
    sb.from('crm_status').update({ordem: ordemB}).eq('id', _plStatusDB[idx].id),
    sb.from('crm_status').update({ordem: ordemA}).eq('id', _plStatusDB[troca].id),
  ]);

  // Reordena array local
  [_plStatusDB[idx], _plStatusDB[troca]] = [_plStatusDB[troca], _plStatusDB[idx]];
  _plRenderConfigLista();
}

async function _plCfgRemover(id, label){
  if(!confirm(`Remover o status "${label}"? Leads com esse status ficarão sem status.`)) return;

  // Leads com esse status → sem_status
  const key = label.toLowerCase().replace(/\s+/g,'-');
  await sb.from('clientes').update({status_crm:'sem_status'}).eq('status_crm', key);
  await sb.from('clientes').update({status_crm:'sem_status'}).eq('status_crm', label);

  // Marca como inativo no banco
  await sb.from('crm_status').update({ativo: false}).eq('id', id);
  _plStatusDB = _plStatusDB.filter(x=>x.id!==id);
  _plRenderConfigLista();
  notify(`Status "${label}" removido.`,'success');
}

async function _plConfigSalvarAplicar(){
  const btn = document.querySelector('#m-pl-config .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  try{
    // Salva cada row atual (lê diretamente dos inputs no DOM)
    const rows = document.querySelectorAll('#pl-config-lista [data-id]');
    const updates = [];
    rows.forEach((row,i)=>{
      const id      = row.dataset.id;
      const inputs  = row.querySelectorAll('input');
      const emoji   = inputs[0]?.value?.trim()||'🔵';
      const label   = inputs[1]?.value?.trim();
      const cor     = inputs[2]?.value||'#60A5FA';
      if(!label) return;
      const r = parseInt(cor.slice(1,3),16);
      const g = parseInt(cor.slice(3,5),16);
      const b = parseInt(cor.slice(5,7),16);
      const bg     = `rgba(${r},${g},${b},.12)`;
      const border = `rgba(${r},${g},${b},.3)`;
      const old    = _plStatusDB.find(x=>x.id===id);
      updates.push({ id, emoji, label, cor, bg, border, ordem: i+1, oldLabel: old?.label });
    });

    // Atualiza banco + migra leads se label mudou
    await Promise.all(updates.map(async u=>{
      if(u.oldLabel && u.oldLabel !== u.label){
        await sb.from('clientes').update({status_crm: u.label}).eq('status_crm', u.oldLabel);
      }
      return sb.from('crm_status').update({emoji:u.emoji, label:u.label, cor:u.cor, bg:u.bg, border:u.border, ordem:u.ordem}).eq('id', u.id);
    }));

    // Recarrega status e re-renderiza tudo
    await _plCarregarStatus();
    await _plCarregarDados();
    notify('Status atualizados e aplicados!','success');
  }catch(e){
    notify('Erro ao salvar: '+e.message,'error');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='✓ Salvar e aplicar'; }
  }
}

async function _plConfigNovoStatus(){
  const label = prompt('Nome do novo status:');
  if(!label?.trim()) return;
  const emoji = prompt('Emoji (ex: 🟣):')||'🔵';
  const cor   = '#60A5FA';
  const maxOrdem = _plStatusDB.length ? Math.max(..._plStatusDB.map(s=>s.ordem)) : 0;

  const {data,error} = await sb.from('crm_status').insert({
    label: label.trim(), emoji, cor,
    bg: 'rgba(96,165,250,.12)', border: 'rgba(96,165,250,.3)',
    ordem: maxOrdem + 1, ativo: true,
  }).select().single();
  if(error){ notify('Erro: '+error.message,'error'); return; }
  _plStatusDB.push(data);
  _plRenderConfigLista();
  notify(`Status "${label.trim()}" criado!`,'success');
}
