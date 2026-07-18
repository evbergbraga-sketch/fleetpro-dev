// locacoes.js — Aba de Locações em andamento + Checklist de vistoria

// allLocacoesCompletas declarado em config.js
let _checklistItens = [];      // itens padrão do checklist

// ══ RENDER LISTA DE LOCAÇÕES ══
function renderLocacoes(){
  const tb = document.getElementById('tb-locacoes');
  if(!tb) return;
  const ativas = allLocacoesCompletas.filter(l=>l.status==='ativa');
  if(!ativas.length){
    tb.innerHTML='<tr class="empty-row"><td colspan="7">Nenhuma locação ativa no momento</td></tr>';
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

    // Devolução com horário (se disponível) e horário de disponibilidade real (+4h de buffer)
    const fimDt = l.data_fim_hora ? new Date(l.data_fim_hora) : null;
    const devolucaoTxt = fimDt ? _fmtDtLocacao(l.data_fim_hora) : fmtData(l.data_fim);
    let disponivelTxt = '—';
    if(fimDt){
      const disponivelDt = new Date(fimDt.getTime() + 4*60*60*1000); // +4h buffer
      disponivelTxt = _fmtDtLocacao(disponivelDt.toISOString());
    }

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
      <td>${devolucaoTxt}</td>
      <td><span style="font-size:12px;color:var(--muted)">🧹 ${disponivelTxt}</span></td>
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
      asaas_subscription_id,
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
  const formas = ['PIX','Cartão Crédito','Cartão Débito','Dinheiro','Transferência','Boleto'];
  for(const f of formas){ if(desc.includes(f)) return f; }
  return null;
}

function _descSemForma(desc){
  if(!desc) return desc;
  const partes = desc.split(' — ');
  const last = partes[partes.length-1];
  const formas = ['PIX','Cartão Crédito','Cartão Débito','Dinheiro','Transferência','Boleto'];
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

  const podeEditar = ['admin','gerente'].includes(currentPerfil?.perfil);
  const linhas = lancamentos.map(l=>`
    <div style="display:grid;grid-template-columns:90px 1fr 110px 100px ${podeEditar && l.origem==='checklist_entrada' ? '60px' : ''};align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border)">
      <div style="font-size:11px;color:var(--muted)">${fmtDataHora(l.data||l.created_at)}</div>
      <div style="font-size:12px">
        <span style="margin-right:4px">${origemIcon[l.origem]||'💰'}</span>${_descSemForma(l.descricao)||l.categoria||'—'}
        <span style="font-size:10px;color:var(--muted2);margin-left:4px">(${origemLabel[l.origem]||l.origem||'—'})</span>
      </div>
      <div style="font-size:11px;color:var(--muted)">${l.forma_pgto || _extrairFormaDescricao(l.descricao) || '—'}</div>
      <div style="font-size:12px;font-weight:600;text-align:right;color:${l.tipo==='despesa'?'var(--red)':'var(--green)'}">
        ${l.tipo==='despesa'?'−':'+'} R$ ${Number(l.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </div>
      ${podeEditar && l.origem==='checklist_entrada' ? `
        <button onclick="_editarValorLancamento('${l.id}',${l.valor})" style="font-size:11px;padding:3px 8px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;white-space:nowrap">Editar</button>
      ` : ''}
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
        <option>Dinheiro</option><option>PIX</option><option>Cartão Débito</option><option>Cartão Crédito</option><option>Boleto</option>
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
        <div style="font-size:12px"><strong>Total contrato:</strong> <span style="color:var(--accent);font-weight:700">R$ ${(loc.total||0).toFixed(2).replace('.',',')}</span></div>
        ${loc.caucao>0?`<div style="font-size:12px"><strong>Caução:</strong> R$ ${(loc.caucao||0).toFixed(2).replace('.',',')} (${loc.forma_pgto_caucao||'—'})</div>`:''}
        ${(loc.valor_pago_ato||0)>0?`<div style="font-size:12px"><strong>Pago no ato:</strong> <span style="color:var(--green,#16a34a);font-weight:600">R$ ${(loc.valor_pago_ato||0).toFixed(2).replace('.',',')}</span> (${loc.forma_pgto||'—'})</div>`:'<div style="font-size:12px;color:var(--muted)">Nenhum pagamento no ato</div>'}
        ${(loc.valor_restante||0)>0?`<div style="font-size:12px"><strong>Saldo restante:</strong> <span style="color:var(--red,#dc2626);font-weight:600">R$ ${(loc.valor_restante||0).toFixed(2).replace('.',',')}</span></div>`:'<div style="font-size:12px;color:var(--green,#16a34a)"><strong>✓ Quitado</strong></div>'}
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
      </button>
      <button id="tab-cancelar" class="loc-tab" onclick="showLocTab('cancelar')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--red);border-bottom:2px solid transparent;margin-bottom:-2px">
        ✕ Cancelar
      </button>` : ''}
    </div>

    <!-- KM RODADO NO CONTRATO -->
    ${(()=>{
      const kmSai = checkSaida?.km ?? loc.km_inicial;
      const kmVol = checkEntrada?.km ?? loc.km_final;
      if(kmSai==null && kmVol==null) return '';
      const fmt = n => Number(n).toLocaleString('pt-BR');
      if(kmSai!=null && kmVol!=null){
        const rodado = kmVol - kmSai;
        return `<div style="display:flex;align-items:center;gap:10px;background:rgba(79,70,229,.07);border:1px solid rgba(79,70,229,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size:13px;color:var(--text)"><b style="color:#4F46E5">Rodou ${fmt(rodado)} km</b> neste contrato <span style="color:var(--muted)">— saída ${fmt(kmSai)} km → volta ${fmt(kmVol)} km</span></div>
        </div>`;
      }
      return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:10px 14px;margin-bottom:14px">
        <div style="font-size:13px;color:var(--muted)">🛣️ Saída com <b style="color:var(--text)">${fmt(kmSai)} km</b> — km rodado será calculado na devolução</div>
      </div>`;
    })()}

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

    <!-- PAINEL CANCELAR -->
    ${loc.status==='ativa' ? `
    <div id="painel-cancelar" style="display:none">
      <div style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:12px;padding:20px;margin-top:8px">
        <div style="font-size:14px;font-weight:700;color:var(--red);margin-bottom:12px">⚠️ Cancelar Locação</div>
        <div style="font-size:13px;color:var(--text);margin-bottom:16px">
          O veículo voltará ao status <strong>disponível</strong>. Esta ação não pode ser desfeita.
        </div>
        <label style="font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:6px">Motivo do cancelamento</label>
        <textarea id="loc-cancel-motivo" rows="3" placeholder="Descreva o motivo..." style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border2);border-radius:8px;background:var(--bg2);color:var(--text);font-size:13px;resize:vertical"></textarea>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;cursor:pointer">
          <input type="checkbox" id="loc-cancel-remover-lanc" style="width:16px;height:16px;cursor:pointer">
          Remover lançamentos financeiros deste contrato
        </label>
        <button onclick="cancelarLocacao('${locId}')" style="margin-top:12px;padding:10px 24px;background:var(--red);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          Confirmar Cancelamento
        </button>
      </div>
    </div>` : ''}

    <!-- CONTRATO PDF PORTAL -->
    <div style="margin-top:16px;padding:14px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px">
      <div style="font-size:12px;font-weight:700;color:var(--muted2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">📄 Contrato PDF — Portal do Cliente</div>
      ${loc.contrato_pdf_url ? `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <a href="${loc.contrato_pdf_url}" target="_blank" style="font-size:13px;color:var(--accent);font-weight:600">📄 Ver contrato atual</a>
          <button onclick="_locRemoverContratoPdf('${locId}')" style="font-size:11px;color:var(--red);background:none;border:none;cursor:pointer">Remover</button>
        </div>
      ` : '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Nenhum PDF enviado ainda.</div>'}
      <label style="cursor:pointer;padding:6px 14px;background:var(--accent);color:#fff;border-radius:8px;font-size:12px;font-weight:600;display:inline-block">
        📎 Upload do PDF do Contrato
        <input type="file" accept=".pdf" style="display:none" onchange="_locUploadContratoPdf(this,'${locId}')">
      </label>
    </div>

    <!-- ANEXOS -->
    <div style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:13px;font-weight:700;color:var(--text)">📎 Arquivos e Documentos</span>
        <label style="cursor:pointer;padding:6px 14px;background:var(--accent);color:#fff;border-radius:8px;font-size:12px;font-weight:600">
          + Anexar
          <input type="file" id="loc-anexo-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display:none" onchange="_locUploadAnexos(this,'${locId}')">
        </label>
      </div>
      <div id="loc-anexos-lista" style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:12px;color:var(--muted);text-align:center;padding:16px">⏳ Carregando anexos...</div>
      </div>
    </div>
  `;

  // Carrega itens do checklist filtrado por tipo de veículo
  await _carregarItensChecklist(loc.veiculos?.tipo || 'moto');

  // Ativa os quadros de assinatura (saída/entrada) quando presentes
  if(typeof assinaturaInit === 'function'){
    assinaturaInit('chk-assinatura-saida');
    assinaturaInit('chk-assinatura-entrada');
  }

  // Carrega anexos da locação
  _locCarregarAnexos(locId);

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
  const painelCancelar = document.getElementById('painel-cancelar');
  if(painelCancelar) painelCancelar.style.display = tab==='cancelar' ? '' : 'none';
  // Mostrar bloco de custos somente na aba entrada
  const bCustos = document.getElementById('bloco-custos-devolucao');
  if(bCustos){ bCustos.style.display = tab==='entrada' ? '' : 'none'; }
  if(tab==='entrada'){ _custosDevolucao=[]; _renderCustosDevolucao(); _atualizarTotalPagamentoRestante(); }
  document.querySelectorAll('.loc-tab').forEach(t=>{
    const map = {'tab-saida':'saida','tab-entrada':'entrada','tab-estender':'estender','tab-cancelar':'cancelar'};
    const active = map[t.id]===tab;
    t.style.color = active ? (t.id==='tab-cancelar' ? 'var(--red)' : 'var(--accent)') : (t.id==='tab-cancelar' ? 'var(--red)' : 'var(--muted)');
    t.style.borderBottomColor = active ? (t.id==='tab-cancelar' ? 'var(--red)' : 'var(--accent)') : 'transparent';
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
  const assinatura = check.assinatura_url
    ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:6px">✍️ Assinatura do cliente</div><img src="${check.assinatura_url}" style="max-width:280px;width:100%;background:#fff;border:1px solid var(--border2);border-radius:8px;padding:6px">${check.pdf_url?`<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><a href="${check.pdf_url}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--accent);text-decoration:none;padding:6px 12px;background:rgba(79,70,229,.08);border:1px solid rgba(79,70,229,.25);border-radius:8px">📄 Ver PDF da vistoria assinada</a><button onclick="_chkEnviarWpp('${check.id}','${check.locacao_id}','${check.pdf_url}','${check.tipo}')" id="btn-chk-wpp-${check.id}" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#16a34a;background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.25);border-radius:8px;padding:6px 12px;cursor:pointer">💬 Enviar no WhatsApp</button></div>`:''}</div>`
    : '';
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
    ${assinatura}
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
        <label>Nova devolução <span style="font-size:10px;color:var(--muted);font-weight:400">(pode editar dia e hora)</span></label>
        <input type="datetime-local" id="est-nova-devolucao" style="width:100%;font-weight:700;color:var(--accent)">
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
          <option value="Cartão Crédito">Cartão Crédito</option>
          <option value="Cartão Débito">Cartão Débito</option>
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
      novaDevEl.value = _toDatetimeLocalValue(nova);
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

    // Nova devolução: usa o campo (editável — respeita ajuste manual de dia/hora).
    // Fallback: se por algum motivo estiver vazio, calcula por dias como antes.
    const novaDevInput = document.getElementById('est-nova-devolucao')?.value;
    let novaDataISO;
    if(novaDevInput){
      novaDataISO = _brISO(novaDevInput);
    } else {
      const fimAtual = new Date(loc.data_fim_hora||loc.data_fim+'T00:00:00');
      const novaData = new Date(fimAtual);
      novaData.setDate(novaData.getDate() + qtd*diasPorUnidade);
      novaDataISO = novaData.toISOString();
    }

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
        forma_pgto: forma||null,
        num_contrato: loc.num_contrato ? String(loc.num_contrato) : null,
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

    <!-- ASSINATURA DO CLIENTE (dedo ou caneta — tablet/celular) -->
    <div class="form-group" style="margin-bottom:16px">
      <label style="display:flex;justify-content:space-between;align-items:center">
        <span>Assinatura do cliente <span style="font-size:11px;color:var(--muted);font-weight:400">(assine com o dedo ou caneta)</span></span>
        <button type="button" onclick="assinaturaLimpar('chk-assinatura-${tipo}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;text-decoration:underline;padding:2px">Limpar</button>
      </label>
      <canvas id="chk-assinatura-${tipo}" width="600" height="180" style="width:100%;height:150px;background:#fff;border:1.5px dashed var(--border2);border-radius:10px;touch-action:none;cursor:crosshair"></canvas>
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
                <option value="Cartão Crédito">Cartão Crédito</option>
                <option value="Cartão Débito">Cartão Débito</option>
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
                <option value="Cartão Crédito">Cartão Crédito</option>
                <option value="Cartão Débito">Cartão Débito</option>
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

// ══ ENVIAR PDF DA VISTORIA PELO WHATSAPP (documento) ══
async function _chkEnviarWpp(checkId, locId, pdfUrl, tipo){
  const btn = document.getElementById(`btn-chk-wpp-${checkId}`);
  const original = btn?.textContent;
  try{
    if(btn){ btn.disabled=true; btn.textContent='⏳ Enviando...'; }
    const {data:loc} = await sb.from('locacoes').select('num_contrato, clientes(nome,telefone)').eq('id', locId).single();
    const telefone = loc?.clientes?.telefone;
    if(!telefone) throw new Error('cliente sem telefone cadastrado');

    const cfg = JSON.parse(localStorage.getItem('fp_evo_cfg')||'{}');
    if(!cfg.apiUrl && !cfg.bridgeUrl) throw new Error('Evolution API não configurada');
    const bridgeUrl = cfg.bridgeUrl || cfg.apiUrl.replace('evo.','bridge.');

    // Baixa o PDF já gerado e converte para base64 (o endpoint recebe base64)
    const resp = await fetch(pdfUrl);
    if(!resp.ok) throw new Error('falha ao baixar o PDF');
    const blob = await resp.blob();
    const base64 = await new Promise(res=>{ const r=new FileReader(); r.onloadend=()=>res(r.result); r.readAsDataURL(blob); });
    const fileName = `checklist_contrato_${loc.num_contrato||locId}_${tipo}.pdf`;

    const r = await fetch(bridgeUrl+'/api/enviar-midia', {
      method:'POST',
      headers:{'x-secret':'FleetPro2025','Content-Type':'application/json'},
      body: JSON.stringify({
        numero: fmtPhone(telefone),
        tipo: 'document',
        base64,
        fileName,
        clienteId: null,
        nomeAtendente: currentPerfil?.nome ? '👤 '+currentPerfil.nome.split(' ')[0] : '👤 Atendente'
      })
    });
    if(!r.ok){
      const t = await r.text();
      let msg = t; try{ msg = JSON.parse(t)?.error||t; }catch(_){}
      throw new Error(msg);
    }
    notify('📄 Checklist enviado no WhatsApp para '+loc.clientes.nome,'success');
    if(btn){ btn.textContent='✅ Enviado!'; btn.style.opacity='0.7'; }
  }catch(e){
    notify('Erro ao enviar: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent=original; }
  }
}

// ══ PDF DO CHECKLIST (com logo, dados da locação e assinatura datada) ══
async function _gerarPdfChecklist(loc, dados){
  if(!window.jspdf) throw new Error('jsPDF não carregado');
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const M = 15, W = 210 - M*2;
  let y = 14;

  // Logo Royal (mesmo padrão do contrato)
  try{
    const resp = await fetch('/icons/logo-Royal.png');
    const blob = await resp.blob();
    const base64 = await new Promise((resolve)=>{ const r=new FileReader(); r.onloadend=()=>resolve(r.result); r.readAsDataURL(blob); });
    doc.addImage(base64, 'PNG', M, y, 35, 20);
  }catch(_){}
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text('ROYAL RENT A CAR LTDA', M+42, y+7);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  doc.text('CNPJ: 18.686.521/0002-90', M+42, y+12);
  y += 26;

  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor('#111');
  doc.text(`CHECKLIST DE VISTORIA — ${dados.tipo==='saida'?'SAÍDA':'ENTRADA'}`, 105, y, {align:'center'});
  y += 8;
  doc.setDrawColor('#006400'); doc.setLineWidth(0.6); doc.line(M, y, 210-M, y);
  y += 7;

  // Dados da locação e do veículo
  const cli = loc.clientes||{}, vei = loc.veiculos||{};
  doc.setFontSize(9);
  const linhaInfo = (rotulo, valor, rotulo2, valor2)=>{
    doc.setFont('helvetica','bold');   doc.setTextColor('#555'); doc.text(rotulo, M, y);
    doc.setFont('helvetica','normal'); doc.setTextColor('#111'); doc.text(String(valor||'—'), M+32, y);
    if(rotulo2){
      doc.setFont('helvetica','bold');   doc.setTextColor('#555'); doc.text(rotulo2, 112, y);
      doc.setFont('helvetica','normal'); doc.setTextColor('#111'); doc.text(String(valor2||'—'), 112+30, y);
    }
    y += 5.5;
  };
  linhaInfo('Contrato nº:', loc.num_contrato||'—', 'Data/hora:', dados.hora ? new Date(dados.hora).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : new Date().toLocaleString('pt-BR'));
  linhaInfo('Cliente:', cli.nome, 'CPF:', cli.cpf);
  linhaInfo('Telefone:', cli.telefone, 'E-mail:', cli.email);
  linhaInfo('Veículo:', `${vei.marca||''} ${vei.modelo||''}`.trim(), 'Placa:', vei.placa);
  linhaInfo('Cor:', vei.cor, 'Km:', dados.km!=null ? dados.km+' km' : '—');
  linhaInfo('Combustível:', dados.comb||'—', 'Consultor:', currentPerfil?.nome||'—');
  y += 3;

  // Itens vistoriados
  const itens = dados.itens||[];
  if(itens.length){
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
    doc.text('ITENS VISTORIADOS', M, y); y += 5;
    doc.setFontSize(8.2);
    const col2 = M + W/2;
    itens.forEach((it, i)=>{
      const x = (i % 2 === 0) ? M : col2;
      if(i % 2 === 0 && y > 250){ doc.addPage(); y = 20; }
      const comAvaria = it.status==='avaria';
      doc.setFont('helvetica','bold');
      doc.setTextColor(comAvaria ? '#b91c1c' : '#166534');
      doc.text(comAvaria ? 'AVARIA' : 'OK', x, y);
      doc.setFont('helvetica','normal');
      doc.setTextColor('#111');
      let txt = it.descricao || '';
      if(comAvaria && it.obs) txt += ` — ${it.obs}`;
      doc.text(doc.splitTextToSize(txt, W/2 - 20), x+15, y);
      if(i % 2 === 1) y += 5;
    });
    if(itens.length % 2 === 1) y += 5;
    y += 3;
  }

  // Fotos da vistoria (baixa cada URL e embute como imagem — grade 3 colunas)
  const fotos = (dados.fotos||[]).filter(Boolean);
  if(fotos.length){
    if(y > 240){ doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
    doc.text('FOTOS DA VISTORIA', M, y); y += 6;
    const cols = 3, gap = 4;
    const cw = (W - gap*(cols-1)) / cols, ch = cw * 0.75;
    for(let i=0; i<fotos.length; i++){
      const col = i % cols;
      if(col === 0 && i>0) y += ch + gap;
      if(y + ch > 280){ doc.addPage(); y = 20; }
      try{
        const resp = await fetch(fotos[i]);
        const blob = await resp.blob();
        const b64 = await new Promise(res=>{ const r=new FileReader(); r.onloadend=()=>res(r.result); r.readAsDataURL(blob); });
        const formato = blob.type.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(b64, formato, M + col*(cw+gap), y, cw, ch);
      }catch(e){ console.warn('[chk/pdf foto]', e.message); }
    }
    y += ch + 8;
  }

  // Observações
  if(dados.obs){
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
    doc.text('OBSERVAÇÕES', M, y); y += 5;
    doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor('#111');
    const linhas = doc.splitTextToSize(dados.obs, W);
    doc.text(linhas, M, y);
    y += linhas.length*4 + 4;
  }

  // Assinatura — com local e data por extenso (exigência: "Rio de Janeiro, ...")
  if(y > 225){ doc.addPage(); y = 30; }
  y = Math.max(y+8, 210);
  const dataExtenso = new Date().toLocaleDateString('pt-BR', {day:'numeric', month:'long', year:'numeric'});
  doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor('#111');
  doc.text(`Rio de Janeiro, ${dataExtenso}.`, 105, y, {align:'center'});
  y += 6;
  if(dados.assinaturaDataUrl){
    doc.addImage(dados.assinaturaDataUrl, 'PNG', 105-35, y, 70, 21);
    y += 23;
  } else {
    y += 20;
  }
  doc.setDrawColor('#333'); doc.setLineWidth(0.3);
  doc.line(105-40, y, 105+40, y); y += 4.5;
  doc.setFontSize(9); doc.setFont('helvetica','bold');
  doc.text(cli.nome||'Cliente', 105, y, {align:'center'}); y += 4;
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#555');
  doc.text(cli.cpf ? `CPF: ${cli.cpf}` : '', 105, y, {align:'center'});

  return doc.output('blob');
}

// ══ SALVAR CHECKLIST ══
async function salvarChecklist(tipo, locId){
  const km     = parseInt(document.getElementById(`chk-km-${tipo}`)?.value)||null;
  const comb   = document.getElementById(`chk-comb-${tipo}`)?.value||'';
  const hora   = _brISO(document.getElementById(`chk-hora-${tipo}`)?.value) || new Date().toISOString();
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
  _showLoading('Salvando vistoria...'); // overlay central "Aguarde..." (mesmo do contrato)

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
    if(fotos.length) _showLoading(`Enviando ${fotos.length} foto${fotos.length!==1?'s':''}...`);
    const fotoUrls = [];
    for(const file of fotos){
      const ext = file.name.split('.').pop();
      const path = `${locId}/${tipo}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const {data:up, error:upErr} = await sb.storage.from('checklists').upload(path, file);
      if(upErr) throw upErr;
      const {data:signData} = await sb.storage.from('checklists').createSignedUrl(path, 60*60*24*365);
      fotoUrls.push(signData?.signedUrl || '');
    }

    // Upload da assinatura do cliente (se assinou)
    let assinaturaUrl = null, assinaturaDataUrl = null;
    if(typeof assinaturaVazia === 'function' && !assinaturaVazia(`chk-assinatura-${tipo}`)){
      assinaturaDataUrl = document.getElementById(`chk-assinatura-${tipo}`)?.toDataURL('image/png') || null;
      assinaturaUrl = await assinaturaUpload(
        `chk-assinatura-${tipo}`, 'checklists',
        `${locId}/${tipo}/assinatura_${Date.now()}.png`
      );
    }

    // Se assinou: gera o PDF da vistoria (logo Royal + dados + assinatura datada)
    let pdfUrl = null;
    if(assinaturaDataUrl){
      _showLoading('Gerando PDF da vistoria...');
      try{
        const {data:locFull} = await sb.from('locacoes')
          .select('*, clientes(*), veiculos(*)').eq('id', locId).single();
        const pdfBlob = await _gerarPdfChecklist(locFull, {tipo, km, comb, hora, itens, obs, assinaturaDataUrl, fotos: fotoUrls});
        const numCt = locFull?.num_contrato || locId;
        const pdfPath = `${locId}/${tipo}/checklist_contrato_${numCt}_${tipo}.pdf`;
        const {error:pdfErr} = await sb.storage.from('checklists').upload(pdfPath, pdfBlob, {contentType:'application/pdf'});
        if(pdfErr) throw pdfErr;
        const {data:pdfSign} = await sb.storage.from('checklists').createSignedUrl(pdfPath, 60*60*24*365*5);
        pdfUrl = pdfSign?.signedUrl || null;
        // Envio automático por e-mail removido — o consultor envia manualmente
        // pelo botão "💬 Enviar no WhatsApp" que aparece após salvar a vistoria.
      }catch(e){
        console.warn('[chk/pdf]', e.message);
        notify('Vistoria salva, mas o PDF falhou: '+e.message, 'error');
      }
    }

    // Salva checklist no banco
    _showLoading('Registrando vistoria...');
    const {error} = await sb.from('checklists').insert({
      locacao_id: locId,
      tipo,
      km,
      combustivel: comb,
      horario: hora,
      consultor_id: currentUser?.id,
      itens,
      observacoes: obs,
      fotos: fotoUrls,
      assinatura_url: assinaturaUrl,
      pdf_url: pdfUrl
    });
    if(error) throw error;

    // ── QUILOMETRAGEM: registra no contrato e atualiza o veículo ──
    // Saída → locacoes.km_inicial | Entrada → locacoes.km_final.
    // O veículo (km_atual) acompanha sempre a última leitura da vistoria.
    if(km != null){
      try{
        await sb.from('locacoes').update(tipo==='saida' ? {km_inicial: km} : {km_final: km}).eq('id', locId);
        const {data:lVei} = await sb.from('locacoes').select('veiculo_id').eq('id', locId).single();
        if(lVei?.veiculo_id){
          await sb.from('veiculos').update({km_atual: km}).eq('id', lVei.veiculo_id);
          // Mantém o cache local coerente (frota renderiza sem novo fetch)
          if(typeof allVeiculos !== 'undefined'){
            const v = allVeiculos.find(x=>x.id===lVei.veiculo_id);
            if(v) v.km_atual = km;
          }
        }
      }catch(e){ console.warn('[chk/km]', e.message); }
    }

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
          forma_pgto:   custo.forma_pgto||null,
          num_contrato: loc?.num_contrato ? String(loc.num_contrato) : null,
        });
      }
      _custosDevolucao = []; // limpa após salvar
      notify(`${qtdCustos} pagamento(s) de devolução registrados no financeiro!`,'success');
    }

    // Se for entrada: registra pagamento do restante, fecha contrato e libera veículo
    if(tipo==='entrada'){
      const loc = (await sb.from('locacoes').select('*, veiculos(*), clientes(*)').eq('id', locId).single()).data;

      if(pgrInfo && pgrInfo.restanteContrato > 0){
        const descBase = `Contrato #${loc?.num_contrato||locId.slice(0,8)} — ${loc?.clientes?.nome||''} — ${loc?.veiculos?.placa||''} — Saldo final`;
        // Lança apenas o restante do contrato (custos extras são lançados separadamente)
        // Se pagou em 2 formas, distribui proporcionalmente ao restante do contrato
        const proporcao = pgrInfo.totalAReceber > 0 ? pgrInfo.restanteContrato / pgrInfo.totalAReceber : 1;
        const v1 = pgrInfo.custosTotal > 0 ? Math.round(pgrInfo.valor1 * proporcao * 100) / 100 : pgrInfo.valor1;
        const v2 = pgrInfo.custosTotal > 0 ? Math.round(pgrInfo.valor2 * proporcao * 100) / 100 : pgrInfo.valor2;

        if(v1 > 0){
          await sb.from('lancamentos').insert({
            tipo:'receita', categoria:'Aluguel', descricao: descBase+` — ${pgrInfo.forma1}`,
            valor: v1, data: new Date().toISOString().slice(0,10),
            veiculo_id: loc?.veiculo_id||null, locacao_id: locId,
            origem:'checklist_entrada', criado_por: currentUser?.id,
            forma_pgto: pgrInfo.forma1||null,
            num_contrato: loc?.num_contrato ? String(loc.num_contrato) : null,
          });
        }
        if(v2 > 0){
          await sb.from('lancamentos').insert({
            tipo:'receita', categoria:'Aluguel', descricao: descBase+` (2ª forma) — ${pgrInfo.forma2}`,
            valor: v2, data: new Date().toISOString().slice(0,10),
            veiculo_id: loc?.veiculo_id||null, locacao_id: locId,
            origem:'checklist_entrada', criado_por: currentUser?.id,
            forma_pgto: pgrInfo.forma2||null,
            num_contrato: loc?.num_contrato ? String(loc.num_contrato) : null,
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
  }finally{
    _hideLoading();
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
    <div id="custo-row-${c.id}" style="display:grid;grid-template-columns:28px 1fr 100px 1fr 130px 28px;gap:8px;align-items:center;padding:10px 12px;margin-bottom:6px;background:var(--bg3,var(--bg));border-radius:10px;border:1px solid var(--border2)">
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
      <div>
        <div style="font-size:9px;color:var(--muted2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">Forma Pgto</div>
        <select onchange="_custosDevolucao.find(x=>x.id===${c.id}).forma_pgto=this.value"
          style="width:100%;font-size:12px;padding:5px 8px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text)">
          <option value="">—</option>
          <option value="Dinheiro"${c.forma_pgto==='Dinheiro'?' selected':''}>Dinheiro</option>
          <option value="PIX"${c.forma_pgto==='PIX'?' selected':''}>PIX</option>
          <option value="Cartão Débito"${c.forma_pgto==='Cartão Débito'?' selected':''}>Cartão Débito</option>
          <option value="Cartão Crédito"${c.forma_pgto==='Cartão Crédito'?' selected':''}>Cartão Crédito</option>
          <option value="Transferência"${c.forma_pgto==='Transferência'?' selected':''}>Transferência</option>
          <option value="Boleto"${c.forma_pgto==='Boleto'?' selected':''}>Boleto</option>
          <option value="Asaas"${c.forma_pgto==='Asaas'?' selected':''}>Asaas</option>
        </select>
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

// ── ANEXOS DA LOCAÇÃO ──
async function _locCarregarAnexos(locId){
  const lista = document.getElementById('loc-anexos-lista');
  if(!lista) return;
  try{
    const {data,error} = await sb.from('locacao_anexos')
      .select('*,perfis(nome)')
      .eq('locacao_id', locId)
      .order('created_at',{ascending:false});
    if(error) throw error;
    if(!data?.length){
      lista.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:16px;border:1.5px dashed var(--border2);border-radius:8px">Nenhum arquivo anexado ainda</div>`;
      return;
    }
    lista.innerHTML = data.map(a=>{
      const ext   = a.nome.split('.').pop().toLowerCase();
      const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext);
      const isPdf = ext === 'pdf';
      const icon  = isImg ? '🖼️' : isPdf ? '📄' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx'].includes(ext) ? '📊' : '📎';
      const tam   = a.tamanho ? (a.tamanho > 1024*1024 ? (a.tamanho/1024/1024).toFixed(1)+'MB' : Math.round(a.tamanho/1024)+'KB') : '';
      const data_fmt = new Date(a.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
      const quem = a.perfis?.nome?.split(' ')[0]||'';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px">
        <span style="font-size:20px;flex-shrink:0">${icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.nome}</div>
          <div style="font-size:10px;color:var(--muted)">${tam} · ${data_fmt}${quem?' · '+quem:''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <a href="${a.url}" target="_blank" style="padding:5px 10px;font-size:11px;background:rgba(99,102,241,.12);color:var(--accent);border:1px solid rgba(99,102,241,.25);border-radius:6px;text-decoration:none;font-weight:600">👁 Ver</a>
          <button onclick="_locExcluirAnexo('${a.id}','${a.url}','${locId}')" style="padding:5px 8px;font-size:11px;background:none;color:var(--muted);border:1px solid var(--border2);border-radius:6px;cursor:pointer" onmouseover="this.style.color='#F87171'" onmouseout="this.style.color='var(--muted)'">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    if(lista) lista.innerHTML = `<div style="font-size:12px;color:var(--red)">Erro ao carregar: ${e.message}</div>`;
  }
}

async function _locUploadAnexos(input, locId){
  const files = Array.from(input.files);
  if(!files.length) return;
  const lista = document.getElementById('loc-anexos-lista');
  if(lista) lista.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:16px">⏳ Enviando ${files.length} arquivo(s)...</div>`;

  try{
    for(const file of files){
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `locacoes/${locId}/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
      const {data:up, error:upErr} = await sb.storage.from('locacoes-docs').upload(path, file, {upsert:false});
      if(upErr) throw upErr;
      const {data:{publicUrl}} = sb.storage.from('locacoes-docs').getPublicUrl(path);
      const tipo = ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'imagem' : ext==='pdf' ? 'pdf' : ['doc','docx'].includes(ext) ? 'documento' : 'outro';
      await sb.from('locacao_anexos').insert({
        locacao_id: locId,
        nome: file.name,
        url: publicUrl,
        tipo,
        tamanho: file.size,
        criado_por: currentUser?.id||null,
      });
    }
    notify(`${files.length} arquivo(s) anexado(s)!`,'success');
  }catch(e){
    notify('Erro no upload: '+e.message,'error');
  }finally{
    input.value = '';
    _locCarregarAnexos(locId);
  }
}

async function _locExcluirAnexo(id, url, locId){
  if(!await fpConfirm('Remover este arquivo?', 'Remover arquivo')) return;
  try{
    // Extrai o path do Storage da URL pública
    const match = url.match(/locacoes-docs\/(.+)$/);
    if(match) await sb.storage.from('locacoes-docs').remove([match[1]]);
    await sb.from('locacao_anexos').delete().eq('id', id);
    notify('Arquivo removido','success');
    _locCarregarAnexos(locId);
  }catch(e){ notify('Erro: '+e.message,'error'); }
}

// ══ CANCELAR LOCAÇÃO ══
async function cancelarLocacao(id){
  const motivo = document.getElementById('loc-cancel-motivo')?.value?.trim() || '';
  if(!motivo){ notify('Informe o motivo do cancelamento','error'); return; }
  if(!await fpConfirm('Confirmar cancelamento desta locação? O veículo voltará a ficar disponível.', 'Cancelar locação')) return;

  const loc = allLocacoesCompletas?.find(l=>l.id===id);
  if(!loc){ notify('Locação não encontrada','error'); return; }

  const btn = document.querySelector('#painel-cancelar button');
  if(btn){ btn.disabled=true; btn.textContent='Cancelando...'; }

  try{
    const obsAtual = loc.observacoes || '';
    const novaObs  = obsAtual
      ? `${obsAtual}\n[CANCELADO] ${motivo}`
      : `[CANCELADO] ${motivo}`;

    const {error} = await sb.from('locacoes')
      .update({ status:'cancelada', observacoes: novaObs })
      .eq('id', id);
    if(error) throw error;

    // Cancela a assinatura recorrente no Asaas — falha aqui não impede o
    // cancelamento local (mas avisa, pra cancelar manualmente se precisar).
    // Log sempre presente no console, mesmo quando não há nada a cancelar —
    // facilita diagnosticar sem precisar olhar log do servidor.
    console.log('[cancelar/asaas] locação', id, '— asaas_subscription_id:', loc.asaas_subscription_id||'(nenhum)');
    if(loc.asaas_subscription_id){
      try{
        const cfg = JSON.parse(localStorage.getItem('fp_evo_cfg')||'{}');
        const bridgeUrl = cfg.bridgeUrl || (cfg.apiUrl ? cfg.apiUrl.replace('evo.','bridge.') : null);
        if(bridgeUrl){
          const r = await fetch(bridgeUrl+'/api/asaas/cancelar-assinatura', {
            method:'POST',
            headers:{'x-secret':'FleetPro2025','Content-Type':'application/json'},
            body: JSON.stringify({ subscriptionId: loc.asaas_subscription_id })
          });
          if(!r.ok){
            const t = await r.text();
            notify('Locação cancelada, mas a assinatura no Asaas não foi cancelada automaticamente — cancele manualmente lá. ('+t.slice(0,120)+')', 'error');
          } else {
            console.log('[cancelar/asaas] assinatura cancelada com sucesso:', loc.asaas_subscription_id);
          }
        } else {
          console.warn('[cancelar/asaas] bridgeUrl não configurado (fp_evo_cfg) — não deu pra tentar cancelar');
          notify('Locação cancelada, mas não há como cancelar a assinatura no Asaas automaticamente (bridge não configurado) — cancele manualmente: '+loc.asaas_subscription_id, 'error');
        }
      }catch(e){
        console.warn('[cancelar/asaas]', e.message);
        notify('Locação cancelada, mas houve erro ao cancelar a assinatura no Asaas — verifique manualmente: '+loc.asaas_subscription_id, 'error');
      }
    }

    // Libera veículo
    await sb.from('veiculos').update({status:'disponivel'}).eq('id', loc.veiculo_id);

    // Remove lançamentos financeiros se solicitado
    const removerLanc = document.getElementById('loc-cancel-remover-lanc')?.checked;
    if(removerLanc){
      // Zera referências FK antes de deletar (evita 409 Conflict)
      const {data: lancsIds} = await sb.from('lancamentos').select('id').eq('locacao_id', id);
      if(lancsIds?.length){
        const ids = lancsIds.map(l=>l.id);
        await sb.from('contas_pagar').update({lancamento_id: null}).in('lancamento_id', ids);
        await sb.from('cobrancas_semanais').update({lancamento_id: null}).in('lancamento_id', ids);
      }
      await sb.from('lancamentos').delete().eq('locacao_id', id);
      await sb.from('cobrancas_semanais').delete().eq('locacao_id', id);
    }

    notify('Locação cancelada com sucesso.','success');
    closeModal('locacao-detalhe');
    await carregarTudo();
    renderLocacoes();
  }catch(e){
    notify('Erro: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent='Confirmar Cancelamento'; }
  }
}

// ══ UPLOAD CONTRATO PDF — PORTAL ══
async function _locUploadContratoPdf(input, locId) {
  const file = input.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { notify('Apenas PDF é aceito.', 'error'); return; }
  if (file.size > 15 * 1024 * 1024) { notify('Arquivo muito grande (máx 15MB).', 'error'); return; }

  notify('Enviando PDF...', 'info');
  try {
    const path = `${locId}/contrato_${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage.from('locacoes-docs').upload(path, file, { upsert: true });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = sb.storage.from('locacoes-docs').getPublicUrl(path);
    const { error } = await sb.from('locacoes').update({ contrato_pdf_url: publicUrl }).eq('id', locId);
    if (error) throw error;

    notify('Contrato PDF salvo! Disponível no portal do cliente.', 'success');
    await carregarTudo();
    abrirDetalhesLocacao(locId);
  } catch(e) { notify('Erro: ' + e.message, 'error'); }
}

async function _locRemoverContratoPdf(locId) {
  if(!await fpConfirm('Remover o PDF do contrato do portal?', 'Remover PDF')) return;
  const { error } = await sb.from('locacoes').update({ contrato_pdf_url: null }).eq('id', locId);
  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify('PDF removido.', 'success');
  await carregarTudo();
  abrirDetalhesLocacao(locId);
}

// ══ EDITAR VALOR DE LANÇAMENTO (admin/gerente) ══
async function _editarValorLancamento(lancId, valorAtual){
  if(!['admin','gerente'].includes(currentPerfil?.perfil)){
    notify('Sem permissão para editar lançamentos.','error'); return;
  }
  const novoValorStr = await fpPrompt('Valor atual: R$ '+Number(valorAtual).toFixed(2).replace('.',','), 'Editar valor do lançamento', {defaultValue: Number(valorAtual).toFixed(2), placeholder:'0.00'});
  if(novoValorStr === null) return; // cancelou
  const novoValor = parseFloat(novoValorStr.replace(',','.'));
  if(isNaN(novoValor) || novoValor < 0){ notify('Valor inválido.','error'); return; }
  if(!await fpConfirm(`Confirmar alteração para R$ ${novoValor.toFixed(2).replace('.',',')}?`, 'Alterar valor')) return;
  try{
    const {error} = await sb.from('lancamentos').update({valor: novoValor}).eq('id', lancId);
    if(error) throw error;
    notify('Valor atualizado com sucesso!','success');
    // Recarrega o modal da locação ativa
    const locId = document.querySelector('#modal-locacao-detalhe [data-loc-id]')?.dataset?.locId
      || document.querySelector('.modal-overlay.show')?.querySelector('[data-loc-id]')?.dataset?.locId;
    await carregarTudo();
    if(locId) abrirDetalhesLocacao(locId);
  }catch(e){ notify('Erro: '+e.message,'error'); }
}
