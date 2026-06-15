// ui.js — Camadas, modais, notificações, utilitários
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
  el.textContent = (type==='success' ? '✓ ' : '✕ ') + msg;
  el.className = 'notify ' + type;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.style.display='none', 3500);
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
      if(match) itens.push({
        tipo: 'cliente',
        tag: 'Cliente',
        titulo: c.nome,
        sub: c.cpf ? 'CPF '+c.cpf : (c.telefone||''),
        acao: ()=>{ goPage('clientes'); setTimeout(()=>{ const s=document.getElementById('s-clientes'); if(s){s.value=c.nome;renderClientes();} },400); }
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
      carro:    { bg:'rgba(22,163,74,.12)',  cor:'#4ade80' },
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
