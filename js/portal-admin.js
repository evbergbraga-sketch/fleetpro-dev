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
  const { data } = await sb.from('comunicados')
    .select('*')
    .order('criado_em', { ascending: false });
  _allComunicados = data || [];
  _portalRenderComunicados();
}

function _portalRenderComunicados() {
  const el = document.getElementById('portal-lista-comunicados');
  if (!_allComunicados.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted2)">Nenhum comunicado cadastrado.</div>';
    return;
  }

  const tipoCor = { geral: 'var(--accent)', manutencao: 'var(--gold)', sorteio: 'var(--green)', urgente: 'var(--red)' };

  el.innerHTML = `
    <table class="tabela-base" style="width:100%">
      <thead><tr>
        <th>Título</th><th>Tipo</th><th>Status</th><th>Criado em</th><th>Ações</th>
      </tr></thead>
      <tbody>
        ${_allComunicados.map(c => `
          <tr>
            <td style="font-weight:600">${c.titulo}</td>
            <td><span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${tipoCor[c.tipo]||'var(--accent)'}22;color:${tipoCor[c.tipo]||'var(--accent)'}">${c.tipo}</span></td>
            <td>
              <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${c.ativo?'rgba(0,196,106,.15)':'rgba(136,153,187,.1)'};color:${c.ativo?'var(--green)':'var(--muted)'}">
                ${c.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
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
  _portalAbrirModalComunicado(null);
}

function _portalEditarComunicado(id) {
  const c = _allComunicados.find(x => x.id === id);
  if (c) _portalAbrirModalComunicado(c);
}

function _portalAbrirModalComunicado(c) {
  const isEdit = !!c;
  const html = `
    <div class="modal-overlay show" id="modal-comunicado" onclick="if(event.target===this)closeModal('comunicado')">
      <div class="modal-box" style="max-width:520px">
        <div class="modal-header">
          <span class="modal-title">${isEdit ? 'Editar Comunicado' : 'Novo Comunicado'}</span>
          <button class="modal-close" onclick="closeModal('comunicado')">×</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px">Título</label>
            <input id="com-titulo" class="input-base" style="width:100%" value="${c?.titulo||''}" placeholder="Título do comunicado">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px">Tipo</label>
            <select id="com-tipo" class="input-base" style="width:100%">
              <option value="geral" ${c?.tipo==='geral'?'selected':''}>Geral</option>
              <option value="manutencao" ${c?.tipo==='manutencao'?'selected':''}>Manutenção</option>
              <option value="sorteio" ${c?.tipo==='sorteio'?'selected':''}>Sorteio</option>
              <option value="urgente" ${c?.tipo==='urgente'?'selected':''}>Urgente</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px">Mensagem</label>
            <textarea id="com-corpo" class="input-base" style="width:100%;min-height:120px;resize:vertical" placeholder="Texto do comunicado...">${c?.corpo||''}</textarea>
          </div>
          <button class="btn btn-primary" style="width:100%" onclick="_portalSalvarComunicado('${c?.id||''}')">
            ${isEdit ? 'Salvar alterações' : 'Publicar comunicado'}
          </button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function _portalSalvarComunicado(id) {
  const titulo = document.getElementById('com-titulo').value.trim();
  const tipo   = document.getElementById('com-tipo').value;
  const corpo  = document.getElementById('com-corpo').value.trim();
  if (!titulo || !corpo) { notify('Preencha título e mensagem', 'error'); return; }

  const payload = { titulo, tipo, corpo, ativo: true };
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
  const { data } = await sb.from('sorteios')
    .select('*')
    .order('criado_em', { ascending: false });
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
      ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(0,196,106,.08);border:1px solid rgba(0,196,106,.2);border-radius:8px;font-size:13px">
           🏆 <strong>Vencedor:</strong> ${s.vencedor_nome}
           ${s.vencedor_numero ? `<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px;margin-left:10px" onclick="_portalEnviarWhatsAppVencedor('${s.id}')">📱 Enviar WhatsApp</button>` : ''}
         </div>`
      : '';

    const btnSortear = s.status === 'aberto'
      ? `<button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="_portalRealizarSorteio('${s.id}')">🎯 Realizar Sorteio</button>`
      : '';

    return `
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:18px;margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">${mesNome} ${ano||''}</div>
            <div style="font-size:18px;font-weight:800;margin-bottom:4px">${s.premio}</div>
            ${s.descricao ? `<div style="font-size:13px;color:var(--muted)">${s.descricao}</div>` : ''}
            ${s.data_sorteio ? `<div style="font-size:12px;color:var(--muted2);margin-top:4px">Data do sorteio: ${new Date(s.data_sorteio+'T00:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            ${statusBadge}
            <div style="display:flex;gap:6px">
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
  const html = `
    <div class="modal-overlay show" id="modal-sorteio" onclick="if(event.target===this)closeModal('sorteio')">
      <div class="modal-box" style="max-width:480px">
        <div class="modal-header">
          <span class="modal-title">Novo Sorteio</span>
          <button class="modal-close" onclick="closeModal('sorteio')">×</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px">Mês de referência</label>
            <input id="sor-mes" type="month" class="input-base" style="width:100%" value="${new Date().toISOString().slice(0,7)}">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px">Prêmio</label>
            <input id="sor-premio" class="input-base" style="width:100%" placeholder="Ex: 4 semanas grátis, Capacete, R$200...">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px">Descrição (opcional)</label>
            <input id="sor-desc" class="input-base" style="width:100%" placeholder="Detalhes do prêmio...">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px">Data do sorteio (opcional)</label>
            <input id="sor-data" type="date" class="input-base" style="width:100%">
          </div>
          <button class="btn btn-primary" style="width:100%" onclick="_portalSalvarSorteio()">Criar sorteio</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function _portalSalvarSorteio() {
  const mes    = document.getElementById('sor-mes').value;
  const premio = document.getElementById('sor-premio').value.trim();
  const desc   = document.getElementById('sor-desc').value.trim();
  const data   = document.getElementById('sor-data').value;
  if (!mes || !premio) { notify('Preencha mês e prêmio', 'error'); return; }

  const { error } = await sb.from('sorteios').insert({
    mes_referencia: mes,
    premio,
    descricao: desc || null,
    data_sorteio: data || null,
    status: 'aberto'
  });
  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify('Sorteio criado!', 'success');
  closeModal('sorteio');
  await _portalLoadSorteios();
}

async function _portalRealizarSorteio(sorteioId) {
  if (!confirm('Realizar o sorteio agora? Esta ação não pode ser desfeita.')) return;

  // Buscar clientes de moto com contrato ativo e sem parcelas vencidas
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: locacoes } = await sb
    .from('locacoes')
    .select('id, cliente_id, num_contrato, clientes(nome, telefones)')
    .eq('status', 'ativa')
    .not('plano_moto', 'is', null);

  if (!locacoes?.length) { notify('Nenhum cliente elegível encontrado.', 'error'); return; }

  // Filtrar elegíveis: sem parcelas vencidas não pagas
  const elegiveis = [];
  for (const loc of locacoes) {
    const { data: vencidas } = await sb
      .from('cobrancas_semanais')
      .select('id')
      .eq('locacao_id', loc.id)
      .eq('status', 'pendente')
      .lt('data_vencimento', hoje)
      .limit(1);
    if (!vencidas?.length) elegiveis.push(loc);
  }

  if (!elegiveis.length) { notify('Nenhum cliente elegível (todos têm parcelas em atraso).', 'error'); return; }

  // Sortear aleatório
  const vencedor = elegiveis[Math.floor(Math.random() * elegiveis.length)];
  const nomeVencedor = vencedor.clientes?.nome || 'Desconhecido';
  const telefones = vencedor.clientes?.telefones;
  const numeroVencedor = Array.isArray(telefones) ? telefones[0]?.numero : (typeof telefones === 'string' ? JSON.parse(telefones)[0]?.numero : null);

  const { error } = await sb.from('sorteios').update({
    status: 'realizado',
    vencedor_locacao_id: vencedor.id,
    vencedor_nome: nomeVencedor,
    vencedor_numero: numeroVencedor || null
  }).eq('id', sorteioId);

  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify(`🏆 Vencedor sorteado: ${nomeVencedor}!`, 'success');
  await _portalLoadSorteios();
}

async function _portalVerElegiveis(sorteioId) {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: locacoes } = await sb
    .from('locacoes')
    .select('id, num_contrato, clientes(nome)')
    .eq('status', 'ativa')
    .not('plano_moto', 'is', null);

  const elegiveis = [];
  const naoElegiveis = [];
  for (const loc of locacoes || []) {
    const { data: vencidas } = await sb
      .from('cobrancas_semanais')
      .select('id')
      .eq('locacao_id', loc.id)
      .eq('status', 'pendente')
      .lt('data_vencimento', hoje)
      .limit(1);
    if (!vencidas?.length) elegiveis.push(loc);
    else naoElegiveis.push(loc);
  }

  const html = `
    <div class="modal-overlay show" id="modal-elegiveis" onclick="if(event.target===this)closeModal('elegiveis')">
      <div class="modal-box" style="max-width:500px;max-height:70vh;overflow-y:auto">
        <div class="modal-header">
          <span class="modal-title">Clientes Elegíveis</span>
          <button class="modal-close" onclick="closeModal('elegiveis')">×</button>
        </div>
        <div style="padding:20px">
          <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px">✅ Elegíveis (${elegiveis.length})</div>
          ${elegiveis.map(l => `<div style="padding:8px 12px;background:rgba(0,196,106,.06);border-radius:8px;margin-bottom:6px;font-size:13px">${l.clientes?.nome||'—'} — Contrato #${l.num_contrato}</div>`).join('')||'<div style="color:var(--muted);font-size:13px">Nenhum</div>'}
          <div style="font-size:13px;font-weight:700;color:var(--red);margin:16px 0 10px">❌ Não elegíveis (${naoElegiveis.length})</div>
          ${naoElegiveis.map(l => `<div style="padding:8px 12px;background:rgba(224,82,82,.06);border-radius:8px;margin-bottom:6px;font-size:13px">${l.clientes?.nome||'—'} — Contrato #${l.num_contrato}</div>`).join('')||'<div style="color:var(--muted);font-size:13px">Nenhum</div>'}
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function _portalEnviarWhatsAppVencedor(sorteioId) {
  const s = _allSorteios.find(x => x.id === sorteioId);
  if (!s?.vencedor_numero) { notify('Número do vencedor não encontrado.', 'error'); return; }

  const msg = `🏆 Parabéns, ${s.vencedor_nome}! Você foi o grande vencedor do sorteio Royal de ${s.mes_referencia}! O prêmio é: ${s.premio}. Entre em contato conosco para resgatar seu prêmio. 🎉`;

  try {
    const cfg = JSON.parse(localStorage.getItem('fp_evo_cfg') || '{}');
    if (!cfg.url || !cfg.key) throw new Error('Evolution API não configurada');
    await fetch(`${cfg.url}/message/sendText/${cfg.instance}`, {
      method: 'POST',
      headers: { 'apikey': cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: s.vencedor_numero, text: msg })
    });
    notify('WhatsApp enviado para o vencedor!', 'success');
  } catch(e) {
    notify('Erro ao enviar WhatsApp: ' + e.message, 'error');
  }
}

async function _portalDeletarSorteio(id) {
  if (!confirm('Excluir este sorteio?')) return;
  const { error } = await sb.from('sorteios').delete().eq('id', id);
  if (error) { notify('Erro: ' + error.message, 'error'); return; }
  notify('Sorteio excluído.', 'success');
  await _portalLoadSorteios();
}
