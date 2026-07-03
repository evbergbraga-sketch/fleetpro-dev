// categorias.js — Gerenciamento de Categorias (Financeiro + Contas a Pagar)

// ══ ESTADO ══
let _catLista = []; // lista completa (inclui inativas), usada só na tela de gerenciamento

// ══ CATEGORIA PROTEGIDA (fallback padrão do sistema, não pode ser renomeada/excluída/desativada) ══
const CAT_PROTEGIDA = 'Outros';

// ══ ABRIR MODAL DE CATEGORIAS ══
async function abrirModalCategorias(){
  document.getElementById('m-categorias-tela')?.classList.add('show');
  await catCarregarLista();
}

// ══ INICIALIZAÇÃO (mantida para compatibilidade) ══
async function iniciarCategorias(){
  await catCarregarLista();
}

// ══ CARREGAR LISTA (gerenciamento) ══
async function catCarregarLista(){
  if(!sb) return;
  const {data, error} = await sb.from('categorias_financeiras').select('*').order('ordem').order('nome');
  if(error){ console.warn('[categorias]', error.message); return; }
  _catLista = data||[];
  catRenderTabela();
}

// ══ RENDERIZAR TABELA ══
function catRenderTabela(){
  const tb = document.getElementById('tb-categorias');
  if(!tb) return;
  if(!_catLista.length){
    tb.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhuma categoria cadastrada</td></tr>';
    return;
  }
  const simNao = v => v ? '✓' : '—';
  tb.innerHTML = _catLista.map(c=>{
    const protegida = c.nome === CAT_PROTEGIDA;
    const statusBadge = c.ativo ? '<span class="badge badge-green">Ativa</span>' : '<span class="badge badge-gray">Inativa</span>';
    return `<tr>
      <td style="font-size:16px">${c.icone}</td>
      <td style="font-size:12px;font-weight:600">${c.nome}${protegida?' <span style="font-size:10px;color:var(--muted2);font-weight:400">(padrão do sistema)</span>':''}</td>
      <td style="text-align:center;font-size:13px">${simNao(c.mostrar_financeiro)}</td>
      <td style="text-align:center;font-size:13px">${simNao(c.mostrar_contas_pagar)}</td>
      <td>${statusBadge}</td>
      <td>
        <button onclick="catEditar('${c.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted)" title="Editar">✏️</button>
        ${!protegida ? `<button onclick="catAlternarAtivo('${c.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted)" title="${c.ativo?'Desativar':'Ativar'}">${c.ativo?'🚫':'✅'}</button>
        <button onclick="catExcluir('${c.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--red)" title="Excluir">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// ══ MODAL NOVA/EDITAR CATEGORIA ══
function catAbrirNova(){
  document.getElementById('mcat-id').value = '';
  document.getElementById('mcat-title').textContent = '➕ Nova Categoria';
  document.getElementById('mcat-nome').value = '';
  document.getElementById('mcat-icone').value = '📎';
  document.getElementById('mcat-fin').checked = true;
  document.getElementById('mcat-cp').checked = true;
  document.getElementById('m-categoria').classList.add('show');
}

function catEditar(id){
  const c = _catLista.find(x=>x.id===id);
  if(!c) return;
  catAbrirNova();
  document.getElementById('mcat-id').value = c.id;
  document.getElementById('mcat-title').textContent = '✏️ Editar Categoria';
  document.getElementById('mcat-nome').value = c.nome;
  document.getElementById('mcat-icone').value = c.icone;
  document.getElementById('mcat-fin').checked = c.mostrar_financeiro;
  document.getElementById('mcat-cp').checked = c.mostrar_contas_pagar;
}

// ══ SALVAR (cria ou edita; renomear propaga p/ lançamentos e contas já existentes) ══
async function catSalvar(){
  const id     = document.getElementById('mcat-id')?.value;
  const nome   = document.getElementById('mcat-nome')?.value?.trim();
  const icone  = document.getElementById('mcat-icone')?.value?.trim() || '📎';
  const mFin   = document.getElementById('mcat-fin')?.checked || false;
  const mCp    = document.getElementById('mcat-cp')?.checked || false;

  if(!nome){ notify('Preencha o nome da categoria','error'); return; }

  if(id){
    const atual = _catLista.find(x=>x.id===id);
    const nomeAntigo = atual?.nome;
    if(nomeAntigo === CAT_PROTEGIDA && nome !== CAT_PROTEGIDA){
      notify(`A categoria "${CAT_PROTEGIDA}" não pode ser renomeada — é usada como padrão do sistema.`,'error');
      return;
    }

    const {error} = await sb.from('categorias_financeiras').update({
      nome, icone, mostrar_financeiro: mFin, mostrar_contas_pagar: mCp,
    }).eq('id', id);
    if(error){ notify('Erro: '+error.message,'error'); return; }

    // Propaga o novo nome pros registros que já usam o nome antigo
    if(nomeAntigo && nomeAntigo !== nome){
      await sb.from('lancamentos').update({categoria:nome}).eq('categoria', nomeAntigo);
      await sb.from('contas_pagar').update({categoria:nome}).eq('categoria', nomeAntigo);
    }
  } else {
    const {error} = await sb.from('categorias_financeiras').insert({
      nome, icone, mostrar_financeiro: mFin, mostrar_contas_pagar: mCp,
      ordem: (_catLista.length||0) + 1,
    });
    if(error){ notify('Erro: '+error.message,'error'); return; }
  }

  notify('Categoria salva!','success');
  closeModal('categoria');
  await _catAtualizarTudo();
}

// ══ ATIVAR/DESATIVAR ══
async function catAlternarAtivo(id){
  const c = _catLista.find(x=>x.id===id);
  if(!c) return;
  if(c.nome === CAT_PROTEGIDA){
    notify(`A categoria "${CAT_PROTEGIDA}" não pode ser desativada — é usada como padrão do sistema.`,'error');
    return;
  }
  const {error} = await sb.from('categorias_financeiras').update({ativo: !c.ativo}).eq('id', id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify(c.ativo ? 'Categoria desativada.' : 'Categoria ativada.','success');
  await _catAtualizarTudo();
}

// ══ EXCLUIR (bloqueia se estiver em uso — desativa em vez de excluir) ══
async function catExcluir(id){
  const c = _catLista.find(x=>x.id===id);
  if(!c) return;
  if(c.nome === CAT_PROTEGIDA){
    notify(`A categoria "${CAT_PROTEGIDA}" não pode ser excluída — é usada como padrão do sistema.`,'error');
    return;
  }

  const [{count:countLanc}, {count:countCp}] = await Promise.all([
    sb.from('lancamentos').select('id',{count:'exact',head:true}).eq('categoria', c.nome),
    sb.from('contas_pagar').select('id',{count:'exact',head:true}).eq('categoria', c.nome),
  ]);
  const emUso = (countLanc||0) + (countCp||0);

  if(emUso > 0){
    if(!confirm(`"${c.nome}" está em uso em ${emUso} registro(s) e não pode ser excluída.\n\nDeseja apenas desativá-la? Ela some dos formulários, mas o histórico existente é mantido.`)) return;
    const {error} = await sb.from('categorias_financeiras').update({ativo:false}).eq('id', id);
    if(error){ notify('Erro: '+error.message,'error'); return; }
    notify('Categoria desativada (estava em uso).','success');
  } else {
    if(!confirm(`Excluir a categoria "${c.nome}"? Ela não está em uso em nenhum registro.`)) return;
    const {error} = await sb.from('categorias_financeiras').delete().eq('id', id);
    if(error){ notify('Erro: '+error.message,'error'); return; }
    notify('Categoria excluída.','success');
  }
  await _catAtualizarTudo();
}

// ══ ATUALIZA TUDO (lista de gerenciamento + cache global + selects abertos) ══
async function _catAtualizarTudo(){
  await catCarregarLista();
  if(typeof loadCategoriasFinanceiras==='function') await loadCategoriasFinanceiras();
  if(typeof catPopularSelects==='function') await catPopularSelects();
}

// ══ POPULAR OS 4 SELECTS DE CATEGORIA (Financeiro + Contas a Pagar) ══
async function catPopularSelects(){
  if((!allCategoriasFinanceiras || !allCategoriasFinanceiras.length) && typeof loadCategoriasFinanceiras==='function'){
    await loadCategoriasFinanceiras();
  }
  const ativas = (allCategoriasFinanceiras||[]).filter(c=>c.ativo);
  const opts = lista => lista.map(c=>`<option>${c.nome}</option>`).join('');

  const finFiltro = document.getElementById('fin-filtro-cat');
  if(finFiltro) finFiltro.innerHTML = '<option value="">Todas as categorias</option>' + opts(ativas.filter(c=>c.mostrar_financeiro));

  const mlcCat = document.getElementById('mlc-cat');
  if(mlcCat) mlcCat.innerHTML = opts(ativas.filter(c=>c.mostrar_financeiro));

  const cpFiltro = document.getElementById('cp-filtro-categoria');
  if(cpFiltro) cpFiltro.innerHTML = '<option value="">Todas as categorias</option>' + opts(ativas.filter(c=>c.mostrar_contas_pagar));

  const mcpCat = document.getElementById('mcp-cat');
  if(mcpCat) mcpCat.innerHTML = opts(ativas.filter(c=>c.mostrar_contas_pagar));
}
