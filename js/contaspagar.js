// contaspagar.js — Módulo Contas a Pagar FleetPro

// ══ ESTADO ══
let _cpContas = [];
let _cpPagamentoAtual = null;
let _cpAbaCurrent = 'contas';

// ══ ICONES SVG ══
const CP_SVG = {
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  cancel:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

const CP_RECORRENCIA_LABEL = { semanal:'Semanal', mensal:'Mensal', anual:'Anual' };

// ══ INICIALIZAÇÃO ══
async function iniciarContasPagar(){
  if(typeof catPopularSelects==='function') await catPopularSelects();
  if(typeof cartoesCarregar==='function') await cartoesCarregar();
  await cartaoPopularSelects(['mcp-cartao','mcp-fatura-cartao']);
  cpPopularSelectVeiculo();
  cpAbrirAba('contas');
  await cpCarregarContas();
  cpRenderAvencer('cp-alertas');
  const btnCat = document.getElementById('cp-btn-categorias');
  if(btnCat) btnCat.style.display = currentPerfil?.perfil==='admin' ? '' : 'none';
}

// ══ ABAS ══
function cpAbrirAba(aba){
  _cpAbaCurrent = aba;
  document.getElementById('cp-aba-contas')?.classList.toggle('active', aba==='contas');
  document.getElementById('cp-aba-historico')?.classList.toggle('active', aba==='historico');
  const secContas = document.getElementById('cp-sec-contas');
  const secHist   = document.getElementById('cp-sec-historico');
  if(secContas) secContas.style.display = aba==='contas' ? '' : 'none';
  if(secHist)   secHist.style.display   = aba==='historico' ? '' : 'none';
  if(aba==='historico') cpCarregarHistorico();
}

// ══ HISTÓRICO (cancelados) ══
async function cpCarregarHistorico(){
  const tb = document.getElementById('tb-cp-historico');
  if(!tb || !sb) return;
  tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted2)">Carregando...</td></tr>';
  const {data, error} = await sb.from('contas_pagar')
    .select('*,veiculos!contas_pagar_veiculo_id_fkey(placa)')
    .eq('status','cancelado')
    .order('cancelado_em',{ascending:false})
    .limit(200);
  if(error){ tb.innerHTML = '<tr><td colspan="6">Erro ao carregar</td></tr>'; return; }
  const lista = data||[];
  if(!lista.length){ tb.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhum registro cancelado</td></tr>'; return; }
  const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  tb.innerHTML = lista.map(c=>`<tr>
    <td style="font-size:12px;color:var(--muted)">${c.cancelado_em ? new Date(c.cancelado_em).toLocaleDateString('pt-BR') : '—'}</td>
    <td style="font-size:12px">${c.descricao}</td>
    <td style="font-size:12px">${c.categoria}</td>
    <td style="font-weight:700">${fmt(c.valor)}</td>
    <td style="font-size:12px;color:var(--muted)">${c.cancelamento_motivo||'—'}</td>
    <td style="font-size:12px;color:var(--muted)">${fmtData(c.vencimento)}</td>
  </tr>`).join('');
}

// ══ CONTAS A VENCER ══
function cpContasAVencer(dias=7){
  const hoje = new Date().toISOString().slice(0,10);
  const limite = new Date(); limite.setDate(limite.getDate()+dias);
  const limiteIso = limite.toISOString().slice(0,10);
  return (allContasPagar||[])
    .filter(c=>c.status==='pendente' && c.vencimento>=hoje && c.vencimento<=limiteIso)
    .sort((a,b)=>a.vencimento.localeCompare(b.vencimento));
}

function cpRenderAvencer(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  const lista = cpContasAVencer(7);
  if(!lista.length){ el.innerHTML = ''; return; }
  const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  el.innerHTML = `
    <div style="background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.25);border-radius:10px;padding:12px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px">${CP_SVG.clock} Contas a vencer nos próximos 7 dias (${lista.length})</div>
      ${lista.map(c=>{
        const icon = (allCategoriasFinanceiras||[]).find(x=>x.nome===c.categoria)?.icone||'';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px">
          <span style="color:var(--text)">${icon} ${c.descricao} <span style="color:var(--muted2)">— vence ${fmtData(c.vencimento)}</span></span>
          <span style="font-weight:700;color:#92400e">${fmt(c.valor)}</span>
        </div>`;
      }).join('')}
    </div>`;
}

// ══ HELPER — está atrasada? ══
function _cpEstaAtrasada(c){
  if(c.status!=='pendente') return false;
  const hoje = new Date().toISOString().slice(0,10);
  return c.vencimento < hoje;
}

// ══ PRÓXIMO VENCIMENTO (recorrência) ══
function _cpProximoVencimento(dataStr, tipo){
  const d = new Date(dataStr+'T00:00:00');
  if(tipo==='semanal') d.setDate(d.getDate()+7);
  else if(tipo==='anual') d.setFullYear(d.getFullYear()+1);
  else d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}

// ══ POPULAR SELECT DE VEÍCULO ══
function cpPopularSelectVeiculo(){
  ['cp-filtro-veiculo','mcp-vei'].forEach(id=>{
    const sel = document.getElementById(id);
    if(!sel) return;
    const isModal = id==='mcp-vei';
    sel.innerHTML = (isModal ? '<option value="">— Nenhum —</option>' : '<option value="">Todos os veículos</option>') +
      (allVeiculos||[]).map(v=>`<option value="${v.id}">${v.tipo==='moto'?'Moto':'Carro'} — ${v.marca} ${v.modelo} — ${v.placa}</option>`).join('');
  });
}

// ══ TOGGLE CARTÃO no modal (mostra select quando Cartão Crédito selecionado) ══
function cpToggleCartao(){
  const forma = document.getElementById('mcp-forma')?.value;
  const wrap  = document.getElementById('mcp-cartao-wrap');
  const info  = document.getElementById('mcp-cartao-info');
  const label = document.getElementById('mcp-vencimento-label');
  if(!wrap) return;
  const ehCartao = forma==='Cartão Crédito';
  wrap.style.display = ehCartao ? '' : 'none';
  if(label) label.textContent = ehCartao ? 'Data da compra' : 'Vencimento';
  if(!ehCartao && info) info.textContent = '';
  if(ehCartao) cpAtualizarInfoCartao();
}

function cpAtualizarInfoCartao(){
  const cartaoId = document.getElementById('mcp-cartao')?.value;
  const venc     = document.getElementById('mcp-vencimento')?.value;
  const info     = document.getElementById('mcp-cartao-info');
  if(!info || !cartaoId || !venc) return;
  if(typeof _cartoesLista === 'undefined' || !_cartoesLista.length) return;
  const cartao = _cartoesLista.find(c=>c.id===cartaoId);
  if(!cartao) return;
  const fat = cartaoCalcularFatura(cartao, venc);
  if(!fat) return;
  const [ano, mes] = fat.periodo.split('-');
  const nomeMes = new Date(parseInt(ano), parseInt(mes)-1, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  info.innerHTML = `Esta compra entra na fatura de <strong>${nomeMes}</strong> — vencimento <strong>${fmtData(fat.vencimento)}</strong>`;
}

// ══ FILTRO DE VENCIMENTO ══
function cpToggleFiltroVencimento(){
  const sel = document.getElementById('cp-filtro-periodo');
  const wrap = document.getElementById('cp-filtro-datas-custom');
  if(!sel) return;
  const val = sel.value;
  if(wrap) wrap.style.display = val==='custom' ? '' : 'none';

  const hoje = new Date();
  const dataIniEl = document.getElementById('cp-filtro-data-ini');
  const dataFimEl = document.getElementById('cp-filtro-data-fim');

  if(val==='mes'){
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10);
    if(dataIniEl) dataIniEl.value = ini;
    if(dataFimEl) dataFimEl.value = fim;
  } else if(val==='proximo'){
    const ini = new Date(hoje.getFullYear(), hoje.getMonth()+1, 1).toISOString().slice(0,10);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth()+2, 0).toISOString().slice(0,10);
    if(dataIniEl) dataIniEl.value = ini;
    if(dataFimEl) dataFimEl.value = fim;
  } else if(val===''){
    if(dataIniEl) dataIniEl.value = '';
    if(dataFimEl) dataFimEl.value = '';
  }
  cpCarregarContas();
}

// ══ CARREGAR CONTAS ══
async function cpCarregarContas(){
  if(!sb) return;
  const status  = document.getElementById('cp-filtro-status')?.value||'';
  const cat     = document.getElementById('cp-filtro-categoria')?.value||'';
  const veiId   = document.getElementById('cp-filtro-veiculo')?.value||'';
  const rec     = document.getElementById('cp-filtro-recorrencia')?.value||'';
  const dataIni = document.getElementById('cp-filtro-data-ini')?.value||'';
  const dataFim = document.getElementById('cp-filtro-data-fim')?.value||'';

  let query = sb.from('contas_pagar')
    .select('*,veiculos!contas_pagar_veiculo_id_fkey(marca,modelo,placa,tipo),cartoes_credito(nome,dia_fechamento,dia_vencimento)')
    .neq('status','cancelado')
    .order('vencimento',{ascending:true})
    .limit(500);

  if(cat)     query = query.eq('categoria', cat);
  if(veiId)   query = query.eq('veiculo_id', veiId);
  if(rec)     query = query.eq('recorrente', rec==='sim');
  if(dataIni) query = query.gte('vencimento', dataIni);
  if(dataFim) query = query.lte('vencimento', dataFim);

  const {data, error} = await query;
  if(error){ console.warn('[contaspagar]', error.message); return; }

  const todas = data||[];
  let filtradas = todas;
  if(status==='pago')            filtradas = todas.filter(c=>c.status==='pago');
  else if(status==='pendente')   filtradas = todas.filter(c=>c.status==='pendente' && !_cpEstaAtrasada(c));
  else if(status==='atrasado')   filtradas = todas.filter(c=>_cpEstaAtrasada(c));
  else if(status==='em_conciliacao') filtradas = todas.filter(c=>c.status==='em_conciliacao');

  _cpContas = filtradas;
  cpRenderContas();
  cpAtualizarCards(todas);
}

// ══ RENDERIZAR TABELA ══
function cpRenderContas(){
  const tb = document.getElementById('tb-contas-pagar');
  if(!tb) return;
  if(!_cpContas.length){
    tb.innerHTML = '<tr class="empty-row"><td colspan="10">Nenhuma conta encontrada</td></tr>';
    return;
  }
  const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  tb.innerHTML = _cpContas.map(c=>{
    const atrasada = _cpEstaAtrasada(c);
    const emConc   = c.status==='em_conciliacao';
    const badge = c.status==='pago'
      ? '<span class="badge badge-green">Pago</span>'
      : emConc
      ? '<span class="badge badge-blue">Em Conciliação</span>'
      : atrasada
      ? '<span class="badge badge-red">Atrasado</span>'
      : '<span class="badge badge-yellow">Pendente</span>';
    const icon = (allCategoriasFinanceiras||[]).find(x=>x.nome===c.categoria)?.icone||'';
    const vei  = c.veiculos ? c.veiculos.placa : '—';
    const cartaoNome = c.cartoes_credito ? c.cartoes_credito.nome : '—';
    const rec  = c.recorrente
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg3);color:var(--muted2);border:1px solid var(--border2)">${CP_RECORRENCIA_LABEL[c.recorrencia_tipo]||''}</span>`
      : '—';
    const nota = c.num_nota ? `<span style="font-size:11px;color:var(--muted)">${c.num_nota}</span>` : '—';
    const podeMarcarPago = c.status!=='pago';
    const btnPagar   = podeMarcarPago
      ? `<button onclick="cpMarcarPago('${c.id}')" title="Marcar como pago" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:rgba(21,128,61,.12);color:#166534;border:1px solid rgba(21,128,61,.3);border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">${CP_SVG.check} Pagar</button>` : '';
    const btnEditar  = `<button onclick="cpEditarConta('${c.id}')" title="Editar" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2);border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">${CP_SVG.edit} Editar</button>`;
    const btnCancelar = `<button onclick="cpCancelarConta('${c.id}')" title="Cancelar" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:rgba(217,119,6,.08);color:#92400e;border:1px solid rgba(217,119,6,.25);border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">${CP_SVG.cancel} Cancelar</button>`;
    const btnExcluir  = `<button onclick="cpExcluirConta('${c.id}')" title="Excluir permanentemente" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:rgba(220,38,38,.06);color:#b91c1c;border:1px solid rgba(220,38,38,.25);border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">${CP_SVG.trash}</button>`;
    return `<tr>
      <td style="font-size:12px;color:${atrasada?'#b91c1c':'var(--muted)'};font-weight:${atrasada?'700':'400'}">${fmtData(c.vencimento)}</td>
      <td style="font-size:12px;font-weight:500">${c.descricao}</td>
      <td style="font-size:12px">${icon} ${c.categoria}</td>
      <td style="font-size:12px;color:var(--muted2)">${c.forma_pgto==='Cartão Crédito' ? cartaoNome : '—'}</td>
      <td style="font-size:12px">${vei}</td>
      <td>${nota}</td>
      <td>${rec}</td>
      <td style="font-weight:700">${fmt(c.valor)}</td>
      <td>${badge}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">${btnPagar}${btnEditar}${btnCancelar}${btnExcluir}</div></td>
    </tr>`;
  }).join('');
}

// ══ CARDS RESUMO ══
function cpAtualizarCards(todas){
  const fmt = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const hoje = new Date().toISOString().slice(0,10);
  const mesAtual = hoje.slice(0,7);

  const pendentes   = todas.filter(c=>c.status==='pendente' && c.vencimento>=hoje);
  const atrasadas   = todas.filter(c=>c.status==='pendente' && c.vencimento<hoje);
  const emConc      = todas.filter(c=>c.status==='em_conciliacao');
  const pagasMes    = todas.filter(c=>c.status==='pago' && (c.data_pagamento||'').slice(0,7)===mesAtual);
  const emAberto    = todas.filter(c=>c.status==='pendente' || c.status==='em_conciliacao');

  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  set('cp-total-pendente',    fmt(pendentes.reduce((a,c)=>a+Number(c.valor),0)));
  set('cp-total-atrasado',    fmt(atrasadas.reduce((a,c)=>a+Number(c.valor),0)));
  set('cp-total-conciliacao', fmt(emConc.reduce((a,c)=>a+Number(c.valor),0)));
  set('cp-total-pago-mes',    fmt(pagasMes.reduce((a,c)=>a+Number(c.valor),0)));
  set('cp-total-aberto',      fmt(emAberto.reduce((a,c)=>a+Number(c.valor),0)));
}

// ══ MODAL NOVA/EDITAR CONTA ══
function cpToggleRecorrencia(){
  const chk  = document.getElementById('mcp-recorrente')?.checked;
  const wrap = document.getElementById('mcp-recorrencia-wrap');
  if(wrap) wrap.style.display = chk ? '' : 'none';
}

const CP_CATEGORIA_FATURA = 'Fatura Cartão';

function cpEhCategoriaFatura(){
  return document.getElementById('mcp-cat')?.value === CP_CATEGORIA_FATURA;
}

function cpToggleCategoriaFatura(){
  const ehFatura = cpEhCategoriaFatura();
  const faturaCard   = document.getElementById('mcp-fatura-card');
  const vencWrap     = document.getElementById('mcp-vencimento-wrap');
  const veiWrap      = document.getElementById('mcp-vei-wrap');
  const recCheckWrap = document.getElementById('mcp-recorrente-check-wrap');
  const recWrap      = document.getElementById('mcp-recorrencia-wrap');
  const formaSel     = document.getElementById('mcp-forma');
  const cartaoWrap   = document.getElementById('mcp-cartao-wrap');

  if(faturaCard)   faturaCard.style.display   = ehFatura ? '' : 'none';
  if(vencWrap)     vencWrap.style.display     = ehFatura ? 'none' : '';
  if(veiWrap)      veiWrap.style.display      = ehFatura ? 'none' : '';
  if(recCheckWrap) recCheckWrap.style.display = ehFatura ? 'none' : 'flex';
  if(ehFatura && recWrap) recWrap.style.display = 'none';

  // Fatura sempre é paga no cartão — trava a forma de pagamento e some
  // com o select genérico de cartão (usa o dedicado dentro do card)
  if(formaSel)   formaSel.style.display   = ehFatura ? 'none' : '';
  if(cartaoWrap) cartaoWrap.style.display = ehFatura ? 'none' : (formaSel?.value==='Cartão Crédito' ? '' : 'none');

  if(ehFatura){
    if(formaSel) formaSel.value = 'Cartão Crédito';
    if(!document.getElementById('mcp-fatura-periodo').value){
      const hoje = new Date();
      document.getElementById('mcp-fatura-periodo').value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    }
  }
}

function cpAbrirNovaConta(){
  document.getElementById('mcp-id').value = '';
  document.getElementById('mcp-title').textContent = 'Nova Conta a Pagar';
  document.getElementById('mcp-desc').value = '';
  document.getElementById('mcp-cat').value = 'Outros';
  document.getElementById('mcp-valor').value = '';
  document.getElementById('mcp-vencimento').value = '';
  document.getElementById('mcp-forma').value = '';
  document.getElementById('mcp-cartao').value = '';
  document.getElementById('mcp-fatura-cartao').value = '';
  document.getElementById('mcp-vei').value = '';
  document.getElementById('mcp-recorrente').checked = false;
  document.getElementById('mcp-recorrencia-tipo').value = 'mensal';
  document.getElementById('mcp-obs').value = '';
  document.getElementById('mcp-fatura-periodo').value = '';
  cpToggleRecorrencia();
  cpToggleCartao();
  cpToggleCategoriaFatura();
  cpPopularSelectVeiculo();
  document.getElementById('m-conta-pagar').classList.add('show');
}

async function cpEditarConta(id){
  let c = _cpContas.find(x=>x.id===id);
  if(!c){
    const {data} = await sb.from('contas_pagar').select('*').eq('id',id).maybeSingle();
    c = data;
  }
  if(!c) return;
  cpAbrirNovaConta();
  document.getElementById('mcp-id').value = c.id;
  document.getElementById('mcp-title').textContent = 'Editar Conta a Pagar';
  document.getElementById('mcp-desc').value = c.descricao||'';
  document.getElementById('mcp-cat').value = c.categoria||'Outros';
  document.getElementById('mcp-valor').value = c.valor;
  document.getElementById('mcp-vencimento').value = c.forma_pgto==='Cartão Crédito' && c.data_compra ? c.data_compra : c.vencimento;
  document.getElementById('mcp-forma').value = c.forma_pgto||'';
  document.getElementById('mcp-cartao').value = c.qual_cartao_id||'';
  document.getElementById('mcp-fatura-cartao').value = c.qual_cartao_id||'';
  document.getElementById('mcp-vei').value = c.veiculo_id||'';
  document.getElementById('mcp-recorrente').checked = !!c.recorrente;
  document.getElementById('mcp-recorrencia-tipo').value = c.recorrencia_tipo||'mensal';
  document.getElementById('mcp-obs').value = c.observacoes||'';
  if(c.fatura_periodo) document.getElementById('mcp-fatura-periodo').value = c.fatura_periodo;
  cpToggleRecorrencia();
  cpToggleCartao();
  cpToggleCategoriaFatura();
  cpAtualizarInfoCartao();
}

async function cpSalvarConta(){
  const id         = document.getElementById('mcp-id')?.value;
  const desc       = document.getElementById('mcp-desc')?.value?.trim();
  const cat        = document.getElementById('mcp-cat')?.value;
  const valor      = parseFloat(document.getElementById('mcp-valor')?.value)||0;
  const obs        = document.getElementById('mcp-obs')?.value?.trim()||null;
  const ehFatura   = cpEhCategoriaFatura();

  if(!desc || !valor){ notify('Preencha descrição e valor','error'); return; }

  let obj;

  if(ehFatura){
    // ══ FATURA DE CARTÃO — vencimento calculado a partir do cartão + período ══
    const cartaoId   = document.getElementById('mcp-fatura-cartao')?.value||null;
    const fatPeriodo = document.getElementById('mcp-fatura-periodo')?.value||null;

    if(!cartaoId){ notify('Selecione o cartão desta fatura','error'); return; }
    if(!fatPeriodo){ notify('Informe o período da fatura','error'); return; }

    const cartao = _cartoesLista.find(c=>c.id===cartaoId);
    if(!cartao){ notify('Cartão não encontrado','error'); return; }

    // Vencimento = calculado a partir do cartão + período (mesma lógica
    // usada em cartaoBuscarGastos, via cartaoVencimentoDoPeriodo)
    const vencimentoCalculado = cartaoVencimentoDoPeriodo(cartao, fatPeriodo);

    obj = {
      descricao: desc, categoria: cat, valor, vencimento: vencimentoCalculado,
      data_compra: null,
      forma_pgto: 'Cartão Crédito', qual_cartao_id: cartaoId, veiculo_id: null,
      recorrente: false, recorrencia_tipo: null, observacoes: obs,
      eh_fatura_cartao: true, fatura_periodo: fatPeriodo,
    };
  } else {
    // ══ CONTA NORMAL (inclui gasto avulso no cartão) ══
    const venc       = document.getElementById('mcp-vencimento')?.value;
    const forma      = document.getElementById('mcp-forma')?.value||null;
    const cartaoId   = document.getElementById('mcp-cartao')?.value||null;
    const veiId      = document.getElementById('mcp-vei')?.value||null;
    const recorrente = document.getElementById('mcp-recorrente')?.checked||false;
    const recTipo    = recorrente ? (document.getElementById('mcp-recorrencia-tipo')?.value||'mensal') : null;

    if(!venc || !forma){ notify('Preencha vencimento e forma de pagamento','error'); return; }
    if(forma==='Cartão Crédito' && !cartaoId){ notify('Selecione o cartão de crédito','error'); return; }

    // Cartão de crédito (gasto comum): o campo digitado é a DATA DA COMPRA.
    // O vencimento real é calculado a partir do ciclo do cartão escolhido.
    let vencimentoFinal = venc;
    let dataCompra = null;
    let statusInicial = undefined; // não altera se já existia

    if(forma==='Cartão Crédito' && cartaoId){
      const cartao = _cartoesLista.find(c=>c.id===cartaoId);
      if(cartao){
        const fat = cartaoCalcularFatura(cartao, venc);
        if(fat){
          dataCompra = venc;
          vencimentoFinal = fat.vencimento;
        }
      }
      if(!id) statusInicial = 'em_conciliacao';
    }

    obj = {
      descricao: desc, categoria: cat, valor, vencimento: vencimentoFinal,
      data_compra: dataCompra,
      forma_pgto: forma, qual_cartao_id: cartaoId||null, veiculo_id: veiId||null,
      recorrente, recorrencia_tipo: recTipo, observacoes: obs,
      eh_fatura_cartao: false, fatura_periodo: null,
      ...(statusInicial ? {status: statusInicial} : {}),
    };
  }

  let error;
  if(id){
    ({error} = await sb.from('contas_pagar').update(obj).eq('id',id));
    if(!error){
      const lancId = (await sb.from('contas_pagar').select('lancamento_id').eq('id',id).maybeSingle()).data?.lancamento_id;
      if(lancId){
        await sb.from('lancamentos').update({
          descricao: desc, categoria: cat, valor,
          veiculo_id: obj.veiculo_id||null, forma_pgto: obj.forma_pgto||null,
        }).eq('id', lancId);
      }
    }
  } else {
    obj.criado_por = currentUser?.id;
    ({error} = await sb.from('contas_pagar').insert(obj));
  }
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta salva!','success');
  closeModal('conta-pagar');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function') await loadContasPagar();
  if(typeof renderDashboard==='function') renderDashboard();
}

// ══ PEDIR SENHA ADMIN ══
async function _cpPedirSenhaAdmin(acao){
  const senha = await fpPrompt(`Para ${acao}, informe a senha de administrador:`, 'Autenticação necessária', {placeholder:'Senha'});
  if(senha === null) return false;
  const ok = await cpValidarSenhaAdmin(senha);
  if(!ok){ notify('Senha incorreta. Ação cancelada.','error'); return false; }
  return true;
}

// ══ CANCELAR CONTA ══
async function cpCancelarConta(id){
  let c = _cpContas.find(x=>x.id===id);
  if(!c){
    const {data} = await sb.from('contas_pagar').select('*').eq('id',id).maybeSingle();
    c = data;
  }
  if(!c) return;
  const senhaOk = await _cpPedirSenhaAdmin('cancelar esta conta');
  if(!senhaOk) return;
  const motivo = await fpPrompt('Ficará registrado no histórico.', `Cancelar "${c.descricao}"`, {placeholder:'Ex: Pago de outra forma, duplicado...'});
  if(motivo === null) return;
  const hojeIso = new Date().toISOString();
  if(c.lancamento_id) await _deletarLancamentoSeguro(c.lancamento_id);
  const {error} = await sb.from('contas_pagar').update({
    status: 'cancelado', cancelamento_motivo: motivo||'Cancelado', cancelado_em: hojeIso,
  }).eq('id', c.id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta cancelada e movida para histórico.','success');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function') await loadContasPagar();
  if(typeof renderDashboard==='function') renderDashboard();
}

// ══ EXCLUIR CONTA ══
async function cpExcluirConta(id){
  let c = _cpContas.find(x=>x.id===id);
  if(!c){
    const {data} = await sb.from('contas_pagar').select('*').eq('id',id).maybeSingle();
    c = data;
  }
  if(!c) return;
  const senhaOk = await _cpPedirSenhaAdmin('excluir permanentemente');
  if(!senhaOk) return;
  if(!await fpConfirm(`Excluir permanentemente "${c.descricao}"?\n\nIsso também remove qualquer lançamento no Financeiro vinculado. Essa ação não pode ser desfeita.`, 'Excluir conta')) return;
  if(c.lancamento_id) await _deletarLancamentoSeguro(c.lancamento_id);
  const {error} = await sb.from('contas_pagar').delete().eq('id',id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta excluída permanentemente.','success');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function') await loadContasPagar();
  if(typeof renderDashboard==='function') renderDashboard();
}

// ══ MARCAR COMO PAGO — abre modal de confirmação ══
async function cpMarcarPago(id){
  let c = _cpContas.find(x=>x.id===id);
  if(!c){
    const {data} = await sb.from('contas_pagar').select('*,cartoes_credito(nome,dia_fechamento,dia_vencimento)').eq('id',id).maybeSingle();
    c = data;
  }
  if(!c || c.status==='pago') return;
  _cpPagamentoAtual = c;

  const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  document.getElementById('cpc-desc').textContent  = c.descricao;
  const catIcon = (allCategoriasFinanceiras||[]).find(x=>x.nome===c.categoria)?.icone||'';
  document.getElementById('cpc-cat').textContent   = `${catIcon} ${c.categoria}`.trim();
  document.getElementById('cpc-venc').textContent  = fmtData(c.vencimento);
  document.getElementById('cpc-forma').textContent = c.forma_pgto || '—';
  document.getElementById('cpc-valor').textContent = fmt(c.valor);
  document.getElementById('cpc-nf').value = '';
  document.getElementById('cpc-forma-pago').value = '';

  // Fatura de cartão: mostrar preview de conciliação
  const fatWrap    = document.getElementById('cpc-fatura-wrap');
  const fatPreview = document.getElementById('cpc-fatura-preview');

  if(c.eh_fatura_cartao && c.fatura_periodo && c.qual_cartao_id && fatWrap && fatPreview){
    fatWrap.style.display = '';
    fatPreview.innerHTML = '<span style="color:var(--muted2)">Calculando gastos do período...</span>';
    // Buscar gastos do cartão no período usando a lógica de janela de datas
    const gastos = await cartaoBuscarGastos(c.qual_cartao_id, c.fatura_periodo);
    const totalGastos = gastos.reduce((a,x)=>a+Number(x.valor),0);
    const diff = Math.abs(totalGastos - Number(c.valor));
    const bate = diff < 0.01; // tolerância de 1 centavo para arredondamento
    if(!gastos.length){
      fatPreview.innerHTML = `<span style="color:var(--muted2)">Nenhum gasto em conciliação para este cartão/período.</span>`;
    } else {
      const corTotal = bate ? '#166534' : '#b91c1c';
      fatPreview.innerHTML =
        `<div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;margin-bottom:8px;color:${corTotal}">
          <span>${gastos.length} gasto${gastos.length>1?'s':''} em conciliação</span>
          <span>${fmt(totalGastos)}</span>
        </div>` +
        gastos.map(g=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border2);color:var(--text2)"><span>${g.descricao}</span><span style="font-weight:600">${fmt(g.valor)}</span></div>`).join('') +
        `<div style="margin-top:8px;padding:8px;border-radius:8px;background:${bate?'rgba(21,128,61,.08)':'rgba(220,38,38,.08)'};border:1px solid ${bate?'rgba(21,128,61,.25)':'rgba(220,38,38,.25)'}">
          ${bate
            ? `<span style="color:#166534;font-weight:600">✓ Valor bate com a fatura. Conciliação pode ser realizada.</span>`
            : `<span style="color:#b91c1c;font-weight:600">✗ Diferença de ${fmt(diff)}. Ajuste os lançamentos antes de conciliar.</span>`
          }
        </div>`;
      // Armazenar no elemento se bate ou não para bloquear na confirmação
      fatWrap.dataset.bate = bate ? '1' : '0';
    }
  } else if(fatWrap){
    fatWrap.style.display = 'none';
  }

  document.getElementById('m-conta-pagar-confirmar').classList.add('show');
}

// ══ CONFIRMAR PAGAMENTO ══
async function cpConfirmarPagamento(){
  const c = _cpPagamentoAtual;
  if(!c || c.status==='pago') return;

  const numNota   = document.getElementById('cpc-nf')?.value?.trim()||null;
  const formaPago = document.getElementById('cpc-forma-pago')?.value||c.forma_pgto||null;
  const hojeIso   = new Date().toISOString();

  // ── FATURA DE CARTÃO: concilia gastos ──
  if(c.eh_fatura_cartao && c.fatura_periodo && c.qual_cartao_id){
    // Verificar se valor bate
    const fatWrap = document.getElementById('cpc-fatura-wrap');
    if(fatWrap?.dataset.bate === '0'){
      notify('Não é possível conciliar: o valor da fatura não bate com o total dos gastos. Ajuste os lançamentos primeiro.','error');
      return;
    }
    const gastos = await cartaoBuscarGastos(c.qual_cartao_id, c.fatura_periodo);
    const totalGastos = gastos.reduce((a,x)=>a+Number(x.valor),0);
    const diff = Math.abs(totalGastos - Number(c.valor));
    if(diff >= 0.01){
      const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      notify(`Diferença de ${fmt(diff)} entre fatura e gastos. Conciliação bloqueada.`,'error');
      return;
    }
    // Concilia cada gasto: vai ao Financeiro com forma_pgto='Cartão Crédito'
    for(const g of gastos){
      const {data: lanc} = await sb.from('lancamentos').insert({
        tipo: 'despesa', categoria: g.categoria, descricao: g.descricao,
        valor: g.valor, data: hojeIso.slice(0,10),
        veiculo_id: g.veiculo_id||null,
        forma_pgto: 'Cartão Crédito', // sempre cartão crédito para os gastos
        origem: 'contas_pagar', criado_por: currentUser?.id,
      }).select().single();
      await sb.from('contas_pagar').update({
        status: 'pago', data_pagamento: hojeIso,
        lancamento_id: lanc?.id||null,
        conciliada_por: c.id,
        forma_pgto_pago: formaPago, // forma como a fatura foi paga (PIX, boleto etc)
      }).eq('id', g.id);
    }
    // Marca a fatura como paga — NÃO vai ao Financeiro
    await sb.from('contas_pagar').update({
      status: 'pago', data_pagamento: hojeIso, num_nota: numNota,
      forma_pgto_pago: formaPago,
    }).eq('id', c.id);

    closeModal('conta-pagar-confirmar');
    _cpPagamentoAtual = null;
    const n = gastos.length;
    notify(`Fatura paga! ${n} gasto${n!==1?'s':''} conciliado${n!==1?'s':''} no Financeiro com Cartão Crédito.`,'success');
    await cpCarregarContas();
    if(typeof loadContasPagar==='function') await loadContasPagar();
    if(typeof renderDashboard==='function') renderDashboard();
    return;
  }

  // ── CONTA NORMAL: cria lançamento no Financeiro ──
  const {data: lanc, error: errLanc} = await sb.from('lancamentos').insert({
    tipo: 'despesa', categoria: c.categoria, descricao: c.descricao,
    valor: c.valor, data: hojeIso.slice(0,10),
    veiculo_id: c.veiculo_id||null,
    forma_pgto: formaPago||c.forma_pgto||null, // usa a forma real de pagamento
    num_nota: numNota, origem: 'contas_pagar', criado_por: currentUser?.id,
  }).select().single();

  if(errLanc){ notify('Erro ao lançar no financeiro: '+errLanc.message,'error'); return; }

  await sb.from('contas_pagar').update({
    status: 'pago', data_pagamento: hojeIso, lancamento_id: lanc?.id||null,
    num_nota: numNota, forma_pgto_pago: formaPago,
  }).eq('id', c.id);

  if(c.recorrente){
    await sb.from('contas_pagar').insert({
      descricao: c.descricao, categoria: c.categoria, valor: c.valor,
      forma_pgto: c.forma_pgto, vencimento: _cpProximoVencimento(c.vencimento, c.recorrencia_tipo||'mensal'),
      recorrente: true, recorrencia_tipo: c.recorrencia_tipo||'mensal',
      veiculo_id: c.veiculo_id||null, conta_origem_id: c.id,
      criado_por: currentUser?.id,
    });
  }

  closeModal('conta-pagar-confirmar');
  _cpPagamentoAtual = null;
  notify('Pagamento confirmado e lançado no Financeiro!','success');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function') await loadContasPagar();
  if(typeof renderDashboard==='function') renderDashboard();
}
