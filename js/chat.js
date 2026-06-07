// ══ CONFIG ══
let wppCfg = {};
let wppOk = false;
let sseSource = null;
const EVO_CFG_KEY = 'fp_evo_cfg';

// ══ MENSAGENS NÃO LIDAS ══
const UNREAD_KEY = 'fp_unread';
function getUnread(){ try{ return JSON.parse(localStorage.getItem(UNREAD_KEY)||'{}'); }catch(_){ return {}; } }
function incrementUnread(cid){ const u=getUnread(); u[cid]=(u[cid]||0)+1; localStorage.setItem(UNREAD_KEY,JSON.stringify(u)); }
function clearUnread(cid){ const u=getUnread(); delete u[cid]; localStorage.setItem(UNREAD_KEY,JSON.stringify(u)); }
function totalUnread(){ return Object.values(getUnread()).reduce((a,b)=>a+b,0); }
function atualizarBadgeNotif(){
  const total=totalUnread();
  const dot=document.querySelector('.notif-dot');
  if(dot) dot.style.display=total>0?'block':'none';
  document.title=total>0?`(${total}) FleetPro | Plataforma de Locadoras`:'FleetPro | Plataforma de Locadoras';
}

function fmtPhone(tel){
  if(!tel) return '';
  let n = tel.replace(/\D/g,'');
  if(n.startsWith('0')) n = n.slice(1);
  if(!n.startsWith('55')) n = '55'+n;
  return n;
}

// ── STATUS WPP ──
function setWppStatus(ok, msg){
  wppOk = ok;
  const dot   = document.getElementById('wpp-dot');
  const txt   = document.getElementById('wpp-status-txt');
  const badge = document.getElementById('wpp-status-badge');
  const hdr   = document.getElementById('chat-wpp-status');
  if(dot){
    dot.style.background = ok ? '#00a884' : '#ef4444';
    dot.style.animation  = ok ? 'pulse 2s infinite' : 'none';
  }
  if(txt){ txt.textContent = ok ? 'WhatsApp conectado' : (msg||'Desconectado'); txt.style.color = ok ? '#00a884' : '#8696a0'; }
  if(badge){
    badge.style.background   = ok ? 'rgba(0,168,132,.1)'  : 'rgba(239,68,68,.08)';
    badge.style.borderColor  = ok ? 'rgba(0,168,132,.25)' : 'rgba(239,68,68,.2)';
    badge.style.color        = ok ? '#00a884' : '#8696a0';
  }
  if(hdr){
    hdr.innerHTML = ok
      ? '<div class="wdot"></div>Conectado'
      : '<div class="wdot" style="background:#8696a0;animation:none"></div>Desconectado';
  }
}

// ── ESCAPE HTML (anti-XSS) ──
function _esc(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── QR CODE WHATSAPP ──
let _qrPollTimer = null;

async function _verificarStatusWpp(){
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  if(!cfg.apiUrl || !cfg.apiKey || !cfg.instancia) return 'sem_config';
  try{
    const ctrl = new AbortController();
    setTimeout(()=>ctrl.abort(), 8000);
    const r = await fetch(cfg.apiUrl+'/instance/connectionState/'+cfg.instancia, {
      headers:{'apikey': cfg.apiKey},
      signal: ctrl.signal
    });
    if(!r.ok) return 'erro';
    const data = await r.json();
    const state = (data.instance?.state || data.state || '').toLowerCase();
    return state; // 'open' = conectado, 'close'/'connecting' = desconectado
  }catch(e){ return 'erro'; }
}

async function _buscarQR(){
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  if(!cfg.apiUrl || !cfg.apiKey || !cfg.instancia) return null;
  try{
    const ctrl = new AbortController();
    setTimeout(()=>ctrl.abort(), 8000);
    const r = await fetch(cfg.apiUrl+'/instance/connect/'+cfg.instancia, {
      headers:{'apikey': cfg.apiKey},
      signal: ctrl.signal
    });
    if(!r.ok) return null;
    const data = await r.json();
    return data.base64 || data.qrcode?.base64 || null;
  }catch(e){ return null; }
}

function _atualizarQR(qrBase64){
  const img = document.getElementById('wpp-qr-img');
  const status = document.getElementById('wpp-qr-status');
  if(img && qrBase64){
    img.src = qrBase64.startsWith('data:') ? qrBase64 : 'data:image/png;base64,'+qrBase64;
    img.style.display = 'block';
    if(status) status.textContent = '📱 Escaneie com o WhatsApp do celular';
  }
}

function _onWppConectado(){
  clearInterval(_qrPollTimer); _qrPollTimer = null;
  setWppStatus(true, 'Conectado');
  _renderQrPanel('conectado');
  notify('✅ WhatsApp conectado com sucesso!', 'success');
}

function _onWppDesconectado(){
  setWppStatus(false, 'Desconectado');
  _renderQrPanel('desconectado');
}

function _renderQrPanel(estado){
  const painel = document.getElementById('wpp-qr-painel');
  if(!painel) return;
  if(estado === 'conectado'){
    painel.innerHTML = `
      <div style="text-align:center;padding:16px">
        <div style="font-size:36px;margin-bottom:8px">✅</div>
        <div style="font-weight:600;color:var(--green);margin-bottom:4px">WhatsApp Conectado</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px">Instância ativa e recebendo mensagens</div>
        <button class="btn btn-ghost" style="font-size:12px;width:100%" onclick="desconectarWpp()">⚠️ Desconectar</button>
      </div>`;
  } else if(estado === 'carregando'){
    painel.innerHTML = `
      <div style="text-align:center;padding:16px">
        <div style="font-size:28px;margin-bottom:8px;animation:spin 1s linear infinite">⏳</div>
        <div style="font-size:12px;color:var(--muted)">Gerando QR Code...</div>
      </div>`;
  } else if(estado === 'sem_config'){
    painel.innerHTML = `
      <div style="text-align:center;padding:12px;font-size:12px;color:var(--muted)">
        Configure a URL e API Key da Evolution API acima e clique em "Conectar".
      </div>`;
  } else {
    // desconectado — mostrar QR
    painel.innerHTML = `
      <div style="text-align:center;padding:8px">
        <div id="wpp-qr-status" style="font-size:11px;color:var(--muted);margin-bottom:8px">Aguardando QR Code...</div>
        <div style="background:#fff;border-radius:12px;padding:8px;display:inline-block;margin-bottom:8px">
          <img id="wpp-qr-img" src="" style="width:180px;height:180px;display:none;border-radius:4px">
          <div id="wpp-qr-placeholder" style="width:180px;height:180px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999">
            <span style="animation:pulse 1.5s ease-in-out infinite">📱 Carregando...</span>
          </div>
        </div>
        <div style="font-size:10px;color:var(--muted2);line-height:1.5;margin-bottom:8px">
          Abra o WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
        </div>
        <button class="btn btn-ghost" style="font-size:11px;width:100%" onclick="atualizarQrManual()">🔄 Atualizar QR</button>
      </div>`;
    _iniciarPollingQR();
  }
}

async function _iniciarPollingQR(){
  if(_qrPollTimer) clearInterval(_qrPollTimer);
  // tenta imediato
  await _tentarCarregarQR();
  // depois a cada 20s (QR expira em ~60s)
  _qrPollTimer = setInterval(async()=>{
    const estado = await _verificarStatusWpp();
    if(estado === 'open'){ _onWppConectado(); return; }
    await _tentarCarregarQR();
  }, 20000);
}

async function _tentarCarregarQR(){
  const qr = await _buscarQR();
  if(qr){
    _atualizarQR(qr);
    const ph = document.getElementById('wpp-qr-placeholder');
    if(ph) ph.style.display = 'none';
    const img = document.getElementById('wpp-qr-img');
    if(img) img.style.display = 'block';
  }
}

async function atualizarQrManual(){
  const painel = document.getElementById('wpp-qr-painel');
  const btn = painel?.querySelector('button');
  if(btn){ btn.disabled=true; btn.textContent='🔄 Atualizando...'; }
  await _tentarCarregarQR();
  if(btn){ btn.disabled=false; btn.textContent='🔄 Atualizar QR'; }
}

async function desconectarWpp(){
  if(!confirm('Desconectar o WhatsApp? Precisará escanear o QR novamente.')) return;
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  try{
    await fetch(cfg.apiUrl+'/instance/logout/'+cfg.instancia, {
      method:'DELETE',
      headers:{'apikey': cfg.apiKey}
    });
  }catch(_){}
  setWppStatus(false,'Desconectado');
  _renderQrPanel('desconectado');
  notify('WhatsApp desconectado','info');
}

// ── TOGGLE SEÇÕES DA SIDEBAR DIREITA ──
function _toggleSideSection(id){
  const el = document.getElementById(id);
  if(!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : '';
  // Atualiza seta do header
  const parent = el.previousElementSibling;
  if(parent){
    const arrow = parent.querySelector('span:last-child');
    if(arrow && (arrow.textContent==='▼'||arrow.textContent==='▲'))
      arrow.textContent = isOpen ? '▼' : '▲';
  }
  // Caso especial: status WPP usa arrow próprio
  const cfgArrow = document.getElementById('wpp-cfg-arrow');
  if(id==='wpp-cfg-body' && cfgArrow)
    cfgArrow.textContent = isOpen ? '▼' : '▲';
}

// ── SSE ──
let _sseRetryDelay = 5000;
let _sseRetryTimer = null;

function conectarSSE(bridgeUrl, secret){
  if(sseSource){ sseSource.close(); sseSource = null; }
  if(_sseRetryTimer){ clearTimeout(_sseRetryTimer); _sseRetryTimer = null; }
  const sseUrl = bridgeUrl.replace(/\/$/,'')+'/events?secret='+encodeURIComponent(secret);
  sseSource = new EventSource(sseUrl);
  sseSource.onopen = ()=>{ _sseRetryDelay = 5000; setWppStatus(true,'Conectado'); };
  sseSource.onmessage = e=>{
    try{
      const msg = JSON.parse(e.data);
      if(msg.tipo==='wpp_msg_recebida') receberMsgSSE(msg);
      else if(msg.tipo==='sara_bloqueada')   _atualizarBotaoSara(msg.numero, true);
      else if(msg.tipo==='sara_desbloqueada') _atualizarBotaoSara(msg.numero, false);
      else if(msg.tipo==='wpp_qr')           _atualizarQR(msg.qr);
      else if(msg.tipo==='wpp_conectado')     _onWppConectado();
      else if(msg.tipo==='wpp_desconectado')  _onWppDesconectado();
    }catch(_){}
  };
  sseSource.onerror = ()=>{
    setWppStatus(false,'Reconectando em '+(Math.round(_sseRetryDelay/1000))+'s...');
    sseSource.close(); sseSource = null;
    const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
    if(cfg.bridgeUrl){
      _sseRetryTimer = setTimeout(()=>conectarSSE(cfg.bridgeUrl, cfg.secret||''), _sseRetryDelay);
      _sseRetryDelay = Math.min(_sseRetryDelay * 2, 60000); // máx 60s
    }
  };
}

function receberMsgSSE(msg){
  // [SSE] msg recebida — log removido em prod (PII)
  const cidPorId     = msg.clienteId||null;
  const cidPorNumero = encontrarClientePorNumero(msg.numero);
  const cid          = cidPorId || cidPorNumero || msg.numero;

  const isSara     = (msg.nomeCliente||'').includes('SARA') || (msg.nomeCliente||'').includes('🤖');
  const isAtendente = msg.atendente===true || (msg.nomeCliente||'').includes('Atendente');
  const fromMe = isSara || isAtendente
    || msg.fromMe===true || msg.fromMe==='true'
    || msg.from_me===true || msg.from_me==='true';

  const msgObj = {
    texto:      msg.texto||'',
    tipo:       msg.tipoMsg||msg.tipo||'text',
    direcao:    fromMe ? 'saida' : 'entrada',
    out:        fromMe,
    media_url:  msg.mediaUrl||msg.media_url||null,
    created_at: msg.createdAt||msg.created_at||new Date().toISOString()
  };

  [cid, cidPorId, cidPorNumero, msg.numero].filter(Boolean).forEach(k=>{
    if(!chatMsgs[k]) chatMsgs[k] = [];
    const jatem = chatMsgs[k].some(m=>m.created_at===msgObj.created_at && m.texto===msgObj.texto);
    if(!jatem) chatMsgs[k].push(msgObj);
  });

  const estaAberta = activeChatId && [cid, cidPorId, cidPorNumero, msg.numero]
    .filter(Boolean).includes(activeChatId);
  if(estaAberta){
    const area = document.getElementById('chat-msgs');
    if(area){
      const ph = area.querySelector('[data-placeholder]');
      if(ph) ph.remove();
      const ultimaMsg = area.querySelector('.msg[data-msg-date]:last-of-type');
      const ultimaData = ultimaMsg ? ultimaMsg.dataset.msgDate : null;
      const novaData = msgObj.created_at ? new Date(msgObj.created_at).toDateString() : null;
      if(novaData && novaData !== ultimaData){
        area.insertAdjacentHTML('beforeend', _dateSeparatorHtml(_fmtDateSeparator(msgObj.created_at)));
      }
      area.insertAdjacentHTML('beforeend', renderMsgItem(msgObj));
      area.scrollTop = area.scrollHeight;
    }
  }

  if(!estaAberta) incrementUnread(cid);
  if(allClientes && allClientes.length > 0) renderChatContacts();
  atualizarBadgeNotif();
  const nome = msg.nomeCliente||msg.numero||'Desconhecido';
  const prev = msg.texto ? msg.texto.slice(0,40) : '(mídia)';
  notify('💬 '+nome+': '+prev,'success');
  document.title = '(!) FleetPro — '+nome;
  setTimeout(()=>document.title='FleetPro | Plataforma de Locadoras', 8000);
  // Persistir mensagem recebida no banco (fire-and-forget com handler)
  const clienteIdParaSalvar = cidPorId || (cidPorNumero && cidPorNumero !== msg.numero ? cidPorNumero : null);
  salvarMsgDB(clienteIdParaSalvar, msg.numero||cid, msgObj.texto, msgObj.tipo, msgObj.direcao, msgObj.media_url)
    .catch(e=>console.warn('[chat] salvarMsgDB incoming:', e.message));
}

function encontrarClientePorNumero(numero){
  if(!numero) return null;
  const numLimpo = numero.replace(/\D/g,'').slice(-11);
  const c = allClientes.find(c=>(c.telefone||'').replace(/\D/g,'').slice(-11)===numLimpo);
  return c ? c.id : numero;
}

// ── CONECTAR WPP ──
async function conectarWpp(){
  const evoUrl = (document.getElementById('wpp-url')?.value||'').trim().replace(/\/$/,'');
  const apiKey = (document.getElementById('wpp-apikey')?.value||'').trim();
  const inst   = (document.getElementById('wpp-inst')?.value||'fleetpro').trim();
  const bridge = (document.getElementById('wpp-bridge')?.value||'').trim().replace(/\/$/,'');
  const secret = (document.getElementById('wpp-secret')?.value||'FleetPro2025').trim();

  if(!bridge){ notify('Preencha a URL do Bridge Server','error'); return; }

  try{
    const r = await fetch(bridge+'/health', {signal: AbortSignal.timeout(5000)});
    if(!r.ok) throw new Error('Bridge retornou '+r.status);
  }catch(e){ notify('Bridge indisponível: '+e.message,'error'); return; }

  const cfg = {apiUrl:evoUrl, apiKey, instancia:inst, bridgeUrl:bridge, secret};
  localStorage.setItem(EVO_CFG_KEY, JSON.stringify(cfg));
  conectarSSE(bridge, secret);

  // Verificar status real da instância
  _renderQrPanel('carregando');
  const estado = await _verificarStatusWpp();
  if(estado === 'open'){
    setWppStatus(true,'Conectado');
    _renderQrPanel('conectado');
    notify('WhatsApp já conectado!','success');
  } else {
    setWppStatus(false,'Aguardando QR...');
    _renderQrPanel('desconectado');
    notify('Configure o WhatsApp escaneando o QR Code','info');
  }

  const el = document.getElementById('webhook-url-display');
  if(el) el.textContent = bridge+'/webhook/wpp  (header x-secret: '+secret+')';
}

function preencherCamposWpp(){
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  const set = (id, val)=>{ const e=document.getElementById(id); if(e&&val) e.value=val; };
  set('wpp-url',    cfg.apiUrl);
  set('wpp-apikey', cfg.apiKey);
  set('wpp-inst',   cfg.instancia);
  set('wpp-bridge', cfg.bridgeUrl);
  set('wpp-secret', cfg.secret);
  if(cfg.bridgeUrl){
    const el = document.getElementById('webhook-url-display');
    if(el) el.textContent = cfg.bridgeUrl+'/webhook/wpp  (header x-secret: '+(cfg.secret||'')+')';
    conectarSSE(cfg.bridgeUrl, cfg.secret||'');
    // Verificar status real ao carregar
    _verificarStatusWpp().then(estado=>{
      if(estado==='open'){ setWppStatus(true,'Conectado'); _renderQrPanel('conectado'); }
      else { setWppStatus(false,'Desconectado'); _renderQrPanel('desconectado'); }
    });
    setTimeout(()=>{
      if(activeChatId){
        const c = allClientes.find(x=>x.id===activeChatId);
        if(c?.telefone) _checarStatusSara(c.telefone);
      }
    }, 1500);
  }
  const pers = JSON.parse(localStorage.getItem('fp_personalizacao')||'{}');
  if(pers.nome){ const e=document.getElementById('wpp-nome-locadora'); if(e) e.value=pers.nome; }
  if(pers.assin){ const e=document.getElementById('wpp-assinatura'); if(e) e.value=pers.assin; }
}

function salvarPersonalizacao(){
  const nome  = document.getElementById('wpp-nome-locadora')?.value||'FleetPro Locadora';
  const assin = document.getElementById('wpp-assinatura')?.value||'';
  localStorage.setItem('fp_personalizacao', JSON.stringify({nome, assin}));
  notify('Personalização salva!','success');
}

// ── DB ──
// Paginação: quantas mensagens carregar por vez
const MSGS_POR_PAGINA = 60;
// Rastreia offset de paginação por conversa: { cid: number }
const _msgOffset = {};

async function carregarMsgsDB(clienteId, offset=0){
  if(!sb) return [];
  const isNumero = clienteId && !clienteId.includes('-');
  let query;
  if(isNumero){
    const num11 = clienteId.replace(/\D/g,'').slice(-11);
    query = sb.from('wpp_mensagens')
      .select('id,cliente_id,numero,texto,tipo,direcao,media_url,created_at')
      .ilike('numero','%'+num11);
  } else {
    const cliente = allClientes.find(c=>c.id===clienteId);
    const num11   = (cliente?.telefone||'').replace(/\D/g,'').slice(-11);
    // Uma query só: por cliente_id OU por número (OR)
    const filtro = num11
      ? `cliente_id.eq.${clienteId},numero.ilike.%25${num11}`
      : `cliente_id.eq.${clienteId}`;
    query = sb.from('wpp_mensagens')
      .select('id,cliente_id,numero,texto,tipo,direcao,media_url,created_at')
      .or(filtro);
    // Associar órfãos em background (não bloqueia o render)
    if(num11){
      sb.from('wpp_mensagens')
        .update({cliente_id:clienteId})
        .is('cliente_id',null)
        .ilike('numero','%'+num11)
        .then(()=>{})
        .catch(()=>{});
    }
  }
  const { data, error } = await query
    .order('created_at',{ascending:false})
    .range(offset, offset + MSGS_POR_PAGINA - 1);
  if(error){ console.warn('[chat] carregarMsgsDB:', error.message); return []; }
  // Deduplica por id e retorna em ordem cronológica
  const vistos = new Set();
  return (data||[])
    .filter(m=>{ if(vistos.has(m.id)) return false; vistos.add(m.id); return true; })
    .reverse();
}

async function salvarMsgDB(clienteId, numero, texto, tipo, direcao, mediaUrl){
  if(!sb) return;
  try{
    // Usa upsert com constraint de deduplicação para evitar duplicatas
    // (o ON CONFLICT é gerenciado pelo índice único no banco)
    await sb.from('wpp_mensagens').insert({
      cliente_id: clienteId||null,
      numero:     numero||null,
      texto:      texto||null,
      tipo:       tipo||'text',
      direcao:    direcao||'entrada',
      media_url:  mediaUrl||null,
      created_at: new Date().toISOString()
    });
  }catch(e){
    // Ignora silenciosamente erros de duplicata (código 23505 = unique_violation)
    if(!e.message?.includes('duplicate') && !e.code?.includes('23505'))
      console.warn('[chat] salvarMsgDB:', e.message);
  }
}

// ── ENVIO TEXTO ──
async function evoSendText(telefone, texto){
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  if(!cfg.apiUrl||!cfg.apiKey) throw new Error('Evolution API não configurada. Configure no painel ⚙');
  const num = fmtPhone(telefone);
  const r = await fetch(cfg.apiUrl+'/message/sendText/'+cfg.instancia,{
    method:'POST',
    headers:{'apikey':cfg.apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({number:num, text:texto, delay:500})
  });
  if(!r.ok){ const t=await r.text(); throw new Error(t); }
  return await r.json();
}

// ── SEPARADORES DE DATA ──
function _fmtDateSeparator(dateStr){
  if(!dateStr) return '';
  const d = new Date(dateStr);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(ontem.getDate()-1);
  const sameDay = (a,b) =>
    a.getDate()===b.getDate() &&
    a.getMonth()===b.getMonth() &&
    a.getFullYear()===b.getFullYear();
  if(sameDay(d, hoje)) return 'Hoje';
  if(sameDay(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
}

function _dateSeparatorHtml(label){
  return `<div class="chat-date-sep"><span>${label}</span></div>`;
}

// ── RENDER ──
function renderMsgItem(m){
  const out    = m.direcao==='saida' || m.out===true;
  const isSara = out && ((m.nomeCliente||'').includes('SARA') || (m.nomeCliente||'').includes('🤖'));
  const tipo   = m.tipo||'text';
  const mediaUrl  = m.media_url||m.mediaUrl||m.media_url_local||null;
  const t    = m.created_at
    ? new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    : (m.time||'');
  const msgDate = m.created_at ? new Date(m.created_at).toDateString() : '';
  let corpo = '';
  if(tipo==='image'||tipo==='imageMessage'){
    if(mediaUrl){
      const mid = 'mi'+Date.now()+Math.random().toString(36).slice(2);
      corpo = '<img id="'+mid+'" src="" style="max-width:220px;border-radius:8px;display:block;margin-bottom:4px;cursor:pointer" onclick="window.open(this.src,\'_blank\')">';
      if(m.texto) corpo += '<div style="font-size:12px">'+_esc(m.texto)+'</div>';
      setTimeout(async()=>{ const el=document.getElementById(mid); if(el){ const u=await _getSignedUrl(mediaUrl); el.src=u; el.onclick=()=>window.open(u,'_blank'); }},50);
    } else {
      corpo = '<div style="font-size:12px;color:var(--muted)">🖼️ Imagem '+_esc(m.texto||'')+'</div>';
    }
  } else if(tipo==='audio'||tipo==='ptt'||tipo==='audioMessage'||tipo==='pttMessage'){
    if(mediaUrl){
      const aid = 'au'+Date.now()+Math.random().toString(36).slice(2);
      corpo = '<audio id="'+aid+'" controls style="max-width:220px;min-width:160px"><source src="">Seu navegador nao suporta audio.</audio>';
      setTimeout(async()=>{ const el=document.getElementById(aid); if(el){ const u=await _getSignedUrl(mediaUrl); el.querySelector('source').src=u; el.load(); }},50);
    } else {
      corpo = '<div style="font-size:12px;color:var(--muted)">🎵 Áudio '+_esc(m.texto||'')+'</div>';
    }
  } else if(tipo==='video'||tipo==='videoMessage'){
    if(mediaUrl){
      const vid = 'vi'+Date.now()+Math.random().toString(36).slice(2);
      corpo = '<video id="'+vid+'" controls style="max-width:280px;border-radius:8px;display:block"><source src="">Seu navegador não suporta vídeo.</video>';
      if(m.texto && m.texto!=='Vídeo') corpo += '<div style="font-size:12px;margin-top:4px">'+_esc(m.texto)+'</div>';
      setTimeout(async()=>{ const el=document.getElementById(vid); if(el){ const u=await _getSignedUrl(mediaUrl); el.querySelector('source').src=u; el.load(); }},50);
    } else {
      corpo = '<div style="font-size:12px;color:var(--muted)">🎥 Vídeo '+_esc(m.texto||'')+'</div>';
    }
  } else if(tipo==='document'||tipo==='documentMessage'){
    if(mediaUrl){
      const did = 'di'+Date.now()+Math.random().toString(36).slice(2);
      corpo = '<div>📎 <a id="'+did+'" href="#" target="_blank" style="color:var(--accent)">'+_esc(m.texto||'Abrir documento')+'</a></div>';
      setTimeout(async()=>{ const el=document.getElementById(did); if(el){ const u=await _getSignedUrl(mediaUrl); el.href=u; }},50);
    } else {
      corpo = '<div style="font-size:12px;color:var(--muted)">📎 Documento '+_esc(m.texto||'')+'</div>';
    }
  } else {
    const txt = (m.texto||m.text||'').replace(/</g,'&lt;').replace(/\n/g,'<br>');
    corpo = '<div style="white-space:pre-wrap">'+txt+'</div>';
  }
  const saraBadge = isSara ? '<div style="font-size:9px;color:#f0c040;font-weight:700;margin-bottom:3px;letter-spacing:.5px">🤖 SARA</div>' : '';
  const bgSara = isSara ? 'background:rgba(240,192,64,.10);border:1px solid rgba(240,192,64,.2);' : '';
  const checkMark = out ? '<span class="msg-check" style="color:rgba(233,237,239,0.55)">✓✓</span>' : '';
  return '<div class="msg '+(out?'msg-out':'msg-in')+'" data-msg-date="'+msgDate+'" style="'+bgSara+'">'+saraBadge+corpo+'<div class="msg-time">'+t+' '+checkMark+'</div></div>';
}

async function renderChatMsgs(cid){
  const area = document.getElementById('chat-msgs');
  if(!area) return;
  _msgOffset[cid] = 0;
  // Mostra memória imediatamente enquanto busca no banco
  const memMsgs = chatMsgs[cid]||[];
  if(memMsgs.length){
    area.innerHTML = _buildMsgsHtml(memMsgs);
    area.scrollTop = area.scrollHeight;
  } else {
    area.innerHTML = '<div style="text-align:center;font-size:12px;color:#8696a0;padding:20px">⏳ Buscando mensagens...</div>';
  }
  try{
    const dbMsgs = await carregarMsgsDB(cid, 0);
    // Mescla com memória sem duplicatas
    const vistos = new Set(dbMsgs.map(m=>m.id||(m.created_at+'|'+m.texto)));
    const extras = memMsgs.filter(m=>!vistos.has(m.id||(m.created_at+'|'+(m.texto||m.text||''))));
    const todas  = [...dbMsgs,...extras].sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0));
    // Atualiza cache em memória
    _atualizarCacheChat(cid, todas);
    // Botão "carregar mais" se retornou página cheia
    const temMais = dbMsgs.length >= MSGS_POR_PAGINA;
    const headerHtml = temMais
      ? `<div style="text-align:center;padding:8px">
           <button id="btn-carregar-mais" onclick="carregarMaisMsgs('${cid}')" style="font-size:12px;padding:5px 16px;background:#202c33;border:1px solid rgba(255,255,255,0.1);border-radius:99px;color:#8696a0;cursor:pointer">⬆ Carregar mensagens anteriores</button>
         </div>`
      : '';
    area.innerHTML = todas.length
      ? headerHtml + _buildMsgsHtml(todas)
      : '<div data-placeholder style="text-align:center;font-size:12px;color:#8696a0;padding:30px">Sem mensagens ainda.</div>';
  }catch(e){
    console.warn('[chat] renderChatMsgs:', e.message);
    if(!memMsgs.length)
      area.innerHTML = '<div style="text-align:center;font-size:12px;color:#8696a0;padding:30px">Sem mensagens ainda.</div>';
  }
  area.scrollTop = area.scrollHeight;
}

async function carregarMaisMsgs(cid){
  const btn = document.getElementById('btn-carregar-mais');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Carregando...'; }
  const area = document.getElementById('chat-msgs');
  const offset = (_msgOffset[cid]||0) + MSGS_POR_PAGINA;
  _msgOffset[cid] = offset;
  try{
    const antigas = await carregarMsgsDB(cid, offset);
    if(!antigas.length){
      if(btn) btn.remove();
      return;
    }
    _atualizarCacheChat(cid, antigas);
    const temMais = antigas.length >= MSGS_POR_PAGINA;
    const novoHeader = temMais
      ? `<div style="text-align:center;padding:8px">
           <button id="btn-carregar-mais" onclick="carregarMaisMsgs('${cid}')" style="font-size:12px;padding:5px 16px;background:#202c33;border:1px solid rgba(255,255,255,0.1);border-radius:99px;color:#8696a0;cursor:pointer">⬆ Carregar mensagens anteriores</button>
         </div>`
      : '';
    // Insere antes do conteúdo existente preservando scroll
    const scrollBefore = area.scrollHeight - area.scrollTop;
    const antigasHtml = novoHeader + _buildMsgsHtml(antigas);
    if(btn) btn.closest('div').outerHTML = antigasHtml;
    else area.insertAdjacentHTML('afterbegin', antigasHtml);
    area.scrollTop = area.scrollHeight - scrollBefore;
  }catch(e){
    console.warn('[chat] carregarMaisMsgs:', e.message);
    if(btn){ btn.disabled=false; btn.textContent='⬆ Carregar mensagens anteriores'; }
  }
}

// Limita chatMsgs a 50 conversas em memória (LRU simples)
const _cacheOrder = [];
function _atualizarCacheChat(cid, msgs){
  if(!chatMsgs[cid]) chatMsgs[cid] = [];
  const vistos = new Set(chatMsgs[cid].map(m=>m.id||(m.created_at+'|'+m.texto)));
  msgs.forEach(m=>{
    if(!vistos.has(m.id||(m.created_at+'|'+(m.texto||'')))) chatMsgs[cid].push(m);
  });
  // LRU: move para o fim
  const idx = _cacheOrder.indexOf(cid);
  if(idx !== -1) _cacheOrder.splice(idx,1);
  _cacheOrder.push(cid);
  // Remove o mais antigo se passar de 50
  if(_cacheOrder.length > 50){
    const removido = _cacheOrder.shift();
    if(removido !== activeChatId) delete chatMsgs[removido];
  }
}

function _buildMsgsHtml(msgs){
  let lastDate = null;
  let html = '';
  msgs.forEach(m=>{
    const dia = m.created_at ? new Date(m.created_at).toDateString() : null;
    if(dia && dia !== lastDate){
      html += _dateSeparatorHtml(_fmtDateSeparator(m.created_at));
      lastDate = dia;
    }
    html += renderMsgItem(m);
  });
  return html;
}

// ══ CARREGAR PREVIEWS DE TODAS AS CONVERSAS AO INICIAR ══
// Uma query só que busca as últimas N mensagens distintas por conversa.
// Isso alimenta o chatMsgs para que a lista já mostre preview ao carregar.
async function _carregarPreviewsChat(){
  if(!sb) return;
  try{
    // Busca as últimas 300 mensagens ordenadas por data desc
    // O JS agrupa por conversa e pega só a última de cada uma
    const { data, error } = await sb
      .from('wpp_mensagens')
      .select('id,cliente_id,numero,texto,tipo,direcao,media_url,created_at')
      .order('created_at', { ascending: false })
      .limit(300);

    if(error || !data) return;

    // Agrupa: para cada conversa (cliente_id ou numero), guarda a última mensagem
    const vistosCliente = new Set();
    const vistosNumero  = new Set();
    const msgs = [];

    data.forEach(m=>{
      // Chave primária da conversa
      const chaveCliente = m.cliente_id;
      const chaveNum     = (m.numero||'').replace(/\D/g,'').slice(-11);

      // Guarda a mensagem se ainda não vimos essa conversa
      if(chaveCliente && !vistosCliente.has(chaveCliente)){
        vistosCliente.add(chaveCliente);
        msgs.push({ ...m, _chave: chaveCliente });
      } else if(!chaveCliente && chaveNum && !vistosNumero.has(chaveNum)){
        vistosNumero.add(chaveNum);
        msgs.push({ ...m, _chave: chaveNum });
      }
    });

    // Popula chatMsgs para que renderChatContacts mostre o preview
    msgs.forEach(m=>{
      const chave = m.cliente_id || m.numero;
      if(!chave) return;
      if(!chatMsgs[chave]) chatMsgs[chave] = [];
      // Só adiciona se ainda não existe essa mensagem
      const jatem = chatMsgs[chave].some(x=>
        x.id === m.id || (x.created_at === m.created_at && x.texto === m.texto)
      );
      if(!jatem) chatMsgs[chave].push(m);
    });

    // Coleta números sem cliente_id para mostrar contatos desconhecidos
    window._wppNumsDB = [...vistosNumero];

    // Atualiza o badge de não lidos no topo
    atualizarBadgeNotif();

    // Re-renderiza a lista com os previews
    renderChatContacts();

    // Busca fotos de perfil em background para todos os contatos com telefone
    _carregarFotosEmBackground(msgs);

  } catch(e){
    console.warn('[chat] _carregarPreviewsChat:', e.message);
  }
}

// Busca fotos de todos os contatos após carregar previews
// Throttle: 1 foto a cada 400ms para não sobrecarregar a API
async function _carregarFotosEmBackground(msgs){
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  if(!cfg.apiUrl || !cfg.apiKey) return;

  // Monta lista de {cid, numero, nome} únicos para buscar foto
  const fila = [];
  const vistos = new Set();

  // Clientes cadastrados — suporta telefone legado e telefones JSON
  allClientes.forEach(c=>{
    let tel = c.telefone || null;
    if(!tel && c.telefones){
      try{ const arr=JSON.parse(c.telefones); if(arr&&arr.length) tel=arr[0].numero; }catch(_){}
    }
    if(!tel) return;
    const num = tel.replace(/\D/g,'').slice(-11);
    if(vistos.has(num)) return;
    vistos.add(num);
    fila.push({ cid: c.id, numero: tel, nome: c.nome });
  });

  // Desconhecidos do banco
  (window._wppNumsDB||[]).forEach(num=>{
    const n = num.replace(/\D/g,'').slice(-11);
    if(vistos.has(n)) return;
    vistos.add(n);
    fila.push({ cid: num, numero: num, nome: null });
  });

  // Processa a fila com intervalo entre cada requisição
  for(const item of fila){
    // Pula se já está em cache
    const numKey = item.numero.replace(/\D/g,'').slice(-11);
    if(_fotoCache[numKey] !== undefined) continue;
    await new Promise(r=>setTimeout(r, 400)); // throttle
    const url = await _buscarFotoPerfil(item.numero);
    if(url) _atualizarAvatarLista(item.cid, url, item.nome||item.numero);
  }
}

function renderChatContacts(){
  if(!allClientes || allClientes.length === 0) return;
  const s = (document.getElementById('chat-search')?.value||'').toLowerCase();
  const numsCadastrados = new Set(allClientes.map(c=>(c.telefone||'').replace(/\D/g,'').slice(-11)));
  const desconhecidosMap = {};
  Object.keys(chatMsgs).forEach(k=>{
    if(!k.includes('-')){
      const num = k.replace(/\D/g,'').slice(-11);
      if(!numsCadastrados.has(num) && chatMsgs[k]?.length > 0 && !desconhecidosMap[num])
        desconhecidosMap[num] = {id:k, nome:'📱 '+k, telefone:k, _desconhecido:true};
    }
  });
  (window._wppNumsDB||[]).forEach(num=>{
    const numL = num.replace(/\D/g,'').slice(-11);
    if(!numsCadastrados.has(numL) && !desconhecidosMap[numL])
      desconhecidosMap[numL] = {id:num, nome:'📱 '+num, telefone:num, _desconhecido:true};
  });
  const desconhecidos = Object.values(desconhecidosMap);
  const clientes = [...allClientes, ...desconhecidos].filter(c=>!s||c.nome.toLowerCase().includes(s)||(c.telefone||'').includes(s));
  const unread = getUnread();
  document.getElementById('chat-contacts').innerHTML = clientes.map(c=>{
    const ini = (c.nome||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    // Busca última msg pela chave correta: id do cliente OU número de telefone
    const telNum = (c.telefone||'').replace(/\D/g,'');
    const telNum11 = telNum.slice(-11);
    const msgsById  = chatMsgs[c.id]||[];
    const msgsByTel = chatMsgs[telNum]||chatMsgs[telNum11]||chatMsgs[c.telefone]||[];
    // Mescla e pega a mais recente
    const todasMsgs = [...msgsById, ...msgsByTel]
      .filter((m,i,arr)=>arr.findIndex(x=>x.created_at===m.created_at&&x.texto===m.texto)===i)
      .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    const lastMsg = todasMsgs.slice(-1)[0];
    const previewTxt = lastMsg?.texto||lastMsg?.text||'';
    const preview = previewTxt || (lastMsg?.tipo==='audio'||lastMsg?.tipo==='audioMessage'?'🎵 Áudio':lastMsg?.tipo==='image'||lastMsg?.tipo==='imageMessage'?'🖼️ Imagem':lastMsg?.tipo==='document'||lastMsg?.tipo==='documentMessage'?'📎 Documento': lastMsg ? '📎 Mídia' : 'Toque para abrir');
    const nl = unread[c.id]||0;
    const badge = nl>0?`<div class="chat-unread-badge">${nl}</div>`:'';
    const ativo = activeChatId===c.id?'active':'';
    const timeStr = lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
    const previewIcon = lastMsg?.direcao==='saida'||lastMsg?.out ? '<span style="color:#8696a0;margin-right:3px">✓✓</span>' : '';
    return `<div class="chat-item ${ativo}" onclick="abrirChat('${c.id}')">
      <div class="cavatar" id="cav-${c.id}" style="overflow:hidden;padding:0">${_avatarHtmlLista(c.id, ini)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px">
          <div style="font-size:14px;font-weight:${nl>0?700:500};color:#e9edef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${_esc(c.nome)}</div>
          <div class="chat-item-time ${nl>0?'unread':''}" style="flex-shrink:0">${timeStr}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:2px">
          <div style="font-size:12px;color:${nl>0?'#e9edef':'#8696a0'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${previewIcon}${_esc(String(preview).slice(0,40))}</div>
          ${badge}
        </div>
      </div>
    </div>`;
  }).join('')||'<div style="padding:24px 16px;font-size:13px;color:#8696a0;text-align:center">Sem conversas ainda</div>';
}
function filtrarContatos(){ renderChatContacts(); }

// ── FOTO DE PERFIL WPP ──
const _fotoCache = {}; // { numero: url|null }

async function _buscarFotoPerfil(numero){
  if(!numero) return null;
  let numLimpo = String(numero).replace(/\D/g,'');
  if(numLimpo.startsWith('55') && numLimpo.length > 11) numLimpo = numLimpo.slice(2);
  numLimpo = numLimpo.slice(-11); // 11 dígitos: DDD + 9 dígitos
  const cacheKey = numLimpo;
  if(_fotoCache[cacheKey] !== undefined) return _fotoCache[cacheKey];
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  if(!cfg.apiUrl || !cfg.apiKey || !cfg.instancia){ _fotoCache[cacheKey]=null; return null; }
  const base = cfg.apiUrl.replace(/\/$/,'');
  const headers = {'apikey': cfg.apiKey, 'Content-Type':'application/json'};

  // Gera variações do número para contornar diferenças de registro no WhatsApp:
  // 1) com DDI: 5521990331398
  // 2) sem nono dígito: 552190331398 (números antigos RJ/SP)
  // 3) sem DDI: 21990331398
  const ddd   = numLimpo.slice(0,2);
  const corpo = numLimpo.slice(2); // 9 dígitos
  const corpoSem9 = corpo.length===9 ? corpo.slice(1) : corpo; // 8 dígitos
  const variações = [
    '55' + ddd + corpo,          // padrão: 5521990331398
    '55' + ddd + corpoSem9,      // sem nono: 552190331398
    numLimpo,                    // sem DDI: 21990331398
  ];

  const _fetchFoto = async (num) => {
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 6000);
    try{
      const r = await fetch(base+'/chat/fetchProfilePictureUrl/'+cfg.instancia, {
        method:'POST', headers, signal:ctrl.signal,
        body: JSON.stringify({ number: num })
      });
      clearTimeout(timer);
      if(!r.ok) return null;
      const data = await r.json();
      return data.profilePictureUrl || data.picture || data.url || null;
    }catch(_){ clearTimeout(timer); return null; }
  };

  for(const v of variações){
    const url = await _fetchFoto(v);
    if(url){
      _fotoCache[cacheKey] = url;
      return url;
    }
  }
  _fotoCache[cacheKey] = null;
  return null;
}

function _setAvatar(elId, nome, fotoUrl){
  const el = document.getElementById(elId);
  if(!el) return;
  const ini = _iniciais(nome||'?');
  const cor = _avatarCor(nome||'?');
  if(fotoUrl){
    el.style.cssText = 'background:transparent;padding:0;overflow:hidden;border-radius:50%';
    el.innerHTML = '';
    const img = document.createElement('img');
    img.src = fotoUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
    img.onerror = ()=>{
      el.style.cssText = `background:${cor};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;border-radius:50%`;
      el.innerHTML = ini;
    };
    el.appendChild(img);
  } else {
    el.style.cssText = `background:${cor};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;border-radius:50%;overflow:''`;
    el.innerHTML = ini;
  }
}

function _iniciais(nome){
  return (nome||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
}

// Gera cor única por nome/número — igual Telegram/Linear
function _avatarCor(str){
  const paleta = [
    '#1a7fa0','#0e8a6e','#7c3aed','#be185d','#b45309',
    '#0369a1','#15803d','#c2410c','#6d28d9','#0f766e',
    '#1d4ed8','#9333ea','#b91c1c','#0284c7','#047857',
  ];
  let hash = 0;
  for(let i=0;i<str.length;i++) hash = str.charCodeAt(i) + ((hash<<5)-hash);
  return paleta[Math.abs(hash) % paleta.length];
}

function _avatarHtml(str, size=46){
  const ini = _iniciais(str);
  const cor = _avatarCor(str);
  const fs  = size <= 38 ? 13 : 15;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:700;color:#fff;flex-shrink:0">${ini}</div>`;
}


function _avatarHtmlLista(cid, nomeOuNum){
  const cliente = allClientes.find(c=>c.id===cid);
  const tel = cliente?.telefone;
  const numKey = tel ? tel.replace(/\D/g,'').slice(-11) : cid.replace(/\D/g,'').slice(-11);
  const url = _fotoCache[numKey];
  const str = cliente?.nome || nomeOuNum || cid;
  const ini = _iniciais(str);
  const cor = _avatarCor(str);
  if(url) return `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none';this.parentElement.style.background='${cor}';this.parentElement.innerHTML='${ini}'">`;
  // Avatar colorido sem foto
  return `<div style="width:100%;height:100%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;border-radius:50%">${ini}</div>`;
}

function _atualizarAvatarLista(cid, fotoUrl, nome){
  const el = document.getElementById('cav-'+cid);
  if(!el) return;
  const ini = _iniciais(nome||'?');
  const cor = _avatarCor(nome||'?');
  if(fotoUrl){
    el.style.cssText = 'padding:0;overflow:hidden;border-radius:50%';
    el.innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none';this.parentElement.style.background='${cor}';this.parentElement.innerHTML='${ini}'">`;
  } else {
    el.style.cssText = `background:${cor};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;border-radius:50%`;
    el.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${ini}</div>`;
  }
}

// ── MODAL DE PERFIL DO CONTATO (click na foto) ──
function abrirModalContato(){
  if(!activeChatId) return;
  const c = allClientes.find(x=>x.id===activeChatId);
  const numero = c?.telefone || (!activeChatId.includes('-') ? activeChatId : null);
  const nome   = c?.nome || numero || 'Desconhecido';
  const numKey = (numero||'').replace(/\D/g,'').slice(-11);
  const fotoUrl = _fotoCache[numKey] || null;
  const isCliente = !!c;

  const el = document.getElementById('m-contato-perfil');
  if(!el) return;

  // Foto ampliada ou avatar colorido
  const cor = _avatarCor(nome);
  const ini = _iniciais(nome);
  const fotoHtml = fotoUrl
    ? `<img src="${fotoUrl}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;box-shadow:0 4px 20px rgba(0,0,0,0.4)" onerror="this.outerHTML='<div style=\"width:96px;height:96px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff\">${ini}</div>'">`
    : `<div style="width:96px;height:96px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff">${ini}</div>`;

  document.getElementById('mc-foto-wrap').innerHTML = fotoHtml;
  document.getElementById('mc-nome-contato').textContent = nome;
  document.getElementById('mc-numero-contato').textContent = numero ? '📱 +'+numero : 'Sem número';

  // Info extra se for cliente
  const infoEl = document.getElementById('mc-info-extra');
  if(isCliente){
    infoEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#e9edef;margin-top:4px">
        ${c.cpf ? `<div style="color:#8696a0">CPF: <span style="color:#e9edef">${c.cpf}</span></div>` : ''}
        ${c.email ? `<div style="color:#8696a0">Email: <span style="color:#e9edef">${c.email}</span></div>` : ''}
        ${c.endereco ? `<div style="color:#8696a0">Endereço: <span style="color:#e9edef">${c.endereco}</span></div>` : ''}
      </div>`;
  } else {
    infoEl.innerHTML = '<div style="font-size:12px;color:#8696a0;margin-top:4px">Número não cadastrado como cliente</div>';
  }

  // Botões
  const btnsEl = document.getElementById('mc-btns-contato');
  btnsEl.innerHTML = isCliente
    ? `<button class="btn btn-ghost" style="flex:1" onclick="verPerfilCliente();closeModal('contato-perfil')">👤 Ver perfil completo</button>
       <button class="btn btn-primary" style="flex:1;background:#00a884;border-color:#00a884" onclick="closeModal('contato-perfil');goPage('contratos')">📄 Gerar contrato</button>`
    : `<button class="btn btn-primary" style="width:100%;background:#00a884;border-color:#00a884" onclick="closeModal('contato-perfil');abrirCadastroClienteChat()">➕ Cadastrar como cliente</button>`;

  el.classList.add('show');
}

function abrirChat(cid){
  activeChatId = cid;
  clearUnread(cid);
  atualizarBadgeNotif();
  const c = allClientes.find(x=>x.id===cid);
  if(!c){
    _setAvatar('chat-av', '?', null);
    document.getElementById('chat-name').textContent = 'Desconhecido';
    document.getElementById('chat-info').textContent = cid+' · Clique em Cadastrar para registrar';
    const btnCad = document.getElementById('btn-cadastrar-chat');
    if(btnCad) btnCad.style.display = 'flex';
    const btnSara2 = document.getElementById('btn-sara-toggle');
    if(btnSara2) btnSara2.style.display = '';
    _checarStatusSara(cid);
    renderChatMsgs(cid);
    renderChatContacts();
    // Tenta buscar foto do número desconhecido
    _buscarFotoPerfil(cid).then(url=>{ if(activeChatId===cid) _setAvatar('chat-av','?',url); });
    return;
  }
  // Avatar: inicia com iniciais, depois busca foto
  _setAvatar('chat-av', c.nome, null);
  document.getElementById('chat-name').textContent = c.nome;
  document.getElementById('chat-info').textContent = c.telefone ? '📱 '+c.telefone : 'Sem telefone';
  const btnCad = document.getElementById('btn-cadastrar-chat');
  if(btnCad) btnCad.style.display = 'none';
  if(c.telefone) _checarStatusSara(c.telefone);
  renderChatMsgs(cid);
  renderChatContacts();
  // Busca foto de perfil em background
  if(c.telefone){
    _buscarFotoPerfil(c.telefone).then(url=>{
      if(activeChatId===cid) _setAvatar('chat-av', c.nome, url);
      // Atualiza também o avatar na lista de contatos
      _atualizarAvatarLista(cid, url, c.nome);
    });
  }
}

// ── ENVIAR MENSAGEM ──
function adicionarMsgLocal(cid, texto, tipo, mediaUrl){
  const msgObj = {
    texto, tipo, direcao:'saida', out:true,
    media_url: mediaUrl||null,
    media_url_local: mediaUrl||null,
    created_at: new Date().toISOString()
  };
  if(!chatMsgs[cid]) chatMsgs[cid] = [];
  chatMsgs[cid].push(msgObj);
  const area = document.getElementById('chat-msgs');
  if(area){
    const ph = area.querySelector('[data-placeholder]');
    if(ph) ph.remove();
    const ultimaMsg = area.querySelector('.msg[data-msg-date]:last-of-type');
    const ultimaData = ultimaMsg ? ultimaMsg.dataset.msgDate : null;
    const novaData = msgObj.created_at ? new Date(msgObj.created_at).toDateString() : null;
    if(novaData && novaData !== ultimaData){
      area.insertAdjacentHTML('beforeend', _dateSeparatorHtml(_fmtDateSeparator(msgObj.created_at)));
    }
    area.insertAdjacentHTML('beforeend', renderMsgItem(msgObj));
    area.scrollTop = area.scrollHeight;
  }
  renderChatContacts();
}

async function sendMsg(){
  if(!activeChatId){ notify('Selecione um contato','error'); return; }
  if(_mediaFile){
    const c = allClientes.find(x=>x.id===activeChatId);
    await _enviarMidiaWpp(c);
    return;
  }
  const inp = document.getElementById('chat-msg-input');
  const texto = inp.value.trim();
  if(!texto) return;
  const c = allClientes.find(x=>x.id===activeChatId);
  const telefone = c?.telefone || (activeChatId.includes('-') ? null : activeChatId);
  if(!telefone){ notify('Cliente sem telefone cadastrado','error'); return; }
  adicionarMsgLocal(activeChatId, texto, 'text', null);
  inp.value = '';
  try{
    await evoSendText(telefone, texto);
    await salvarMsgDB(c?.id||null, telefone, texto, 'text', 'saida', null);
  }catch(e){
    notify('Erro ao enviar: '+e.message,'error');
  }
}

// ── ENVIAR MÍDIA ──
let _mediaFile = null, _mediaType = '', _mediaPreviewUrl = null;

function enviarArquivo(input, tipo){
  const file = input.files[0]; if(!file) return;
  _mediaFile = file; _mediaType = tipo;
  if(_mediaPreviewUrl) URL.revokeObjectURL(_mediaPreviewUrl);
  _mediaPreviewUrl = URL.createObjectURL(file);
  const prev = document.getElementById('media-preview');
  const txt  = document.getElementById('media-preview-txt');
  if(prev && txt){
    prev.style.display = 'flex';
    txt.textContent = (tipo==='image'?'🖼️':tipo==='audio'?'🎵':'📎')+' '+file.name+' ('+Math.round(file.size/1024)+'KB) — clique Enviar';
  }
  input.value = '';
}

function cancelarMidia(){
  if(_mediaPreviewUrl){ URL.revokeObjectURL(_mediaPreviewUrl); _mediaPreviewUrl = null; }
  _mediaFile = null; _mediaType = '';
  const prev = document.getElementById('media-preview');
  if(prev) prev.style.display = 'none';
  const txt = document.getElementById('media-preview-txt');
  if(txt) txt.textContent = '';
}

async function _enviarMidiaWpp(c){
  const telefone = c?.telefone || (activeChatId && !activeChatId.includes('-') ? activeChatId : null);
  if(!telefone){ notify('Cliente sem telefone','error'); return; }
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  if(!cfg.apiUrl||!cfg.apiKey){ notify('Evolution API não configurada','error'); return; }
  const fileName = _mediaFile.name;
  const tipo     = _mediaType;
  const fileRef  = _mediaFile;
  const localUrl = _mediaPreviewUrl;
  notify('Enviando...','success');
  try{
    let base64 = '';
    if(tipo==='image'){
      base64 = await _comprimirImagem(fileRef, 800);
    } else {
      base64 = await _lerBase64(fileRef);
    }
    const num = fmtPhone(telefone);
    let endpoint = '', body = {};
    if(tipo==='image'){
      endpoint = 'sendMedia';
      body = {number:num, mediatype:'image', media:base64, caption:''};
    } else if(tipo==='audio'){
      endpoint = 'sendWhatsAppAudio';
      body = {number:num, audio:base64, encoding:true};
    } else {
      endpoint = 'sendMedia';
      body = {number:num, mediatype:'document', media:base64, fileName, caption:''};
    }
    const r = await fetch(cfg.apiUrl+'/message/'+endpoint+'/'+cfg.instancia,{
      method:'POST',
      headers:{'apikey':cfg.apiKey,'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if(!r.ok){
      const t = await r.text();
      let msg = t;
      try{ msg = JSON.parse(t)?.message||t; }catch(_){}
      throw new Error(msg);
    }
    let storageUrl = null;
    try{
      const ext = fileRef.name.split('.').pop();
      const path = `chat/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: upData, error: upErr } = await sb.storage.from('wpp-media').upload(path, fileRef);
      if(!upErr && upData){
        storageUrl = `https://jjeogfafgbexgxqhubha.supabase.co/storage/v1/object/wpp-media/${path}`;
      }
    }catch(_){}
    adicionarMsgLocal(activeChatId, fileName||'Arquivo', tipo, localUrl);
    await salvarMsgDB(c?.id||null, telefone, fileName||'Arquivo', tipo, 'saida', storageUrl);
    cancelarMidia();
    notify('Arquivo enviado ✓','success');
  }catch(err){
    notify('Erro: '+err.message,'error');
    cancelarMidia();
  }
}

function _lerBase64(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload  = e => res(e.target.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function _comprimirImagem(file, maxWidth=800){
  return new Promise((res,rej)=>{
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = ()=>{
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxWidth/img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
    };
    img.onerror = rej;
    img.src = objUrl;
  });
}

// ── GRAVAÇÃO DE ÁUDIO ──
let mediaRecorder = null, audioChunks = [], _streamAtivo = null;

async function iniciarGravacao(e){
  if(e) e.preventDefault();
  if(mediaRecorder && mediaRecorder.state==='recording') return;
  const btn = document.getElementById('btn-mic');
  try{
    _streamAtivo = await navigator.mediaDevices.getUserMedia({audio:true});
    audioChunks = [];
    mediaRecorder = new MediaRecorder(_streamAtivo);
    mediaRecorder.ondataavailable = ev=>{ if(ev.data.size>0) audioChunks.push(ev.data); };
    mediaRecorder.onstop = ()=>{
      if(_streamAtivo){ _streamAtivo.getTracks().forEach(t=>t.stop()); _streamAtivo=null; }
      if(audioChunks.length===0){ resetMicBtn(); return; }
      const blob = new Blob(audioChunks,{type:'audio/ogg;codecs=opus'});
      if(blob.size < 500){ notify('Áudio muito curto — segure mais tempo','error'); resetMicBtn(); return; }
      _mediaFile = new File([blob],'audio_'+Date.now()+'.ogg',{type:'audio/ogg'});
      _mediaType = 'audio';
      if(_mediaPreviewUrl) URL.revokeObjectURL(_mediaPreviewUrl);
      _mediaPreviewUrl = URL.createObjectURL(_mediaFile);
      resetMicBtn();
      const c = allClientes.find(x=>x.id===activeChatId);
      _enviarMidiaWpp(c);
    };
    mediaRecorder.start();
    if(btn){ btn.textContent='🔴'; btn.style.background='rgba(239,68,68,.2)'; btn.style.borderColor='var(--red)'; btn.style.color='var(--red)'; }
    notify('Gravando... Solte para enviar 🎙️','success');
  }catch(err){
    notify('Erro no microfone: '+err.message,'error');
    resetMicBtn();
  }
}

function pararGravacao(){
  if(mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop();
}

function pararGravacaoSemEnviar(){
  if(mediaRecorder && mediaRecorder.state==='recording'){
    audioChunks = [];
    mediaRecorder.stop();
  }
  resetMicBtn();
}

function resetMicBtn(){
  const btn = document.getElementById('btn-mic');
  if(btn){ btn.textContent='🎙️'; btn.style.background='var(--bg3)'; btn.style.borderColor='var(--border2)'; btn.style.color=''; }
}

// ── CONTRATOS ──
async function enviarContratoWpp(){
  if(!activeChatId){ notify('Selecione um contato primeiro','error'); return; }
  const c = allClientes.find(x=>x.id===activeChatId);
  if(!c){ notify('Cadastre o cliente para enviar contrato','error'); return; }
  if(!c.telefone){ notify('Cliente sem telefone cadastrado','error'); return; }
  const {data:locs} = await sb.from('locacoes')
    .select('*,veiculos(marca,modelo,placa)')
    .eq('cliente_id', c.id)
    .order('created_at',{ascending:false})
    .limit(1);
  const loc = locs?.[0];
  let texto = '📄 *CONTRATO DE LOCAÇÃO — FleetPro*\n\n';
  texto += `👤 *Cliente:* ${c.nome}\n📋 *CPF:* ${c.cpf}\n`;
  if(loc){
    const dias = Math.ceil((new Date(loc.data_fim)-new Date(loc.data_inicio))/86400000);
    texto += `\n🚗 *Veículo:* ${loc.veiculos?.marca} ${loc.veiculos?.modelo} — ${loc.veiculos?.placa}\n`;
    texto += `📅 *Período:* ${fmtData(loc.data_inicio)} a ${fmtData(loc.data_fim)} (${dias} dias)\n`;
    texto += `💰 *Diária:* R$ ${(loc.diaria||0).toFixed(2)} · *Total:* R$ ${(loc.total||0).toFixed(2)}\n`;
    texto += `\n✅ Contrato registrado no sistema FleetPro.\n`;
  }
  texto += `\n_FleetPro Locadora 🚗🏍️_`;
  try{
    await evoSendText(c.telefone, texto);
    await salvarMsgDB(activeChatId, c.telefone, texto, 'text', 'saida', null);
    adicionarMsgLocal(activeChatId, texto, 'text', null);
    notify('Contrato enviado ✓','success');
  }catch(e){
    notify('Erro: '+e.message,'error');
  }
}

// ── BLOQUEIO DA SARA ──
const _saraBloqueadas = new Set();

function _atualizarBotaoSara(numero, bloqueada){
  const rawN = (numero||'').replace(/\D/g,'');
  const numLimpo = rawN.startsWith('55') ? rawN : '55' + rawN.slice(-11);
  if(bloqueada) _saraBloqueadas.add(numLimpo);
  else _saraBloqueadas.delete(numLimpo);
  const btn = document.getElementById('btn-sara-toggle');
  if(!btn) return;
  const c = allClientes.find(x=>x.id===activeChatId);
  const telRaw = (c?.telefone||activeChatId||'').replace(/\D/g,'');
  const telAtivo = telRaw.startsWith('55') ? telRaw : '55' + telRaw.slice(-11);
  if(telAtivo === numLimpo) _renderBotaoSara(bloqueada);
}

function _renderBotaoSara(bloqueada){
  const btn = document.getElementById('btn-sara-toggle');
  if(!btn) return;
  if(bloqueada){
    btn.textContent = '▶️ Liberar SARA';
    btn.style.background = 'rgba(22,163,74,.15)';
    btn.style.color = '#16a34a';
    btn.style.borderColor = 'rgba(22,163,74,.3)';
  } else {
    btn.textContent = '🤖 Pausar SARA';
    btn.style.background = 'rgba(139,92,246,.15)';
    btn.style.color = '#8b5cf6';
    btn.style.borderColor = 'rgba(139,92,246,.3)';
  }
}

async function toggleSara(){
  if(!activeChatId) return;
  const c = allClientes.find(x=>x.id===activeChatId);
  const telefone = c?.telefone || (!activeChatId.includes('-') ? activeChatId : null);
  if(!telefone){ notify('Não foi possível identificar o número','error'); return; }
  const raw = telefone.replace(/\D/g,'');
  const numLimpo = raw.startsWith('55') ? raw : '55' + raw.slice(-11);
  const bloqueada = _saraBloqueadas.has(numLimpo);
  const cfg = JSON.parse(localStorage.getItem('fp_evo_cfg')||'{}');
  const endpoint = bloqueada ? '/unblock-sara' : '/block-sara';
  try{
    const r = await fetch((cfg.bridgeUrl||'').replace(/\/$/,'')+endpoint, {
      method:'POST',
      headers:{'Content-Type':'application/json','x-secret': (JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}').secret||'FleetPro2025')},
      body: JSON.stringify({ numero: numLimpo })
    });
    const data = await r.json();
    if(data.ok){
      if(bloqueada){ _saraBloqueadas.delete(numLimpo); _renderBotaoSara(false); notify('SARA liberada!','success'); }
      else { _saraBloqueadas.add(numLimpo); _renderBotaoSara(true); notify('SARA pausada — atendente assumiu!','success'); }
    }
  }catch(e){ notify('Erro: '+e.message,'error'); }
}

async function _checarStatusSara(telefone){
  const raw = (String(telefone)||'').replace(/\D/g,'');
  if(!raw){ _renderBotaoSara(false); return; }
  const numChave = raw.startsWith('55') ? raw : '55' + raw.slice(-11);
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  const secret = cfg.secret || 'FleetPro2025';
  try{
    const r = await fetch((cfg.bridgeUrl||'https://bridge.ruahsystems.com.br').replace(/\/$/,'')+'/sara-status/'+numChave+'?secret='+encodeURIComponent(secret));
    const data = await r.json();
    if(data.bloqueada) _saraBloqueadas.add(numChave);
    else _saraBloqueadas.delete(numChave);
    _renderBotaoSara(data.bloqueada);
  }catch(_){ _renderBotaoSara(false); }
}

// ── CADASTRAR CLIENTE PELO CHAT ──
function abrirCadastroClienteChat(){
  if(!activeChatId) return;
  const num = activeChatId.includes('-') ? '' : activeChatId;
  const tel = document.getElementById('mc-tel');
  if(tel) tel.value = num.replace(/^55/,'');
  window._afterSalvarCliente = async ()=>{
    await loadClientes();
    renderChatContacts();
    const c = allClientes.find(x=>(x.telefone||'').replace(/\D/g,'').slice(-11) === num.slice(-11));
    if(c){ activeChatId = c.id; abrirChat(c.id); }
  };
  openModal('cliente');
}

function setMsg(t){ const i=document.getElementById('chat-msg-input'); if(i){i.value=t;i.focus();} }

// ── RECONEXÃO AO VOLTAR PARA A ABA ──
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden'){
    // Salva estado ao sair da aba — para restaurar ao voltar
    const pageAtiva = document.querySelector('.page.active')?.id?.replace('page-','');
    if(pageAtiva) sessionStorage.setItem('fp_last_page', pageAtiva);
    if(activeChatId) sessionStorage.setItem('fp_last_chat', activeChatId);
    return;
  }

  // Ao voltar para a aba: reconecta SSE se caiu
  const cfg = JSON.parse(localStorage.getItem(EVO_CFG_KEY)||'{}');
  if(cfg.bridgeUrl){
    const sseCaiu = !sseSource || sseSource.readyState === EventSource.CLOSED;
    if(sseCaiu) conectarSSE(cfg.bridgeUrl, cfg.secret||'FleetPro2025');
  }

  // Restaura a página e chat — só se o app ainda não navegou sozinho
  const lastPage = sessionStorage.getItem('fp_last_page');
  const lastChat = sessionStorage.getItem('fp_last_chat');
  if(lastPage && document.querySelector('.page#page-dashboard.active')){
    // Só restaura se voltou pro dashboard (app reiniciou)
    sessionStorage.removeItem('fp_last_page');
    sessionStorage.removeItem('fp_last_chat');
    setTimeout(()=>{
      goPage(lastPage);
      if(lastPage==='chat' && lastChat) setTimeout(()=>abrirChat(lastChat), 500);
    }, 300);
  }
});
