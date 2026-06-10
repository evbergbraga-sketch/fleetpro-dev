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
  const parcelas   = parseInt(document.getElementById('c-cartao-parcelas')?.value)||1;
  const cartao4dig = document.getElementById('c-cartao-numero')?.value?.trim()||'';
  const cartaoBand = document.getElementById('c-cartao-bandeira')?.value||'';
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

  return {totalBruto, totalLiq, valorPago, pgtoCaucao, descricao, planoNome, nomeCli, cpfCli, telCli, pgtoLabel, parcelas, cartao4dig, cartaoBand,
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
  try{
    doc.addImage('data:image/png;base64,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', 'PNG', M, y, 35, 23);
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
  doc.text(`Contrato: ${d.pgtoLabel||d.pgto}  —  Valor: R$ ${(d.totalLiq||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`, M+cellPad, y+10);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(`Caução/Garantia: R$ ${(d.caucao||0).toFixed(2).replace('.',',')}  —  Pagamento: ${d.pgtoCaucao||d.pgto}`, M+cellPad, y+14);
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
  // ANEXO II — TABELA DE TARIFAS
  // ══════════════════════════════════════
  doc.addPage(); y = M;
  rect(M, y, CW, 7, '#006400', '#006400');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('ANEXO II — TABELA DE TARIFAS E ENCARGOS', PW/2, y+5, {align:'center'});
  y += 9;

  const tarifas = [
    ['Reboque/guincho por pane causada por mau uso (dentro da cidade)', 'A definir'],
    ['Reboque/guincho fora do município (por km excedente)', 'A definir'],
    ['Chave perdida / 2ª via de chave', 'A definir'],
    ['Recolhimento por inadimplência (dentro do município)', 'A definir'],
    ['Lucros cessantes por indisponibilidade culpa do locatário (por dia)', 'A definir'],
    ['Limpeza especial (retorno com sujeira excessiva)', 'A definir'],
    ['Taxa de ausência em manutenção agendada (no show)', 'A definir'],
    ['Taxa de cancelamento da penalidade NIC', 'A definir'],
    ['Custo operacional sobre multas de trânsito', '20% sobre a multa'],
    ['Desbloqueio após inadimplência (custo operacional)', 'A definir'],
    ['Desistência de retirada após pagamento de caução', 'A definir'],
  ];
  const tW1=148, tW2=CW-tW1;
  rect(M,y,tW1,6,'#e8f5e9','#006400'); rect(M+tW1,y,tW2,6,'#e8f5e9','#006400');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#004400');
  doc.text('SERVIÇO / EVENTO', M+2, y+4.2); doc.text('VALOR (R$)', M+tW1+2, y+4.2);
  y+=6;
  tarifas.forEach((r,ri)=>{
    rect(M,y,tW1,7,ri%2===0?'#fff':'#f9f9f9','#ddd');
    rect(M+tW1,y,tW2,7,ri%2===0?'#fff':'#f9f9f9','#ddd');
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#222');
    doc.text(r[0],M+2,y+4.5); doc.text(r[1],M+tW1+2,y+4.5);
    y+=7;
  });
  y+=3;
  const notaII = doc.splitTextToSize("* Os valores marcados como 'A definir' serão preenchidos pela LOCADORA conforme tarifário vigente e comunicados ao LOCATÁRIO na assinatura do contrato.", CW-4);
  const notaIIH = notaII.length * 3.8 + 5;
  rect(M, y, CW, notaIIH, '#f9f9f9', '#dddddd');
  doc.setFontSize(6.5); doc.setFont('helvetica','italic'); doc.setTextColor('#555');
  doc.text(notaII, M+2, y+4); y += notaIIH + 3;

  // ══════════════════════════════════════
  // ANEXO III — PLANO DE MANUTENÇÃO
  // ══════════════════════════════════════
  safeY(50);
  rect(M,y,CW,7,'#006400','#006400');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('ANEXO III — PLANO DE MANUTENÇÃO — REFERÊNCIA DO MANUAL',PW/2,y+5,{align:'center'});
  y+=9;
  const mW=[90,50,CW-140];
  const mHdr=['SERVIÇO PREVENTIVO','INTERVALO (KM)','INTERVALO (TEMPO)'];
  rect(M,y,CW,6,'#e8f5e9','#006400');
  let mcx=M; doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#004400');
  mHdr.forEach((h,i)=>{doc.text(h,mcx+2,y+4.2);mcx+=mW[i];});
  y+=6;
  [['Troca de óleo + filtro','Conforme manual','Conforme manual'],
   ['Inspeção de corrente e freios','Conforme manual','Conforme manual'],
   ['Filtro de ar / vela','Conforme manual','Conforme manual']].forEach((r,ri)=>{
    rect(M,y,CW,7,ri%2===0?'#fff':'#f9f9f9','#ddd');
    mcx=M; doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#222');
    r.forEach((v,i)=>{doc.text(v,mcx+2,y+4.5);mcx+=mW[i];});
    y+=7;
  });
  y+=3;
  const notaIII = doc.splitTextToSize('Observação: Os intervalos exatos serão preenchidos com os dados do manual do modelo específico da motocicleta locada. Para uso em delivery (uso severo), aplicar o intervalo reduzido quando o manual assim prever.',CW-4);
  const notaIIIH = notaIII.length * 3.8 + 5;
  rect(M, y, CW, notaIIIH, '#f9f9f9', '#dddddd');
  doc.setFontSize(6.5); doc.setFont('helvetica','italic'); doc.setTextColor('#555');
  doc.text(notaIII, M+2, y+4); y += notaIIIH + 4;

  // ══════════════════════════════════════
  // ANEXO IV — SEGURO SUHAI
  // ══════════════════════════════════════
  safeY(80);
  rect(M,y,CW,7,'#006400','#006400');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor('#ffffff');
  doc.text('ANEXO IV — CONDIÇÕES DE SEGURO — SUHAI SEGURADORA',PW/2,y+5,{align:'center'});
  y+=9;
  const seg=[
    ['Seguradora','Suhai Seguradora'],
    ['Coberturas contratadas','Roubo/Furto Total  |  Danos a Terceiros (RCF)'],
    ['Nº da apólice','A preencher'],
    ['Vigência','A preencher'],
    ['Franquia – Roubo/Furto','R$ __________ (conforme apólice)'],
    ['Franquia – Danos a Terceiros','R$ __________ (conforme apólice)'],
    ['Principais exclusões','Condutor não autorizado  /  Alcoolemia  /  Ausência de BO  /  Mau uso'],
    ['Prazo para comunicar sinistro','Imediato (telefone e WhatsApp da Royal)  +  BO em 48h'],
    ['Contato Suhai (sinistros)','0800 xxx-xxxx  (a preencher)'],
  ];
  const sW1=60, sW2=CW-sW1;
  rect(M,y,sW1,6,'#e8f5e9','#006400'); rect(M+sW1,y,sW2,6,'#e8f5e9','#006400');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor('#004400');
  doc.text('ITEM',M+2,y+4.2); doc.text('DESCRIÇÃO',M+sW1+2,y+4.2);
  y+=6;
  seg.forEach((r,ri)=>{
    const descLines = doc.splitTextToSize(r[1],sW2-4);
    const rh=Math.max(7,descLines.length*3.8+3);
    rect(M,y,sW1,rh,ri%2===0?'#fff':'#f9f9f9','#ddd');
    rect(M+sW1,y,sW2,rh,ri%2===0?'#fff':'#f9f9f9','#ddd');
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor('#333'); doc.text(r[0],M+2,y+4.5);
    doc.setFont('helvetica','normal'); doc.setTextColor('#222'); doc.text(descLines,M+sW1+2,y+4.5);
    y+=rh;
  });
  y+=4;
  const notaIV = doc.splitTextToSize('IMPORTANTE: Em caso de divergência entre este resumo e a apólice original da Suhai Seguradora, prevalece o documento original da apólice. O LOCATÁRIO declara ter recebido cópia da apólice e estar ciente de todas as condições.',CW-4);
  const notaIVH = notaIV.length * 4 + 6;
  safeY(notaIVH);
  rect(M, y, CW, notaIVH, '#fff5f5', '#ffcccc');
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor('#cc0000');
  doc.text(notaIV, M+2, y+4); y += notaIVH + 2;
  safeY(12);
  doc.setDrawColor('#555'); doc.line(M,y,M+100,y);
  doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  doc.text('LOCATÁRIO – declara ter recebido e lido as condições do seguro Suhai',M,y+4);
  y+=10;

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
