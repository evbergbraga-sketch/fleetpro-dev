// respostas-rapidas.js — Respostas Rápidas do Chat (persistidas no banco)
//
// Antes: armazenadas em localStorage (chave 'fp_rq') — ao limpar o cache
// do navegador, editar ou excluir revertia para os 6 valores padrão
// hardcoded no código, pois o localStorage é local a cada navegador.
// Agora: persistidas em Supabase (tabela respostas_rapidas), compartilhadas
// entre todos os atendentes e sobrevivem a qualquer limpeza de cache.

// ══ ESTADO ══
let _rqLista = [];

// ══ CARREGAR DO BANCO ══
async function rqCarregarLista(){
  if(!sb) return [];
  const {data, error} = await sb.from('respostas_rapidas')
    .select('*').eq('ativo', true).order('ordem');
  if(error){ console.warn('[respostas-rapidas]', error.message); return []; }
  _rqLista = data||[];
  return _rqLista;
}

// ══ RENDERIZAR CHIPS NO CHAT ══
async function renderRQ(){
  const el = document.getElementById('chat-respostas-rapidas');
  if(!el) return;
  await rqCarregarLista();
  el.innerHTML = _rqLista.map(r=>
    `<div class="qr" onclick="setMsg(this.dataset.t)" data-t="${r.texto.replace(/"/g,'&quot;')}">${r.texto}</div>`
  ).join('');
}

// ══ ABRIR MODAL DE GERENCIAMENTO ══
async function gerenciarRespostas(){
  await rqCarregarLista();
  _rqRenderModal();
  document.getElementById('m-respostas-rapidas').classList.add('show');
}

function _rqRenderModal(){
  const el = document.getElementById('rq-lista');
  if(!el) return;
  el.innerHTML = _rqLista.map(r=>`
    <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg2);border-radius:8px;border:1px solid var(--border2)">
      <div style="flex:1;font-size:13px;cursor:pointer" onclick="editarRQ('${r.id}')" title="Clique para editar">${r.texto}</div>
      <button onclick="excluirRQ('${r.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:2px 6px;flex-shrink:0">✕</button>
    </div>`).join('');
}

// ══ EDITAR ══
async function editarRQ(id){
  const item = _rqLista.find(r=>r.id===id);
  if(!item) return;
  const nova = await fpPrompt('Editar resposta:', 'Editar resposta rápida', {defaultValue: item.texto});
  if(nova === null || !nova.trim()) return;
  const {error} = await sb.from('respostas_rapidas').update({texto: nova.trim()}).eq('id', id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  await renderRQ();
  _rqRenderModal();
}

// ══ EXCLUIR ══
async function excluirRQ(id){
  const {error} = await sb.from('respostas_rapidas').delete().eq('id', id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  await renderRQ();
  _rqRenderModal();
}

// ══ ADICIONAR ══
async function adicionarRQ(){
  const inp = document.getElementById('rq-nova');
  const txt = inp?.value.trim();
  if(!txt) return;
  const maiorOrdem = _rqLista.length ? Math.max(..._rqLista.map(r=>r.ordem)) : -1;
  const {error} = await sb.from('respostas_rapidas').insert({texto: txt, ordem: maiorOrdem+1});
  if(error){ notify('Erro: '+error.message,'error'); return; }
  inp.value = '';
  await renderRQ();
  _rqRenderModal();
}
