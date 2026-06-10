// contratos.js — Contratos, calendário e geração de PDF

// ══ LOGO BASE64 ══
const ROYAL_LOGO_B64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIbGNtcwIQAABtbnRyUkdCIFhZWiAH4gADABQACQAOAB1hY3NwTVNGVAAAAABzYXdzY3RybAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWhhbmSdkQA9QICwPUB0LIGepSKOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAABxjcHJ0AAABDAAAAAx3dHB0AAABGAAAABRyWFlaAAABLAAAABRnWFlaAAABQAAAABRiWFlaAAABVAAAABRyVFJDAAABaAAAAGBnVFJDAAABaAAAAGBiVFJDAAABaAAAAGBkZXNjAAAAAAAAAAV1UkdCAAAAAAAAAAAAAAAAdGV4dAAAAABDQzAAWFlaIAAAAAAAAPNUAAEAAAABFslYWVogAAAAAAAAb6AAADjyAAADj1hZWiAAAAAAAABilgAAt4kAABjaWFlaIAAAAAAAACSgAAAPhQAAtsRjdXJ2AAAAAAAAACoAAAB8APgBnAJ1A4MEyQZOCBIKGAxiDvQRzxT2GGocLiBDJKwpai5+M+s5sz/WRldNNlR2XBdkHWyGdVZ+jYgskjacq6eMstu+mcrH12Xkd/H5////2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAH0AfQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7LooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBO1FJnArjNV8dxQ3VxbaRpN3qxtm23EkRVI4z3AZjyfYZrmxGLpYaPNVlZFwpyqO0Vc7IcU4dK5jwb4y0vxMJorYS215BjzbacAOvuMHBHv/ACrph0q6NaFaCnTd0xThKDtJWY6iiitiQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiijIoAKKKKACkwMVTu9T020mWK6v7WCRvupJMqk/QE1aUhhkHI9ulRGcZOyewNNK5X1JZX064S2O2YxMIz6Ng4/Wvm/w941fR9Bk0ZojDcRM6zIwwwbJznPfNfTJr5w+L9lZ6h8S9Qe2gjQW9vFFMUAG+QgsScdTggfhXyfFlGLoRquVraHrZTJOo4NXuHwUuLzVPiot1ahjDFbv9pcdADjAPbOa+kK8k/Zt+ywaHqdgsMaXUF0TIwADMpGVz3I4xXrfWvT4foxpYKPK73MMxnzV3psLxScVFPNFBEZJpEiRRks5AAHuT0ptndW13H5lrcQzp03RuGH5ivZ5435b6nDZ2uWKKKKsQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQ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Dj/oQfC3/gog/wDiKz/s99zL+zH/ADH5r7jRuNfpR/wrL4cf9CD4W/8ABRB/8RR/wrL4cf8AQg+Fv/BRB/8AEUf2e+4f2Y/5j818mjJr9KP+FZfDj/oQfC3/AIKIP/iKF+Gnw6U5XwF4XUjoRpMA/wDZKP7PfcP7Mf8AMfmvk11XhD4eeN/FsyR6D4a1C6R8fvzEY4QPUyPhB+eTjjNfopYeGvDunlTYaFplqV6eTaomPpgcVq9OgxVxwC6suOWL7TPEP2ffgRY+AHTX9flh1LxGykKyDMNoCMER5GS2ONxx1IAHJPuGKM+tGOK7qdNQVoo9KnTjTVoi0UUVZoFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/9k=';

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
  const tipoV = _tipoContrato||'moto';
  const {data} = await sb.from('checklist_itens')
    .select('*')
    .eq('ativo',true)
    .in('tipo_veiculo',[tipoV,'ambos'])
    .order('ordem');
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

  return {totalBruto, totalLiq, valorPago, pgtoCaucao, descricao, planoNome, nomeCli, cpfCli, telCli,
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

  // Logo Royal (topo esquerdo) — base64 embedded
  try{
    doc.addImage('data:image/png;base64,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', 'JPEG', M, y, 30, 16);
  }catch(_){}

  // Dados da empresa (topo direito do logo)
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text('ROYAL RENT A CAR LTDA', M+34, y+6);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor('#333');
  doc.text('CNPJ: 18.686.521/0002-90', M+34, y+11);
  doc.text('Tel: (21) 96894-9627  |  sac@locadoraroyal.com.br', M+34, y+15.5);

  // Número e status do contrato (topo direito)
  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor('#006400');
  doc.text(`CONTRATO MASTER#${numContrato}`, PW-M, y+5, {align:'right'});
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
  doc.text(`Contrato: ${d.pgto}  —  Valor: R$ ${(d.totalLiq||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`, M+cellPad, y+10);
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
function _termosMoto(){
  return `TERMOS E CONDIÇÕES

1. DEFINIÇÕES
1.1 Motocicleta: veículo descrito na Cláusula 2, com todos os acessórios e itens em perfeito estado de uso e conservação (confirme laudo de vistoria).
1.2 Obrigação da LOCADORA: serviços periódicos previstos no Manual do Fabricante (revisões programadas, trocas periódicas e inspeções), conforme Cláusula 8. Manutenção Preventiva.
1.3 Obrigação do LOCATÁRIO: reparos decorrentes de falha, quebra, impacto, colisão, queda, mau uso, negligência ou qualquer evento não enquadrado como Manutenção Preventiva. "Manutenção Corretiva/Danos."
1.4 Semana de Locação: período de 7 (sete) dias corridos contados da data de início, vencendo as seguintes sempre no mesmo dia da semana, independente da data do efetivo pagamento.
1.5 Caução: valor de garantia de R$ 600,00 (seiscentos reais), descrito na Cláusula 5.
1.6 Seguro Suhai: proteção contratada junto à seguradora Suhai, cobrindo roubo/furto e danos a terceiros, conforme condições no Anexo IV.

2. OBJETO
2.1 O presente contrato tem por objeto a locação da motocicleta mencionada acima para uso exclusivo em atividade de delivery e deslocamentos compatíveis.
2.2 A locação é sem transferência de propriedade, sendo a posse exercida pelo LOCATÁRIO de natureza precária, temporária e resolúvel, não gerando direito de retenção, indenização ou qualquer direito real sobre o bem.

3. PRAZO
3.1 O contrato é firmado por prazo indeterminado, com pagamento semanal, iniciando na data de retirada da motocicleta.
3.2 Cada semana locada corresponde a 7 (sete) dias corridos. A renovação é automática enquanto houver adimplência.
3.3 Para encerrar o contrato, qualquer das partes deverá comunicar a outra com antecedência mínima de 48 (quarenta e oito) horas, conforme Cláusula 15.

4. PREÇO, PAGAMENTO E ENCARGOS
4.1 O LOCATÁRIO pagará à LOCADORA o valor semanal definido no plano contratado, com vencimento sempre no mesmo dia da semana em que foi firmado o contrato, por PIX, cartão ou boleto.
4.2 O pagamento é ANTECIPADO: deve ser efetuado antes do início de cada semana. A inadimplência autoriza a LOCADORA a bloquear e recolher a motocicleta sem necessidade de aviso adicional.
4.3 Encargos por atraso: Multa de 5% sobre o valor semanal em atraso; Juros de 1% ao mês, calculados pro rata die; Correção monetária pelo IPCA/IBGE acumulado no período.
4.4 O não pagamento até 2 (dois) dias corridos após o vencimento caracterizará mora automática, considerando-se o contrato rescindido de pleno direito, independentemente de aviso prévio. A LOCADORA fica autorizada a promover imediatamente o bloqueio, a retomada e o recolhimento da motocicleta.
4.5 O valor semanal poderá ser reajustado pela variação positiva do IPCA/IBGE nos contratos com mais de 12 meses de duração, mediante comunicação com 15 dias de antecedência.

5. CAUÇÃO
5.1 O LOCATÁRIO pagará caução de R$ 600,00 (seiscentos reais) no ato da assinatura deste contrato, por PIX ou depósito bancário.
5.2 A caução poderá ser utilizada pela LOCADORA para quitar débitos do LOCATÁRIO, incluindo aluguéis em atraso, multas, danos, franquias do seguro e tarifas operacionais.
5.3 A caução NÃO substitui e NÃO cobre automaticamente danos ao veículo; o saldo devedor eventualmente superior a R$ 600,00 será cobrado separadamente.
5.4 Não havendo pendências, a caução será devolvida em até 10 (dez) dias úteis após a devolução e conferência final da motocicleta.
5.5 Se a caução for utilizada parcialmente, o LOCATÁRIO deverá complementá-la ao valor original em até 5 (cinco) dias úteis após notificação.

6. ENTREGA, VISTORIA E DEVOLUÇÃO
6.1 A motocicleta será entregue mediante assinatura do ANEXO I – Termo de Entrega e Vistoria, com registro fotográfico e checklist.
6.2 A devolução ocorrerá na sede da LOCADORA (Av. das Américas, 12.900 – Barra da Tijuca, RJ), em dia útil e horário comercial, nas mesmas condições de conservação, ressalvado o desgaste normal.
6.3 Na devolução será realizada vistoria presencial. Constatados danos, será emitido relatório e orçamento, aplicando-se a Cláusula 9.
6.4 A devolução fora da sede somente será aceita com autorização prévia e escrita da LOCADORA, podendo incidir taxa conforme Anexo II.

7. REQUISITOS E CONDUTOR AUTORIZADO
7.1 Somente o LOCATÁRIO identificado neste contrato poderá conduzir a motocicleta. É PROIBIDO emprestar, ceder ou sublocar o veículo a terceiros, salvo autorização escrita da LOCADORA.
7.2 O LOCATÁRIO declara possuir CNH categoria A válida, sem suspensão ou cassação, e experiência adequada para condução de motocicleta em ambiente urbano.
7.3 O descumprimento desta cláusula enseja rescisão imediata e responsabilidade integral por todos os danos e custos decorrentes.
7.4 O LOCATÁRIO deverá possuir ou alugar garagem fechada e segura para guardar o veículo fora dos períodos de uso.

8. MANUTENÇÃO PREVENTIVA – RESPONSABILIDADE DA LOCADORA
8.1 A LOCADORA realizará a manutenção preventiva da motocicleta conforme o Manual do Fabricante, incluindo o plano de uso severo quando aplicável ao perfil de delivery.
8.2 Serviços preventivos incluem: trocas de óleo do motor e filtro nos intervalos do manual; inspeções e ajustes periódicos; substituições periódicas de vela, filtro de ar e filtro de combustível.
8.3 Agendamento obrigatório: o LOCATÁRIO deve agendar a preventiva via WhatsApp ou aplicativo da LOCADORA com antecedência mínima de 5 (cinco) dias.
8.4 O LOCATÁRIO compromete-se a não exceder o limite de km/tempo definido no Manual do Fabricante para cada serviço preventivo.
8.5 A preventiva será realizada EXCLUSIVAMENTE na LOCADORA ou em oficina por ela indicada. É VEDADO ao LOCATÁRIO realizar reparos ou revisões por conta própria sem autorização escrita.
8.6 O LOCATÁRIO que não comparecer à manutenção agendada estará sujeito à Taxa de Ausência (Anexo II), ao bloqueio do veículo e à rescisão contratual.

9. RESPONSABILIDADE DO LOCATÁRIO – MANUTENÇÃO CORRETIVA E DANOS
9.1 Qualquer evento FORA da manutenção preventiva prevista no Manual do Fabricante é de responsabilidade exclusiva do LOCATÁRIO, incluindo: danos por queda, colisão, impacto, enchente ou qualquer sinistro; quebras por mau uso, negligência, condução agressiva, sobrecarga ou adaptação irregular; avarias estéticas (riscos, carenagem, retrovisores, manetes), pneu rasgado, roda empenada.
9.2 Cuidados operacionais diários obrigatórios do LOCATÁRIO: verificar diariamente nível de óleo, pressão dos pneus, corrente/relação e freios; comunicar IMEDIATAMENTE qualquer anormalidade.
9.3 O LOCATÁRIO autoriza a LOCADORA a realizar orçamento e reparo de qualquer dano fora da preventiva, cobrando o custo de peças, mão de obra e demais despesas, podendo descontar da caução.
9.4 Lucros cessantes: se a motocicleta ficar indisponível por culpa do LOCATÁRIO, será cobrado valor diário conforme Anexo II, por até 30 (trinta) dias.

10. SEGURO / PROTEÇÃO – SUHAI SEGURADORA
10.1 A motocicleta conta com proteção junto à Suhai Seguradora, com cobertura de: Roubo e furto total; Danos a terceiros (responsabilidade civil).
10.2 Em caso de sinistro coberto pelo seguro, o LOCATÁRIO será responsável pelo pagamento da franquia/participação obrigatória conforme apólice Suhai.
10.3 A cobertura do seguro NÃO se aplica quando o sinistro decorrer de: condução sob efeito de álcool ou substâncias psicoativas; condutor não autorizado; mau uso ou manobras proibidas; ausência de Boletim de Ocorrência no prazo exigido.

11. USO PERMITIDO, LIMITAÇÕES E PROIBIÇÕES
11.1 É PROIBIDO ao LOCATÁRIO: conduzir sob efeito de álcool, narcóticos ou qualquer substância psicoativa; participar de corrida, racha ou manobras de velocidade; transportar carga acima do limite do fabricante; adulterar hodômetro, lacres, rastreador ou placa; sublocar, emprestar ou ceder o veículo a terceiros; trafegar em dunas, praias ou submergir o veículo; usar fora do estado do Rio de Janeiro sem autorização; circular em raio inferior a 150 km de fronteiras internacionais; modificar ou instalar acessórios sem autorização.
11.2 O LOCATÁRIO é responsável por: combustível, lavagem/limpeza e conservação diária da motocicleta.
11.3 O veículo possui rastreador/telemetria. O LOCATÁRIO declara ciência e concordância com o monitoramento e eventual bloqueio remoto do veículo.

12. MULTAS E INFRAÇÕES DE TRÂNSITO
12.1 O LOCATÁRIO é integralmente responsável por multas, taxas e remoção ao pátio durante a vigência do contrato.
12.2 O LOCATÁRIO autoriza a LOCADORA a indicá-lo como condutor infrator perante os órgãos de trânsito, nos termos do art. 257 do CTB.
12.3 Sobre o valor de cada multa será acrescido 20% (vinte por cento) a título de custo operacional da LOCADORA.

13. SINISTROS, FURTO E PROVIDÊNCIAS OBRIGATÓRIAS
13.1 Em caso de acidente, furto, roubo ou qualquer sinistro, o LOCATÁRIO deverá: comunicar a LOCADORA IMEDIATAMENTE; registrar Boletim de Ocorrência em até 48 (quarenta e oito) horas; enviar fotos, local, horário e todos os documentos solicitados.
13.2 O não cumprimento das providências acima poderá implicar perda da cobertura securitária e responsabilidade integral do LOCATÁRIO pelos danos.

14. RESCISÃO E POLÍTICA DE ENCERRAMENTO
14.1 Rescisão pelo LOCATÁRIO: comunicar a LOCADORA com antecedência mínima de 48 (quarenta e oito) horas, devolver a motocicleta na sede em dia útil e quitar todos os débitos pendentes. Não haverá devolução de valor proporcional da semana em curso.
14.2 Rescisão pela LOCADORA: imediatamente nos casos de inadimplência de 2 ou mais dias; qualquer hipótese de mau uso; não comparecimento à manutenção; condutor não autorizado; adulteração de hodômetro, lacres, rastreador ou placa; sinistro não comunicado; comportamento ofensivo perante funcionários.
14.3 Em caso de rescisão por culpa do LOCATÁRIO, serão aplicadas as penalidades previstas no Anexo II, além da perda da caução para cobertura de débitos.
14.4 O veículo não poderá ser retido pelo LOCATÁRIO após a rescisão contratual. A retenção indevida poderá caracterizar, em tese, o crime de apropriação indébita (art. 168 do Código Penal). A LOCADORA fica autorizada a proceder ao bloqueio remoto, à retomada e ao recolhimento do veículo.
14.5 Nos contratos com plano pré-pago de mais de 4 (quatro) semanas, a rescisão antecipada pelo LOCATÁRIO implicará multa de 30% sobre o saldo de semanas restantes.

15. REEMBOLSO E ACERTO FINAL
15.1 Após rescisão e devolução do veículo, a LOCADORA apurará todos os créditos e débitos do LOCATÁRIO.
15.2 Havendo saldo a favor do LOCATÁRIO após quitação integral de débitos, o reembolso ocorrerá em até 15 (quinze) dias úteis.
15.3 Havendo saldo devedor após aplicação da caução, o valor será cobrado pelos meios disponíveis. O LOCATÁRIO autoriza a LOCADORA a proceder à negativação de seu nome junto aos órgãos de proteção ao crédito (SPC, Serasa), em caso de inadimplemento.

16. TRATAMENTO DE DADOS PESSOAIS – LGPD
16.1 A LOCADORA trata os dados pessoais do LOCATÁRIO nos termos da Lei nº 13.709/2018 (LGPD), para fins de execução deste contrato, prevenção a fraudes e segurança patrimonial.
16.2 Os dados poderão ser compartilhados com: oficinas parceiras, seguradora Suhai, órgãos de trânsito e autoridades competentes.

17. DISPOSIÇÕES GERAIS
17.1 Os ANEXOS I, II, III e IV integram este contrato para todos os fins de direito.
17.2 A assinatura eletrônica/digital tem plena validade jurídica, conforme MP 2.200/2001.
17.3 A tolerância de qualquer das partes não implica renúncia de direitos.
17.4 Se qualquer cláusula for declarada nula, as demais permanecerão válidas e eficazes.
17.5 Este contrato substitui quaisquer acordos verbais ou escritos anteriores entre as partes.
17.6 O presente instrumento constitui título executivo extrajudicial nos termos do art. 784 do CPC.

18. FORO
18.1 Fica eleito o foro da Comarca do Rio de Janeiro – RJ, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer litígios decorrentes deste contrato.

ANEXO II – TABELA DE TARIFAS E ENCARGOS
Os valores das tarifas e encargos serão informados pela LOCADORA na assinatura do contrato e atualizados conforme tarifário vigente com comunicação de 15 dias de antecedência.

ANEXO III – PLANO DE MANUTENÇÃO
Os intervalos de manutenção seguem o Manual do Fabricante. Para uso em delivery (uso severo), aplicar o intervalo reduzido quando o manual assim prever.

ANEXO IV – CONDIÇÕES DE SEGURO – SUHAI SEGURADORA
Seguradora: Suhai Seguradora. Coberturas: Roubo/Furto Total e Danos a Terceiros (RCF). Em caso de divergência entre este resumo e a apólice original da Suhai Seguradora, prevalece o documento original da apólice.`;
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
