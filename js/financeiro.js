// financeiro.js — Módulo Financeiro FleetPro

// ══ ESTADO ══
let _finLancamentos = [];
let _finLancamentosTudo = []; // todos os lançamentos (sem filtro), p/ saldo total acumulado
let _finVeiculoSel = null;

// ══ CATEGORIAS ══
const FIN_CORES = {
  receita: { bg:'rgba(22,163,74,.1)', border:'rgba(22,163,74,.3)', text:'#16a34a', badge:'badge-green' },
  despesa: { bg:'rgba(220,38,38,.1)', border:'rgba(220,38,38,.3)', text:'#dc2626', badge:'badge-red'  },
};
const FIN_CAT_ICONES = {
  'Aluguel':'🚗','Manutenção':'🔧','Seguro':'🛡️','IPVA':'📋',
  'Combustível':'⛽','Multa':'⚠️','Caução':'🔒','Outros':'📎',
  'Salários':'👥','Fornecedores':'📦','Aluguel/Imóvel':'🏢','Impostos':'🧾',
  'Assinaturas/Software':'💻','Marketing':'📣',
};

// ══ INICIALIZAÇÃO ══
async function iniciarFinanceiro(){
  if(typeof catPopularSelects==='function') await catPopularSelects();
  await _finCarregarTotaisGerais();
  await finCarregarLancamentos();
  finPopularSelectVeiculos();
  await finRenderSeguros();
  await finRenderIpva();
  document.getElementById('fin-chart-btn-tempo')?.classList.add('btn-primary');
  _finTab('fluxo');
}

// ══ ABAS ══
function _finTab(tab){
  ['fluxo','veiculo','seguros','ipva'].forEach(t=>{
    const p = document.getElementById('fin-painel-'+t);
    const b = document.getElementById('fin-tab-'+t);
    if(p) p.style.display = t===tab ? '' : 'none';
    if(b){
      b.style.color       = t===tab ? 'var(--accent)' : 'var(--muted)';
      b.style.borderBottomColor = t===tab ? 'var(--accent)' : 'transparent';
      b.style.fontWeight  = t===tab ? '700' : '600';
    }
  });
  if(tab==='veiculo') finPopularSelectVeiculos();
}

// ══ POPULAR SELECTS DE VEÍCULO ══
function finPopularSelectVeiculos(){
  const ids = ['fin-filtro-veiculo','fin-vei-sel','mlc-vei'];
  ids.forEach(id=>{
    const sel = document.getElementById(id);
    if(!sel) return;
    const isModal = id==='mlc-vei';
    sel.innerHTML = (isModal ? '<option value="">— Nenhum —</option>' : '<option value="">Todos os veículos</option>') +
      (allVeiculos||[]).map(v=>
        `<option value="${v.id}">${v.tipo==='moto'?'🏍️':'🚗'} ${v.marca} ${v.modelo} — ${v.placa}</option>`
      ).join('');
  });
}

// ══ CARREGAR LANÇAMENTOS ══
// ══ TOTAIS GERAIS (saldo acumulado, independente do filtro) ══
async function _finCarregarTotaisGerais(){
  try{
    const {data} = await sb.from('lancamentos').select('tipo,valor').limit(5000);
    _finLancamentosTudo = data||[];
  }catch(e){ console.warn('[fin/totais]', e.message); _finLancamentosTudo = []; }
}

async function finCarregarLancamentos(){
  if(!sb) return;
  const periodo = document.getElementById('fin-filtro-periodo')?.value||'mes';
  const tipo    = document.getElementById('fin-filtro-tipo')?.value||'';
  const cat     = document.getElementById('fin-filtro-cat')?.value||'';
  const veiId   = document.getElementById('fin-filtro-veiculo')?.value||'';
  const forma   = document.getElementById('fin-filtro-forma')?.value||'';

  const {dataInicio, dataFim} = _finCalcPeriodo(periodo);

  let query = sb.from('lancamentos')
    .select('*,veiculos(marca,modelo,placa,tipo)')
    .order('data',{ascending:false})
    .limit(500);

  if(dataInicio) query = query.gte('data', dataInicio);
  if(dataFim)    query = query.lte('data', dataFim);
  if(tipo)       query = query.eq('tipo', tipo);
  if(cat)        query = query.eq('categoria', cat);
  if(veiId)      query = query.eq('veiculo_id', veiId);
  if(forma)      query = query.eq('forma_pgto', forma);

  const {data, error} = await query;
  if(error){ console.warn('[fin]', error.message); return; }
  _finLancamentos = data||[];

  finRenderLancamentos();
  finAtualizarCards();
  _finAtualizarLabelPeriodo(periodo);
  _finRenderChart();
}

// ══ LABEL DINÂMICO DOS CARDS ══
function _finAtualizarLabelPeriodo(periodo){
  const labels = {
    semana: 'da semana', mes: 'do mês', trimestre: 'do trimestre',
    semestre: 'do semestre', ano: 'do ano', tudo: 'total', personalizado: 'do período',
  };
  const txt = labels[periodo] || 'do período';
  ['fin-label-periodo-1','fin-label-periodo-2','fin-label-periodo-3'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = txt;
  });
}

// ══ CÁLCULO DO PERÍODO SELECIONADO ══
function _finCalcPeriodo(periodo){
  const hoje = new Date();
  let dataInicio = null, dataFim = null;

  if(periodo==='semana'){
    // Início da semana (domingo)
    const diaSemana = hoje.getDay();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - diaSemana);
    dataInicio = inicio.toISOString().slice(0,10);
  } else if(periodo==='mes'){
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
  } else if(periodo==='trimestre'){
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth()-2, 1).toISOString().slice(0,10);
  } else if(periodo==='semestre'){
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth()-5, 1).toISOString().slice(0,10);
  } else if(periodo==='ano'){
    dataInicio = new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0,10);
  } else if(periodo==='personalizado'){
    dataInicio = document.getElementById('fin-filtro-data-ini')?.value||null;
    dataFim    = document.getElementById('fin-filtro-data-fim')?.value||null;
  }
  // 'tudo' → dataInicio e dataFim ficam null

  return {dataInicio, dataFim};
}

// ══ MOSTRA/ESCONDE CAMPOS DE DATA PERSONALIZADA ══
function _finPeriodoChange(){
  const periodo = document.getElementById('fin-filtro-periodo')?.value||'mes';
  const isPersonalizado = periodo==='personalizado';
  ['fin-filtro-data-ini','fin-filtro-data-sep','fin-filtro-data-fim'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = isPersonalizado ? '' : 'none';
  });
  if(!isPersonalizado) finCarregarLancamentos();
}

// ══ GRÁFICO RECEITAS X DESPESAS ══
let _finChart = null;
let _finChartModoAtual = 'tempo';

function _finChartModo(modo){
  _finChartModoAtual = modo;
  ['fin-chart-btn-cat','fin-chart-btn-tempo'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.remove('btn-primary');
  });
  const ativoId = modo==='categoria' ? 'fin-chart-btn-cat' : 'fin-chart-btn-tempo';
  document.getElementById(ativoId)?.classList.add('btn-primary');
  _finRenderChart();
}

function _finRenderChart(){
  const canvas = document.getElementById('fin-chart');
  if(!canvas || typeof Chart==='undefined') return;

  let labels, receitas, despesas;

  if(_finChartModoAtual==='categoria'){
    // Agrupa por categoria
    const mapaCat = {};
    _finLancamentos.forEach(l=>{
      const cat = l.categoria||'Outros';
      if(!mapaCat[cat]) mapaCat[cat] = {receita:0, despesa:0};
      mapaCat[cat][l.tipo] = (mapaCat[cat][l.tipo]||0) + Number(l.valor);
    });
    labels = Object.keys(mapaCat);
    receitas = labels.map(c=>mapaCat[c].receita||0);
    despesas = labels.map(c=>mapaCat[c].despesa||0);
  } else {
    // Agrupa por mês (AAAA-MM)
    const mapaMes = {};
    _finLancamentos.forEach(l=>{
      const mes = (l.data||'').slice(0,7);
      if(!mes) return;
      if(!mapaMes[mes]) mapaMes[mes] = {receita:0, despesa:0};
      mapaMes[mes][l.tipo] = (mapaMes[mes][l.tipo]||0) + Number(l.valor);
    });
    const meses = Object.keys(mapaMes).sort();
    labels = meses.map(m=>{
      const [ano,mes] = m.split('-');
      const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      return `${nomesMes[parseInt(mes)-1]}/${ano.slice(2)}`;
    });
    receitas = meses.map(m=>mapaMes[m].receita||0);
    despesas = meses.map(m=>mapaMes[m].despesa||0);
  }

  if(_finChart) _finChart.destroy();
  _finChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Receitas', data:receitas, backgroundColor:'rgba(22,163,74,.7)', borderRadius:4 },
        { label:'Despesas', data:despesas, backgroundColor:'rgba(220,38,38,.7)', borderRadius:4 },
      ],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{ label: ctx => `${ctx.dataset.label}: R$ ${ctx.parsed.y.toLocaleString('pt-BR',{minimumFractionDigits:2})}` }},
      },
      scales:{
        y:{ ticks:{ callback: v => 'R$ '+v.toLocaleString('pt-BR') } },
        x:{ ticks:{ font:{size:10} } },
      },
    },
  });
}



// ══ RENDERIZAR TABELA ══
function finRenderLancamentos(){
  const tb = document.getElementById('tb-lancamentos');
  if(!tb) return;
  if(!_finLancamentos.length){
    tb.innerHTML='<tr class="empty-row"><td colspan="9">Nenhum lançamento encontrado</td></tr>';
    return;
  }
  tb.innerHTML = _finLancamentos.map(l=>{
    const cor  = FIN_CORES[l.tipo];
    const icon = (allCategoriasFinanceiras||[]).find(x=>x.nome===l.categoria)?.icone || FIN_CAT_ICONES[l.categoria]||'📎';
    const vei  = l.veiculos ? `${l.veiculos.tipo==='moto'?'🏍️':'🚗'} ${l.veiculos.placa}` : '—';
    const val  = Number(l.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const forma = l.forma_pgto ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg3);color:var(--muted2);border:1px solid var(--border2)">${l.forma_pgto}</span>` : '—';
    const nota  = l.num_nota ? `<span style="font-size:11px;color:var(--muted)">${l.num_nota}</span>` : '—';
    return `<tr>
      <td style="font-size:12px;color:var(--muted)">${l.data?.split('-').reverse().join('/')}</td>
      <td><span style="font-size:11px;padding:3px 8px;border-radius:99px;background:${cor.bg};color:${cor.text};border:1px solid ${cor.border};font-weight:700">${l.tipo==='receita'?'Receita':'Despesa'}</span></td>
      <td style="font-size:12px">${icon} ${l.categoria}</td>
      <td style="font-size:12px">${l.descricao||'—'}</td>
      <td>${forma}</td>
      <td style="font-size:12px">${nota}</td>
      <td style="font-size:12px">${vei}</td>
      <td style="font-weight:700;color:${cor.text}">${l.tipo==='receita'?'+':'−'} ${val}</td>
      <td>
        ${l.origem==='manual'?`<button onclick="finEditarLancamento('${l.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted)">✏️</button>
        <button onclick="finExcluirLancamento('${l.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--red)">🗑️</button>`
        :'<span style="font-size:10px;color:var(--muted2)">auto</span>'}
      </td>
    </tr>`;
  }).join('');
}

// ══ CARDS RESUMO ══
function finAtualizarCards(){
  // Receita/Despesa/Saldo do PERÍODO selecionado (já filtrado em _finLancamentos)
  const receitaMes  = _finLancamentos.filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0);
  const despesaMes  = _finLancamentos.filter(l=>l.tipo==='despesa').reduce((a,l)=>a+Number(l.valor),0);
  const saldoMes    = receitaMes - despesaMes;

  // Saldo acumulado (todos os lançamentos, sem filtro de período/categoria/veículo)
  const totalRec = (_finLancamentosTudo||_finLancamentos).filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0);
  const totalDes = (_finLancamentosTudo||_finLancamentos).filter(l=>l.tipo==='despesa').reduce((a,l)=>a+Number(l.valor),0);

  const fmt = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const el = id => document.getElementById(id);

  if(el('fin-receita-mes'))  el('fin-receita-mes').textContent  = fmt(receitaMes);
  if(el('fin-despesa-mes'))  el('fin-despesa-mes').textContent  = fmt(despesaMes);
  if(el('fin-saldo-mes')){
    el('fin-saldo-mes').textContent = fmt(saldoMes);
    el('fin-saldo-mes').style.color = saldoMes >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if(el('fin-saldo-total')){
    const st = totalRec - totalDes;
    el('fin-saldo-total').textContent = fmt(st);
    el('fin-saldo-total').style.color = st >= 0 ? 'var(--accent)' : 'var(--red)';
  }
}

// ══ POR VEÍCULO ══
async function finCarregarVeiculo(){
  const veiId = document.getElementById('fin-vei-sel')?.value;
  const body  = document.getElementById('fin-veiculo-body');
  if(!veiId||!body){ if(body) body.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted2)">Selecione um veículo</div>'; return; }

  body.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted2)">⏳ Carregando...</div>';
  const v = allVeiculos.find(x=>x.id===veiId);

  const {data:lans} = await sb.from('lancamentos')
    .select('*').eq('veiculo_id',veiId).order('data',{ascending:false}).limit(200);

  const receitas  = (lans||[]).filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0);
  const despesas  = (lans||[]).filter(l=>l.tipo==='despesa').reduce((a,l)=>a+Number(l.valor),0);
  const lucro     = receitas - despesas;
  const fmt = val => val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  const rows = (lans||[]).map(l=>{
    const cor = FIN_CORES[l.tipo];
    return `<tr>
      <td style="font-size:12px;color:var(--muted)">${l.data?.split('-').reverse().join('/')}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${cor.bg};color:${cor.text};border:1px solid ${cor.border}">${l.tipo==='receita'?'💚':'🔴'} ${l.tipo}</span></td>
      <td style="font-size:12px">${FIN_CAT_ICONES[l.categoria]||''} ${l.categoria}</td>
      <td style="font-size:12px">${l.descricao||'—'}</td>
      <td style="font-weight:700;color:${cor.text}">${l.tipo==='receita'?'+':'−'} ${fmt(Number(l.valor))}</td>
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted2);margin-bottom:4px">Receitas</div>
        <div style="font-size:20px;font-weight:800;color:var(--green)">${fmt(receitas)}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted2);margin-bottom:4px">Despesas</div>
        <div style="font-size:20px;font-weight:800;color:var(--red)">${fmt(despesas)}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted2);margin-bottom:4px">Lucro</div>
        <div style="font-size:20px;font-weight:800;color:${lucro>=0?'var(--accent)':'var(--red)'}">${fmt(lucro)}</div>
      </div>
    </div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>${rows||'<tr class="empty-row"><td colspan="5">Nenhum lançamento</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ══ SEGUROS ══
async function finRenderSeguros(){
  const tb = document.getElementById('tb-seguros');
  if(!tb) return;
  const veiculos = allVeiculos||[];
  const hoje = new Date();

  const perLabel = {mensal:'Mensal',trimestral:'Trimestral',semestral:'Semestral',anual:'Anual'};
  const rows = veiculos.map(v=>{
    if(!v.seguro_vencimento && !v.seguradora) return null;
    const venc = v.seguro_vencimento ? new Date(v.seguro_vencimento) : null;
    const dias = venc ? Math.ceil((venc - hoje)/86400000) : null;
    let badge = '<span class="badge badge-gray">Sem data</span>';
    if(dias !== null){
      badge = dias < 0
        ? '<span class="badge badge-red">⚠️ Vencido</span>'
        : dias <= 30
        ? `<span class="badge badge-yellow">⚡ ${dias}d</span>`
        : `<span class="badge badge-green">✓ ${dias}d</span>`;
    }
    const tipo = v.tipo==='moto'?'🏍️':'🚗';
    const valFmt = v.seguro_valor ? Number(v.seguro_valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '—';
    const per = v.seguro_periodicidade ? perLabel[v.seguro_periodicidade]||v.seguro_periodicidade : '—';
    return `<tr>
      <td>${tipo} ${v.marca} ${v.modelo}</td>
      <td>${v.placa||'—'}</td>
      <td>${v.seguradora||'—'}</td>
      <td>${v.apolice||'—'}</td>
      <td style="font-weight:600;color:var(--green)">${valFmt}</td>
      <td>${per}</td>
      <td>${venc ? venc.toLocaleDateString('pt-BR') : '—'}</td>
      <td>${badge}</td>
      <td><button onclick="goPage('carros')" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--accent)">✏️</button></td>
    </tr>`;
  }).filter(Boolean);

  tb.innerHTML = rows.length
    ? rows.join('')
    : '<tr class="empty-row"><td colspan="7">Nenhum seguro cadastrado</td></tr>';
}

// ══ IPVA ══
async function finRenderIpva(){
  const tb = document.getElementById('tb-ipva');
  if(!tb) return;
  const veiculos = allVeiculos||[];
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const rows = [];

  veiculos.forEach(v=>{
    let ipvas = [];
    try{ ipvas = v.ipvas ? JSON.parse(v.ipvas) : []; }catch(_){}
    // Se não tem IPVA cadastrado, mostra linha com status pendente
    if(!ipvas.length){
      rows.push(`<tr>
        <td>${v.tipo==='moto'?'🏍️':'🚗'} ${v.marca} ${v.modelo}</td>
        <td>${v.placa||'—'}</td>
        <td>${anoAtual}</td>
        <td>—</td><td>—</td>
        <td><span class="badge badge-gray">Não informado</span></td>
        <td></td>
      </tr>`);
      return;
    }
    ipvas.forEach(ip=>{
      const venc = ip.vencimento ? new Date(ip.vencimento) : null;
      const dias = venc ? Math.ceil((venc - hoje)/86400000) : null;
      let badge = '<span class="badge badge-gray">—</span>';
      if(ip.pago){
        badge = '<span class="badge badge-green">✓ Pago</span>';
      } else if(dias !== null){
        badge = dias < 0
          ? '<span class="badge badge-red">⚠️ Vencido</span>'
          : dias <= 30
          ? `<span class="badge badge-yellow">⚡ ${dias}d</span>`
          : `<span class="badge badge-blue">Pendente</span>`;
      }
      const val = ip.valor ? Number(ip.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '—';
      rows.push(`<tr>
        <td>${v.tipo==='moto'?'🏍️':'🚗'} ${v.marca} ${v.modelo}</td>
        <td>${v.placa||'—'}</td>
        <td>${ip.ano||anoAtual}</td>
        <td>${val}</td>
        <td>${venc?venc.toLocaleDateString('pt-BR'):'—'}</td>
        <td>${badge}</td>
        <td></td>
      </tr>`);
    });
  });

  tb.innerHTML = rows.length
    ? rows.join('')
    : '<tr class="empty-row"><td colspan="7">Nenhum IPVA cadastrado</td></tr>';
}

// ══ MODAL NOVO LANÇAMENTO ══
function finAbrirNovoLancamento(){
  document.getElementById('mlc-id').value = '';
  document.getElementById('mlc-title').textContent = '➕ Novo Lançamento';
  document.getElementById('mlc-tipo').value  = 'receita';
  document.getElementById('mlc-cat').value   = 'Aluguel';
  document.getElementById('mlc-desc').value  = '';
  document.getElementById('mlc-valor').value = '';
  const hoje = new Date(); hoje.setMinutes(hoje.getMinutes()-hoje.getTimezoneOffset());
  document.getElementById('mlc-data').value  = hoje.toISOString().slice(0,10);
  document.getElementById('mlc-vei').value   = '';
  finPopularSelectVeiculos();
  document.getElementById('m-lancamento').classList.add('show');
}

async function finEditarLancamento(id){
  const l = _finLancamentos.find(x=>x.id===id);
  if(!l) return;
  finAbrirNovoLancamento();
  document.getElementById('mlc-id').value    = l.id;
  document.getElementById('mlc-title').textContent = '✏️ Editar Lançamento';
  document.getElementById('mlc-tipo').value  = l.tipo;
  document.getElementById('mlc-cat').value   = l.categoria;
  document.getElementById('mlc-desc').value  = l.descricao||'';
  document.getElementById('mlc-valor').value = l.valor;
  document.getElementById('mlc-data').value  = l.data;
  document.getElementById('mlc-vei').value   = l.veiculo_id||'';
  const elForma = document.getElementById('mlc-forma');
  if(elForma) elForma.value = l.forma_pgto||'';
  const elNota = document.getElementById('mlc-nota');
  if(elNota) elNota.value = l.num_nota||'';
}

async function finSalvarLancamento(){
  const id     = document.getElementById('mlc-id')?.value;
  const tipo   = document.getElementById('mlc-tipo')?.value;
  const cat    = document.getElementById('mlc-cat')?.value;
  const desc   = document.getElementById('mlc-desc')?.value?.trim();
  const valor  = parseFloat(document.getElementById('mlc-valor')?.value)||0;
  const data   = document.getElementById('mlc-data')?.value;
  const veiId  = document.getElementById('mlc-vei')?.value||null;
  const forma  = document.getElementById('mlc-forma')?.value||null;
  const nota   = document.getElementById('mlc-nota')?.value?.trim()||null;

  if(!valor || !data){ notify('Preencha valor e data','error'); return; }

  const obj = { tipo, categoria:cat, descricao:desc||null, valor, data,
    veiculo_id:veiId, origem:'manual', criado_por:currentUser?.id,
    forma_pgto: forma||null, num_nota: nota||null };

  let error;
  if(id){
    ({error} = await sb.from('lancamentos').update(obj).eq('id',id));
  } else {
    ({error} = await sb.from('lancamentos').insert(obj));
  }
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Lançamento salvo!','success');
  closeModal('lancamento');
  await finCarregarLancamentos();
}

// ══ EXCLUIR LANÇAMENTO COM SEGURANÇA ══
// Zera todas as FK que apontam para o lançamento antes de deletar,
// evitando erro 409 (Conflict) do PostgreSQL com NO ACTION constraint.
async function _deletarLancamentoSeguro(lancId){
  if(!lancId) return;
  // Zera referências em contas_pagar
  await sb.from('contas_pagar').update({lancamento_id: null}).eq('lancamento_id', lancId);
  // Zera referências em cobrancas_semanais
  await sb.from('cobrancas_semanais').update({lancamento_id: null}).eq('lancamento_id', lancId);
  // Agora pode deletar com segurança
  return sb.from('lancamentos').delete().eq('id', lancId);
}

async function finExcluirLancamento(id){
  if(!await fpConfirm('Excluir este lançamento? Essa ação não pode ser desfeita.', 'Excluir lançamento')) return;
  const {error} = await _deletarLancamentoSeguro(id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Lançamento excluído','success');
  await finCarregarLancamentos();
}

// ══ ASAAS — ASSINATURA RECORRENTE (via n8n) ══
async function criarAssinaturaAsaas(locacao){
  if(!sb||!locacao?.plano_moto) return;
  try{
    const c = allClientes.find(x=>x.id===locacao.cliente_id);
    if(!c) return;

    const bridge = (window.FP_CONFIG?.bridgeUrl || 'https://bridge.ruahsystems.com.br').replace(/\/$/,'');
    const valorSemanal = parseFloat(locacao.plano_moto)||0;
    const totalSemanas = valorSemanal === 399.90 ? 156 : 52;
    const planoNome = valorSemanal === 399.90 ? 'Plano Conquista 36m' : 'Plano 12 meses';
    const primeiraIncluida = locacao.primeira_semana_incluida !== false;

    // Promoção "1ª semana grátis": todo o cronograma desliza +7 dias
    let dataFimAjustada = locacao.data_fim?.slice(0,10);
    if(!primeiraIncluida && dataFimAjustada){
      const df = new Date(dataFimAjustada+'T00:00:00');
      df.setDate(df.getDate()+7);
      dataFimAjustada = df.toISOString().slice(0,10);
    }

    const resp = await fetch(bridge + '/api/asaas/criar-assinatura', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        locacao_id: locacao.id,
        num_contrato: locacao.num_contrato||null,
        cliente: {
          nome:     c.nome,
          cpf:      c.cpf,
          email:    _primeiroEmail(c),
          telefone: _primeiroTelefone(c),
        },
        plano: {
          valor: valorSemanal,
          ciclo: 'WEEKLY',
          descricao: `${planoNome} — Locação Moto`,
        },
        data_inicio: locacao.data_inicio?.slice(0,10),
        data_fim: dataFimAjustada,
        primeira_semana_incluida: primeiraIncluida,
      })
    });

    if(!resp.ok) throw new Error('Bridge respondeu '+resp.status);
    const result = await resp.json();

    if(result.asaas_customer_id || result.asaas_subscription_id){
      await sb.from('locacoes').update({
        asaas_customer_id:     result.asaas_customer_id||null,
        asaas_subscription_id: result.asaas_subscription_id||null,
      }).eq('id', locacao.id);
      console.log('[asaas] assinatura criada:', result.asaas_subscription_id);
    }
  }catch(e){ console.warn('[asaas] criarAssinaturaAsaas:', e.message); }
}

// ══ LANÇAMENTO AUTOMÁTICO (chamado ao registrar locação) ══
async function finRegistrarLancamentoLocacao(locacao){
  if(!sb||!locacao) return;
  try{
    const v = allVeiculos.find(x=>x.id===locacao.veiculo_id);
    const c = allClientes.find(x=>x.id===locacao.cliente_id);
    const descBase = `Contrato #${locacao.num_contrato||''} — ${c?.nome||'Cliente'} — ${v?.placa||''}`;
    const dataBase = locacao.data_inicio?.slice(0,10)||new Date().toISOString().slice(0,10);

    // ── PLANO DE ASSINATURA MOTO (12m ou Conquista 36m) ──
    if(locacao.plano_moto){
      const valorSemanal = parseFloat(locacao.plano_moto)||0;
      const totalSemanas = valorSemanal === 399.90 ? 156 : 52; // Conquista 36m = 156, 12m = 52
      const primeiraIncluida = locacao.primeira_semana_incluida !== false;

      // 1) Lançamento da CAUÇÃO (se houver)
      if(locacao.caucao && parseFloat(locacao.caucao) > 0){
        await sb.from('lancamentos').insert({
          tipo:        'receita',
          categoria:   'Caução',
          descricao:   `Caução — ${descBase}`,
          valor:       parseFloat(locacao.caucao),
          data:        dataBase,
          veiculo_id:  locacao.veiculo_id||null,
          locacao_id:  locacao.id||null,
          origem:      'automatico',
          criado_por:  currentUser?.id,
          forma_pgto:  locacao.forma_pgto_caucao||locacao.forma_pgto||null,
          num_contrato: locacao.num_contrato ? String(locacao.num_contrato) : null,
        });
      }

      // 2) Gera as cobranças semanais (cronograma completo)
      const cobrancas = [];
      const offsetDias = primeiraIncluida ? 0 : 7; // promoção "1ª semana grátis" empurra todo o cronograma
      for(let i=1; i<=totalSemanas; i++){
        const venc = new Date(dataBase+'T00:00:00');
        venc.setDate(venc.getDate() + offsetDias + (i-1)*7);
        cobrancas.push({
          locacao_id: locacao.id,
          numero_semana: i,
          data_vencimento: venc.toISOString().slice(0,10),
          valor: valorSemanal,
          status: (i===1 && primeiraIncluida) ? 'pago' : 'pendente',
          data_pagamento: (i===1 && primeiraIncluida) ? new Date().toISOString() : null,
        });
      }
      const {data:cobrancasInseridas, error: errCobr} = await sb.from('cobrancas_semanais').insert(cobrancas).select();
      if(errCobr) console.warn('[fin] cobrancas_semanais:', errCobr.message);

      // 3) Se a 1ª semana está incluída, lança no financeiro e vincula
      if(primeiraIncluida){
        const {data:lancSemana1} = await sb.from('lancamentos').insert({
          tipo:        'receita',
          categoria:   'Aluguel',
          descricao:   `${descBase} — Semana 1/${totalSemanas}`,
          valor:       valorSemanal,
          data:        dataBase,
          veiculo_id:  locacao.veiculo_id||null,
          locacao_id:  locacao.id||null,
          origem:      'automatico',
          criado_por:  currentUser?.id,
          forma_pgto:  locacao.forma_pgto||null,
          num_contrato: locacao.num_contrato ? String(locacao.num_contrato) : null,
        }).select().single();

        const semana1 = (cobrancasInseridas||[]).find(c=>c.numero_semana===1);
        if(semana1 && lancSemana1){
          await sb.from('cobrancas_semanais').update({lancamento_id: lancSemana1.id}).eq('id', semana1.id);
        }
      }
      return;
    }

    // ── LOCAÇÃO PADRÃO (carro / diária) ──
    const valorPagoAto = parseFloat(locacao.valor_pago_ato)||0;

    // Só lança se pagou algo no ato — o restante será lançado na devolução
    if(valorPagoAto <= 0) return;

    // Se dividiu em 2 formas de pagamento no ato
    const valorPgto2 = parseFloat(locacao.valor_pgto_2)||0;
    const formaPgto2 = locacao.forma_pgto_2||null;

    // 1ª forma — valor principal
    const valor1 = valorPgto2 > 0 ? (valorPagoAto - valorPgto2) : valorPagoAto;
    if(valor1 > 0){
      await sb.from('lancamentos').insert({
        tipo:        'receita',
        categoria:   'Aluguel',
        descricao:   descBase + (valorPgto2>0 ? ' — Pag. no ato (1ª forma)' : ' — Pagamento no ato'),
        valor:       valor1,
        data:        dataBase,
        veiculo_id:  locacao.veiculo_id||null,
        locacao_id:  locacao.id||null,
        forma_pgto:  locacao.forma_pgto||null,
        num_contrato: locacao.num_contrato ? String(locacao.num_contrato) : null,
        origem:      'automatico',
        criado_por:  currentUser?.id,
      });
    }

    // 2ª forma (se dividiu)
    if(valorPgto2 > 0 && formaPgto2){
      await sb.from('lancamentos').insert({
        tipo:        'receita',
        categoria:   'Aluguel',
        descricao:   descBase + ' — Pag. no ato (2ª forma)',
        valor:       valorPgto2,
        data:        dataBase,
        veiculo_id:  locacao.veiculo_id||null,
        locacao_id:  locacao.id||null,
        forma_pgto:  formaPgto2,
        num_contrato: locacao.num_contrato ? String(locacao.num_contrato) : null,
        origem:      'automatico',
        criado_por:  currentUser?.id,
      });
    }
  }catch(e){ console.warn('[fin] lancamento auto:', e.message); }
}

// ══ EXPORTAR PDF ══
async function finExportarPdf(){
  const {jsPDF} = window.jspdf;
  if(!jsPDF){ notify('jsPDF não carregado','error'); return; }
  const doc = new jsPDF({unit:'mm',format:'a4'});
  const PW=210, M=14, CW=PW-M*2;

  const txt=(t,x,y,o={})=>{
    doc.setFontSize(o.size||10);
    doc.setFont('helvetica', o.bold?'bold':'normal');
    doc.setTextColor(o.color||'#1a1a1a');
    doc.text(String(t),x,y,{align:o.align||'left'});
  };
  const rect=(x,y,w,h,fill,stroke)=>{
    doc.setFillColor(fill||'#ffffff');
    doc.setDrawColor(stroke||'#cccccc');
    doc.rect(x,y,w,h,'FD');
  };

  let y=M;
  // Header
  rect(0,0,PW,18,'#1a1a2e','#1a1a2e');
  txt('FleetPro — Relatório Financeiro',PW/2,11,{size:13,bold:true,color:'#ffffff',align:'center'});
  y=24;

  const periodo = document.getElementById('fin-filtro-periodo')?.value||'mes';
  const periodoLabels = {semana:'Esta semana', mes:'Este mês', trimestre:'Último trimestre', semestre:'Último semestre', ano:'Este ano', tudo:'Tudo', personalizado:'Personalizado'};
  let periodoTxt = periodoLabels[periodo]||periodo;
  if(periodo==='personalizado'){
    const di = document.getElementById('fin-filtro-data-ini')?.value;
    const df = document.getElementById('fin-filtro-data-fim')?.value;
    if(di && df) periodoTxt = `${di.split('-').reverse().join('/')} a ${df.split('-').reverse().join('/')}`;
  }
  const hoje = new Date().toLocaleDateString('pt-BR');
  txt(`Gerado em: ${hoje}   |   Período: ${periodoTxt}`,M,y,{size:8,color:'#666'});
  y+=8;

  // Cards resumo (do período filtrado)
  const fmt = v => 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const recMes  = _finLancamentos.filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0);
  const despMes = _finLancamentos.filter(l=>l.tipo==='despesa').reduce((a,l)=>a+Number(l.valor),0);

  rect(M,y,CW/3-2,16,'#e8f5e9','#c8e6c9');
  txt('Receita do Período',M+3,y+5,{size:7,color:'#333'});
  txt(fmt(recMes),M+3,y+12,{size:9,bold:true,color:'#16a34a'});

  rect(M+CW/3+2,y,CW/3-2,16,'#ffebee','#ffcdd2');
  txt('Despesa do Período',M+CW/3+5,y+5,{size:7,color:'#333'});
  txt(fmt(despMes),M+CW/3+5,y+12,{size:9,bold:true,color:'#dc2626'});

  rect(M+2*(CW/3)+4,y,CW/3-2,16,'#e8eaf6','#c5cae9');
  txt('Saldo do Mês',M+2*(CW/3)+7,y+5,{size:7,color:'#333'});
  txt(fmt(recMes-despMes),M+2*(CW/3)+7,y+12,{size:9,bold:true,color:recMes-despMes>=0?'#1565c0':'#dc2626'});
  y+=22;

  // Tabela de lançamentos
  rect(M,y,CW,6,'#1a1a2e','#1a1a2e');
  const cols=['Data','Tipo','Categoria','Descrição','Veículo','Valor'];
  const ws=[22,22,25,55,30,26];
  let cx=M;
  cols.forEach((h,i)=>{ txt(h,cx+1,y+4,{size:6.5,bold:true,color:'#fff'}); cx+=ws[i]; });
  y+=6;

  _finLancamentos.slice(0,100).forEach((l,ri)=>{
    if(y>270){ doc.addPage(); y=M; }
    rect(M,y,CW,6,ri%2===0?'#ffffff':'#f5f5f5','#e0e0e0');
    cx=M;
    const cells=[
      l.data?.split('-').reverse().join('/')||'—',
      l.tipo==='receita'?'Receita':'Despesa',
      l.categoria||'—',
      (l.descricao||'—').slice(0,35),
      l.veiculos?.placa||'—',
      (l.tipo==='receita'?'+ ':'-  ')+fmt(Number(l.valor)),
    ];
    cells.forEach((v2,i)=>{
      doc.setTextColor(i===1?(l.tipo==='receita'?'#16a34a':'#dc2626'):i===5?(l.tipo==='receita'?'#16a34a':'#dc2626'):'#333');
      doc.setFontSize(6.5); doc.setFont('helvetica','normal');
      doc.text(String(v2),cx+1,y+4);
      cx+=ws[i];
    });
    y+=6;
  });

  doc.save(`FleetPro_Financeiro_${new Date().toISOString().slice(0,10)}.pdf`);
  notify('PDF exportado!','success');
}

// ══ EXPORTAR CSV FLUXO DE CAIXA ══
async function finExportarCsvFluxo(){
  // Pede mês e ano
  const hoje = new Date();
  const mesAno = await fpPrompt(
    'Informe mês/ano para o fluxo de caixa (MM/AAAA):',
    'Exportar Fluxo de Caixa',
    {defaultValue: String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear(), placeholder:'MM/AAAA'}
  );
  if(!mesAno) return;
  const [mes, ano] = mesAno.split('/');
  if(!mes||!ano||isNaN(mes)||isNaN(ano)){ notify('Formato inválido. Use MM/AAAA','error'); return; }

  const dataIni = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0,10); // último dia do mês

  const {data, error} = await sb.from('lancamentos')
    .select('*,veiculos(placa)')
    .gte('data', dataIni).lte('data', dataFim)
    .order('data',{ascending:true}).order('created_at',{ascending:true});

  if(error){ notify('Erro ao buscar dados: '+error.message,'error'); return; }
  if(!data?.length){ notify('Nenhum lançamento no período','error'); return; }

  // Monta CSV
  const sep = ';';
  const linhas = [];

  // Cabeçalho
  linhas.push(['Data','Número do Documento','Histórico','Entrada','Saída','Saldo Final'].join(sep));

  let saldo = 0;
  data.forEach(l=>{
    const data_fmt = l.data?.split('-').reverse().join('/') || '';
    const numDoc   = l.num_contrato || l.num_nota || '—';
    const hist     = `${l.categoria}${l.descricao?' - '+l.descricao:''}`;
    const valor    = Number(l.valor)||0;
    const entrada  = l.tipo==='receita' ? valor : 0;
    const saida    = l.tipo==='despesa' ? valor : 0;
    saldo = saldo + entrada - saida;

    const fmtBr = v => v > 0 ? v.toFixed(2).replace('.',',') : '';
    linhas.push([
      data_fmt,
      numDoc,
      `"${hist.replace(/"/g,'""')}"`,
      fmtBr(entrada),
      fmtBr(saida),
      saldo.toFixed(2).replace('.',',')
    ].join(sep));
  });

  // Download
  const csv     = '\uFEFF' + linhas.join('\r\n'); // BOM para Excel reconhecer UTF-8
  const blob    = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `FluxoCaixa_${String(mes).padStart(2,'0')}_${ano}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify('CSV exportado!','success');
}
