// ui.js — Camadas, modais, notificações, utilitários

// ══ AJUSTE DO APP AO VIEWPORT VISUAL (MOBILE) ══
// iOS: o teclado e as barras do Safari alteram apenas o viewport VISUAL
// (visualViewport), nunca o layout. A única forma correta é dimensionar o
// shell (#layer-app) via JS a cada resize/scroll do visualViewport,
// compensando também o offsetTop (pan que o Safari faz com o teclado aberto).
(function initViewportFit(){
  const vv = window.visualViewport;
  const debugAtivo = location.search.includes('debug=vh');
  function _debugBadge(info){
    if(!debugAtivo) return;
    let b = document.getElementById('vh-debug');
    if(!b){
      b = document.createElement('div');
      b.id = 'vh-debug';
      b.style.cssText = 'position:fixed;bottom:76px;left:4px;z-index:99999;background:#000c;color:#0f0;font:10px/1.5 monospace;padding:4px 8px;border-radius:6px;pointer-events:none;white-space:pre';
      document.body.appendChild(b);
    }
    b.textContent = info;
  }
  function fit(){
    const app = document.getElementById('layer-app');
    if(!app) return;
    // Modo kb-pan ativo (teclado aberto no Chrome iOS): o pan nativo está
    // no controle — não mexe em altura, transform nem scroll até fechar.
    if(document.body.classList.contains('kb-pan')) return;
    const mobile = window.innerWidth <= 768;
    if(!mobile || !app.classList.contains('active')){
      app.style.removeProperty('height');
      app.style.removeProperty('transform');
      return;
    }
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    app.style.height = Math.round(h) + 'px';
    app.style.transform = top ? `translateY(${Math.round(top)}px)` : '';
    // Scroll interno preso (iOS rola o shell ao abrir o teclado): zera sempre
    if(app.scrollTop) app.scrollTop = 0;
    if(document.documentElement.scrollTop) document.documentElement.scrollTop = 0;
    if(debugAtivo){
      const r = app.getBoundingClientRect();
      _debugBadge(
        'innerH: '+window.innerHeight+
        '\nvv.h: '+(vv?Math.round(vv.height):'—')+'  vv.top: '+(vv?Math.round(vv.offsetTop):'—')+
        '\napp.h: '+Math.round(r.height)+'  app.top: '+Math.round(r.top)+
        '\napp.bottom: '+Math.round(r.bottom)+'  gap: '+(vv?Math.round(vv.height-r.bottom):'—')+
        '\nscrollY: '+Math.round(window.scrollY)+'  appScroll: '+app.scrollTop
      );
    }
  }
  if(vv){
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', ()=>setTimeout(fit, 120));
  // WebKit às vezes NÃO dispara resize do visualViewport ao fechar o teclado:
  // reforça no foco/desfoco de qualquer campo e mantém um watchdog leve.
  document.addEventListener('focusin', ()=>{ setTimeout(fit, 100); setTimeout(fit, 400); });
  document.addEventListener('focusout', ()=>{ setTimeout(fit, 100); setTimeout(fit, 400); });
  setInterval(()=>{ if(window.innerWidth <= 768) fit(); }, 500);

  // ── FALLBACK CHROME iOS (REATIVO) ──
  // No Chrome do iOS o visualViewport pode NÃO encolher com o teclado.
  // A animação do teclado leva ~400ms, então a decisão é reativa:
  // - se o viewport encolher a qualquer momento → modo normal (fit) assume;
  // - se após 700ms nada mudou → ativa kb-pan (pan nativo até o campo).
  let _kbBaseH = 0, _kbTimer = null, _kbFocado = null;
  function _kbEncolheu(){
    const h = vv ? vv.height : window.innerHeight;
    return (_kbBaseH - h) > 40;
  }
  if(vv) vv.addEventListener('resize', ()=>{
    // Viewport encolheu com campo focado: o caminho correto funciona aqui —
    // desativa o pan (se tiver entrado) e deixa o fit agir.
    if(_kbFocado && _kbEncolheu()){
      if(_kbTimer){ clearTimeout(_kbTimer); _kbTimer = null; }
      if(document.body.classList.contains('kb-pan')){
        document.body.classList.remove('kb-pan');
        window.scrollTo(0,0);
      }
      fit();
    }
  });
  document.addEventListener('focusin', (e)=>{
    const el = e.target;
    if(!el || !['INPUT','TEXTAREA'].includes(el.tagName)) return;
    if(window.innerWidth > 768) return;
    _kbFocado = el;
    _kbBaseH = vv ? vv.height : window.innerHeight;
    if(_kbTimer) clearTimeout(_kbTimer);
    _kbTimer = setTimeout(()=>{
      _kbTimer = null;
      if(document.activeElement !== el) return; // já desfocou
      if(_kbEncolheu()) return;                 // Safari/Android: fit no controle
      document.body.classList.add('kb-pan');
      try{ el.scrollIntoView({block:'center'}); }catch(_){ }
    }, 700);
  });
  document.addEventListener('focusout', ()=>{
    _kbFocado = null;
    if(_kbTimer){ clearTimeout(_kbTimer); _kbTimer = null; }
    if(!document.body.classList.contains('kb-pan')){ return; }
    setTimeout(()=>{
      document.body.classList.remove('kb-pan');
      window.scrollTo(0,0);
      document.documentElement.scrollTop = 0;
      fit();
    }, 120);
  });
  // Reajusta quando o app é ativado (login → app)
  const obs = new MutationObserver(fit);
  document.addEventListener('DOMContentLoaded', ()=>{
    const app = document.getElementById('layer-app');
    if(app) obs.observe(app, {attributes:true, attributeFilter:['class']});
    fit();
  });
  fit();
  window._appViewportFit = fit;
})();

// ══ LAYERS ══
function goLayer(id){
  document.querySelectorAll('.layer').forEach(l=>l.classList.remove('active'));
  document.getElementById('layer-'+id).classList.add('active');
}
// ══ MODALS ══
function openModal(type, subtipo){
  if(type==='veiculo'){
    document.getElementById('mv-title').textContent = subtipo==='moto' ? 'Cadastrar Moto' : 'Cadastrar Carro';
    if(subtipo) document.getElementById('mv-tipo').value = subtipo;
    document.getElementById('m-veiculo').classList.add('show');
    preencherSelectInvestidores();
  } else if(type==='cliente'){
    document.getElementById('m-cliente').classList.add('show');
  } else if(type==='manutencao'){
    document.getElementById('mm-vei').innerHTML = allVeiculos.map(v=>`<option value="${v.id}">${v.marca} ${v.modelo} — ${v.placa}</option>`).join('');
    document.getElementById('mm-ini').value = new Date().toISOString().split('T')[0];
    document.getElementById('m-manutencao').classList.add('show');
  } else if(type==='criar-usuario'){
    ['r-nome','r-email','r-senha'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.value='';
    });
    const err = document.getElementById('register-err');
    const ok  = document.getElementById('register-ok');
    if(err) err.style.display='none';
    if(ok)  ok.style.display='none';
    document.getElementById('m-criar-usuario').classList.add('show');
  }
}
function closeModal(t){
  const el = document.getElementById('m-'+t);
  if(el) el.classList.remove('show');
}
// Fecha modal clicando fora
document.querySelectorAll('.modal-overlay').forEach(el=>
  el.addEventListener('click', e=>{ if(e.target===el) el.classList.remove('show'); })
);
// ══ UTILS ══
function fmtData(d){ return d ? d.split('-').reverse().join('/') : '—'; }
function fmtDt(dt){
  if(!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function fmtPhone(tel){
  const n = (tel||'').replace(/\D/g,'');
  return n.length <= 11 ? '55'+n : n;
}
function notify(msg, type='success'){
  const el = document.getElementById('notify');
  el.textContent = (type==='success' ? '✓ ' : type==='warning' ? '⚠️ ' : '✕ ') + msg;
  el.className = 'notify ' + (type==='warning' ? 'warning' : type);
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.style.display='none', 4000);
}
function setMsg(txt){
  const inp = document.getElementById('chat-msg-input');
  if(inp){ inp.value = txt; inp.focus(); }
}

// ══ BUSCA GLOBAL ══
(function(){
  let _buscaTimer = null;

  function _highlight(txt, q){
    if(!q) return txt;
    const re = new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')', 'gi');
    return txt.replace(re, '<mark style="background:rgba(79,70,229,.3);color:#C7D2FE;border-radius:3px;padding:0 2px">$1</mark>');
  }

  function _fechar(){
    const res = document.getElementById('busca-resultados');
    if(res) res.style.display = 'none';
  }

  function _renderResultados(q){
    const res = document.getElementById('busca-resultados');
    if(!res) return;
    if(!q || q.length < 2){ _fechar(); return; }

    const ql = q.toLowerCase();
    const itens = [];

    // Clientes
    (allClientes||[]).forEach(c=>{
      const match = (c.nome||'').toLowerCase().includes(ql)
        || (c.cpf||'').replace(/\D/g,'').includes(ql.replace(/\D/g,''))
        || (c.telefone||'').replace(/\D/g,'').includes(ql.replace(/\D/g,''));
      if(!match) return;
      const isLead = c.tipo==='lead';
      itens.push({
        tipo: isLead ? 'lead' : 'cliente',
        tag: isLead ? 'Lead' : 'Cliente',
        titulo: c.nome,
        sub: c.cpf ? 'CPF '+c.cpf : (c.telefone||''),
        acao: isLead
          ? ()=>{ goPage('pipeline'); setTimeout(()=>{ if(typeof _plAbrirModal==='function') _plAbrirModal(c.id); },400); }
          : ()=>{ goPage('clientes'); setTimeout(()=>{ const s=document.getElementById('s-clientes'); if(s){s.value=c.nome;renderClientes();} },400); }
      });
    });

    // Veículos — carros e motos
    (allVeiculos||[]).forEach(v=>{
      const match = (v.modelo||'').toLowerCase().includes(ql)
        || (v.marca||'').toLowerCase().includes(ql)
        || (v.placa||'').toLowerCase().includes(ql);
      if(match) itens.push({
        tipo: v.tipo,
        tag: v.tipo === 'carro' ? 'Carro' : 'Moto',
        titulo: v.marca+' '+v.modelo,
        sub: v.placa + (v.status ? ' · '+_statusLabel(v.status) : ''),
        acao: ()=>{ goPage(v.tipo==='carro'?'carros':'motos'); setTimeout(()=>{ const s=document.getElementById('s-'+(v.tipo==='carro'?'carros':'motos')); if(s){s.value=v.placa;renderVeiculos();} },400); }
      });
    });

    // Locações ativas
    (allLocacoes||[]).forEach(l=>{
      const nomeCliente = l.clientes?.nome||'';
      const placa = l.veiculos?.placa||'';
      const modelo = l.veiculos?.modelo||'';
      const match = nomeCliente.toLowerCase().includes(ql)
        || placa.toLowerCase().includes(ql)
        || modelo.toLowerCase().includes(ql);
      if(match) itens.push({
        tipo: 'locacao',
        tag: 'Locação',
        titulo: modelo+' · '+placa,
        sub: nomeCliente + (l.data_fim ? ' · devolução '+fmtData(l.data_fim) : ''),
        acao: ()=>goPage('locacoes')
      });
    });

    if(!itens.length){
      res.innerHTML = '<div style="padding:14px 16px;font-size:13px;color:var(--muted2);text-align:center">Nenhum resultado para "<strong style="color:var(--text2)">'+q+'</strong>"</div>';
      res.style.display = 'block';
      return;
    }

    const TAG_CFG = {
      cliente:  { bg:'rgba(79,70,229,.15)',  cor:'#818CF8' },
      lead:     { bg:'rgba(139,92,246,.15)', cor:'#A78BFA' },
      carro:    { bg:'rgba(21,128,61,.12)',  cor:'#22c55e' },
      moto:     { bg:'rgba(217,119,6,.12)',  cor:'#FCD34D' },
      locacao:  { bg:'rgba(220,38,38,.12)',  cor:'#F87171' },
    };

    res.innerHTML = itens.slice(0,8).map((item,i)=>{
      const cfg = TAG_CFG[item.tipo] || TAG_CFG.cliente;
      return `<div class="search-item" onclick="_buscaAcao(${i})" style="gap:10px">
        <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;background:${cfg.bg};color:${cfg.cor};white-space:nowrap;flex-shrink:0">${item.tag}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_highlight(item.titulo, q)}</div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_highlight(item.sub, q)}</div>
        </div>
      </div>`;
    }).join('');

    // Guarda ações para chamar por índice (evita injeção via onclick string)
    window._buscaAcoes = itens.slice(0,8).map(i=>i.acao);
    res.style.display = 'block';
  }

  window._buscaAcao = function(i){
    const acao = (window._buscaAcoes||[])[i];
    if(typeof acao === 'function') acao();
    _fechar();
    const inp = document.getElementById('busca-global');
    if(inp) inp.value = '';
  };

  function _statusLabel(s){
    return {disponivel:'Disponível', alugado:'Alugado', manutencao:'Manutenção', reservado:'Reservado', preparacao:'Preparação'}[s] || s;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const inp = document.getElementById('busca-global');
    const res = document.getElementById('busca-resultados');
    if(!inp || !res) return;

    inp.addEventListener('input', ()=>{
      clearTimeout(_buscaTimer);
      _buscaTimer = setTimeout(()=>_renderResultados(inp.value.trim()), 180);
    });

    inp.addEventListener('keydown', e=>{
      if(e.key === 'Escape'){ _fechar(); inp.value=''; }
    });

    // Fecha ao clicar fora
    document.addEventListener('click', e=>{
      if(!inp.contains(e.target) && !res.contains(e.target)) _fechar();
    });
  });
})();

// ══ BOTÃO ATUALIZAR — reload completo voltando para a página atual ══
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = [...document.querySelectorAll('.topbar-btn')].find(b=>b.textContent.trim()==='↻');
    if(!btn) return;
    btn.onclick = function(){
      // Salva a página ativa antes do reload
      const pageAtiva = document.querySelector('.page.active')?.id?.replace('page-','');
      const chatAtivo = window.activeChatId || null;
      if(pageAtiva) sessionStorage.setItem('fp_last_page', pageAtiva);
      if(chatAtivo) sessionStorage.setItem('fp_last_chat', chatAtivo);
      btn.style.transform = 'rotate(360deg)';
      btn.style.transition = 'transform .5s ease';
      setTimeout(()=>window.location.reload(), 400);
    };
  });
})();

function _toggleSideSection(id){
  const el = document.getElementById(id);
  if(!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : '';
  const parent = el.previousElementSibling;
  if(parent){
    const arrow = parent.querySelector('span:last-child');
    if(arrow && (arrow.textContent==='▼'||arrow.textContent==='▲'))
      arrow.textContent = isOpen ? '▼' : '▲';
  }
  const cfgArrow = document.getElementById('wpp-cfg-arrow');
  if(id==='wpp-cfg-body' && cfgArrow)
    cfgArrow.textContent = isOpen ? '▼' : '▲';
}

// ── NOTIFICAÇÕES (sino) ──
function _toggleNotifDropdown(e){
  e.stopPropagation();
  const dd = document.getElementById('notif-dropdown');
  if(!dd) return;
  if(dd.style.display==='none'){
    _renderNotifDropdown();
    dd.style.display='block';
  } else {
    dd.style.display='none';
  }
}

document.addEventListener('click', ()=>{
  const dd = document.getElementById('notif-dropdown');
  if(dd) dd.style.display='none';
});

function _renderNotifDropdown(){
  const dd = document.getElementById('notif-dropdown');
  if(!dd) return;

  const hoje     = new Date().toISOString().slice(0,10);
  const hojeDate = new Date();
  const mesAtual = hojeDate.getMonth()+1;
  const diaAtual = hojeDate.getDate();

  // 1. Follow-ups do dia (e atrasados)
  const followups = (allClientes||[]).filter(c=>{
    const fu = (c.followup_em||'').slice(0,10);
    return fu && fu <= hoje;
  }).sort((a,b)=>(a.followup_em||'').localeCompare(b.followup_em||''));

  // 2. Locações atrasadas
  const atrasadas = (allLocacoes||[]).filter(l=>{
    return Math.ceil((new Date(l.data_fim)-new Date())/86400000) < 0;
  });

  // 3. Aniversariantes de hoje
  const aniversariantes = (allClientes||[]).filter(c=>{
    if(!c.data_nascimento) return false;
    const [,mes,dia] = c.data_nascimento.slice(0,10).split('-');
    return parseInt(mes)===mesAtual && parseInt(dia)===diaAtual;
  });

  let html = `<div style="padding:14px 16px;border-bottom:1px solid var(--border2);display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:13px;font-weight:700;color:var(--text)">🔔 Notificações</span>
    <span style="font-size:11px;color:var(--muted)">${new Date().toLocaleDateString('pt-BR')}</span>
  </div>`;

  const total = followups.length + atrasadas.length + aniversariantes.length;

  if(!total){
    html += `<div style="padding:32px 16px;text-align:center;color:var(--muted);font-size:13px">✅ Nenhuma notificação pendente</div>`;
    dd.innerHTML = html;
    return;
  }

  // Follow-ups
  if(followups.length){
    html += `<div style="padding:8px 16px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2)">Follow-ups</div>`;
    followups.slice(0,5).forEach(c=>{
      const fu    = (c.followup_em||'').slice(0,10);
      const atras = fu < hoje;
      const label = atras ? `⚠️ Atrasado (${fu.split('-').reverse().join('/')})` : '🔔 Hoje';
      const cor   = atras ? '#F87171' : '#F5B942';
      html += `<div onclick="goPage('chat');setTimeout(()=>{if(typeof abrirChat!=='undefined')abrirChat('${c.id}')},300);document.getElementById('notif-dropdown').style.display='none'"
        style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border2)"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='none'">
        <div style="width:34px;height:34px;border-radius:50%;background:rgba(245,185,66,.12);color:${cor};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">📋</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${c.nome}</div>
          <div style="font-size:11px;color:${cor}">${label}</div>
        </div>
      </div>`;
    });
  }

  // Locações atrasadas
  if(atrasadas.length){
    html += `<div style="padding:8px 16px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2)">Locações atrasadas</div>`;
    atrasadas.slice(0,5).forEach(l=>{
      const nome = l.clientes?.nome || '—';
      const vei  = `${l.veiculos?.modelo||'—'} · ${l.veiculos?.placa||''}`;
      const dias = Math.abs(Math.ceil((new Date(l.data_fim)-new Date())/86400000));
      html += `<div onclick="goPage('locacoes');document.getElementById('notif-dropdown').style.display='none'"
        style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border2)"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='none'">
        <div style="width:34px;height:34px;border-radius:50%;background:rgba(248,113,113,.12);color:#F87171;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">⚠️</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${nome}</div>
          <div style="font-size:11px;color:#F87171">${vei} · ${dias}d em atraso</div>
        </div>
      </div>`;
    });
  }

  // Aniversariantes
  if(aniversariantes.length){
    html += `<div style="padding:8px 16px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2)">Aniversariantes hoje 🎂</div>`;
    aniversariantes.forEach(c=>{
      const nasc  = c.data_nascimento?.slice(0,10);
      const anos  = nasc ? new Date().getFullYear() - parseInt(nasc.slice(0,4)) : null;
      html += `<div onclick="goPage('chat');setTimeout(()=>{if(typeof abrirChat!=='undefined')abrirChat('${c.id}')},300);document.getElementById('notif-dropdown').style.display='none'"
        style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border2)"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='none'">
        <div style="width:34px;height:34px;border-radius:50%;background:rgba(99,102,241,.12);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">🎂</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${c.nome}</div>
          <div style="font-size:11px;color:var(--muted)">${anos ? `Faz ${anos} anos hoje` : 'Aniversário hoje'} · ${c.telefone||'—'}</div>
        </div>
      </div>`;
    });
  }

  dd.innerHTML = html;
}

// ══ MODAL DE CONFIRMAÇÃO PERSONALIZADO (substitui window.confirm e window.prompt) ══

let _fpDialogResolve = null;
let _fpDialogType    = null;

function _fpDialogClose(val){
  const m = document.getElementById('m-fp-dialog');
  if(m) m.style.display = 'none';
  if(_fpDialogResolve) { _fpDialogResolve(val); _fpDialogResolve = null; }
}

// Teclado: ESC cancela, Enter confirma
function _fpDialogKeydown(e){
  if(e.key === 'Escape') _fpDialogClose(_fpDialogType === 'prompt' ? null : false);
  if(e.key === 'Enter'){
    if(_fpDialogType === 'prompt'){
      const inp = document.getElementById('fp-dialog-input');
      _fpDialogClose(inp ? inp.value : null);
    } else {
      _fpDialogClose(true);
    }
  }
}

/**
 * Confirmação personalizada — substitui window.confirm()
 * @param {string} mensagem
 * @param {string} [titulo]
 * @param {Object} [opts] — { confirmLabel, cancelLabel, danger }
 * @returns {Promise<boolean>}
 */
function fpConfirm(mensagem, titulo='Confirmar', opts={}){
  return new Promise(resolve => {
    _fpDialogResolve = resolve;
    _fpDialogType    = 'confirm';

    const m    = document.getElementById('m-fp-dialog');
    const box  = document.getElementById('fp-dialog-box');
    const tEl  = document.getElementById('fp-dialog-title');
    const mEl  = document.getElementById('fp-dialog-msg');
    const inpW = document.getElementById('fp-dialog-input-wrap');
    const okEl = document.getElementById('fp-dialog-ok');
    const noEl = document.getElementById('fp-dialog-cancel');
    if(!m) { resolve(window.confirm(mensagem)); return; }

    tEl.textContent = titulo;
    mEl.innerHTML   = mensagem.replace(/\n/g,'<br>');
    if(inpW) inpW.style.display = 'none';

    const danger = opts.danger !== false; // padrão: botão OK vermelho para confirm
    okEl.textContent = opts.confirmLabel || 'Confirmar';
    okEl.style.background = danger ? 'var(--red)' : 'var(--accent)';
    noEl.textContent = opts.cancelLabel || 'Cancelar';
    noEl.style.display = '';

    m.style.display = 'flex';
    document.removeEventListener('keydown', _fpDialogKeydown);
    document.addEventListener('keydown', _fpDialogKeydown, {once:true});
    setTimeout(()=>okEl.focus(), 50);
  });
}

/**
 * Input personalizado — substitui window.prompt()
 * @param {string} mensagem
 * @param {string} [titulo]
 * @param {Object} [opts] — { placeholder, defaultValue, confirmLabel }
 * @returns {Promise<string|null>}
 */
function fpPrompt(mensagem, titulo='Informar', opts={}){
  return new Promise(resolve => {
    _fpDialogResolve = resolve;
    _fpDialogType    = 'prompt';

    const m    = document.getElementById('m-fp-dialog');
    const tEl  = document.getElementById('fp-dialog-title');
    const mEl  = document.getElementById('fp-dialog-msg');
    const inpW = document.getElementById('fp-dialog-input-wrap');
    const inp  = document.getElementById('fp-dialog-input');
    const okEl = document.getElementById('fp-dialog-ok');
    const noEl = document.getElementById('fp-dialog-cancel');
    if(!m) { resolve(window.prompt(mensagem)); return; }

    tEl.textContent = titulo;
    mEl.innerHTML   = mensagem.replace(/\n/g,'<br>');
    if(inpW) inpW.style.display = '';
    if(inp){ inp.value = opts.defaultValue||''; inp.placeholder = opts.placeholder||''; }

    okEl.textContent = opts.confirmLabel || 'Confirmar';
    okEl.style.background = 'var(--accent)';
    noEl.textContent = 'Cancelar';
    noEl.style.display = '';

    m.style.display = 'flex';
    document.removeEventListener('keydown', _fpDialogKeydown);
    document.addEventListener('keydown', _fpDialogKeydown, {once:true});
    setTimeout(()=>{ if(inp) inp.focus(); }, 50);
  });
}

/**
 * Alerta personalizado — substitui window.alert()
 * @param {string} mensagem
 * @param {string} [titulo]
 */
function fpAlert(mensagem, titulo='Atenção'){
  return new Promise(resolve => {
    _fpDialogResolve = resolve;
    _fpDialogType    = 'alert';

    const m    = document.getElementById('m-fp-dialog');
    const tEl  = document.getElementById('fp-dialog-title');
    const mEl  = document.getElementById('fp-dialog-msg');
    const inpW = document.getElementById('fp-dialog-input-wrap');
    const okEl = document.getElementById('fp-dialog-ok');
    const noEl = document.getElementById('fp-dialog-cancel');
    if(!m) { alert(mensagem); resolve(true); return; }

    tEl.textContent = titulo;
    mEl.innerHTML   = mensagem.replace(/\n/g,'<br>');
    if(inpW) inpW.style.display = 'none';
    if(noEl) noEl.style.display = 'none';
    okEl.textContent = 'OK';
    okEl.style.background = 'var(--accent)';

    m.style.display = 'flex';
    document.removeEventListener('keydown', _fpDialogKeydown);
    document.addEventListener('keydown', _fpDialogKeydown, {once:true});
    setTimeout(()=>okEl.focus(), 50);
  });
}
