// contaspagar.js — Módulo Contas a Pagar FleetPro

// ══ ESTADO ══
let _cpContas = [];
let _cpPagamentoAtual = null;
let _cpAbaCurrent = 'contas'; // 'contas' | 'historico'

// ══ ICONES SVG ══
const CP_SVG = {
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  cancel:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  gear:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

const CP_RECORRENCIA_LABEL = { semanal:'Semanal', mensal:'Mensal', anual:'Anual' };

// ══ INICIALIZAÇÃO ══
async function iniciarContasPagar(){
  if(typeof catPopularSelects==='function') await catPopularSelects();
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

// ══ FILTRO DE VENCIMENTO (Este mês / Próximo mês / Personalizado) ══
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
    .select('*,veiculos!contas_pagar_veiculo_id_fkey(marca,modelo,placa,tipo)')
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
  if(status==='pago')       filtradas = todas.filter(c=>c.status==='pago');
  else if(status==='pendente')  filtradas = todas.filter(c=>c.status==='pendente' && !_cpEstaAtrasada(c));
  else if(status==='atrasado')  filtradas = todas.filter(c=>_cpEstaAtrasada(c));

  _cpContas = filtradas;
  cpRenderContas();
  cpAtualizarCards(todas);
}

// ══ RENDERIZAR TABELA ══
function cpRenderContas(){
  const tb = document.getElementById('tb-contas-pagar');
  if(!tb) return;
  if(!_cpContas.length){
    tb.innerHTML = '<tr class="empty-row"><td colspan="9">Nenhuma conta encontrada</td></tr>';
    return;
  }
  const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  tb.innerHTML = _cpContas.map(c=>{
    const atrasada = _cpEstaAtrasada(c);
    const badge = c.status==='pago'
      ? '<span class="badge badge-green">Pago</span>'
      : atrasada
      ? '<span class="badge badge-red">Atrasado</span>'
      : '<span class="badge badge-yellow">Pendente</span>';
    const icon = (allCategoriasFinanceiras||[]).find(x=>x.nome===c.categoria)?.icone||'';
    const vei  = c.veiculos ? c.veiculos.placa : '—';
    const rec  = c.recorrente
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg3);color:var(--muted2);border:1px solid var(--border2)">${CP_RECORRENCIA_LABEL[c.recorrencia_tipo]||''}</span>`
      : '—';
    const nota = c.num_nota ? `<span style="font-size:11px;color:var(--muted)">${c.num_nota}</span>` : '—';
    // Botões de ação profissionais com SVG
    const btnPagar   = c.status!=='pago'
      ? `<button onclick="cpMarcarPago('${c.id}')" title="Marcar como pago" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:rgba(21,128,61,.12);color:#166534;border:1px solid rgba(21,128,61,.3);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">${CP_SVG.check} Pagar</button>` : '';
    const btnEditar  = `<button onclick="cpEditarConta('${c.id}')" title="Editar" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">${CP_SVG.edit}</button>`;
    const btnCancelar = c.status!=='pago'
      ? `<button onclick="cpCancelarConta('${c.id}')" title="Cancelar" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:rgba(217,119,6,.08);color:#92400e;border:1px solid rgba(217,119,6,.25);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">${CP_SVG.cancel}</button>` : '';
    const btnExcluir  = `<button onclick="cpExcluirConta('${c.id}')" title="Excluir permanentemente" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:rgba(220,38,38,.06);color:#b91c1c;border:1px solid rgba(220,38,38,.25);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">${CP_SVG.trash}</button>`;
    return `<tr>
      <td style="font-size:12px;color:${atrasada?'#b91c1c':'var(--muted)'};font-weight:${atrasada?'700':'400'}">${fmtData(c.vencimento)}</td>
      <td style="font-size:12px;font-weight:500">${c.descricao}</td>
      <td style="font-size:12px">${icon} ${c.categoria}</td>
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

  const pendentes = todas.filter(c=>c.status==='pendente' && c.vencimento>=hoje);
  const atrasadas = todas.filter(c=>c.status==='pendente' && c.vencimento<hoje);
  const pagasMes  = todas.filter(c=>c.status==='pago' && (c.data_pagamento||'').slice(0,7)===mesAtual);
  const emAberto  = todas.filter(c=>c.status==='pendente');

  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  set('cp-total-pendente', fmt(pendentes.reduce((a,c)=>a+Number(c.valor),0)));
  set('cp-total-atrasado', fmt(atrasadas.reduce((a,c)=>a+Number(c.valor),0)));
  set('cp-total-pago-mes', fmt(pagasMes.reduce((a,c)=>a+Number(c.valor),0)));
  set('cp-total-aberto',   fmt(emAberto.reduce((a,c)=>a+Number(c.valor),0)));
}

// ══ MODAL NOVA/EDITAR CONTA ══
function cpToggleRecorrencia(){
  const chk  = document.getElementById('mcp-recorrente')?.checked;
  const wrap = document.getElementById('mcp-recorrencia-wrap');
  if(wrap) wrap.style.display = chk ? '' : 'none';
}

function cpToggleFaturaCartao(){
  const chk  = document.getElementById('mcp-eh-fatura')?.checked;
  const wrap = document.getElementById('mcp-fatura-wrap');
  if(wrap) wrap.style.display = chk ? '' : 'none';
}

function cpAbrirNovaConta(){
  document.getElementById('mcp-id').value = '';
  document.getElementById('mcp-title').textContent = 'Nova Conta a Pagar';
  document.getElementById('mcp-desc').value = '';
  document.getElementById('mcp-cat').value = 'Outros';
  document.getElementById('mcp-valor').value = '';
  document.getElementById('mcp-vencimento').value = '';
  document.getElementById('mcp-forma').value = '';
  document.getElementById('mcp-vei').value = '';
  document.getElementById('mcp-recorrente').checked = false;
  document.getElementById('mcp-recorrencia-tipo').value = 'mensal';
  document.getElementById('mcp-obs').value = '';
  document.getElementById('mcp-eh-fatura').checked = false;
  const hoje = new Date();
  document.getElementById('mcp-fatura-periodo').value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  cpToggleRecorrencia();
  cpToggleFaturaCartao();
  cpPopularSelectVeiculo();
  document.getElementById('m-conta-pagar').classList.add('show');
}

function cpEditarConta(id){
  const c = _cpContas.find(x=>x.id===id);
  if(!c) return;
  cpAbrirNovaConta();
  document.getElementById('mcp-id').value = c.id;
  document.getElementById('mcp-title').textContent = 'Editar Conta a Pagar';
  document.getElementById('mcp-desc').value = c.descricao||'';
  document.getElementById('mcp-cat').value = c.categoria||'Outros';
  document.getElementById('mcp-valor').value = c.valor;
  document.getElementById('mcp-vencimento').value = c.vencimento;
  document.getElementById('mcp-forma').value = c.forma_pgto||'';
  document.getElementById('mcp-vei').value = c.veiculo_id||'';
  document.getElementById('mcp-recorrente').checked = !!c.recorrente;
  document.getElementById('mcp-recorrencia-tipo').value = c.recorrencia_tipo||'mensal';
  document.getElementById('mcp-obs').value = c.observacoes||'';
  document.getElementById('mcp-eh-fatura').checked = !!c.eh_fatura_cartao;
  if(c.fatura_periodo) document.getElementById('mcp-fatura-periodo').value = c.fatura_periodo;
  cpToggleRecorrencia();
  cpToggleFaturaCartao();
}

async function cpSalvarConta(){
  const id      = document.getElementById('mcp-id')?.value;
  const desc    = document.getElementById('mcp-desc')?.value?.trim();
  const cat     = document.getElementById('mcp-cat')?.value;
  const valor   = parseFloat(document.getElementById('mcp-valor')?.value)||0;
  const venc    = document.getElementById('mcp-vencimento')?.value;
  const forma   = document.getElementById('mcp-forma')?.value||null;
  const veiId   = document.getElementById('mcp-vei')?.value||null;
  const recorrente = document.getElementById('mcp-recorrente')?.checked||false;
  const recTipo = recorrente ? (document.getElementById('mcp-recorrencia-tipo')?.value||'mensal') : null;
  const obs     = document.getElementById('mcp-obs')?.value?.trim()||null;
  const ehFatura  = document.getElementById('mcp-eh-fatura')?.checked||false;
  const fatPeriodo = ehFatura ? (document.getElementById('mcp-fatura-periodo')?.value||null) : null;

  if(!desc || !valor || !venc || !forma){ notify('Preencha descrição, valor, vencimento e forma de pagamento','error'); return; }
  if(ehFatura && !fatPeriodo){ notify('Informe o período da fatura','error'); return; }

  const obj = {
    descricao: desc, categoria: cat, valor, vencimento: venc,
    forma_pgto: forma, veiculo_id: veiId||null,
    recorrente, recorrencia_tipo: recTipo, observacoes: obs,
    eh_fatura_cartao: ehFatura, fatura_periodo: fatPeriodo,
  };

  let error;
  if(id){ ({error} = await sb.from('contas_pagar').update(obj).eq('id',id)); }
  else   { obj.criado_por = currentUser?.id; ({error} = await sb.from('contas_pagar').insert(obj)); }
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta salva!','success');
  closeModal('conta-pagar');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function') await loadContasPagar();
  if(typeof renderDashboard==='function') renderDashboard();
}

// ══ CANCELAR CONTA (move para histórico com motivo) ══
async function cpCancelarConta(id){
  const c = _cpContas.find(x=>x.id===id);
  if(!c) return;
  const motivo = await fpPrompt('Ficará registrado no histórico.', `Cancelar "${c.descricao}"`, {placeholder:'Ex: Pago de outra forma, duplicado...'});
  if(motivo === null) return; // cancelou o prompt
  const hojeIso = new Date().toISOString();

  // Se já gerou lançamento no Financeiro, cancela lá também
  if(c.lancamento_id){
    await sb.from('lancamentos').update({
      cancelamento_motivo: motivo||'Cancelado',
      cancelado_em: hojeIso,
    }).eq('id', c.lancamento_id);
    // Remove o lançamento do financeiro
    await sb.from('lancamentos').delete().eq('id', c.lancamento_id);
  }

  const {error} = await sb.from('contas_pagar').update({
    status: 'cancelado',
    cancelamento_motivo: motivo||'Cancelado',
    cancelado_em: hojeIso,
  }).eq('id', c.id);

  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta cancelada e movida para histórico.','success');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function') await loadContasPagar();
  if(typeof renderDashboard==='function') renderDashboard();
}

// ══ EXCLUIR CONTA (remove permanentemente de todos os lugares) ══
async function cpExcluirConta(id){
  const c = _cpContas.find(x=>x.id===id);
  if(!c) return;
  if(!await fpConfirm(`Excluir permanentemente "${c.descricao}"?\n\nIsso também remove qualquer lançamento no Financeiro vinculado. Essa ação não pode ser desfeita.`, 'Excluir conta')) return;

  // Remove lançamento vinculado no Financeiro (se houver)
  if(c.lancamento_id){
    await sb.from('lancamentos').delete().eq('id', c.lancamento_id);
  }

  const {error} = await sb.from('contas_pagar').delete().eq('id',id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta excluída permanentemente.','success');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function') await loadContasPagar();
  if(typeof renderDashboard==='function') renderDashboard();
}

// ══ MARCAR COMO PAGO — abre modal de confirmação ══
async function cpMarcarPago(id){
  const c = _cpContas.find(x=>x.id===id);
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

  const fatWrap    = document.getElementById('cpc-fatura-wrap');
  const fatPreview = document.getElementById('cpc-fatura-preview');
  if(c.eh_fatura_cartao && c.fatura_periodo && fatWrap && fatPreview){
    fatWrap.style.display = '';
    fatPreview.textContent = 'Calculando gastos do período...';
    const [anoStr, mesStr] = c.fatura_periodo.split('-');
    const dataIni = `${c.fatura_periodo}-01`;
    const dataFim = new Date(parseInt(anoStr), parseInt(mesStr), 0).toISOString().slice(0,10);
    const {data: gastos} = await sb.from('contas_pagar')
      .select('id,descricao,valor,vencimento')
      .eq('forma_pgto','Cartão Crédito')
      .eq('eh_fatura_cartao', false)
      .in('status',['pendente','atrasado'])
      .gte('vencimento', dataIni)
      .lte('vencimento', dataFim);
    const lista = gastos||[];
    const totalGastos = lista.reduce((a,x)=>a+Number(x.valor),0);
    if(!lista.length){
      fatPreview.innerHTML = `<span style="color:var(--muted2)">Nenhum gasto com Cartão Crédito para ${mesStr}/${anoStr}.</span>`;
    } else {
      fatPreview.innerHTML = `<div style="margin-bottom:6px;color:var(--text2);font-weight:600">${lista.length} gasto${lista.length>1?'s':''} serão conciliados → ${fmt(totalGastos)}</div>` +
        lista.map(g=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border2);color:var(--text2)"><span>${g.descricao}</span><span style="font-weight:600">${fmt(g.valor)}</span></div>`).join('') +
        `<div style="font-size:11px;color:var(--muted2);margin-top:6px">A fatura não vai para o Financeiro. Cada gasto individual será lançado.</div>`;
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

  const numNota = document.getElementById('cpc-nf')?.value?.trim()||null;
  const hojeIso = new Date().toISOString();

  if(c.eh_fatura_cartao && c.fatura_periodo){
    const [anoStr, mesStr] = c.fatura_periodo.split('-');
    const dataIni = `${c.fatura_periodo}-01`;
    const dataFim = new Date(parseInt(anoStr), parseInt(mesStr), 0).toISOString().slice(0,10);

    const {data: gastos, error: errGastos} = await sb.from('contas_pagar')
      .select('*')
      .eq('forma_pgto','Cartão Crédito')
      .eq('eh_fatura_cartao', false)
      .in('status',['pendente','atrasado'])
      .gte('vencimento', dataIni)
      .lte('vencimento', dataFim);

    if(errGastos){ notify('Erro ao buscar gastos: '+errGastos.message,'error'); return; }

    const lista = gastos||[];
    for(const g of lista){
      const {data: lanc} = await sb.from('lancamentos').insert({
        tipo: 'despesa', categoria: g.categoria, descricao: g.descricao,
        valor: g.valor, data: hojeIso.slice(0,10),
        veiculo_id: g.veiculo_id||null, forma_pgto: 'Cartão Crédito',
        origem: 'contas_pagar', criado_por: currentUser?.id,
      }).select().single();
      await sb.from('contas_pagar').update({
        status: 'pago', data_pagamento: hojeIso,
        lancamento_id: lanc?.data?.id||null,
        conciliada_por: c.id,
      }).eq('id', g.id);
    }

    await sb.from('contas_pagar').update({
      status: 'pago', data_pagamento: hojeIso, num_nota: numNota,
    }).eq('id', c.id);

    closeModal('conta-pagar-confirmar');
    _cpPagamentoAtual = null;
    const n = lista.length;
    notify(`Fatura paga! ${n} gasto${n!==1?'s':''} conciliado${n!==1?'s':''} no Financeiro.`,'success');
    await cpCarregarContas();
    if(typeof loadContasPagar==='function') await loadContasPagar();
    if(typeof renderDashboard==='function') renderDashboard();
    return;
  }

  const {data: lanc, error: errLanc} = await sb.from('lancamentos').insert({
    tipo: 'despesa', categoria: c.categoria, descricao: c.descricao,
    valor: c.valor, data: hojeIso.slice(0,10),
    veiculo_id: c.veiculo_id||null, forma_pgto: c.forma_pgto||null,
    num_nota: numNota, origem: 'contas_pagar', criado_por: currentUser?.id,
  }).select().single();

  if(errLanc){ notify('Erro ao lançar no financeiro: '+errLanc.message,'error'); return; }

  await sb.from('contas_pagar').update({
    status: 'pago', data_pagamento: hojeIso, lancamento_id: lanc?.id||null, num_nota: numNota,
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
