// reservas.js — Gestão de reservas

// ══ RENDER LISTA ══
function renderReservas(){
  const tb = document.getElementById('tb-reservas');
  if(!tb) return;
  const ativas = allReservas.filter(r=>r.status==='ativa');
  const outras = allReservas.filter(r=>r.status!=='ativa');
  const todas  = [...ativas, ...outras];
  if(!todas.length){
    tb.innerHTML='<tr class="empty-row"><td colspan="7">Nenhuma reserva encontrada</td></tr>';
    return;
  }
  const canEdit = ['admin','atendente'].includes(currentPerfil?.perfil);
  tb.innerHTML = todas.map(r=>{
    const cli  = allClientes.find(c=>c.id===r.cliente_id);
    const veic = allVeiculos.find(v=>v.id===r.veiculo_id);
    const badge = r.status==='ativa'
      ? '<span class="badge badge-blue">Ativa</span>'
      : r.status==='convertida'
      ? '<span class="badge badge-green">Convertida</span>'
      : r.status==='cancelada'
      ? '<span class="badge badge-red">Cancelada</span>'
      : '<span class="badge badge-gray">Expirada</span>';

    const valorPago = r.valor_pago > 0
      ? `<span style="color:var(--green);font-weight:600">R$ ${Number(r.valor_pago).toFixed(2).replace('.',',')}</span>`
      : '<span style="color:var(--muted2)">—</span>';

    const acoes = canEdit ? `
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:nowrap">
        ${r.status==='ativa' ? `
          <button class="btn btn-primary" style="font-size:10px;padding:4px 8px;white-space:nowrap" onclick="converterReservaContrato('${r.id}')">📄 Contrato</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px;white-space:nowrap" onclick="editarReserva('${r.id}')">✏️ Editar</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px;white-space:nowrap" onclick="cancelarReserva('${r.id}')">✕ Cancelar</button>
        ` : ''}
        <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px;color:var(--red);border-color:var(--red)" onclick="excluirReserva('${r.id}')">🗑️</button>
      </div>` : '—';

    return `<tr>
      <td>
        <div style="font-weight:500">${cli?.nome||'—'}</div>
        <div style="font-size:11px;color:var(--muted)">${cli?.telefone||''}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="vi ${veic?.tipo==='carro'?'vi-car':'vi-moto'}">${veic?.tipo==='carro'?'🚗':'🏍️'}</div>
          <div>
            <div style="font-weight:500">${veic?.marca||'—'} ${veic?.modelo||''}</div>
            <div style="font-size:11px;color:var(--muted)">${veic?.placa||''}</div>
          </div>
        </div>
      </td>
      <td>
        <div>${fmtDt(r.data_inicio)}</div>
      </td>
      <td>
        <div>${fmtDt(r.data_fim)}</div>
      </td>
      <td>${valorPago}</td>
      <td>${badge}</td>
      <td>${acoes}</td>
    </tr>`;
  }).join('');
}

// ══ ABRIR MODAL NOVA RESERVA ══
function abrirModalReserva(){
  // Popula clientes — somente aprovados
  const selCli = document.getElementById('res-cli');
  if(selCli){
    const aprovados = allClientes.filter(c=>c.tipo!=='lead' && c.status_analise==='aprovado');
    selCli.innerHTML = aprovados.length
      ? aprovados.map(c=>`<option value="${c.id}" data-tel="${c.telefone||''}">${c.nome}</option>`).join('')
      : '<option value="">Nenhum cliente aprovado</option>';
  }

  // Popula veículos disponíveis e reservados
  const selVei = document.getElementById('res-vei');
  if(selVei){
    const disponiveis = allVeiculos.filter(v=>v.status==='disponivel'||v.status==='reservado');
    selVei.innerHTML = disponiveis.map(v=>`<option value="${v.id}">${v.marca} ${v.modelo} — ${v.placa} ${v.status==='reservado'?'(reservado)':''}</option>`).join('');
  }

  // Data início padrão: agora
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  const agoraStr = agora.toISOString().slice(0,16);
  const el = document.getElementById('res-ini');
  if(el) el.value = agoraStr;

  // Limpa todos os campos
  ['res-fim','res-valor','res-valor-cotado','res-obs','res-local-custom'].forEach(id=>{
    const e = document.getElementById(id); if(e) e.value='';
  });
  // Reset local de retirada para Loja
  const radios = document.querySelectorAll('input[name="res-local-tipo"]');
  if(radios.length) { radios[0].checked = true; _toggleLocalRetirada('loja'); }
  // Limpa preview do anexo
  const prev = document.getElementById('res-anexo-preview');
  if(prev) prev.innerHTML = '';
  const inp = document.getElementById('res-anexo-input');
  if(inp) inp.value = '';
  window._resAnexoFile = null;
  window._editandoReservaId = null;

  // Restaura título e botão para modo criação
  const titulo = document.querySelector('#m-reserva .modal-title, #m-reserva h2');
  if(titulo) titulo.textContent = 'Nova Reserva';
  const btn = document.querySelector('#m-reserva .btn-primary');
  if(btn) btn.textContent = '✓ Confirmar reserva';

  document.getElementById('m-reserva').classList.add('show');
}

// ══ SALVAR RESERVA ══
async function salvarReserva(){
  const cid    = document.getElementById('res-cli')?.value;
  const vid    = document.getElementById('res-vei')?.value;
  const ini    = document.getElementById('res-ini')?.value;
  const fim    = document.getElementById('res-fim')?.value;
  const valor  = parseFloat(document.getElementById('res-valor')?.value||'0')||0;
  const valorCotado = parseFloat(document.getElementById('res-valor-cotado')?.value||'0')||0;
  const obs    = document.getElementById('res-obs')?.value||'';
  // Local de retirada
  const localTipo = document.querySelector('input[name="res-local-tipo"]:checked')?.value||'loja';
  const localCustom = document.getElementById('res-local-custom')?.value||'';
  let localRetirada = localTipo === 'loja' ? 'Loja'
    : localTipo === 'endereco' ? (allClientes.find(c=>c.id===cid)?.endereco||'Endereço do cliente')
    : localCustom;

  if(!cid||!vid||!ini||!fim){notify('Preencha cliente, veículo e datas','error');return;}
  if(new Date(fim)<=new Date(ini)){notify('Data fim deve ser após data início','error');return;}

  const btn = document.querySelector('#m-reserva .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}

  try{
    const editId = window._editandoReservaId || null;
    let resData;
    if(editId){
      const {data:upd, error:errRes} = await sb.from('reservas').update({
        cliente_id: cid,
        veiculo_id: vid,
        data_inicio: ini,
        data_fim: fim,
        valor_pago: valor,
        valor_cotado: valorCotado||null,
        local_retirada: localRetirada||null,
        observacoes: obs,
      }).eq('id', editId).select().single();
      if(errRes) throw errRes;
      resData = upd;
    } else {
      const {data:ins, error:errRes} = await sb.from('reservas').insert({
        cliente_id: cid,
        veiculo_id: vid,
        data_inicio: ini,
        data_fim: fim,
        valor_pago: valor,
        valor_cotado: valorCotado||null,
        local_retirada: localRetirada||null,
        observacoes: obs,
        status: 'ativa',
        criado_por: currentUser?.id
      }).select().single();
      if(errRes) throw errRes;
      resData = ins;
    }
    // Upload comprovante se houver
    if(window._resAnexoFile && resData?.id){
      const f = window._resAnexoFile;
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path = `reservas/${resData.id}/${Date.now()}_${safeName}`;
      const {error:errUp} = await sb.storage.from('clientes-docs').upload(path, f, {upsert:false});
      if(!errUp){
        const {data:pub} = sb.storage.from('clientes-docs').getPublicUrl(path);
        await sb.from('reservas').update({comprovante_url: pub.publicUrl}).eq('id', resData.id);
      }
    }
    window._resAnexoFile = null;

    // Marca veículo como reservado
    await sb.from('veiculos').update({status:'reservado'}).eq('id',vid);

    notify(editId ? 'Reserva atualizada!' : 'Reserva criada! Veículo marcado como reservado.','success');
    window._editandoReservaId = null;
    closeModal('reserva');
    await carregarTudo();
    renderReservas();
  }catch(e){
    notify('Erro: '+e.message,'error');
  }finally{
    window._editandoReservaId = null;
    if(btn){btn.disabled=false;btn.textContent='✓ Confirmar reserva';}
  }
}

// ══ CANCELAR RESERVA ══
async function excluirReserva(id){
  if(!await fpConfirm('Excluir esta reserva permanentemente? Esta ação não pode ser desfeita.', 'Excluir reserva')) return;
  const r = allReservas.find(x=>x.id===id);
  const {error} = await sb.from('reservas').delete().eq('id',id);
  if(error){ notify('Erro: '+error.message,'error'); return; }
  // Se o veículo estava reservado, volta para disponível
  if(r?.veiculo_id && r?.status==='ativa'){
    await sb.from('veiculos').update({status:'disponivel'}).eq('id',r.veiculo_id);
  }
  notify('Reserva excluída','success');
  await carregarTudo();
  renderReservas();
}

async function cancelarReserva(id){
  if(!await fpConfirm('Cancelar esta reserva? O veículo voltará a ficar disponível.', 'Cancelar reserva', {confirmLabel:'Cancelar reserva', danger:false})) return;
  const r = allReservas.find(x=>x.id===id);
  if(!r) return;

  await sb.from('reservas').update({status:'cancelada'}).eq('id',id);

  // Só libera veículo se não tiver outra reserva ativa no mesmo veículo
  const outraReserva = allReservas.find(x=>x.id!==id&&x.veiculo_id===r.veiculo_id&&x.status==='ativa');
  if(!outraReserva){
    await sb.from('veiculos').update({status:'disponivel'}).eq('id',r.veiculo_id);
  }

  notify('Reserva cancelada.','success');
  await carregarTudo();
  renderReservas();
}

// ══ CONVERTER RESERVA → CONTRATO ══
async function converterReservaContrato(id){
  const r = allReservas.find(x=>x.id===id);
  if(!r) return;

  const cli  = allClientes.find(c=>c.id===r.cliente_id);
  const veic = allVeiculos.find(v=>v.id===r.veiculo_id);

  // Pré-preenche a tela de contratos com os dados da reserva
  goPage('contratos');

  setTimeout(()=>{
    // Cliente
    const selCli = document.getElementById('c-cli');
    if(selCli){ selCli.value = r.cliente_id; if(typeof _comboSincronizarInput==='function') _comboSincronizarInput('c-cli'); }

    // Veículo — adiciona o veículo reservado no select mesmo que não esteja "disponivel"
    const selVei = document.getElementById('c-vei');
    if(selVei){
      // Garante que o veículo reservado aparece na lista
      const jaExiste = selVei.querySelector(`option[value="${r.veiculo_id}"]`);
      if(!jaExiste && veic){
        const opt = document.createElement('option');
        opt.value = veic.id;
        opt.dataset.diaria = veic.diaria;
        opt.dataset.placa  = veic.placa;
        opt.textContent = `${veic.marca} ${veic.modelo} — ${veic.placa}`;
        selVei.insertBefore(opt, selVei.firstChild);
      }
      selVei.value = r.veiculo_id;
      if(typeof _comboSincronizarInput==='function') _comboSincronizarInput('c-vei');
      if(typeof previewContrato==='function') previewContrato();
    }

    // Datas — extrai só a parte da data (YYYY-MM-DD)
    // datetime-local precisa do formato YYYY-MM-DDTHH:MM
    const _toDatetimeLocal = (str) => {
      if(!str) return '';
      const s = str.slice(0,16); // YYYY-MM-DDTHH:MM
      return s.includes('T') ? s : s + 'T00:00';
    };
    const elIni = document.getElementById('c-ini');
    const elFim = document.getElementById('c-fim');
    if(elIni) elIni.value = _toDatetimeLocal(r.data_inicio);
    if(elFim) elFim.value = _toDatetimeLocal(r.data_fim);

    // Observações — menciona valor já pago e dados da reserva
    const elObs = document.getElementById('c-obs');
    let obsTexto = 'Veículo em perfeito estado. Cliente responsável por multas.';
    if(r.valor_pago > 0){
      obsTexto += `\nReserva convertida — valor já pago: R$ ${Number(r.valor_pago).toFixed(2).replace('.',',')}`;
    }
    if(r.observacoes) obsTexto += `\n${r.observacoes}`;
    if(elObs) elObs.value = obsTexto;

    // Local de retirada da reserva
    const elLocalRet = document.getElementById('c-local-ret');
    if(elLocalRet && r.local_retirada) elLocalRet.value = r.local_retirada;

    // Veículo: mostra planos se for moto
    if(typeof _verificarMotoContrato === 'function') _verificarMotoContrato();

    // Valor cotado da reserva — preenche campo E seleciona plano correspondente
    const elDia = document.getElementById('c-dia');
    if(r.valor_cotado){
      if(elDia) elDia.value = r.valor_cotado;
      // Identificar o plano pelo valor e selecionar o radio correto
      const valorStr = String(parseFloat(r.valor_cotado).toFixed(2));
      const radioPlano = document.querySelector(`input[name="c-plano-moto"][value="${valorStr}"]`);
      if(radioPlano && typeof _selecionarPlanoContrato === 'function'){
        radioPlano.checked = true;
        _selecionarPlanoContrato(radioPlano);
      } else if(elDia){
        // Fallback: só preenche o valor sem selecionar plano
        elDia.value = r.valor_cotado;
      }
    }

    // Preenche dados do cliente a partir do perfil
    if(typeof _preencherCamposClienteContrato === 'function') _preencherCamposClienteContrato();

    // Sinaliza reserva de origem para abater no total
    window._reservaOrigemId    = id;
    window._reservaValorPago   = r.valor_pago||0;
    window._reservaVeiculoId   = r.veiculo_id;

    previewContrato();

    // Mostra aviso de abatimento se houver valor pago
    if(r.valor_pago > 0){
      notify(`Reserva com R$ ${Number(r.valor_pago).toFixed(2).replace('.',',')} já pago — será abatido do total.`,'success');
    }
  }, 300);
}

// ══ EXPIRAR RESERVAS AUTOMATICAMENTE ══
async function expirarReservas(){
  if(!sb) return;
  const hoje = new Date().toISOString();
  const {data:expiradas} = await sb.from('reservas')
    .select('id,veiculo_id')
    .eq('status','ativa')
    .lt('data_fim', hoje);

  if(!expiradas?.length) return;

  for(const r of expiradas){
    await sb.from('reservas').update({status:'expirada'}).eq('id',r.id);
    // Libera veículo se não tiver outra reserva ativa
    const {data:outras} = await sb.from('reservas')
      .select('id').eq('veiculo_id',r.veiculo_id).eq('status','ativa');
    if(!outras?.length){
      await sb.from('veiculos').update({status:'disponivel'}).eq('id',r.veiculo_id);
    }
  }

  if(expiradas.length > 0){
    console.log(`[Reservas] ${expiradas.length} reserva(s) expirada(s) automaticamente.`);
    await carregarTudo();
    renderReservas();
  }
}

// ── HELPERS NOVOS CAMPOS ──
function _toggleLocalRetirada(tipo){
  const custom = document.getElementById('res-local-custom');
  if(!custom) return;
  custom.style.display = tipo === 'outro' ? '' : 'none';
  if(tipo === 'endereco'){
    const cid = document.getElementById('res-cli')?.value;
    const cli = allClientes.find(c=>c.id===cid);
    custom.style.display = '';
    custom.value = cli?.endereco || '';
  }
}

function _previewAnexoReserva(file){
  window._resAnexoFile = file || null;
  const prev = document.getElementById('res-anexo-preview');
  if(!prev) return;
  if(!file){ prev.innerHTML=''; return; }
  const icon = file.name.endsWith('.pdf') ? '📄' : '🖼️';
  prev.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;margin-top:6px">
    <span style="font-size:18px">${icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</div>
      <div style="font-size:10px;color:var(--muted)">${(file.size/1024).toFixed(1)} KB</div>
    </div>
    <button onclick="window._resAnexoFile=null;document.getElementById('res-anexo-preview').innerHTML='';document.getElementById('res-anexo-input').value=''" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
  </div>`;
}

// ── PLANOS DE MOTO ──
const PLANOS_MOTO = {
  '379.99': { nome:'Plano 12 meses',        meses:12  },
  '399.90': { nome:'Plano Conquista 36m',   meses:36  },
};

function _selecionarPlanoReserva(radio){
  const val = radio.value;
  // Atualiza visual dos cards
  ['res-plano-12-label','res-plano-36-label'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const v = el.querySelector('input')?.value;
    el.style.borderColor   = v===val ? 'var(--accent)' : 'var(--border2)';
    el.style.background    = v===val ? 'rgba(37,99,235,.08)' : '';
  });
  // Preenche valor cotado
  const vc = document.getElementById('res-valor-cotado');
  if(vc) vc.value = val;
}

function _verificarMotoReserva(){
  const veiId = document.getElementById('res-vei')?.value;
  const v = allVeiculos?.find(x=>x.id===veiId);
  const wrap = document.getElementById('res-planos-wrap');
  if(wrap) wrap.style.display = v?.tipo==='moto' ? '' : 'none';
}

// ══ EDITAR RESERVA ══
function editarReserva(id){
  const r = allReservas.find(x=>x.id===id);
  if(!r){ notify('Reserva não encontrada','error'); return; }

  // Marca modo edição
  window._editandoReservaId = id;

  // Preenche clientes
  const selCli = document.getElementById('res-cli');
  if(selCli){
    const aprovados = allClientes.filter(c=>c.tipo!=='lead' && c.status_analise==='aprovado');
    selCli.innerHTML = aprovados.length
      ? aprovados.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')
      : '<option value="">Nenhum cliente aprovado</option>';
    selCli.value = r.cliente_id;
  }

  // Preenche veículos
  const selVei = document.getElementById('res-vei');
  if(selVei){
    const disponiveis = allVeiculos.filter(v=>v.status==='disponivel'||v.status==='reservado');
    selVei.innerHTML = disponiveis.map(v=>`<option value="${v.id}">${v.marca} ${v.modelo} — ${v.placa}</option>`).join('');
    // Garante que o veículo atual aparece
    if(!selVei.querySelector(`option[value="${r.veiculo_id}"]`)){
      const veic = allVeiculos.find(v=>v.id===r.veiculo_id);
      if(veic){
        const opt = document.createElement('option');
        opt.value = veic.id;
        opt.textContent = `${veic.marca} ${veic.modelo} — ${veic.placa}`;
        selVei.insertBefore(opt, selVei.firstChild);
      }
    }
    selVei.value = r.veiculo_id;
    if(typeof _verificarMotoReserva === 'function') _verificarMotoReserva();
  }

  // Preenche datas
  const _toLocal = s => s ? s.slice(0,16) : '';
  const elIni = document.getElementById('res-ini');
  const elFim = document.getElementById('res-fim');
  if(elIni) elIni.value = _toLocal(r.data_inicio);
  if(elFim) elFim.value = _toLocal(r.data_fim);

  // Preenche valores
  const elValor = document.getElementById('res-valor');
  if(elValor) elValor.value = r.valor_pago || '';
  const elCotado = document.getElementById('res-valor-cotado');
  if(elCotado) elCotado.value = r.valor_cotado || '';

  // Preenche observações
  const elObs = document.getElementById('res-obs');
  if(elObs) elObs.value = r.observacoes || '';

  // Local de retirada
  const localTipo = r.local_retirada === 'Loja' ? 'loja' : 'outro';
  const radios = document.querySelectorAll('input[name="res-local-tipo"]');
  radios.forEach(rb => { rb.checked = rb.value === localTipo; });
  _toggleLocalRetirada(localTipo);
  if(localTipo === 'outro'){
    const elCustom = document.getElementById('res-local-custom');
    if(elCustom) elCustom.value = r.local_retirada || '';
  }

  // Plano moto se aplicável
  if(r.valor_cotado){
    const radioPlano = document.querySelector(`input[name="res-plano-moto"][value="${parseFloat(r.valor_cotado).toFixed(2)}"]`);
    if(radioPlano && typeof _selecionarPlanoReserva === 'function'){
      radioPlano.checked = true;
      _selecionarPlanoReserva(radioPlano);
    }
  }

  // Ajusta título e botão do modal
  const titulo = document.querySelector('#m-reserva .modal-title, #m-reserva h2');
  if(titulo) titulo.textContent = 'Editar Reserva';
  const btn = document.querySelector('#m-reserva .btn-primary');
  if(btn) btn.textContent = '✓ Salvar alterações';

  document.getElementById('m-reserva').classList.add('show');
}
