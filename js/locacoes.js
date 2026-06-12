// locacoes.js — Aba de Locações em andamento + Checklist de vistoria

// allLocacoesCompletas declarado em config.js
let _checklistItens = [];      // itens padrão do checklist

// ══ RENDER LISTA DE LOCAÇÕES ══
function renderLocacoes(){
  const tb = document.getElementById('tb-locacoes');
  if(!tb) return;
  const ativas = allLocacoesCompletas.filter(l=>l.status==='ativa');
  if(!ativas.length){
    tb.innerHTML='<tr class="empty-row"><td colspan="6">Nenhuma locação ativa no momento</td></tr>';
    return;
  }
  tb.innerHTML = ativas.map(l=>{
    const diff = Math.ceil((new Date(l.data_fim)-new Date())/86400000);
    const badge = diff<0
      ? '<span class="badge badge-red">Atrasado</span>'
      : diff===0
        ? '<span class="badge badge-yellow">Vence hoje</span>'
        : `<span class="badge badge-green">+${diff}d</span>`;
    const icone = SVG_VEICULO(l.veiculos?.tipo);
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="vi ${l.veiculos?.tipo==='carro'?'vi-car':'vi-moto'}">${icone}</div>
          <div>
            <div style="font-weight:500">${l.veiculos?.marca||''} ${l.veiculos?.modelo||''}</div>
            <div style="font-size:11px;color:var(--muted)">${l.veiculos?.placa||''}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight:500">${l.clientes?.nome||'—'}</div>
        <div style="font-size:11px;color:var(--muted)">${l.clientes?.telefone||''}</div>
      </td>
      <td>${fmtData(l.data_inicio)}</td>
      <td>${fmtData(l.data_fim)}</td>
      <td>${badge}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary" style="font-size:11px;padding:5px 12px" onclick="abrirModalLocacao('${l.id}')">📋 Detalhes</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="abrirModalLocacaoEntrada('${l.id}')">✅ Devolver</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ══ LOAD LOCAÇÕES COMPLETAS ══
async function loadLocacoesCompletas(){
  const {data, error} = await sb.from('locacoes')
    .select(`
      id, veiculo_id, cliente_id, data_inicio, data_fim,
      km_inicial, km_final, diaria, total, status, observacoes,
      criado_por, created_at,
      num_contrato, tipo_contrato, local_retirada, caucao,
      forma_pgto, servicos_adicionais,
      data_inicio_hora, data_fim_hora,
      veiculos(id, marca, modelo, placa, tipo, km_atual),
      clientes(id, nome, cpf, telefone, email)
    `)
    .eq('status','ativa')
    .order('data_fim',{ascending:true});
  if(error){
    // Fallback sem campos novos caso SQL não tenha rodado ainda
    const {data:data2} = await sb.from('locacoes')
      .select('*,veiculos(id,marca,modelo,placa,tipo,km_atual),clientes(id,nome,cpf,telefone,email)')
      .eq('status','ativa')
      .order('data_fim',{ascending:true});
    allLocacoesCompletas = data2||[];
    allLocacoes = data2||[];
    return;
  }
  allLocacoesCompletas = data||[];
  allLocacoes = data||[];
}

// ══ MODAL DETALHES DA LOCAÇÃO ══
// ══ HISTÓRICO DE PAGAMENTOS E ADITIVOS ══
function _extrairFormaDescricao(desc){
  if(!desc) return null;
  const formas = ['PIX','Cartão de Crédito','Cartão de Débito','Dinheiro','Transferência','Boleto'];
  for(const f of formas){ if(desc.includes(f)) return f; }
  return null;
}

function _descSemForma(desc){
  if(!desc) return desc;
  const partes = desc.split(' — ');
  const last = partes[partes.length-1];
  const formas = ['PIX','Cartão de Crédito','Cartão de Débito','Dinheiro','Transferência','Boleto'];
  const semForma = formas.includes(last) ? partes.slice(0,-1) : partes;
  return semForma.slice(-1)[0];
}

function _renderHistoricoPagamentos(lancamentos, loc){
  if(!lancamentos || lancamentos.length===0) return '';

  const fmtDataHora = d => {
    if(!d) return '—';
    try{ return new Date(d).toLocaleDateString('pt-BR'); }catch(_){ return d.slice(0,10).split('-').reverse().join('/'); }
  };

  const origemLabel = {
    automatico: 'Contrato',
    manual: 'Manual',
    checklist_entrada: 'Devolução',
    extensao: 'Extensão',
    asaas: 'Asaas',
  };
  const origemIcon = {
    automatico: '📄',
    manual: '✋',
    checklist_entrada: '🏁',
    extensao: '📅',
    asaas: '🔄',
  };

  const linhas = lancamentos.map(l=>`
    <div style="display:grid;grid-template-columns:90px 1fr 110px 100px;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border)">
      <div style="font-size:11px;color:var(--muted)">${fmtDataHora(l.data||l.created_at)}</div>
      <div style="font-size:12px">
        <span style="margin-right:4px">${origemIcon[l.origem]||'💰'}</span>${_descSemForma(l.descricao)||l.categoria||'—'}
        <span style="font-size:10px;color:var(--muted2);margin-left:4px">(${origemLabel[l.origem]||l.origem||'—'})</span>
      </div>
      <div style="font-size:11px;color:var(--muted)">${l.forma_pgto || _extrairFormaDescricao(l.descricao) || '—'}</div>
      <div style="font-size:12px;font-weight:600;text-align:right;color:${l.tipo==='despesa'?'var(--red)':'var(--green)'}">
        ${l.tipo==='despesa'?'−':'+'} R$ ${Number(l.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </div>
    </div>`).join('');

  // Detecta aditivos (extensões) registradas
  const aditivos = lancamentos.filter(l=>l.origem==='extensao');
  const aditivosResumo = aditivos.length>0
    ? `<div style="font-size:11px;color:var(--accent);font-weight:600;margin-bottom:6px">📅 ${aditivos.length} aditivo${aditivos.length>1?'s':''} de extensão registrado${aditivos.length>1?'s':''}</div>`
    : '';

  return `
    <div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:20px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">💳 Histórico de Pagamentos${loc.plano_moto?'' : ' e Aditivos'}</div>
      ${aditivosResumo}
      <div style="border:1px solid var(--border2);border-radius:8px;max-height:220px;overflow-y:auto">
        <div style="display:grid;grid-template-columns:90px 1fr 110px 100px;gap:8px;padding:6px 10px;background:var(--bg3);font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);font-weight:600;position:sticky;top:0">
          <div>Data</div><div>Descrição</div><div>Forma</div><div style="text-align:right">Valor</div>
        </div>
        ${linhas}
      </div>
    </div>`;
}


function _renderCobrancasSemanais(cobrancas, loc){
  if(!cobrancas || cobrancas.length===0) return '';

  const hoje = new Date().toISOString().slice(0,10);
  const pagos     = cobrancas.filter(c=>c.status==='pago').length;
  const atrasados = cobrancas.filter(c=>c.status==='atrasado' || (c.status==='pendente' && c.data_vencimento < hoje)).length;
  const total     = cobrancas.length;

  const statusInfo = {
    pago:     {label:'Pago',     color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)', icon:'✓'},
    pendente: {label:'Pendente', color:'var(--muted)',  bg:'var(--bg2)',      border:'var(--border2)',      icon:'⏳'},
    atrasado: {label:'Atrasado', color:'var(--red)',   bg:'var(--red-bg)',   border:'var(--red-border)',   icon:'⚠'},
  };

  const linhas = cobrancas.map(c=>{
    // Status efetivo: se pendente e venceu, mostra como atrasado visualmente
    const statusEf = (c.status==='pendente' && c.data_vencimento < hoje) ? 'atrasado' : c.status;
    const info = statusInfo[statusEf]||statusInfo.pendente;
    const valorExibido = c.valor_pago!=null ? c.valor_pago : c.valor;
    const clicavel = c.status!=='pago';
    return `
      <div id="cobr-row-${c.id}" style="display:grid;grid-template-columns:70px 1fr 90px 100px;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border)${clicavel?';cursor:pointer':''}"
        ${clicavel?`onclick="_abrirFormPagarSemana('${c.id}', ${c.valor})"`:''} title="${clicavel?'Clique para marcar como pago':''}">
        <div style="font-size:12px;font-weight:600;color:var(--text2)">Sem. ${c.numero_semana}</div>
        <div style="font-size:12px;color:var(--muted)">${fmtData(c.data_vencimento)}</div>
        <div style="font-size:12px;font-weight:600;text-align:right">R$ ${Number(valorExibido).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
        <div style="display:flex;justify-content:flex-end">
          <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;color:${info.color};background:${info.bg};border:1px solid ${info.border}">${info.icon} ${info.label}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2)">Cobranças Semanais</div>
        <div style="display:flex;gap:8px;font-size:11px;align-items:center">
          <span style="color:var(--green);font-weight:600">${pagos} pagas</span>
          <span style="color:var(--muted)">·</span>
          <span style="color:var(--muted)">${total-pagos-atrasados} pendentes</span>
          ${atrasados>0?`<span style="color:var(--muted)">·</span><span style="color:var(--red);font-weight:600">${atrasados} atrasadas</span>`:''}
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted2);margin-bottom:6px">💡 Clique em uma semana pendente/atrasada para marcar como paga manualmente (ex: pagamento em dinheiro na loja)</div>
      <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border2);border-radius:8px">
        <div style="display:grid;grid-template-columns:70px 1fr 90px 100px;gap:8px;padding:6px 10px;background:var(--bg3);font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);font-weight:600;position:sticky;top:0">
          <div>Semana</div><div>Vencimento</div><div style="text-align:right">Valor</div><div style="text-align:right">Status</div>
        </div>
        ${linhas}
      </div>
    </div>`;
}

// ── Marcar cobrança semanal como paga manualmente ──
function _abrirFormPagarSemana(cobrancaId, valorPrevisto){
  const row = document.getElementById(`cobr-row-${cobrancaId}`);
  if(!row) return;
  row.setAttribute('onclick','');
  row.style.cursor = 'default';
  row.style.gridTemplateColumns = '1fr';
  row.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 0">
      <span style="font-size:12px;color:var(--muted)">Valor pago (R$)</span>
      <input type="number" id="cobr-valor-${cobrancaId}" value="${Number(valorPrevisto).toFixed(2)}" step="0.01" style="width:100px;font-size:12px;padding:4px 8px">
      <span style="font-size:12px;color:var(--muted)">Forma</span>
      <select id="cobr-forma-${cobrancaId}" style="font-size:12px;padding:4px 8px">
        <option>Dinheiro</option><option>PIX</option><option>Cartão de Débito</option><option>Cartão de Crédito</option><option>Boleto</option>
      </select>
      <button onclick="_confirmarPagamentoSemana('${cobrancaId}')" style="font-size:12px;padding:5px 12px;background:var(--green);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">✓ Confirmar</button>
      <button onclick="abrirModalLocacao(window._locDetalheAtualId)" style="font-size:12px;padding:5px 12px;background:var(--bg3);color:var(--text);border:none;border-radius:6px;cursor:pointer">Cancelar</button>
    </div>`;
}

async function _confirmarPagamentoSemana(cobrancaId){
  const valor = parseFloat(document.getElementById(`cobr-valor-${cobrancaId}`)?.value)||0;
  const forma = document.getElementById(`cobr-forma-${cobrancaId}`)?.value||'Dinheiro';
  if(valor<=0){ notify('Informe um valor válido','error'); return; }

  try{
    // Busca a cobrança para ter dados da locação/veículo/cliente
    const {data:cobr} = await sb.from('cobrancas_semanais').select('*').eq('id',cobrancaId).single();
    if(!cobr) throw new Error('Cobrança não encontrada');

    const {data:loc} = await sb.from('locacoes').select('*,veiculos(placa),clientes(nome)').eq('id',cobr.locacao_id).single();

    // Cria lançamento financeiro
    const {data:lanc} = await sb.from('lancamentos').insert({
      tipo: 'receita',
      categoria: 'Aluguel',
      descricao: `Contrato #${loc?.num_contrato||''} — ${loc?.clientes?.nome||'Cliente'} — ${loc?.veiculos?.placa||''} — Semana ${cobr.numero_semana}`,
      valor: valor,
      data: new Date().toISOString().slice(0,10),
      veiculo_id: loc?.veiculo_id||null,
      locacao_id: cobr.locacao_id,
      origem: 'manual',
      criado_por: currentUser?.id,
    }).select().single();

    // Marca cobrança como paga
    await sb.from('cobrancas_semanais').update({
      status: 'pago',
      valor_pago: valor,
      data_pagamento: new Date().toISOString(),
      lancamento_id: lanc?.id||null,
    }).eq('id', cobrancaId);

    notify(`Semana ${cobr.numero_semana} marcada como paga!`,'success');
    abrirModalLocacao(window._locDetalheAtualId);
  }catch(e){
    notify('Erro ao confirmar pagamento: '+e.message,'error');
  }
}

async function abrirModalLocacao(locId){
  window._locDetalheAtualId = locId;
  window._locDetalheRestanteContrato = 0;
  const modal = document.getElementById('m-locacao-detalhe');
  const body  = document.getElementById('locacao-detalhe-body');
  if(!modal||!body) return;

  body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Carregando...</div>`;
  modal.classList.add('show');

  // Busca locação completa
  const {data:loc} = await sb.from('locacoes')
    .select('*,veiculos(*),clientes(*)')
    .eq('id',locId).single();
  if(!loc){ body.innerHTML='<p style="color:var(--red)">Locação não encontrada.</p>'; return; }
  window._locDetalheRestanteContrato = loc.valor_restante||0;

  // Busca checklists existentes (tabela pode não existir ainda)
  let checks = [];
  try {
    const {data:checksData, error:chkErr} = await sb.from('checklists')
      .select('*')
      .eq('locacao_id',locId)
      .order('created_at',{ascending:true});
    if(!chkErr) checks = checksData||[];
  } catch(e){ checks = []; }

  const checkSaida   = checks.find(c=>c.tipo==='saida');
  const checkEntrada = checks.find(c=>c.tipo==='entrada');

  // Busca cobranças semanais (apenas planos moto)
  let cobrancas = [];
  if(loc.plano_moto){
    try{
      const {data:cobrData} = await sb.from('cobrancas_semanais')
        .select('*')
        .eq('locacao_id', locId)
        .order('numero_semana',{ascending:true});
      cobrancas = cobrData||[];
    }catch(e){ cobrancas = []; }
  }

  // Busca histórico de lançamentos financeiros desta locação (pagamentos, extensões, devolução)
  let lancamentosLoc = [];
  try{
    const {data:lancData} = await sb.from('lancamentos')
      .select('*')
      .eq('locacao_id', locId)
      .order('created_at',{ascending:true});
    lancamentosLoc = lancData||[];
  }catch(e){ lancamentosLoc = []; }

  const diff = Math.ceil((new Date(loc.data_fim)-new Date())/86400000);
  const statusColor = diff<0?'#dc2626':diff===0?'#d97706':'#16a34a';
  const statusLabel = diff<0?`Atrasado ${Math.abs(diff)}d`:diff===0?'Vence hoje':`${diff} dias restantes`;

  body.innerHTML = `
    <!-- HEADER DA LOCAÇÃO -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#2563EB);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:1px">Contrato #${loc.num_contrato||'—'}</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">${loc.veiculos?.marca||''} ${loc.veiculos?.modelo||''}</div>
          <div style="font-size:13px;opacity:.85">Placa: ${loc.veiculos?.placa||'—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;opacity:.7">Status</div>
          <div style="font-size:14px;font-weight:700;color:${statusColor==='#16a34a'?'#a7f3d0':statusColor==='#d97706'?'#fde68a':'#fca5a5'}">${statusLabel}</div>
        </div>
      </div>
    </div>

    <!-- DADOS PRINCIPAIS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">👤 Cliente</div>
        <div style="font-weight:600;font-size:14px">${loc.clientes?.nome||'—'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">CPF: ${loc.clientes?.cpf||'—'}</div>
        <div style="font-size:12px;color:var(--muted)">Tel: ${loc.clientes?.telefone||'—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">📅 Período</div>
        <div style="font-size:12px"><strong>Retirada:</strong> ${loc.data_inicio_hora ? _fmtDtLocacao(loc.data_inicio_hora) : fmtData(loc.data_inicio)}</div>
        <div style="font-size:12px"><strong>Devolução:</strong> ${loc.data_fim_hora ? _fmtDtLocacao(loc.data_fim_hora) : fmtData(loc.data_fim)}</div>
        <div style="font-size:12px"><strong>Local:</strong> ${loc.local_retirada||'Loja'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">💰 Financeiro</div>
        <div style="font-size:12px"><strong>Diária:</strong> R$ ${(loc.diaria||0).toFixed(2).replace('.',',')}</div>
        <div style="font-size:12px"><strong>Total:</strong> <span style="color:var(--accent);font-weight:700">R$ ${(loc.total||0).toFixed(2).replace('.',',')}</span></div>
        <div style="font-size:12px"><strong>Pagamento:</strong> ${loc.forma_pgto||'—'}</div>
        ${loc.caucao>0?`<div style="font-size:12px"><strong>Caução:</strong> R$ ${(loc.caucao||0).toFixed(2).replace('.',',')}</div>`:''}
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">Veículo</div>
        <div style="font-size:12px"><strong>Km saída:</strong> ${loc.km_inicial||'—'}</div>
        <div style="font-size:12px"><strong>Tipo:</strong> ${loc.tipo_contrato==='moto'?'Moto':'Carro'}</div>
        ${loc.servicos_adicionais?.length>0?`<div style="font-size:12px"><strong>Serviços:</strong> ${loc.servicos_adicionais.map(s=>s.descricao).join(', ')}</div>`:''}
      </div>
    </div>

    ${loc.observacoes?`
    <div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:20px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:6px">📝 Observações</div>
      <div style="font-size:13px;color:var(--text)">${loc.observacoes}</div>
    </div>`:''}

    ${_renderCobrancasSemanais(cobrancas, loc)}

    ${_renderHistoricoPagamentos(lancamentosLoc, loc)}

    <!-- ABAS CHECKLISTS -->
    <div style="border-bottom:2px solid var(--border2);margin-bottom:16px;display:flex;gap:0">
      <button id="tab-saida" class="loc-tab active" onclick="showLocTab('saida')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;border-bottom:2px solid var(--accent);color:var(--accent);margin-bottom:-2px">
        Saída ${checkSaida?'✓':''}
      </button>
      <button id="tab-entrada" class="loc-tab" onclick="showLocTab('entrada')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px">
        🏁 Entrada ${checkEntrada?'✓':''}
      </button>
      ${loc.status==='ativa' ? `
      <button id="tab-estender" class="loc-tab" onclick="showLocTab('estender')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px">
        📅 Estender
      </button>` : ''}
    </div>

    <!-- PAINEL SAÍDA -->
    <div id="painel-saida">
      ${checkSaida ? _renderChecklistExistente(checkSaida) : _renderFormChecklist('saida', locId, loc)}
    </div>

    <!-- PAINEL ENTRADA -->
    <div id="painel-entrada" style="display:none">
      ${checkEntrada ? _renderChecklistExistente(checkEntrada) : (checkSaida ? _renderFormChecklist('entrada', locId, loc) : '<div style="text-align:center;padding:30px;color:var(--muted2)">⚠️ Faça o checklist de saída primeiro.</div>')}
    </div>

    <!-- PAINEL ESTENDER -->
    ${loc.status==='ativa' ? `
    <div id="painel-estender" style="display:none">
      ${_renderFormEstender(locId, loc)}
    </div>` : ''}
  `;

  // Carrega itens do checklist filtrado por tipo de veículo
  await _carregarItensChecklist(loc.veiculos?.tipo || 'moto');

  // Inicializa cálculo da extensão (nova devolução, totais)
  if(loc.status==='ativa' && typeof _calcExtensao==='function'){
    setTimeout(()=>_calcExtensao(), 50);
  }

  // Se checklist de entrada existe, carrega custos registrados no financeiro
  if(checkEntrada){
    const {data:lancCustos} = await sb.from('lancamentos')
      .select('*')
      .eq('locacao_id', locId)
      .eq('origem','checklist_entrada')
      .order('id');
    if(lancCustos?.length){
      // Renderiza custos da entrada como view (somente leitura)
      const custosDiv = document.getElementById('custos-view-entrada');
      if(custosDiv){
        const total = lancCustos.reduce((a,l)=>a+Number(l.valor||0), 0);
        custosDiv.innerHTML = `
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">💰 Pagamentos da Devolução</div>
          <div style="background:var(--bg2);border-radius:10px;padding:12px">
            ${lancCustos.map(l=>`
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:15px">${l.categoria==='Tag / Pedágio'?'🛣️':l.categoria==='Reparo'?'🔧':l.categoria==='Lavagem'?'🫧':'⚠️'}</span>
              <div style="flex:1">
                <div style="font-size:11px;font-weight:700;color:var(--text)">${l.descricao?.split(' — ')[0]||l.categoria}</div>
                ${l.descricao?.split(' — ').slice(3).join(' — ')?`<div style="font-size:10px;color:var(--muted2)">${l.descricao.split(' — ').slice(3).join(' — ')}</div>`:''}
              </div>
              <span style="font-size:13px;font-weight:700;color:var(--green)">+ R$ ${Number(l.valor||0).toFixed(2).replace('.',',')}</span>
            </div>`).join('')}
            <div style="text-align:right;font-size:13px;font-weight:700;color:var(--accent);padding-top:8px">
              Total: R$ ${total.toFixed(2).replace('.',',')}
            </div>
          </div>`;
        custosDiv.style.display = '';
      }
    }
  }
}

function showLocTab(tab){
  document.getElementById('painel-saida').style.display  = tab==='saida'  ? '' : 'none';
  document.getElementById('painel-entrada').style.display = tab==='entrada' ? '' : 'none';
  const painelEstender = document.getElementById('painel-estender');
  if(painelEstender) painelEstender.style.display = tab==='estender' ? '' : 'none';
  // Mostrar bloco de custos somente na aba entrada
  const bCustos = document.getElementById('bloco-custos-devolucao');
  if(bCustos){ bCustos.style.display = tab==='entrada' ? '' : 'none'; }
  if(tab==='entrada'){ _custosDevolucao=[]; _renderCustosDevolucao(); _atualizarTotalPagamentoRestante(); }
  document.querySelectorAll('.loc-tab').forEach(t=>{
    const map = {'tab-saida':'saida','tab-entrada':'entrada','tab-estender':'estender'};
    const active = map[t.id]===tab;
    t.style.color = active?'var(--accent)':'var(--muted)';
    t.style.borderBottomColor = active?'var(--accent)':'transparent';
    t.style.fontWeight = active?'700':'600';
  });
}

function _fmtDtLocacao(str){
  if(!str) return '—';
  try{
    const d=new Date(str);
    return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ return str; }
}

// ══ RENDER CHECKLIST EXISTENTE (só leitura) ══
function _renderChecklistExistente(check){
  const itens = check.itens||[];
  const fotos = check.fotos||[];
  const consultor = check.perfis?.nome||'—';
  return `
  <div style="background:var(--bg2);border-radius:10px;padding:16px;margin-bottom:12px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div><div style="font-size:10px;color:var(--muted2)">Horário</div><div style="font-weight:600;font-size:13px">${_fmtDtLocacao(check.horario)}</div></div>
      <div><div style="font-size:10px;color:var(--muted2)">Km</div><div style="font-weight:600;font-size:13px">${check.km||'—'} km</div></div>
      <div><div style="font-size:10px;color:var(--muted2)">Combustível</div><div style="font-weight:600;font-size:13px">${check.combustivel||'—'}</div></div>
      <div><div style="font-size:10px;color:var(--muted2)">Consultor</div><div style="font-weight:600;font-size:13px">${consultor}</div></div>
    </div>
    ${itens.length>0?`
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">Itens vistoriados</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      ${itens.map(it=>{
        const avaria  = it.status==='avaria';
        const naoHouve= it.status==='nao_houve';
        const badge   = avaria
          ? '<span style="font-size:10px;font-weight:700;color:#dc2626;background:rgba(220,38,38,.1);padding:2px 6px;border-radius:4px;white-space:nowrap">✕ Com avaria</span>'
          : naoHouve
          ? '<span style="font-size:10px;font-weight:700;color:#888;background:rgba(128,128,128,.1);padding:2px 6px;border-radius:4px;white-space:nowrap">— Não Houve</span>'
          : '<span style="font-size:10px;font-weight:700;color:#16a34a;background:rgba(22,163,74,.1);padding:2px 6px;border-radius:4px;white-space:nowrap">✓ Ok / Sem avaria</span>';
        return `<div style="background:var(--bg3,var(--bg2));border:1px solid ${avaria?'rgba(220,38,38,.2)':'var(--border)'};border-radius:6px;padding:6px 8px">
          <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:3px">${it.descricao}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${badge}
            ${it.obs?`<span style="font-size:10px;color:var(--muted);font-style:italic">${it.obs}</span>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`:''}
    ${check.observacoes?`<div style="margin-top:10px;font-size:12px;color:var(--muted)"><strong>Obs:</strong> ${check.observacoes}</div>`:''}
    ${fotos.length>0?`
    <div style="margin-top:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">Fotos (${fotos.length})</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">
        ${fotos.map((url,fi)=>{
          const fid='foto'+Date.now()+fi;
          setTimeout(async()=>{
            const el=document.getElementById(fid);
            if(el){
              // URL já é signed URL direta do Supabase — usar diretamente
              const su = url.includes('supabase.co') ? url : (typeof _getSignedUrl==='function' ? await _getSignedUrl(url) : url);
              el.src=su;
              el.onclick=()=>window.open(su,'_blank');
            }
          },100+fi*50);
          return `<img id="${fid}" src="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border2)">`;
        }).join('')}
      </div>
    </div>`:''}
  </div>
  ${check.tipo==='entrada' ? '<div id="custos-view-entrada" style="display:none;margin-top:12px"></div>' : ''}
  `;
}

// ══ RENDER FORMULÁRIO DE CHECKLIST ══
// ══ ESTENDER LOCAÇÃO ══
let _servicosExtensao = []; // [{descricao, valor}]

function _renderFormEstender(locId, loc){
  const isMoto = !!loc.plano_moto;
  const unidade = isMoto ? 'semana' : 'diária';
  const unidadePlural = isMoto ? 'semanas' : 'diárias';
  const valorUnitario = Number(loc.diaria||0);
  const diasPorUnidade = isMoto ? 7 : 1;
  _servicosExtensao = [];
  window._locDetalheFimAtual = loc.data_fim_hora || (loc.data_fim+'T00:00:00');

  return `
  <div id="form-estender">
    <div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
        <span>Devolução atual:</span>
        <strong>${loc.data_fim_hora ? _fmtDtLocacao(loc.data_fim_hora) : fmtData(loc.data_fim)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px">
        <span>Valor da ${unidade}:</span>
        <strong>R$ ${valorUnitario.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong>
      </div>
    </div>

    <div class="form-grid" style="gap:10px;margin-bottom:16px">
      <div class="form-group">
        <label>Quantidade de ${unidadePlural} extras</label>
        <input type="number" id="est-qtd" min="1" step="1" value="1" style="width:100%" oninput="_calcExtensao()">
      </div>
      <div class="form-group">
        <label>Nova devolução</label>
        <input type="text" id="est-nova-devolucao" readonly disabled style="width:100%;font-weight:700;color:var(--accent)">
      </div>
    </div>

    <!-- SERVIÇOS EXTRAS -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">🔧 Serviços extras (opcional)</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input type="text" id="est-servico-desc" placeholder="Descrição do serviço" style="flex:2">
      <input type="number" id="est-servico-val" placeholder="0,00" step="0.01" min="0" style="flex:1">
      <button type="button" class="btn btn-ghost" onclick="_adicionarServicoExtensao()" style="white-space:nowrap">+ Adicionar</button>
    </div>
    <div id="est-servicos-lista" style="margin-bottom:16px"></div>

    <!-- RESUMO -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
        <span id="est-resumo-diarias-label">1 ${unidade} × R$ ${valorUnitario.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
        <strong id="est-resumo-diarias">R$ ${valorUnitario.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px" id="est-resumo-servicos-row" style="display:none">
        <span>+ Serviços extras:</span>
        <strong id="est-resumo-servicos">R$ 0,00</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:var(--accent);padding-top:8px;border-top:1px solid var(--border2)">
        <span>Total da extensão:</span>
        <strong id="est-resumo-total" data-valor="${valorUnitario}" data-valor-unit="${valorUnitario}" data-unidade="${unidade}">R$ ${valorUnitario.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong>
      </div>
    </div>

    <div class="form-grid" style="gap:10px;margin-bottom:16px">
      <div class="form-group">
        <label>Forma de pagamento</label>
        <select id="est-forma-pgto" style="width:100%">
          <option value="PIX">PIX</option>
          <option value="Cartão de Crédito">Cartão de Crédito</option>
          <option value="Cartão de Débito">Cartão de Débito</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Transferência">Transferência</option>
          <option value="Boleto">Boleto</option>
        </select>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;margin-top:18px">
          <input type="checkbox" id="est-ja-pago" style="width:auto">
          Cliente já pagou a extensão
        </label>
      </div>
    </div>

    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost" style="flex:1" onclick="_gerarAditivoFromForm('${locId}', ${valorUnitario}, ${diasPorUnidade})">
        📄 Gerar PDF do Aditivo
      </button>
      <button class="btn btn-primary" style="flex:2" onclick="_confirmarExtensao('${locId}', ${valorUnitario}, ${diasPorUnidade})">
        ✅ Confirmar extensão
      </button>
    </div>
  </div>`;
}

function _adicionarServicoExtensao(){
  const desc = document.getElementById('est-servico-desc')?.value.trim();
  const val  = document.getElementById('est-servico-val')?.value;
  if(!desc){ notify('Informe a descrição do serviço','error'); return; }
  _servicosExtensao.push({descricao:desc, valor:parseFloat(val)||0});
  document.getElementById('est-servico-desc').value = '';
  document.getElementById('est-servico-val').value = '';
  _renderServicosExtensao();
}

function _removerServicoExtensao(i){
  _servicosExtensao.splice(i,1);
  _renderServicosExtensao();
}

function _renderServicosExtensao(){
  const wrap = document.getElementById('est-servicos-lista');
  if(!wrap) return;
  wrap.innerHTML = _servicosExtensao.map((s,i)=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="flex:2;font-size:13px">${s.descricao}</div>
      <div style="font-weight:600;color:var(--accent)">R$ ${parseFloat(s.valor||0).toFixed(2).replace('.',',')}</div>
      <button onclick="_removerServicoExtensao(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>
    </div>`).join('');
  _calcExtensao();
}

function _calcExtensao(){
  const totalEl = document.getElementById('est-resumo-total');
  const diariasEl = document.getElementById('est-resumo-diarias');
  const diariasLabelEl = document.getElementById('est-resumo-diarias-label');
  const servicosRowEl = document.getElementById('est-resumo-servicos-row');
  const servicosEl = document.getElementById('est-resumo-servicos');
  const novaDevEl = document.getElementById('est-nova-devolucao');
  if(!totalEl) return;

  const qtd = parseInt(document.getElementById('est-qtd')?.value)||1;
  const valorUnitario = parseFloat(totalEl.dataset.valorUnit)||0;
  const totalServicos = _servicosExtensao.reduce((a,s)=>a+(parseFloat(s.valor)||0),0);
  const totalDiarias = qtd * valorUnitario;
  const total = totalDiarias + totalServicos;

  const unidade = totalEl.dataset.unidade||'diária';
  if(diariasLabelEl) diariasLabelEl.textContent = `${qtd} ${unidade}${qtd!==1?(unidade==='semana'?'s':'s'):''} × R$ ${valorUnitario.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  if(diariasEl) diariasEl.textContent = `R$ ${totalDiarias.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  if(servicosRowEl) servicosRowEl.style.display = totalServicos>0 ? '' : 'none';
  if(servicosEl) servicosEl.textContent = `R$ ${totalServicos.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  totalEl.textContent = `R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  totalEl.dataset.valor = total;
  totalEl.dataset.valorUnit = valorUnitario;

  // Nova data de devolução
  if(novaDevEl){
    const fimAtual = window._locDetalheFimAtual ? new Date(window._locDetalheFimAtual) : null;
    if(fimAtual){
      const diasPorUnidade = unidade==='semana' ? 7 : 1;
      const nova = new Date(fimAtual);
      nova.setDate(nova.getDate() + qtd*diasPorUnidade);
      window._locDetalheNovaData = nova;
      novaDevEl.value = _fmtDtLocacao(nova.toISOString());
    }
  }
}

// ══ PDF — ADITIVO DE EXTENSÃO ══
async function _gerarPdfAditivoExtensao(loc, info){
  if(!window.jspdf){ notify('jsPDF não carregado. Recarregue a página.','error'); return null; }
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const PW=210, M=12, CW=PW-M*2;
  let y = M;

  const rect = (x, yy, w, h, fill, stroke) => {
    if(fill){ doc.setFillColor(fill); }
    if(stroke){ doc.setDrawColor(stroke); } else { doc.setDrawColor('#cccccc'); }
    doc.rect(x, yy, w, h, fill?(stroke?'FD':'F'):'D');
  };
  const line = (x1,y1,x2,y2,color='#cccccc',w=0.3) => {
    doc.setDrawColor(color); doc.setLineWidth(w);
    doc.line(x1,y1,x2,y2);
  };

  // ── CABEÇALHO ──
  try{
    const resp = await fetch('/icons/logo-Royal.png');
    const blob = await resp.blob();
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    doc.addImage(base64, 'PNG', M, y, 35, 20);
  }catch(_){}

  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text('ROYAL RENT A CAR LTDA', M+42, y+7);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  doc.text('CNPJ: 18.686.521/0002-90', M+42, y+12);
  doc.text('Tel: (21) 96894-9627  |  sac@locadoraroyal.com.br', M+42, y+15);

  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text(`ADITIVO AO CONTRATO #${loc.num_contrato||''}`, PW-M, y+5, {align:'right'});
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor('#555');
  doc.text('Extensão de Prazo de Locação', PW-M, y+10, {align:'right'});
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, PW-M, y+14, {align:'right'});
  y += 18;

  line(M, y, PW-M, y, '#006400', 0.5);
  y += 6;

  // ── DADOS DO CONTRATO ──
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor('#111');
  doc.text('PARTES E OBJETO', M, y); y += 5;
  doc.setFontSize(8.5); doc.setFont('helvetica','normal');
  doc.text(`LOCADORA: Royal Rent A Car Ltda, CNPJ 18.686.521/0002-90.`, M, y); y += 5;
  doc.text(`LOCATÁRIO: ${loc.clientes?.nome||'—'}, CPF ${loc.clientes?.cpf||'—'}.`, M, y); y += 5;
  doc.text(`VEÍCULO: ${loc.veiculos?.marca||''} ${loc.veiculos?.modelo||''} — Placa ${loc.veiculos?.placa||'—'}.`, M, y); y += 8;

  // ── DETALHES DA EXTENSÃO ──
  rect(M, y, CW, 7, '#006400', '#006400');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('DETALHES DA EXTENSÃO', M+2.5, y+5);
  y += 7;

  rect(M, y, CW, 28, '#f0f8f0', '#ccddcc');
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor('#111');
  doc.text(`Devolução anterior: ${info.devolucaoAnterior}`, M+2.5, y+5);
  doc.text(`Nova devolução: ${info.novaDevolucao}`, M+2.5, y+10);
  doc.text(`Período adicional: ${info.qtd} ${info.unidadeLabel}`, M+2.5, y+15);
  doc.setFont('helvetica','bold');
  doc.text(`Valor da extensão (${info.qtd} x R$ ${info.valorUnitario.toFixed(2).replace('.',',')}): R$ ${info.totalDiarias.toFixed(2).replace('.',',')}`, M+2.5, y+20);
  if(info.totalServicos>0){
    doc.text(`Serviços extras: R$ ${info.totalServicos.toFixed(2).replace('.',',')}`, M+2.5, y+25);
  }
  doc.setFontSize(10); doc.setTextColor('#006400');
  doc.text(`TOTAL: R$ ${info.totalGeral.toFixed(2).replace('.',',')}`, PW-M-2.5, y+25, {align:'right'});
  y += 33;

  // ── SERVIÇOS EXTRAS (lista) ──
  if(info.servicos?.length){
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor('#111');
    doc.text('Serviços extras incluídos:', M, y); y += 5;
    doc.setFont('helvetica','normal');
    info.servicos.forEach(s=>{
      doc.text(`• ${s.descricao} — R$ ${Number(s.valor||0).toFixed(2).replace('.',',')}`, M+3, y);
      y += 4.5;
    });
    y += 3;
  }

  // ── FORMA DE PAGAMENTO ──
  rect(M, y, CW, 10, '#f0f8f0', '#a8d8a8');
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor('#111');
  doc.text(`Pagamento: ${info.jaPago ? `${info.forma} (pago no ato)` : 'Pendente — será cobrado na devolução'}`, M+2.5, y+6);
  y += 16;

  // ── CLÁUSULA ──
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  const clausula = `As partes acordam, de comum acordo, a extensão do prazo de locação do veículo acima identificado, mantendo-se inalteradas todas as demais cláusulas e condições do contrato original #${loc.num_contrato||''}, exceto quanto à nova data de devolução e ao valor adicional especificado neste aditivo.`;
  const linhas = doc.splitTextToSize(clausula, CW);
  doc.text(linhas, M, y);
  y += linhas.length*4.5 + 10;

  // ── ASSINATURAS ──
  if(y > 250){ doc.addPage(); y = M+10; }
  line(M, y, M+80, y, '#333');
  line(PW-M-80, y, PW-M, y, '#333');
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  doc.text('Locatário', M+30, y+5, {align:'center'});
  doc.text('Locadora', PW-M-30, y+5, {align:'center'});

  doc.save(`Aditivo_Contrato_${loc.num_contrato||''}_${(loc.clientes?.nome||'').replace(/\s+/g,'_')}.pdf`);
  notify('PDF do Aditivo gerado!','success');
  return doc;
}

async function _gerarAditivoFromForm(locId, valorUnitario, diasPorUnidade){
  const qtd = parseInt(document.getElementById('est-qtd')?.value)||1;
  if(qtd<=0){ notify('Informe uma quantidade válida','error'); return; }

  const totalEl = document.getElementById('est-resumo-total');
  const totalGeral = parseFloat(totalEl?.dataset?.valor)||0;
  const totalServicos = _servicosExtensao.reduce((a,s)=>a+(parseFloat(s.valor)||0),0);
  const totalDiarias = totalGeral - totalServicos;
  const jaPago = document.getElementById('est-ja-pago')?.checked||false;
  const forma = document.getElementById('est-forma-pgto')?.value||'PIX';
  const unidade = totalEl?.dataset?.unidade||'diária';
  const unidadeLabel = unidade==='semana' ? (qtd===1?'semana':'semanas') : (qtd===1?'diária':'diárias');

  const {data:loc} = await sb.from('locacoes').select('*,veiculos(*),clientes(*)').eq('id',locId).single();
  if(!loc){ notify('Locação não encontrada','error'); return; }

  const fimAtual = new Date(loc.data_fim_hora||loc.data_fim+'T00:00:00');
  const novaData = new Date(fimAtual);
  novaData.setDate(novaData.getDate() + qtd*diasPorUnidade);

  await _gerarPdfAditivoExtensao(loc, {
    qtd, unidadeLabel, valorUnitario, totalDiarias, totalServicos, totalGeral,
    servicos: _servicosExtensao,
    devolucaoAnterior: _fmtDtLocacao(fimAtual.toISOString()),
    novaDevolucao: _fmtDtLocacao(novaData.toISOString()),
    jaPago, forma,
  });
}

async function _confirmarExtensao(locId, valorUnitario, diasPorUnidade){
  const qtd = parseInt(document.getElementById('est-qtd')?.value)||1;
  if(qtd<=0){ notify('Informe uma quantidade válida','error'); return; }

  const totalEl = document.getElementById('est-resumo-total');
  const total = parseFloat(totalEl?.dataset?.valor)||0;
  const jaPago = document.getElementById('est-ja-pago')?.checked||false;
  const forma = document.getElementById('est-forma-pgto')?.value||'PIX';

  const btn = document.querySelector('#form-estender .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }

  try{
    const {data:loc} = await sb.from('locacoes').select('*,veiculos(placa),clientes(nome)').eq('id',locId).single();
    if(!loc) throw new Error('Locação não encontrada');

    const fimAtual = new Date(loc.data_fim_hora||loc.data_fim+'T00:00:00');
    const novaData = new Date(fimAtual);
    novaData.setDate(novaData.getDate() + qtd*diasPorUnidade);
    const novaDataISO = novaData.toISOString();

    // Atualiza locação: nova data de devolução + acumula serviços extras
    const novosServicos = [...(loc.servicos_adicionais||[]), ..._servicosExtensao.map(s=>({...s, extensao:true}))];
    const novoTotal = Number(loc.total||0) + total;
    const novoRestante = jaPago ? Number(loc.valor_restante||0) : Number(loc.valor_restante||0) + total;

    await sb.from('locacoes').update({
      data_fim: novaDataISO.slice(0,10),
      data_fim_hora: novaDataISO,
      total: novoTotal,
      valor_restante: novoRestante,
      servicos_adicionais: novosServicos.length>0 ? novosServicos : null,
    }).eq('id', locId);

    // Lançamento financeiro (se já pago)
    if(jaPago && total>0){
      await sb.from('lancamentos').insert({
        tipo:'receita', categoria:'Aluguel',
        descricao:`Contrato #${loc.num_contrato||locId.slice(0,8)} — ${loc.clientes?.nome||''} — ${loc.veiculos?.placa||''} — Extensão (+${qtd} ${diasPorUnidade===7?'semana(s)':'diária(s)'}) — ${forma}`,
        valor: total, data: new Date().toISOString().slice(0,10),
        veiculo_id: loc.veiculo_id||null, locacao_id: locId,
        origem:'extensao', criado_por: currentUser?.id,
      });
    }

    notify(`Locação estendida até ${_fmtDtLocacao(novaDataISO)}!`,'success');

    // Sincroniza tudo: veículo, calendário, listas
    if(typeof loadLocacoes==='function') await loadLocacoes();
    if(typeof loadLocacoesCompletas==='function') await loadLocacoesCompletas();
    if(typeof loadVeiculos==='function') await loadVeiculos();
    if(typeof renderLocacoes==='function') renderLocacoes();
    if(typeof renderDashboard==='function') renderDashboard();

    closeModal('locacao-detalhe');
    setTimeout(()=>abrirModalLocacao(locId), 200);
  }catch(e){
    notify('Erro ao estender: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent='✅ Confirmar extensão'; }
  }
}

function _renderFormChecklist(tipo, locId, loc){
  const label = tipo==='saida'?'Saída':'Entrada';
  return `
  <div id="form-checklist-${tipo}">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="form-group">
        <label>Km atual</label>
        <input type="number" id="chk-km-${tipo}" placeholder="${loc.km_inicial||0}" style="width:100%">
      </div>
      <div class="form-group">
        <label>Nível de combustível</label>
        <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:10px">
          <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:3px;margin-bottom:6px" id="gauge-${tipo}">
            ${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'].map((v,i)=>`
              <div onclick="_selecionarComb('${tipo}','${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'][i]}')" data-val="${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'][i]}"
                style="height:28px;border-radius:4px;cursor:pointer;transition:.15s;border:2px solid transparent;
                background:${i===0?'#ef4444':i<3?'#f59e0b':i<6?'#22c55e':'#16a34a'}22"
                title="${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'][i]}">
              </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted2);padding:0 2px">
            <span>Reserva</span><span>Cheio</span>
          </div>
          <div id="comb-label-${tipo}" style="text-align:center;font-size:12px;font-weight:700;color:var(--accent);margin-top:4px">Cheio</div>
          <input type="hidden" id="chk-comb-${tipo}" value="Cheio">
        </div>
      </div>
      <div class="form-group">
        <label>Horário da vistoria</label>
        <input type="datetime-local" id="chk-hora-${tipo}" style="width:100%" value="${new Date(new Date().getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}">
      </div>
    </div>

    <!-- ITENS DO CHECKLIST -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:10px">Itens de vistoria</div>
    <div id="chk-itens-${tipo}" style="margin-bottom:16px">
      <div style="text-align:center;padding:20px;color:var(--muted2);font-size:13px">⏳ Carregando itens...</div>
    </div>

    <!-- FOTOS -->
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">📷 Fotos (máx. 20)</div>
      <label style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg2);border:2px dashed var(--border2);border-radius:10px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'">
        <span style="font-size:20px">📷</span>
        <div>
          <div style="font-size:13px;font-weight:500">Selecionar fotos</div>
          <div style="font-size:11px;color:var(--muted)">Até 20 fotos — JPG, PNG, WEBP</div>
        </div>
        <input type="file" accept="image/*" multiple style="display:none" onchange="_previewFotos(this,'${tipo}')">
      </label>
      <div id="fotos-preview-${tipo}" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px"></div>
    </div>

    <!-- OBSERVAÇÕES -->
    <div class="form-group" style="margin-bottom:16px">
      <label>Observações da vistoria</label>
      <textarea id="chk-obs-${tipo}" rows="2" style="width:100%;resize:vertical" placeholder="Descreva avarias, itens faltantes..."></textarea>
    </div>

    <div id="bloco-custos-devolucao" style="margin-bottom:16px;display:none">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">💰 Pagamentos da Devolução</div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
          <button type="button" onclick="_addCustoDevolucao('Tag / Pedágio')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            🛣️ Tag / Pedágio
          </button>
          <button type="button" onclick="_addCustoDevolucao('Reparo')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            🔧 Reparo
          </button>
          <button type="button" onclick="_addCustoDevolucao('Lavagem')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            🫧 Lavagem
          </button>
          <button type="button" onclick="_addCustoDevolucao('Multa')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            ⚠️ Multa
          </button>
        </div>
        <div id="custos-lista-entrada" style="margin-bottom:6px"></div>
        <div id="custos-total-entrada" style="text-align:right;font-size:12px;font-weight:700;color:var(--accent);padding-top:6px;border-top:1px solid var(--border2);display:none">
          Total: R$ <span id="custos-total-val">0,00</span>
        </div>
      </div>
    </div>

    ${tipo==='entrada' && !loc.plano_moto ? `
    <div id="bloco-pagamento-restante" style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">💰 Pagamento do Saldo Restante</div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
          <span>Valor restante do contrato:</span>
          <strong id="pgr-restante-contrato">R$ ${(loc.valor_restante||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
          <span>+ Pagamentos da devolução:</span>
          <strong id="pgr-custos">R$ 0,00</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:var(--accent);padding-top:8px;border-top:1px solid var(--border2);margin-bottom:10px">
          <span>Total a receber:</span>
          <strong id="pgr-total" data-valor="${loc.valor_restante||0}">R$ ${(loc.valor_restante||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong>
        </div>

        <div id="pgr-form" style="${(loc.valor_restante||0)>0?'':'display:none'}">
          <div class="form-grid" style="gap:10px;margin-bottom:8px">
            <div class="form-group">
              <label>Valor recebido agora (R$)</label>
              <input type="number" id="pgr-valor1" step="0.01" min="0" value="${(loc.valor_restante||0).toFixed(2)}" style="width:100%" oninput="_calcPgrRestante()">
            </div>
            <div class="form-group">
              <label>Forma de pagamento</label>
              <select id="pgr-forma1" style="width:100%">
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Transferência">Transferência</option>
                <option value="Boleto">Boleto</option>
              </select>
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;margin-bottom:8px">
            <input type="checkbox" id="pgr-dividir" style="width:auto" onchange="_togglePgrSplit()">
            Dividir em 2 formas de pagamento
          </label>
          <div id="pgr-split-wrap" class="form-grid" style="gap:10px;display:none">
            <div class="form-group">
              <label>Valor 2ª forma (R$)</label>
              <input type="number" id="pgr-valor2" step="0.01" min="0" readonly style="width:100%;background:var(--bg2)">
            </div>
            <div class="form-group">
              <label>Forma 2</label>
              <select id="pgr-forma2" style="width:100%">
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Transferência">Transferência</option>
                <option value="Boleto">Boleto</option>
              </select>
            </div>
          </div>
          <div id="pgr-aviso-saldo" style="font-size:11px;color:var(--red);margin-top:6px;display:none"></div>
        </div>
        <div id="pgr-quitado-msg" style="${(loc.valor_restante||0)>0?'display:none':''};font-size:12px;color:var(--green);font-weight:600;text-align:center">✓ Contrato sem saldo pendente</div>
      </div>
    </div>` : ''}

    <button class="btn btn-primary" style="width:100%" onclick="salvarChecklist('${tipo}','${locId}')">
      💾 Salvar vistoria de ${label}
    </button>
  </div>`;
}

// ══ CARREGA ITENS DO CHECKLIST DO BANCO ══
async function _carregarItensChecklist(tipoVeiculo){
  // Limpa cache ao trocar tipo
  if(tipoVeiculo && _checklistItens._tipoCarregado !== tipoVeiculo){
    _checklistItens = [];
  }
  if(_checklistItens.length) return _renderItensNosFormularios();
  const tipo = tipoVeiculo || 'moto';
  const {data} = await sb.from('checklist_itens')
    .select('*')
    .eq('ativo', true)
    .in('tipo_veiculo', [tipo, 'ambos'])
    .order('ordem');
  _checklistItens = data||[];
  _checklistItens._tipoCarregado = tipo;
  _renderItensNosFormularios();
}

function _renderItensNosFormularios(){
  ['saida','entrada'].forEach(tipo=>{
    const wrap = document.getElementById(`chk-itens-${tipo}`);
    if(!wrap) return;
    if(!_checklistItens.length){
      wrap.innerHTML='<div style="color:var(--muted2);font-size:13px;text-align:center;padding:10px">Nenhum item configurado. Configure em Configurações.</div>';
      return;
    }
    // Agrupa por categoria
    const cats = {};
    _checklistItens.forEach(it=>{
      if(!cats[it.categoria]) cats[it.categoria]=[];
      cats[it.categoria].push(it);
    });
    wrap.innerHTML = Object.entries(cats).map(([cat,itens])=>`
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px;padding:4px 0;border-bottom:1px solid var(--border2)">${cat}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${itens.map(it=>`
          <div style="background:var(--bg2);border-radius:8px;padding:8px 10px">
            <div style="font-size:12px;font-weight:500;margin-bottom:6px">${it.descricao}</div>
            <div style="display:flex;gap:4px">
              <label style="flex:1;text-align:center;padding:5px 2px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;border:2px solid #16a34a;color:#16a34a;background:rgba(22,163,74,.08);transition:all .15s" onclick="_selectItem(this,'ok')">
                <input type="radio" name="chk-${tipo}-${it.id}" value="ok" style="display:none" checked> ✓ Sem avaria
              </label>
              <label style="flex:1;text-align:center;padding:5px 2px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;border:2px solid #dc2626;color:#dc2626;background:#fff;transition:all .15s" onclick="_selectItem(this,'avaria')">
                <input type="radio" name="chk-${tipo}-${it.id}" value="avaria" style="display:none"> ✕ Com avaria
              </label>
            </div>
            <input type="text" placeholder="Obs (opcional)" style="width:100%;font-size:11px;margin-top:4px;padding:3px 6px;border-radius:4px"
              id="chk-obs-item-${tipo}-${it.id}">
          </div>`).join('')}
        </div>
      </div>`).join('');
  });
}

function _selecionarComb(tipo, valor){
  const inp = document.getElementById('chk-comb-'+tipo);
  const lbl = document.getElementById('comb-label-'+tipo);
  const gauge = document.getElementById('gauge-'+tipo);
  if(inp) inp.value = valor;
  if(lbl) lbl.textContent = valor;
  if(gauge){
    const cells = gauge.querySelectorAll('div[data-val]');
    const niveis = ['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'];
    const idx = niveis.indexOf(valor);
    cells.forEach((cell,i)=>{
      const isActive = i <= idx;
      const baseColor = i===0?'#ef4444':i<3?'#f59e0b':i<6?'#22c55e':'#16a34a';
      cell.style.background = isActive ? baseColor : baseColor+'22';
      cell.style.border = isActive ? '2px solid '+baseColor : '2px solid transparent';
    });
  }
}

function _selectItem(label, status){
  const parent = label.closest('div[style*="display:flex"]');
  if(!parent) return;
  // Reset todos
  parent.querySelectorAll('label').forEach(l=>{
    const isOk = l.textContent.includes('Sem avaria');
    const isAv = l.textContent.includes('Com avaria');
    l.style.background = isOk?'rgba(22,163,74,.08)':'rgba(220,38,38,.08)';
    l.style.color = isOk?'#16a34a':'#dc2626';
    l.style.borderColor = isOk?'#16a34a':'#dc2626';
    l.style.borderWidth='2px';
    l.style.opacity='1';
    l.style.boxShadow='none';
  });
  // Destaca selecionado com fundo sólido
  const bgColors = {ok:'#16a34a', avaria:'#dc2626', nao_verificado:'#475569'};
  label.style.background = bgColors[status];
  label.style.color = '#fff';
  label.style.borderColor = bgColors[status];
  label.style.opacity = '1';
  label.style.boxShadow = '0 2px 8px rgba(0,0,0,.18)';
  label.querySelector('input[type=radio]').checked = true;
}

// ══ PREVIEW DE FOTOS ══
function _previewFotos(input, tipo){
  const files = Array.from(input.files).slice(0,20);
  const wrap = document.getElementById(`fotos-preview-${tipo}`);
  if(!wrap) return;
  wrap.innerHTML = '';
  window[`_fotos_${tipo}`] = files;
  files.forEach((file,i)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const div = document.createElement('div');
      div.style.cssText='position:relative';
      div.innerHTML=`
        <img src="${e.target.result}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:1px solid var(--border2)">
        <button onclick="this.parentElement.remove();window['_fotos_${tipo}'].splice(${i},1)"
          style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>`;
      wrap.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// ══ SALVAR CHECKLIST ══
async function salvarChecklist(tipo, locId){
  const km     = parseInt(document.getElementById(`chk-km-${tipo}`)?.value)||null;
  const comb   = document.getElementById(`chk-comb-${tipo}`)?.value||'';
  const hora   = document.getElementById(`chk-hora-${tipo}`)?.value||new Date().toISOString();
  const obs    = document.getElementById(`chk-obs-${tipo}`)?.value||'';
  const fotos  = window[`_fotos_${tipo}`]||[];

  // ── Validação do pagamento do restante (apenas entrada, contratos não-moto) ──
  let pgrInfo = null;
  if(tipo==='entrada'){
    const {data:locCheck} = await sb.from('locacoes').select('plano_moto').eq('id',locId).single();
    const isMotoPlan = !!locCheck?.plano_moto;
    const restanteContrato = isMotoPlan ? 0 : (window._locDetalheRestanteContrato||0);
    const custosTotal = _custosDevolucao.reduce((a,c)=>a+(c.valor||0), 0);
    const totalAReceber = Math.max(0, restanteContrato + custosTotal);

    if(totalAReceber > 0){
      const valor1 = parseFloat(document.getElementById('pgr-valor1')?.value)||0;
      const forma1 = document.getElementById('pgr-forma1')?.value||'PIX';
      const dividir = document.getElementById('pgr-dividir')?.checked;
      const valor2 = dividir ? (parseFloat(document.getElementById('pgr-valor2')?.value)||0) : 0;
      const forma2 = dividir ? (document.getElementById('pgr-forma2')?.value||'PIX') : null;
      const totalInformado = valor1 + valor2;

      if(totalInformado < totalAReceber - 0.01){
        notify(`Pagamento incompleto! Faltam R$ ${(totalAReceber-totalInformado).toFixed(2).replace('.',',')} para liberar a devolução.`,'error');
        return;
      }
      pgrInfo = {valor1, forma1, valor2, forma2, totalAReceber, restanteContrato, custosTotal};
    }
  }

  const btn = document.querySelector(`#form-checklist-${tipo} .btn-primary`);
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }

  try{
    // Coleta itens do formulário
    const itens = _checklistItens.map(it=>{
      const radios = document.querySelectorAll(`input[name="chk-${tipo}-${it.id}"]`);
      const checked = [...radios].find(r=>r.checked);
      const obsItem = document.getElementById(`chk-obs-item-${tipo}-${it.id}`)?.value||'';
      return {
        id:it.id, descricao:it.descricao, categoria:it.categoria,
        status: checked?.value||'nao_verificado',
        obs: obsItem
      };
    });

    // Upload das fotos para Supabase Storage
    const fotoUrls = [];
    for(const file of fotos){
      const ext = file.name.split('.').pop();
      const path = `${locId}/${tipo}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const {data:up, error:upErr} = await sb.storage.from('checklists').upload(path, file);
      if(upErr) throw upErr;
      const {data:signData} = await sb.storage.from('checklists').createSignedUrl(path, 60*60*24*365);
      fotoUrls.push(signData?.signedUrl || '');
    }

    // Salva checklist no banco
    const {error} = await sb.from('checklists').insert({
      locacao_id: locId,
      tipo,
      km,
      combustivel: comb,
      horario: hora,
      consultor_id: currentUser?.id,
      itens,
      observacoes: obs,
      fotos: fotoUrls
    });
    if(error) throw error;

    notify(`Vistoria de ${tipo==='saida'?'saída':'entrada'} salva!`,'success');

    // Se for entrada, registrar custos no financeiro
    if(tipo==='entrada' && _custosDevolucao.length){
      const loc = (await sb.from('locacoes').select('*, veiculos(*), clientes(*)').eq('id', locId).single()).data;
      const qtdCustos = _custosDevolucao.length;
      for(const custo of _custosDevolucao){
        if(!custo.valor || custo.valor<=0) continue;
        // Todos os pagamentos da devolução são recebíveis (receita) do cliente
      const tipoLan  = 'receita';
      const catLan   = custo.categoria==='Tag / Pedágio' ? 'Tag / Pedágio'
                     : custo.categoria==='Lavagem' ? 'Lavagem'
                     : 'Multa'; // Reparo e Multa cobrados do cliente entram como Multa
      await sb.from('lancamentos').insert({
          tipo:        tipoLan,
          categoria:   catLan,
          descricao:   `${custo.nome||catLan} — ${loc?.clientes?.nome||''} — ${loc?.veiculos?.placa||''} [Devolução Contrato #${loc?.num_contrato||locId.slice(0,8)}]${custo.observacao?' — '+custo.observacao:''}`,
          valor:        custo.valor,
          data:         new Date().toISOString().slice(0,10),
          veiculo_id:   loc?.veiculo_id||null,
          locacao_id:   locId,
          origem:       'checklist_entrada',
          criado_por:   currentUser?.id,
        });
      }
      _custosDevolucao = []; // limpa após salvar
      notify(`${qtdCustos} pagamento(s) de devolução registrados no financeiro!`,'success');
    }

    // Se for entrada: registra pagamento do restante, fecha contrato e libera veículo
    if(tipo==='entrada'){
      const loc = (await sb.from('locacoes').select('*, veiculos(*), clientes(*)').eq('id', locId).single()).data;

      if(pgrInfo && pgrInfo.totalAReceber>0){
        const descBase = `Contrato #${loc?.num_contrato||locId.slice(0,8)} — ${loc?.clientes?.nome||''} — ${loc?.veiculos?.placa||''} — Saldo final`;
        if(pgrInfo.valor1>0){
          await sb.from('lancamentos').insert({
            tipo:'receita', categoria:'Aluguel', descricao: descBase+` — ${pgrInfo.forma1}`,
            valor: pgrInfo.valor1, data: new Date().toISOString().slice(0,10),
            veiculo_id: loc?.veiculo_id||null, locacao_id: locId,
            origem:'checklist_entrada', criado_por: currentUser?.id,
          });
        }
        if(pgrInfo.valor2>0){
          await sb.from('lancamentos').insert({
            tipo:'receita', categoria:'Aluguel', descricao: descBase+` (2ª forma) — ${pgrInfo.forma2}`,
            valor: pgrInfo.valor2, data: new Date().toISOString().slice(0,10),
            veiculo_id: loc?.veiculo_id||null, locacao_id: locId,
            origem:'checklist_entrada', criado_por: currentUser?.id,
          });
        }
      }

      // Fecha o contrato e libera o veículo
      await sb.from('locacoes').update({
        status: 'encerrada',
        valor_restante: 0,
        km_final: km,
      }).eq('id', locId);

      if(loc?.veiculo_id){
        await sb.from('veiculos').update({status:'disponivel'}).eq('id', loc.veiculo_id);
      }

      notify('Devolução concluída! Veículo liberado e contrato encerrado.','success');

      // Sincroniza dados locais (calendário, listas, etc)
      if(typeof loadLocacoes==='function') await loadLocacoes();
      if(typeof loadLocacoesCompletas==='function') await loadLocacoesCompletas();
      if(typeof loadVeiculos==='function') await loadVeiculos();
      if(typeof loadHistoricoLocacoes==='function') loadHistoricoLocacoes();
      if(typeof renderLocacoes==='function') renderLocacoes();
      if(typeof renderDashboard==='function') renderDashboard();
    }

    // Reabre o modal atualizado
    closeModal('locacao-detalhe');
    setTimeout(()=>abrirModalLocacao(locId), 200);
  }catch(e){
    notify('Erro: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent=`💾 Salvar vistoria de ${tipo==='saida'?'Saída':'Entrada'}`; }
  }
}

// ══ ABRIR MODAL DIRETO NA ABA ENTRADA (botão Devolver da tabela) ══
async function abrirModalLocacaoEntrada(locId){
  await abrirModalLocacao(locId);
  // Aguarda o modal renderizar e muda para aba Entrada
  setTimeout(()=>{
    const tabEntrada = document.getElementById('tab-entrada');
    if(tabEntrada) tabEntrada.click();
    // Scroll até o painel de entrada
    const painel = document.getElementById('painel-entrada');
    if(painel) painel.scrollIntoView({behavior:'smooth', block:'start'});
  }, 350);
}

// ══ CUSTOS DA DEVOLUÇÃO ══
let _custosDevolucao = [];

function _addCustoDevolucao(categoria){
  const id = Date.now();
  _custosDevolucao.push({id, categoria, nome:'', valor:0, observacao:''});
  _renderCustosDevolucao();
}

function _removeCusto(id){
  _custosDevolucao = _custosDevolucao.filter(c=>c.id!==id);
  _renderCustosDevolucao();
}

function _renderCustosDevolucao(){
  const wrap = document.getElementById('custos-lista-entrada');
  const totalWrap = document.getElementById('custos-total-entrada');
  if(!wrap) return;

  if(!_custosDevolucao.length){
    wrap.innerHTML = '<div style="text-align:center;padding:10px;color:var(--muted2);font-size:12px">Nenhum custo adicionado</div>';
    if(totalWrap) totalWrap.style.display='none';
    return;
  }

  wrap.innerHTML = _custosDevolucao.map(c=>`
    <div id="custo-row-${c.id}" style="display:grid;grid-template-columns:28px 1fr 100px 1fr 28px;gap:8px;align-items:center;padding:10px 12px;margin-bottom:6px;background:var(--bg3,var(--bg));border-radius:10px;border:1px solid var(--border2)">
      <span style="font-size:18px;text-align:center">${c.categoria==='Tag / Pedágio'?'🛣️':c.categoria==='Reparo'?'🔧':c.categoria==='Lavagem'?'🫧':'⚠️'}</span>
      <div>
        <div style="font-size:9px;color:var(--muted2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">${c.categoria}</div>
        <input type="text" placeholder="Descrição do custo" value="${c.nome}"
          oninput="_custosDevolucao.find(x=>x.id===${c.id}).nome=this.value"
          style="width:100%;font-size:12px;padding:5px 8px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text)">
      </div>
      <div>
        <div style="font-size:9px;color:var(--muted2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">Valor (R$)</div>
        <input type="number" placeholder="0,00" value="${c.valor||''}" step="0.01" min="0"
          oninput="_custosDevolucao.find(x=>x.id===${c.id}).valor=parseFloat(this.value)||0;_recalcularTotalCustos()"
          style="font-size:12px;padding:5px 8px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text);width:100%">
      </div>
      <div>
        <div style="font-size:9px;color:var(--muted2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">Observação</div>
        <input type="text" placeholder="Opcional" value="${c.observacao}"
          oninput="_custosDevolucao.find(x=>x.id===${c.id}).observacao=this.value"
          style="width:100%;font-size:12px;padding:5px 8px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text)">
      </div>
      <button onclick="_removeCusto(${c.id})" title="Remover" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--red,#dc2626);padding:0;line-height:1;align-self:center">×</button>
    </div>`).join('');

  _recalcularTotalCustos();
  if(totalWrap) totalWrap.style.display = _custosDevolucao.length ? '' : 'none';
}

function _recalcularTotalCustos(){
  const total = _custosDevolucao.reduce((a,c)=>a+(c.valor||0), 0);
  const el = document.getElementById('custos-total-val');
  const wrap = document.getElementById('custos-total-entrada');
  if(el) el.textContent = total.toFixed(2).replace('.',',');
  if(wrap) wrap.style.display = _custosDevolucao.length ? '' : 'none';
  _atualizarTotalPagamentoRestante();
}

// ══ PAGAMENTO DO RESTANTE (devolução) ══
function _atualizarTotalPagamentoRestante(){
  const restanteEl = document.getElementById('pgr-restante-contrato');
  const custosEl = document.getElementById('pgr-custos');
  const totalEl = document.getElementById('pgr-total');
  const formEl = document.getElementById('pgr-form');
  const quitadoEl = document.getElementById('pgr-quitado-msg');
  if(!totalEl) return; // não está na aba entrada

  const restanteContrato = window._locDetalheRestanteContrato||0;
  const custos = _custosDevolucao.reduce((a,c)=>a+(c.valor||0), 0);
  const total = Math.max(0, restanteContrato + custos);

  if(custosEl) custosEl.textContent = `R$ ${custos.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  if(totalEl){ totalEl.textContent = `R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; totalEl.dataset.valor = total; }

  if(formEl) formEl.style.display = total>0 ? '' : 'none';
  if(quitadoEl) quitadoEl.style.display = total>0 ? 'none' : '';

  const valor1El = document.getElementById('pgr-valor1');
  if(valor1El && !valor1El.dataset.userEdited) valor1El.value = total.toFixed(2);
  _calcPgrRestante();
}

function _calcPgrRestante(){
  const total = parseFloat(document.getElementById('pgr-total')?.dataset?.valor)||0;
  const valor1El = document.getElementById('pgr-valor1');
  valor1El.dataset.userEdited = '1';
  const valor1 = parseFloat(valor1El?.value)||0;
  const dividir = document.getElementById('pgr-dividir')?.checked;
  const valor2El = document.getElementById('pgr-valor2');
  const avisoEl = document.getElementById('pgr-aviso-saldo');

  if(dividir && valor2El) valor2El.value = Math.max(0, total - valor1).toFixed(2);

  const totalInformado = dividir ? valor1 + (parseFloat(valor2El?.value)||0) : valor1;
  if(avisoEl){
    if(totalInformado < total - 0.01){
      avisoEl.textContent = `⚠️ Valor informado (R$ ${totalInformado.toFixed(2).replace('.',',')}) é menor que o total a receber (R$ ${total.toFixed(2).replace('.',',')})`;
      avisoEl.style.display = '';
    } else {
      avisoEl.style.display = 'none';
    }
  }
}

function _togglePgrSplit(){
  const checked = document.getElementById('pgr-dividir')?.checked;
  const wrap = document.getElementById('pgr-split-wrap');
  if(wrap) wrap.style.display = checked ? '' : 'none';
  _calcPgrRestante();
}

// ══ HISTÓRICO DE LOCAÇÕES ENCERRADAS ══
let _historicoLocacoes = [];

async function loadHistoricoLocacoes(){
  try{
    const {data} = await sb
      .from('locacoes')
      .select(`
        id, num_contrato, data_inicio, data_fim, data_inicio_hora, data_fim_hora,
        km_inicial, km_final, diaria, total, status, forma_pgto, tipo_contrato, plano_moto, caucao,
        veiculos(id, marca, modelo, placa, tipo),
        clientes(id, nome, telefone)
      `)
      .eq('status','encerrada')
      .order('data_fim',{ascending:false})
      .limit(200);
    _historicoLocacoes = data||[];

    // Para planos de moto, busca soma de valores pagos nas cobranças semanais
    const idsMoto = _historicoLocacoes.filter(l=>l.plano_moto).map(l=>l.id);
    if(idsMoto.length){
      const {data:cobr} = await sb.from('cobrancas_semanais')
        .select('locacao_id, valor, valor_pago, status')
        .in('locacao_id', idsMoto)
        .eq('status','pago');
      const somaPorLocacao = {};
      (cobr||[]).forEach(c=>{
        const v = c.valor_pago!=null ? Number(c.valor_pago) : Number(c.valor);
        somaPorLocacao[c.locacao_id] = (somaPorLocacao[c.locacao_id]||0) + v;
      });
      _historicoLocacoes.forEach(l=>{
        if(l.plano_moto){
          l._totalRecebido = (Number(l.caucao)||0) + (somaPorLocacao[l.id]||0);
        }
      });
    }

    renderHistoricoLocacoes();
  }catch(e){ console.warn('[histórico]', e.message); }
}

function renderHistoricoLocacoes(){
  const tb = document.getElementById('tb-historico-locacoes');
  if(!tb) return;

  const filtCliente = (document.getElementById('hist-filtro-cliente')?.value||'').toLowerCase().trim();
  const filtVeiculo = (document.getElementById('hist-filtro-veiculo')?.value||'').toLowerCase().trim();
  const filtDe      = document.getElementById('hist-filtro-de')?.value||'';
  const filtAte     = document.getElementById('hist-filtro-ate')?.value||'';

  let lista = _historicoLocacoes;

  if(filtCliente) lista = lista.filter(l=>(l.clientes?.nome||'').toLowerCase().includes(filtCliente));
  if(filtVeiculo) lista = lista.filter(l=>{
    const str = `${l.veiculos?.placa||''} ${l.veiculos?.marca||''} ${l.veiculos?.modelo||''}`.toLowerCase();
    return str.includes(filtVeiculo);
  });
  if(filtDe)  lista = lista.filter(l=> l.data_inicio >= filtDe);
  if(filtAte) lista = lista.filter(l=> l.data_inicio <= filtAte);

  if(!lista.length){
    tb.innerHTML='<tr class="empty-row"><td colspan="8">Nenhuma locação encerrada encontrada</td></tr>';
    return;
  }

  const fmtD = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const fmtR = v => `R$ ${Number(v||0).toFixed(2).replace('.',',')}`;
  const kmRod = l => (l.km_final && l.km_inicial) ? `${l.km_final - l.km_inicial} km` : '—';
  const icoTipo = l => SVG_VEICULO(l.veiculos?.tipo||l.tipo_contrato);

  tb.innerHTML = lista.map(l=>`
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="display:flex;align-items:center;color:var(--accent)">${icoTipo(l)}</span>
          <div>
            <div style="font-weight:600;font-size:13px">${l.veiculos?.marca||''} ${l.veiculos?.modelo||''}</div>
            <div style="font-size:11px;color:var(--muted2)">${l.veiculos?.placa||'—'}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight:500;font-size:13px">${l.clientes?.nome||'—'}</div>
        <div style="font-size:11px;color:var(--muted2)">${l.clientes?.telefone||''}</div>
      </td>
      <td style="font-size:12px">${fmtD(l.data_inicio)}</td>
      <td style="font-size:12px">${fmtD(l.data_fim)}</td>
      <td style="font-size:12px;text-align:center">${kmRod(l)}</td>
      <td style="font-size:13px;font-weight:700;color:var(--accent)">${fmtR(l.plano_moto ? (l._totalRecebido||0) : l.total)}</td>
      <td style="font-size:12px;color:var(--muted2)">${l.num_contrato ? `#${l.num_contrato}` : '—'}</td>
      <td>
        <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px"
          onclick="abrirModalLocacao('${l.id}')">📋 Detalhes</button>
      </td>
    </tr>`).join('');
}
