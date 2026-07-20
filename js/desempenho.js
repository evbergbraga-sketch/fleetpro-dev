// desempenho.js — Painel de rendimento dos atendentes (admin-only)
// Fontes de dados:
//  - perfis (perfil='atendente')            → quem aparece no painel
//  - clientes                               → carteira, SLA, follow-ups atrasados
//  - notas_internas (criado_por)            → atendimentos e contatos no período
//  - crm_status_log (por/para)              → conversões e perdas no período
//  - presenca_diaria (heartbeat do boot.js) → tempo on-line no período

let _dpPeriodo = '7d'; // 'hoje' | '7d' | '30d' | 'custom'
let _dpIniciado = false;
let _dpElegiveis = [];  // todos os usuários admin+atendente (para o modal Equipe)
let _dpEquipeIds = null; // seleção salva em sys_config (null = padrão: atendentes)

// Normaliza status pra comparação: minúsculas, hífen vira espaço
// (no banco existem variantes como 'Em Locação', 'em-locação', 'reprovado', 'PERDIDO')
const _dpNorm = s => (s||'').toLowerCase().replace(/-/g,' ').trim();
const _DP_CONVERSAO = ['em locação','ativo'];            // conversão = cliente rodando
const _DP_PERDA     = ['perdido','reprovado','inativo']; // funil encerrado sem locação

function iniciarDesempenho(){
  if(!_dpIniciado){
    _dpIniciado = true;
    document.querySelectorAll('.dp-chip').forEach(ch=>{
      ch.onclick = ()=>{
        _dpPeriodo = ch.dataset.p;
        document.querySelectorAll('.dp-chip').forEach(c=>c.classList.remove('active'));
        ch.classList.add('active');
        document.getElementById('dp-custom').style.display = _dpPeriodo==='custom' ? 'flex' : 'none';
        if(_dpPeriodo!=='custom') carregarDesempenho();
      };
    });
    const btnAplicar = document.getElementById('dp-aplicar');
    if(btnAplicar) btnAplicar.onclick = ()=>carregarDesempenho();
    const selFila = document.getElementById('dp-fila-h');
    if(selFila) selFila.onchange = ()=>_dpRenderFila();
  }
  carregarDesempenho();
}

function _dpIntervalo(){
  const fim = new Date();
  let ini = new Date();
  if(_dpPeriodo==='hoje'){ ini.setHours(0,0,0,0); }
  else if(_dpPeriodo==='7d'){ ini.setDate(ini.getDate()-7); }
  else if(_dpPeriodo==='30d'){ ini.setDate(ini.getDate()-30); }
  else {
    const i = document.getElementById('dp-ini')?.value;
    const f = document.getElementById('dp-fim')?.value;
    if(i) ini = new Date(i+'T00:00:00');
    if(f){ const ff = new Date(f+'T23:59:59'); return {ini, fim:ff}; }
  }
  return {ini, fim};
}

function _dpFmtMin(min){
  if(!min) return '0m';
  const h = Math.floor(min/60), m = min%60;
  return h ? `${h}h ${String(m).padStart(2,'0')}m` : `${m}m`;
}

function _dpFmtSla(ms){
  if(ms==null) return '—';
  const min = Math.round(ms/60000);
  if(min < 60) return `${min} min`;
  if(min < 60*24) return `${Math.floor(min/60)}h ${String(min%60).padStart(2,'0')}m`;
  return `${(min/(60*24)).toFixed(1).replace('.',',')} dias`;
}

async function carregarDesempenho(){
  const cards = document.getElementById('dp-cards');
  const podio = document.getElementById('dp-podio');
  if(!cards) return;
  cards.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px">Carregando…</div>';
  if(podio) podio.innerHTML = '';

  const {ini, fim} = _dpIntervalo();
  const iniISO = ini.toISOString(), fimISO = fim.toISOString();
  const iniDia = iniISO.slice(0,10), fimDia = fimISO.slice(0,10);

  try{
    const [rPerfis, rClientes, rNotas, rPres, rCfg] = await Promise.all([
      sb.from('perfis').select('id,nome,perfil').in('perfil',['admin','atendente']),
      sb.from('clientes').select('id,nome,responsavel_id,status_crm,created_at,primeiro_contato_em,followup_em').not('status_crm','is',null),
      sb.from('notas_internas').select('cliente_id,criado_por,texto,created_at').gte('created_at',iniISO).lte('created_at',fimISO),
      sb.from('presenca_diaria').select('user_id,dia,minutos').gte('dia',iniDia).lte('dia',fimDia),
      sb.from('sys_config').select('valor').eq('chave','dp_equipe').maybeSingle(),
    ]);
    const erro = rPerfis.error||rClientes.error||rNotas.error||rPres.error;
    if(erro) throw erro;

    const todos = rPerfis.data||[];
    // Equipe exibida: lista salva em sys_config (dp_equipe); sem config, todos os atendentes
    let equipeIds = null;
    try{ if(rCfg?.data?.valor) equipeIds = JSON.parse(rCfg.data.valor); }catch(_e){}
    if(!Array.isArray(equipeIds)) equipeIds = null;
    _dpElegiveis = todos;
    _dpEquipeIds = equipeIds;
    const perfis = equipeIds ? todos.filter(p=>equipeIds.includes(p.id)) : todos.filter(p=>p.perfil==='atendente');

    const clientes = rClientes.data||[];
    const notas    = rNotas.data||[];
    const pres     = rPres.data||[];
    const cliById  = Object.fromEntries(clientes.map(c=>[c.id,c]));
    const agora    = new Date();

    // Fila de leads esquecidos: vivos no funil, sem NENHUM primeiro contato.
    // Independe do filtro de período — é sempre a foto de agora.
    _dpFilaDados = clientes.filter(c=>{
      const st = _dpNorm(c.status_crm);
      return !c.primeiro_contato_em && !_DP_CONVERSAO.includes(st) && !_DP_PERDA.includes(st);
    });
    _dpNomes = Object.fromEntries(todos.map(p=>[p.id, p.nome||'—']));
    _dpRenderFila();

    if(!perfis.length){
      cards.innerHTML = '<div class="card" style="color:var(--muted);font-size:13px">Nenhum usuário selecionado — clique em Equipe para escolher quem aparece no painel.</div>';
      return;
    }

    const dados = perfis.map(p=>{
      const minhasNotas = notas.filter(n=>n.criado_por===p.id);
      const primNotas   = minhasNotas.filter(n=>(n.texto||'').startsWith('Primeiro contato'));
      // Leads atendidos: leads distintos com QUALQUER interação registrada
      // pelo atendente no período (1º contato, contato de acompanhamento ou nota)
      const atendidos   = new Set(minhasNotas.map(n=>n.cliente_id)).size;

      // SLA: média (entrada do lead → primeiro contato) dos leads que ESTE atendente atendeu
      let slaMedio = null;
      const deltas = primNotas.map(n=>{
        const c = cliById[n.cliente_id];
        if(!c?.created_at || !c?.primeiro_contato_em) return null;
        const d = new Date(c.primeiro_contato_em) - new Date(c.created_at);
        return d >= 0 ? d : null;
      }).filter(x=>x!=null);
      if(deltas.length) slaMedio = deltas.reduce((a,b)=>a+b,0)/deltas.length;

      // Conversão = lead da carteira que está EM LOCAÇÃO hoje (estado atual,
      // retroativo). Perda = funil encerrado (Perdido/Reprovado/Inativo).
      const carteira = clientes.filter(c=>c.responsavel_id===p.id);
      const conv   = carteira.filter(c=>_DP_CONVERSAO.includes(_dpNorm(c.status_crm))).length;
      const perdas = carteira.filter(c=>_DP_PERDA.includes(_dpNorm(c.status_crm))).length;
      const taxa   = carteira.length ? Math.round(conv/carteira.length*100) : null;

      const fupsAtrasados = carteira.filter(c=>{
        const st = _dpNorm(c.status_crm);
        return c.followup_em && new Date(c.followup_em) < agora &&
               !_DP_CONVERSAO.includes(st) && !_DP_PERDA.includes(st);
      }).length;

      const online = pres.filter(x=>x.user_id===p.id).reduce((a,b)=>a+(b.minutos||0),0);

      return {p, atendidos, contatos:minhasNotas.length, slaMedio, conv, perdas, taxa, carteira:carteira.length, fupsAtrasados, online};
    });

    // ── Pódio (top 3 por conversões; desempate por atendidos) ──
    if(podio){
      const top = [...dados].sort((a,b)=>(b.conv-a.conv)||(b.atendidos-a.atendidos)).slice(0,3);
      const medalhas = ['#F5B942','#9CA3AF','#B45309'];
      podio.innerHTML = top.map((d,i)=>`
        <div class="stat-card" style="text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${medalhas[i]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            <span style="font-size:12px;color:var(--muted);font-weight:600">${i+1}º lugar</span>
          </div>
          <div style="font-weight:700;font-size:15px;letter-spacing:.2px">${d.p.nome||'—'}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${d.conv} conversõe${d.conv===1?'':'s'} · ${d.atendidos} atendido${d.atendidos===1?'':'s'}</div>
        </div>`).join('');
    }

    // ── Cards por atendente ──
    const ico = (path)=>`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    const linha = (icone,label,valor,cor)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border2)">
        <span style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted)">${icone} ${label}</span>
        <span style="font-weight:700;font-size:13px;${cor?`color:${cor}`:''}">${valor}</span>
      </div>`;

    cards.innerHTML = dados.sort((a,b)=>(b.conv-a.conv)||(b.atendidos-a.atendidos)).map(d=>`
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:38px;height:38px;border-radius:50%;background:rgba(79,70,229,0.12);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--accent);font-family:var(--font-display)">${(d.p.nome||'?').trim().charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-weight:700">${d.p.nome||'—'}</div>
            <div style="font-size:11px;color:var(--muted)">${d.carteira} lead${d.carteira===1?'':'s'} na carteira</div>
          </div>
        </div>
        ${linha(ico('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),'Tempo on-line',_dpFmtMin(d.online))}
        ${linha(ico('<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>'),'Leads atendidos',d.atendidos)}
        ${linha(ico('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),'Contatos registrados',d.contatos)}
        ${linha(ico('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),'Tempo 1ª resposta',_dpFmtSla(d.slaMedio))}
        ${linha(ico('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>'),'Em Locação (conversões)',d.conv,'#16a34a')}
        ${linha(ico('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),'Perdas (Perdido/Reprov.)',d.perdas,d.perdas?'#F87171':null)}
        ${linha(ico('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'),'Taxa de conversão',d.taxa==null?'—':d.taxa+'%',d.taxa!=null&&d.taxa>=50?'#16a34a':null)}
        ${linha(ico('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),'Follow-ups em atraso',d.fupsAtrasados,d.fupsAtrasados?'#F5B942':null)}
      </div>`).join('');

  }catch(e){
    cards.innerHTML = `<div class="card" style="color:#F87171;font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

// ── FILA DE LEADS ESQUECIDOS ──
let _dpFilaDados = [];
let _dpNomes = {};
let _dpFilaExpandida = false;

function _dpToggleFila(){
  _dpFilaExpandida = !_dpFilaExpandida;
  _dpRenderFila();
}

function _dpEspera(created){
  const h = Math.floor((Date.now() - new Date(created)) / 3600000);
  if(h < 24) return `há ${h}h`;
  return `há ${Math.floor(h/24)}d ${h%24}h`;
}

function _dpRenderFila(){
  const card  = document.getElementById('dp-fila-card');
  const lista = document.getElementById('dp-fila');
  const badge = document.getElementById('dp-fila-count');
  if(!card || !lista) return;
  const horas = parseInt(document.getElementById('dp-fila-h')?.value || '12', 10);
  const corte = Date.now() - horas*3600000;
  const fila  = _dpFilaDados
    .filter(c => new Date(c.created_at).getTime() < corte)
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

  card.style.display = 'block';
  badge.textContent = fila.length;
  if(!fila.length){
    lista.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:#16a34a;font-size:13px;padding:8px 0">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
      Nenhum lead esquecido — todo mundo recebeu contato dentro do prazo.</div>`;
    return;
  }
  const limite = _dpFilaExpandida ? 30 : 5;
  const restante = fila.length - limite;
  lista.innerHTML = fila.slice(0,limite).map(c=>{
    const resp = c.responsavel_id ? (_dpNomes[c.responsavel_id]||'—') : null;
    return `<div onclick="_dpAbrirLead('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);flex-wrap:wrap;cursor:pointer">
      <span style="font-weight:600;font-size:13px">${c.nome||'—'}</span>
      <span style="font-size:11px;color:var(--muted);background:rgba(79,70,229,0.08);padding:2px 8px;border-radius:999px">${c.status_crm||'—'}</span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:12px">
        ${resp
          ? `<span style="font-size:11px;color:var(--muted)">Resp.: <b>${resp}</b></span>`
          : `<span style="font-size:11px;color:#F5B942;font-weight:700">Sem responsável</span>`}
        <span style="font-size:12px;font-weight:800;color:#F87171">${_dpEspera(c.created_at)}</span>
      </span>
    </div>`;
  }).join('') + (fila.length>5 ? `
    <div style="text-align:center;padding-top:10px;display:flex;align-items:center;justify-content:center;gap:10px">
      <button class="btn btn-ghost" onclick="_dpToggleFila()" style="font-size:12px;padding:5px 16px">
        ${_dpFilaExpandida ? 'Exibir menos' : `Exibir mais (${restante})`}
      </button>
      ${_dpFilaExpandida && restante>0 ? `<span style="font-size:12px;color:var(--muted)">Mostrando os 30 mais antigos — e mais ${restante} na fila.</span>` : ''}
    </div>` : '');
}

// Abre o cartão do lead (mesmo modal do Pipeline) a partir da fila.
// Se os dados do pipeline ainda não estão na memória, carrega antes.
async function _dpAbrirLead(id){
  try{
    if(typeof iniciarPipeline==='function' && (typeof _plDados==='undefined' || !_plDados.length)){
      await iniciarPipeline();
    }
    const existe = typeof _plDados!=='undefined' && _plDados.some(c=>c.id===id);
    if(!existe){
      notify('Este lead está sem status no funil — defina um status no Pipeline para abrir o cartão.','error');
      return;
    }
    await _plAbrirModal(id);
  }catch(e){ notify('Erro ao abrir lead: '+(e.message||e),'error'); }
}

// ── EQUIPE: escolher quem aparece no painel ──
function _dpAbrirEquipe(){
  const lista = document.getElementById('dp-equipe-lista');
  if(!lista) return;
  const selecionados = _dpEquipeIds || _dpElegiveis.filter(p=>p.perfil==='atendente').map(p=>p.id);
  lista.innerHTML = [..._dpElegiveis].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).map(p=>`
    <label style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--border2);cursor:pointer">
      <input type="checkbox" class="dp-eq-chk" value="${p.id}" ${selecionados.includes(p.id)?'checked':''}>
      <span style="font-weight:600;font-size:13px">${p.nome||'—'}</span>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${p.perfil==='admin'?'Administrador':'Atendente'}</span>
    </label>`).join('');
  document.getElementById('m-dp-equipe').classList.add('show');
}

async function _dpSalvarEquipe(){
  const ids = [...document.querySelectorAll('.dp-eq-chk:checked')].map(c=>c.value);
  try{
    // sys_config tem RLS (guarda o hash da senha admin) — a gravação é feita
    // por RPC security definer que só aceita admins e só toca na chave dp_equipe
    const {error} = await sb.rpc('dp_salvar_equipe', {ids});
    if(error) throw error;
    closeModal('dp-equipe');
    notify('Equipe do painel atualizada!','success');
    carregarDesempenho();
  }catch(e){
    notify('Erro ao salvar: '+(e.message||e),'error');
  }
}
