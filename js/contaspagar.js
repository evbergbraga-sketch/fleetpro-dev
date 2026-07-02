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
  cpPopularSelectVeiculo();
  await cpCarregarContas();
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
    .select('*,veiculos(marca,modelo,placa,tipo)')
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
    const icon = CP_CAT_ICONES[c.categoria]||'📎';
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
  cpToggleRecorrencia();
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
  cpToggleRecorrencia();
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
  const obs    = document.getElementById('mcp-obs')?.value?.trim()||null;

  if(!desc || !valor || !venc || !forma){ notify('Preencha descrição, valor, vencimento e forma de pagamento','error'); return; }

  const obj = {
    descricao: desc, categoria: cat, valor, vencimento: venc,
    forma_pgto: forma, veiculo_id: veiId||null,
    recorrente, recorrencia_tipo: recTipo,
    observacoes: obs,
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
function cpMarcarPago(id){
  const c = _cpContas.find(x=>x.id===id);
  if(!c || c.status==='pago') return;
  _cpPagamentoAtual = c;

  const fmt = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  document.getElementById('cpc-desc').textContent  = c.descricao;
  document.getElementById('cpc-cat').textContent   = `${CP_CAT_ICONES[c.categoria]||'📎'} ${c.categoria}`;
  document.getElementById('cpc-venc').textContent  = fmtData(c.vencimento);
  document.getElementById('cpc-forma').textContent = c.forma_pgto || '—';
  document.getElementById('cpc-valor').textContent = fmt(c.valor);
  document.getElementById('cpc-nf').value = '';

  document.getElementById('m-conta-pagar-confirmar').classList.add('show');
}

// ══ CONFIRMAR PAGAMENTO — lança no Financeiro + gera próxima (se recorrente) ══
async function cpConfirmarPagamento(){
  const c = _cpPagamentoAtual;
  if(!c || c.status==='pago') return;

  const numNota = document.getElementById('cpc-nf')?.value?.trim()||null;
  const hojeIso = new Date().toISOString();

  // 1) Cria o lançamento de despesa no Financeiro
  const {data: lanc, error: errLanc} = await sb.from('lancamentos').insert({
    tipo: 'despesa',
    categoria: c.categoria,
    descricao: c.descricao,
    valor: c.valor,
    data: hojeIso.slice(0,10),
    veiculo_id: c.veiculo_id||null,
    forma_pgto: c.forma_pgto||null,
    num_nota: numNota,
    origem: 'contas_pagar',
    criado_por: currentUser?.id,
  }).select().single();

  if(errLanc){ notify('Erro ao lançar no financeiro: '+errLanc.message,'error'); return; }

  // 2) Marca a conta como paga, vincula o lançamento e grava a nota
  const {error: errUpd} = await sb.from('contas_pagar').update({
    status: 'pago', data_pagamento: hojeIso, lancamento_id: lanc?.id||null, num_nota: numNota,
  }).eq('id', c.id);

  if(errUpd){ notify('Erro ao atualizar conta: '+errUpd.message,'error'); return; }

  // 3) Se é recorrente, gera automaticamente a próxima conta
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
  if(typeof loadContasPagar==='function'){ await loadContasPagar(); }
  if(typeof renderDashboard==='function') renderDashboard();
}
