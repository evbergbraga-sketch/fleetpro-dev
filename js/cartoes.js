// cartoes.js — Gestão de Cartões de Crédito e Conciliação FleetPro

// ══ ESTADO ══
let _cartoesLista = [];

// ══ CALCULAR DIA DE FECHAMENTO AUTOMATICAMENTE ══
// Fechamento = vencimento - 10 dias. Se resultado ≤ 0, cai no mês anterior.
// Ex: vence dia 7 → fecha dia 27 (mês anterior); vence dia 15 → fecha dia 5 (mesmo mês)
function _calcDiaFechamento(diaVenc) {
  const diff = diaVenc - 10;
  return diff > 0 ? diff : 30 + diff; // 30 + diff quando negativo (ex: 7-10=-3 → 27)
}

// Retorna true se o fechamento é no mês anterior ao vencimento
function _fechamentoMesAnterior(diaVenc) {
  return (diaVenc - 10) <= 0;
}

// ══ CARREGAR CARTÕES ══
async function cartoesCarregar(){
  if(!sb) return;
  const {data, error} = await sb.from('cartoes_credito').select('*').order('nome');
  if(error){ console.warn('[cartoes]', error.message); return; }
  _cartoesLista = data || [];
  return _cartoesLista;
}

// ══ POPULAR SELECTS DE CARTÃO ══
async function cartaoPopularSelects(seletores=[]){
  if(!_cartoesLista.length) await cartoesCarregar();
  const ativos = _cartoesLista.filter(c=>c.ativo);
  seletores.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const isObrig = el.dataset.obrigatorio === 'true';
    el.innerHTML = (isObrig ? '<option value="">— Selecione o cartão —</option>' : '<option value="">Todos os cartões</option>') +
      ativos.map(c=>{
        const diaFech = _calcDiaFechamento(c.dia_vencimento);
        return `<option value="${c.id}">${c.nome} (fecha dia ${diaFech}, vence dia ${c.dia_vencimento})</option>`;
      }).join('');
  });
}

// ══ LÓGICA DE CICLO DE FATURA ══
/**
 * Dado um cartão e a data da compra, retorna:
 *   periodo: 'YYYY-MM' (mês de referência da fatura)
 *   vencimento: 'YYYY-MM-DD' (data de vencimento da fatura)
 *
 * dia_fechamento é calculado como: dia_vencimento - 10.
 * Se fechamento cai no mês anterior, a janela cruza a virada do mês.
 */
function cartaoCalcularFatura(cartao, dataCompraStr) {
  if(!cartao || !dataCompraStr) return null;
  const compra = new Date(dataCompraStr + 'T12:00:00');
  const diaCompra = compra.getDate();
  const anoCompra = compra.getFullYear();
  const mesCompra = compra.getMonth(); // 0-based

  const diaFech = _calcDiaFechamento(cartao.dia_vencimento);
  const fechMesAnterior = _fechamentoMesAnterior(cartao.dia_vencimento);

  let mesRef, anoRef;
  if(fechMesAnterior){
    if(diaCompra >= diaFech){
      mesRef = mesCompra + 1;
      anoRef = anoCompra;
      if(mesRef > 11){ mesRef = 0; anoRef++; }
    } else {
      mesRef = mesCompra;
      anoRef = anoCompra;
    }
  } else {
    if(diaCompra < diaFech){
      mesRef = mesCompra;
      anoRef = anoCompra;
    } else {
      mesRef = mesCompra + 1;
      anoRef = anoCompra;
      if(mesRef > 11){ mesRef = 0; anoRef++; }
    }
  }

  const periodo = `${anoRef}-${String(mesRef+1).padStart(2,'0')}`;

  let mesVenc = mesRef + 1;
  let anoVenc = anoRef;
  if(mesVenc > 11){ mesVenc = 0; anoVenc++; }
  const diasNoMes = new Date(anoVenc, mesVenc+1, 0).getDate();
  const diaVencAdj = Math.min(cartao.dia_vencimento, diasNoMes);
  const vencimento = `${anoVenc}-${String(mesVenc+1).padStart(2,'0')}-${String(diaVencAdj).padStart(2,'0')}`;

  return { periodo, vencimento };
}

// ══ BUSCAR GASTOS PARA CONCILIAÇÃO ══
async function cartaoBuscarGastos(cartaoId, periodo){
  if(!sb || !cartaoId || !periodo) return [];
  const cartao = _cartoesLista.find(c=>c.id===cartaoId);
  if(!cartao) return [];

  const [anoRef, mesRef] = periodo.split('-').map(Number);
  const diaFech = _calcDiaFechamento(cartao.dia_vencimento);
  const fechMesAnterior = _fechamentoMesAnterior(cartao.dia_vencimento);

  let dataIni, dataFim;

  if(fechMesAnterior){
    const mesAnterior = mesRef - 1;
    const anoAnterior = mesAnterior < 1 ? anoRef - 1 : anoRef;
    const mesAnteriorAdj = mesAnterior < 1 ? 12 : mesAnterior;
    const diasMesAnt = new Date(anoAnterior, mesAnteriorAdj, 0).getDate();
    const diaIniReal = Math.min(diaFech, diasMesAnt);
    dataIni = `${anoAnterior}-${String(mesAnteriorAdj).padStart(2,'0')}-${String(diaIniReal).padStart(2,'0')}`;
    const diasMesRef = new Date(anoRef, mesRef, 0).getDate();
    dataFim = `${anoRef}-${String(mesRef).padStart(2,'0')}-${String(diasMesRef).padStart(2,'0')}`;
  } else {
    dataIni = `${anoRef}-${String(mesRef).padStart(2,'0')}-01`;
    const diasMesRef = new Date(anoRef, mesRef, 0).getDate();
    const diaFimReal = Math.min(diaFech - 1, diasMesRef);
    dataFim = `${anoRef}-${String(mesRef).padStart(2,'0')}-${String(Math.max(1,diaFimReal)).padStart(2,'0')}`;
  }

  const {data, error} = await sb.from('contas_pagar')
    .select('*,veiculos!contas_pagar_veiculo_id_fkey(placa)')
    .eq('status','em_conciliacao')
    .eq('qual_cartao_id', cartaoId)
    .gte('vencimento', dataIni)
    .lte('vencimento', dataFim);

  if(error){ console.warn('[cartao gastos]', error.message); return []; }
  return data || [];
}

// ══ VALIDAR SENHA PARA AÇÕES DESTRUTIVAS ══
async function cpValidarSenhaAdmin(senha){
  if(!senha || !sb) return false;
  const encoded = new TextEncoder().encode(senha);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const {data, error} = await sb.from('sys_config').select('valor').eq('chave','senha_acao_destrutiva').maybeSingle();
  if(error || !data) return false;
  return hashHex === data.valor;
}

// ══ MODAL UNIFICADO: CARTÕES + CATEGORIAS ══
async function abrirGerenciarCartoes(){
  await cartoesCarregar();
  _cartaoRenderLista();
  _abrirModalConfCat('cartoes');
}

async function abrirModalCategorias(){
  _abrirModalConfCat('categorias');
  if(typeof catCarregarLista==='function') await catCarregarLista();
}

function _abrirModalConfCat(aba){
  document.getElementById('m-config-financeiro')?.classList.add('show');
  ['cartoes','categorias'].forEach(a=>{
    document.getElementById(`mcf-tab-${a}`)?.classList.toggle('active', a===aba);
    const sec = document.getElementById(`mcf-sec-${a}`);
    if(sec) sec.style.display = a===aba ? '' : 'none';
  });
}

function _cartaoRenderLista(){
  const tb = document.getElementById('tb-cartoes');
  if(!tb) return;
  if(!_cartoesLista.length){
    tb.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhum cartão cadastrado</td></tr>';
    return;
  }
  const SVG_EDIT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  tb.innerHTML = _cartoesLista.map(c=>{
    const diaFech = _calcDiaFechamento(c.dia_vencimento);
    const fechInfo = _fechamentoMesAnterior(c.dia_vencimento) ? `dia ${diaFech} (mês ant.)` : `dia ${diaFech}`;
    return `<tr>
      <td style="font-size:13px;font-weight:600;color:var(--text)">${c.nome}</td>
      <td style="font-size:12px;color:var(--muted2);text-align:center">${fechInfo}</td>
      <td style="font-size:12px;color:var(--text2);text-align:center;font-weight:600">Dia ${c.dia_vencimento}</td>
      <td>${c.ativo ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-gray">Inativo</span>'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button onclick="_cartaoEditar('${c.id}')" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2);border-radius:6px;font-size:12px;cursor:pointer">${SVG_EDIT} Editar</button>
          <button onclick="_cartaoToggleAtivo('${c.id}')" style="padding:5px 10px;background:none;color:var(--muted);border:1px solid var(--border2);border-radius:6px;font-size:12px;cursor:pointer">${c.ativo?'Desativar':'Ativar'}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _cartaoLimparForm(){
  document.getElementById('cart-id').value = '';
  document.getElementById('cart-nome').value = '';
  document.getElementById('cart-dia-vencimento').value = '';
  document.getElementById('cart-fechamento-preview').textContent = '';
  document.getElementById('cart-form-title').textContent = 'Novo Cartão';
}

function _cartaoEditar(id){
  const c = _cartoesLista.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('cart-id').value = c.id;
  document.getElementById('cart-nome').value = c.nome;
  document.getElementById('cart-dia-vencimento').value = c.dia_vencimento;
  document.getElementById('cart-form-title').textContent = 'Editar Cartão';
  _cartaoAtualizarPreview();
}

function _cartaoAtualizarPreview(){
  const diaVenc = parseInt(document.getElementById('cart-dia-vencimento')?.value)||0;
  const prev = document.getElementById('cart-fechamento-preview');
  if(!prev) return;
  if(!diaVenc || diaVenc < 1 || diaVenc > 31){ prev.textContent = ''; return; }
  const diaFech = _calcDiaFechamento(diaVenc);
  const mesAnterior = _fechamentoMesAnterior(diaVenc);
  prev.innerHTML = `Fechamento calculado: <strong>dia ${diaFech}${mesAnterior?' (mês anterior ao vencimento)':''}</strong>`;
}

async function _cartaoSalvar(){
  const id      = document.getElementById('cart-id')?.value;
  const nome    = document.getElementById('cart-nome')?.value?.trim();
  const diaVenc = parseInt(document.getElementById('cart-dia-vencimento')?.value)||0;

  if(!nome || !diaVenc){
    notify('Preencha o nome e o dia de vencimento','error'); return;
  }
  if(diaVenc < 1 || diaVenc > 31){
    notify('Dia de vencimento deve ser entre 1 e 31','error'); return;
  }

  const diaFech = _calcDiaFechamento(diaVenc);
  const obj = {nome, dia_fechamento: diaFech, dia_vencimento: diaVenc};
  let error;
  if(id){
    ({error} = await sb.from('cartoes_credito').update(obj).eq('id',id));
  } else {
    ({error} = await sb.from('cartoes_credito').insert({...obj, ativo:true}));
  }
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Cartão salvo!','success');
  _cartaoLimparForm();
  await cartoesCarregar();
  _cartaoRenderLista();
  await cartaoPopularSelects(['mcp-cartao','cp-filtro-cartao']);
}

async function _cartaoToggleAtivo(id){
  const c = _cartoesLista.find(x=>x.id===id);
  if(!c) return;
  const {error} = await sb.from('cartoes_credito').update({ativo:!c.ativo}).eq('id',id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  await cartoesCarregar();
  _cartaoRenderLista();
}
