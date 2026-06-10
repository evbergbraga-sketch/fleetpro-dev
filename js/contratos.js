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
    // Carrega itens do checklist (await garante que estão prontos antes de coletar)
    await _carregarItensChecklistInline();
  }
}

async function _carregarItensChecklistInline(){
  const wrap = document.getElementById('ctchk-itens');
  if(!wrap) return;
  if(!sb){ wrap.innerHTML='<div style="color:var(--muted2);font-size:13px">Banco não conectado.</div>'; return; }
  const {data} = await sb.from('checklist_itens').select('*').eq('ativo',true).order('ordem');
  const itens = data||[];
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

  // PASSO 3: Registrar o contrato — retorna {locId, numContrato, d}
  const resultado = await registrarContrato(true);
  if(!resultado){ console.error('[chk] registrarContrato não retornou resultado'); return; }

  const { locId, numContrato, d } = resultado;
  console.log('[chk] locId:', locId, 'numContrato:', numContrato);

  // PASSO 4: Se não tem checklist, gera PDF simples e sai
  if(!temChecklist || !chk){
    notify('Contrato registrado! Gerando PDF...','success');
    await gerarPdfContrato(numContrato, d, null);
    return;
  }

  // PASSO 5: Upload de fotos para o Storage
  const fotosUrls = [];
  for(const f of fotosParaUpload){
    try{
      const ext = (f.name.split('.').pop()||'jpg').toLowerCase();
      const path = `contratos/${locId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const {error:upErr} = await sb.storage.from('checklists').upload(path, f);
      if(!upErr){
        const {data:signData} = await sb.storage.from('checklists').createSignedUrl(path, 60*60*24*365);
        if(signData?.signedUrl) fotosUrls.push(signData.signedUrl);
      }
    }catch(e){ console.warn('[chk] foto upload:', e.message); }
  }

  // PASSO 6: Montar payload e salvar checklist no banco
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
    // Mesmo com erro no checklist, gera o PDF com os dados coletados
  } else {
    console.log('[chk] SALVO com sucesso — id:', chkSalvo.id, 'locacao_id:', chkSalvo.locacao_id);
    notify('✅ Contrato + Checklist registrados!','success');
  }

  // PASSO 7: Gerar PDF com página de checklist
  await gerarPdfContrato(numContrato, d, chk);

  // PASSO 8: Recarregar dados DEPOIS de tudo concluído
  await carregarTudo();
}

// ══ NÚMERO DO CONTRATO ══
// Sincroniza o número do contrato com o banco (maior num_contrato + 1)
async function _sincronizarNumContrato(){
  try{
    const {data} = await sb.from('locacoes')
      .select('num_contrato')
      .order('num_contrato', {ascending:false})
      .limit(1)
      .single();
    const maiorNoBanco = parseInt(data?.num_contrato||'0');
    const noLocal      = parseInt(localStorage.getItem('fp_contrato_seq')||'0');
    const maior = Math.max(maiorNoBanco, noLocal);
    localStorage.setItem('fp_contrato_seq', String(maior));
    return maior;
  }catch(_){ return parseInt(localStorage.getItem('fp_contrato_seq')||'0'); }
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
    const aprovados = allClientes.filter(c=>!c.status_analise || c.status_analise === 'aprovado');
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
      periodoVal = Math.max(1, Math.ceil(diffMs / (7*24*3600*1000)));
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
    totalBruto = dia * periodoVal;
  } else {
    totalBruto = dia * days;
    const lavagem = parseFloat(document.getElementById('c-lavagem')?.value)||0;
    const protVal = document.getElementById('c-protecao')?.value==='Completa'
      ? parseFloat(document.getElementById('c-protecao-valor')?.value)||0 : 0;
    totalBruto += lavagem + protVal;
  }
  totalBruto += totalServicos;

  const valorPago = window._reservaValorPago||0;
  const totalLiq  = Math.max(0, totalBruto - valorPago);

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
  _set('ct-dia-val', `R$ ${dia.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
  _set('ct-servicos-total', totalServicos>0 ? `+ R$ ${totalServicos.toLocaleString('pt-BR',{minimumFractionDigits:2})} (serviços)` : '');
  _set('ct-total-bruto', `R$ ${totalBruto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
  _set('ct-total', `R$ ${totalLiq.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
  _set('ct-km', km);
  _set('ct-obs', obs||'Veículo em perfeito estado. Cliente responsável por multas.');
  _set('ct-caucao', `R$ ${caucao.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
  _set('ct-pgto', pgto);
  _set('ct-atendente', atendente);
  _set('ct-data', new Date().toLocaleDateString('pt-BR'));

  const avisoEl = document.getElementById('ct-aviso-reserva');
  if(avisoEl){
    avisoEl.style.display = valorPago>0 ? 'block' : 'none';
    if(valorPago>0) avisoEl.innerHTML = `⚠️ Valor já pago na reserva: <strong>R$ ${valorPago.toFixed(2).replace('.',',')}</strong> · Total ajustado: <strong>R$ ${totalLiq.toFixed(2).replace('.',',')}</strong>`;
  }

  return {totalBruto, totalLiq, valorPago, pgtoCaucao, descricao, planoNome, nomeCli, cpfCli, telCli, pgtoLabel, parcelas, cartao4dig, cartaoVal, cartaoBand, cartaoTitular, cartaoSalvar,
    emailCli, cnhCli, cnhValCli, cnhCatCli, endCli, nascCli,
    placa, modelo, atendente, diasLabel, dia, km, obs, condutor: todosCond[0].nome,
    condutorCpf: todosCond[0].cpf, todosCondutores: todosCond,
    pgto, caucao, numCtrato, periodoVal, ini, fim, localRet,
    totalServicos, servicos: _servicosLista, days};
}

function _fmtDatetime(str){
  if(!str) return '—';
  const d = new Date(str);
  if(isNaN(d)) return str;
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

function _set(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = val;
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

    const {data:locSalva, error} = await sb.from('locacoes').insert({
      veiculo_id:vid, cliente_id:cid,
      data_inicio: ini.slice(0,10),
      data_fim: fim.slice(0,10),
      data_inicio_hora: ini,
      data_fim_hora: fim,
      km_inicial:km,
      diaria:d.dia,
      total:d.totalLiq,
      observacoes:obs,
      tipo_contrato: _tipoContrato,
      num_contrato: numContrato,
      local_retirada: document.getElementById('c-local-ret')?.value||'Loja',
      caucao: d.caucao,
      forma_pgto: pgto,
      forma_pgto_caucao: d.pgtoCaucao||pgto,
      cartao_id: cartaoId,
      servicos_adicionais: _servicosLista.length>0 ? _servicosLista : null,
      condutor_cnh: condutorCnh||null,
      condutor_cnh_cat: condutorCnhCat||null,
      condutor_cnh_val: condutorCnhVal,
      plano_moto: planoMoto,
      criado_por: currentUser?.id
    }).select().single();
    if(error) throw error;

    await sb.from('veiculos').update({status:'alugado'}).eq('id',vid);
    // Lançamento financeiro automático
    if(typeof finRegistrarLancamentoLocacao==='function') finRegistrarLancamentoLocacao(locSalva).catch(()=>{});

    if(window._reservaOrigemId){
      await sb.from('reservas').update({status:'convertida'}).eq('id',window._reservaOrigemId);
      window._reservaOrigemId=null; window._reservaValorPago=0;
    }

    // Reset listas
    _condutoresLista = [];
    _servicosLista   = [];

    notify('Contrato #'+numContrato+' registrado!','success');

    // Se retornarId (chamado por registrarComChecklist), retorna IMEDIATAMENTE
    // para preservar o DOM do checklist (carregarTudo é chamado depois pelo caller)
    if(retornarId){
      if(btn){ btn.disabled=false; btn.textContent='📄 Registrar e gerar contrato'; }
      return { locId: locSalva.id, numContrato, d };
    }

    // Gera PDF normal (sem checklist)
    setTimeout(()=> gerarPdfContrato(numContrato, d), 500);
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

    // WhatsApp resumo
    const c = allClientes.find(x=>x.id===cid);
    const v = allVeiculos.find(x=>x.id===vid);
    if(c?.telefone){
      const txt = _msgWppContrato(numContrato, c, v, d);
      try{
        await evoSendText(c.telefone, txt);
        await salvarMsgDB(cid, c.telefone, txt, 'text', 'saida', null);
        notify('Resumo enviado pelo WhatsApp ✓','success');
      }catch(e){ console.warn('WPP:', e.message); }
    }
  }catch(e){
    notify('Erro: '+e.message,'error');
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
  if(d.valorPago>0) txt += `✂️ *Abatimento reserva:* - R$ ${d.valorPago.toFixed(2).replace('.',',')}\n`;
  txt += `💳 *Total:* R$ ${d.totalLiq.toFixed(2).replace('.',',')}\n`;
  txt += `\n✅ Contrato registrado. O PDF completo será enviado em seguida.\n_Equipe Locadora Royal 🚗🏍️_`;
  return txt;
}

// ══ BAIXAR PDF SEM REGISTRAR ══
function _baixarPdfSemRegistrar(){
  const d = previewContrato();
  gerarPdfContrato(_peekNumContrato(), d);
}

// ══ GERAR PDF ══

async function gerarPdfContrato(numContrato, d, checklist=null){
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
  doc.addImage(base64, 'PNG', M, y, 35, 23);
}catch(_){}

  // Dados da empresa (topo direito do logo)
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text('ROYAL RENT A CAR LTDA', M+42, y+7);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  doc.text('CNPJ: 18.686.521/0002-90', M+42, y+12);
  doc.text('Tel: (21) 96894-9627  |  sac@locadoraroyal.com.br', M+42, y+17);

  // Número e status do contrato (topo direito)
  const planoTitulo = d.planoNome?.includes('Conquista') ? 'CONTRATO CONQUISTA#' : 'CONTRATO MASTER#';
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
  const vCols = [45,18,26,25,22,18,26];
  const vHeaders = ['Veículo','Franquia Km','Valor Locação','Valor Km Excedente','Data Entrega','Km Saída','Data Término'];

  rect(M, y, CW, 6, '#006400', '#006400');
  let cx = M;
  doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  vHeaders.forEach((h,i)=>{ doc.text(h,cx+1.5,y+4.2); cx+=vCols[i]; });
  y += 6;

  const franqKm  = document.getElementById('c-franquia-km')?.value||'0';
  const kmExced  = (parseFloat(document.getElementById('c-km-excedente')?.value)||0).toFixed(2).replace('.',',');
  const planoLabel = d.planoNome ? d.planoNome.split('—')[0].trim() : '';
  const veiLabel = `${d.placa} - ${d.modelo}${planoLabel?' | '+planoLabel:''}`;

  rect(M, y, CW, 8, '#f0f8f0', '#ccddcc');
  cx = M;
  const vRow = [
    veiLabel,
    franqKm+' km',
    `R$ ${(d.dia||0).toFixed(2).replace('.',',')}`,
    `R$ ${kmExced}/km`,
    d.ini ? d.ini.slice(0,10).split('-').reverse().join('/') : '—',
    String(d.km||0)+' km',
    d.fim ? d.fim.slice(0,10).split('-').reverse().join('/') : '—',
  ];
  doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#111');
  vRow.forEach((v,i)=>{
    const trunc = doc.splitTextToSize(v, vCols[i]-3);
    doc.text(trunc[0]||'', cx+1.5, y+5);
    cx+=vCols[i];
  });
  y += 10;

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
  rect(M, y, CW, 14, '#f0f8f0', '#a8d8a8');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text('FORMA DE PAGAMENTO', M+cellPad, y+5);
  doc.setFont('helvetica','bold'); doc.setTextColor('#111');
  doc.setFontSize(8);
  doc.text(`Contrato: ${d.pgtoLabel||d.pgto}  —  Valor: R$ ${(d.totalLiq||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`, M+cellPad, y+9);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(`Caução/Garantia: R$ ${(d.caucao||0).toFixed(2).replace('.',',')}  —  Pagamento: ${d.pgtoCaucao||d.pgto}`, M+cellPad, y+12);
  y += 17;

  // ══════════════════════════════════════
  // OBSERVAÇÕES IMPORTANTES (da minuta)
  // ══════════════════════════════════════
  safeY(18);
  rect(M, y, CW, 6, '#006400', '#006400');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('OBSERVAÇÕES IMPORTANTES', M+cellPad, y+4.2);
  y += 6;
  const obsImp = 'A renovação do contrato se dar de forma semanal (a cada 7 dias).\nNecessário informar a cada 1.000km do veículo, para que seja verificado o cronograma de manutenção preventiva. Entre em contato com a Locadora.';
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
  rect(M, y, CW, 6, '#006400', '#006400');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('TERMOS E CONDIÇÕES', M+cellPad, y+4.2);
  y += 8;

  // Texto completo das cláusulas (fiel à minuta)
  const clausulas = [
    {num:'1. DEFINIÇÕES', secao:true},
    {num:'1.1', txt:'Motocicleta: veículo descrito na Cláusula 2, com todos os acessórios e itens em perfeito estado de uso e conservação (confirme laudo de vistoria).'},
    {num:'1.2', txt:'Obrigação da LOCADORA — serviços periódicos previstos no Manual do Fabricante (revisões programadas, trocas periódicas e inspeções), conforme Cláusula 8. Manutenção Preventiva.'},
    {num:'1.3', txt:'Obrigação do LOCATÁRIO — reparos decorrentes de falha, quebra, impacto, colisão, queda, mau uso, negligência ou qualquer evento não enquadrado como Manutenção Preventiva. "Manutenção Corretiva/Danos."'},
    {num:'1.4', txt:'Semana de Locação: período de 7 (sete) dias corridos contados da data de início, vencendo as seguintes sempre no mesmo dia da semana, independente da data do efetivo pagamento.'},
    {num:'1.5', txt:'Caução: valor de garantia de R$ 600,00 (seiscentos reais), descrito na Cláusula 5.'},
    {num:'1.6', txt:'Seguro Suhai: proteção contratada junto à seguradora Suhai, cobrindo roubo/furto e danos a terceiros, conforme condições no Anexo IV.'},
    {num:'2. OBJETO', secao:true},
    {num:'2.1', txt:'O presente contrato tem por objeto a locação da motocicleta mencionada acima para uso exclusivo em atividade de delivery e deslocamentos compatíveis.'},
    {num:'2.2', txt:'A locação é sem transferência de propriedade, sendo a posse exercida pelo LOCATÁRIO de natureza precária, temporária e resolúvel, não gerando direito de retenção, indenização ou qualquer direito real sobre o bem.'},
    {num:'3. PRAZO', secao:true},
    {num:'3.1', txt:'O contrato é firmado por prazo indeterminado, com pagamento semanal, iniciando na data de retirada da motocicleta.'},
    {num:'3.2', txt:'Cada semana locada corresponde a 7 (sete) dias corridos. A renovação é automática enquanto houver adimplência.'},
    {num:'3.3', txt:'Para encerrar o contrato, qualquer das partes deverá comunicar a outra com antecedência mínima de 48 (quarenta e oito) horas, conforme Cláusula 15.'},
    {num:'4. PREÇO, PAGAMENTO E ENCARGOS', secao:true},
    {num:'4.1', txt:'O LOCATÁRIO pagará à LOCADORA o valor semanal definido no plano contratado, com vencimento sempre no mesmo dia da semana em que foi firmado o contrato, por PIX, cartão ou boleto.'},
    {num:'4.2', txt:'O pagamento é ANTECIPADO: deve ser efetuado antes do início de cada semana. A inadimplência autoriza a LOCADORA a bloquear e recolher a motocicleta sem necessidade de aviso adicional.'},
    {num:'4.3', txt:'Encargos por atraso:'},
    {bullet:true, txt:'Multa de 5% (cinco por cento) sobre o valor semanal em atraso;'},
    {bullet:true, txt:'Juros de 1% (um por cento) ao mês, calculados pro rata die a partir do primeiro dia de atraso;'},
    {bullet:true, txt:'Correção monetária pelo IPCA/IBGE acumulado no período.'},
    {num:'4.4', txt:'O não pagamento de qualquer valor devido até o prazo de 2 (dois) dias corridos após o vencimento caracterizará mora automática, considerando-se o contrato rescindido de pleno direito, independentemente de aviso prévio. A LOCADORA fica autorizada a promover, de imediato, o bloqueio, a retomada e o recolhimento da motocicleta.'},
    {num:'4.5', txt:'O valor semanal poderá ser reajustado pela variação positiva do IPCA/IBGE nos contratos com mais de 12 (doze) meses de duração, mediante comunicação com 15 dias de antecedência.'},
    {num:'5. CAUÇÃO', secao:true},
    {num:'5.1', txt:'O LOCATÁRIO pagará caução de R$ 600,00 (seiscentos reais) no ato da assinatura deste contrato, por PIX ou depósito bancário.'},
    {num:'5.2', txt:'A caução poderá ser utilizada pela LOCADORA para quitar débitos do LOCATÁRIO, incluindo aluguéis em atraso, multas, danos, franquias do seguro e tarifas operacionais.'},
    {num:'5.3', txt:'A caução NÃO substitui e NÃO cobre automaticamente danos ao veículo; o saldo devedor eventualmente superior a R$ 600,00 será cobrado separadamente.'},
    {num:'5.4', txt:'Não havendo pendências, a caução será devolvida em até 10 (dez) dias úteis após a devolução e conferência final da motocicleta.'},
    {num:'5.5', txt:'Se a caução for utilizada parcialmente, o LOCATÁRIO deverá complementá-la ao valor original em até 5 (cinco) dias úteis após notificação.'},
    {num:'6. ENTREGA, VISTORIA E DEVOLUÇÃO', secao:true},
    {num:'6.1', txt:'A motocicleta será entregue mediante assinatura do ANEXO I – Termo de Entrega e Vistoria, com registro fotográfico e checklist.'},
    {num:'6.2', txt:'A devolução ocorrerá na sede da LOCADORA (Av. das Américas, 12.900 – Barra da Tijuca, RJ), em dia útil e horário comercial, nas mesmas condições de conservação, ressalvado o desgaste normal.'},
    {num:'6.3', txt:'Na devolução será realizada vistoria presencial. Constatados danos, será emitido relatório e orçamento, aplicando-se a Cláusula 9.'},
    {num:'6.4', txt:'A devolução fora da sede ou em outra localidade somente será aceita com autorização prévia e escrita da LOCADORA, podendo incidir taxa conforme Anexo II.'},
    {num:'7. REQUISITOS E CONDUTOR AUTORIZADO', secao:true},
    {num:'7.1', txt:'Somente o LOCATÁRIO identificado neste contrato poderá conduzir a motocicleta. É PROIBIDO emprestar, ceder ou sublocar o veículo a terceiros, salvo autorização escrita da LOCADORA.'},
    {num:'7.2', txt:'O LOCATÁRIO declara possuir CNH categoria A válida, sem suspensão ou cassação, e experiência adequada para condução de motocicleta em ambiente urbano.'},
    {num:'7.3', txt:'O descumprimento desta cláusula enseja rescisão imediata e responsabilidade integral por todos os danos e custos decorrentes.'},
    {num:'7.4', txt:'O LOCATÁRIO deverá possuir ou alugar garagem fechada e segura para guardar o veículo fora dos períodos de uso.'},
    {num:'8. MANUTENÇÃO PREVENTIVA – RESPONSABILIDADE DA LOCADORA', secao:true},
    {num:'8.1', txt:'A LOCADORA realizará a manutenção preventiva da motocicleta conforme o Manual do Fabricante, incluindo o plano de uso severo quando aplicável ao perfil de delivery.'},
    {num:'8.2', txt:'São serviços preventivos, exemplificativamente:'},
    {bullet:true, txt:'Trocas de óleo do motor e filtro nos intervalos do manual;'},
    {bullet:true, txt:'Inspeções e ajustes periódicos previstos (corrente, pneus, freios, faróis);'},
    {bullet:true, txt:'Substituições periódicas de vela, filtro de ar, filtro de combustível (quando aplicável);'},
    {bullet:true, txt:'Demais itens do cronograma de revisões do fabricante.'},
    {num:'8.3', txt:'Agendamento obrigatório: o LOCATÁRIO deve agendar a preventiva via WhatsApp ou aplicativo da LOCADORA com antecedência mínima de 5 (cinco) dias.'},
    {num:'8.4', txt:'Intervalo máximo: o LOCATÁRIO compromete-se a não exceder o limite de km/tempo definido no Manual do Fabricante para cada serviço preventivo.'},
    {num:'8.5', txt:'Caso o LOCATÁRIO exceda o intervalo do manual por omissão ou atraso, e disso resultar desgaste anormal ou dano, o evento será considerado Manutenção Corretiva (Cláusula 9).'},
    {num:'8.6', txt:'A preventiva será realizada EXCLUSIVAMENTE na LOCADORA ou em oficina por ela indicada. É VEDADO ao LOCATÁRIO realizar reparos ou revisões por conta própria sem autorização escrita.'},
    {num:'8.7', txt:'Não comparecimento: o LOCATÁRIO que não comparecer à manutenção agendada estará sujeito à Taxa de Ausência (Anexo II), ao bloqueio do veículo e à rescisão contratual.'},
    {num:'9. RESPONSABILIDADE DO LOCATÁRIO – MANUTENÇÃO CORRETIVA E DANOS', secao:true},
    {num:'9.1', txt:'Qualquer evento FORA da manutenção preventiva prevista no Manual do Fabricante é de responsabilidade exclusiva do LOCATÁRIO, incluindo:'},
    {bullet:true, txt:'Danos por queda, colisão, impacto, enchente ou qualquer sinistro;'},
    {bullet:true, txt:'Quebras por mau uso, negligência, condução agressiva, sobrecarga ou adaptação irregular;'},
    {bullet:true, txt:'Danos por rodar com nível baixo de óleo, vazamentos não comunicados ou superaquecimento ignorado;'},
    {bullet:true, txt:'Avarias estéticas (riscos, carenagem, retrovisores, manetes), pneu rasgado por buraco, roda empenada;'},
    {bullet:true, txt:'Custos de reboque/guincho por pane causada por mau uso ou negligência;'},
    {bullet:true, txt:'Instalação/remoção de acessórios sem autorização (escape, modificações elétricas, alterações de relação etc.).'},
    {num:'9.2', txt:'Cuidados operacionais diários obrigatórios do LOCATÁRIO:'},
    {bullet:true, txt:'Verificar diariamente nível de óleo, pressão e calibragem dos pneus, corrente/relação e freios;'},
    {bullet:true, txt:'Comunicar IMEDIATAMENTE qualquer anormalidade (vazamento, fumaça, ruído, falha, luz de painel acesa);'},
    {bullet:true, txt:'Cessar o uso se houver risco de dano mecânico e acionar a LOCADORA antes de continuar.'},
    {num:'9.3', txt:'O LOCATÁRIO autoriza a LOCADORA a realizar orçamento e reparo de qualquer dano fora da preventiva, cobrando o custo de peças, mão de obra e demais despesas, podendo descontar da caução.'},
    {num:'9.4', txt:'Lucros cessantes: se a motocicleta ficar indisponível por culpa do LOCATÁRIO (sinistro, mau uso, atraso na devolução), será cobrado valor diário conforme Anexo II, por até 30 (trinta) dias.'},
    {num:'10. SEGURO / PROTEÇÃO – SUHAI SEGURADORA', secao:true},
    {num:'10.1', txt:'A motocicleta conta com proteção junto à Suhai Seguradora, com cobertura de:'},
    {bullet:true, txt:'Roubo e furto total;'},
    {bullet:true, txt:'Danos a terceiros (responsabilidade civil).'},
    {num:'10.2', txt:'As condições completas, coberturas, exclusões e franquias constam no ANEXO IV – Condições do Seguro Suhai, que integra este contrato.'},
    {num:'10.3', txt:'Em caso de sinistro coberto pelo seguro, o LOCATÁRIO será responsável pelo pagamento da franquia/participação obrigatória conforme apólice Suhai.'},
    {num:'10.4', txt:'A cobertura do seguro NÃO se aplica quando o sinistro decorrer de:'},
    {bullet:true, txt:'Condução sob efeito de álcool ou substâncias psicoativas;'},
    {bullet:true, txt:'Condutor não autorizado (terceiro que não seja o LOCATÁRIO identificado no contrato);'},
    {bullet:true, txt:'Mau uso, participação em rachas ou manobras proibidas;'},
    {bullet:true, txt:'Ausência de registro de Boletim de Ocorrência no prazo exigido;'},
    {bullet:true, txt:'Quaisquer outras exclusões previstas na apólice Suhai.'},
    {num:'10.5', txt:'Nos casos de exclusão da cobertura, a responsabilidade recai integralmente sobre o LOCATÁRIO, conforme Cláusula 9.'},
    {num:'11. USO PERMITIDO, LIMITAÇÕES E PROIBIÇÕES', secao:true},
    {num:'11.1', txt:'É PROIBIDO ao LOCATÁRIO:'},
    {bullet:true, txt:'Conduzir sob efeito de álcool, narcóticos ou qualquer substância psicoativa;'},
    {bullet:true, txt:'Participar de corrida, racha, manobras ou provas de velocidade;'},
    {bullet:true, txt:'Transportar carga acima do limite estabelecido pelo fabricante;'},
    {bullet:true, txt:'Adulterar hodômetro, lacres, rastreador ou placa;'},
    {bullet:true, txt:'Sublocar, emprestar ou ceder o veículo a terceiros;'},
    {bullet:true, txt:'Trafegar em dunas, praias, minerações ou submergir o veículo em água;'},
    {bullet:true, txt:'Usar o veículo fora do estado do Rio de Janeiro sem autorização prévia escrita;'},
    {bullet:true, txt:'Circular com o veículo em um raio inferior a 150 km de fronteiras internacionais;'},
    {bullet:true, txt:'Modificar, remover ou instalar acessórios sem autorização (escapamento, sistema elétrico, guidão, adesivos etc.).'},
    {num:'11.2', txt:'O LOCATÁRIO é responsável por: combustível, lavagem/limpeza comum e conservação diária da motocicleta.'},
    {num:'11.3', txt:'O veículo possui rastreador/telemetria para fins de segurança patrimonial e recuperação em caso de sinistro. O LOCATÁRIO declara ciência e concordância com o monitoramento e eventual bloqueio remoto do veículo.'},
    {num:'12. MULTAS E INFRAÇÕES DE TRÂNSITO', secao:true},
    {num:'12.1', txt:'O LOCATÁRIO é integralmente responsável por multas, taxas, remoção ao pátio e demais penalidades decorrentes de sua conduta, durante toda a vigência do contrato.'},
    {num:'12.2', txt:'O LOCATÁRIO autoriza a LOCADORA a indicá-lo como condutor infrator perante os órgãos de trânsito, nos termos do art. 257 do CTB.'},
    {num:'12.3', txt:'Sobre o valor de cada multa será acrescido 20% (vinte por cento) a título de custo operacional da LOCADORA.'},
    {num:'12.4', txt:'Caso o LOCATÁRIO opte por não ser indicado (NIC), arcará com o valor da penalidade NIC, conforme Tarifário vigente (Anexo II).'},
    {num:'13. SINISTROS, FURTO E PROVIDÊNCIAS OBRIGATÓRIAS', secao:true},
    {num:'13.1', txt:'Em caso de acidente, furto, roubo ou qualquer sinistro, o LOCATÁRIO deverá:'},
    {bullet:true, txt:'Comunicar a LOCADORA IMEDIATAMENTE pelo WhatsApp/telefone;'},
    {bullet:true, txt:'Registrar Boletim de Ocorrência em até 48 (quarenta e oito) horas;'},
    {bullet:true, txt:'Enviar fotos, local, horário, dados de terceiros e todos os documentos solicitados;'},
    {bullet:true, txt:'Providenciar laudo pericial ou protocolo quando houver vítima fatal.'},
    {num:'13.2', txt:'O não cumprimento das providências acima no prazo estabelecido poderá implicar perda da cobertura securitária e responsabilidade integral do LOCATÁRIO pelos danos.'},
    {num:'13.3', txt:'A LOCADORA poderá acionar a seguradora Suhai para sinistros cobertos pela apólice, cabendo ao LOCATÁRIO pagar a franquia correspondente.'},
    {num:'14. RESCISÃO E POLÍTICA DE ENCERRAMENTO', secao:true},
    {num:'14.1', txt:'Rescisão pelo LOCATÁRIO: deverá comunicar a LOCADORA com antecedência mínima de 48 (quarenta e oito) horas, devolver a motocicleta na sede em dia útil e quitar todos os débitos pendentes. Não haverá devolução de valor proporcional da semana em curso.'},
    {num:'14.2', txt:'Rescisão pela LOCADORA: a LOCADORA poderá rescindir o contrato IMEDIATAMENTE, sem necessidade de aviso prévio, nas seguintes hipóteses:'},
    {bullet:true, txt:'Inadimplência de 2 (dois) ou mais dias após o vencimento semanal;'},
    {bullet:true, txt:'Qualquer hipótese de mau uso descrita na Cláusula 11.1;'},
    {bullet:true, txt:'Não comparecimento à manutenção preventiva agendada;'},
    {bullet:true, txt:'Condutor não autorizado ao volante;'},
    {bullet:true, txt:'Adulteração de hodômetro, lacres, rastreador ou placa;'},
    {bullet:true, txt:'Ocorrência de sinistro não comunicado;'},
    {bullet:true, txt:'Comportamento ofensivo, ameaças ou exaltações perante funcionários ou parceiros da LOCADORA.'},
    {num:'14.3', txt:'Em caso de rescisão por culpa do LOCATÁRIO, serão aplicadas as penalidades previstas no Anexo II, além da perda da caução para cobertura de débitos.'},
    {num:'14.4', txt:'O veículo não poderá ser retido pelo LOCATÁRIO após a rescisão contratual, sob qualquer justificativa. A retenção indevida do bem poderá caracterizar, em tese, o crime de apropriação indébita (art. 168 do CP). Fica desde já autorizada a LOCADORA a proceder ao bloqueio remoto, à retomada e ao recolhimento do veículo.'},
    {num:'14.5', txt:'Nos contratos com plano pré-pago de mais de 4 (quatro) semanas, a rescisão antecipada por iniciativa do LOCATÁRIO implicará multa de 30% sobre o saldo de semanas restantes.'},
    {num:'15. REEMBOLSO E ACERTO FINAL', secao:true},
    {num:'15.1', txt:'Após rescisão e devolução do veículo, a LOCADORA apurará todos os créditos e débitos do LOCATÁRIO.'},
    {num:'15.2', txt:'Havendo saldo a favor do LOCATÁRIO após quitação integral de débitos, o reembolso ocorrerá em até 15 (quinze) dias úteis.'},
    {num:'15.3', txt:'Havendo saldo devedor do LOCATÁRIO após aplicação da caução, o valor será cobrado pelos meios disponíveis, constituindo o presente instrumento título executivo extrajudicial. O LOCATÁRIO autoriza a negativação de seu nome junto aos órgãos de proteção ao crédito (SPC, Serasa) em caso de inadimplemento.'},
    {num:'16. TRATAMENTO DE DADOS PESSOAIS – LGPD', secao:true},
    {num:'16.1', txt:'A LOCADORA trata os dados pessoais do LOCATÁRIO na posição de controladora, nos termos da Lei nº 13.709/2018 (LGPD), para fins de execução deste contrato, prevenção a fraudes e segurança patrimonial.'},
    {num:'16.2', txt:'Os dados poderão ser compartilhados com: oficinas parceiras, seguradora Suhai, órgãos de trânsito e autoridades competentes.'},
    {num:'16.3', txt:'O LOCATÁRIO autoriza a coleta de imagem (fotos, câmeras da sede) e dados de telemetria/rastreamento para fins de segurança patrimonial e recuperação do veículo em caso de sinistro.'},
    {num:'16.4', txt:'O LOCATÁRIO autoriza expressamente a LOCADORA a realizar consulta de dados cadastrais e financeiros junto a bureaus de crédito, para fins de análise de risco.'},
    {num:'17. DISPOSIÇÕES GERAIS', secao:true},
    {num:'17.1', txt:'Os ANEXOS I, II, III e IV integram este contrato para todos os fins de direito.'},
    {num:'17.2', txt:'A assinatura eletrônica/digital tem plena validade jurídica, conforme MP 2.200/2001.'},
    {num:'17.3', txt:'A tolerância de qualquer das partes não implica renúncia de direitos.'},
    {num:'17.4', txt:'Se qualquer cláusula for declarada nula, as demais permanecerão válidas e eficazes.'},
    {num:'17.5', txt:'Este contrato substitui quaisquer acordos verbais ou escritos anteriores entre as partes.'},
    {num:'17.6', txt:'O presente instrumento constitui título executivo extrajudicial nos termos do art. 784 do CPC.'},
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
  safeY(40);
  y += 6;
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
  const totalPgs = doc.getNumberOfPages();
  for(let p=1; p<=totalPgs; p++){
    doc.setPage(p);
    doc.setFillColor('#006400'); doc.rect(0,287,PW,10,'F');
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor('#ffffff');
    doc.text(`Locadora Royal — Contrato #${numContrato} — ${d.nomeCli||''} — Página ${p} de ${totalPgs}`, PW/2, 293, {align:'center'});
  }

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
    y = Math.max(y+10, 252);
    doc.setDrawColor('#aaaaaa'); doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.5,1.5],0);
    doc.line(M,y,M+80,y); doc.line(PW-M-80,y,PW-M,y);
    doc.setLineDashPattern([],0);
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#555');
    doc.text('Assinatura do Consultor',M+2,y+4);
    doc.text('Assinatura do Cliente / Condutor',PW-M-78,y+4);

    // Rodapé das páginas do checklist
    const totalPgs2 = doc.getNumberOfPages();
    for(let p=totalPgs+1; p<=totalPgs2; p++){
      doc.setPage(p);
      doc.setFillColor('#006400'); doc.rect(0,287,PW,10,'F');
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor('#ffffff');
      doc.text(`Locadora Royal — Contrato #${numContrato} — Checklist de Vistoria — Página ${p} de ${totalPgs2}`, PW/2, 293, {align:'center'});
    }
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
    for(let d=new Date(l.data_inicio);d<=new Date(l.data_fim);d.setDate(d.getDate()+1)){
      if(d.getFullYear()===calYear&&d.getMonth()===calMonth){
        const k=d.getDate(); if(!busy[k]) busy[k]=[]; busy[k].push(l.veiculos?.tipo||'carro');
      }
    }
  });
  allReservas.filter(r=>r.status==='ativa').forEach(r=>{
    for(let d=new Date(r.data_inicio);d<=new Date(r.data_fim);d.setDate(d.getDate()+1)){
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
  const resIds=allReservas.filter(r=>r.status==='ativa'&&r.data_inicio?.slice(0,10)<=ds&&r.data_fim?.slice(0,10)>=ds).map(r=>r.veiculo_id);
  document.getElementById('cal-veic-list').innerHTML=allVeiculos.map(v=>{
    const b=v.status==='manutencao'?'badge-yellow':locIds.includes(v.id)?'badge-red':resIds.includes(v.id)?'badge-blue':'badge-green';
    const lb=v.status==='manutencao'?'Manutenção':locIds.includes(v.id)?'Alugado':resIds.includes(v.id)?'Reservado':'Disponível';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px"><div class="vi ${v.tipo==='carro'?'vi-car':'vi-moto'}">${v.tipo==='carro'?'🚗':'🏍️'}</div><div><div style="font-size:13px;font-weight:500">${v.marca} ${v.modelo}</div><div style="font-size:11px;color:var(--muted)">${v.placa}</div></div></div><span class="badge ${b}">${lb}</span></div>`;
  }).join('')||'<p style="color:var(--muted2)">Sem veículos.</p>';
}

// ── PLANOS DE MOTO — CONTRATO ──
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
  if(cDia){ cDia.value = val; previewContrato(); }
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
