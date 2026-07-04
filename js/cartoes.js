// cartoes.js — Gestão de Cartões de Crédito e Conciliação FleetPro

// ══ ESTADO ══
let _cartoesLista = [];

// ══ CARREGAR CARTÕES ══
async function cartoesCarregar(){
  if(!sb) return;
  const {data, error} = await sb.from('cartoes_credito').select('*').order('nome');
  if(error){ console.warn('[cartoes]', error.message); return; }
  _cartoesLista = data || [];
  return _cartoesLista;
}

// ══ POPULAR SELECTS DE CARTÃO (chamada em todos os selects de cartão) ══
async function cartaoPopularSelects(seletores=[]){
  if(!_cartoesLista.length) await cartoesCarregar();
  const ativos = _cartoesLista.filter(c=>c.ativo);
  seletores.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const isObrig = el.dataset.obrigatorio === 'true';
    el.innerHTML = (isObrig ? '<option value="">— Selecione o cartão —</option>' : '<option value="">Todos os cartões</option>') +
      ativos.map(c=>`<option value="${c.id}">${c.nome} (fecha dia ${c.dia_fechamento}, vence dia ${c.dia_vencimento})</option>`).join('');
  });
}

// ══ LÓGICA DE CICLO DE FATURA ══
/**
 * Dado um cartão e a data da compra, retorna:
 *   periodo: 'YYYY-MM' (mês de referência da fatura)
 *   vencimento: 'YYYY-MM-DD' (data de vencimento da fatura)
 *
 * Regra:
 *   dia_compra < dia_fechamento → fatura do mês atual → vence dia_vencimento do mês seguinte
 *   dia_compra >= dia_fechamento → fatura do próximo mês → vence dia_vencimento dois meses à frente
 */
function cartaoCalcularFatura(cartao, dataCompraStr) {
  if(!cartao || !dataCompraStr) return null;
  const compra = new Date(dataCompraStr + 'T12:00:00');
  const diaCompra = compra.getDate();
  const anoCompra = compra.getFullYear();
  const mesCompra = compra.getMonth(); // 0-based

  let mesRef, anoRef;
  if(diaCompra < cartao.dia_fechamento){
    // Cai na fatura do mês atual
    mesRef = mesCompra;
    anoRef = anoCompra;
  } else {
    // Cai na fatura do próximo mês
    mesRef = mesCompra + 1;
    anoRef = anoCompra;
    if(mesRef > 11){ mesRef = 0; anoRef++; }
  }

  // Período de referência da fatura (YYYY-MM)
  const periodo = `${anoRef}-${String(mesRef+1).padStart(2,'0')}`;

  // Data de vencimento da fatura: dia_vencimento do mês SEGUINTE ao período de referência
  let mesVenc = mesRef + 1;
  let anoVenc = anoRef;
  if(mesVenc > 11){ mesVenc = 0; anoVenc++; }

  // Ajustar se dia_vencimento não existe no mês (ex: dia 31 em fevereiro)
  const diasNoMes = new Date(anoVenc, mesVenc+1, 0).getDate();
  const diaVenc = Math.min(cartao.dia_vencimento, diasNoMes);
  const vencimento = `${anoVenc}-${String(mesVenc+1).padStart(2,'0')}-${String(diaVenc).padStart(2,'0')}`;

  return { periodo, vencimento };
}

// ══ BUSCAR GASTOS PARA CONCILIAÇÃO ══
// Retorna todas as contas com status='em_conciliacao' do cartão no período
async function cartaoBuscarGastos(cartaoId, periodo){
  if(!sb || !cartaoId || !periodo) return [];
  const cartao = _cartoesLista.find(c=>c.id===cartaoId);
  if(!cartao) return [];

  // Período YYYY-MM: calcular janela de datas
  // Compras do período = dia_fechamento_anterior+1 até dia_fechamento do mês de referência
  const [anoRef, mesRef] = periodo.split('-').map(Number);

  // Início da janela: dia após o fechamento do mês anterior ao período
  const mesFechAnterior = mesRef - 1;
  const anoFechAnterior = mesFechAnterior < 1 ? anoRef - 1 : anoRef;
  const mesFechAnteriorAdj = mesFechAnterior < 1 ? 12 : mesFechAnterior;
  const diasMesAnterior = new Date(anoFechAnterior, mesFechAnteriorAdj, 0).getDate();
  const diaIniReal = Math.min(cartao.dia_fechamento, diasMesAnterior);
  const dataIni = `${anoFechAnterior}-${String(mesFechAnteriorAdj).padStart(2,'0')}-${String(diaIniReal).padStart(2,'0')}`;

  // Fim da janela: dia do fechamento do mês de referência - 1
  const diasMesRef = new Date(anoRef, mesRef, 0).getDate();
  const diaFimReal = Math.min(cartao.dia_fechamento - 1, diasMesRef);
  const diaFimAdj = diaFimReal < 1 ? diasMesRef : diaFimReal;
  const dataFim = `${anoRef}-${String(mesRef).padStart(2,'0')}-${String(diaFimAdj).padStart(2,'0')}`;

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
  // Calcular hash SHA-256 da senha digitada
  const encoded = new TextEncoder().encode(senha);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
  // Consultar hash armazenado no Supabase
  const {data, error} = await sb.from('sys_config').select('valor').eq('chave','senha_acao_destrutiva').maybeSingle();
  if(error || !data) return false;
  return hashHex === data.valor;
}

// ══ MODAL GERENCIAR CARTÕES ══
async function abrirGerenciarCartoes(){
  await cartoesCarregar();
  _cartaoRenderLista();
  document.getElementById('m-cartoes')?.classList.add('show');
}

function _cartaoRenderLista(){
  const tb = document.getElementById('tb-cartoes');
  if(!tb) return;
  if(!_cartoesLista.length){
    tb.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhum cartão cadastrado</td></tr>';
    return;
  }
  tb.innerHTML = _cartoesLista.map(c=>`<tr>
    <td style="font-size:13px;font-weight:600">${c.nome}</td>
    <td style="font-size:12px;text-align:center">Dia ${c.dia_fechamento}</td>
    <td style="font-size:12px;text-align:center">Dia ${c.dia_vencimento}</td>
    <td>${c.ativo ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-gray">Inativo</span>'}</td>
    <td>
      <button onclick="_cartaoEditar('${c.id}')" style="background:none;border:1px solid var(--border2);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--text2)">Editar</button>
      <button onclick="_cartaoToggleAtivo('${c.id}')" style="background:none;border:1px solid var(--border2);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--muted)">${c.ativo?'Desativar':'Ativar'}</button>
    </td>
  </tr>`).join('');
}

function _cartaoLimparForm(){
  document.getElementById('cart-id').value = '';
  document.getElementById('cart-nome').value = '';
  document.getElementById('cart-dia-fechamento').value = '';
  document.getElementById('cart-dia-vencimento').value = '';
  document.getElementById('cart-form-title').textContent = 'Novo Cartão';
}

function _cartaoEditar(id){
  const c = _cartoesLista.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('cart-id').value = c.id;
  document.getElementById('cart-nome').value = c.nome;
  document.getElementById('cart-dia-fechamento').value = c.dia_fechamento;
  document.getElementById('cart-dia-vencimento').value = c.dia_vencimento;
  document.getElementById('cart-form-title').textContent = 'Editar Cartão';
}

async function _cartaoSalvar(){
  const id      = document.getElementById('cart-id')?.value;
  const nome    = document.getElementById('cart-nome')?.value?.trim();
  const diaFech = parseInt(document.getElementById('cart-dia-fechamento')?.value)||0;
  const diaVenc = parseInt(document.getElementById('cart-dia-vencimento')?.value)||0;

  if(!nome || !diaFech || !diaVenc){
    notify('Preencha nome, dia de fechamento e dia de vencimento','error'); return;
  }
  if(diaFech < 1 || diaFech > 31 || diaVenc < 1 || diaVenc > 31){
    notify('Dias devem ser entre 1 e 31','error'); return;
  }

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
  // Atualiza selects de cartão no formulário de conta a pagar
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
