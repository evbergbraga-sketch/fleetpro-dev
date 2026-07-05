// contratos.js — Contratos, calendário e geração de PDF

// ══ LOGO BASE64 ══

// ══ TOGGLE CHECKLIST INLINE ══
// ── FOTOS DO CHECKLIST INLINE ──
let _ctchkFotos = [];

function _previewFotosInline(input){
  const preview = document.getElementById('ctchk-fotos-preview');
  if(!preview) return;
  Array.from(input.files).forEach(f=>{
    if(f.size > 10*1024*1024){ notify(f.name+': muito grande (máx 10MB)','error'); return; }
    _ctchkFotos.push(f);
    const isPdf = f.name.toLowerCase().endsWith('.pdf');
    const div = document.createElement('div');
    div.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;border:1px solid var(--border2)';
    if(isPdf){
      div.innerHTML = `<div style="background:var(--bg2);aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:var(--muted);gap:4px"><span style="font-size:20px">📄</span>${f.name.slice(0,12)}</div>`;
    } else {
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover';
      img.src = URL.createObjectURL(f);
      div.appendChild(img);
    }
    preview.appendChild(div);
  });
  input.value = '';
}

function _selecionarCombInline(valor){
  const inp = document.getElementById('ctchk-comb');
  const lbl = document.getElementById('ctchk-comb-label');
  const gauge = document.getElementById('ctchk-gauge');
  if(inp) inp.value = valor;
  if(lbl) lbl.textContent = valor;
  if(!gauge) return;
  const cores = ['#ef4444','#f59e0b','#f59e0b','#fbbf24','#fbbf24','#22c55e','#22c55e','#16a34a','#16a34a'];
  const niveis = ['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'];
  const idx = niveis.indexOf(valor);
  gauge.querySelectorAll('div[data-val]').forEach((cell,i)=>{
    const active = i <= idx;
    cell.style.background = active ? cores[i] : cores[i]+'22';
    cell.style.border = active ? '2px solid '+cores[i] : '2px solid transparent';
  });
}

async function _toggleChecklistInline(){
  const el = document.getElementById('ct-checklist-inline');
  if(!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : '';
  if(!isOpen){
    _ctchkFotos = [];
    const prev = document.getElementById('ctchk-fotos-preview');
    if(prev) prev.innerHTML = '';
    // Define hora padrão
    const horaEl = document.getElementById('ctchk-hora');
    if(horaEl && !horaEl.value){
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      horaEl.value = now.toISOString().slice(0,16);
    }
    // Atualiza título conforme tipo de contrato
    const tituloEl = document.getElementById('ctchk-titulo');
    if(tituloEl){
      const emoji = _tipoContrato === 'carro' ? '🚗' : '🏍️';
      const label = _tipoContrato === 'carro' ? 'Carro' : 'Moto';
      tituloEl.textContent = `📋 Checklist de Vistoria — Saída (${emoji} ${label})`;
    }
    // Carrega itens filtrados por tipo de contrato
    await _carregarItensChecklistInline();
  }
}

async function _carregarItensChecklistInline(){
  const wrap = document.getElementById('ctchk-itens');
  if(!wrap) return;
  if(!sb){ wrap.innerHTML='<div style="color:var(--muted2);font-size:13px">Banco não conectado.</div>'; return; }
  // Filtra por tipo_veiculo; fallback para todos se coluna não existir
  const tipo = _tipoContrato || 'moto';
  let itens = [];
  try {
    const {data, error} = await sb.from('checklist_itens')
      .select('*').eq('ativo', true)
      .in('tipo_veiculo', [tipo, 'ambos'])
      .order('ordem');
    if(error) throw error;
    itens = data || [];
    if(!itens.length){
      const {data: data2} = await sb.from('checklist_itens').select('*').eq('ativo', true).order('ordem');
      itens = (data2||[]).filter(it => !it.tipo_veiculo || it.tipo_veiculo === tipo || it.tipo_veiculo === 'ambos');
      if(!itens.length) itens = data2 || [];
    }
  } catch(_) {
    const {data} = await sb.from('checklist_itens').select('*').eq('ativo',true).order('ordem');
    itens = data || [];
  }
  if(!itens.length){
    wrap.innerHTML='<div style="color:var(--muted2);font-size:13px;text-align:center;padding:10px">Nenhum item configurado em Configurações.</div>';
    return;
  }
  const cats = {};
  itens.forEach(it=>{ if(!cats[it.categoria]) cats[it.categoria]=[]; cats[it.categoria].push(it); });
  wrap.innerHTML = Object.entries(cats).map(([cat,its])=>`
    <div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:6px">${cat}</div>
      ${its.map(it=>`
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:12px">${it.descricao}</div>
          <select id="ctchk-item-${it.id}" style="font-size:11px;padding:3px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text)">
            <option value="ok">✓ Ok / Sem avaria</option>
            <option value="avaria">✕ Com avaria</option>
            <option value="nao_houve">— Não Houve</option>
          </select>
          <input type="text" id="ctchk-obs-${it.id}" placeholder="obs..." style="font-size:11px;width:90px;padding:3px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--text)">
        </div>`).join('')}
    </div>`).join('');
  wrap.dataset.itens = JSON.stringify(itens);
}

function _coletarChecklistInline(){
  const wrap = document.getElementById('ctchk-itens');
  let itens = [];
  try{
    const raw = wrap?.dataset?.itens;
    if(raw && raw !== '[]') itens = JSON.parse(raw);
  }catch(e){ console.warn('[chk] parse itens:', e.message); }

  // Log diagnóstico
  console.log('[chk coletar] wrap existe:', !!wrap, '| dataset.itens length:', itens.length);

  const itensColetados = itens.map(it=>{
    const selEl  = document.getElementById('ctchk-item-'+it.id);
    const obsEl  = document.getElementById('ctchk-obs-'+it.id);
    const status = selEl?.value || 'ok';
    const obs    = obsEl?.value || '';
    if(!selEl) console.warn('[chk coletar] item sem elemento DOM:', it.id, it.descricao);
    return {
      descricao: it.descricao,
      categoria: it.categoria,
      status,
      obs,
    };
  });

  const horaEl = document.getElementById('ctchk-hora');
  const combEl = document.getElementById('ctchk-comb');

  return {
    km:          parseInt(document.getElementById('ctchk-km')?.value)||0,
    combustivel: combEl?.value || 'Cheio',
    horario:     horaEl?.value ? new Date(horaEl.value).toISOString() : new Date().toISOString(),
    observacoes: document.getElementById('ctchk-obs')?.value||'',
    itens:       itensColetados,
  };
}

// ══ HELPERS DE LOADING ══
function _showLoading(txt='Gerando contrato...'){
  const el = document.getElementById('m-contrato-loading');
  const txtEl = document.getElementById('m-contrato-loading-txt');
  if(txtEl) txtEl.textContent = txt;
  if(el) el.style.display='flex';
}
function _hideLoading(){
  const el = document.getElementById('m-contrato-loading');
  if(el) el.style.display='none';
}

// ══ REGISTRAR CONTRATO + CHECKLIST + PDF ÚNICO ══
async function registrarComChecklist(){
  const chkEl = document.getElementById('ct-checklist-inline');
  const temChecklist = chkEl && chkEl.style.display !== 'none';

  // PASSO 1: Garantir que itens estão carregados no DOM antes de coletar
  if(temChecklist){
    const wrap = document.getElementById('ctchk-itens');
    if(!wrap?.dataset?.itens || wrap.dataset.itens === '[]'){
      await _carregarItensChecklistInline();
    }
  }

  // PASSO 2: Coletar todos os dados do checklist AGORA (DOM ainda intacto)
  const chk = temChecklist ? _coletarChecklistInline() : null;
  const fotosParaUpload = [..._ctchkFotos]; // cópia antes de qualquer reset

  if(temChecklist){
    console.log('[chk] coletado — itens:', chk?.itens?.length, '| comb:', chk?.combustivel, '| km:', chk?.km);
    if(!chk?.itens?.length) console.warn('[chk] ATENÇÃO: itens vazios!');
  }

  _showLoading('Registrando contrato...');
  try{
    // PASSO 3: Registrar o contrato — retorna {locId, numContrato, d}
    const resultado = await registrarContrato(true);
    if(!resultado){ console.error('[chk] registrarContrato não retornou resultado'); return; }

    const { locId, numContrato, d } = resultado;
    console.log('[chk] locId:', locId, 'numContrato:', numContrato);

    // PASSO 4: Se não tem checklist, gera PDF simples e sai
    if(!temChecklist || !chk){
      _showLoading('Gerando PDF...');
      const pdfUrl = await gerarPdfContrato(numContrato, d, null, true);
      if(pdfUrl){
        const a = document.createElement('a');
        a.href = pdfUrl; a.download = 'Contrato_Royal_'+numContrato+'_'+(d.nomeCli||'').replace(/\s+/g,'_')+'.pdf';
        a.click();
        notify('PDF do Contrato #'+numContrato+' gerado!','success');
      }
      _showLoading('Enviando para assinatura...');
      const _cid0 = document.getElementById('c-cli')?.value||null;
      if(locId) await enviarParaAssinatura(numContrato, d, locId, pdfUrl, _cid0);
      await carregarTudo();
      return;
    }

    // PASSO 5: Upload de fotos para o Storage
    _showLoading('Enviando fotos...');
    const fotosUrls = [];
    for(const f of fotosParaUpload){
      try{
        const ext = (f.name.split('.').pop()||'jpg').toLowerCase();
        const path = 'contratos/'+locId+'/'+Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
        const {error:upErr} = await sb.storage.from('checklists').upload(path, f);
        if(!upErr){
          const {data:signData} = await sb.storage.from('checklists').createSignedUrl(path, 60*60*24*365);
          if(signData?.signedUrl) fotosUrls.push(signData.signedUrl);
        }
      }catch(e){ console.warn('[chk] foto upload:', e.message); }
    }

    // PASSO 6: Montar payload e salvar checklist no banco
    _showLoading('Salvando checklist...');
    const chkPayload = {
      locacao_id:  locId,
      tipo:        'saida',
      km:          parseInt(chk.km)||0,
      combustivel: chk.combustivel||'Cheio',
      horario:     chk.horario ? new Date(chk.horario).toISOString() : new Date().toISOString(),
      observacoes: chk.observacoes||null,
      itens:       Array.isArray(chk.itens) ? chk.itens : [],
      fotos:       fotosUrls,
      ...(currentUser?.id ? {criado_por: currentUser.id} : {}),
    };

    console.log('[chk] salvando no banco:', JSON.stringify(chkPayload).slice(0,200));

    const {data:chkSalvo, error:chkErr} = await sb
      .from('checklists')
      .insert(chkPayload)
      .select('id,locacao_id,tipo')
      .single();

    if(chkErr){
      console.error('[chk] ERRO ao salvar:', chkErr);
      notify('⚠️ Checklist não salvo: '+chkErr.message,'error');
    } else {
      console.log('[chk] SALVO com sucesso — id:', chkSalvo.id, 'locacao_id:', chkSalvo.locacao_id);
      notify('✅ Contrato + Checklist registrados!','success');
    }

    // PASSO 7: Gerar PDF com checklist (UMA VEZ) → usado para download e Autentique
    _showLoading('Gerando PDF com checklist...');
    const pdfComChk = await gerarPdfContrato(numContrato, d, chk, true);
    if(pdfComChk){
      const a = document.createElement('a');
      a.href = pdfComChk; a.download = 'Contrato_Royal_'+numContrato+'_'+(d.nomeCli||'').replace(/\s+/g,'_')+'.pdf';
      a.click();
      notify('PDF do Contrato #'+numContrato+' gerado!','success');
    }

    // PASSO 7b: Enviar para assinatura digital COM O MESMO PDF (inclui checklist)
    _showLoading('Enviando para assinatura digital...');
    const _cidChk = document.getElementById('c-cli')?.value||null;
    if(locId) await enviarParaAssinatura(numContrato, d, locId, pdfComChk, _cidChk);

    // PASSO 8: Recarregar dados DEPOIS de tudo concluído
    await carregarTudo();
  }finally{
    _hideLoading();
  }
}


// ══ NÚMERO DO CONTRATO ══
// Sincroniza o número do contrato com o banco (maior num_contrato + 1)
async function _sincronizarNumContrato(){
  try{
    // Busca todos para garantir pegar o maior (evita ordenação errada em strings)
    const {data} = await sb.from('locacoes')
      .select('num_contrato')
      .not('num_contrato', 'is', null)
      .order('num_contrato', {ascending:false})
      .limit(10);
    // Converte para número e pega o maior
    const nums = (data||[]).map(r=>parseInt(r.num_contrato||'0')).filter(n=>!isNaN(n)&&n>0);
    const maiorNoBanco = nums.length ? Math.max(...nums) : 0;
    const noLocal      = parseInt(localStorage.getItem('fp_contrato_seq')||'0');
    // Mínimo 40 para garantir continuidade
    const maior = Math.max(maiorNoBanco, noLocal, 40);
    localStorage.setItem('fp_contrato_seq', String(maior));
    return maior;
  }catch(_){ return Math.max(parseInt(localStorage.getItem('fp_contrato_seq')||'0'), 40); }
}

function _proximoNumContrato(){
  const n = parseInt(localStorage.getItem('fp_contrato_seq')||'0') + 1;
  localStorage.setItem('fp_contrato_seq', String(n));
  return n;
}
function _peekNumContrato(){
  return parseInt(localStorage.getItem('fp_contrato_seq')||'0') + 1;
}

// ══ TIPO DE CONTRATO ══
let _tipoContrato = 'moto';

function selecionarTipoContrato(tipo){
  _tipoContrato = tipo;
  document.querySelectorAll('.btn-tipo-contrato').forEach(b=>
    b.classList.toggle('active', b.dataset.tipo===tipo));
  document.getElementById('campos-moto').style.display  = tipo==='moto'  ? '' : 'none';
  document.getElementById('campos-carro').style.display = tipo==='carro' ? '' : 'none';
  document.getElementById('label-valor-principal').textContent = tipo==='moto' ? 'Valor semanal (R$)' : 'Diária (R$)';
  // label-periodo é agora estático (período calculado automaticamente)
  window._reservaOrigemId = null;
  window._reservaValorPago = 0;
  _toggleCamposCartao();
  previewContrato();
}

// ══ PROTEÇÃO COMPLETA — mostra/esconde campo de valor ══
function _toggleProtecaoCompleta(){
  const sel = document.getElementById('c-protecao')?.value;
  const wrap = document.getElementById('wrap-protecao-valor');
  if(wrap) wrap.style.display = sel==='Completa' ? '' : 'none';
}

// ══ CARTÃO — mostra/esconde campos ══
function _toggleCamposCartao(){
  const pgto = document.getElementById('c-pgto')?.value||'';
  const isCard = pgto.toLowerCase().includes('cartão') || pgto.toLowerCase().includes('cartao');
  const el = document.getElementById('campos-cartao');
  if(el) el.style.display = isCard ? '' : 'none';
}

// ══ CONDUTORES ADICIONAIS ══
let _condutoresLista = []; // [{nome, cpf}]

function _renderCondutores(){
  const wrap = document.getElementById('condutores-lista');
  if(!wrap) return;
  wrap.innerHTML = _condutoresLista.map((c,i)=>`
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:13px;font-weight:600">${c.nome}</div>
        <button onclick="_removerCondutor(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px;color:var(--muted)">
        <div>CPF: <span style="color:var(--text)">${c.cpf||'—'}</span></div>
        <div>CNH: <span style="color:var(--text)">${c.cnh||'—'}${c.cnhCat?' ('+c.cnhCat+')':''}</span></div>
        <div>Validade: <span style="color:var(--text)">${c.cnhVal?c.cnhVal.split('-').reverse().join('/'):'—'}</span></div>
      </div>
    </div>`).join('');
  previewContrato();
}

function _abrirFormCondutor(){
  const el = document.getElementById('novo-condutor-form');
  if(el) el.style.display = '';
}
function _fecharFormCondutor(){
  const el = document.getElementById('novo-condutor-form');
  if(el) el.style.display = 'none';
  ['novo-condutor-nome','novo-condutor-cpf','novo-condutor-cnh','novo-condutor-cnh-cat','novo-condutor-cnh-val','novo-condutor-cnh-seg'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.value='';
  });
}
function _adicionarCondutor(){
  const nome   = document.getElementById('novo-condutor-nome')?.value.trim();
  const cpf    = document.getElementById('novo-condutor-cpf')?.value.trim();
  const cnh    = document.getElementById('novo-condutor-cnh')?.value.trim();
  const cnhCat = document.getElementById('novo-condutor-cnh-cat')?.value.trim();
  const cnhVal = document.getElementById('novo-condutor-cnh-val')?.value.trim();
  const cnhSeg = document.getElementById('novo-condutor-cnh-seg')?.value.trim();
  if(!nome){ notify('Informe o nome do condutor','error'); return; }
  _condutoresLista.push({nome, cpf, cnh, cnhCat, cnhVal, cnhSeg});
  _fecharFormCondutor();
  _renderCondutores();
}

function _removerCondutor(i){
  _condutoresLista.splice(i,1);
  _renderCondutores();
}

// Busca condutores salvos do cliente selecionado
async function _carregarCondutoresCliente(){
  _condutoresLista = [];
  const cid = document.getElementById('c-cli')?.value;
  if(!cid||!sb) return;
  const {data} = await sb.from('condutores').select('*').eq('cliente_id',cid).order('nome');
  if(data?.length){
    _condutoresLista = data.map(d=>({nome:d.nome, cpf:d.cpf||'', cnh:d.cnh||'', cnhCat:d.cnh_categoria||'', cnhVal:d.cnh_validade||'', cnhSeg:'', id:d.id}));
  }
  _renderCondutores();
}

// ══ SERVIÇOS ADICIONAIS ══
let _servicosLista = []; // [{descricao, valor}]

function _renderServicos(){
  const wrap = document.getElementById('servicos-lista');
  if(!wrap) return;
  const total = _servicosLista.reduce((acc,s)=>acc+(parseFloat(s.valor)||0),0);
  wrap.innerHTML = _servicosLista.map((s,i)=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="flex:2;font-size:13px">${s.descricao}</div>
      <div style="font-weight:600;color:var(--accent)">R$ ${parseFloat(s.valor||0).toFixed(2).replace('.',',')}</div>
      <button onclick="_removerServico(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>
    </div>`).join('') + (total>0 ? `<div style="text-align:right;font-size:12px;font-weight:700;color:var(--accent);border-top:1px solid var(--border2);padding-top:6px;margin-top:4px">Total serviços: R$ ${total.toFixed(2).replace('.',',')}</div>` : '');
  previewContrato();
}

function _adicionarServico(){
  const desc = document.getElementById('novo-servico-desc')?.value.trim();
  const val  = document.getElementById('novo-servico-val')?.value;
  if(!desc){ notify('Informe a descrição do serviço','error'); return; }
  _servicosLista.push({descricao:desc, valor:parseFloat(val)||0});
  document.getElementById('novo-servico-desc').value = '';
  document.getElementById('novo-servico-val').value = '';
  _renderServicos();
}

function _removerServico(i){
  _servicosLista.splice(i,1);
  _renderServicos();
}

// ══ POPULA SELECTS ══
// Preenche campos visíveis do cliente ao selecionar no contrato
function _preencherCamposClienteContrato(){
  const opt = document.getElementById('c-cli')?.selectedOptions[0];
  if(!opt) return;
  const sv = (id, val) => { const e=document.getElementById(id); if(e&&val) e.value=val; };
  // Dados básicos
  sv('c-condutor',         opt.dataset.nome);
  sv('c-condutor-cpf',     opt.dataset.cpf);
  // CNH completa do perfil
  sv('c-condutor-cnh',     opt.dataset.cnh);
  sv('c-condutor-cnh-cat', opt.dataset.cnhCat);
  sv('c-condutor-cnh-val', opt.dataset.cnhVal);
  sv('c-condutor-cnh-seg', opt.dataset.cnhSeg||'');
  // Carrega condutores do cliente
  _carregarCondutoresCliente();
}

function populateContratosSelects(){
  // Limpa os campos de busca visíveis (serão sincronizados de novo se
  // algum valor for pré-selecionado logo em seguida, ex: vindo do chat/reserva)
  const cliBusca = document.getElementById('c-cli-busca');
  const veiBusca = document.getElementById('c-vei-busca');
  if(cliBusca) cliBusca.value = '';
  if(veiBusca) veiBusca.value = '';

  // Sincroniza número do contrato com o banco a cada abertura da aba
  _sincronizarNumContrato().then(maior=>{
    const proximo = maior + 1;
    localStorage.setItem('fp_contrato_seq', String(maior));
    const el = document.getElementById('c-num-display');
    if(el) el.textContent = `Contrato #${proximo}`;
    const elPrev = document.getElementById('ct-num');
    if(elPrev) elPrev.textContent = `#${proximo}`;
  });
  const cs = document.getElementById('c-cli');
  if(cs){
    const aprovados = allClientes.filter(c=>c.tipo!=='lead' && (!c.status_analise || c.status_analise === 'aprovado'));
    cs.innerHTML = aprovados.map(c=>{
      // Pega telefone principal (legado ou JSON)
      let tel = c.telefone || '';
      if(!tel && c.telefones){ try{ const a=JSON.parse(c.telefones); if(a?.length) tel=a[0].numero; }catch(_){} }
      // Pega email principal
      let email = c.email || '';
      if(!email && c.emails){ try{ const a=JSON.parse(c.emails); if(a?.length) email=a[0].email; }catch(_){} }
      const _e = s => String(s||'').replace(/"/g,'&quot;');
      const endStr = c.endereco||[c.endereco_rua,c.endereco_numero,c.endereco_bairro,c.endereco_cidade,c.endereco_uf].filter(Boolean).join(', ');
      return `<option value="${c.id}"
        data-nome="${_e(c.nome)}"
        data-cpf="${_e(c.cpf)}"
        data-tel="${_e(tel)}"
        data-email="${_e(email)}"
        data-cnh="${_e(c.cnh)}"
        data-cnh-val="${_e(c.cnh_validade)}"
        data-cnh-cat="${_e(c.cnh_categoria)}"
        data-cnh-seg="${_e(c.cnh_seguranca)}"
        data-nasc="${_e(c.data_nascimento)}"
        data-end="${_e(endStr)}"
        data-pai="${_e(c.nome_pai)}"
        data-mae="${_e(c.nome_mae)}"
      >${_e(c.nome)}${c.status_analise==='aprovado'?' ✅':''}</option>`;
    }).join('');
    // Preenche campos do cliente ao trocar o select
    cs.addEventListener('change', _preencherCamposClienteContrato);
    _preencherCamposClienteContrato();
  }

  const vs = document.getElementById('c-vei');
  const disp = allVeiculos.filter(v=>v.status==='disponivel'||v.status==='reservado');
  if(vs){
    vs.innerHTML = disp.map(v=>
      `<option value="${v.id}" data-diaria="${v.diaria}" data-placa="${v.placa}" data-tipo="${v.tipo}" data-modelo="${v.marca} ${v.modelo}">${v.marca} ${v.modelo} — ${v.placa}${v.status==='reservado'?' (reservado)':''}</option>`).join('');
    autoFillContrato();
    _verificarMotoContrato(); // mostra planos se for moto
  }

  _condutoresLista = [];
  _servicosLista   = [];
  _renderCondutores();
  _renderServicos();
  previewContrato();
  // Número atualizado pela sincronização assíncrona acima (não chamar _atualizarNumContrato aqui)

  // Data/hora padrão: agora
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowStr = now.toISOString().slice(0,16);
  const iniEl = document.getElementById('c-ini');
  const fimEl = document.getElementById('c-fim');
  if(iniEl && !iniEl.value) iniEl.value = nowStr;
}

function _atualizarNumContrato(){
  const n = _peekNumContrato();
  const el = document.getElementById('ct-num'); if(el) el.textContent = n;
  const el2 = document.getElementById('c-num-display'); if(el2) el2.textContent = `Contrato #${n}`;
}

// ══ COMBOBOX DE BUSCA — CLIENTE E VEÍCULO ══
// O <select> original fica escondido no DOM (preserva toda a lógica de
// preenchimento existente via data-* e onchange). O <input> visível
// dispara a busca e mostra os resultados como lista clicável.
function _comboBuscar(selectId, termo){
  const sel = document.getElementById(selectId);
  const res = document.getElementById(selectId+'-resultados');
  if(!sel || !res) return;

  const t = termo.trim().toLowerCase();
  const termoNum = termo.replace(/\D/g,'');

  const opcoes = Array.from(sel.options).filter(opt=>{
    if(!opt.value) return false;
    if(!t) return true;
    if(selectId === 'c-cli'){
      const nome = (opt.dataset.nome||'').toLowerCase();
      const tel  = (opt.dataset.tel||'').replace(/\D/g,'');
      return nome.includes(t) || (termoNum && tel.includes(termoNum));
    } else {
      const placa  = (opt.dataset.placa||'').toLowerCase();
      const modelo = (opt.dataset.modelo||'').toLowerCase();
      return placa.includes(t) || modelo.includes(t);
    }
  });

  if(!opcoes.length){
    res.innerHTML = `<div style="padding:10px 14px;font-size:12px;color:var(--muted)">Nenhum resultado encontrado</div>`;
    res.style.display = '';
    return;
  }

  res.innerHTML = opcoes.slice(0,50).map(opt=>{
    const sub = selectId === 'c-cli' ? (opt.dataset.tel||'') : (opt.dataset.placa||'');
    return `<div class="search-result-item" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border2)" onmousedown="event.preventDefault();_comboSelecionar('${selectId}','${opt.value}')">
      <div style="font-weight:600;color:var(--text)">${opt.textContent}</div>
      ${sub?`<div style="font-size:11px;color:var(--muted)">${sub}</div>`:''}
    </div>`;
  }).join('');
  res.style.display = '';
}

function _comboSelecionar(selectId, value){
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(selectId+'-busca');
  const res = document.getElementById(selectId+'-resultados');
  if(!sel) return;
  sel.value = value;
  const opt = sel.selectedOptions[0];
  if(inp) inp.value = opt ? opt.textContent : '';
  if(res) res.style.display = 'none';
  sel.dispatchEvent(new Event('change'));
}

// Sincroniza o input visível a partir do valor atual do <select> — usado
// quando o select é preenchido programaticamente (ex: vindo de uma reserva
// ou do chat), sem passar por _comboSelecionar.
function _comboSincronizarInput(selectId){
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(selectId+'-busca');
  if(!sel || !inp) return;
  const opt = sel.selectedOptions[0];
  inp.value = opt ? opt.textContent : '';
}

// Fecha a lista de resultados ao clicar fora
document.addEventListener('click', (e)=>{
  ['c-cli','c-vei'].forEach(id=>{
    const res = document.getElementById(id+'-resultados');
    const inp = document.getElementById(id+'-busca');
    if(res && res.style.display !== 'none' && e.target!==inp && !res.contains(e.target)){
      res.style.display = 'none';
    }
  });
});

function autoFillContrato(){
  const opt = document.getElementById('c-vei')?.selectedOptions[0];
  if(!opt) return;
  document.getElementById('c-dia').value = opt.dataset.diaria||'';
  const tipoVeic = opt.dataset.tipo;
  if(tipoVeic) selecionarTipoContrato(tipoVeic);
  previewContrato();
}

// ══ PREVIEW ══
function previewContrato(){
  const cOpt  = document.getElementById('c-cli')?.selectedOptions[0];
  const vOpt  = document.getElementById('c-vei')?.selectedOptions[0];
  // Atualiza campos visíveis do cliente no formulário
  if(cOpt) _preencherCamposClienteContrato();
  const ini   = document.getElementById('c-ini')?.value||'';
  const fim   = document.getElementById('c-fim')?.value||'';
  const dia   = parseFloat(document.getElementById('c-dia')?.value)||0;
  const descontoValor = parseFloat(document.getElementById('c-desconto-valor')?.value)||0;
  const descontoTipo  = document.getElementById('c-desconto-tipo')?.value||'reais';
  const diaOriginal = dia;
  let diaComDesconto = descontoTipo==='pct'
    ? Math.max(0, dia - (dia * descontoValor/100))
    : Math.max(0, dia - descontoValor);

  // ── Limite de desconto por usuário (admin = sem limite) ──
  const descontoMaxPct = currentPerfil?.perfil==='admin' ? 100 : (currentPerfil?.desconto_max_pct ?? 0);
  const descontoAplicadoPct = diaOriginal>0 ? ((diaOriginal-diaComDesconto)/diaOriginal*100) : 0;
  const descontoBloqueado = descontoAplicadoPct > descontoMaxPct + 0.001;
  if(descontoBloqueado){
    diaComDesconto = diaOriginal * (1 - descontoMaxPct/100);
  }

  const temDesconto = descontoValor > 0 && diaComDesconto < diaOriginal;
  const km    = document.getElementById('c-km')?.value||'—';
  const obs   = document.getElementById('c-obs')?.value||'';
  const caucao= parseFloat(document.getElementById('c-caucao')?.value)||0;
  const pgto       = document.getElementById('c-pgto')?.value||'PIX';
  const pgtoCaucao = document.getElementById('c-pgto-caucao')?.value||pgto;
  const parcelas      = parseInt(document.getElementById('c-cartao-parcelas')?.value)||1;
  const cartao4dig    = document.getElementById('c-cartao-numero')?.value?.trim()||'';
  const cartaoVal     = document.getElementById('c-cartao-validade')?.value?.trim()||'';
  const cartaoBand    = document.getElementById('c-cartao-bandeira')?.value||'';
  const cartaoTitular = document.getElementById('c-cartao-titular')?.value?.trim()||'';
  const cartaoSalvar  = document.getElementById('c-cartao-salvar')?.checked||false;
  const pgtoLabel  = (pgto.toLowerCase().includes('cartão')||pgto.toLowerCase().includes('cartao'))
    ? `${pgto}${cartaoBand?' ('+cartaoBand+')':''}${cartao4dig?' ****'+cartao4dig:''}${parcelas>1?' '+parcelas+'x':' à vista'}`
    : pgto;
  const condutor    = document.getElementById('c-condutor')?.value||'';
  const condutorCpf = document.getElementById('c-condutor-cpf')?.value||'';
  const localRet    = document.getElementById('c-local-ret')?.value||'Loja';
  const descricao   = document.getElementById('c-descricao')?.value||'';
  const planoSel    = document.querySelector('input[name="c-plano-moto"]:checked');
  const planoNome   = planoSel?.value==='379.99' ? 'Plano 12 meses — R$ 379,99/sem'
                    : planoSel?.value==='399.90' ? 'Plano Conquista 36m — R$ 399,90/sem' : '';
  const isMoto      = _tipoContrato === 'moto';

  // ── Período calculado automaticamente pelas datas ──
  let periodoVal = 1;
  let days = 1;
  let diasLabel = '';
  if(ini && fim){
    const diffMs = new Date(fim) - new Date(ini);
    if(isMoto){
      periodoVal = Math.max(1, Math.round(diffMs / (7*24*3600*1000)));
      diasLabel = `${periodoVal} semana${periodoVal!==1?'s':''}`;
    } else {
      days = Math.max(1, Math.ceil(diffMs / (24*3600*1000)));
      periodoVal = days;
      diasLabel = `${days} dia${days!==1?'s':''}`;
    }
  } else {
    diasLabel = isMoto ? '1 semana' : '1 dia';
  }
  // Atualiza display do período
  const perDisplay = document.getElementById('c-periodo-display');
  if(perDisplay) perDisplay.textContent = ini&&fim ? diasLabel : '— preencha as datas';
  const perHidden = document.getElementById('c-periodo');
  if(perHidden) perHidden.value = periodoVal;

  // Cálculo total
  const totalServicos = _servicosLista.reduce((acc,s)=>acc+(parseFloat(s.valor)||0),0);
  let totalBruto = 0;

  if(isMoto){
    totalBruto = diaComDesconto * periodoVal;
  } else {
    totalBruto = diaComDesconto * days;
    const lavagem = parseFloat(document.getElementById('c-lavagem')?.value)||0;
    const protVal = document.getElementById('c-protecao')?.value==='Completa'
      ? parseFloat(document.getElementById('c-protecao-valor')?.value)||0 : 0;
    totalBruto += lavagem + protVal;
  }
  totalBruto += totalServicos;

  // Taxa administrativa
  const taxaAdminIsenta = document.getElementById('c-taxa-admin-isenta')?.checked || false;
  const taxaAdminPct    = taxaAdminIsenta ? 0 : (parseFloat(document.getElementById('c-taxa-admin')?.value)||0);
  const taxaAdminVal    = taxaAdminIsenta ? 0 : (totalBruto * taxaAdminPct / 100);
  totalBruto += taxaAdminVal;

  const taxaDisplayForm = document.getElementById('c-taxa-admin-display');
  if(taxaDisplayForm){
    if(taxaAdminIsenta) taxaDisplayForm.textContent = '✓ Taxa isentada';
    else if(taxaAdminPct > 0) taxaDisplayForm.textContent = `+ R$ ${taxaAdminVal.toLocaleString('pt-BR',{minimumFractionDigits:2})} (${taxaAdminPct}%)`;
    else taxaDisplayForm.textContent = '';
  }

  const valorPagoReserva = window._reservaValorPago||0;
  const valorPagoAto     = parseFloat(document.getElementById('c-valor-pago-ato')?.value)||0;
  const dividirPgto      = document.getElementById('c-dividir-pagamento')?.checked||false;
  const valorPgto1       = dividirPgto ? (parseFloat(document.getElementById('c-valor-pgto1')?.value)||0) : valorPagoAto;
  const formaPgto1       = dividirPgto ? (document.getElementById('c-forma-pgto1')?.value||pgto) : pgto;
  const valorPgto2       = dividirPgto ? (parseFloat(document.getElementById('c-valor-pgto2')?.value)||0) : 0;
  const formaPgto2       = dividirPgto ? (document.getElementById('c-forma-pgto2')?.value||'') : '';

  const valorPago = valorPagoReserva + valorPagoAto;
  const totalLiq  = Math.max(0, totalBruto - valorPago);
  const valorRestante = Math.max(0, totalBruto - valorPago);

  const restanteEl = document.getElementById('c-valor-restante-display');
  if(restanteEl) restanteEl.value = `R$ ${valorRestante.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;

  const nomeCli     = cOpt?.dataset.nome||'___';
  const cpfCli      = cOpt?.dataset.cpf||'___';
  const telCli      = cOpt?.dataset.tel||'___';
  const emailCli    = cOpt?.dataset.email||'';
  const cnhCli      = cOpt?.dataset.cnh||'';
  const cnhValCli   = cOpt?.dataset.cnhVal||'';
  const cnhCatCli   = cOpt?.dataset.cnhCat||'';
  const endCli      = cOpt?.dataset.end||'';
  const nascCli     = cOpt?.dataset.nasc||'';
  const placa       = vOpt?.dataset.placa||'___';
  const modelo      = vOpt?.dataset.modelo||'___';
  const atendente   = currentPerfil?.nome||'—';
  const numCtrato   = _peekNumContrato();

  // Todos os condutores (principal + adicionais)
  const todosCond = [
    {nome: condutor||nomeCli, cpf: condutorCpf||cpfCli},
    ..._condutoresLista
  ];

  // Atualiza preview
  _set('ct-num', numCtrato);
  _set('ct-tipo-badge', isMoto ? 'MOTO' : 'CARRO');
  _set('ct-cli', nomeCli);
  _set('ct-cli2', nomeCli);
  _set('ct-cpf', cpfCli);
  _set('ct-tel', telCli);
  _set('ct-condutor', todosCond.map(c=>c.nome).join(', '));
  _set('ct-condutor-cpf', todosCond.map(c=>c.cpf).filter(Boolean).join(', '));
  _set('ct-placa', placa);
  _set('ct-modelo', modelo);
  _set('ct-local-ret', localRet);
  _set('ct-ini', ini ? _fmtDatetime(ini) : '__/__/____ __:__');
  _set('ct-fim', fim ? _fmtDatetime(fim) : '__/__/____ __:__');
  _set('ct-periodo', diasLabel);
  _set('ct-dia-val', temDesconto
    ? `<span style="text-decoration:line-through;color:#999;font-size:9px">R$ ${diaOriginal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span><br>R$ ${diaComDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`
    : `R$ ${diaComDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, true);

  const descPrevEl = document.getElementById('c-desconto-preview');
  if(descPrevEl){
    if(descontoBloqueado){
      descPrevEl.innerHTML = `<span style="color:var(--red,#dc2626)">⚠️ Desconto limitado a ${descontoMaxPct}% para seu perfil. Valor ajustado: R$ ${diaComDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2})} (original R$ ${diaOriginal.toLocaleString('pt-BR',{minimumFractionDigits:2})})</span>`;
    } else if(temDesconto){
      descPrevEl.textContent = `Valor com desconto: R$ ${diaComDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2})} (original R$ ${diaOriginal.toLocaleString('pt-BR',{minimumFractionDigits:2})})`;
    } else {
      descPrevEl.textContent = '';
    }
  }
  _set('ct-servicos-total', totalServicos>0 ? `+ R$ ${totalServicos.toLocaleString('pt-BR',{minimumFractionDigits:2})} (serviços)` : '');
  const ctTaxaEl = document.getElementById('ct-taxa-admin-display');
  if(ctTaxaEl){
    if(taxaAdminIsenta) ctTaxaEl.textContent = '✓ Taxa administrativa isentada';
    else if(taxaAdminPct > 0) ctTaxaEl.textContent = `+ R$ ${taxaAdminVal.toLocaleString('pt-BR',{minimumFractionDigits:2})} — Taxa administrativa (${taxaAdminPct}%)`;
    else ctTaxaEl.textContent = '';
  }
  _set('ct-total-bruto', `R$ ${totalBruto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
  _set('ct-total', `R$ ${totalBruto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
  _set('ct-km', km);
  _set('ct-obs', obs||'Veículo em perfeito estado. Cliente responsável por multas.');
  _set('ct-caucao', `R$ ${caucao.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
  _set('ct-pgto', pgto);
  _set('ct-atendente', atendente);
  _set('ct-data', new Date().toLocaleDateString('pt-BR'));

  const avisoEl = document.getElementById('ct-aviso-reserva');
  if(avisoEl){
    const partes = [];
    if(valorPagoReserva>0) partes.push(`Reserva: R$ ${valorPagoReserva.toFixed(2).replace('.',',')}`);
    if(valorPagoAto>0){
      if(dividirPgto && valorPgto2>0){
        partes.push(`No ato: R$ ${valorPgto1.toFixed(2).replace('.',',')} (${formaPgto1}) + R$ ${valorPgto2.toFixed(2).replace('.',',')} (${formaPgto2})`);
      } else {
        partes.push(`No ato: R$ ${valorPagoAto.toFixed(2).replace('.',',')} (${formaPgto1})`);
      }
    }
    avisoEl.style.display = valorPago>0 ? 'block' : 'none';
    if(valorPago>0) avisoEl.innerHTML = `💵 ${partes.join(' · ')} · <strong>Restante: R$ ${valorRestante.toFixed(2).replace('.',',')}</strong>`;
  }

  return {totalBruto, totalLiq, valorPago, valorPagoReserva, valorPagoAto, valorRestante,
    dividirPgto, valorPgto1, formaPgto1, valorPgto2, formaPgto2,
    pgtoCaucao, descricao, planoNome, nomeCli, cpfCli, telCli, pgtoLabel, parcelas, cartao4dig, cartaoVal, cartaoBand, cartaoTitular, cartaoSalvar,
    emailCli, cnhCli, cnhValCli, cnhCatCli, endCli, nascCli,
    placa, modelo, atendente, diasLabel, dia: diaComDesconto, diaOriginal, temDesconto, descontoValor, descontoTipo, km, obs, condutor: todosCond[0].nome,
    condutorCpf: todosCond[0].cpf, todosCondutores: todosCond,
    pgto, caucao, numCtrato, periodoVal, ini, fim, localRet,
    totalServicos, servicos: _servicosLista, days,
    taxaAdminPct, taxaAdminVal, taxaAdminIsenta,
    clienteId: document.getElementById('c-cli')?.value||null,
    veiculoId:  document.getElementById('c-vei')?.value||null};
}

function _fmtDatetime(str){
  if(!str) return '—';
  const d = new Date(str);
  if(isNaN(d)) return str;
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

function _set(id, val, isHtml){
  const el = document.getElementById(id);
  if(el){ if(isHtml) el.innerHTML = val; else el.textContent = val; }
}

// ══ REGISTRAR CONTRATO ══
async function registrarContrato(retornarId=false){
  const d = previewContrato();
  const cid = document.getElementById('c-cli')?.value;
  const vid = document.getElementById('c-vei')?.value;
  const ini = document.getElementById('c-ini')?.value;
  const fim = document.getElementById('c-fim')?.value;
  const km  = parseInt(document.getElementById('c-km')?.value)||0;
  const obs = document.getElementById('c-obs')?.value||'';

  if(!cid||!vid||!ini||!fim){ notify('Preencha cliente, veículo e datas','error'); return; }

  const btn = document.querySelector('#page-contratos .btn-registrar');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }

  try{
    const numContrato = _proximoNumContrato();

    // Salva condutores novos no perfil do cliente
    for(const cond of _condutoresLista){
      if(!cond.id){ // novo (não veio do banco)
        await sb.from('condutores').insert({
          cliente_id:cid, nome:cond.nome, cpf:cond.cpf||null
        });
      }
    }

    // Salva cartão se informado
    let cartaoId = null;
    const pgto = document.getElementById('c-pgto')?.value||'';
    const isCard = pgto.toLowerCase().includes('cartão')||pgto.toLowerCase().includes('cartao');
    if(isCard){
      const titular = document.getElementById('c-cartao-titular')?.value?.trim();
      const numero  = document.getElementById('c-cartao-numero')?.value?.trim();
      const validade= document.getElementById('c-cartao-validade')?.value?.trim();
      const bandeira= document.getElementById('c-cartao-bandeira')?.value||'';
      if(titular && numero){
        const {data:cartSalvo} = await sb.from('cartoes').insert({
          cliente_id:cid, titular, numero, validade, bandeira
        }).select().single();
        cartaoId = cartSalvo?.id||null;
      }
    }

    // Coleta dados do condutor principal e plano (moto)
    const condutorCnh    = document.getElementById('c-condutor-cnh')?.value||'';
    const condutorCnhCat = document.getElementById('c-condutor-cnh-cat')?.value||'';
    const condutorCnhVal = document.getElementById('c-condutor-cnh-val')?.value||null;
    const condutorCnhSeg = document.getElementById('c-condutor-cnh-seg')?.value||'';
    const planoMoto      = document.querySelector('input[name="c-plano-moto"]:checked')?.value||null;
    const primeiraSemanaIncluida = document.getElementById('c-primeira-semana-incluida')?.checked !== false;

    const {data:locSalva, error} = await sb.from('locacoes').insert({
      veiculo_id:vid, cliente_id:cid,
      data_inicio: ini.slice(0,10),
      data_fim: fim.slice(0,10),
      data_inicio_hora: ini,
      data_fim_hora: fim,
      km_inicial:km,
      diaria:d.dia,
      diaria_original: d.temDesconto ? d.diaOriginal : null,
      desconto_valor: d.temDesconto ? d.descontoValor : null,
      desconto_tipo: d.temDesconto ? d.descontoTipo : null,
      total: d.totalBruto,
      valor_pago_ato: d.valorPagoAto||null,
      valor_restante: d.valorRestante,
      forma_pgto_2: (d.dividirPgto && d.valorPgto2>0) ? d.formaPgto2 : null,
      valor_pgto_2: (d.dividirPgto && d.valorPgto2>0) ? d.valorPgto2 : null,
      observacoes:obs,
      tipo_contrato: _tipoContrato,
      num_contrato: numContrato,
      local_retirada: document.getElementById('c-local-ret')?.value||'Loja',
      caucao: d.caucao,
      forma_pgto: (d.dividirPgto && d.valorPgto1>0) ? d.formaPgto1 : pgto,
      forma_pgto_caucao: d.pgtoCaucao||pgto,
      cartao_id: cartaoId,
      servicos_adicionais: _servicosLista.length>0 ? _servicosLista : null,
      condutor_cnh: condutorCnh||null,
      condutor_cnh_cat: condutorCnhCat||null,
      condutor_cnh_val: condutorCnhVal,
      plano_moto: planoMoto,
      primeira_semana_incluida: primeiraSemanaIncluida,
      criado_por: currentUser?.id
    }).select().single();
    if(error) throw error;

    await sb.from('veiculos').update({status:'alugado'}).eq('id',vid);
    // Lançamento financeiro automático
    if(typeof finRegistrarLancamentoLocacao==='function') finRegistrarLancamentoLocacao(locSalva).catch(()=>{});

    // Criar assinatura recorrente no Asaas (via n8n) — apenas planos moto
    if(planoMoto && typeof criarAssinaturaAsaas==='function'){
      criarAssinaturaAsaas(locSalva).catch(e=>console.warn('[asaas] falha:', e.message));
    }

    if(window._reservaOrigemId){
      await sb.from('reservas').update({status:'convertida'}).eq('id',window._reservaOrigemId);
      window._reservaOrigemId=null; window._reservaValorPago=0;
    }

    // Reset listas
    _condutoresLista = [];
    _servicosLista   = [];

    notify('Contrato #'+numContrato+' registrado!','success');
    if(btn){ btn.disabled=true; btn.textContent='⏳ Carregando...'; }

    // Se retornarId (chamado por registrarComChecklist), retorna IMEDIATAMENTE
    // para preservar o DOM do checklist (carregarTudo é chamado depois pelo caller)
    if(retornarId){
      if(btn){ btn.disabled=false; btn.textContent='📄 Registrar e gerar contrato'; }
      return { locId: locSalva.id, numContrato, d };
    }

    // Gera PDF UMA VEZ → download + Autentique (sem gerar duas vezes)
    const _locIdParaAssinatura = locSalva?.id || null;
    setTimeout(async ()=>{
      _showLoading('Gerando PDF...');
      try{
        // Gera PDF com returnBase64=true para ter o blob disponível
        const _pdfDataUrl = await gerarPdfContrato(numContrato, d, null, true);
        // Trigger download manualmente
        if(_pdfDataUrl){
          const _a = document.createElement('a');
          _a.href = _pdfDataUrl;
          _a.download = `Contrato_Royal_${numContrato}_${(d.nomeCli||'').replace(/\s+/g,'_')}.pdf`;
          _a.click();
          notify(`PDF do Contrato #${numContrato} gerado!`,'success');
        }
        // Envia para Autentique com o PDF já gerado (sem regerar)
        if(_locIdParaAssinatura){
          _showLoading('Enviando para assinatura digital...');
          await enviarParaAssinatura(numContrato, d, _locIdParaAssinatura, _pdfDataUrl, cid);
        }
      }finally{
        _hideLoading();
      }
    }, 500);
    await carregarTudo();

    // Salvar cartão no perfil do cliente (se marcado)
    if(d.cartaoSalvar && d.cartao4dig && cid){
      const cartaoData = {
        bandeira:  d.cartaoBand||'',
        ultimos4:  d.cartao4dig,
        validade:  d.cartaoVal||'',
        titular:   d.cartaoTitular||'',
        atualizado: new Date().toISOString(),
      };
      await sb.from('clientes').update({cartao_dados: cartaoData}).eq('id', cid);
      console.log('[cartão] salvo no perfil do cliente');
    }

    // WhatsApp — enviado pelo modal do Autentique (não automático aqui)
  }catch(e){
    notify('Erro: '+e.message,'error');
    if(retornarId) return null;
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='📄 Registrar e gerar contrato'; }
  }
}

function _msgWppContrato(num, c, v, d){
  const isMoto = _tipoContrato==='moto';
  let txt = `📄 *CONTRATO #${num} — LOCADORA ROYAL*\n\n`;
  txt += `👤 *Cliente:* ${c.nome}\n📋 *CPF:* ${c.cpf||'—'}\n`;
  txt += `\n${isMoto?'🏍️':'🚗'} *Veículo:* ${v?.marca||''} ${v?.modelo||''} — ${v?.placa||''}\n`;
  txt += `📅 *Retirada:* ${d.ini ? _fmtDatetime(d.ini) : '—'}\n`;
  txt += `📅 *Devolução:* ${d.fim ? _fmtDatetime(d.fim) : '—'}\n`;
  txt += `📍 *Local:* ${d.localRet||'Loja'}\n`;
  txt += `⏱ *Período:* ${d.diasLabel}\n`;
  txt += `💰 *Valor ${isMoto?'semanal':'diária'}:* R$ ${d.dia.toFixed(2).replace('.',',')}\n`;
  if(d.totalServicos>0) txt += `🔧 *Serviços adicionais:* R$ ${d.totalServicos.toFixed(2).replace('.',',')}\n`;
  if(d.valorPagoReserva>0) txt += `✂️ *Abatimento reserva:* - R$ ${d.valorPagoReserva.toFixed(2).replace('.',',')}\n`;
  if(d.valorPagoAto>0){
    if(d.dividirPgto && d.valorPgto2>0){
      txt += `💵 *Pago no ato:* R$ ${d.valorPgto1.toFixed(2).replace('.',',')} (${d.formaPgto1}) + R$ ${d.valorPgto2.toFixed(2).replace('.',',')} (${d.formaPgto2})\n`;
    } else {
      txt += `💵 *Pago no ato:* R$ ${d.valorPagoAto.toFixed(2).replace('.',',')} (${d.formaPgto1})\n`;
    }
  }
  txt += `📌 *Valor restante:* R$ ${d.valorRestante.toFixed(2).replace('.',',')}\n`;
  txt += `💳 *Total:* R$ ${d.totalBruto.toFixed(2).replace('.',',')}\n`;
  txt += `\n✅ Contrato registrado. O PDF completo será enviado em seguida.\n_Equipe Locadora Royal 🚗🏍️_`;
  return txt;
}

// ══ BAIXAR PDF SEM REGISTRAR ══
function _baixarPdfSemRegistrar(){
  const d = previewContrato();
  gerarPdfContrato(_peekNumContrato(), d);
}

// ══ GERAR PDF ══

async function gerarPdfContrato(numContrato, d, checklist=null, returnBase64=false){
  if(!d||typeof d!=='object') d = previewContrato();
  if(!d) return;
  if(!window.jspdf){ notify('jsPDF não carregado. Recarregue a página.','error'); return; }
  const {jsPDF} = window.jspdf;

  const doc   = new jsPDF({unit:'mm', format:'a4'});
  const PW=210, M=12, CW=PW-M*2;
  let y = M;

  // ── HELPERS ──
  const safeY = (need) => {
    if(y + need > 280){ doc.addPage(); y = M; }
  };

  const txt = (t, x, yy, o={}) => {
    doc.setFontSize(o.size||9);
    doc.setFont('helvetica', o.bold?'bold':(o.italic?'italic':'normal'));
    doc.setTextColor(o.color||'#000000');
    const lines = doc.splitTextToSize(String(t||''), o.maxW||200);
    doc.text(o.lines?lines:String(t||''), x, yy, {align:o.align||'left'});
    return lines.length;
  };

  const txtWrap = (t, x, yy, maxW, o={}) => {
    doc.setFontSize(o.size||8);
    doc.setFont('helvetica', o.bold?'bold':(o.italic?'italic':'normal'));
    doc.setTextColor(o.color||'#000000');
    const lines = doc.splitTextToSize(String(t||''), maxW);
    doc.text(lines, x, yy, {align:o.align||'left'});
    return lines.length * (o.size||8) * 0.4;
  };

  const rect = (x, yy, w, h, fill, stroke) => {
    if(fill){ doc.setFillColor(fill); }
    if(stroke){ doc.setDrawColor(stroke); } else { doc.setDrawColor('#cccccc'); }
    doc.rect(x, yy, w, h, fill?(stroke?'FD':'F'):'D');
  };

  const line = (x1,y1,x2,y2,color='#cccccc',w=0.3) => {
    doc.setDrawColor(color); doc.setLineWidth(w);
    doc.line(x1,y1,x2,y2);
  };

  const isMoto = _tipoContrato==='moto';

  // ══════════════════════════════════════
  // PÁGINA 1 — CABEÇALHO COM LOGO E DADOS
  // ══════════════════════════════════════

  // Logo Royal (topo esquerdo) — nova logo com fundo transparente
 // Logo Royal (topo esquerdo) — carrega do arquivo local
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

  // Dados da empresa (topo direito do logo)
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text('ROYAL RENT A CAR LTDA', M+42, y+7);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  doc.text('CNPJ: 18.686.521/0002-90', M+42, y+12);
  doc.text('Tel: (21) 96894-9627  |  sac@locadoraroyal.com.br', M+42, y+15);

  // Número e status do contrato (topo direito)
  const planoTitulo = isMoto
    ? (d.planoNome?.includes('Conquista') ? 'CONTRATO CONQUISTA#' : 'CONTRATO MASTER#')
    : 'CONTRATO#';
  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text(`${planoTitulo}${numContrato}`, PW-M, y+5, {align:'right'});
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor('#555');
  const descricaoHeader = d.descricao ? `Situação: Em Vigência  |  Tipo: ${isMoto?'MOTO':'CARRO'}  |  ${d.descricao}` : `Situação: Em Vigência  |  Tipo: ${isMoto?'MOTO':'CARRO'}`;
  doc.text(descricaoHeader, PW-M, y+10, {align:'right'});
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, PW-M, y+14, {align:'right'});
  y += 18;

  // Linha separadora
  line(M, y, PW-M, y, '#006400', 0.5);
  y += 3;

  // ══════════════════════════════════════
  // TABELA PRINCIPAL: CLIENTE | RETIRADA | DEVOLUÇÃO
  // ══════════════════════════════════════
  const colW1=60, colW2=68, colW3=CW-colW1-colW2;
  const tableTop = y;
  const cellPad = 2.5;

  // Headers das 3 colunas
  rect(M,           y, colW1, 7, '#006400', '#006400');
  rect(M+colW1,     y, colW2, 7, '#006400', '#006400');
  rect(M+colW1+colW2, y, colW3, 7, '#006400', '#006400');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('CLIENTE', M+cellPad, y+5);
  doc.text('RETIRADA', M+colW1+cellPad, y+5);
  doc.text('DEVOLUÇÃO', M+colW1+colW2+cellPad, y+5);
  y += 7;

  // Preparar conteúdo das células
  const telFmt = (t) => t ? t.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/,'$1 ($2) $3-$4').trim() : '—';
  const dataFmt = (dt) => {
    if(!dt) return '—';
    try{
      const d2 = new Date(dt);
      return d2.toLocaleDateString('pt-BR') + ' ' + d2.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    }catch(_){ return dt.slice(0,16).replace('T',' '); }
  };

  const cnhInfo = d.condutorCnh ? `CNH: ${d.condutorCnh}${d.condutorCnhCat?' (Cat. '+d.condutorCnhCat+')':''}` : '';
  const cnhVal  = d.condutorCnhVal ? `Val. CNH: ${new Date(d.condutorCnhVal).toLocaleDateString('pt-BR')}` : '';

  const conteudoCliente = [
    {bold:true, text: d.nomeCli||'—'},
    {text: `CPF: ${d.cpfCli||'—'}`},
    {text: `Tel: ${d.telCli||'—'}`},
    ...(cnhInfo ? [{text: cnhInfo}] : []),
    ...(cnhVal  ? [{text: cnhVal}]  : []),
    {bold:true, text:'CONDUTOR(ES):'},
    ...(d.todosCondutores||[{nome:d.condutor||d.nomeCli,cpf:d.cpfCli}]).map(c=>[
      {text: c.nome||'—'},
      {text: `CPF: ${c.cpf||'—'}`},
    ]).flat(),
  ];

  const conteudoRetirada = [
    {bold:true, text: `Placa: ${d.placa||'—'}`},
    {text: `Local: ${d.localRet||'Loja'}`},
    {text: `Data: ${dataFmt(d.ini)}`},
    {text: 'Empresa: Royal Rent A Car Ltda'},
    {text: 'Endereço: Av. das Américas, 12900'},
    {text: 'Bairro: Recreio dos Bandeirantes'},
    {text: 'Tel: +55 (21) 96894-9627'},
  ];

  const conteudoDevolucao = [
    {bold:true, text: `Placa: ${d.placa||'—'}`},
    {text: `Local: ${d.localRet||'Loja'}`},
    {text: `Data: ${dataFmt(d.fim)}`},
    {text: 'Empresa: Royal Rent A Car Ltda'},
    {text: 'Endereço: Av. das Américas, 12900'},
    {text: 'Bairro: Recreio dos Bandeirantes'},
    {text: 'Tel: +55 (21) 96894-9627'},
  ];

  // Renderizar células
  const lineH = 4.2;
  const maxLines = Math.max(conteudoCliente.length, conteudoRetirada.length, conteudoDevolucao.length);
  const cellH = maxLines * lineH + 6;

  rect(M,               y, colW1, cellH, '#fafffe', '#dddddd');
  rect(M+colW1,         y, colW2, cellH, '#f9f9f9', '#dddddd');
  rect(M+colW1+colW2,   y, colW3, cellH, '#f9f9f9', '#dddddd');

  const renderCellLines = (lines, xBase, yBase, maxW) => {
    let cy = yBase + 4;
    lines.forEach(l => {
      doc.setFont('helvetica', l.bold?'bold':'normal');
      doc.setFontSize(l.bold?8:7.5);
      doc.setTextColor(l.bold?'#004400':'#222');
      // Truncar texto respeitando largura da célula
      const available = (maxW||55) - cellPad - 2;
      const splitL = doc.splitTextToSize(String(l.text||''), available);
      doc.text(splitL[0]||'', xBase+cellPad, cy);
      cy += lineH;
    });
  };

  renderCellLines(conteudoCliente,   M, y, colW1);
  renderCellLines(conteudoRetirada,  M+colW1, y, colW2);
  renderCellLines(conteudoDevolucao, M+colW1+colW2, y, colW3);
  y += cellH + 2;

  // ══════════════════════════════════════
  // TABELA VEÍCULO (7 colunas)
  // ══════════════════════════════════════
  safeY(20);
  const vCols = isMoto ? [45,18,26,25,22,18,26] : [45,20,26,24,22,18,31];
  const vHeaders = isMoto
    ? ['Veículo','Franquia Km','Valor Locação','Valor Km Excedente','Data Entrega','Km Saída','Data Término']
    : ['Veículo','Km Livre','Valor Diária','Proteção','Data Entrega','Km Saída','Data Término'];

  rect(M, y, CW, 6, '#006400', '#006400');
  let cx = M;
  doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  vHeaders.forEach((h,i)=>{ doc.text(h,cx+1.5,y+4.2); cx+=vCols[i]; });
  y += 6;

  const franqKm  = document.getElementById('c-franquia-km')?.value||'0';
  const kmExced  = (parseFloat(document.getElementById('c-km-excedente')?.value)||0).toFixed(2).replace('.',',');
  const planoLabel = d.planoNome ? d.planoNome.split('—')[0].trim() : '';
  const veiLabel = `${d.placa} - ${d.modelo}${planoLabel?' | '+planoLabel:''}`;

  rect(M, y, CW, d.temDesconto?11:8, '#f0f8f0', '#ccddcc');
  cx = M;
  const kmLivre  = document.getElementById('c-km-livre')?.checked ? 'Sim' : 'Não';
  const protecao = document.getElementById('c-protecao')?.value||'Básica';
  const vRow = isMoto
    ? [veiLabel, franqKm+' km', `R$ ${(d.dia||0).toFixed(2).replace('.',',')}`, `R$ ${kmExced}/km`,
       d.ini ? d.ini.slice(0,10).split('-').reverse().join('/') : '—', String(d.km||0)+' km',
       d.fim ? d.fim.slice(0,10).split('-').reverse().join('/') : '—']
    : [veiLabel, kmLivre, `R$ ${(d.dia||0).toFixed(2).replace('.',',')}`, protecao,
       d.ini ? d.ini.slice(0,10).split('-').reverse().join('/') : '—', String(d.km||0)+' km',
       d.fim ? d.fim.slice(0,10).split('-').reverse().join('/') : '—'];
  doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#111');
  vRow.forEach((v,i)=>{
    const trunc = doc.splitTextToSize(v, vCols[i]-3);
    doc.text(trunc[0]||'', cx+1.5, y+5);
    cx+=vCols[i];
  });
  // Se houver desconto, mostra valor original tachado abaixo do valor com desconto
  if(d.temDesconto){
    const valorColIdx = 2; // índice da coluna "Valor Diária/Valor Unit"
    let colX = M;
    for(let i=0;i<valorColIdx;i++) colX += vCols[i];
    doc.setFontSize(6); doc.setTextColor('#999');
    const origTxt = `de R$ ${d.diaOriginal.toFixed(2).replace('.',',')}`;
    doc.text(origTxt, colX+1.5, y+8);
    const wTxt = doc.getTextWidth(origTxt);
    doc.setLineWidth(0.2); doc.setDrawColor('#999');
    doc.line(colX+1.5, y+7, colX+1.5+wTxt, y+7);
    doc.setTextColor('#111');
  }
  y += d.temDesconto?13:10;

  // ══════════════════════════════════════
  // SERVIÇOS ADICIONAIS (se houver)
  // ══════════════════════════════════════
  if(d.servicos?.length){
    safeY(8 + d.servicos.length*7);
    const sCols=[90,25,30,35];
    const sHdr=['Serviços Adicionais','Quantidade','Valor Unitário','Valor Total'];
    rect(M,y,CW,5,'#006400','#006400');
    cx=M;
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
    sHdr.forEach((h,i)=>{ doc.text(h,cx+1.5,y+3.5); cx+=sCols[i]; });
    y+=5;
    d.servicos.forEach((s,ri)=>{
      rect(M,y,CW,7,ri%2===0?'#ffffff':'#f5f5f5','#dddddd');
      cx=M;
      const sRow=[s.descricao||'—','1',`R$ ${(s.valor||0).toFixed(2).replace('.',',')}`,`R$ ${(s.valor||0).toFixed(2).replace('.',',')}`];
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#222');
      sRow.forEach((v,i)=>{ doc.text(v,cx+1.5,y+4.5); cx+=sCols[i]; });
      y+=7;
    });
    y+=3;
  }

  // ══════════════════════════════════════
  // FORMA DE PAGAMENTO
  // ══════════════════════════════════════
  safeY(16);
  const temTaxa = !d.taxaAdminIsenta && d.taxaAdminPct > 0;
  const temPgtoAto = d.valorPagoAto>0;
  const pgtoBoxH = (temTaxa || d.taxaAdminIsenta ? 20 : 14) + (temPgtoAto?4:0);
  rect(M, y, CW, pgtoBoxH, '#f0f8f0', '#a8d8a8');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text('FORMA DE PAGAMENTO', M+cellPad, y+5);
  doc.setFont('helvetica','bold'); doc.setTextColor('#111');
  doc.setFontSize(8);
  const _valorPgtoLabel = isMoto ? `R$ ${(d.dia||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/semana` : `R$ ${(d.totalBruto||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  doc.text(`Contrato: ${d.pgtoLabel||d.pgto}  —  Valor: ${_valorPgtoLabel}`, M+cellPad, y+9);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(`Caução/Garantia: R$ ${(d.caucao||0).toFixed(2).replace('.',',')}  —  Pagamento: ${d.pgtoCaucao||d.pgto}`, M+cellPad, y+12);
  let pgtoLinhaExtra = 12;
  if(temPgtoAto){
    pgtoLinhaExtra = 16;
    const pagoTxt = (d.dividirPgto && d.valorPgto2>0)
      ? `R$ ${d.valorPgto1.toFixed(2).replace('.',',')} (${d.formaPgto1}) + R$ ${d.valorPgto2.toFixed(2).replace('.',',')} (${d.formaPgto2})`
      : `R$ ${d.valorPagoAto.toFixed(2).replace('.',',')} (${d.formaPgto1})`;
    doc.setFont('helvetica','bold');
    doc.text(`Pago no ato: ${pagoTxt}  —  Restante: R$ ${d.valorRestante.toFixed(2).replace('.',',')}`, M+cellPad, y+pgtoLinhaExtra);
    doc.setFont('helvetica','normal');
  }
  if(temTaxa){
    doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor('#b45309');
    doc.text(`Taxa Administrativa: ${d.taxaAdminPct}%  —  R$ ${(d.taxaAdminVal||0).toFixed(2).replace('.',',')} (inclusa no valor total)`, M+cellPad, y+pgtoLinhaExtra+4);
  } else if(d.taxaAdminIsenta){
    doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor('#16a34a');
    doc.text('Taxa Administrativa: Isentada', M+cellPad, y+pgtoLinhaExtra+4);
  }
  y += pgtoBoxH + 3;

  // ══════════════════════════════════════
  // OBSERVAÇÕES IMPORTANTES (da minuta)
  // ══════════════════════════════════════
  safeY(18);
  rect(M, y, CW, 6, '#006400', '#006400');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('OBSERVAÇÕES IMPORTANTES', M+cellPad, y+4.2);
  y += 6;
  const obsImp = isMoto
    ? 'A renovação do contrato se dar de forma semanal (a cada 7 dias).\nNecessário informar a cada 1.000km do veículo, para que seja verificado o cronograma de manutenção preventiva. Entre em contato com a Locadora.'
    : 'O veículo deverá ser devolvido nas mesmas condições de limpeza e nível de combustível em que foi entregue.\nCaso seja necessária lavagem, será cobrada a taxa correspondente. Combustível faltante: R$ 7,00/litro.\nSe o veículo não for devolvido em até 24h após o término do prazo, configura-se apropriação indébita.';
  const obsImpLines = doc.splitTextToSize(obsImp, CW-4);
  const obsImpH = obsImpLines.length * 3.8 + 5;
  rect(M, y, CW, obsImpH, '#fffbea', '#f0c040');
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#5a4000');
  doc.text(obsImpLines, M+cellPad, y+4);
  y += obsImpH + 2;

  // ══════════════════════════════════════
  // OBSERVAÇÕES DO CONTRATO
  // ══════════════════════════════════════
  if(d.obs && d.obs !== '—'){
    safeY(14);
    rect(M, y, CW, 6, '#006400', '#006400');
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
    doc.text('OBSERVAÇÕES DO CONTRATO', M+cellPad, y+4.2);
    y += 6;
    const obsLines = doc.splitTextToSize(d.obs, CW-4);
    const obsH = obsLines.length * 3.8 + 5;
    rect(M, y, CW, obsH, '#f9f9f9', '#dddddd');
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
    doc.text(obsLines, M+cellPad, y+4);
    y += obsH + 2;
  }

  // ══════════════════════════════════════
  // TERMOS E CONDIÇÕES
  // ══════════════════════════════════════
  safeY(15);
  rect(M, y, CW, 4, '#006400', '#006400');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('TERMOS E CONDIÇÕES', M+cellPad, y+3);
  y += 8;

  // Texto completo das cláusulas (fiel à minuta — Contrato Locação Motocicleta Plano Conquista 36 meses)
  const clausulas = isMoto ? [
    {num:'PREÂMBULO E QUALIFICAÇÃO DAS PARTES', secao:true},
    {num:'', txt:'Pelo presente instrumento particular, de um lado, ROYAL RENT A CAR LTDA / ROYAL LOCADORA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 18.686.521/0002-90, com sede em Av. das Américas, 12900 - 3º Subsolo - Recreio dos Bandeirantes, Rio de Janeiro - RJ, 22790-702, telefone (21) 96894-9627, doravante denominada LOCADORA; e, de outro lado, o LOCATÁRIO qualificado no quadro-resumo acima, doravante denominado LOCATÁRIO, têm entre si justo e contratado o presente Contrato de Locação de Motocicleta com Opção de Compra Futura, Facultativa e Condicionada, mediante as cláusulas e condições abaixo.'},
    {num:'CLÁUSULA 1 — DEFINIÇÕES', secao:true},
    {num:'1.1', txt:'Motocicleta: veículo descrito no quadro-resumo e no Termo de Entrega, Vistoria e Responsabilidade, com seus acessórios, documentos e equipamentos instalados.'},
    {num:'1.2', txt:'Locação com Opção de Compra Futura: operação pela qual a LOCADORA entrega a posse direta e temporária da motocicleta ao LOCATÁRIO, mediante pagamento de locação semanal, podendo o LOCATÁRIO, ao final do prazo contratual e desde que cumpridas todas as obrigações, exercer opção facultativa de compra, mediante instrumento próprio.'},
    {num:'1.3', txt:'Taxa de Adesão: valor pago no início do contrato para custeio de análise cadastral, disponibilização operacional da motocicleta, ativação do plano, emissão de documentos, gestão administrativa e demais custos iniciais da contratação, sem natureza de sinal, entrada, arras, amortização, antecipação de preço ou parcela de aquisição.'},
    {num:'1.4', txt:'Caução: garantia contratual destinada a cobrir débitos, multas, franquias, danos, despesas de recolhimento, ausência em manutenção e demais obrigações não pagas pelo LOCATÁRIO.'},
    {num:'1.5', txt:'Manutenção Preventiva: serviços programados previstos no manual do fabricante e/ou no plano de manutenção da LOCADORA, inclusive revisões, óleo, filtros, inspeções e ajustes, conforme modalidade financeira escolhida no quadro-resumo.'},
    {num:'1.6', txt:'Manutenção Corretiva / Danos: reparos decorrentes de queda, colisão, impacto, mau uso, negligência, falta de cuidado, sinistro, uso inadequado, atraso em revisão, peças não autorizadas ou evento não enquadrado como manutenção preventiva ordinária.'},
    {num:'1.7', txt:'Semana de Locação: período de 7 dias corridos, contado da data de retirada da motocicleta, com vencimentos sucessivos no mesmo dia da semana indicado no quadro-resumo.'},
    {num:'1.8', txt:'Quitação Integral: pagamento de todas as obrigações vencidas ou apuradas até o encerramento do contrato ou transferência definitiva, incluindo locações semanais, caução eventualmente recomposta, multas, franquias, danos, taxas, despesas, encargos e valores expressamente previstos.'},
    {num:'CLÁUSULA 2 — OBJETO, NATUREZA DO CONTRATO E FINALIDADE', secao:true},
    {num:'2.1', txt:'O presente contrato tem por objeto a locação da motocicleta indicada no quadro-resumo, com opção de compra futura ao final do prazo de 36 meses, desde que cumpridas integralmente todas as condições previstas neste instrumento.'},
    {num:'2.2', txt:'Durante toda a fase de locação, a motocicleta permanecerá de propriedade exclusiva da LOCADORA, sendo conferida ao LOCATÁRIO apenas a posse direta, temporária, resolúvel e condicionada ao adimplemento contratual.'},
    {num:'2.3', txt:'A transferência de propriedade somente ocorrerá após a quitação integral, a vistoria final, a inexistência de pendências e a assinatura do instrumento definitivo de compra e venda e/ou documento próprio de transferência perante o DETRAN.'},
    {num:'2.4', txt:'Este contrato não constitui arrendamento mercantil, leasing financeiro, leasing operacional, financiamento, alienação fiduciária, consórcio, compra e venda a prazo ou operação de crédito. Os pagamentos semanais remuneram exclusivamente o uso temporário da motocicleta durante a locação, não constituindo VRG, entrada, amortização, parcela de financiamento ou antecipação de preço.'},
    {num:'2.5', txt:'A motocicleta será utilizada preferencialmente para atividade profissional lícita de entrega, mobilidade e deslocamentos compatíveis com sua natureza, sempre respeitada a legislação de trânsito, o manual do fabricante, as regras de segurança e as limitações deste contrato.'},
    {num:'2.6', txt:'Este contrato não gera vínculo empregatício, sociedade, parceria, representação comercial, subordinação, exclusividade ou qualquer relação de prestação de serviços entre as partes. O LOCATÁRIO atua por conta própria, assumindo os riscos da sua atividade econômica.'},
    {num:'CLÁUSULA 3 — PRAZO', secao:true},
    {num:'3.1', txt:'O prazo total de vigência deste contrato é de 36 (trinta e seis) meses, contados da data de retirada da motocicleta e assinatura do Termo de Entrega, Vistoria e Responsabilidade.'},
    {num:'3.2', txt:'Durante a vigência, o contrato opera por ciclos semanais sucessivos de 7 (sete) dias corridos, cada qual com pagamento próprio, renovando-se automaticamente até o cumprimento integral do prazo total ou até a rescisão nas condições previstas neste instrumento.'},
    {num:'3.3', txt:'Cada ciclo semanal constitui período autônomo de locação, cujo pagamento remunera exclusivamente o uso da motocicleta naquele período, sem qualquer natureza de amortização, compra ou aquisição.'},
    {num:'3.4', txt:'Ao término dos 36 meses, correspondente à conclusão de 156 (cento e cinquenta e seis) ciclos semanais, cessam automaticamente as renovações e, cumpridas integralmente as condições da Cláusula 6, nasce para o LOCATÁRIO o direito de exercer a opção de compra.'},
    {num:'3.5', txt:'A devolução antecipada da motocicleta pelo LOCATÁRIO não gera abatimento automático de valores já pagos a título de locação, salvo ajuste escrito em sentido contrário ou obrigação legal aplicável.'},
    {num:'CLÁUSULA 4 — PREÇO, PAGAMENTOS, TAXA DE ADESÃO E CAUÇÃO', secao:true},
    {num:'4.1', txt:'Locação semanal: o LOCATÁRIO pagará à LOCADORA o valor semanal indicado no quadro-resumo, por boleto, PIX, cartão, plataforma de cobrança ou outro meio admitido pela LOCADORA.'},
    {num:'4.1.2', txt:'O pagamento é devido de forma pontual e independente de cobrança. O não recebimento de boleto, link ou mensagem não desobriga o LOCATÁRIO do pagamento no vencimento.'},
    {num:'4.1.3', txt:'O valor pago semanalmente tem natureza de locação, remuneração pelo uso da motocicleta e composição econômica do plano contratado, não implicando transferência automática de propriedade antes da conclusão formal da compra.'},
    {num:'4.2', txt:'Taxa de Adesão: no ato da assinatura e/ou retirada da motocicleta, o LOCATÁRIO pagará à LOCADORA o valor indicado no quadro-resumo a título de taxa de adesão ao plano contratado, destinada a cobrir custos operacionais, cadastrais e de disponibilização do veículo.'},
    {num:'4.2.2', txt:'A taxa de adesão não tem natureza de sinal de compra, amortização ou antecipação do preço de aquisição, constituindo contraprestação autônoma pelos serviços de adesão ao plano, não reembolsável salvo nas hipóteses expressamente previstas neste contrato.'},
    {num:'4.2.3', txt:'Em caso de rescisão por culpa do LOCATÁRIO, desistência ou abandono do contrato, a taxa de adesão não será restituída, sem prejuízo da cobrança de débitos, danos, multas e despesas comprovadas.'},
    {num:'4.2.4', txt:'Em caso de rescisão por culpa exclusiva da LOCADORA, sem justa causa e após o LOCATÁRIO ter cumprido suas obrigações, a taxa de adesão será restituída integralmente.'},
    {num:'4.3', txt:'Caução: o LOCATÁRIO pagará caução no valor indicado no quadro-resumo, destinada a garantir obrigações contratuais, débitos, danos, franquias, multas de trânsito, custos de recolhimento, limpeza, taxas operacionais, despesas de cobrança e demais valores devidos.'},
    {num:'4.3.2', txt:'A caução não limita a responsabilidade do LOCATÁRIO. Havendo saldo devedor superior ao valor caucionado, a diferença poderá ser cobrada pela LOCADORA.'},
    {num:'4.3.3', txt:'Se a caução for utilizada total ou parcialmente durante o contrato, o LOCATÁRIO deverá recompô-la ao valor original em até 5 dias úteis após comunicação da LOCADORA.'},
    {num:'4.3.4', txt:'Não havendo pendências conhecidas, a caução será restituída em até 15 dias úteis após a devolução da motocicleta, sem prejuízo de cobrança posterior de multas, autuações, danos ocultos ou débitos vinculados ao período de posse do LOCATÁRIO que venham a ser apurados posteriormente.'},
    {num:'4.4', txt:'Encargos por atraso: sobre valores vencidos e não pagos incidirão multa moratória de 2% (dois por cento), juros de 1% ao mês pro rata die e correção monetária pelo IPCA/IBGE, salvo limite legal menor aplicável ao caso concreto.'},
    {num:'4.4.2', txt:'A mora ocorrerá automaticamente no vencimento, independentemente de notificação judicial ou extrajudicial.'},
    {num:'4.4.3', txt:'A inadimplência poderá gerar bloqueio preventivo, recolhimento pacífico, rescisão, perda do direito de compra, cobrança, negativação e demais medidas previstas neste contrato, observadas as garantias legais.'},
    {num:'4.5', txt:'IPVA, Licenciamento e Encargos de Propriedade: durante a vigência deste contrato, o IPVA e as taxas de licenciamento anual serão de responsabilidade exclusiva da LOCADORA, na qualidade de proprietária do veículo perante os órgãos competentes.'},
    {num:'4.5.2', txt:'O LOCATÁRIO deverá cooperar com a LOCADORA nos atos necessários ao licenciamento, vistorias obrigatórias e demais procedimentos perante o DETRAN, apresentando a motocicleta quando convocado, dentro do prazo comunicado.'},
    {num:'4.5.3', txt:'Multas administrativas, taxas de transferência, despesas de vistoria e demais encargos decorrentes de uso indevido ou irregularidade imputável ao LOCATÁRIO não se enquadram nesta cláusula e permanecem sob sua responsabilidade.'},
    {num:'CLÁUSULA 5 — PREÇO DE COMPRA E COMPOSIÇÃO ECONÔMICA DO PLANO', secao:true},
    {num:'5.1', txt:'O preço de referência para exercício da opção de compra corresponderá ao valor de mercado da motocicleta apurado na data em que o LOCATÁRIO completar as 156 (cento e cinquenta e seis) renovações semanais, conforme tabela FIPE vigente naquela data ou, na ausência de referência FIPE para o modelo, por avaliação referencial a ser acordada pelas partes.'},
    {num:'5.2', txt:'Em razão do cumprimento integral de todas as obrigações contratuais ao longo das 156 (cento e cinquenta e seis) semanas de locação, o LOCATÁRIO adimplente fará jus a um desconto de fidelidade, resultando em preço líquido de R$ 50,00 (cinquenta reais) para exercício da opção de compra.'},
    {num:'5.3', txt:'O desconto de fidelidade é uma condição comercial contratual, conferida exclusivamente ao LOCATÁRIO que cumprir integralmente todas as obrigações até o encerramento do prazo de 36 meses. O não cumprimento de qualquer das condições da Cláusula 6 acarretará a perda do desconto e do direito de exercer a opção de compra pelo preço reduzido.'},
    {num:'5.4', txt:'O preço líquido de R$ 50,00 (cinquenta reais) será pagável no ato da assinatura do instrumento definitivo de transferência, condicionado ao cumprimento integral de todas as obrigações previstas neste contrato ao término das 156 (cento e cinquenta e seis) renovações semanais.'},
    {num:'5.5', txt:'Os pagamentos semanais têm natureza exclusiva de contraprestação pelo uso da motocicleta (locação), não constituindo, em nenhuma hipótese, parcelas de compra, amortização ou aquisição.'},
    {num:'CLÁUSULA 6 — OPÇÃO DE COMPRA FUTURA, FACULTATIVA E CONDICIONADA, E TRANSFERÊNCIA', secao:true},
    {num:'6.1', txt:'Ao término das 156 (cento e cinquenta e seis) renovações semanais, o LOCATÁRIO que tiver cumprido integralmente todas as obrigações contratuais poderá exercer a opção de compra, mediante comunicação escrita à LOCADORA e comparecimento para assinatura do instrumento definitivo no prazo de 30 (trinta) dias. O exercício da opção fica condicionado, cumulativamente, a que:'},
    {bullet:true, txt:'todas as semanas de locação estejam quitadas;'},
    {bullet:true, txt:'caução, multas, franquias, danos, taxas e despesas estejam quitados;'},
    {bullet:true, txt:'a motocicleta esteja em condições compatíveis com uso regular, sem avarias não reparadas, sinistros pendentes ou manutenção irregular;'},
    {bullet:true, txt:'não haja débitos de infrações de trânsito pendentes de pagamento ou de indicação de condutor imputáveis ao LOCATÁRIO;'},
    {bullet:true, txt:'o LOCATÁRIO compareça para vistoria final e assinatura dos documentos de transferência.'},
    {num:'6.2', txt:'Caso o LOCATÁRIO não exerça a opção de compra no prazo previsto, ou manifeste expressamente que não deseja adquirir a motocicleta, o contrato será encerrado como locação, devendo a motocicleta ser devolvida à LOCADORA, sem direito de retenção.'},
    {num:'6.3', txt:'Cumpridas as condições da compra, as partes assinarão instrumento definitivo de compra e venda, recibo de transferência, ATPV-e, DUT/CRV ou documento equivalente exigido pela legislação vigente.'},
    {num:'6.4', txt:'A LOCADORA se obriga a disponibilizar a motocicleta livre de ônus de sua responsabilidade, ressalvadas multas, danos, restrições ou débitos gerados pelo uso do LOCATÁRIO.'},
    {num:'6.5', txt:'O LOCATÁRIO/COMPRADOR deverá providenciar a transferência de propriedade perante o DETRAN no prazo legal, arcando com taxas, vistorias, reconhecimento de firma, despachante, placa, emissão de documentos e demais custos de transferência, salvo disposição diversa no quadro-resumo.'},
    {num:'6.6', txt:'Após a assinatura dos documentos definitivos de compra e venda, todos os riscos, encargos, multas, tributos, danos e obrigações sobre a motocicleta passarão a ser de responsabilidade exclusiva do LOCATÁRIO/COMPRADOR.'},
    {num:'CLÁUSULA 7 — ENTREGA, VISTORIA, ESTADO DA MOTOCICLETA E DEVOLUÇÃO', secao:true},
    {num:'7.1', txt:'A motocicleta será entregue mediante assinatura do Anexo I - Termo de Entrega, Vistoria e Responsabilidade, com checklist, fotos, quilometragem, acessórios, documentos, estado dos pneus, pintura, carenagem, freios, iluminação, painel, chaves e demais itens relevantes.'},
    {num:'7.2', txt:'O LOCATÁRIO declara receber a motocicleta em condições de uso, segurança e conservação compatíveis com o termo de vistoria, obrigando-se a devolvê-la ou adquiri-la nas condições previstas neste contrato.'},
    {num:'7.3', txt:'Em caso de rescisão, inadimplência, desistência, perda do direito de compra ou encerramento sem aquisição, a motocicleta deverá ser devolvida à sede da LOCADORA ou local por ela indicado, em dia útil e horário comercial, salvo autorização escrita em contrário.'},
    {num:'7.4', txt:'Na devolução, será realizada vistoria final. Danos, ausência de acessórios, peças não originais, pneus inadequados, avarias, manutenção pendente, sujeira excessiva, adulterações ou pendências serão cobrados do LOCATÁRIO.'},
    {num:'7.5', txt:'A devolução da motocicleta não encerra automaticamente obrigações decorrentes de multas, danos ocultos, sinistros, débitos administrativos, cobranças futuras de trânsito ou despesas apuradas posteriormente e vinculadas ao período de posse do LOCATÁRIO.'},
    {num:'7.6', txt:'O LOCATÁRIO poderá acompanhar a vistoria final e receber cópia do relatório de avarias, fotos, orçamento ou demonstrativo de valores cobrados.'},
    {num:'CLÁUSULA 8 — REQUISITOS DO LOCATÁRIO E CONDUTOR AUTORIZADO', secao:true},
    {num:'8.1', txt:'Somente o LOCATÁRIO identificado neste contrato poderá conduzir a motocicleta, salvo autorização prévia e escrita da LOCADORA.'},
    {num:'8.2', txt:'O LOCATÁRIO declara possuir CNH categoria A válida, não suspensa, não cassada e compatível com a condução de motocicleta.'},
    {num:'8.3', txt:'O LOCATÁRIO deverá manter seus dados pessoais, endereço, telefone, WhatsApp, e-mail, CNH e local de guarda da motocicleta sempre atualizados.'},
    {num:'8.5', txt:'O LOCATÁRIO deverá possuir ou indicar local seguro para guarda da motocicleta fora dos períodos de uso, preferencialmente garagem fechada, monitorada ou com controle de acesso.'},
    {num:'8.6', txt:'É vedado emprestar, ceder, sublocar, vender, prometer vender, penhorar, dar em garantia, transferir ou permitir o uso da motocicleta por terceiros sem autorização escrita da LOCADORA.'},
    {num:'CLÁUSULA 9 — USO PERMITIDO, LIMITAÇÕES E PROIBIÇÕES', secao:true},
    {num:'9.1', txt:'O LOCATÁRIO utilizará a motocicleta de forma prudente, lícita e compatível com as especificações do fabricante, respeitando capacidade de carga, normas de trânsito, condições de segurança e finalidade contratada.'},
    {num:'9.2', txt:'É expressamente proibido ao LOCATÁRIO:'},
    {bullet:true, txt:'conduzir sob efeito de álcool, drogas, substâncias psicoativas ou medicamentos que comprometam a condução;'},
    {bullet:true, txt:'participar de rachas, competições, manobras perigosas, empinar, saltar obstáculos ou realizar exibições incompatíveis com uso regular;'},
    {bullet:true, txt:'transportar carga superior ao limite do fabricante ou bens ilícitos, inflamáveis, explosivos ou perigosos;'},
    {bullet:true, txt:'trafegar em trilhas, lama, dunas, praias, alagamentos, rios, áreas off-road ou locais inadequados;'},
    {bullet:true, txt:'sair do Estado do Rio de Janeiro ou do perímetro autorizado sem autorização prévia e escrita da LOCADORA;'},
    {bullet:true, txt:'adulterar hodômetro, placa, lacres, rastreador, telemetria, chassi, motor ou qualquer componente de identificação;'},
    {bullet:true, txt:'remover adesivos, instalar acessórios não autorizados, alterar sistema elétrico, escapamento, relação, guidão, iluminação, painel ou características originais;'},
    {bullet:true, txt:'utilizar peças paralelas, recondicionadas, adaptadas ou de procedência não comprovada sem autorização escrita;'},
    {bullet:true, txt:'deixar a motocicleta pernoitar em via pública, local inseguro ou desacompanhado, salvo situação emergencial devidamente justificada e comunicada.'},
    {num:'9.3', txt:'O uso de baú, suporte de baú e carregador de celular somente será permitido se autorizado pela LOCADORA e instalado conforme orientação técnica, ficando o LOCATÁRIO responsável por danos decorrentes de instalação inadequada.'},
    {num:'9.4', txt:'O descumprimento desta cláusula caracteriza mau uso e poderá acarretar bloqueio, recolhimento, rescisão, perda do direito de compra e cobrança integral dos prejuízos.'},
    {num:'CLÁUSULA 10 — MANUTENÇÃO, REVISÕES E RESPONSABILIDADE POR DANOS', secao:true},
    {num:'10.1', txt:'A manutenção da motocicleta deverá observar o manual do fabricante, o plano de uso severo quando aplicável, as orientações da LOCADORA e o Anexo III deste contrato.'},
    {num:'10.2', txt:'A motocicleta somente poderá passar por revisão, manutenção ou reparo em oficina, concessionária ou parceiro indicado ou previamente autorizado por escrito pela LOCADORA.'},
    {num:'10.4', txt:'Independentemente da modalidade financeira escolhida, o LOCATÁRIO deverá:'},
    {bullet:true, txt:'verificar diariamente óleo, pneus, calibragem, freios, corrente/relação, luzes, painel e condições gerais;'},
    {bullet:true, txt:'comunicar imediatamente vazamento, fumaça, ruído, luz de advertência, superaquecimento, falha, queda, colisão ou anormalidade;'},
    {bullet:true, txt:'cessar o uso se houver risco de dano mecânico, elétrico ou estrutural;'},
    {bullet:true, txt:'comparecer às revisões, trocas de óleo e vistorias nos prazos de km ou tempo determinados;'},
    {bullet:true, txt:'não exceder os intervalos de manutenção previstos no manual, no Anexo III ou na convocação da LOCADORA.'},
    {num:'10.5', txt:'A não realização de manutenção, o atraso em revisão, a ausência de comprovação, o uso de peça não autorizada ou a continuidade de uso após sinal de falha caracterizam negligência e transferem ao LOCATÁRIO a responsabilidade por danos decorrentes.'},
    {num:'10.6', txt:'São de responsabilidade do LOCATÁRIO, salvo prova técnica em contrário, os custos de manutenção corretiva, danos, quedas, colisões, impactos, pneus rasgados, rodas empenadas, carenagem, retrovisores, manetes, avarias estéticas, reboque por mau uso, danos por óleo baixo, superaquecimento ignorado, sobrecarga, uso agressivo ou instalação de acessórios.'},
    {num:'10.7', txt:'A LOCADORA poderá realizar vistorias periódicas e convocar o LOCATÁRIO para apresentar a motocicleta em até 24 horas úteis quando houver necessidade de revisão, recall, regularização documental, suspeita de mau uso, bloqueio, sinistro ou manutenção.'},
    {num:'10.8', txt:'O não comparecimento injustificado à manutenção, revisão ou vistoria poderá gerar taxa, bloqueio, recolhimento, rescisão e perda do direito de compra, sem prejuízo da cobrança de danos.'},
    {num:'CLÁUSULA 11 — SEGURO, PROTEÇÃO, FRANQUIAS E EXCLUSÕES', secao:true},
    {num:'11.1', txt:'A motocicleta poderá contar com seguro ou proteção veicular conforme quadro-resumo e Anexo IV, podendo abranger, conforme apólice, roubo, furto, assistência, guincho, danos a terceiros ou outras coberturas contratadas.'},
    {num:'11.2', txt:'O LOCATÁRIO declara ciência de que a cobertura depende das condições da apólice/proteção, do cumprimento das obrigações contratuais e da inexistência de exclusões.'},
    {num:'11.3', txt:'Em caso de sinistro coberto, o LOCATÁRIO será responsável pela franquia, participação obrigatória, despesas não cobertas, custos operacionais e demais valores imputáveis ao período de sua posse.'},
    {num:'11.4', txt:'A cobertura poderá não se aplicar, ficando o LOCATÁRIO responsável integralmente pelos prejuízos, nos casos de: condutor não autorizado, ausência ou atraso de boletim de ocorrência, alcoolemia, drogas, uso proibido, manobras, racha, omissão de informações, fraude, adulteração, negligência, abandono, uso fora da área permitida, manutenção irregular ou qualquer exclusão prevista na apólice.'},
    {num:'CLÁUSULA 12 — MULTAS, INFRAÇÕES, PONTUAÇÃO E RESPONSABILIDADE PERANTE ÓRGÃOS DE TRÂNSITO', secao:true},
    {num:'12.1', txt:'O LOCATÁRIO é integralmente responsável por multas, pontuação, remoção, estadia em pátio, taxas, penalidades, processos administrativos e demais consequências decorrentes de infrações praticadas durante o período em que a motocicleta estiver sob sua posse.'},
    {num:'12.2', txt:'O LOCATÁRIO autoriza a LOCADORA a indicá-lo como condutor infrator perante os órgãos competentes, nos termos da legislação de trânsito, comprometendo-se a assinar documentos, apresentar CNH e colaborar com a transferência de pontuação quando solicitado.'},
    {num:'12.3', txt:'O LOCATÁRIO deverá fornecer documentos, assinatura e informações necessárias à indicação de condutor no prazo de até 48 horas após solicitação da LOCADORA, ou em prazo menor se exigido pelo órgão de trânsito.'},
    {num:'12.4', txt:'A LOCADORA poderá cobrar o valor da multa, encargos, custo operacional e eventual penalidade por não indicação de condutor, conforme Anexo II.'},
    {num:'12.5', txt:'Multas recebidas após o encerramento do contrato, mas referentes ao período de posse do LOCATÁRIO, permanecerão sob sua responsabilidade e poderão ser cobradas posteriormente.'},
    {num:'CLÁUSULA 13 — SINISTROS, ACIDENTES, FURTO, ROUBO E PROVIDÊNCIAS OBRIGATÓRIAS', secao:true},
    {num:'13.1', txt:'Em caso de acidente, queda, colisão, furto, roubo, incêndio, alagamento, dano a terceiro, apreensão, pane grave ou qualquer sinistro, o LOCATÁRIO deverá:'},
    {bullet:true, txt:'comunicar imediatamente a LOCADORA por WhatsApp, telefone ou canal oficial;'},
    {bullet:true, txt:'registrar boletim de ocorrência no menor prazo possível e, preferencialmente, em até 24 horas, salvo impossibilidade justificada;'},
    {bullet:true, txt:'enviar fotos, vídeos, localização, horário, dados de terceiros, testemunhas, autoridades envolvidas e documentos solicitados;'},
    {bullet:true, txt:'não assumir culpa, transacionar, abandonar a motocicleta ou autorizar reparos sem anuência da LOCADORA;'},
    {bullet:true, txt:'preservar documentos, protocolos, laudos e comprovantes necessários ao seguro, à defesa administrativa ou judicial e à apuração de responsabilidades.'},
    {num:'13.2', txt:'O descumprimento das providências acima poderá causar perda de cobertura securitária e responsabilização integral do LOCATÁRIO pelos danos, despesas, franquias e prejuízos.'},
    {num:'13.3', txt:'Se a motocicleta ficar indisponível por fato imputável ao LOCATÁRIO, poderão ser cobrados custos operacionais e lucros cessantes conforme Anexo II, limitados ao prazo e critérios ali previstos.'},
    {num:'CLÁUSULA 14 — RASTREADOR, TELEMETRIA, BLOQUEIO REMOTO E RECOLHIMENTO', secao:true},
    {num:'14.1', txt:'A motocicleta poderá possuir rastreador, telemetria, sistema antifurto e bloqueio remoto para segurança patrimonial, gestão de frota, prevenção de fraude, recuperação em sinistro e execução deste contrato.'},
    {num:'14.2', txt:'O LOCATÁRIO autoriza a coleta e o tratamento de dados de localização, quilometragem, uso, eventos de ignição, alertas e demais dados necessários à segurança e execução contratual, nos termos da LGPD.'},
    {num:'14.3', txt:'O bloqueio remoto poderá ser utilizado em caso de inadimplência, suspeita de furto, roubo, fraude, uso indevido, manutenção vencida, risco patrimonial, sinistro não comunicado, circulação fora da área permitida, descumprimento contratual relevante ou determinação de autoridade competente.'},
    {num:'14.4', txt:'O bloqueio remoto não deverá ser realizado com a motocicleta em movimento, em via de trânsito rápido ou durante condução ativa em situação que possa expor o LOCATÁRIO ou terceiros a risco de acidente, salvo impossibilidade técnica ou situação excepcional de segurança.'},
    {num:'14.5', txt:'O recolhimento extrajudicial da motocicleta somente poderá ocorrer de forma pacífica, sem violação de domicílio, sem ameaça, sem constrangimento, sem ruptura de cadeados, portões ou barreiras e sem emprego de força. Havendo resistência, a LOCADORA adotará as medidas legais cabíveis.'},
    {num:'14.6', txt:'O LOCATÁRIO reconhece que, rescindido o contrato, vencido o prazo de devolução ou perdido o direito de posse, a retenção injustificada da motocicleta poderá ensejar medidas judiciais, extrajudiciais, policiais e cobrança dos prejuízos.'},
    {num:'CLÁUSULA 15 — INADIMPLEMENTO, RESCISÃO E PERDA DO DIREITO DE COMPRA', secao:true},
    {num:'15.1', txt:'Constituem hipóteses de inadimplemento grave e/ou rescisão:'},
    {bullet:true, txt:'atraso no pagamento semanal ou de qualquer obrigação pecuniária;'},
    {bullet:true, txt:'não pagamento de multas, franquias, taxas, danos ou despesas;'},
    {bullet:true, txt:'não comparecimento a revisão, manutenção, vistoria, recall ou convocação;'},
    {bullet:true, txt:'uso proibido, mau uso, sinistro não comunicado, abandono ou condução por terceiro não autorizado;'},
    {bullet:true, txt:'adulteração de hodômetro, rastreador, placa, chassi, lacre, documento ou componente de identificação;'},
    {bullet:true, txt:'saída da área permitida sem autorização;'},
    {bullet:true, txt:'comportamento ofensivo, ameaça ou agressão contra colaboradores, parceiros ou representantes da LOCADORA;'},
    {bullet:true, txt:'prestação de informação falsa, fraude documental, omissão relevante ou tentativa de alienar, ocultar ou reter a motocicleta.'},
    {num:'15.2', txt:'Em caso de atraso superior a 7 (sete) dias corridos, a LOCADORA poderá considerar o contrato vencido antecipadamente, comunicar o LOCATÁRIO pelos canais oficiais e, a partir dessa comunicação, bloquear a motocicleta, exigir devolução imediata, cobrar débitos e aplicar as penalidades contratuais cabíveis.'},
    {num:'15.3', txt:'A rescisão por culpa do LOCATÁRIO acarretará: perda do direito de compra, retenção da taxa de adesão, aplicação da caução, cobrança de aluguéis vencidos, multas, danos, franquias, despesas de recolhimento, lucros cessantes e multa compensatória.'},
    {num:'15.4', txt:'A multa compensatória por rescisão antecipada ou quebra contratual será aquela indicada no Anexo II ou, se não preenchida, o menor valor entre R$ 2.000,00 e 20% do saldo das semanas vincendas, sem prejuízo de danos comprovados.'},
    {num:'15.5', txt:'Se o LOCATÁRIO desistir voluntariamente antes do término dos 36 meses, deverá devolver a motocicleta, quitar débitos vencidos, arcar com a multa de rescisão e perderá o direito à aquisição final, salvo acordo escrito em sentido diverso.'},
    {num:'CLÁUSULA 16 — ACERTO FINAL, COBRANÇA, NEGATIVAÇÃO E TÍTULO EXECUTIVO', secao:true},
    {num:'16.1', txt:'Após a devolução, rescisão ou conclusão da compra, a LOCADORA elaborará demonstrativo de acerto final, indicando créditos, débitos, uso de caução, pendências de multa, danos, franquias e demais obrigações.'},
    {num:'16.2', txt:'Havendo saldo a favor do LOCATÁRIO, a restituição ocorrerá em até 15 dias úteis após conclusão da conferência e indicação de conta bancária válida.'},
    {num:'16.3', txt:'Havendo saldo devedor, o LOCATÁRIO deverá quitá-lo no prazo indicado pela LOCADORA, sob pena de cobrança administrativa, judicial, protesto, negativação e demais medidas permitidas em lei.'},
    {num:'16.5', txt:'Este contrato, juntamente com seus anexos, demonstrativos de cobrança, boletos, recibos, vistorias, notas fiscais, orçamentos e comprovantes, constitui título executivo extrajudicial nos termos do art. 784 do Código de Processo Civil.'},
    {num:'CLÁUSULA 17 — PROTEÇÃO DO LOCATÁRIO EM CASO DE ENCERRAMENTO OU CESSÃO DA LOCADORA', secao:true},
    {num:'17.1', txt:'Considerando que o plano prevê aquisição futura da motocicleta, a LOCADORA deverá respeitar os valores pagos e as condições pactuadas caso venha a ceder carteira, transferir o negócio, encerrar atividades, passar por reorganização societária ou substituir a pessoa jurídica responsável pela operação.'},
    {num:'17.2', txt:'Em caso de cessão do contrato a terceiro, o LOCATÁRIO será comunicado e o sucessor deverá respeitar as condições econômicas essenciais já contratadas, salvo acordo escrito diverso.'},
    {num:'17.3', txt:'Se a aquisição final se tornar impossível por culpa exclusiva da LOCADORA após o cumprimento integral das obrigações pelo LOCATÁRIO, este poderá exigir cumprimento específico, substituição por bem equivalente, restituição de valores diretamente pagos a título de preço da opção de compra, se houver, e/ou perdas e danos, conforme legislação aplicável.'},
    {num:'CLÁUSULA 18 — LGPD, DADOS PESSOAIS E COMUNICAÇÕES', secao:true},
    {num:'18.1', txt:'A LOCADORA tratará dados pessoais do LOCATÁRIO como controladora para execução do contrato, análise cadastral, prevenção a fraudes, segurança patrimonial, gestão de frota, cobrança, proteção ao crédito, seguro, cumprimento de obrigações legais e exercício regular de direitos.'},
    {num:'18.2', txt:'O LOCATÁRIO declara ciência de que a motocicleta poderá possuir tecnologia de rastreamento e telemetria, sendo os dados tratados na medida necessária à segurança patrimonial, execução contratual, recuperação do bem, prevenção de fraude, cobrança, manutenção e exercício regular de direitos.'},
    {num:'18.3', txt:'Os dados poderão ser compartilhados com seguradoras, oficinas, rastreadoras, plataformas de cobrança, órgãos de trânsito, autoridades, parceiros operacionais, advogados, despachantes e prestadores necessários à execução contratual.'},
    {num:'18.4', txt:'Comunicações por WhatsApp, e-mail, SMS, aplicativo, telefone, carta ou plataforma eletrônica serão consideradas válidas quando enviadas aos contatos informados pelo LOCATÁRIO, que deverá mantê-los atualizados.'},
    {num:'18.5', txt:'Prints, confirmações de leitura, protocolos, e-mails, mensagens, gravações autorizadas, documentos eletrônicos e assinaturas digitais poderão ser utilizados como prova da comunicação e da manifestação de vontade.'},
    {num:'CLÁUSULA 19 — ASSINATURA ELETRÔNICA, DOCUMENTOS DIGITAIS E ANEXOS', secao:true},
    {num:'19.1', txt:'As partes reconhecem a validade de assinatura eletrônica ou digital realizada por plataforma eletrônica, inclusive ZapSign, gov.br ou outra ferramenta adotada pela LOCADORA, nos termos da legislação aplicável.'},
    {num:'19.2', txt:'Integram este contrato, para todos os fins:'},
    {bullet:true, txt:'Anexo I   - Termo de Entrega, Vistoria e Responsabilidade;'},
    {bullet:true, txt:'Anexo II  - Tabela de Tarifas, Multas e Encargos;'},
    {bullet:true, txt:'Anexo III - Plano de Manutenção e Revisões;'},
    {bullet:true, txt:'Anexo IV  - Condições de Seguro/Proteção;'},
    {bullet:true, txt:'Anexo V   - Termo de Responsabilidade por Infrações de Trânsito;'},
    {bullet:true, txt:'Anexo VI  - Instrumento Definitivo de Compra e Venda e Transferência;'},
    {bullet:true, txt:'Anexo VII - Declaração de Ciência de Riscos da Condução de Motocicleta.'},
    {num:'CLÁUSULA 20 — DISPOSIÇÕES GERAIS', secao:true},
    {num:'20.1', txt:'A tolerância de qualquer das partes quanto ao descumprimento de obrigação não constituirá novação, renúncia ou alteração contratual.'},
    {num:'20.2', txt:'Se qualquer cláusula for considerada inválida, as demais permanecerão válidas, devendo a cláusula inválida ser substituída por outra que preserve, tanto quanto possível, a finalidade econômica e jurídica originalmente pactuada.'},
    {num:'20.3', txt:'Este contrato substitui entendimentos verbais ou escritos anteriores sobre o mesmo objeto.'},
    {num:'20.4', txt:'Alterações contratuais somente terão validade se realizadas por escrito, com aceite das partes, especialmente quando implicarem aumento de encargos, restrição de direitos ou mudança de condição econômica essencial.'},
    {num:'20.5', txt:'As partes declaram ter lido, compreendido e aceito todas as cláusulas, inclusive as relativas a inadimplência, bloqueio, recolhimento, manutenção, seguro, multas, perda do direito de compra e transferência final.'},
    {num:'CLÁUSULA 21 — FORO', secao:true},
    {num:'21.1', txt:'Fica eleito o foro da comarca da sede da LOCADORA para dirimir controvérsias decorrentes deste contrato, ressalvadas regras legais obrigatórias de competência e eventual aplicação de foro diverso por norma de ordem pública.'},
    {num:'ANEXO V — TERMO DE RESPONSABILIDADE POR INFRAÇÕES DE TRÂNSITO', secao:true},
    {num:'', txt:'O LOCATÁRIO declara ser o principal condutor da motocicleta durante a vigência do contrato e assume responsabilidade integral por infrações de trânsito cometidas no período de sua posse.'},
    {num:'', txt:'O LOCATÁRIO compromete-se a apresentar CNH, assinar formulários e colaborar com a indicação de condutor sempre que solicitado pela LOCADORA, no prazo informado, sob pena de arcar com penalidades por não indicação, custos operacionais e demais consequências.'},
    {num:'', txt:'Multas recebidas posteriormente, mas referentes ao período de posse do LOCATÁRIO, continuarão sob sua responsabilidade.'},
  ] : [
    {num:'1. ACEITE ÀS CONDIÇÕES GERAIS E ESPECIAIS', secao:true},
    {num:'1.1', txt:'Ao assinar este Contrato, VOCÊ declara ciência, aceite e adesão às Condições Gerais do Contrato de Aluguel de Carros da ROYAL RENT A CAR LTDA – CNPJ 18.686.521/0001-00. As Condições Gerais estão disponíveis em https://locadoraroyal.com.br/contrato/ e integram este Contrato para todos os fins, na versão vigente na data da assinatura.'},
    {num:'2. SEGURO / PROTEÇÕES', secao:true},
    {num:'2.1', txt:'Pacote Básica: Furto/roubo ou perda total; com coparticipação de 12%, com franquia de 12% do valor da FIPE por evento; Vidros e pneus não incluídos.'},
    {num:'2.2', txt:'Pacote Completa: Cobertura ampla para danos ao veículo locado, com franquia de 6% do valor da FIPE; cobertura danos a terceiros até R$ 50.000,00; cobertura para ocupantes até R$ 10.000,00; furto/roubo com coparticipação de 6%; vidros e pneus incluídos (sublimite R$ 2.000 por item); isenção de limpeza simples e 1 motorista adicional.'},
    {num:'3. MULTAS E IDENTIFICAÇÃO DE CONDUTOR', secao:true},
    {num:'3.1', txt:'Na condição de condutor, VOCÊ assume total responsabilidade por qualquer infração de trânsito e pela pontuação decorrente durante a locação. A ROYAL RENT A CAR LTDA fica desde já constituída sua procuradora para assinar o termo de apresentação do condutor infrator, conforme art. 257 do CTB e Resolução CONTRAN nº 918/2022.'},
    {num:'4. DADOS PESSOAIS E PRIVACIDADE', secao:true},
    {num:'4.1', txt:'As informações coletadas serão utilizadas para executar este Contrato e cumprir obrigações legais e regulatórias, nos termos da Lei nº 13.709/2018 (LGPD). Detalhes em: https://locadoraroyal.com.br/privacy-policy/.'},
    {num:'5. PEDÁGIOS E ESTACIONAMENTOS (TAG)', secao:true},
    {num:'5.1', txt:'Os veículos podem conter dispositivo eletrônico para abertura de cancelas. Se utilizar filas rápidas, autoriza a cobrança dos valores de uso acrescidos da tarifa TAG da Royal, conforme https://locadoraroyal.com.br/tag/.'},
    {num:'6. ÁREAS DE FRONTEIRA', secao:true},
    {num:'6.1', txt:'Não é permitido circular com o veículo num raio de 150 km de fronteiras internacionais. O descumprimento poderá ensejar bloqueio remoto e retomada do veículo, sem prejuízo das demais medidas cabíveis.'},
    {num:'7. DA LIMPEZA E DO COMBUSTÍVEL', secao:true},
    {num:'7.1', txt:'O VEÍCULO deverá ser devolvido nas mesmas condições de limpeza em que foi entregue. Na hipótese de devolução em condições inferiores, será cobrada a taxa de lavagem conforme tabela vigente da LOCADORA.'},
    {num:'7.2', txt:'O VEÍCULO é entregue com o nível de combustível registrado no checklist de saída. Na devolução com nível inferior, será cobrado R$ 7,00 (sete reais) por litro faltante.'},
    {num:'8. CONSULTA A SISTEMAS DE CRÉDITO', secao:true},
    {num:'8.1', txt:'Ao assinar, você permite a consulta de seus dados em bureaus de crédito como Serasa, SPC e Boa Vista, para análise cadastral.'},
    {num:'9. ASSISTÊNCIA 24 HORAS', secao:true},
    {num:'9.1', txt:'Em caso de imprevisto, acione a Assistência 24h: +55 (21) 96894-9627. Serviços: mecânicos e elétricos; remoção do veículo em caso de sinistros e/ou panes; troca de pneus e chaveiro.'},
    {num:'10. PRÉ-AUTORIZAÇÃO', secao:true},
    {num:'10.1', txt:'O bloqueio de valor no cartão de crédito do Locatário garante o pagamento de todas as obrigações do Contrato de Locação. A liberação/devolução desse bloqueio é de responsabilidade exclusiva do banco emissor do cartão e pode ocorrer em até 60 (sessenta) dias contados da devolução do veículo.'},
    {num:'11. PRORROGAÇÃO', secao:true},
    {num:'11.1', txt:'Precisa de mais tempo? Compareça, com o Responsável Financeiro (se houver), até a data e horário originalmente previstos para a devolução, apresentando o veículo em uma loja da Locadora Royal para renovar o Contrato de Locação.'},
    {num:'11.2', txt:'Para locações de pessoa jurídica, seguradora ou agência, é necessária a apresentação do voucher. A prorrogação será feita mediante nova pré-autorização no cartão e pagamento dos valores devidos do período inicial.'},
    {num:'12. ATENÇÃO — DEVOLUÇÃO DO VEÍCULO', secao:true},
    {num:'12.1', txt:'Se o veículo não for devolvido em até 24 (vinte e quatro) horas após o término do prazo contratual, configura-se apropriação indébita, independentemente de notificação, autorizando a Locadora Royal a adotar as medidas legais cabíveis, inclusive comunicar o fato à autoridade policial.'},
    {num:'13. MULTAS DE TRÂNSITO', secao:true},
    {num:'13.1', txt:'O Locatário e/ou Condutor Adicional são exclusivamente responsáveis por todas as multas ocorridas durante a locação e obrigam-se, solidariamente com o Responsável Financeiro, ao pagamento das respectivas multas acrescidas de 12% a título de custo administrativo.'},
    {num:'13.2', txt:'Após a cobrança, os detalhes da multa serão enviados para o e-mail cadastrado na Locadora Royal. Mantenha seus dados sempre atualizados e verifique também Lixo eletrônico/Spam.'},
    {num:'14. ROUBO E/OU FURTO', secao:true},
    {num:'14.1', txt:'O Locatário deverá comunicar: (i) imediatamente a Polícia Militar (190); (ii) em até 1 (uma) hora a Locadora Royal – Assistência 24h: +55 (21) 96894-9627; e (iii) em até 6 (seis) horas providenciar o Boletim de Ocorrência.'},
    {num:'15. AVARIAS', secao:true},
    {num:'15.1', txt:'Todos os veículos são vistoriados antes da entrega; eventuais avarias ocorridas durante o período de locação serão cobradas na devolução. Se pequenas, seguirá tabela de preços da Royal. Se médias/grandes, serão apuradas e cobradas posteriormente, ressalvada a eventual proteção contratada.'},
    {num:'16. INCIDENTES E EMERGÊNCIAS', secao:true},
    {num:'16.1', txt:'Ocorrências com o veículo (roubo, furto, incêndio, acidente de trânsito). Procedimentos padrão:'},
    {bullet:true, txt:'Comunicar imediatamente a Polícia Militar (190);'},
    {bullet:true, txt:'Avisar a Locadora Royal (24h): +55 (21) 96894-9627 em até 1 hora ou na loja mais próxima;'},
    {bullet:true, txt:'Registrar B.O. em até 6 horas;'},
    {bullet:true, txt:'Enviar à Royal o nº do registro/protocolo em até 3 dias úteis;'},
    {bullet:true, txt:'É proibido tratar direto com terceiros/seguradoras ou consertar por conta própria, sob pena de perda das proteções e cobrança de valores adicionais.'},
    {num:'17. DISPOSIÇÕES GERAIS', secao:true},
    {num:'17.1', txt:'A assinatura eletrônica/digital tem plena validade jurídica, conforme MP 2.200/2001.'},
    {num:'17.2', txt:'As informações deste documento são informativas e não substituem os Termos e Condições Gerais de Locação de Veículos da Locadora Royal. Para conhecer o inteiro teor, acesse www.locadoraroyal.com.br/contrato.'},
    {num:'17.3', txt:'O presente instrumento constitui título executivo extrajudicial nos termos do art. 784 do CPC.'},
    {num:'18. FORO', secao:true},
    {num:'18.1', txt:'Fica eleito o foro da Comarca do Rio de Janeiro – RJ, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer litígios decorrentes deste contrato.'},
  ];

  // Renderizar todas as cláusulas
  clausulas.forEach(c => {
    const lineSize = 7;
    const numWidth = c.bullet ? 6 : (c.secao ? 0 : 14);
    const textW    = c.bullet ? CW-8 : (c.secao ? CW : CW-numWidth-2);

    if(c.secao){
      safeY(8);
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
      doc.text(c.num, M, y);
      y += 4.5;
    } else if(c.bullet){
      const lines = doc.splitTextToSize('• ' + c.txt, textW);
      safeY(lines.length * 3.6 + 1);
      doc.setFontSize(lineSize); doc.setFont('helvetica','normal'); doc.setTextColor('#222');
      doc.text(lines, M+6, y);
      y += lines.length * 3.6 + 0.5;
    } else {
      const lines = doc.splitTextToSize(c.txt, textW);
      safeY(lines.length * 3.6 + 1);
      doc.setFontSize(lineSize); doc.setFont('helvetica','bold'); doc.setTextColor('#111');
      doc.text(c.num, M, y);
      doc.setFont('helvetica','normal'); doc.setTextColor('#222');
      doc.text(lines, M+numWidth, y);
      y += lines.length * 3.6 + 1;
    }
  });

  // ══════════════════════════════════════
  // ASSINATURAS
  // ══════════════════════════════════════
  safeY(35);
  y += 10;
  const colW3A = CW/3;
  doc.setDrawColor('#555'); doc.setLineWidth(0.4);

  // Linha 1: Cliente
  doc.line(M+2, y, M+colW3A-4, y);
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor('#222');
  doc.text('Cliente', M+2, y+4);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(d.nomeCli||'—', M+2, y+8);
  doc.text(`CPF: ${d.cpfCli||'—'}`, M+2, y+12);

  // Linha 2: Motorista/Condutor
  const cond1 = (d.todosCondutores||[{nome:d.condutor||d.nomeCli,cpf:d.cpfCli}])[0];
  doc.line(M+colW3A+2, y, M+2*colW3A-4, y);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('Motorista', M+colW3A+2, y+4);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(cond1?.nome||'—', M+colW3A+2, y+8);
  doc.text(`CPF: ${cond1?.cpf||'—'}`, M+colW3A+2, y+12);

  // Linha 3: Atendente
  doc.line(M+2*colW3A+2, y, PW-M-2, y);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('Atendente', M+2*colW3A+2, y+4);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(d.atendente||'—', M+2*colW3A+2, y+8);
  y += 20;

  // Condutores adicionais
  const condAdicionais = (d.todosCondutores||[]).slice(1);
  if(condAdicionais.length){
    safeY(20);
    condAdicionais.forEach((c2,ci)=>{
      const xCA = M + (ci%2===0?2:colW3A+2);
      if(ci%2===0 && ci>0) y += 18;
      doc.setDrawColor('#555'); doc.line(xCA, y, xCA+colW3A-4, y);
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#222');
      doc.text('Condutor Adicional', xCA, y+4);
      doc.setFont('helvetica','normal');
      doc.text(c2.nome||'—', xCA, y+8);
      doc.text(`CPF: ${c2.cpf||'—'}`, xCA, y+12);
    });
    y += 16;
  }

  // ══════════════════════════════════════
  // RODAPÉ EM TODAS AS PÁGINAS
  // ══════════════════════════════════════
  // Calculado ANTES do checklist — total_do_contrato para referência
  const totalPgs = doc.getNumberOfPages();

  // ══════════════════════════════════════
  // PÁGINA EXTRA: CHECKLIST (se fornecido)
  // ══════════════════════════════════════
  if(checklist){
    doc.addPage(); y = M;
    const COL2 = CW/2;
    const newChkPage = () => { doc.addPage(); y = M; };
    const safeYC = (need) => { if(y+need > 278) newChkPage(); };

    rect(0,0,PW,10,'#006400','#006400');
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
    doc.text(`CHECKLIST DE VISTORIA — SAÍDA — Contrato #${numContrato}`, PW/2, 6.5, {align:'center'});
    y = 14;

    rect(M,y,CW,8,'#f0f8f0','#a8d8a8');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor('#004400');
    doc.text(`Cliente: ${d.nomeCli}   |   Veículo: ${d.placa} — ${d.modelo}`, M+3, y+5.5);
    y += 9;

    const fmtHora = checklist.horario ? new Date(checklist.horario).toLocaleString('pt-BR') : '—';
    rect(M,y,CW/3,9,'#f9f9f9','#ddd'); doc.setFontSize(6); doc.setTextColor('#666'); doc.text('Horário',M+3,y+3.5); doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#111'); doc.text(fmtHora,M+3,y+8);
    rect(M+CW/3,y,CW/3,9,'#f9f9f9','#ddd'); doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor('#666'); doc.text('Km',M+CW/3+3,y+3.5); doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#111'); doc.text(`${checklist.km||0} km`,M+CW/3+3,y+8);
    rect(M+2*CW/3,y,CW/3,9,'#f9f9f9','#ddd'); doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor('#666'); doc.text('Combustível',M+2*CW/3+3,y+3.5); doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#111'); doc.text(checklist.combustivel||'—',M+2*CW/3+3,y+8);
    y += 12;

    if(checklist.itens?.length){
      const cats = {};
      checklist.itens.forEach(it=>{ if(!cats[it.categoria]) cats[it.categoria]=[]; cats[it.categoria].push(it); });
      Object.entries(cats).forEach(([cat,its])=>{
        safeYC(10 + Math.ceil(its.length/2)*10);
        rect(M,y,CW,6,'#006400','#006400');
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
        doc.text(cat.toUpperCase(),M+3,y+4.2);
        y += 7;
        for(let i=0; i<its.length; i+=2){
          const it1=its[i], it2=its[i+1]||null;
          const av1=it1.status==='avaria', av2=it2?it2.status==='avaria':false;
          const nh1=it1.status==='nao_houve', nh2=it2?it2.status==='nao_houve':false;
          const rh=(it1.obs||it2?.obs)?13:10;
          safeYC(rh+1);
          const bg1=av1?'#fff5f5':nh1?'#f5f5f5':'#ffffff', bd1=av1?'#ffcccc':nh1?'#cccccc':'#e0e0e0';
          const cl1=av1?'#cc0000':nh1?'#888888':'#006400';
          const lb1=av1?'✕ COM AVARIA':nh1?'— NÃO HOUVE':'✓ OK / SEM AVARIA';
          rect(M,y,COL2,rh,bg1,bd1);
          doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor('#1a1a1a');
          doc.text(it1.descricao.slice(0,30),M+2,y+4);
          doc.setFont('helvetica','bold'); doc.setTextColor(cl1); doc.setFontSize(6);
          doc.text(lb1,M+2,y+8.5);
          if(it1.obs){ doc.setFont('helvetica','italic'); doc.setTextColor('#666'); doc.setFontSize(5.5); doc.text('Obs: '+it1.obs.slice(0,28),M+36,y+8.5); }
          if(it2){
            const bg2=av2?'#fff5f5':nh2?'#f5f5f5':'#ffffff', bd2=av2?'#ffcccc':nh2?'#cccccc':'#e0e0e0';
            const cl2=av2?'#cc0000':nh2?'#888888':'#006400';
            const lb2=av2?'✕ COM AVARIA':nh2?'— NÃO HOUVE':'✓ OK / SEM AVARIA';
            rect(M+COL2,y,COL2,rh,bg2,bd2);
            doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor('#1a1a1a');
            doc.text(it2.descricao.slice(0,30),M+COL2+2,y+4);
            doc.setFont('helvetica','bold'); doc.setTextColor(cl2); doc.setFontSize(6);
            doc.text(lb2,M+COL2+2,y+8.5);
            if(it2.obs){ doc.setFont('helvetica','italic'); doc.setTextColor('#666'); doc.setFontSize(5.5); doc.text('Obs: '+it2.obs.slice(0,28),M+COL2+36,y+8.5); }
          } else { rect(M+COL2,y,COL2,rh,'#fafafa','#e0e0e0'); }
          y += rh+1;
        }
        y += 3;
      });
    }

    if(checklist.observacoes){
      safeYC(16);
      const obsL=doc.splitTextToSize('Observações: '+checklist.observacoes,CW-6);
      const obsH=Math.max(12,obsL.length*4+6);
      rect(M,y,CW,obsH,'#fff8e1','#f0c040');
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#5a4000');
      doc.text(obsL,M+3,y+5);
      y+=obsH+4;
    }

    if(checklist.fotos?.length){
      safeYC(8);
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#444');
      doc.text(`📷 ${checklist.fotos.length} foto(s) anexada(s) no sistema`,M,y+4);
      y+=10;
    }

    if(y>248) newChkPage();
    safeYC(18);
    y += 10;
    doc.setDrawColor('#aaaaaa'); doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.5,1.5],0);
    doc.line(M,y,M+80,y); doc.line(PW-M-80,y,PW-M,y);
    doc.setLineDashPattern([],0);
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#555');
    doc.text('Assinatura do Consultor',M+2,y+4);
    doc.text('Assinatura do Cliente / Condutor',PW-M-78,y+4);

    // Rodapé das páginas do checklist — aplicado junto com o contrato no passe final abaixo
  }

  // ══════════════════════════════════════
  // RODAPÉ UNIFICADO — após todas as páginas (contrato + checklist)
  // ══════════════════════════════════════
  const totalPgsF = doc.getNumberOfPages();
  for(let p=1; p<=totalPgsF; p++){
    doc.setPage(p);
    doc.setFillColor('#006400'); doc.rect(0,287,PW,10,'F');
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor('#ffffff');
    if(p <= totalPgs){
      doc.text(`Locadora Royal — Contrato #${numContrato} — ${d.nomeCli||''} — Página ${p} de ${totalPgsF}`, PW/2, 293, {align:'center'});
    } else {
      doc.text(`Locadora Royal — Contrato #${numContrato} — Checklist de Vistoria — Página ${p} de ${totalPgsF}`, PW/2, 293, {align:'center'});
    }
  }

  if(returnBase64){
    return doc.output('datauristring');
  }
  doc.save(`Contrato_Royal_${numContrato}_${(d.nomeCli||'').replace(/\s+/g,'_')}.pdf`);
  notify(`PDF do Contrato #${numContrato} gerado!`,'success');
}


// ══ TERMOS ══
function _termosMotoConquista(){
  return `CONTRATO DE LOCAÇÃO DE MOTOCICLETA — PLANO CONQUISTA 36 MESES

PREÂMBULO E QUALIFICAÇÃO DAS PARTES
Pelo presente instrumento particular, de um lado, ROYAL RENT A CAR LTDA / ROYAL LOCADORA, pessoa jurídica de direito privado, estabelecida no endereço constante do quadro-resumo acima, doravante denominada simplesmente LOCADORA; e, de outro lado, a pessoa identificada no quadro-resumo acima, doravante denominada LOCATÁRIO.

CLÁUSULA 1 - DEFINIÇÕES
Motocicleta: veículo descrito no quadro-resumo e no Termo de Entrega, Vistoria e Responsabilidade, com seus acessórios, equipamentos originais, documentação e chaves.
Locação com Promessa de Compra: operação pela qual a LOCADORA entrega a posse direta da motocicleta ao LOCATÁRIO por 36 meses, mediante pagamento semanal, com opção automática de aquisição ao final, cumpridas todas as condições contratuais.
Arras: valor pago no início do contrato como sinal e princípio de pagamento da promessa de compra, nos termos deste instrumento.
Caução: garantia contratual destinada a cobrir débitos, multas, franquias, danos, despesas de recolhimento, ausência em manutenção e demais obrigações do LOCATÁRIO.
Manutenção Preventiva: serviços programados previstos no manual do fabricante e/ou no plano de manutenção da LOCADORA, incluindo trocas de óleo, filtros, velas, calibragem, ajustes e revisões periódicas.
Manutenção Corretiva / Danos: reparos decorrentes de queda, colisão, impacto, mau uso, negligência, falta de cuidado, sinistro ou qualquer evento não coberto pela manutenção preventiva, cujo custo é de responsabilidade do LOCATÁRIO.
Semana de Locação: período de 7 dias corridos, contado da data de retirada da motocicleta, com vencimentos sucessivos no mesmo dia da semana.
Quitação Integral: pagamento de todas as semanas de locação, arras, saldo residual, multas, franquias, danos, taxas, despesas e demais obrigações.

CLÁUSULA 2 - OBJETO, NATUREZA DO CONTRATO E FINALIDADE
2.1. O presente contrato tem por objeto a locação da motocicleta indicada no quadro-resumo, com promessa de compra e venda ao final de 36 meses, mediante condições estabelecidas neste instrumento.
2.2. Durante toda a fase de locação, a motocicleta permanecerá de propriedade exclusiva da LOCADORA, sendo conferida ao LOCATÁRIO apenas a posse direta e o uso do bem.
2.3. A transferência de propriedade somente ocorrerá após a quitação integral, a vistoria final, a inexistência de pendências e a assinatura do instrumento definitivo de compra e venda.
2.4. A motocicleta será utilizada preferencialmente para atividade profissional lícita de entrega, mobilidade e deslocamento urbano.
2.5. Este contrato não gera vínculo empregatício, sociedade, parceria, representação comercial, subordinação, exclusividade ou qualquer relação jurídica diversa da locação com promessa de compra.

CLÁUSULA 3 - PRAZO
3.1. O prazo do contrato será de 36 meses, equivalentes a 156 semanas de locação, iniciando-se na data de retirada da motocicleta.
3.2. Cada semana de locação corresponde a 7 dias corridos. O pagamento semanal vencerá sempre no mesmo dia da semana da retirada.
3.3. A devolução antecipada da motocicleta pelo LOCATÁRIO não gera abatimento automático de valores já pagos a título de locação.
3.4. Ao final dos 36 meses, cumpridas todas as condições contratuais, a promessa de compra será formalizada conforme a Cláusula 6.

CLÁUSULA 4 - PREÇO, PAGAMENTOS, ARRAS E CAUÇÃO
4.1. Locação Semanal: o LOCATÁRIO pagará à LOCADORA o valor semanal indicado no quadro-resumo, por boleto, PIX, cartão, plataforma de cobrança ou outro meio acordado.
4.1.2. O pagamento é devido de forma pontual e independente de cobrança. O não recebimento de boleto, link ou mensagem não exime o LOCATÁRIO da obrigação de pagar na data acordada.
4.1.3. O valor pago semanalmente tem natureza de locação, remuneração pelo uso da motocicleta e composição econômica do plano de aquisição futura.
4.2. Arras: no ato da assinatura e/ou retirada da motocicleta, o LOCATÁRIO pagará à LOCADORA o valor indicado como arras no quadro-resumo, como sinal e princípio de pagamento da promessa de compra.
4.2.2. Se o LOCATÁRIO cumprir integralmente o contrato e adquirir a motocicleta, as arras serão abatidas do preço total de aquisição.
4.2.3. Se o LOCATÁRIO der causa à rescisão, desistir da compra, abandonar o contrato ou descumprir obrigação essencial, as arras serão retidas pela LOCADORA como indenização mínima.
4.3. Caução: o LOCATÁRIO pagará caução no valor indicado no quadro-resumo, destinada a garantir obrigações contratuais, débitos, multas, franquias, danos e despesas. A caução não limita a responsabilidade do LOCATÁRIO.
4.3.3. Se a caução for utilizada total ou parcialmente durante o contrato, o LOCATÁRIO deverá recompô-la ao valor original em até 5 dias úteis após notificação.
4.3.4. Não havendo pendências, a caução será restituída em até 15 dias úteis após devolução da motocicleta ou conclusão da compra.
4.4. Encargos por atraso: sobre valores vencidos e não pagos incidirão multa moratória de até 5%, juros de 1% ao mês pro rata die e correção monetária pelo IPCA/IBGE. A mora ocorrerá automaticamente no vencimento, independentemente de notificação.
4.4.3. A inadimplência poderá gerar bloqueio preventivo, recolhimento pacífico, rescisão, perda do direito de compra, cobrança extrajudicial e judicial, negativação e demais consequências previstas neste contrato.

CLÁUSULA 5 - PREÇO DE COMPRA E COMPOSIÇÃO ECONÔMICA DO PLANO
5.1. O preço total de compra da motocicleta será aquele indicado no quadro-resumo, obrigatoriamente preenchido antes da assinatura.
5.2. As partes declaram ciência de que o plano de 36 meses possui natureza econômica mista: locação da motocicleta durante o prazo contratual com opção de compra ao final, mediante quitação integral de todas as obrigações.
5.3. O saldo residual final será aquele indicado no quadro-resumo. Nenhum pagamento será presumido como preço de compra, amortização, caução, multa, seguro ou taxa se tal natureza não constar expressamente.

CLÁUSULA 6 - PROMESSA DE COMPRA, OPÇÃO AUTOMÁTICA E TRANSFERÊNCIA
6.1. Ao final dos 36 meses, a opção de compra será considerada exercida automaticamente pelo LOCATÁRIO se todas as semanas de locação estiverem quitadas; arras, saldo residual, multas, franquias, danos, taxas e despesas estiverem quitados; a motocicleta estiver em condições compatíveis com uso regular; e o LOCATÁRIO comparecer para vistoria final e assinatura dos documentos de transferência.
6.2. O LOCATÁRIO poderá optar por não adquirir a motocicleta, desde que comunique a LOCADORA por escrito com antecedência mínima de 30 dias do término do contrato.
6.3. Cumpridas as condições da compra, as partes assinarão instrumento definitivo de compra e venda, recibo de transferência e demais documentos necessários à transmissão da propriedade.
6.5. O LOCATÁRIO/COMPRADOR deverá providenciar a transferência de propriedade perante o DETRAN no prazo legal, arcando com todos os custos correspondentes.

CLÁUSULA 7 - ENTREGA, VISTORIA, ESTADO DA MOTOCICLETA E DEVOLUÇÃO
7.1. A motocicleta será entregue mediante assinatura do Anexo I - Termo de Entrega, Vistoria e Responsabilidade, com checklist fotográfico.
7.2. O LOCATÁRIO declara receber a motocicleta em condições de uso, segurança e conservação compatíveis com o termo de vistoria.
7.3. Em caso de rescisão, inadimplência, desistência, perda do direito de compra ou encerramento sem aquisição, a motocicleta deverá ser devolvida imediatamente, nas condições exigidas neste contrato.
7.4. Na devolução, será realizada vistoria final. Danos, ausência de acessórios, peças não originais, pneus inadequados, pendências de manutenção e divergências serão de responsabilidade do LOCATÁRIO.

CLÁUSULA 8 - REQUISITOS DO LOCATÁRIO E CONDUTOR AUTORIZADO
8.1. Somente o LOCATÁRIO identificado neste contrato poderá conduzir a motocicleta, salvo autorização prévia e escrita da LOCADORA.
8.2. O LOCATÁRIO declara possuir CNH categoria A válida, não suspensa, não cassada e compatível com a condução de motocicleta.
8.3. O LOCATÁRIO deverá manter seus dados pessoais, endereço, telefone, WhatsApp, e-mail, CNH e local de guarda da motocicleta atualizados junto à LOCADORA.
8.5. O LOCATÁRIO deverá possuir ou indicar local seguro para guarda da motocicleta fora dos períodos de uso, preferencialmente garagem fechada ou área monitorada.
8.6. É vedado emprestar, ceder, sublocar, vender, prometer vender, penhorar, dar em garantia, transferir ou permitir o uso por terceiro não autorizado.

CLÁUSULA 9 - USO PERMITIDO, LIMITAÇÕES E PROIBIÇÕES
9.1. O LOCATÁRIO utilizará a motocicleta de forma prudente, lícita e compatível com as especificações do fabricante.
9.2. É expressamente proibido ao LOCATÁRIO:
• conduzir sob efeito de álcool, drogas, substâncias psicoativas ou medicamentos que comprometam a condução;
• participar de rachas, competições, manobras perigosas, empinar, saltar obstáculos;
• transportar carga superior ao limite do fabricante ou bens ilícitos, inflamáveis, explosivos ou perigosos;
• trafegar em trilhas, lama, dunas, praias, alagamentos, rios ou áreas off-road;
• sair do Estado do Rio de Janeiro ou do perímetro autorizado sem autorização prévia e escrita da LOCADORA;
• adulterar hodômetro, placa, lacres, rastreador, telemetria, chassi, motor ou qualquer componente de identificação;
• remover adesivos, instalar acessórios não autorizados, alterar sistema elétrico ou escapamento;
• utilizar peças paralelas, recondicionadas ou adaptadas sem autorização escrita;
• deixar a motocicleta pernoitar em via pública ou local inseguro.
9.3. O uso de baú, suporte de baú e carregador de celular somente será permitido se autorizado pela LOCADORA.

CLÁUSULA 10 - MANUTENÇÃO, REVISÕES E RESPONSABILIDADE POR DANOS
10.1. A manutenção da motocicleta deverá observar o manual do fabricante, o plano de uso severo quando aplicável e as orientações da LOCADORA.
10.2. A motocicleta somente poderá passar por revisão, manutenção ou reparo em oficina, concessionária ou parceiro indicado pela LOCADORA.
10.4. O LOCATÁRIO deverá: verificar diariamente óleo, pneus, calibragem, freios, corrente/relação, luzes, painel e condições gerais; comunicar imediatamente vazamento, fumaça, ruído, luz de advertência, superaquecimento, falha, queda, colisão ou anormalidade; cessar o uso se houver risco de dano mecânico, elétrico ou estrutural; comparecer às revisões, trocas de óleo e vistorias nos prazos determinados.
10.6. São de responsabilidade do LOCATÁRIO os custos de manutenção corretiva, danos, reparos, reboque, lucros cessantes e demais despesas decorrentes de mau uso, negligência, acidente ou descumprimento do plano de manutenção.
10.8. O não comparecimento injustificado à manutenção, revisão ou vistoria poderá gerar taxa, bloqueio, recolhimento, rescisão e perda do direito de compra.

CLÁUSULA 11 - SEGURO, PROTEÇÃO, FRANQUIAS E EXCLUSÕES
11.1. A motocicleta poderá contar com seguro ou proteção veicular conforme quadro-resumo e Anexo IV, podendo abranger cobertura para roubo, furto e danos a terceiros.
11.2. O LOCATÁRIO declara ciência de que a cobertura depende das condições da apólice/proteção e do cumprimento das obrigações contratuais.
11.3. Em caso de sinistro coberto, o LOCATÁRIO será responsável pela franquia, participação obrigatória e despesas não cobertas.
11.4. A cobertura poderá não se aplicar nos casos de: condução sob efeito de álcool ou substâncias psicoativas; condutor não autorizado; mau uso ou manobras proibidas; ausência de Boletim de Ocorrência no prazo exigido; e demais exclusões previstas na apólice.

CLÁUSULA 12 - MULTAS, INFRAÇÕES, PONTUAÇÃO E RESPONSABILIDADE PERANTE ÓRGÃOS DE TRÂNSITO
12.1. O LOCATÁRIO é integralmente responsável por multas, pontuação, remoção, estadia em pátio, taxas, penalidades, processos administrativos e demais encargos decorrentes de infrações durante o período de posse.
12.2. O LOCATÁRIO autoriza a LOCADORA a indicá-lo como condutor infrator perante os órgãos competentes.
12.3. A LOCADORA poderá cobrar o valor da multa, encargos e custo operacional de 20% (vinte por cento) sobre o valor de cada infração.
12.4. Multas recebidas após o encerramento do contrato, mas referentes ao período de posse do LOCATÁRIO, permanecerão sob sua responsabilidade.

CLÁUSULA 13 - SINISTROS, ACIDENTES, FURTO, ROUBO E PROVIDÊNCIAS OBRIGATÓRIAS
13.1. Em caso de acidente, queda, colisão, furto, roubo, incêndio, alagamento, dano a terceiro, apreensão, pane grave ou qualquer sinistro, o LOCATÁRIO deverá: comunicar imediatamente a LOCADORA por WhatsApp, telefone ou canal oficial; registrar boletim de ocorrência no menor prazo possível e, preferencialmente, em até 24 horas; enviar fotos, vídeos, localização, horário, dados de terceiros e documentos solicitados; não assumir culpa, transacionar, abandonar a motocicleta ou autorizar reparos sem anuência da LOCADORA.
13.2. O descumprimento das providências acima poderá causar perda de cobertura securitária e responsabilização integral do LOCATÁRIO pelos danos.

CLÁUSULA 14 - RASTREADOR, TELEMETRIA, BLOQUEIO REMOTO E RECOLHIMENTO
14.1. A motocicleta poderá possuir rastreador, telemetria, sistema antifurto e bloqueio remoto para segurança patrimonial e recuperação do bem.
14.2. O LOCATÁRIO autoriza a coleta e o tratamento de dados de localização, quilometragem, uso, eventos de ignição, alertas e telemetria.
14.3. O bloqueio remoto poderá ser utilizado em caso de inadimplência, suspeita de furto, roubo, fraude, uso indevido, mau uso grave, sinistro não comunicado, saída da área autorizada ou outras hipóteses previstas neste contrato.
14.5. O recolhimento extrajudicial da motocicleta somente poderá ocorrer de forma pacífica, sem violação de domicílio, sem constrangimento ilegal e com observância das garantias constitucionais do LOCATÁRIO.

CLÁUSULA 15 - INADIMPLEMENTO, RESCISÃO E PERDA DO DIREITO DE COMPRA
15.1. Constituem hipóteses de inadimplemento grave e/ou rescisão: atraso no pagamento semanal ou de qualquer obrigação pecuniária; não pagamento de multas, franquias, taxas, danos ou despesas; não comparecimento a revisão, manutenção, vistoria, recall ou convocação; uso proibido, mau uso, sinistro não comunicado, abandono ou condução por terceiro não autorizado; adulteração de hodômetro, rastreador, placa, chassi, lacre, documento ou componente de identificação; prestação de informação falsa, fraude documental ou tentativa de alienar, ocultar ou reter a motocicleta.
15.2. Em caso de atraso superior a 2 dias corridos, a LOCADORA poderá considerar o contrato vencido antecipadamente, bloquear a motocicleta, promover o recolhimento e iniciar a cobrança extrajudicial e/ou judicial.
15.3. A rescisão por culpa do LOCATÁRIO acarretará: perda do direito de compra, retenção das arras, aplicação de multa compensatória, cobrança de danos e despesas.
15.5. Se o LOCATÁRIO desistir voluntariamente antes do término dos 36 meses, deverá devolver a motocicleta, quitar débitos e perderá o direito de compra e as arras pagas.

CLÁUSULA 16 - ACERTO FINAL, COBRANÇA, NEGATIVAÇÃO E TÍTULO EXECUTIVO
16.1. Após a devolução, rescisão ou conclusão da compra, a LOCADORA elaborará demonstrativo de acerto final.
16.2. Havendo saldo a favor do LOCATÁRIO, a restituição ocorrerá em até 15 dias úteis após conclusão da conferência e inexistência de pendências.
16.3. Havendo saldo devedor, o LOCATÁRIO deverá quitá-lo no prazo indicado pela LOCADORA, sob pena de cobrança administrativa, judicial, negativação e demais medidas cabíveis.
16.5. Este contrato, juntamente com seus anexos e demonstrativos de cobrança, constitui título executivo extrajudicial, nos termos do art. 784 do CPC.

CLÁUSULA 17 - PROTEÇÃO DO LOCATÁRIO EM CASO DE ENCERRAMENTO OU CESSÃO DA LOCADORA
17.1. Considerando que o plano prevê aquisição futura da motocicleta, a LOCADORA deverá respeitar os valores pagos e as condições estabelecidas, mesmo em caso de cessão do contrato a terceiro.
17.3. Se a aquisição final se tornar impossível por culpa exclusiva da LOCADORA após o cumprimento integral das obrigações pelo LOCATÁRIO, a LOCADORA restituirá as arras em dobro.

CLÁUSULA 18 - LGPD, DADOS PESSOAIS E COMUNICAÇÕES
18.1. A LOCADORA tratará dados pessoais do LOCATÁRIO como controladora para execução do contrato, análise cadastral, prevenção a fraudes, segurança patrimonial, cobrança e demais finalidades compatíveis.
18.2. Os dados poderão ser compartilhados com seguradoras, oficinas, rastreadoras, plataformas de cobrança, órgãos de trânsito e autoridades competentes.
18.3. Comunicações por WhatsApp, e-mail, SMS, aplicativo, telefone, carta ou plataforma eletrônica serão consideradas válidas e produzirão efeitos jurídicos.

CLÁUSULA 19 - ASSINATURA ELETRÔNICA, DOCUMENTOS DIGITAIS E ANEXOS
19.1. As partes reconhecem a validade de assinatura eletrônica ou digital realizada por plataforma eletrônica, inclusive pelo aceite digital ou assinatura por geolocalização.
19.2. Integram este contrato, para todos os fins:
  Anexo I   - Termo de Entrega, Vistoria e Responsabilidade;
  Anexo II  - Tabela de Tarifas, Multas e Encargos;
  Anexo III - Plano de Manutenção e Revisões;
  Anexo IV  - Condições de Seguro/Proteção;
  Anexo V   - Termo de Responsabilidade por Infrações de Trânsito.

CLÁUSULA 20 - DISPOSIÇÕES GERAIS
20.1. A tolerância de qualquer das partes quanto ao descumprimento de obrigação não constituirá novação, renúncia ou alteração contratual.
20.2. Se qualquer cláusula for considerada inválida, as demais permanecerão válidas.
20.3. Este contrato substitui entendimentos verbais ou escritos anteriores sobre o mesmo objeto.
20.5. As partes declaram ter lido, compreendido e aceito todas as cláusulas, inclusive as relativas a inadimplência, bloqueio, recolhimento, rescisão, perda do direito de compra e retenção de arras.

CLÁUSULA 21 - FORO
21.1. Fica eleito o foro da comarca da sede da LOCADORA para dirimir controvérsias decorrentes deste contrato, ressalvado o direito do consumidor quando aplicável.`;
}


function _termosCarro(){
  return `1. ACEITE ÀS CONDIÇÕES GERAIS E ESPECIAIS
Ao assinar este Contrato, VOCÊ declara ciência, aceite e adesão às Condições Gerais do Contrato de Aluguel de Carros da ROYAL RENT A CAR LTDA – CNPJ 18.686.521/0001-00. As Condições Gerais estão disponíveis em https://locadoraroyal.com.br/contrato/.

2. SEGURO / PROTEÇÕES
Pacote Básica: Furto/roubo ou perda total com coparticipação de 12%, franquia de 12% do valor da FIPE por evento; vidros e pneus não incluídos.
Pacote Completa: Cobertura ampla, franquia 6% FIPE, danos a terceiros até R$ 50.000,00, cobertura ocupantes até R$ 10.000,00, vidros e pneus incluídos (sublimite R$ 2.000 por item).

3. MULTAS E IDENTIFICAÇÃO DE CONDUTOR
O LOCATÁRIO assume total responsabilidade por infrações de trânsito. A ROYAL fica constituída sua procuradora para assinar o termo de apresentação do condutor infrator, conforme art. 257 do CTB e Resolução CONTRAN nº 918/2022.

4. DADOS PESSOAIS E PRIVACIDADE
As informações coletadas serão utilizadas para executar este Contrato nos termos da Lei nº 13.709/2018 (LGPD). Acesse: https://locadoraroyal.com.br/privacy-policy/.

5. PEDÁGIOS E ESTACIONAMENTOS (TAG)
Os veículos podem conter dispositivo eletrônico para abertura de cancelas. A utilização autoriza a cobrança dos valores de uso acrescidos da tarifa TAG da Royal.

6. ÁREAS DE FRONTEIRA
Proibido circular em raio de 150 km de fronteiras internacionais. O descumprimento autoriza bloqueio remoto e retomada do veículo.

7. DA LIMPEZA E DO COMBUSTÍVEL
O veículo deverá ser devolvido nas mesmas condições de limpeza. Nível de combustível inferior ao da retirada: cobrança de R$ 7,00 por litro faltante.

8. CONSULTA A SISTEMAS DE CRÉDITO
Ao assinar, você permite consulta de seus dados em bureaus de crédito (Serasa, SPC, Boa Vista) para análise cadastral.

ASSISTÊNCIA 24 HORAS: +55 (21) 96894-9627 — Mecânicos, Elétricos, Remoção, Troca de pneus.
INCIDENTES: 1) Comunicar Polícia Militar (190); 2) Avisar Royal em até 1h; 3) Registrar BO em até 6h; 4) Enviar nº protocolo em até 3 dias úteis.
ATENÇÃO: Devolução após 24h do término configura apropriação indébita.`;
}

// ══ CALENDÁRIO ══
function renderCal(){
  document.getElementById('cal-titulo').textContent=MONTHS[calMonth]+' '+calYear;
  const first=new Date(calYear,calMonth,1).getDay();
  const days=new Date(calYear,calMonth+1,0).getDate();
  const today=new Date();
  const busy={};
  allLocacoes.forEach(l=>{
    for(let d=new Date(l.data_inicio+'T00:00:00');d<=new Date(l.data_fim+'T00:00:00');d.setDate(d.getDate()+1)){
      if(d.getFullYear()===calYear&&d.getMonth()===calMonth){
        const k=d.getDate(); if(!busy[k]) busy[k]=[]; busy[k].push(l.veiculos?.tipo||'carro');
      }
    }
  });
  allReservas.filter(r=>r.status==='ativa').forEach(r=>{
    for(let d=new Date(r.data_inicio+'T00:00:00');d<=new Date(r.data_fim+'T00:00:00');d.setDate(d.getDate()+1)){
      if(d.getFullYear()===calYear&&d.getMonth()===calMonth){
        const k=d.getDate(); if(!busy[k]) busy[k]=[]; busy[k].push('reserva');
      }
    }
  });
  let html='';
  for(let i=0;i<first;i++) html+=`<div class="cal-day other">${new Date(calYear,calMonth,-first+i+1).getDate()}</div>`;
  for(let d=1;d<=days;d++){
    const isT=d===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear();
    const types=[...new Set(busy[d]||[])];
    const dots=types.map(t=>`<div class="dot" style="background:${t==='reserva'?'#2563EB':t==='carro'?'#3b82f6':'#f5a623'}"></div>`).join('');
    html+=`<div class="cal-day ${isT?'today':''}" onclick="calSelectDay(${d})"><span>${d}</span>${dots?`<div class="dots">${dots}</div>`:''}</div>`;
  }
  document.getElementById('cal-grid').innerHTML=html;
}
function changeMonth(dir){ calMonth+=dir; if(calMonth>11){calMonth=0;calYear++;} if(calMonth<0){calMonth=11;calYear--;} renderCal(); }

async function calSelectDay(d){
  document.getElementById('cal-sel-date').textContent=`${d} de ${MONTHS[calMonth]}`;
  const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const {data:locs}=await sb.from('locacoes').select('*,veiculos(*)').lte('data_inicio',ds).gte('data_fim',ds).eq('status','ativa');
  const locIds=(locs||[]).map(l=>l.veiculo_id);
  const locPorVeiculo={}; (locs||[]).forEach(l=>{ locPorVeiculo[l.veiculo_id]=l; });
  const resIds=allReservas.filter(r=>r.status==='ativa'&&r.data_inicio?.slice(0,10)<=ds&&r.data_fim?.slice(0,10)>=ds).map(r=>r.veiculo_id);
  document.getElementById('cal-veic-list').innerHTML=allVeiculos.map(v=>{
    const b=v.status==='manutencao'?'badge-yellow':locIds.includes(v.id)?'badge-red':resIds.includes(v.id)?'badge-blue':'badge-green';
    const lb=v.status==='manutencao'?'Manutenção':locIds.includes(v.id)?'Alugado':resIds.includes(v.id)?'Reservado':'Disponível';

    // Se alugado e a devolução é nesse mesmo dia, mostra o horário em que estará livre (+4h buffer)
    let dispInfo='';
    const loc = locPorVeiculo[v.id];
    if(loc?.data_fim_hora && loc.data_fim===ds){
      const fimDt = new Date(loc.data_fim_hora);
      const dispDt = new Date(fimDt.getTime() + 4*60*60*1000);
      const hhmm = dt => dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      dispInfo = `<div style="font-size:10px;color:var(--muted);margin-top:2px">devolução ${hhmm(fimDt)} · 🧹 livre ${hhmm(dispDt)}${dispDt.toDateString()!==fimDt.toDateString()?' (+1d)':''}</div>`;
    }

    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px"><div class="vi ${v.tipo==='carro'?'vi-car':'vi-moto'}">${v.tipo==='carro'?'🚗':'🏍️'}</div><div><div style="font-size:13px;font-weight:500">${v.marca} ${v.modelo}</div><div style="font-size:11px;color:var(--muted)">${v.placa}</div>${dispInfo}</div></div><span class="badge ${b}">${lb}</span></div>`;
  }).join('')||'<p style="color:var(--muted2)">Sem veículos.</p>';
}


// ══ AUTENTIQUE — ASSINATURA DIGITAL ══
async function enviarParaAssinatura(numContrato, d, locacaoId, pdfDataUrlParam=null, cidParam=null){
  const cfg  = JSON.parse(localStorage.getItem('fp_evo_cfg')||'{}');
  const bridge = (cfg.bridgeUrl || 'https://bridge.ruahsystems.com.br').replace(/\/$/,'');

  const btnAs = document.getElementById('btn-assinar-digital');
  if(btnAs){ btnAs.disabled=true; btnAs.textContent='⏳ Enviando para assinatura...'; }

  try{
    // 1. Usa PDF já gerado OU gera agora (evita gerar duas vezes)
    let docPdf = pdfDataUrlParam;
    if(!docPdf){
      if(!window.jspdf){ notify('jsPDF não carregado','error'); return; }
      docPdf = await gerarPdfContrato(numContrato, d, null, true);
    }
    const pdfBase64 = docPdf.split(',')[1]; // remove "data:application/pdf;base64,"

    // 2. Monta signatários
    const _cidFinal = cidParam || d.clienteId || document.getElementById('c-cli')?.value;
    const c = allClientes.find(x=>x.id===_cidFinal);
    // Extrair telefone — mesmo padrão do restante do sistema
    let _cTel = c?.telefone||'';
    if(!_cTel && c?.telefones){
      try{
        const _ta = Array.isArray(c.telefones) ? c.telefones : JSON.parse(c.telefones);
        if(_ta?.length) _cTel = _ta[0].numero||'';
      }catch(_){}
    }
    console.log('[autentique] cliente:', c?.nome, '| tel:', _cTel, '| cid:', _cidFinal);
    // Sempre usar só nome (sem email) — quando tem email, Autentique envia direto
    // e NÃO retorna o link na API. Com só nome, gera link público que podemos enviar no WhatsApp.
    const signatarios = [
      { nome: d.nomeCli },
      { nome: 'Royal Rent A Car Ltda' },
    ];

    // 3. Enviar para o bridge → Autentique
    const resp = await fetch(bridge + '/api/autentique/enviar-contrato', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-secret': cfg.secret||'' },
      body: JSON.stringify({
        pdfBase64,
        nomeDoc:    `Contrato #${numContrato} — ${d.nomeCli}`,
        signatarios,
        locacaoId,
      }),
    });

    if(!resp.ok){ const t=await resp.text(); throw new Error(t); }
    const result = await resp.json();

    // 4. Pegar links em ordem de inserção (1º = cliente, 2º = locadora)
    const _todosLinks = Object.values(result.links||{}).filter(Boolean);
    const linkCliente  = _todosLinks[0] || null;
    const linkLocadora = _todosLinks[1] || null;
    console.log('[autentique] links recebidos:', result.links, '| cliente:', linkCliente);

    notify('✅ Documento enviado ao Autentique!', 'success');

    // 5. Montar mensagem WhatsApp formatada
    const _fmtDH = (dt) => {
      if(!dt) return '—';
      try{ return new Date(dt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
      catch(_){ return dt.slice(0,16).replace('T',' '); }
    };
    const _semanas = (d.ini && d.fim)
      ? Math.round((new Date(d.fim)-new Date(d.ini))/(7*24*3600*1000))
      : '—';
    const _totalFmt = (d.totalBruto||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
    const _semFmt   = (d.dia||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
    const _icVei    = d.planoNome?.toLowerCase().includes('moto')||d.modelo?.toLowerCase().includes('moto')||d.modelo?.toLowerCase().includes('fazer')||d.modelo?.toLowerCase().includes('honda')||d.modelo?.toLowerCase().includes('yamaha')||d.modelo?.toLowerCase().includes('150')||d.modelo?.toLowerCase().includes('160') ? '🏍️' : '🚗';

    const msgWpp =
      `📄 *CONTRATO #${numContrato} — LOCADORA ROYAL*\n\n` +
      `👤 Cliente: *${d.nomeCli}*\n` +
      `📋 CPF: *${c?.cpf||'—'}*\n` +
      `${_icVei} Veículo: *${d.modelo||''} — ${d.placa||''}*\n` +
      `📅 Retirada: *${_fmtDH(d.ini)}*\n` +
      `📅 Devolução: *${_fmtDH(d.fim)}*\n` +
      `📍 Local: *${d.localRet||'Loja'}*\n` +
      `⏱️ Período: *${_semanas} semanas*\n` +
      `💰 Valor semanal: *R$ ${_semFmt}*\n` +
      (_icVei==='🏍️' ? '' : `💳 Total: *R$ ${_totalFmt}*\n`) +
      `✅ Contrato registrado com sucesso!\n\n` +
      `✍️ *Assine agora pelo link:*\n${linkCliente||'(sem link)'}\n\n` +
      `_Equipe Locadora Royal 🚗_`;

    // 6. Modal com links e botão WhatsApp
    if(linkCliente || linkLocadora){
      const _modalId = 'aut'+Date.now(); // sem hífens — identificador JS válido
      window._autentiqueWppFn = async (btnEl) => {
        if(!_cTel){ notify('Cliente sem telefone cadastrado','error'); return; }
        btnEl.disabled=true; btnEl.textContent='⏳ Enviando...';
        try{
          await evoSendText(_cTel, msgWpp);
          btnEl.textContent='✅ Enviado!';
          btnEl.style.background='var(--green)';
          notify('Mensagem enviada no WhatsApp ✓','success');
        }catch(e){
          btnEl.disabled=false; btnEl.textContent='💬 Enviar no WhatsApp';
          notify('Erro no WhatsApp: '+e.message,'error');
        }
      };

      const modal = document.createElement('div');
      modal.id = _modalId;
      modal.style.cssText='position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
      modal.innerHTML=`
        <div style="background:var(--bg);border-radius:18px;padding:28px;max-width:460px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.5);max-height:90vh;overflow-y:auto">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:17px;font-weight:700;color:var(--text)">✅ Contrato enviado para assinatura</div>
            <button onclick="document.getElementById('${_modalId}').remove()" style="background:rgba(255,255,255,.08);border:none;color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:15px">✕</button>
          </div>
          <div style="font-size:12px;color:var(--muted2);margin-bottom:20px">Contrato #${numContrato} — ${d.nomeCli}</div>

          ${linkCliente?`
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:var(--muted2);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">🔗 Link do Cliente</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="inp-lk-cli-${_modalId}" value="${linkCliente}" readonly
                style="flex:1;font-size:11px;padding:7px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--text)">
              <button onclick="navigator.clipboard.writeText('${linkCliente}');notify('Copiado!','success')"
                style="padding:6px 12px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:12px;white-space:nowrap">Copiar</button>
            </div>
          </div>`:``}

          ${linkLocadora?`
          <div style="margin-bottom:20px">
            <div style="font-size:11px;color:var(--muted2);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">🔗 Link da Locadora</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input value="${linkLocadora}" readonly
                style="flex:1;font-size:11px;padding:7px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--text)">
              <button onclick="navigator.clipboard.writeText('${linkLocadora}');notify('Copiado!','success')"
                style="padding:6px 12px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:12px;white-space:nowrap">Copiar</button>
            </div>
          </div>`:``}

          <!-- Preview da mensagem WhatsApp -->
          <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:16px;border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--muted2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">💬 Prévia da mensagem WhatsApp</div>
            <pre style="font-size:11.5px;color:var(--text2);white-space:pre-wrap;font-family:var(--font-body);line-height:1.6;margin:0">${msgWpp.replace(/\*/g,'').replace(/_/g,'')}</pre>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px">
            <button
              style="width:100%;padding:11px;border-radius:10px;background:#25d366;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:700"
              onclick="window._autentiqueWppFn(this)">
              💬 Enviar no WhatsApp
            </button>
            <button onclick="document.getElementById('${_modalId}').remove()"
              style="width:100%;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border2);cursor:pointer;color:var(--muted);font-size:13px">
              Fechar
            </button>
          </div>
        </div>`;
      document.body.appendChild(modal);


    }

  }catch(e){
    notify('Erro ao enviar para Autentique: '+e.message,'error');
    console.error('[autentique]', e);
  }finally{
    if(btnAs){ btnAs.disabled=false; btnAs.textContent='✍️ Assinar Digitalmente'; }
  }
}

// ── PLANOS DE MOTO — CONTRATO ──
function _recalcFimPlanoMoto(){
  const planoVal = document.querySelector('input[name="c-plano-moto"]:checked')?.value;
  if(!planoVal) return;
  const cIni = document.getElementById('c-ini');
  const cFim = document.getElementById('c-fim');
  if(!cIni?.value || !cFim) return;
  const totalSemanas = planoVal==='399.90' ? 156 : 52;
  const primeiraIncluida = document.getElementById('c-primeira-semana-incluida')?.checked !== false;
  const extraDias = primeiraIncluida ? 0 : 7; // promo "1ª semana grátis" empurra +7 dias
  const ini = new Date(cIni.value);
  ini.setDate(ini.getDate() + totalSemanas*7 + extraDias);
  const pad = n=>String(n).padStart(2,'0');
  cFim.value = `${ini.getFullYear()}-${pad(ini.getMonth()+1)}-${pad(ini.getDate())}T${pad(ini.getHours())}:${pad(ini.getMinutes())}`;
}

function _selecionarPlanoContrato(radio){
  const val = radio.value;
  ['c-plano-12-label','c-plano-36-label'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const v = el.querySelector('input')?.value;
    el.style.borderColor = v===val ? 'var(--accent)' : 'var(--border2)';
    el.style.background  = v===val ? 'rgba(37,99,235,.08)' : '';
  });
  const cDia = document.getElementById('c-dia');
  if(cDia){ cDia.value = val; }
  _recalcFimPlanoMoto();
  previewContrato();
}

function _verificarMotoContrato(){
  const veiId = document.getElementById('c-vei')?.value;
  const v = allVeiculos?.find(x=>x.id===veiId);
  const wrap = document.getElementById('c-planos-moto-wrap');
  const labelVal = document.getElementById('label-valor-principal');
  const isMoto = v?.tipo==='moto';
  if(wrap) wrap.style.display = isMoto ? '' : 'none';
  if(labelVal) labelVal.textContent = isMoto ? 'Valor semanal (R$)' : 'Valor diária (R$)';
  // Se moto: seleciona Plano 12 meses por padrão e preenche valor
  if(isMoto){
    const jaTemPlano = document.querySelector('input[name="c-plano-moto"]:checked');
    if(!jaTemPlano){
      const radio12 = document.querySelector('input[name="c-plano-moto"][value="379.99"]');
      if(radio12){
        radio12.checked = true;
        _selecionarPlanoContrato(radio12);
      }
    }
  } else {
    // Carro: limpa valor do plano anterior
    const cDia = document.getElementById('c-dia');
    if(cDia && !cDia.value) cDia.value = '';
    // Desmarca planos de moto
    document.querySelectorAll('input[name="c-plano-moto"]').forEach(r=>r.checked=false);
    ['c-plano-12-label','c-plano-36-label'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.style.borderColor='var(--border2)'; el.style.background=''; }
    });
  }
}

// ══ CARTÃO — mostrar/esconder campos ══
function _onChangePgto(){
  const pgto = document.getElementById('c-pgto')?.value||'';
  const isCard = pgto.toLowerCase().includes('cartão')||pgto.toLowerCase().includes('cartao');
  const wrap = document.getElementById('c-campos-cartao');
  if(wrap) wrap.style.display = isCard ? '' : 'none';
  previewContrato();
}

function _onChangePgtoCaucao(){
  const pgto = document.getElementById('c-pgto-caucao')?.value||'';
  const isCard = pgto.toLowerCase().includes('cartão')||pgto.toLowerCase().includes('cartao');
  const wrap = document.getElementById('c-campos-cartao-caucao');
  if(wrap) wrap.style.display = isCard ? '' : 'none';
  previewContrato();
}

// ══ PAGAMENTO NO ATO — DIVIDIR EM 2 FORMAS ══
function _toggleDividirPagamento(){
  const checked = document.getElementById('c-dividir-pagamento')?.checked;
  const wrap = document.getElementById('c-pgto-split-wrap');
  if(wrap) wrap.style.display = checked ? '' : 'none';
  if(checked) _calcPgto2Restante();
  previewContrato();
}

function _calcPgto2Restante(){
  const valorAto = parseFloat(document.getElementById('c-valor-pago-ato')?.value)||0;
  const valor1   = parseFloat(document.getElementById('c-valor-pgto1')?.value)||0;
  const valor2El = document.getElementById('c-valor-pgto2');
  if(valor2El) valor2El.value = Math.max(0, valorAto - valor1).toFixed(2);
}

// ══ INICIAR ASSINATURA — registra contrato e envia para Autentique ══
async function _iniciarAssinaturaDigital(){
  // Verifica se o contrato já foi registrado (tem locacaoId na sessão)
  const d = previewContrato();
  if(!d){ notify('Preencha os dados do contrato primeiro','error'); return; }

  let locId = window._ultimoLocacaoId || null;

  if(!locId){
    // Registra o contrato primeiro para ter o ID
    notify('Registrando contrato antes de enviar para assinatura...','info');
    locId = await registrarContrato(true); // true = retornar ID
    if(!locId){ notify('Erro ao registrar contrato','error'); return; }
    window._ultimoLocacaoId = locId;
  }

  const numContrato = _peekNumContrato() || '?';
  await enviarParaAssinatura(numContrato, d, locId);
}
