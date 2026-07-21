// multas.js — Módulo de Multas (Fase 1 MVP)
// Multa é tratada como registro operacional: nasce vinculada ao veículo,
// identifica o cliente pelo período da locação, e fica disponível no
// histórico do veículo e do cliente. Fase 2 (cobrança/taxa administrativa)
// e Fase 3 (WhatsApp automático) ainda não estão neste módulo.

let _mtDados = [];           // multas carregadas (com joins de veiculo/cliente)
let _mtAnexosExistentes = []; // urls já salvas (editando)
let _mtAnexosNovos = [];      // File objects pendentes de upload
let _mtUltimoAutoLocId = null; // locação preenchida automaticamente pela última auto-detecção

const _mtFmt = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});

const _MT_STATUS_LABEL = {
  recebida:'Recebida', cliente_identificado:'Cliente identificado', em_cobranca:'Em cobrança',
  pago_cliente:'Pago pelo cliente', pago_locadora:'Pago pela locadora', reembolsado:'Reembolsado',
  em_recurso:'Em recurso', cancelada:'Cancelada',
};
const _MT_STATUS_FINAL = ['pago_cliente','pago_locadora','reembolsado','cancelada'];

// ══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO / CARGA
// ══════════════════════════════════════════════════════════════
async function iniciarMultas(){
  await carregarMultas();
  _mtPopularSelectsFiltro();
  renderCardsMultas();
  renderMultas();
}

async function carregarMultas(){
  try{
    const {data, error} = await sb.from('multas')
      .select('*,veiculos(marca,modelo,placa,tipo,foto_url),clientes(nome,telefone)')
      .order('data_infracao',{ascending:false})
      .limit(1000);
    if(error) throw error;
    _mtDados = data||[];
  }catch(e){
    console.warn('[multas]', e.message);
    _mtDados = [];
    notify('Erro ao carregar multas: '+e.message,'error');
  }
}

function _mtPopularSelectsFiltro(){
  const selV = document.getElementById('mt-f-veiculo');
  const selC = document.getElementById('mt-f-cliente');
  if(selV && selV.options.length<=1){
    selV.innerHTML = '<option value="">Todos os veículos</option>' +
      (allVeiculos||[]).map(v=>`<option value="${v.id}">${v.marca} ${v.modelo} — ${v.placa}</option>`).join('');
  }
  if(selC && selC.options.length<=1){
    selC.innerHTML = '<option value="">Todos os clientes</option>' +
      (allClientes||[]).filter(c=>c.tipo!=='lead').map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  }
}

// ══════════════════════════════════════════════════════════════
// STATUS / BADGE (vencida é sempre calculada, nunca armazenada —
// evita a inconsistência que já corrigimos em outro módulo)
// ══════════════════════════════════════════════════════════════
function _mtEhVencida(m){
  if(!m.data_vencimento) return false;
  if(_MT_STATUS_FINAL.includes(m.status)) return false;
  return m.data_vencimento < new Date().toISOString().slice(0,10);
}
function _mtBadge(m){
  if(_mtEhVencida(m)) return {label:'⚠️ Vencida', cls:'badge-red'};
  const map = {
    recebida:'badge-gray', cliente_identificado:'badge-blue', em_cobranca:'badge-yellow',
    pago_cliente:'badge-green', pago_locadora:'badge-purple', reembolsado:'badge-green',
    em_recurso:'badge-purple', cancelada:'badge-gray',
  };
  return {label:_MT_STATUS_LABEL[m.status]||m.status, cls:map[m.status]||'badge-gray'};
}
function _mtValorCobrado(m){ return m.valor_desconto!=null ? parseFloat(m.valor_desconto) : parseFloat(m.valor_original)||0; }

// ══════════════════════════════════════════════════════════════
// CARDS DE RESUMO
// ══════════════════════════════════════════════════════════════
function renderCardsMultas(){
  const hoje = new Date();
  const iniMes = hoje.toISOString().slice(0,7)+'-01';

  const pendentes = _mtDados.filter(m=>m.status==='recebida');
  const aReceber  = _mtDados.filter(m=>['cliente_identificado','em_cobranca'].includes(m.status));
  const vencidas  = _mtDados.filter(_mtEhVencida);
  const recurso   = _mtDados.filter(m=>m.status==='em_recurso');
  const pagasMes  = _mtDados.filter(m=>['pago_cliente','pago_locadora'].includes(m.status) &&
    (m.data_pagamento||m.updated_at||'').slice(0,10) >= iniMes);

  const soma = arr => arr.reduce((a,b)=>a+_mtValorCobrado(b),0);
  const set = (id,n,val) => {
    const elN = document.getElementById(id), elS = document.getElementById(id+'-s');
    if(elN) elN.textContent = n;
    if(elS) elS.textContent = _mtFmt(val);
  };
  set('mt-c-pendentes', pendentes.length, soma(pendentes));
  set('mt-c-receber',   aReceber.length,  soma(aReceber));
  set('mt-c-vencidas',  vencidas.length,  soma(vencidas));
  set('mt-c-recurso',   recurso.length,   soma(recurso));
  set('mt-c-pagas',     pagasMes.length,  soma(pagasMes));
}

// ══════════════════════════════════════════════════════════════
// LISTAGEM / FILTROS
// ══════════════════════════════════════════════════════════════
function renderMultas(){
  const tb = document.getElementById('tb-multas');
  if(!tb) return;

  const busca = (document.getElementById('mt-f-busca')?.value||'').toLowerCase().trim();
  const status = document.getElementById('mt-f-status')?.value||'';
  const veiId  = document.getElementById('mt-f-veiculo')?.value||'';
  const cliId  = document.getElementById('mt-f-cliente')?.value||'';
  const de     = document.getElementById('mt-f-de')?.value||'';
  const ate    = document.getElementById('mt-f-ate')?.value||'';

  let lista = _mtDados.filter(m=>{
    if(busca){
      const alvo = [m.numero_auto, m.veiculos?.placa, m.veiculos?.modelo, m.clientes?.nome, m.tipo_infracao]
        .filter(Boolean).join(' ').toLowerCase();
      if(!alvo.includes(busca)) return false;
    }
    if(status==='vencida'){ if(!_mtEhVencida(m)) return false; }
    else if(status && m.status!==status) return false;
    if(veiId && m.veiculo_id!==veiId) return false;
    if(cliId && m.cliente_id!==cliId) return false;
    if(de  && m.data_infracao < de)  return false;
    if(ate && m.data_infracao > ate) return false;
    return true;
  });

  if(!lista.length){
    tb.innerHTML = '<tr class="empty-row"><td colspan="8">Nenhuma multa encontrada</td></tr>';
    return;
  }

  tb.innerHTML = lista.map(m=>{
    const badge = _mtBadge(m);
    const dtInfr = m.data_infracao ? fmtData(m.data_infracao) + (m.hora_infracao?' às '+m.hora_infracao.slice(0,5):'') : '—';
    const veic = m.veiculos ? `${m.veiculos.marca||''} ${m.veiculos.modelo||''}`.trim() : '—';
    const vTipo = m.veiculos?.tipo||'carro';
    const vThumb = m.veiculos
      ? `<div class="vi ${m.veiculos.foto_url?'vi-foto':(vTipo==='carro'?'vi-car':'vi-moto')}">${m.veiculos.foto_url?`<img src="${m.veiculos.foto_url}" onerror="this.parentElement.className='vi ${vTipo==='carro'?'vi-car':'vi-moto'}';this.parentElement.innerHTML=SVG_VEICULO('${vTipo}')">`:SVG_VEICULO(vTipo)}</div>`
      : '';
    return `<tr style="cursor:pointer" onclick="abrirDetalheMulta('${m.id}')">
      <td>${dtInfr}</td>
      <td><div style="display:flex;align-items:center;gap:10px">${vThumb}<div><div style="font-weight:500">${veic||'—'}</div><div style="font-size:11px;color:var(--muted)">${m.veiculos?.placa||''}</div></div></div></td>
      <td>${m.clientes?.nome || '<span style="color:var(--muted)">Não identificado</span>'}</td>
      <td>${m.tipo_infracao||'—'}</td>
      <td>${_mtFmt(_mtValorCobrado(m))}</td>
      <td>${m.data_vencimento?fmtData(m.data_vencimento):'—'}</td>
      <td><span class="badge ${badge.cls}">${badge.label}</span></td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="_mtAbrirEdicao('${m.id}')">✏️</button>
      </td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// MODAL CADASTRO / EDIÇÃO
// ══════════════════════════════════════════════════════════════
function _mtAbrirNovo(){
  document.getElementById('mt-modal-title').textContent = '🚨 Cadastrar Multa';
  ['mt-id','mt-numero-auto','mt-data-infracao','mt-hora-infracao','mt-local','mt-tipo','mt-codigo',
   'mt-pontuacao','mt-valor-original','mt-valor-desconto','mt-vencimento','mt-descricao',
   'mt-veiculo-busca','mt-veiculo-id','mt-cliente-busca','mt-cliente-id','mt-locacao-id',
   'mt-telefone','mt-email','mt-condutor-principal','mt-condutor-adicional','mt-observacoes'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('mt-orgao').value = 'DETRAN';
  document.getElementById('mt-status').value = 'recebida';
  document.getElementById('mt-veiculo-selecionado').textContent = '';
  document.getElementById('mt-cliente-selecionado').textContent = '';
  document.getElementById('mt-resp-auto-badge').style.display = 'none';
  _mtAnexosExistentes = [];
  _mtAnexosNovos = [];
  _mtUltimoAutoLocId = null;
  _mtRenderAnexos();
  _mtPopularSelectsFiltro();
}

function _mtAbrirEdicao(id){
  const m = id ? _mtDados.find(x=>x.id===id) : _mtDados.find(x=>x.id===document.getElementById('mtd-titulo')?.dataset?.id);
  if(!m) return;
  closeModal('multa-detalhe');
  document.getElementById('mt-modal-title').textContent = '✏️ Editar Multa';
  const sv = (elId,val) => { const el = document.getElementById(elId); if(el) el.value = val ?? ''; };
  sv('mt-id', m.id);
  sv('mt-numero-auto', m.numero_auto);
  sv('mt-orgao', m.orgao_autuador||'DETRAN');
  sv('mt-data-infracao', m.data_infracao);
  sv('mt-hora-infracao', m.hora_infracao?.slice(0,5));
  sv('mt-local', m.local_infracao);
  sv('mt-tipo', m.tipo_infracao);
  sv('mt-codigo', m.codigo_infracao);
  sv('mt-pontuacao', m.pontuacao);
  sv('mt-valor-original', m.valor_original);
  sv('mt-valor-desconto', m.valor_desconto);
  sv('mt-vencimento', m.data_vencimento);
  sv('mt-status', m.status||'recebida');
  sv('mt-descricao', m.descricao);
  sv('mt-veiculo-id', m.veiculo_id);
  sv('mt-cliente-id', m.cliente_id);
  sv('mt-locacao-id', m.locacao_id);
  sv('mt-telefone', m.telefone);
  sv('mt-email', m.email);
  sv('mt-condutor-principal', m.condutor_principal);
  sv('mt-condutor-adicional', m.condutor_adicional);
  sv('mt-observacoes', m.observacoes);
  document.getElementById('mt-veiculo-selecionado').textContent = m.veiculos
    ? `${m.veiculos.marca||''} ${m.veiculos.modelo||''} — ${m.veiculos.placa||''}` : '';
  document.getElementById('mt-cliente-selecionado').textContent = m.clientes?.nome || '';
  document.getElementById('mt-resp-auto-badge').style.display = 'none';
  _mtUltimoAutoLocId = m.locacao_id;

  try{ _mtAnexosExistentes = m.anexos_urls ? (Array.isArray(m.anexos_urls)?m.anexos_urls:JSON.parse(m.anexos_urls)) : []; }
  catch(_e){ _mtAnexosExistentes = []; }
  _mtAnexosNovos = [];
  _mtRenderAnexos();
  _mtPopularSelectsFiltro();
  document.getElementById('m-multa').classList.add('show');
}

// ── Busca veículo (autocomplete local, sem chamada de rede) ──
function _mtBuscarVeiculo(q){
  const box = document.getElementById('mt-veiculo-resultados');
  if(!q || q.length<2){ box.style.display='none'; return; }
  const qq = q.toLowerCase();
  const achados = (allVeiculos||[]).filter(v =>
    (v.placa||'').toLowerCase().includes(qq) || (v.modelo||'').toLowerCase().includes(qq) || (v.marca||'').toLowerCase().includes(qq)
  ).slice(0,8);
  if(!achados.length){ box.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--muted)">Nenhum veículo encontrado</div>'; box.style.display='block'; return; }
  box.innerHTML = achados.map(v=>`
    <div onclick="_mtSelecionarVeiculo('${v.id}')" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border2)">
      <div style="font-weight:600;font-size:13px">${v.marca} ${v.modelo}</div>
      <div style="font-size:11px;color:var(--muted)">${v.placa} — ${v.cor||''}</div>
    </div>`).join('');
  box.style.display = 'block';
}
function _mtSelecionarVeiculo(id){
  const v = allVeiculos.find(x=>x.id===id);
  if(!v) return;
  document.getElementById('mt-veiculo-id').value = id;
  document.getElementById('mt-veiculo-busca').value = '';
  document.getElementById('mt-veiculo-selecionado').textContent = `${v.marca} ${v.modelo} — ${v.placa}`;
  document.getElementById('mt-veiculo-resultados').style.display = 'none';
  _mtAutoDetectarResponsavel();
}

// ── Busca cliente (autocomplete local) ──
function _mtBuscarCliente(q){
  const box = document.getElementById('mt-cliente-resultados');
  if(!q || q.length<2){ box.style.display='none'; return; }
  const qq = q.toLowerCase();
  const achados = (allClientes||[]).filter(c => c.tipo!=='lead' &&
    ((c.nome||'').toLowerCase().includes(qq) || (c.telefone||'').includes(qq))
  ).slice(0,8);
  if(!achados.length){ box.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--muted)">Nenhum cliente encontrado</div>'; box.style.display='block'; return; }
  box.innerHTML = achados.map(c=>`
    <div onclick="_mtSelecionarCliente('${c.id}')" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border2)">
      <div style="font-weight:600;font-size:13px">${c.nome}</div>
      <div style="font-size:11px;color:var(--muted)">${c.telefone||''}</div>
    </div>`).join('');
  box.style.display = 'block';
}
function _mtSelecionarCliente(id){
  const c = allClientes.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('mt-cliente-id').value = id;
  document.getElementById('mt-cliente-busca').value = '';
  document.getElementById('mt-cliente-selecionado').textContent = c.nome;
  document.getElementById('mt-cliente-resultados').style.display = 'none';
  document.getElementById('mt-resp-auto-badge').style.display = 'none';
  // Escolha manual: não sobrescrever mais automaticamente até trocar veículo/data
  _mtUltimoAutoLocId = 'manual';
  if(!document.getElementById('mt-telefone').value) document.getElementById('mt-telefone').value = c.telefone||'';
  if(!document.getElementById('mt-email').value) document.getElementById('mt-email').value = c.email||'';
}

// ── Auto-detecção do responsável pela locação ativa no período da infração ──
async function _mtAutoDetectarResponsavel(){
  const veiId = document.getElementById('mt-veiculo-id')?.value;
  const data  = document.getElementById('mt-data-infracao')?.value;
  if(!veiId || !data) return;
  // Não sobrescreve uma escolha manual do usuário
  const locAtualNoForm = document.getElementById('mt-locacao-id')?.value;
  if(_mtUltimoAutoLocId==='manual' && locAtualNoForm) return;

  try{
    const {data:locs, error} = await sb.from('locacoes')
      .select('id,cliente_id,data_inicio,data_fim,clientes(nome,telefone,email)')
      .eq('veiculo_id', veiId)
      .lte('data_inicio', data)
      .gte('data_fim', data)
      .order('created_at',{ascending:false})
      .limit(1);
    if(error) throw error;
    const loc = locs?.[0];
    if(!loc){
      document.getElementById('mt-resp-auto-badge').style.display = 'none';
      return;
    }
    document.getElementById('mt-locacao-id').value = loc.id;
    document.getElementById('mt-cliente-id').value = loc.cliente_id||'';
    document.getElementById('mt-cliente-selecionado').textContent = loc.clientes?.nome || '';
    document.getElementById('mt-telefone').value = loc.clientes?.telefone||'';
    document.getElementById('mt-email').value = loc.clientes?.email||'';
    document.getElementById('mt-condutor-principal').value = loc.clientes?.nome||'';
    document.getElementById('mt-resp-auto-badge').style.display = 'inline';
    _mtUltimoAutoLocId = loc.id;
  }catch(e){ console.warn('[multas/auto-detect]', e.message); }
}

// ── Anexos (padrão: arquivos ficam em memória até salvar) ──
function _mtUploadAnexos(files){
  Array.from(files).forEach(f=>{
    if(f.size > 15*1024*1024){ notify(f.name+': muito grande (máx 15MB)','error'); return; }
    _mtAnexosNovos.push(f);
  });
  _mtRenderAnexos();
  const inp = document.getElementById('mt-anexo-input'); if(inp) inp.value='';
}
function _mtRenderAnexos(){
  const lista = document.getElementById('mt-anexos-lista');
  if(!lista) return;
  const existHtml = _mtAnexosExistentes.map((u,i)=>{
    const nome = _nomeArquivo(u);
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <span style="font-size:18px">${_iconeArquivo(nome)}</span>
      <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div></div>
      <a href="${u}" target="_blank" style="color:var(--accent);font-size:13px;text-decoration:none">🔗</a>
      <button onclick="_mtRemoverAnexoExistente(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
    </div>`;
  }).join('');
  const novosHtml = _mtAnexosNovos.map((f,i)=>`
    <div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <span style="font-size:18px">${_iconeArquivo(f.name)}</span>
      <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</div>
      <div style="font-size:10px;color:var(--muted)">aguardando envio</div></div>
      <button onclick="_mtRemoverAnexoNovo(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
    </div>`).join('');
  lista.innerHTML = existHtml + novosHtml || '<div style="font-size:12px;color:var(--muted)">Nenhum anexo.</div>';
}
function _mtRemoverAnexoExistente(i){ _mtAnexosExistentes.splice(i,1); _mtRenderAnexos(); }
function _mtRemoverAnexoNovo(i){ _mtAnexosNovos.splice(i,1); _mtRenderAnexos(); }

// ── Salvar (insert ou update) ──
async function salvarMulta(){
  const g = id => document.getElementById(id)?.value?.trim() || null;
  const numeroAuto = g('mt-numero-auto'), dataInfr = g('mt-data-infracao'), tipo = g('mt-tipo');
  const valorOriginal = parseFloat(g('mt-valor-original'));
  const veiculoId = g('mt-veiculo-id');
  if(!numeroAuto || !dataInfr || !tipo || !valorOriginal || !veiculoId){
    notify('Preencha os campos obrigatórios: número do auto, veículo, tipo, data e valor da infração.','error');
    return;
  }
  const obj = {
    numero_auto: numeroAuto,
    orgao_autuador: g('mt-orgao'),
    data_infracao: dataInfr,
    hora_infracao: g('mt-hora-infracao'),
    local_infracao: g('mt-local'),
    tipo_infracao: tipo,
    codigo_infracao: g('mt-codigo'),
    descricao: g('mt-descricao'),
    pontuacao: g('mt-pontuacao') ? parseInt(g('mt-pontuacao')) : null,
    valor_original: valorOriginal,
    valor_desconto: g('mt-valor-desconto') ? parseFloat(g('mt-valor-desconto')) : null,
    data_vencimento: g('mt-vencimento'),
    status: g('mt-status') || 'recebida',
    veiculo_id: veiculoId,
    locacao_id: g('mt-locacao-id'),
    cliente_id: g('mt-cliente-id'),
    condutor_principal: g('mt-condutor-principal'),
    condutor_adicional: g('mt-condutor-adicional'),
    telefone: g('mt-telefone'),
    email: g('mt-email'),
    observacoes: g('mt-observacoes'),
    updated_at: new Date().toISOString(),
  };
  // Se o cliente foi identificado (manual ou automaticamente) e o status ainda
  // está em "recebida", avança para "cliente_identificado" — reflete a realidade
  // sem exigir um clique extra do atendente.
  if(obj.cliente_id && obj.status==='recebida') obj.status = 'cliente_identificado';

  const id = g('mt-id');
  try{
    let multaId = id;
    if(id){
      const {error} = await sb.from('multas').update(obj).eq('id',id);
      if(error) throw error;
    } else {
      obj.criado_por = currentUser?.id||null;
      const {data, error} = await sb.from('multas').insert(obj).select('id').single();
      if(error) throw error;
      multaId = data.id;
    }

    // Upload dos anexos novos (se houver) e atualização do array final
    if(_mtAnexosNovos.length){
      const urls = [..._mtAnexosExistentes];
      for(const f of _mtAnexosNovos){
        const path = `${multaId}/${Date.now()}_${f.name}`;
        const {error: upErr} = await sb.storage.from('multas-docs').upload(path, f, {upsert:true});
        if(upErr){ notify('Falha ao enviar anexo '+f.name+': '+upErr.message,'error'); continue; }
        const { data:pub } = sb.storage.from('multas-docs').getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      await sb.from('multas').update({anexos_urls: JSON.stringify(urls)}).eq('id',multaId);
    } else if(id){
      // Sem novos anexos, mas pode ter havido remoção de existentes
      await sb.from('multas').update({anexos_urls: _mtAnexosExistentes.length ? JSON.stringify(_mtAnexosExistentes) : null}).eq('id',multaId);
    }

    notify(id ? 'Multa atualizada!' : 'Multa cadastrada!', 'success');
    closeModal('multa');
    await carregarMultas();
    renderCardsMultas();
    renderMultas();
  }catch(e){ notify('Erro ao salvar multa: '+e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════
// MODAL DE DETALHE
// ══════════════════════════════════════════════════════════════
function abrirDetalheMulta(id){
  const m = _mtDados.find(x=>x.id===id);
  if(!m) return;
  const badge = _mtBadge(m);
  document.getElementById('mtd-titulo').textContent = 'Multa #'+m.numero_auto;
  document.getElementById('mtd-titulo').dataset.id = m.id;

  let anexos = [];
  try{ anexos = m.anexos_urls ? (Array.isArray(m.anexos_urls)?m.anexos_urls:JSON.parse(m.anexos_urls)) : []; }catch(_e){}

  const bloco = (titulo, linhas) => `
    <div class="form-section-title">${titulo}</div>
    <div class="form-grid" style="margin-bottom:6px">${linhas}</div>`;
  const campo = (label,val) => `<div><label style="font-size:11px;color:var(--muted)">${label}</label><div style="font-size:13px;font-weight:500">${val ?? '—'}</div></div>`;

  document.getElementById('mtd-corpo').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:20px;font-weight:800">${_mtFmt(_mtValorCobrado(m))}</div>
        <div style="font-size:12px;color:var(--muted)">Vencimento: ${m.data_vencimento?fmtData(m.data_vencimento):'—'}</div>
      </div>
      <span class="badge ${badge.cls}" style="font-size:13px;padding:6px 14px">${badge.label}</span>
    </div>
    ${bloco('📄 Detalhes da infração',
      campo('Órgão autuador', m.orgao_autuador) + campo('Data/Hora', fmtData(m.data_infracao)+(m.hora_infracao?' às '+m.hora_infracao.slice(0,5):'')) +
      campo('Tipo', m.tipo_infracao) + campo('Código', m.codigo_infracao) +
      campo('Pontuação', m.pontuacao) + campo('Local', m.local_infracao) +
      `<div style="grid-column:1/-1">${campo('Descrição', m.descricao)}</div>`
    )}
    ${bloco('🚗 Veículo',
      campo('Modelo', m.veiculos ? `${m.veiculos.marca} ${m.veiculos.modelo}` : '—') + campo('Placa', m.veiculos?.placa)
    )}
    ${bloco('🧑 Responsável',
      campo('Cliente', m.clientes?.nome) + campo('Telefone', m.telefone) +
      campo('Condutor principal', m.condutor_principal) + campo('Condutor adicional', m.condutor_adicional)
    )}
    <div class="form-section-title">📎 Anexos</div>
    <div style="margin-bottom:6px">
      ${anexos.length ? anexos.map(u=>`<a href="${u}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:6px 12px;margin:0 6px 6px 0;font-size:12px;color:var(--accent);text-decoration:none">${_iconeArquivo(_nomeArquivo(u))} ${_nomeArquivo(u)}</a>`).join('')
        : '<div style="font-size:12px;color:var(--muted)">Nenhum anexo.</div>'}
    </div>
    ${m.observacoes ? bloco('📝 Observações', `<div style="grid-column:1/-1;font-size:13px">${m.observacoes}</div>`) : ''}
  `;
  document.getElementById('m-multa-detalhe').classList.add('show');
}

async function excluirMulta(){
  const id = document.getElementById('mtd-titulo')?.dataset?.id;
  if(!id) return;
  if(!confirm('Excluir esta multa definitivamente? Os anexos também serão perdidos.')) return;
  try{
    const m = _mtDados.find(x=>x.id===id);
    let anexos = [];
    try{ anexos = m?.anexos_urls ? (Array.isArray(m.anexos_urls)?m.anexos_urls:JSON.parse(m.anexos_urls)) : []; }catch(_e){}
    if(anexos.length){
      const paths = anexos.map(u=>{ try{ return decodeURIComponent(u.split('/multas-docs/')[1].split('?')[0]); }catch(_e){ return null; } }).filter(Boolean);
      if(paths.length) await sb.storage.from('multas-docs').remove(paths).catch(()=>{});
    }
    const {error} = await sb.from('multas').delete().eq('id',id);
    if(error) throw error;
    notify('Multa excluída.','success');
    closeModal('multa-detalhe');
    await carregarMultas();
    renderCardsMultas();
    renderMultas();
    if(document.getElementById('ev-id')?.value) _mtRenderListaVeiculo(document.getElementById('ev-id').value);
    if(document.getElementById('ec-id')?.value) _mtRenderListaCliente(document.getElementById('ec-id').value);
  }catch(e){ notify('Erro ao excluir: '+e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════
// LISTAS EMBUTIDAS (aba Multas dentro de Veículo e Cliente)
// ══════════════════════════════════════════════════════════════
async function _mtRenderListaVeiculo(veiculoId){
  const el = document.getElementById('ev-multas-lista');
  if(!el || !veiculoId) return;
  el.innerHTML = 'Carregando…';
  try{
    const {data, error} = await sb.from('multas').select('id,numero_auto,data_infracao,valor_original,valor_desconto,status,data_vencimento')
      .eq('veiculo_id', veiculoId).order('data_infracao',{ascending:false}).limit(20);
    if(error) throw error;
    if(!data?.length){ el.innerHTML = 'Nenhuma multa registrada para este veículo.'; return; }
    el.innerHTML = data.map(m=>{
      const badge = _mtBadge(m);
      return `<div onclick="abrirDetalheMulta('${m.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2);cursor:pointer">
        <span>#${m.numero_auto} — ${fmtData(m.data_infracao)}</span>
        <span style="display:flex;align-items:center;gap:8px"><b>${_mtFmt(_mtValorCobrado(m))}</b><span class="badge ${badge.cls}" style="font-size:10px">${badge.label}</span></span>
      </div>`;
    }).join('');
  }catch(e){ el.innerHTML = 'Erro ao carregar multas.'; }
}

async function _mtRenderListaCliente(clienteId){
  const el = document.getElementById('ec-multas-lista');
  if(!el || !clienteId) return;
  el.innerHTML = 'Carregando…';
  try{
    const {data, error} = await sb.from('multas').select('id,numero_auto,data_infracao,valor_original,valor_desconto,status,data_vencimento,veiculos(placa)')
      .eq('cliente_id', clienteId).order('data_infracao',{ascending:false}).limit(20);
    if(error) throw error;
    if(!data?.length){ el.innerHTML = 'Nenhuma multa registrada para este cliente.'; return; }
    el.innerHTML = data.map(m=>{
      const badge = _mtBadge(m);
      return `<div onclick="abrirDetalheMulta('${m.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2);cursor:pointer">
        <span>#${m.numero_auto} — ${m.veiculos?.placa||''} — ${fmtData(m.data_infracao)}</span>
        <span style="display:flex;align-items:center;gap:8px"><b>${_mtFmt(_mtValorCobrado(m))}</b><span class="badge ${badge.cls}" style="font-size:10px">${badge.label}</span></span>
      </div>`;
    }).join('');
  }catch(e){ el.innerHTML = 'Erro ao carregar multas.'; }
}
