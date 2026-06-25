// portal-admin.js — Aba Portal do Cliente (admin)

let _allComunicados = [];
let _allSorteios = [];

// ══ INIT ═════════════════════════════════════════════════
async function iniciarPortalAdmin() {
  await Promise.all([_portalLoadComunicados(), _portalLoadSorteios()]);
  _portalTab('comunicados');
}

// ══ TABS ══════════════════════════════════════════════════
function _portalTab(tab) {
  ['comunicados','sorteios'].forEach(t => {
    document.getElementById(`portal-painel-${t}`).style.display = t === tab ? '' : 'none';
    const btn = document.getElementById(`portal-tab-${t}`);
    btn.style.borderBottomColor = t === tab ? 'var(--accent)' : 'transparent';
    btn.style.color = t === tab ? 'var(--accent)' : 'var(--muted)';
  });
}

// ══════════════════════════════════════════════════════════
// COMUNICADOS
// ══════════════════════════════════════════════════════════
async function _portalLoadComunicados() {
  const { data } = await sb.from('comunicados').select('*').order('criado_em', { ascending: false });
  _allComunicados = data || [];
  _portalRenderComunicados();
}

function _portalRenderComunicados() {
  const el = document.getElementById('portal-lista-comunicados');
  if (!_allComunicados.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted2)">Nenhum comunicado cadastrado.</div>';
    return;
  }
  const tipoCor = { geral:'var(--accent)', manutencao:'var(--gold)', sorteio:'var(--green)', urgente:'var(--red)' };
  el.innerHTML = `
    <table class="tabela-base" style="width:100%">
      <thead><tr><th>Título</th><th>Tipo</th><th>Destinatário</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
      <tbody>
        ${_allComunicados.map(c => `
          <tr>
            <td style="font-weight:600">${c.titulo}</td>
            <td><span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${tipoCor[c.tipo]||'var(--accent)'}22;color:${tipoCor[c.tipo]||'var(--accent)'}">${c.tipo}</span></td>
            <td style="font-size:12px;color:var(--muted)">${c.cliente_id ? 'Específico' : 'Todos'}</td>
            <td><span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${c.ativo?'rgba(0,196,106,.15)':'rgba(136,153,187,.1)'};color:${c.ativo?'var(--green)':'var(--muted)'}">
              ${c.ativo ? 'Ativo' : 'Inativo'}
            </span></td>
            <td style="font-size:12px;color:var(--muted)">${new Date(c.criado_em).toLocaleDateString('pt-BR')}</td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="_portalEditarComunicado('${c.id}')">Editar</button>
                <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:${c.ativo?'var(--red)':'var(--green)'};border-color:${c.ativo?'var(--red)':'var(--green)'}" onclick="_portalToggleComunicado('${c.id}',${!c.ativo})">${c.ativo ? 'Desativar' : 'Ativar'}</button>
                <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:var(--red);border-color:var(--red)" onclick="_portalDeletarComunicado('${c.id}')">Excluir</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function _portalNovoComunicado() {
  document.getElementById('com-id').value = '';
  document.getElementById('com-titulo').value = '';
  document.getElementById('com-tipo').value = 'geral';
  document.getElementById('com-corpo').value = '';
  document.getElementById('com-destinatario').value = 'todos';
  document.getElementById('com-cliente-especifico').style.display = 'none';
  document.getElementById('m-comunicado-titulo').textContent = 'Novo Comunicado';
  // Preencher select de clientes de moto
  _portalPreencherClientesMoto();
  document.getElementById('m-comunicado').classList.add('show');
}

function _portalEditarComunicado(id) {
  const c = _allComunicados.find(x => x.id === id);
  if (!c) return;
  document.getElementById('com-id').value = c.id;
  document.getElementById('com-titulo').value = c.titulo;
  document.getElementById('com-tipo').value = c.tipo;
  document.getElementById('com-corpo').value = c.corpo;
  document.getElementById('com-destinatario').value = c.cliente_id ? 'especifico' : 'todos';
  document.getElementById('m-comunicado-titulo').textContent = 'Editar Comunicado';
  _portalPreencherClientesMoto(c.cliente_id);
  _portalToggleDestinatario();
  document.getElementById('m-comunicado').classList.add('show');
}

async function _portalPreencherClientesMoto(selectedId) {
  const sel = document.getElementById('com-cliente-id');
  // Busca clientes com locação de moto ativa
  const { data: locs } = await sb.from('locacoes')
    .select('cliente_id, clientes(id, nome)')
    .eq('status', 'ativa')
    .not('plano_moto', 'is', null);
  const vistos = new Set();
  sel.innerHTML = (locs || []).filter(l => {
    if (vistos.has(l.cliente_id)) return false;
    vistos.add(l.cliente_id); return true;
  }).map(l => `<option value="${l.cliente_id}" ${l.cliente_id===selectedId?'selected':''}>${l.clientes?.nome||'—'}</option>`).join('');
}

function _portalToggleDestinatario() {
  const v = document.getElementById('com-destinatario').value;
  document.getElementById('com-cliente-especifico').style.display = v === 'especifico' ? '' : 'none';
}

async function _portalSalvarComunicado() {
  const id     = document.getElementById('com-id').value;
  const titulo = document.getElementById('com-titulo').value.trim();
  const tipo   = document.getElementById('com-tipo').value;
  const corpo  = document.getElementById('com-corpo').value.trim();
  const dest   = document.getElementById('com-destinatario').value;
  const clienteId = dest === 'especifico' ? document.getElementById('com-cliente-id').value : null;

  if (!titulo || !corpo) { notify('Preencha título e mensagem', 'error'); return; }

  const payload = { titulo, tipo, corpo, ativo: true, cliente_id: clienteId || null };
  let error;
  if (id) {
    ({ error } = await sb.from('comunicados').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('comunicados').insert({ ...payload, publicado_por: currentUser?.id }));
  }
  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify(id ? 'Comunicado atualizado!' : 'Comunicado publicado!', 'success');
  closeModal('comunicado');
  await _portalLoadComunicados();
}

async function _portalToggleComunicado(id, ativo) {
  const { error } = await sb.from('comunicados').update({ ativo }).eq('id', id);
  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify(ativo ? 'Comunicado ativado!' : 'Comunicado desativado!', 'success');
  await _portalLoadComunicados();
}

async function _portalDeletarComunicado(id) {
  if (!confirm('Excluir este comunicado?')) return;
  const { error } = await sb.from('comunicados').delete().eq('id', id);
  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify('Comunicado excluído.', 'success');
  await _portalLoadComunicados();
}

// ══════════════════════════════════════════════════════════
// SORTEIOS
// ══════════════════════════════════════════════════════════
async function _portalLoadSorteios() {
  const { data } = await sb.from('sorteios').select('*').order('criado_em', { ascending: false });
  _allSorteios = data || [];
  _portalRenderSorteios();
}

function _portalRenderSorteios() {
  const el = document.getElementById('portal-lista-sorteios');
  if (!_allSorteios.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted2)">Nenhum sorteio cadastrado.</div>';
    return;
  }
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  el.innerHTML = _allSorteios.map(s => {
    const [ano, mes] = (s.mes_referencia||'').split('-');
    const mesNome = meses[parseInt(mes)-1] || '—';
    const statusBadge = s.status === 'realizado'
      ? `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(0,196,106,.15);color:var(--green)">Realizado</span>`
      : `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(245,200,66,.12);color:var(--gold)">Aberto</span>`;
    const vencedorInfo = s.vencedor_nome
      ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(0,196,106,.08);border:1px solid rgba(0,196,106,.2);border-radius:8px;font-size:13px;display:flex;align-items:center;gap:12px">
           🏆 <strong>Vencedor:</strong> ${s.vencedor_nome}
           ${s.vencedor_numero ? `<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px" onclick="_portalEnviarWhatsAppVencedor('${s.id}')">📱 Enviar WhatsApp</button>` : ''}
         </div>` : '';
    const btnSortear = s.status === 'aberto'
      ? `<button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="_portalRealizarSorteio('${s.id}')">🎯 Realizar Sorteio</button>` : '';
    return `
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:18px;margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">${mesNome} ${ano||''}</div>
            <div style="font-size:18px;font-weight:800;margin-bottom:4px">${s.premio}</div>
            ${s.descricao ? `<div style="font-size:13px;color:var(--muted)">${s.descricao}</div>` : ''}
            ${s.data_sorteio ? `<div style="font-size:12px;color:var(--muted2);margin-top:4px">Data: ${new Date(s.data_sorteio+'T00:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            ${statusBadge}
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${btnSortear}
              <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="_portalVerElegiveis('${s.id}')">Ver elegíveis</button>
              <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:var(--red);border-color:var(--red)" onclick="_portalDeletarSorteio('${s.id}')">Excluir</button>
            </div>
          </div>
        </div>
        ${vencedorInfo}
      </div>`;
  }).join('');
}

function _portalNovoSorteio() {
  document.getElementById('sor-mes').value = new Date().toISOString().slice(0,7);
  document.getElementById('sor-premio').value = '';
  document.getElementById('sor-desc').value = '';
  document.getElementById('sor-data').value = '';
  document.getElementById('m-sorteio').classList.add('show');
}

async function _portalSalvarSorteio() {
  const mes    = document.getElementById('sor-mes').value;
  const premio = document.getElementById('sor-premio').value.trim();
  const desc   = document.getElementById('sor-desc').value.trim();
  const data   = document.getElementById('sor-data').value;
  if (!mes || !premio) { notify('Preencha mês e prêmio', 'error'); return; }
  const { error } = await sb.from('sorteios').insert({
    mes_referencia: mes, premio, descricao: desc||null, data_sorteio: data||null, status: 'aberto'
  });
  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify('Sorteio criado!', 'success');
  closeModal('sorteio');
  await _portalLoadSorteios();
}

async function _portalRealizarSorteio(sorteioId) {
  if (!confirm('Realizar o sorteio agora? Esta ação não pode ser desfeita.')) return;
  const hoje = new Date().toISOString().slice(0,10);
  const { data: locacoes } = await sb.from('locacoes')
    .select('id, cliente_id, num_contrato, clientes(nome, telefones)')
    .eq('status','ativa').not('plano_moto','is',null);
  if (!locacoes?.length) { notify('Nenhum cliente de moto ativo.','error'); return; }
  const elegiveis = [];
  for (const loc of locacoes) {
    const { data: venc } = await sb.from('cobrancas_semanais').select('id')
      .eq('locacao_id',loc.id).eq('status','pendente').lt('data_vencimento',hoje).limit(1);
    if (!venc?.length) elegiveis.push(loc);
  }
  if (!elegiveis.length) { notify('Nenhum cliente elegível.','error'); return; }
  const v = elegiveis[Math.floor(Math.random()*elegiveis.length)];
  const nome = v.clientes?.nome || 'Desconhecido';
  const tels = v.clientes?.telefones;
  const num  = Array.isArray(tels) ? tels[0]?.numero : (typeof tels==='string' ? JSON.parse(tels)[0]?.numero : null);
  const { error } = await sb.from('sorteios').update({
    status:'realizado', vencedor_locacao_id:v.id, vencedor_nome:nome, vencedor_numero:num||null
  }).eq('id',sorteioId);
  if (error) { notify('Erro: '+error.message,'error'); return; }
  notify(`🏆 Vencedor: ${nome}!`,'success');
  await _portalLoadSorteios();
}

async function _portalVerElegiveis(sorteioId) {
  const hoje = new Date().toISOString().slice(0,10);
  const { data: locacoes } = await sb.from('locacoes')
    .select('id, num_contrato, clientes(nome)')
    .eq('status','ativa').not('plano_moto','is',null);
  const elegiveis = [], nao = [];
  for (const loc of locacoes||[]) {
    const { data: venc } = await sb.from('cobrancas_semanais').select('id')
      .eq('locacao_id',loc.id).eq('status','pendente').lt('data_vencimento',hoje).limit(1);
    (venc?.length ? nao : elegiveis).push(loc);
  }
  document.getElementById('m-elegiveis-body').innerHTML = `
    <div style="padding:16px">
      <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px">✅ Elegíveis (${elegiveis.length})</div>
      ${elegiveis.map(l=>`<div style="padding:8px 12px;background:rgba(0,196,106,.06);border-radius:8px;margin-bottom:6px;font-size:13px">${l.clientes?.nome||'—'} — Contrato #${l.num_contrato}</div>`).join('')||'<div style="color:var(--muted);font-size:13px">Nenhum</div>'}
      <div style="font-size:13px;font-weight:700;color:var(--red);margin:16px 0 10px">❌ Não elegíveis (${nao.length})</div>
      ${nao.map(l=>`<div style="padding:8px 12px;background:rgba(224,82,82,.06);border-radius:8px;margin-bottom:6px;font-size:13px">${l.clientes?.nome||'—'} — Contrato #${l.num_contrato}</div>`).join('')||'<div style="color:var(--muted);font-size:13px">Nenhum</div>'}
    </div>`;
  document.getElementById('m-elegiveis').classList.add('show');
}

async function _portalEnviarWhatsAppVencedor(sorteioId) {
  const s = _allSorteios.find(x => x.id===sorteioId);
  if (!s?.vencedor_numero) { notify('Número do vencedor não encontrado.','error'); return; }
  const msg = `🏆 Parabéns, ${s.vencedor_nome}! Você foi o grande vencedor do sorteio Royal! O prêmio é: ${s.premio}. Entre em contato conosco para resgatar. 🎉`;
  try {
    const cfg = JSON.parse(localStorage.getItem('fp_evo_cfg')||'{}');
    if (!cfg.url||!cfg.key) throw new Error('Evolution API não configurada');
    await fetch(`${cfg.url}/message/sendText/${cfg.instance}`,{
      method:'POST', headers:{'apikey':cfg.key,'Content-Type':'application/json'},
      body:JSON.stringify({number:s.vencedor_numero, text:msg})
    });
    notify('WhatsApp enviado!','success');
  } catch(e) { notify('Erro: '+e.message,'error'); }
}

async function _portalDeletarSorteio(id) {
  if (!confirm('Excluir este sorteio?')) return;
  const { error } = await sb.from('sorteios').delete().eq('id',id);
  if (error) { notify('Erro: '+error.message,'error'); return; }
  notify('Sorteio excluído.','success');
  await _portalLoadSorteios();
}
