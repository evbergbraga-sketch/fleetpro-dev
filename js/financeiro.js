// financeiro.js — Módulo Financeiro FleetPro

// ══ ESTADO ══
let _finLancamentos = [];
let _finVeiculoSel = null;

// ══ CATEGORIAS ══
const FIN_CORES = {
  receita: { bg:'rgba(22,163,74,.1)', border:'rgba(22,163,74,.3)', text:'#16a34a', badge:'badge-green' },
  despesa: { bg:'rgba(220,38,38,.1)', border:'rgba(220,38,38,.3)', text:'#dc2626', badge:'badge-red'  },
};
const FIN_CAT_ICONES = {
  'Aluguel':'🚗','Manutenção':'🔧','Seguro':'🛡️','IPVA':'📋',
  'Combustível':'⛽','Multa':'⚠️','Caução':'🔒','Outros':'📎',
};

// ══ INICIALIZAÇÃO ══
async function iniciarFinanceiro(){
  await finCarregarLancamentos();
  finPopularSelectVeiculos();
  await finRenderSeguros();
  await finRenderIpva();
  await finVerificarAlertas();
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
async function finCarregarLancamentos(){
  if(!sb) return;
  const periodo = document.getElementById('fin-filtro-periodo')?.value||'mes';
  const tipo    = document.getElementById('fin-filtro-tipo')?.value||'';
  const cat     = document.getElementById('fin-filtro-cat')?.value||'';
  const veiId   = document.getElementById('fin-filtro-veiculo')?.value||'';

  const hoje = new Date();
  let dataInicio = null;
  if(periodo==='mes'){
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
  } else if(periodo==='trimestre'){
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth()-2, 1).toISOString().slice(0,10);
  } else if(periodo==='ano'){
    dataInicio = new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0,10);
  }

  let query = sb.from('lancamentos')
    .select('*,veiculos(marca,modelo,placa,tipo)')
    .order('data',{ascending:false})
    .limit(500);

  if(dataInicio) query = query.gte('data', dataInicio);
  if(tipo)       query = query.eq('tipo', tipo);
  if(cat)        query = query.eq('categoria', cat);
  if(veiId)      query = query.eq('veiculo_id', veiId);

  const {data, error} = await query;
  if(error){ console.warn('[fin]', error.message); return; }
  _finLancamentos = data||[];

  finRenderLancamentos();
  finAtualizarCards();
}

// ══ RENDERIZAR TABELA ══
function finRenderLancamentos(){
  const tb = document.getElementById('tb-lancamentos');
  if(!tb) return;
  if(!_finLancamentos.length){
    tb.innerHTML='<tr class="empty-row"><td colspan="7">Nenhum lançamento encontrado</td></tr>';
    return;
  }
  tb.innerHTML = _finLancamentos.map(l=>{
    const cor  = FIN_CORES[l.tipo];
    const icon = FIN_CAT_ICONES[l.categoria]||'📎';
    const vei  = l.veiculos ? `${l.veiculos.tipo==='moto'?'🏍️':'🚗'} ${l.veiculos.placa}` : '—';
    const val  = Number(l.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    return `<tr>
      <td style="font-size:12px;color:var(--muted)">${l.data?.split('-').reverse().join('/')}</td>
      <td><span style="font-size:11px;padding:3px 8px;border-radius:99px;background:${cor.bg};color:${cor.text};border:1px solid ${cor.border};font-weight:700">${l.tipo==='receita'?'💚 Receita':'🔴 Despesa'}</span></td>
      <td style="font-size:12px">${icon} ${l.categoria}</td>
      <td style="font-size:12px">${l.descricao||'—'}</td>
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
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0,7);

  // Mês atual
  const doMes = _finLancamentos.filter(l=>l.data?.startsWith(mesAtual));
  const receitaMes  = doMes.filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0);
  const despesaMes  = doMes.filter(l=>l.tipo==='despesa').reduce((a,l)=>a+Number(l.valor),0);
  const saldoMes    = receitaMes - despesaMes;

  // Saldo acumulado (todos os lançamentos carregados)
  const totalRec = _finLancamentos.filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0);
  const totalDes = _finLancamentos.filter(l=>l.tipo==='despesa').reduce((a,l)=>a+Number(l.valor),0);

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

// ══ ALERTAS TOPO ══
async function finVerificarAlertas(){
  const alertasEl = document.getElementById('fin-alertas');
  if(!alertasEl) return;
  const hoje = new Date();
  const alertas = [];

  (allVeiculos||[]).forEach(v=>{
    // Seguro
    if(v.seguro_vencimento){
      const venc = new Date(v.seguro_vencimento);
      const dias = Math.ceil((venc-hoje)/86400000);
      if(dias < 0)
        alertas.push({tipo:'danger', msg:`🛡️ Seguro de <b>${v.marca} ${v.modelo} (${v.placa})</b> está <b>vencido</b>!`});
      else if(dias <= 30)
        alertas.push({tipo:'warning', msg:`🛡️ Seguro de <b>${v.marca} ${v.modelo} (${v.placa})</b> vence em <b>${dias} dias</b>`});
    }
    // IPVA
    let ipvas = [];
    try{ ipvas = v.ipvas ? JSON.parse(v.ipvas) : []; }catch(_){}
    ipvas.filter(ip=>!ip.pago).forEach(ip=>{
      if(!ip.vencimento) return;
      const venc = new Date(ip.vencimento);
      const dias = Math.ceil((venc-hoje)/86400000);
      if(dias < 0)
        alertas.push({tipo:'danger', msg:`📋 IPVA ${ip.ano||''} de <b>${v.marca} ${v.modelo} (${v.placa})</b> está <b>vencido</b>!`});
      else if(dias <= 30)
        alertas.push({tipo:'warning', msg:`📋 IPVA ${ip.ano||''} de <b>${v.marca} ${v.modelo} (${v.placa})</b> vence em <b>${dias} dias</b>`});
    });
  });

  alertasEl.innerHTML = alertas.map(a=>`
    <div style="padding:10px 14px;border-radius:8px;margin-bottom:6px;font-size:13px;
      background:${a.tipo==='danger'?'rgba(220,38,38,.1)':'rgba(245,158,11,.1)'};
      border:1px solid ${a.tipo==='danger'?'rgba(220,38,38,.3)':'rgba(245,158,11,.3)'};
      color:${a.tipo==='danger'?'#dc2626':'#92400e'}">
      ${a.msg}
    </div>`).join('');
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
}

async function finSalvarLancamento(){
  const id     = document.getElementById('mlc-id')?.value;
  const tipo   = document.getElementById('mlc-tipo')?.value;
  const cat    = document.getElementById('mlc-cat')?.value;
  const desc   = document.getElementById('mlc-desc')?.value?.trim();
  const valor  = parseFloat(document.getElementById('mlc-valor')?.value)||0;
  const data   = document.getElementById('mlc-data')?.value;
  const veiId  = document.getElementById('mlc-vei')?.value||null;

  if(!valor || !data){ notify('Preencha valor e data','error'); return; }

  const obj = { tipo, categoria:cat, descricao:desc||null, valor, data,
    veiculo_id:veiId, origem:'manual', criado_por:currentUser?.id };

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

async function finExcluirLancamento(id){
  if(!confirm('Excluir este lançamento?')) return;
  const {error} = await sb.from('lancamentos').delete().eq('id',id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Lançamento excluído','success');
  await finCarregarLancamentos();
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
        });
      }

      // 2) Gera as cobranças semanais (cronograma completo)
      const cobrancas = [];
      for(let i=1; i<=totalSemanas; i++){
        const venc = new Date(dataBase+'T00:00:00');
        venc.setDate(venc.getDate() + (i-1)*7);
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
        }).select().single();

        const semana1 = (cobrancasInseridas||[]).find(c=>c.numero_semana===1);
        if(semana1 && lancSemana1){
          await sb.from('cobrancas_semanais').update({lancamento_id: lancSemana1.id}).eq('id', semana1.id);
        }
      }
      return;
    }

    // ── LOCAÇÃO PADRÃO (carro / diária) — comportamento original ──
    await sb.from('lancamentos').insert({
      tipo:        'receita',
      categoria:   'Aluguel',
      descricao:   descBase,
      valor:       locacao.total||0,
      data:        dataBase,
      veiculo_id:  locacao.veiculo_id||null,
      locacao_id:  locacao.id||null,
      origem:      'automatico',
      criado_por:  currentUser?.id,
    });
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
  const hoje = new Date().toLocaleDateString('pt-BR');
  txt(`Gerado em: ${hoje}   |   Período: ${periodo}`,M,y,{size:8,color:'#666'});
  y+=8;

  // Cards resumo
  const fmt = v => 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const mesAtual = new Date().toISOString().slice(0,7);
  const doMes = _finLancamentos.filter(l=>l.data?.startsWith(mesAtual));
  const recMes  = doMes.filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0);
  const despMes = doMes.filter(l=>l.tipo==='despesa').reduce((a,l)=>a+Number(l.valor),0);

  rect(M,y,CW/3-2,16,'#e8f5e9','#c8e6c9');
  txt('Receita do Mês',M+3,y+5,{size:7,color:'#333'});
  txt(fmt(recMes),M+3,y+12,{size:9,bold:true,color:'#16a34a'});

  rect(M+CW/3+2,y,CW/3-2,16,'#ffebee','#ffcdd2');
  txt('Despesa do Mês',M+CW/3+5,y+5,{size:7,color:'#333'});
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

// ══ LANÇAMENTO AUTOMÁTICO — SEGURO ══
async function finRegistrarLancamentoSeguro(veiculoId, seguradora, valor, periodicidade, vencimento){
  if(!sb || !valor || valor <= 0) return;
  try{
    const v = allVeiculos?.find(x=>x.id===veiculoId);
    const perLabels = { mensal:'Mensal', trimestral:'Trimestral', semestral:'Semestral', anual:'Anual' };
    await sb.from('lancamentos').insert({
      tipo:         'despesa',
      categoria:    'Seguro',
      descricao:    `Seguro ${perLabels[periodicidade]||''} — ${seguradora||'Seguradora'} — ${v?.placa||''}`,
      valor:        valor,
      data:         vencimento || new Date().toISOString().slice(0,10),
      veiculo_id:   veiculoId||null,
      origem:       'automatico',
      criado_por:   currentUser?.id,
    });
    console.log('[fin] lançamento seguro criado:', valor, periodicidade);
  }catch(e){ console.warn('[fin] seguro:', e.message); }
}
