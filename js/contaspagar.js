// contaspagar.js — Módulo Contas a Pagar FleetPro

// ══ ESTADO ══
let _cpContas = [];
let _cpPagamentoAtual = null;

// ══ CATEGORIAS ══
const CP_CAT_ICONES = {
  'Salários':'👥','Fornecedores':'📦','Aluguel/Imóvel':'🏢','Impostos':'🧾',
  'Assinaturas/Software':'💻','Manutenção':'🔧','Combustível':'⛽','Multa':'⚠️',
  'Seguro':'🛡️','Marketing':'📣','Outros':'📎',
};
const CP_RECORRENCIA_LABEL = { semanal:'Semanal', mensal:'Mensal', anual:'Anual' };

// ══ INICIALIZAÇÃO ══
async function iniciarContasPagar(){
  if(typeof catPopularSelects==='function') await catPopularSelects();
  cpPopularSelectVeiculo();
  await cpCarregarContas();
  cpRenderAvencer('cp-alertas');
  const btnCat = document.getElementById('cp-btn-categorias');
  if(btnCat) btnCat.style.display = currentPerfil?.perfil==='admin' ? '' : 'none';
}

// ══ CONTAS A VENCER (Dashboard + topo da aba Contas a Pagar) ══
// Usa allContasPagar (cache global, sem filtro) — o lembrete sempre mostra
// tudo, independente do filtro que a pessoa aplicou na tela.
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
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px">📅 Contas a vencer nos próximos 7 dias (${lista.length})</div>
      ${lista.map(c=>{
        const icon = (allCategoriasFinanceiras||[]).find(x=>x.nome===c.categoria)?.icone || CP_CAT_ICONES[c.categoria]||'📎';
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
  else d.setMonth(d.getMonth()+1); // mensal (padrão)
  return d.toISOString().slice(0,10);
}

// ══ POPULAR SELECT DE VEÍCULO ══
function cpPopularSelectVeiculo(){
  ['cp-filtro-veiculo','mcp-vei'].forEach(id=>{
    const sel = document.getElementById(id);
    if(!sel) return;
    const isModal = id==='mcp-vei';
    sel.innerHTML = (isModal ? '<option value="">— Nenhum —</option>' : '<option value="">Todos os veículos</option>') +
      (allVeiculos||[]).map(v=>
        `<option value="${v.id}">${v.tipo==='moto'?'🏍️':'🚗'} ${v.marca} ${v.modelo} — ${v.placa}</option>`
      ).join('');
  });
}

// ══ CARREGAR CONTAS ══
async function cpCarregarContas(){
  if(!sb) return;
  const status = document.getElementById('cp-filtro-status')?.value||'';
  const cat    = document.getElementById('cp-filtro-categoria')?.value||'';
  const veiId  = document.getElementById('cp-filtro-veiculo')?.value||'';
  const rec    = document.getElementById('cp-filtro-recorrencia')?.value||'';
  const dataIni = document.getElementById('cp-filtro-data-ini')?.value||'';
  const dataFim = document.getElementById('cp-filtro-data-fim')?.value||'';

  let query = sb.from('contas_pagar')
    .select('*,veiculos!contas_pagar_veiculo_id_fkey(marca,modelo,placa,tipo)')
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
  if(status==='pago')      filtradas = todas.filter(c=>c.status==='pago');
  else if(status==='pendente') filtradas = todas.filter(c=>c.status==='pendente' && !_cpEstaAtrasada(c));
  else if(status==='atrasado') filtradas = todas.filter(c=>_cpEstaAtrasada(c));

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
      ? '<span class="badge badge-green">✓ Pago</span>'
      : atrasada
      ? '<span class="badge badge-red">⚠️ Atrasado</span>'
      : '<span class="badge badge-yellow">Pendente</span>';
    const icon = (allCategoriasFinanceiras||[]).find(x=>x.nome===c.categoria)?.icone || CP_CAT_ICONES[c.categoria]||'📎';
    const vei  = c.veiculos ? `${c.veiculos.tipo==='moto'?'🏍️':'🚗'} ${c.veiculos.placa}` : '—';
    const rec  = c.recorrente
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg3);color:var(--muted2);border:1px solid var(--border2)">🔁 ${CP_RECORRENCIA_LABEL[c.recorrencia_tipo]||''}</span>`
      : '—';
    const nota = c.num_nota ? `<span style="font-size:11px;color:var(--muted)">${c.num_nota}</span>` : '—';
    return `<tr>
      <td style="font-size:12px;color:${atrasada?'#b91c1c':'var(--muted)'};font-weight:${atrasada?'700':'400'}">${fmtData(c.vencimento)}</td>
      <td style="font-size:12px">${c.descricao}</td>
      <td style="font-size:12px">${icon} ${c.categoria}</td>
      <td style="font-size:12px">${vei}</td>
      <td>${nota}</td>
      <td>${rec}</td>
      <td style="font-weight:700">${fmt(c.valor)}</td>
      <td>${badge}</td>
      <td>
        ${c.status!=='pago' ? `<button onclick="cpMarcarPago('${c.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--green)" title="Marcar como pago">✓</button>` : ''}
        <button onclick="cpEditarConta('${c.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted)">✏️</button>
        <button onclick="cpExcluirConta('${c.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--red)">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ══ CARDS RESUMO (sempre calculados sobre o total, ignorando filtro de status) ══
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
  document.getElementById('mcp-title').textContent = '➕ Nova Conta a Pagar';
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
  document.getElementById('mcp-title').textContent = '✏️ Editar Conta a Pagar';
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
  const id     = document.getElementById('mcp-id')?.value;
  const desc   = document.getElementById('mcp-desc')?.value?.trim();
  const cat    = document.getElementById('mcp-cat')?.value;
  const valor  = parseFloat(document.getElementById('mcp-valor')?.value)||0;
  const venc   = document.getElementById('mcp-vencimento')?.value;
  const forma  = document.getElementById('mcp-forma')?.value||null;
  const veiId  = document.getElementById('mcp-vei')?.value||null;
  const recorrente = document.getElementById('mcp-recorrente')?.checked||false;
  const recTipo = recorrente ? (document.getElementById('mcp-recorrencia-tipo')?.value||'mensal') : null;
  const obs         = document.getElementById('mcp-obs')?.value?.trim()||null;
  const ehFatura    = document.getElementById('mcp-eh-fatura')?.checked||false;
  const fatPerido   = ehFatura ? (document.getElementById('mcp-fatura-periodo')?.value||null) : null;

  if(!desc || !valor || !venc || !forma){ notify('Preencha descrição, valor, vencimento e forma de pagamento','error'); return; }
  if(ehFatura && !fatPerido){ notify('Informe o período da fatura','error'); return; }

  const obj = {
    descricao: desc, categoria: cat, valor, vencimento: venc,
    forma_pgto: forma, veiculo_id: veiId||null,
    recorrente, recorrencia_tipo: recTipo,
    observacoes: obs,
    eh_fatura_cartao: ehFatura,
    fatura_periodo: fatPerido,
  };

  let error;
  if(id){
    ({error} = await sb.from('contas_pagar').update(obj).eq('id',id));
  } else {
    obj.criado_por = currentUser?.id;
    ({error} = await sb.from('contas_pagar').insert(obj));
  }
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta salva!','success');
  closeModal('conta-pagar');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function'){ await loadContasPagar(); }
  if(typeof renderDashboard==='function') renderDashboard();
}

async function cpExcluirConta(id){
  if(!confirm('Excluir esta conta a pagar? Isso não apaga um lançamento já criado no Financeiro.')) return;
  const {error} = await sb.from('contas_pagar').delete().eq('id',id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Conta excluída','success');
  await cpCarregarContas();
  if(typeof loadContasPagar==='function'){ await loadContasPagar(); }
  if(typeof renderDashboard==='function') renderDashboard();
}

// ══ MARCAR COMO PAGO — abre modal de confirmação ══
async function cpMarcarPago(id){
  const c = _cpContas.find(x=>x.id===id);
  if(!c || c.status==='pago') return;
  _cpPagamentoAtual = c;

  const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  document.getElementById('cpc-desc').textContent  = c.descricao;
  document.getElementById('cpc-cat').textContent   = `${(allCategoriasFinanceiras||[]).find(x=>x.nome===c.categoria)?.icone || CP_CAT_ICONES[c.categoria]||'📎'} ${c.categoria}`;
  document.getElementById('cpc-venc').textContent  = fmtData(c.vencimento);
  document.getElementById('cpc-forma').textContent = c.forma_pgto || '—';
  document.getElementById('cpc-valor').textContent = fmt(c.valor);
  document.getElementById('cpc-nf').value = '';

  // Se for fatura de cartão: mostrar preview de conciliação
  const fatWrap = document.getElementById('cpc-fatura-wrap');
  const fatPreview = document.getElementById('cpc-fatura-preview');
  if(c.eh_fatura_cartao && c.fatura_periodo && fatWrap && fatPreview){
    fatWrap.style.display = '';
    fatPreview.textContent = 'Calculando gastos do período...';
    // Busca contas a pagar com Cartão Crédito no período
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
      fatPreview.innerHTML = `<span style="color:var(--muted2)">Nenhum gasto com Cartão Crédito encontrado para ${mesStr}/${anoStr}.</span>`;
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

  // ── FATURA DE CARTÃO: concilia gastos, não lança a fatura no Financeiro ──
  if(c.eh_fatura_cartao && c.fatura_periodo){
    const [anoStr, mesStr] = c.fatura_periodo.split('-');
    const dataIni = `${c.fatura_periodo}-01`;
    const dataFim = new Date(parseInt(anoStr), parseInt(mesStr), 0).toISOString().slice(0,10);

    // Busca todos os gastos de cartão do período ainda não conciliados
    const {data: gastos, error: errGastos} = await sb.from('contas_pagar')
      .select('*')
      .eq('forma_pgto','Cartão Crédito')
      .eq('eh_fatura_cartao', false)
      .in('status',['pendente','atrasado'])
      .gte('vencimento', dataIni)
      .lte('vencimento', dataFim);

    if(errGastos){ notify('Erro ao buscar gastos: '+errGastos.message,'error'); return; }

    // Para cada gasto: cria lançamento individual no Financeiro e marca como pago
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

    // Marca a fatura como paga (SEM criar lançamento no Financeiro)
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

  // ── CONTA NORMAL: cria lançamento no Financeiro ──
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

  // Se é recorrente, gera a próxima
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
