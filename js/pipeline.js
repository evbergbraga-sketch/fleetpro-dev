// pipeline.js — Pipeline CRM redesenhado (Fases 4 e 5)

let _plDados     = [];
let _plPerfis    = [];
let _plVisuAtual = 'kanban';
let _plModalData = null; // cliente aberto no modal

const _PL_STATUS = [
  { key:'interesse', label:'Interesse', emoji:'🟡', cor:'#F5B942', bg:'rgba(245,185,66,.12)',  border:'rgba(245,185,66,.3)'  },
  { key:'potencial', label:'Potencial', emoji:'🔵', cor:'#60A5FA', bg:'rgba(96,165,250,.12)',  border:'rgba(96,165,250,.3)'  },
  { key:'ativo',     label:'Ativo',     emoji:'🟢', cor:'#16a34a', bg:'rgba(22,163,74,.12)',   border:'rgba(22,163,74,.3)'   },
  { key:'reprovado', label:'Reprovado', emoji:'🔴', cor:'#F87171', bg:'rgba(248,113,113,.12)', border:'rgba(248,113,113,.3)' },
  { key:'inativo',   label:'Inativo',   emoji:'⚫', cor:'#9CA3AF', bg:'rgba(156,163,175,.12)', border:'rgba(156,163,175,.3)' },
];

const _PL_VEICULO = {
  carro:    { label:'Carro',  icon:'🚗' },
  moto:     { label:'Moto',   icon:'🏍️' },
  ambos:    { label:'Ambos',  icon:'🚗🏍️' },
  indefinido:{ label:'—',    icon:'' },
};


// Círculo colorido como ícone de status (substitui emoji)
function _plDot(cor, size=10){
  return `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${cor};flex-shrink:0"></span>`;
}

// ── INICIALIZAÇÃO ──
// ── ARRASTAR O KANBAN COM O MOUSE (PAN HORIZONTAL) ──
// Clica e arrasta em qualquer área vazia do quadro para deslizar as colunas.
// Não interfere no drag-and-drop dos cards (que continuam com prioridade),
// nem em botões/campos. Um arrasto não dispara clique acidental por baixo.
function _plKanbanPan(){
  const kb = document.getElementById('pl-kanban');
  if(!kb || kb._panInit) return;
  kb._panInit = true;
  let ativo = false, moveu = false, startX = 0, startScroll = 0;

  kb.addEventListener('mousedown', (e)=>{
    if(e.button !== 0) return; // só botão esquerdo
    // Cards (draggable) e controles têm prioridade — pan só em área "vazia"
    if(e.target.closest('[draggable="true"],button,input,select,textarea,a')) return;
    ativo = true; moveu = false;
    startX = e.pageX; startScroll = kb.scrollLeft;
    kb.style.cursor = 'grabbing';
    e.preventDefault(); // evita seleção de texto durante o arrasto
  });
  window.addEventListener('mousemove', (e)=>{
    if(!ativo) return;
    const dx = e.pageX - startX;
    if(Math.abs(dx) > 4) moveu = true;
    kb.scrollLeft = startScroll - dx;
  });
  window.addEventListener('mouseup', ()=>{
    if(!ativo) return;
    ativo = false;
    kb.style.cursor = '';
  });
  // Se houve arrasto, engole o clique que sobraria (não abre card sem querer)
  kb.addEventListener('click', (e)=>{
    if(moveu){ e.stopPropagation(); e.preventDefault(); moveu = false; }
  }, true);
}

async function iniciarPipeline(){
  // Carrega status customizados do banco PRIMEIRO
  await _plCarregarStatus();
  _plMostrarConfigBtn();
  _plKanbanPan(); // arrastar o kanban lateralmente com o mouse

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

  // Recalcula os badges de atraso periodicamente (6h→7h→8h...) sem precisar
  // recarregar a página nem consultar o banco de novo — só reaplica a conta
  // de "quanto tempo já passou" em cima dos dados já carregados.
  if(!window._plIntervaloAtraso){
    window._plIntervaloAtraso = setInterval(()=>{
      if(document.getElementById('pl-kanban') && _plDados?.length){
        _plRenderKanban(_plDados);
        if(typeof _plRenderMetricas==='function') _plRenderMetricas();
      }
    }, 5*60*1000); // a cada 5 minutos
  }
}

async function _plCarregarDados(){
  const {data,error} = await sb.from('clientes')
    .select('id,nome,telefone,cpf,email,origem,observacoes,status_crm,tipo,responsavel_id,followup_em,retirada_em,motivo_perda,interesse_veiculo,created_at,primeiro_contato_em,perfis(nome)')
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
  // Ordenação
  const ordem = document.getElementById('pl-ordem')?.value || 'recente';
  const dados = _plFiltrar().sort((a,b)=>{
    const da = new Date(a.created_at||0);
    const db = new Date(b.created_at||0);
    return ordem==='antigo' ? da-db : db-da;
  });
  if(_plVisuAtual==='kanban') _plRenderKanban(dados);
  else                        _plRenderLista(dados);
}

// ── KANBAN ──
function _plRenderKanban(dados){
  const kb = document.getElementById('pl-kanban');
  if(!kb) return;
  const hoje = new Date().toISOString().slice(0,10);

  kb.innerHTML = _PL_STATUS.map(s=>{
    const itens = dados.filter(c=>c.status_crm===s.key||c.status_crm===s.label);

    const cards = itens.map(c=>{
      const resp  = _plPerfis.find(p=>p.id===c.responsavel_id);
      const fu    = (c.followup_em||'').slice(0,10);
      const vei   = _PL_VEICULO[c.interesse_veiculo||'indefinido'];
      const ini   = c.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
      const bgIni = s.cor+'33'; // cor do status com transparência para o avatar

      // Data formatada do card
      const dtCard = c.updated_at||c.created_at||'';
      const dtFmt = dtCard ? (() => {
        const d = new Date(dtCard);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      })() : '';
      // Resumo (observações truncadas)
      const resumo = c.observacoes ? c.observacoes.slice(0,60)+(c.observacoes.length>60?'...':'') : '';

      // SVG veículo
      const SVG_MOTO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17L9 7h5l3 4h3"/><path d="M9 7l2 4"/></svg>`;
      const SVG_CARRO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="11" width="22" height="9" rx="2"/><path d="M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4"/><circle cx="7" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>`;
      const veiSvg = c.interesse_veiculo==='moto' ? `<span style="color:${s.cor};opacity:.9" title="Moto">${SVG_MOTO}</span>`
                   : c.interesse_veiculo==='carro' ? `<span style="color:${s.cor};opacity:.9" title="Carro">${SVG_CARRO}</span>`
                   : c.interesse_veiculo==='ambos' ? `<span style="color:${s.cor};opacity:.9" title="Ambos">${SVG_CARRO}${SVG_MOTO}</span>`
                   : '';

      let fuHtml = '';
      if(fu===hoje)        fuHtml = `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(245,185,66,.15);color:#F5B942;border:1px solid rgba(245,185,66,.3);font-weight:600"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> Follow-up hoje</span>`;
      else if(fu&&fu<hoje) fuHtml = `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(248,113,113,.15);color:#F87171;border:1px solid rgba(248,113,113,.3);font-weight:600"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Atrasado</span>`;
      else if(fu)          fuHtml = `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg3,rgba(0,0,0,.15));color:var(--muted2)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${fu.split('-').reverse().join('/')}</span>`;

      // Badge de retirada agendada — destaque dourado, forte quando é hoje/atrasada
      let retHtml = '';
      if(c.retirada_em){
        const rd = new Date(c.retirada_em);
        if(!isNaN(rd)){
          const rdDia = rd.toISOString().slice(0,10);
          const rdFmt = rd.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ' ' + rd.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
          const hojeOuPassou = rdDia <= hoje;
          const SVG_KEY = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
          retHtml = hojeOuPassou
            ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 9px;border-radius:999px;background:#B45309;color:#fff;font-weight:800;box-shadow:0 1px 3px rgba(180,83,9,.4)">${SVG_KEY} Retirada ${rdFmt}</span>`
            : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 9px;border-radius:999px;background:#FDE68A;color:#78350F;border:1px solid #D9A62E;font-weight:800">${SVG_KEY} Retirada ${rdFmt}</span>`;
        }
      }

      // Badge de ATRASO NO PRIMEIRO CONTATO — só para leads em Interesse/Potencial
      // sem primeiro contato marcado, a partir de 6h desde que o lead chegou.
      // O contador sobe (6h, 7h, 8h...) — não é um "sim/não" fixo.
      let atrasoHtml = '';
      let botaoContatoHtml = '';
      const elegivelAtraso = ['interesse','potencial'].includes((c.status_crm||'').toLowerCase()) && !c.primeiro_contato_em;
      if(elegivelAtraso && c.created_at){
        const horasDesde = (Date.now() - new Date(c.created_at).getTime()) / 3600000;
        if(horasDesde >= 6){
          const horasInt = Math.floor(horasDesde);
          atrasoHtml = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 9px;border-radius:999px;background:#DC2626;color:#fff;font-weight:800;box-shadow:0 1px 3px rgba(220,38,38,.4)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Atrasado ${horasInt}h</span>`;
        }
      }
      if(elegivelAtraso){
        botaoContatoHtml = `<button onclick="event.stopPropagation();_plMarcarPrimeiroContato('${c.id}')" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:4px 9px;border-radius:999px;background:rgba(22,163,74,.1);color:#16a34a;border:1px solid rgba(22,163,74,.3);cursor:pointer;white-space:nowrap"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.61 3.5 2 2 0 013.6 1.3h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 9a16 16 0 006.08 6.08l1.87-1.87a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> Primeiro contato</button>`;
      }

      return `<div
        draggable="true"
        data-id="${c.id}"
        data-status="${s.label}"
        onclick="_plAbrirModal('${c.id}')"
        ondragstart="_plDragStart(event,'${c.id}')"
        ondragend="_plDragEnd(event)"
        style="background:${s.bg};border:1px solid ${s.border};border-left:3px solid ${s.cor};border-radius:10px;padding:12px;margin-bottom:8px;cursor:grab;transition:all .18s;box-shadow:0 1px 3px rgba(0,0,0,.06);user-select:none"
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.14)'"
        onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,.06)'">

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:34px;height:34px;border-radius:50%;background:${bgIni};color:${s.cor};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;border:1.5px solid ${s.border}">${ini}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nome}</div>
            <div style="font-size:11px;color:var(--text);opacity:.65">${c.telefone||'—'}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
            ${veiSvg ? `<div style="display:flex;gap:3px">${veiSvg}</div>` : ''}
            ${c.tipo==='lead'
              ? `<span style="font-size:9px;padding:1px 6px;border-radius:999px;font-weight:700;background:rgba(139,92,246,.2);color:#A78BFA;border:1px solid rgba(139,92,246,.3);white-space:nowrap">⚡ Lead</span>`
              : `<span style="font-size:9px;padding:1px 6px;border-radius:999px;font-weight:700;background:rgba(21,128,61,.2);color:#166534;border:1px solid rgba(21,128,61,.3);white-space:nowrap">✓ Cliente</span>`
            }
          </div>
        </div>

        ${resumo ? `<div style="font-size:11px;color:var(--text);opacity:.72;line-height:1.5;margin-bottom:8px;padding:6px 8px;background:rgba(0,0,0,.05);border-radius:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${resumo}</div>` : ''}

        <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:${(retHtml||fuHtml||resp||c.origem||atrasoHtml)?'6px':'0'}">
          ${atrasoHtml}
          ${retHtml}
          ${fuHtml}
          ${resp ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg2);color:var(--muted2);border:1px solid var(--border2)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${resp.nome.split(' ')[0]}</span>` : ''}
          ${c.origem ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg2);color:var(--muted2);border:1px solid var(--border2)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg> ${c.origem}</span>` : ''}
        </div>

        ${botaoContatoHtml ? `<div style="margin-bottom:6px">${botaoContatoHtml}</div>` : ''}

        ${dtFmt ? `<div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text);opacity:.55;margin-top:4px;padding-top:6px;border-top:1px solid ${s.border}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${dtFmt}</div>` : ''}
      </div>`;
    }).join('') || `<div class="pl-drop-empty" data-col="${s.label}" style="font-size:12px;color:var(--muted2);text-align:center;padding:24px 0;opacity:.6;border-radius:8px;border:2px dashed transparent;transition:.15s">Nenhum lead</div>`;

    return `<div
      class="pl-col"
      data-col="${s.label}"
      ondragover="_plDragOver(event)"
      ondragenter="_plDragEnter(event,'${s.label}')"
      ondragleave="_plDragLeave(event)"
      ondrop="_plDrop(event,'${s.label}')"
      style="background:var(--bg2);border-radius:14px;padding:14px;border:1px solid var(--border2);transition:border-color .15s,background .15s;min-height:100px;min-width:280px;max-width:280px;flex-shrink:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border2)">
        <span style="font-size:13px;font-weight:700;color:${s.cor}">${s.label}</span>
        <span style="font-size:11px;font-weight:700;color:${s.cor};background:${s.bg};border:1px solid ${s.border};padding:2px 9px;border-radius:999px">${itens.length}</span>
      </div>
      ${cards}
    </div>`;
  }).join('');
}

// ── CONTATO COM O LEAD ──
// 1ª vez: marca primeiro_contato_em (desliga o contador de atraso pra
// sempre) + registra nota. Da 2ª vez em diante: só registra nota, sem
// mexer em primeiro_contato_em — vira um registro de acompanhamento,
// sempre com o nome de quem atendeu.
async function _plMarcarPrimeiroContato(id, apenasNota=false){
  const nomeResp = currentPerfil?.nome || 'Atendente';
  try{
    if(!apenasNota){
      const agora = new Date().toISOString();
      const {error} = await sb.from('clientes').update({primeiro_contato_em: agora}).eq('id', id);
      if(error) throw error;
      const c = _plDados.find(x=>x.id===id);
      if(c) c.primeiro_contato_em = agora;
      if(typeof allClientes !== 'undefined'){
        const cc = allClientes.find(x=>x.id===id);
        if(cc) cc.primeiro_contato_em = agora;
      }
    }
    await sb.from('notas_internas').insert({
      cliente_id: id,
      texto: apenasNota ? `Contato registrado por ${nomeResp}` : `Primeiro contato registrado por ${nomeResp}`,
      criado_por: currentUser?.id||null,
    });
    notify(apenasNota ? 'Contato registrado!' : 'Primeiro contato registrado!', 'success');
    _plRenderKanban(_plDados);
    if(typeof _plRenderMetricas==='function') _plRenderMetricas();
    if(_plModalData?.id===id) _plAbrirModal(id); // atualiza o modal se estiver aberto nesse lead
  }catch(e){
    notify('Erro ao registrar: '+e.message,'error');
  }
}

// ── DRAG & DROP ──
let _plDragId = null;

function _plDragStart(e, id){
  _plDragId = id;
  e.dataTransfer.effectAllowed = 'move';
  // Atraso para aplicar opacidade depois de iniciar o drag
  setTimeout(()=>{ if(e.target) e.target.style.opacity = '0.4'; }, 0);
}

function _plDragEnd(e){
  if(e.target) e.target.style.opacity = '1';
  // Remove highlight de todas as colunas
  document.querySelectorAll('.pl-col').forEach(col=>{
    col.style.background   = 'var(--bg2)';
    col.style.borderColor  = 'var(--border2)';
  });
}

function _plDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function _plDragEnter(e, colLabel){
  e.preventDefault();
  const col = e.currentTarget;
  const s   = _PL_STATUS.find(x=>x.label===colLabel);
  if(col && s){
    col.style.background  = s.bg;
    col.style.borderColor = s.cor;
  }
}

function _plDragLeave(e){
  // Só remove highlight se saiu para fora da coluna (não para filho)
  if(!e.currentTarget.contains(e.relatedTarget)){
    e.currentTarget.style.background  = 'var(--bg2)';
    e.currentTarget.style.borderColor = 'var(--border2)';
  }
}

async function _plDrop(e, novoStatus){
  e.preventDefault();
  if(!_plDragId) return;
  const id = _plDragId;
  _plDragId = null;

  // Remove highlight
  document.querySelectorAll('.pl-col').forEach(col=>{
    col.style.background  = 'var(--bg2)';
    col.style.borderColor = 'var(--border2)';
  });

  // Encontra o cliente e verifica se o status realmente mudou
  const c = _plDados.find(x=>x.id===id);
  if(!c) return;
  const statusAtual = c.status_crm;
  if(statusAtual===novoStatus) return; // mesma coluna, não faz nada

  // Atualiza local imediatamente (UI responsiva)
  c.status_crm = novoStatus;

  // Sincroniza allClientes (usado pelo chat) para manter consistência
  if(typeof allClientes !== 'undefined'){
    const cc = allClientes.find(x=>x.id===id);
    if(cc) cc.status_crm = novoStatus;
  }

  renderPipeline();
  _plRenderMetricas();

  // Se o chat estiver aberto nesse cliente, atualiza o painel CRM
  if(typeof activeChatId !== 'undefined' && activeChatId === id){
    if(typeof _crmCarregarPainel === 'function') _crmCarregarPainel(id);
  }
  if(typeof renderChatContacts === 'function') renderChatContacts();

  // Persiste no banco
  try{
    await sb.from('clientes').update({status_crm: novoStatus}).eq('id', id);
    notify(`${c.nome} → ${novoStatus}`,'success');
  }catch(err){
    // Reverte se falhou
    c.status_crm = statusAtual;
    renderPipeline();
    notify('Erro ao mover: '+err.message,'error');
  }
}



// ── LISTA ──
function _plRenderLista(dados){
  const tb = document.getElementById('pl-lista-tbody');
  if(!tb) return;
  const hoje = new Date().toISOString().slice(0,10);
  if(!dados.length){ tb.innerHTML='<tr class="empty-row"><td colspan="8">Nenhum lead encontrado</td></tr>'; return; }
  tb.innerHTML = dados.map(c=>{
    const s    = _PL_STATUS.find(x=>x.key===c.status_crm||x.label===c.status_crm);
    const resp = _plPerfis.find(p=>p.id===c.responsavel_id);
    const fu   = (c.followup_em||'').slice(0,10);
    const vei  = _PL_VEICULO[c.interesse_veiculo||'indefinido'];
    let fuTxt='—', fuCor='var(--text)';
    if(fu){ fuTxt=fu.split('-').reverse().join('/'); }
    if(fu===hoje){ fuTxt='🔔 '+fuTxt; fuCor='#F5B942'; }
    else if(fu&&fu<hoje){ fuTxt='⚠️ '+fuTxt; fuCor='#F87171'; }
    const criado = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—';
    const tipoBadge = c.tipo==='lead'
      ? `<span style="font-size:10px;padding:2px 8px;border-radius:999px;font-weight:700;background:rgba(139,92,246,.2);color:#A78BFA;border:1px solid rgba(139,92,246,.3)">⚡ Lead</span>`
      : `<span style="font-size:10px;padding:2px 8px;border-radius:999px;font-weight:700;background:rgba(21,128,61,.2);color:#166534;border:1px solid rgba(21,128,61,.3)">✓ Cliente</span>`;
    return `<tr style="cursor:pointer" onclick="_plAbrirModal('${c.id}')">
      <td>
        <div style="font-weight:600">${c.nome}</div>
        <div style="font-size:11px;color:var(--muted)">${c.telefone||'—'}</div>
      </td>
      <td>${tipoBadge}</td>
      <td><span style="font-size:11px;padding:3px 10px;border-radius:999px;font-weight:600;background:${s?.bg||'var(--bg2)'};color:${s?.cor||'var(--muted)'};border:1px solid ${s?.border||'var(--border2)'}">${s?.label||c.status_crm}</span></td>
      <td style="font-size:13px">${vei.icon} ${vei.icon ? vei.label : '—'}</td>
      <td style="font-size:12px;color:var(--muted)">${resp ? resp.nome.split(' ')[0] : '—'}</td>
      <td style="font-size:12px;color:${fuCor}">${fuTxt}</td>
      <td style="font-size:12px;color:var(--muted)">${criado}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();_plAbrirModal('${c.id}')">Ver</button>
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
  const ativos    = _plDados.filter(c=>{ const k=(c.status_crm||'').toLowerCase(); return k==='ativo'||k.includes('loca'); }).length;
  const interesse = _plDados.filter(c=>(c.status_crm||'').toLowerCase()==='interesse').length;
  const fuHoje    = _plDados.filter(c=>(c.followup_em||'').slice(0,10)===hoje).length;
  const fuAtraso  = _plDados.filter(c=>{ const d=(c.followup_em||'').slice(0,10); return d&&d<hoje; }).length;
  const conversao = total ? Math.round(ativos/total*100) : 0;
  const atrasados = _plDados.filter(c=>{
    if(!['interesse','potencial'].includes((c.status_crm||'').toLowerCase()) || c.primeiro_contato_em || !c.created_at) return false;
    return (Date.now() - new Date(c.created_at).getTime()) / 3600000 >= 6;
  }).length;

  // Ícones SVG compactos (substituem os emojis — visual mais profissional)
  const ICO_PL = {
    total:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    interesse: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
    locacao: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
    conversao: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    atrasado: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    followup: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  };

  el.innerHTML = [
    { val:total,          lbl:'Total de leads',      cor:'var(--accent)',  ico:ICO_PL.total,      sub:'no pipeline' },
    { val:interesse,      lbl:'Em interesse',         cor:'#F5B942',        ico:ICO_PL.interesse,  sub:'aguardando' },
    { val:ativos,         lbl:'Em Locação',            cor:'#16a34a',        ico:ICO_PL.locacao,    sub:'com contrato' },
    { val:conversao+'%',  lbl:'Taxa de conversão',    cor:'#60A5FA',        ico:ICO_PL.conversao,  sub:'interesse→ativo' },
    { val:atrasados,      lbl:'Leads atrasados',      cor:atrasados>0?'#DC2626':'var(--muted2)', ico:ICO_PL.atrasado, sub:'sem 1º contato (6h+)' },
    { val:fuHoje+fuAtraso,lbl:'Follow-ups pendentes', cor:fuHoje+fuAtraso>0?'#F87171':'var(--muted2)', ico:ICO_PL.followup, sub:`${fuHoje} hoje · ${fuAtraso} atrasado${fuAtraso!==1?'s':''}` },
  ].map(m=>`
    <div class="card" style="padding:12px 14px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;color:${m.cor}">
        ${m.ico}
        <span style="font-size:20px;font-weight:800;color:${m.cor};line-height:1">${m.val}</span>
      </div>
      <div style="font-size:11.5px;font-weight:600;color:var(--text)">${m.lbl}</div>
      <div style="font-size:9.5px;color:var(--muted2);margin-top:1px">${m.sub}</div>
    </div>`).join('');
}

// ── MODAL LEAD ──
async function _plAbrirModal(id){
  const c = _plDados.find(x=>x.id===id);
  if(!c) return;
  _plModalData = c;
  const resp = _plPerfis.find(p=>p.id===c.responsavel_id);
  const s    = _PL_STATUS.find(x=>x.key===c.status_crm||x.label===c.status_crm);
  const fu   = (c.followup_em||'').slice(0,10);
  const hoje = new Date().toISOString().slice(0,10);

  // SVG icons inline — sem emojis
  const SVG = {
    phone:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.5 2 2 0 0 1 3.6 1.3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.08 6.08l1.87-1.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    email:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    user:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    origin:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    chat:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    edit:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    convert:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    trash:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    save:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    note:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    forward:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>`,
    clock:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    alert:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    vehicle:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  };

  // Interesse
  const VEI_LABEL = {indefinido:'— Indefinido', carro:'Carro', moto:'Moto', ambos:'Ambos'};
  const interLbl = VEI_LABEL[c.interesse_veiculo||'indefinido'] || '—';

  // Follow-up badge — texto limpo, cor pelo estado
  let fuBadge = '';
  if(fu===hoje)
    fuBadge = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 10px;border-radius:999px;background:rgba(245,158,11,.15);color:#92400e;border:1px solid rgba(245,158,11,.35);font-weight:600">${SVG.clock} Follow-up hoje</span>`;
  else if(fu&&fu<hoje)
    fuBadge = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 10px;border-radius:999px;background:rgba(220,38,38,.12);color:#b91c1c;border:1px solid rgba(220,38,38,.3);font-weight:600">${SVG.alert} Follow-up atrasado</span>`;
  else if(fu)
    fuBadge = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 10px;border-radius:999px;background:var(--bg3);color:var(--muted);border:1px solid var(--border2)">${SVG.clock} ${fu.split('-').reverse().join('/')}</span>`;

  // Busca notas e encaminhamentos
  const [{data:notas},{data:encs}] = await Promise.all([
    sb.from('notas_internas').select('*,perfis(nome)').eq('cliente_id',id).order('created_at',{ascending:false}).limit(5),
    sb.from('encaminhamentos').select('*,perfis(nome)').eq('cliente_id',id).order('created_at',{ascending:false}).limit(5),
  ]);
  const hist = [...(notas||[]).map(n=>({...n,_t:'nota'})), ...(encs||[]).map(e=>({...e,_t:'enc'}))]
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  const _fmtDt = dt => new Date(dt).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+new Date(dt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

  const histHtml = hist.length ? hist.map(it=>{
    const quem = it.perfis?.nome?.split(' ')[0]||'';
    if(it._t==='enc')
      return `<div style="padding:9px 12px;background:rgba(99,102,241,.06);border-left:2px solid var(--accent);border-radius:0 8px 8px 0;font-size:12px;color:var(--text2)"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">${SVG.forward} <strong style="color:var(--text)">${it.setor_destino}</strong></div><span style="color:var(--muted);font-size:11px">${_fmtDt(it.created_at)} · ${quem}</span></div>`;
    return `<div style="padding:9px 12px;background:var(--bg2);border-left:2px solid var(--border2);border-radius:0 8px 8px 0;font-size:12px;color:var(--text2)"><div style="margin-bottom:3px;line-height:1.5">${it.texto}</div><span style="color:var(--muted);font-size:11px">${SVG.note} ${_fmtDt(it.created_at)} · ${quem}</span></div>`;
  }).join('')
  : `<div style="font-size:12px;color:var(--muted2);text-align:center;padding:14px 0">Sem histórico registrado</div>`;

  // Avatar iniciais
  const ini = c.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();

  document.getElementById('pl-modal-body').innerHTML = `
    <!-- HEADER -->
    <div style="display:flex;align-items:center;gap:14px;padding-bottom:18px;border-bottom:1px solid var(--border2);margin-bottom:18px">
      <div style="width:52px;height:52px;border-radius:50%;background:${s?.bg||'var(--bg2)'};border:2px solid ${s?.border||'var(--border2)'};display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:${s?.cor||'var(--text)'};flex-shrink:0">${ini}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nome}</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">
          <span style="font-size:11px;padding:3px 12px;border-radius:999px;font-weight:600;background:${s?.bg||'var(--bg2)'};color:${s?.cor||'var(--muted)'};border:1px solid ${s?.border||'var(--border2)'}">${s?.label||c.status_crm||'—'}</span>
          ${c.interesse_veiculo && c.interesse_veiculo!=='indefinido' ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 12px;border-radius:999px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2)">${SVG.vehicle} ${interLbl}</span>` : ''}
          ${fuBadge}
        </div>
      </div>
    </div>

    ${['interesse','potencial'].includes((c.status_crm||'').toLowerCase()) ? (
      c.primeiro_contato_em
        ? `<div style="margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#16a34a;background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.25);border-radius:10px;padding:10px 14px;margin-bottom:6px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> Primeiro contato: ${new Date(c.primeiro_contato_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
            <button onclick="_plMarcarPrimeiroContato('${c.id}', true)" style="display:flex;align-items:center;justify-content:center;gap:7px;width:100%;font-size:12px;font-weight:600;color:var(--accent);background:var(--accent-light,rgba(99,102,241,.08));border:1px solid rgba(99,102,241,.25);border-radius:9px;padding:9px;cursor:pointer">${SVG.phone} Registrar novo contato</button>
          </div>`
        : `<button onclick="_plMarcarPrimeiroContato('${c.id}')" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;font-size:13px;font-weight:700;color:#fff;background:#16a34a;border:none;border-radius:10px;padding:12px;margin-bottom:16px;cursor:pointer">${SVG.phone} Marcar primeiro contato</button>`
    ) : ''}

    <!-- INFO GRID -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:5px">${SVG.phone} Telefone</div>
        <div style="font-size:13px;font-weight:500;color:var(--text)">${c.telefone||'—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:5px">${SVG.email} E-mail</div>
        <div style="font-size:13px;font-weight:500;color:var(--text);word-break:break-all">${c.email||'—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:5px">${SVG.user} Responsável</div>
        <div style="font-size:13px;font-weight:500;color:var(--text)">${resp?.nome||'—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2)">
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:5px">${SVG.origin} Origem</div>
        <div style="font-size:13px;font-weight:500;color:var(--text)">${c.origem||'—'}</div>
      </div>
      ${c.retirada_em?(()=>{const rd=new Date(c.retirada_em);return isNaN(rd)?'':`<div style="background:rgba(245,185,66,.1);border-radius:10px;padding:12px;border:1px solid rgba(245,185,66,.4);grid-column:span 2;display:flex;align-items:center;gap:10px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5B942" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#F5B942;margin-bottom:2px">Retirada agendada</div><div style="font-size:14px;font-weight:700;color:var(--text)">${rd.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})} às ${rd.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div></div></div>`;})():''}
      ${c.motivo_perda?`<div style="background:rgba(220,38,38,.06);border-radius:10px;padding:12px;border:1px solid rgba(220,38,38,.2);grid-column:span 2"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#b91c1c;margin-bottom:5px">Motivo de perda</div><div style="font-size:13px;font-weight:500;color:var(--text)">${c.motivo_perda}</div></div>`:''}
      ${c.observacoes?`<div style="background:var(--bg2);border-radius:10px;padding:12px;border:1px solid var(--border2);grid-column:span 2"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:5px">Observações</div><div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.5">${c.observacoes}</div></div>`:''}
    </div>

    <!-- ATUALIZAR -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;border:1px solid var(--border2);margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:12px">Atualizar</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">Status CRM</label>
          <select id="plm-status" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
            ${_PL_STATUS.map(st=>`<option value="${st.key}"${(st.key===c.status_crm||st.label===c.status_crm)?' selected':''}>${st.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">Interesse</label>
          <select id="plm-interesse" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
            <option value="indefinido"${(c.interesse_veiculo||'indefinido')==='indefinido'?' selected':''}>— Indefinido</option>
            <option value="carro"${c.interesse_veiculo==='carro'?' selected':''}>Carro</option>
            <option value="moto"${c.interesse_veiculo==='moto'?' selected':''}>Moto</option>
            <option value="ambos"${c.interesse_veiculo==='ambos'?' selected':''}>Ambos</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block">Follow-up em</label>
          <input type="date" id="plm-followup" value="${fu}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#F5B942;margin-bottom:4px;display:block">Retirada agendada</label>
          <input type="datetime-local" id="plm-retirada" value="${(typeof _tsToLocalInput==='function')?_tsToLocalInput(c.retirada_em):''}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(245,185,66,.45);background:var(--card);color:var(--text);font-size:13px">
        </div>
        <div style="display:flex;align-items:flex-end;grid-column:span 2">
          <button onclick="_plModalSalvar()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">${SVG.save} Salvar alterações</button>
        </div>
      </div>
    </div>

    <!-- NOTA INTERNA -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;border:1px solid var(--border2);margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:10px">Nota interna</div>
      <div style="display:flex;gap:8px">
        <input type="text" id="plm-nota" placeholder="Registrar uma observação..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:13px">
        <button onclick="_plModalNota()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--accent-light);color:var(--accent);border:1px solid rgba(99,102,241,.3);border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;font-weight:600">${SVG.note} Registrar</button>
      </div>
    </div>

    <!-- HISTÓRICO -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;border:1px solid var(--border2);margin-bottom:18px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);margin-bottom:10px">Histórico</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto">${histHtml}</div>
    </div>

    <!-- AÇÕES -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button onclick="closeModal('pl-modal');_plIrChat('${c.id}')" style="display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;grid-column:span 2">${SVG.chat} Abrir chat</button>
      <button onclick="closeModal('pl-modal');${c.tipo==='lead'?`editarLead('${c.id}')`:`editarCliente('${c.id}')`}" style="display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;background:var(--bg3);color:var(--text);border:1px solid var(--border2);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">${SVG.edit} Editar perfil</button>
      ${c.tipo==='lead'?`<button onclick="closeModal('pl-modal');abrirConverterCliente('${c.id}')" style="display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;background:rgba(21,128,61,.12);color:#166534;border:1px solid rgba(21,128,61,.3);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">${SVG.convert} Converter em cliente</button>`:`<div></div>`}
      <button onclick="_plExcluirLead('${c.id}','${c.nome.replace(/'/g,"\\'")}','${c.tipo}')" style="display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;background:rgba(220,38,38,.06);color:#b91c1c;border:1px solid rgba(220,38,38,.25);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;grid-column:span 2">${SVG.trash} Excluir</button>
    </div>
  `;

  document.getElementById('m-pl-modal')?.classList.add('show');
}

async function _plModalSalvar(){
  if(!_plModalData) return;
  const status   = document.getElementById('plm-status')?.value;
  const interesse= document.getElementById('plm-interesse')?.value;
  const followup = document.getElementById('plm-followup')?.value||null;
  const retVal   = document.getElementById('plm-retirada')?.value||null;
  const retirada = retVal ? new Date(retVal).toISOString() : null;
  try{
    await sb.from('clientes').update({status_crm:status, interesse_veiculo:interesse, followup_em:followup, retirada_em:retirada}).eq('id',_plModalData.id);
    // Atualiza _plDados local
    const idx = _plDados.findIndex(x=>x.id===_plModalData.id);
    if(idx>=0){ _plDados[idx].status_crm=status; _plDados[idx].interesse_veiculo=interesse; _plDados[idx].followup_em=followup; _plDados[idx].retirada_em=retirada; }
    // Sincroniza allClientes (chat)
    if(typeof allClientes !== 'undefined'){
      const cc = allClientes.find(x=>x.id===_plModalData.id);
      if(cc){ cc.status_crm=status; cc.interesse_veiculo=interesse; cc.followup_em=followup; cc.retirada_em=retirada; }
    }
    if(typeof renderChatContacts==='function') renderChatContacts();
    if(typeof activeChatId!=='undefined' && activeChatId===_plModalData.id && typeof _crmCarregarPainel==='function') _crmCarregarPainel(activeChatId);
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

// ══ EDITAR LEAD (modal simples, sem CPF obrigatório) ══
function editarLead(id){
  const c = _plDados.find(x=>x.id===id) || allClientes.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('el-id').value = c.id;
  document.getElementById('el-nome').value = c.nome||'';
  document.getElementById('el-telefone').value = c.telefone||'';
  document.getElementById('el-email').value = c.email||'';
  document.getElementById('el-origem').value = c.origem||'';
  document.getElementById('el-retirada').value = (typeof _tsToLocalInput==='function') ? _tsToLocalInput(c.retirada_em) : '';
  document.getElementById('el-obs').value = c.observacoes||'';
  document.getElementById('m-editar-lead').classList.add('show');
}

async function _plSalvarLead(){
  const id    = document.getElementById('el-id').value;
  const nome  = document.getElementById('el-nome').value.trim();
  const tel   = document.getElementById('el-telefone').value.trim();
  const email = document.getElementById('el-email').value.trim();
  const origem = document.getElementById('el-origem').value;
  const obs   = document.getElementById('el-obs').value.trim();
  const retVal = document.getElementById('el-retirada').value;

  if(!nome){ notify('Nome é obrigatório','error'); return; }

  const {error} = await sb.from('clientes').update({
    nome, telefone: tel||null, email: email||null, origem: origem||null, observacoes: obs||null,
    retirada_em: retVal ? new Date(retVal).toISOString() : null,
  }).eq('id', id);

  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Lead atualizado!','success');
  closeModal('editar-lead');
  await _plCarregarDados();
  await loadClientes();
  if(typeof renderChatContacts==='function') renderChatContacts();
}

async function _plExcluirLead(id, nome, tipo){
  const label = tipo==='lead' ? 'lead' : 'cliente';
  if(!await fpConfirm(`Excluir ${label} "${nome}"? Notas internas e encaminhamentos também serão removidos. Esta ação não pode ser desfeita.`, `Excluir ${label}`)) return;
  try{
    // Remove notas e encaminhamentos primeiro (FK)
    await Promise.all([
      sb.from('notas_internas').delete().eq('cliente_id', id),
      sb.from('encaminhamentos').delete().eq('cliente_id', id),
    ]);
    // Remove o cliente/lead
    const {error} = await sb.from('clientes').delete().eq('id', id);
    if(error) throw error;
    // Remove do array local
    _plDados = _plDados.filter(x=>x.id!==id);
    if(typeof allClientes !== 'undefined') allClientes.splice(allClientes.findIndex(x=>x.id===id),1);
    closeModal('pl-modal');
    _plRenderMetricas();
    renderPipeline();
    if(typeof renderChatContacts==='function') renderChatContacts();
    notify(`${label.charAt(0).toUpperCase()+label.slice(1)} "${nome}" excluído.`,'success');
  }catch(e){ notify('Erro ao excluir: '+e.message,'error'); }
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

      <!-- Espaço ocupado pelo color picker já mostra a cor -->
      <div style="width:36px"></div>

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
      <span style="font-size:11px;padding:3px 10px;border-radius:999px;font-weight:600;background:${s.bg};color:${s.cor};border:1px solid ${s.border};white-space:nowrap">${s.label}</span>

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
  if(!await fpConfirm(`Remover o status "${label}"? Leads com esse status ficarão sem status.`, 'Remover status')) return;

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
      const emoji   = '●'; // placeholder, emoji removido
      const label   = inputs[0]?.value?.trim();
      const cor     = inputs[1]?.value||'#60A5FA';
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
  const label = await fpPrompt('Nome do novo status:', 'Novo status CRM', {placeholder:'Ex: Em negociação'});
  if(!label?.trim()) return;
  const emoji = '●'; // sem emoji
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

// ══ FOLLOW-UP EM MASSA ══════════════════════════════════════
// Busca a última mensagem recebida (direção='entrada') de cada lead.
// Retorna um Map: chave = cliente_id (ou últimos 11 dígitos do telefone) → data ISO da última mensagem
let _fuUltimasInteracoes = null;
async function _fuMassaBuscarInteracoes(){
  // View agregada: UMA linha por contato com a última mensagem recebida.
  // (Buscar direto de wpp_mensagens estourava o limite de 1000 linhas do
  // Supabase e retornava só as mensagens mais antigas — filtros zeravam.)
  const mapa = new Map();
  const PAGINA = 1000;
  for(let de = 0; ; de += PAGINA){
    const {data, error} = await sb.from('wpp_ultima_interacao')
      .select('cliente_id,num11,ultima')
      .order('ultima', {ascending:false})
      .range(de, de + PAGINA - 1);
    if(error){ console.warn('[followup]', error.message); break; }
    (data||[]).forEach(m=>{
      if(m.cliente_id && !mapa.has(m.cliente_id)) mapa.set(m.cliente_id, m.ultima);
      if(m.num11 && !mapa.has('tel:'+m.num11)) mapa.set('tel:'+m.num11, m.ultima);
    });
    if(!data || data.length < PAGINA) break;
  }
  return mapa;
}

function _fuUltimaInteracao(lead){
  if(!_fuUltimasInteracoes) return null;
  if(_fuUltimasInteracoes.has(lead.id)) return _fuUltimasInteracoes.get(lead.id);
  const num11 = (lead.telefone||'').replace(/\D/g,'').slice(-11);
  if(num11 && _fuUltimasInteracoes.has('tel:'+num11)) return _fuUltimasInteracoes.get('tel:'+num11);
  return null;
}

async function _plFollowupMassa(){
  // Popula o select de status com os status ativos
  const sel = document.getElementById('fu-massa-status');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Selecione um status (obrigatório) —</option>' +
    _PL_STATUS.map(s=>`<option value="${s.key}">${s.label} (${_plDados.filter(c=>c.status_crm===s.key||c.status_crm===s.label).length})</option>`).join('');

  // Reseta o filtro de período para "Todos" a cada abertura
  const selPeriodo = document.getElementById('fu-massa-periodo');
  if(selPeriodo) selPeriodo.value = '';
  const wrapCustom = document.getElementById('fu-massa-periodo-custom');
  if(wrapCustom) wrapCustom.style.display = 'none';
  _fuMassaRemoverFoto();

  _fuUltimasInteracoes = await _fuMassaBuscarInteracoes();
  _fuMassaAtualizar();
  document.getElementById('m-followup-massa').classList.add('show');
}

function _fuMassaTogglePeriodo(){
  const val = document.getElementById('fu-massa-periodo')?.value;
  const wrap = document.getElementById('fu-massa-periodo-custom');
  if(wrap) wrap.style.display = val === 'custom' ? '' : 'none';
  _fuMassaAtualizar();
}

// Filtra os leads pelo status selecionado + janela de última interação.
// STATUS É OBRIGATÓRIO: sem seleção, retorna vazio (nunca dispara em massa
// para a base inteira — já causou envio indevido a clientes Em Locação).
function _fuMassaFiltrarLeads(){
  const statusSel = document.getElementById('fu-massa-status')?.value || '';
  const periodo   = document.getElementById('fu-massa-periodo')?.value || '';

  if(!statusSel) return [];

  const stCfg = _PL_STATUS.find(s=>s.key===statusSel);
  const leads = _plDados.filter(c=>c.status_crm===statusSel || (stCfg && c.status_crm===stCfg.label));

  // Última interação: última msg recebida OU criação do lead (leads da SARA/n8n
  // não têm mensagens em wpp_mensagens — a criação conta como interação).
  const ultimaDe = (c)=>{
    const msg = _fuUltimaInteracao(c);
    const criado = c.created_at || null;
    if(msg && criado) return new Date(msg) > new Date(criado) ? msg : criado;
    return msg || criado;
  };

  if(periodo === 'todos' || !periodo) return leads; // sem filtro de tempo

  const agora = new Date();
  let limite = null;

  if(periodo === '23h'){
    limite = new Date(agora.getTime() - 23*60*60*1000);
  } else if(periodo === 'hoje'){
    limite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()); // 00:00 de hoje
  } else if(periodo === 'custom'){
    const dataIni = document.getElementById('fu-massa-data-ini')?.value;
    const dataFim = document.getElementById('fu-massa-data-fim')?.value;
    if(!dataIni) return leads; // sem data informada ainda, não filtra
    const iniObj = new Date(dataIni+'T00:00:00');
    const fimObj = dataFim ? new Date(dataFim+'T23:59:59') : agora;
    return leads.filter(c=>{
      const ult = ultimaDe(c);
      if(!ult) return false;
      const d = new Date(ult);
      return d >= iniObj && d <= fimObj;
    });
  }

  if(!limite) return leads;
  return leads.filter(c=>{
    const ult = ultimaDe(c);
    if(!ult) return false;
    return new Date(ult) >= limite;
  });
}

function _fuMassaAtualizar(){
  const statusSel = document.getElementById('fu-massa-status')?.value || '';
  const el = document.getElementById('fu-massa-preview');
  if(!el) return;
  if(!statusSel){
    el.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:4px">Selecione um status</div>
      <div style="font-size:11px;color:var(--muted)">O envio em massa só funciona para UM status por vez, para evitar mensagens indevidas.</div>`;
    return;
  }
  const stCfg = _PL_STATUS.find(s=>s.key===statusSel);
  const leads = _fuMassaFiltrarLeads();
  const comTel = leads.filter(c=>c.telefone);
  const semTel = leads.length - comTel.length;
  el.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">
      ${comTel.length} lead${comTel.length!==1?'s':''} serão impactados <span style="font-weight:600;color:var(--muted)">— somente status "${stCfg?.label||statusSel}"</span>
    </div>
    <div style="font-size:11px;color:var(--muted)">
      ${semTel>0 ? `⚠️ ${semTel} lead${semTel!==1?'s':''} sem telefone serão ignorados.` : '✅ Todos têm telefone cadastrado.'}
    </div>`;
}

// ── Foto opcional do follow-up em massa ──
let _fuMassaFoto = null;

function _fuMassaSelecionarFoto(input){
  const file = input.files[0]; if(!file) return;
  _fuMassaFoto = file;
  const prev = document.getElementById('fu-massa-foto-preview');
  const vazio = document.getElementById('fu-massa-foto-vazio');
  const img = document.getElementById('fu-massa-foto-img');
  const nome = document.getElementById('fu-massa-foto-nome');
  if(img) img.src = URL.createObjectURL(file);
  if(nome) nome.textContent = file.name + ' (' + Math.round(file.size/1024) + 'KB)';
  if(prev) prev.style.display = 'flex';
  if(vazio) vazio.style.display = 'none';
  input.value = '';
}

function _fuMassaRemoverFoto(){
  _fuMassaFoto = null;
  const img = document.getElementById('fu-massa-foto-img');
  if(img?.src) URL.revokeObjectURL(img.src);
  const prev = document.getElementById('fu-massa-foto-preview');
  const vazio = document.getElementById('fu-massa-foto-vazio');
  if(prev) prev.style.display = 'none';
  if(vazio) vazio.style.display = '';
}

// Envia a foto para um número via bridge (mesmo endpoint do chat: salva no
// banco e no Storage, aparecendo no histórico da conversa)
async function _fuMassaEnviarFoto(numero, clienteId, base64, fileName){
  const cfg = JSON.parse(localStorage.getItem('fp_evo_cfg')||'{}');
  if(!cfg.apiUrl) throw new Error('Evolution API não configurada');
  const bridgeUrl = cfg.bridgeUrl || cfg.apiUrl.replace('evo.','bridge.');
  const r = await fetch(bridgeUrl+'/api/enviar-midia', {
    method:'POST',
    headers:{'x-secret':'FleetPro2025','Content-Type':'application/json'},
    body: JSON.stringify({
      numero, tipo:'image', base64, fileName: fileName||null,
      clienteId: clienteId||null,
      nomeAtendente: (typeof currentPerfil!=='undefined' && currentPerfil?.nome) ? '👤 '+currentPerfil.nome.split(' ')[0] : '👤 Atendente'
    })
  });
  if(!r.ok){
    const t = await r.text();
    let msg = t; try{ msg = JSON.parse(t)?.error||t; }catch(_){}
    throw new Error(msg);
  }
  return r.json();
}

async function _fuMassaEnviar(){
  const msg = document.getElementById('fu-massa-msg')?.value?.trim() || '';
  const btn = document.getElementById('fu-massa-btn');
  const statusSel = document.getElementById('fu-massa-status')?.value || '';

  if(!statusSel){ notify('Selecione um status antes de enviar — o envio em massa é sempre por status.','error'); return; }
  if(!msg && !_fuMassaFoto){ notify('Digite a mensagem ou anexe uma foto antes de enviar.','error'); return; }

  const stCfg = _PL_STATUS.find(s=>s.key===statusSel);
  const leads = _fuMassaFiltrarLeads().filter(c=>c.telefone);

  if(!leads.length){ notify('Nenhum lead com telefone para os filtros selecionados.','error'); return; }
  const oQue = _fuMassaFoto ? (msg ? 'foto + mensagem' : 'foto') : 'mensagem';
  if(!await fpConfirm(`Enviar ${oQue} para ${leads.length} lead${leads.length!==1?'s':''} do status "${stCfg?.label||statusSel}"?`, 'Confirmar envio', {confirmLabel:'Enviar', danger:false})) return;

  btn.disabled=true; btn.textContent='⏳ Enviando...';

  // Comprime a foto UMA vez (mesma rotina do chat) e reaproveita para todos
  let fotoBase64 = null, fotoNome = null;
  if(_fuMassaFoto){
    try{
      fotoBase64 = (typeof _comprimirImagem==='function')
        ? await _comprimirImagem(_fuMassaFoto, 800)
        : await _lerBase64(_fuMassaFoto);
      fotoNome = _fuMassaFoto.name;
    }catch(e){
      btn.disabled=false; btn.textContent='📨 Enviar follow-up';
      notify('Erro ao processar a foto: '+e.message,'error');
      return;
    }
  }

  let ok=0, err=0, naoSalvas=0;
  for(const c of leads){
    const texto = msg.replace(/\{nome\}/gi, c.nome?.split(' ')[0]||c.nome||'');
    try{
      if(fotoBase64){
        await _fuMassaEnviarFoto(fmtPhone(c.telefone), c.id, fotoBase64, fotoNome);
        await new Promise(r=>setTimeout(r,350)); // pausa entre foto e texto
      }
      if(texto){
        const result = await evoSendText(c.telefone, texto);
        if(result.salvo === false) naoSalvas++;
      }
      ok++;
    }catch(e){
      err++;
    }
    // Pequena pausa para não sobrecarregar a API
    await new Promise(r=>setTimeout(r,400));
  }

  btn.disabled=false; btn.textContent='📨 Enviar follow-up';
  notify(`✅ ${ok} mensagem${ok!==1?'s':''} enviada${ok!==1?'s':''}${err>0?` · ⚠️ ${err} falha${err!==1?'s':''}`:''}.`,'success');
  if(naoSalvas > 0){
    await fpAlert(
      `${naoSalvas} de ${ok} mensagens foram entregues pelo WhatsApp, mas o sistema de registro (bridge) esteve fora do ar durante o envio — essas mensagens NÃO ficarão salvas no histórico do FleetPro.`,
      'Mensagens não foram salvas no sistema'
    );
  }
  closeModal('followup-massa');
}
