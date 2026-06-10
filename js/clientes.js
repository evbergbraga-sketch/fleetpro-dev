// clientes.js — Gestão de clientes

// ══ HELPERS DE STATUS ══
const _STATUS_CFG = {
  aprovado:   { label:'Aprovado',   badge:'badge-green', icon:'✅' },
  reprovado:  { label:'Reprovado',  badge:'badge-red',   icon:'❌' },
  em_analise: { label:'Em análise', badge:'badge-yellow', icon:'🔍' },
};
function _statusBadge(s){
  const c = _STATUS_CFG[s] || _STATUS_CFG.em_analise;
  return `<span class="badge ${c.badge}" style="font-size:10px">${c.icon} ${c.label}</span>`;
}

function cnhBadge(val){
  if(!val) return '<span class="badge badge-gray">Não informada</span>';
  const d=Math.ceil((new Date(val)-new Date())/86400000);
  return d<0?'<span class="badge badge-red">Vencida</span>':d<60?`<span class="badge badge-yellow">Vence em ${d}d</span>`:'<span class="badge badge-green">Válida</span>';
}

// ══ RENDER LISTA ══
function renderClientes(){
  const s=(document.getElementById('s-clientes')?.value||'').toLowerCase();
  const data=allClientes.filter(c=>!s||`${c.nome} ${c.cpf} ${c.telefone||''}`.toLowerCase().includes(s));
  const tb=document.getElementById('tb-clientes');
  if(!tb) return;
  tb.innerHTML=data.length?data.map(c=>{
    const ini=(c.nome||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const cor = _avatarCor ? _avatarCor(c.nome) : '#2a3942';
    const telPrincipal = _primeiroTelefone(c);
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="cavatar" style="width:36px;height:36px;font-size:12px;background:${cor};color:#fff">${ini}</div>
        <div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight:500">${c.nome}</span>
            ${_statusBadge(c.status_analise||'em_analise')}
          </div>
          <div style="font-size:11px;color:var(--muted)">${_primeiroEmail(c)||''}</div>
        </div>
      </div></td>
      <td>${c.cpf||'—'}</td>
      <td>${telPrincipal||'—'}</td>
      <td>${c.cnh_validade?fmtData(c.cnh_validade):'—'}</td>
      <td>${cnhBadge(c.cnh_validade)}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="verPerfilClienteById('${c.id}')">👤 Perfil</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="irParaChat('${c.id}')">💬 Chat</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="editarCliente('${c.id}')">✏️ Editar</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px;color:var(--red);border-color:var(--red)" onclick="excluirCliente('${c.id}','${c.nome.replace(/'/g,"\\'") }')">🗑️</button>
      </div></td>
    </tr>`;
  }).join(''):'<tr class="empty-row"><td colspan="6">Nenhum cliente encontrado</td></tr>';
}

function _primeiroTelefone(c){
  try{
    const arr = c.telefones ? JSON.parse(c.telefones) : null;
    if(arr && arr.length) return arr[0].numero;
  }catch(_){}
  return c.telefone||null;
}

function _primeiroEmail(c){
  try{
    const arr = c.emails ? JSON.parse(c.emails) : null;
    if(arr && arr.length) return arr[0].email;
  }catch(_){}
  return c.email||null;
}

function irParaChat(id){
  goPage('chat');
  setTimeout(()=>abrirChat(id), 300);
}

// ══ TELEFONES DINÂMICOS ══
let _cliTelefones = {};
let _cliEmails    = {};
let _cliAnexos    = {};
if(!window._cliAnexosRemovidos) window._cliAnexosRemovidos = {};

function _addTelefone(prefix){
  if(!_cliTelefones[prefix]) _cliTelefones[prefix] = [];
  _cliTelefones[prefix].push({ tipo:'Particular', numero:'' });
  _renderTelefones(prefix);
}
function _removeTelefone(prefix, i){
  _cliTelefones[prefix].splice(i,1);
  _renderTelefones(prefix);
}
function _renderTelefones(prefix){
  const wrap = document.getElementById(prefix+'-telefones-lista');
  if(!wrap) return;
  const arr = _cliTelefones[prefix]||[];
  if(!arr.length){
    wrap.innerHTML='<div style="font-size:12px;color:var(--muted2);padding:4px 0">Nenhum telefone. Clique em "+ Adicionar".</div>';
    return;
  }
  wrap.innerHTML = arr.map((t,i)=>`
    <div style="display:grid;grid-template-columns:140px 1fr auto;gap:8px;align-items:center;margin-bottom:6px">
      <select onchange="_cliTelefones['${prefix}'][${i}].tipo=this.value" style="width:100%">
        ${['Particular','Familiar','Trabalho','WhatsApp','Outro'].map(o=>`<option${o===t.tipo?' selected':''}>${o}</option>`).join('')}
      </select>
      <input type="text" value="${t.numero}" placeholder="(21) 99999-0000" style="width:100%"
        oninput="_cliTelefones['${prefix}'][${i}].numero=this.value">
      <button onclick="_removeTelefone('${prefix}',${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
    </div>`).join('');
}

// ══ EMAILS DINÂMICOS ══
function _addEmail(prefix){
  if(!_cliEmails[prefix]) _cliEmails[prefix] = [];
  _cliEmails[prefix].push({ tipo:'Principal', email:'' });
  _renderEmails(prefix);
}
function _removeEmail(prefix, i){
  _cliEmails[prefix].splice(i,1);
  _renderEmails(prefix);
}
function _renderEmails(prefix){
  const wrap = document.getElementById(prefix+'-emails-lista');
  if(!wrap) return;
  const arr = _cliEmails[prefix]||[];
  if(!arr.length){
    wrap.innerHTML='<div style="font-size:12px;color:var(--muted2);padding:4px 0">Nenhum email. Clique em "+ Adicionar".</div>';
    return;
  }
  wrap.innerHTML = arr.map((e,i)=>`
    <div style="display:grid;grid-template-columns:140px 1fr auto;gap:8px;align-items:center;margin-bottom:6px">
      <select onchange="_cliEmails['${prefix}'][${i}].tipo=this.value" style="width:100%">
        ${['Principal','Secundário','Trabalho','Outro'].map(o=>`<option${o===e.tipo?' selected':''}>${o}</option>`).join('')}
      </select>
      <input type="email" value="${e.email}" placeholder="email@exemplo.com" style="width:100%"
        oninput="_cliEmails['${prefix}'][${i}].email=this.value">
      <button onclick="_removeEmail('${prefix}',${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
    </div>`).join('');
}

// ══ ANEXOS CLIENTES ══

// Extrai nome limpo do arquivo a partir da URL do Supabase
// Remove prefixo de timestamp e hash: "1780800997521_5tl6ou8izux_NomeReal.pdf" -> "NomeReal.pdf"
function _nomeArquivo(url){
  const raw = decodeURIComponent((url||'').split('/').pop().split('?')[0]);
  // Remove prefixo: timestamp(13 dígitos) + _ + hash(10+ chars) + _
  const match = raw.match(/^\d{13}_[a-z0-9]+_(.+)$/i);
  return match ? match[1] : raw;
}

function _iconeArquivo(nome){
  const ext = (nome||'').split('.').pop().toLowerCase();
  if(ext==='pdf') return '📄';
  if(['jpg','jpeg','png','webp','gif'].includes(ext)) return '🖼️';
  if(['doc','docx'].includes(ext)) return '📝';
  return '📎';
}

function _previewAnexosCli(prefix, files){
  if(!_cliAnexos[prefix]) _cliAnexos[prefix] = [];
  Array.from(files).forEach(f=>{
    if(f.size > 10*1024*1024){ notify(f.name+': muito grande (máx 10MB)','error'); return; }
    _cliAnexos[prefix].push(f);
  });
  _renderAnexosCli(prefix);
  const inp = document.getElementById(prefix+'-cli-anexos-input');
  if(inp) inp.value='';
}
function _renderAnexosCli(prefix){
  const lista = document.getElementById(prefix+'-cli-anexos-lista');
  if(!lista) return;
  const novos = _cliAnexos[prefix]||[];
  // mantém existentes
  const existHtml = lista.querySelectorAll ? Array.from(lista.querySelectorAll('.cli-anexo-existente')).map(e=>e.outerHTML).join('') : '';
  const novosHtml = novos.map((f,i)=>`
    <div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <span style="font-size:18px">${_fileIcon?_fileIcon(f.name):'📎'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</div>
        <div style="font-size:10px;color:var(--muted)">${(f.size/1024).toFixed(1)} KB — aguardando envio</div>
      </div>
      <button onclick="_removAnexoCli('${prefix}',${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
    </div>`).join('');
  lista.innerHTML = existHtml + novosHtml;
}
function _removAnexoCli(prefix, i){
  if(_cliAnexos[prefix]) _cliAnexos[prefix].splice(i,1);
  _renderAnexosCli(prefix);
}
function _renderAnexosCliExistentes(prefix, urls){
  const lista = document.getElementById(prefix+'-cli-anexos-lista');
  if(!lista) return;
  let arr = [];
  try{ arr = urls ? (Array.isArray(urls)?urls:JSON.parse(urls)) : []; }catch(_){}
  const existHtml = arr.map((u,i)=>{
    const name = _nomeArquivo(u);
    const icon = _iconeArquivo(name);
    return `<div class="cli-anexo-existente" style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <span style="font-size:20px">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
        <div style="font-size:10px;color:var(--muted)">Arquivo salvo</div>
      </div>
      <a href="${u}" target="_blank" style="color:var(--accent);font-size:13px;text-decoration:none" title="Abrir">🔗</a>
      <button onclick="_removAnexoCliExistente('${prefix}','${u}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px" title="Remover">✕</button>
    </div>`;
  }).join('');
  lista.innerHTML = existHtml;
  _renderAnexosCli(prefix);
}
function _removAnexoCliExistente(prefix, url){
  if(!window._cliAnexosRemovidos[prefix]) window._cliAnexosRemovidos[prefix]=[];
  window._cliAnexosRemovidos[prefix].push(url);
  const lista = document.getElementById(prefix+'-cli-anexos-lista');
  if(!lista) return;
  Array.from(lista.querySelectorAll('.cli-anexo-existente')).forEach(el=>{
    if(el.innerHTML.includes(url.slice(-30))) el.remove();
  });
}
function _coletarAnexosCliExistentes(prefix){
  const lista = document.getElementById(prefix+'-cli-anexos-lista');
  if(!lista) return [];
  return Array.from(lista.querySelectorAll('.cli-anexo-existente a')).map(a=>a.href);
}
async function _uploadAnexosCli(prefix, clienteId){
  const files = _cliAnexos[prefix]||[];
  if(!files.length) return [];
  const uploaded = [];
  for(const f of files){
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = `clientes/${clienteId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
    const {error} = await sb.storage.from('clientes-docs').upload(path, f, {upsert:false});
    if(error){ notify('Erro ao enviar '+f.name+': '+error.message,'error'); continue; }
    const {data:pub} = sb.storage.from('clientes-docs').getPublicUrl(path);
    uploaded.push(pub.publicUrl);
  }
  return uploaded;
}

// ══ BUSCA CEP ══
async function _buscarCEP(prefix){
  const cepEl = document.getElementById(prefix+'-cep');
  if(!cepEl) return;
  const cep = cepEl.value.replace(/\D/g,'');
  if(cep.length !== 8){ notify('CEP inválido','error'); return; }
  try{
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if(d.erro){ notify('CEP não encontrado','error'); return; }
    const s=(id,v)=>{ const e=document.getElementById(prefix+'-'+id); if(e) e.value=v||''; };
    s('rua',       d.logradouro);
    s('bairro',    d.bairro);
    s('cidade',    d.localidade);
    s('uf',        d.uf);
    // Foca no campo número
    const numEl = document.getElementById(prefix+'-numero-end');
    if(numEl) numEl.focus();
    notify('Endereço preenchido!','success');
  }catch(e){ notify('Erro ao buscar CEP','error'); }
}

// ══ COLETAR CAMPOS ══
function _coletarCamposCliente(prefix){
  const g = id => document.getElementById(prefix+'-'+id)?.value||null;
  // Monta endereço completo para compatibilidade com campos legados
  const rua  = g('rua')||'';
  const num  = g('numero-end')||'';
  const comp = g('complemento')||'';
  const bair = g('bairro')||'';
  const cid  = g('cidade')||'';
  const uf   = g('uf')||'';
  const cep  = g('cep')||'';
  const endStr = [rua+(num?' '+num:''), comp, bair, cid+(uf?' - '+uf:''), cep].filter(Boolean).join(', ');
  return {
    data_nascimento:  g('nascimento')||null,
    status_analise:   g('status-analise')||'em_analise',
    origem:           g('origem')||null,
    redes_sociais:    _coletarRedesSociais('mc')||null,
    // CNH expandida
    cnh:              g('cnh')||null,
    cnh_registro:     g('cnh-registro')||null,
    cnh_seguranca:    g('cnh-seguranca')||null,
    cnh_categoria:    g('cnh-categoria')||null,
    cnh_emissao:      g('cnh-emissao')||null,
    cnh_validade:     g('cnh-val')||null,
    cnh_primeira_hab: g('cnh-primeira')||null,
    cnh_local:        g('cnh-local')||null,
    nome_pai:         g('pai')||null,
    nome_mae:         g('mae')||null,
    // Endereço estruturado
    cep:              cep||null,
    endereco_rua:     rua||null,
    endereco_numero:  num||null,
    endereco_complemento: comp||null,
    endereco_bairro:  bair||null,
    endereco_cidade:  cid||null,
    endereco_uf:      uf||null,
    endereco:         endStr||null,
    // Múltiplos contatos (JSON)
    telefones: (_cliTelefones[prefix]||[]).length ? JSON.stringify(_cliTelefones[prefix]) : null,
    emails:    (_cliEmails[prefix]||[]).length    ? JSON.stringify(_cliEmails[prefix])    : null,
    redes_sociais: (_coletarRedesSociais && _coletarRedesSociais(prefix))||null,
    // Compatibilidade: primeiro telefone/email nos campos legados
    telefone:  (_cliTelefones[prefix]||[])[0]?.numero || null,
    email:     (_cliEmails[prefix]||[])[0]?.email     || null,
  };
}

function _preencherCamposCliente(prefix, c){
  const s=(id,v)=>{ const e=document.getElementById(prefix+'-'+id); if(e) e.value=v||''; };
  s('nascimento',    c.data_nascimento);
  s('status-analise',c.status_analise||'em_analise');
  s('origem',        c.origem);
  _renderRedesSociais('ec', c.redes_sociais||[]);
  s('cnh',           c.cnh);
  s('cnh-registro',  c.cnh_registro);
  s('cnh-seguranca', c.cnh_seguranca);
  s('cnh-categoria', c.cnh_categoria);
  s('cnh-emissao',   c.cnh_emissao);
  s('cnh-val',       c.cnh_validade);
  s('cnh-primeira',  c.cnh_primeira_hab);
  s('cnh-local',     c.cnh_local);
  s('pai',           c.nome_pai);
  s('mae',           c.nome_mae);
  s('cep',           c.cep);
  s('rua',           c.endereco_rua);
  s('numero-end',    c.endereco_numero);
  s('complemento',   c.endereco_complemento);
  s('bairro',        c.endereco_bairro);
  s('cidade',        c.endereco_cidade);
  s('uf',            c.endereco_uf);
  // Telefones
  try{ _cliTelefones[prefix] = c.telefones ? JSON.parse(c.telefones) : (c.telefone?[{tipo:'Particular',numero:c.telefone}]:[]); }catch(_){ _cliTelefones[prefix]=[]; }
  _renderTelefones(prefix);
  // Emails
  try{ _cliEmails[prefix] = c.emails ? JSON.parse(c.emails) : (c.email?[{tipo:'Principal',email:c.email}]:[]); }catch(_){ _cliEmails[prefix]=[]; }
  _renderEmails(prefix);
  // Anexos existentes
  _renderAnexosCliExistentes(prefix, c.anexos_urls);
}

function _limparFormCliente(prefix){
  ['nome','cpf','obs'].forEach(id=>{ const e=document.getElementById(prefix+'-'+id); if(e) e.value=''; });
  _cliTelefones[prefix]=[]; _renderTelefones(prefix);
  _cliEmails[prefix]=[]; _renderEmails(prefix);
  _cliAnexos[prefix]=[]; _renderAnexosCli(prefix);
  const camposZerar=['nascimento','status-analise','origem','cnh','cnh-registro','cnh-seguranca',
    'cnh-categoria','cnh-emissao','cnh-val','cnh-primeira','cnh-local','pai','mae',
    'cep','rua','numero-end','complemento','bairro','cidade','uf'];
  camposZerar.forEach(id=>{ const e=document.getElementById(prefix+'-'+id); if(e) e.value=''; });
}

// ══ SALVAR CLIENTE ══
async function salvarCliente(){
  const nome = document.getElementById('mc-nome').value.trim();
  const cpf  = document.getElementById('mc-cpf').value.trim();
  const obs  = document.getElementById('mc-obs').value.trim();
  if(!nome||!cpf){ notify('Nome e CPF são obrigatórios','error'); return; }
  if(!checarCPF(cpf,'CPF do cliente')) return;
  const btn = document.querySelector('#m-cliente .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  try{
    const extras = _coletarCamposCliente('mc');
    const {data, error} = await sb.from('clientes').insert({
      nome, cpf, observacoes:obs, ...extras
    }).select().single();
    if(error) throw error;
    // Upload anexos
    const novosUrls = await _uploadAnexosCli('mc', data.id);
    if(novosUrls.length) await sb.from('clientes').update({anexos_urls:JSON.stringify(novosUrls)}).eq('id',data.id);
    notify('Cliente cadastrado com sucesso!','success');
    closeModal('cliente');
    _limparFormCliente('mc');
    if(window._afterSalvarCliente){ await window._afterSalvarCliente(); window._afterSalvarCliente=null; }
    else { await loadClientes(); renderDashboard(); renderChatContacts(); }
  }catch(e){
    notify('Erro ao salvar: '+e.message,'error');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='✓ Salvar'; }
  }
}

// ══ EDITAR CLIENTE ══
function editarCliente(id){
  const c = allClientes.find(x=>x.id===id);
  if(!c) return;
  // Helper seguro para setar valor (evita erro se campo não existir)
  const sv = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val||''; };
  sv('ec-id',   c.id);
  sv('ec-nome', c.nome);
  sv('ec-cpf',  c.cpf);
  sv('ec-obs',  c.observacoes);
  _cliAnexos['ec'] = [];
  window._cliAnexosRemovidos['ec'] = [];
  _preencherCamposCliente('ec', c);
  document.getElementById('m-editar-cliente').classList.add('show');
}

// ══ ATUALIZAR CLIENTE ══
async function atualizarCliente(){
  const id   = document.getElementById('ec-id').value;
  const nome = document.getElementById('ec-nome').value.trim();
  const cpf  = document.getElementById('ec-cpf').value.trim();
  const obs  = document.getElementById('ec-obs').value.trim();
  if(!nome||!cpf){ notify('Nome e CPF obrigatórios','error'); return; }
  if(!checarCPF(cpf,'CPF do cliente')) return;
  const btn = document.querySelector('#m-editar-cliente .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  try{
    const extras = _coletarCamposCliente('ec');
    // Upload novos anexos
    const novosUrls = await _uploadAnexosCli('ec', id);
    const existentes = _coletarAnexosCliExistentes('ec');
    const todosAnexos = [...existentes, ...novosUrls];
    const obj = { nome, cpf, observacoes:obs, ...extras,
      anexos_urls: todosAnexos.length ? JSON.stringify(todosAnexos) : null };
    const {error} = await sb.from('clientes').update(obj).eq('id',id);
    if(error) throw error;
    notify('Cliente atualizado!','success');
    closeModal('editar-cliente');
    _cliAnexos['ec']=[]; window._cliAnexosRemovidos['ec']=[];
    await loadClientes(); renderDashboard(); renderChatContacts();
  }catch(e){
    notify('Erro: '+e.message,'error');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='✓ Salvar alterações'; }
  }
}

// ══ PERFIL EXPANDIDO ══
async function verPerfilCliente(){
  if(!activeChatId) return;
  const c = allClientes.find(x=>x.id===activeChatId);
  if(!c){ notify('Selecione um cliente cadastrado','error'); return; }
  await _renderPerfilCliente(c);
}

async function verPerfilClienteById(id){
  const c = allClientes.find(x=>x.id===id);
  if(!c) return;
  await _renderPerfilCliente(c);
}

async function _renderPerfilCliente(c){
  document.getElementById('perfil-cliente-body').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:14px">
      <div style="width:40px;height:40px;border:3px solid #E2E8F0;border-top-color:#2563EB;border-radius:50%;animation:spin .7s linear infinite"></div>
      <div style="font-size:13px;color:var(--muted)">Carregando perfil...</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.getElementById('m-perfil-cliente').classList.add('show');

  const [
    {data:locs},
    {data:condutores},
    {data:cartoes}
  ] = await Promise.all([
    sb.from('locacoes').select('*,veiculos(marca,modelo,placa,tipo)').eq('cliente_id',c.id).order('created_at',{ascending:false}),
    sb.from('condutores').select('*').eq('cliente_id',c.id).order('nome'),
    sb.from('cartoes').select('*').eq('cliente_id',c.id).order('created_at',{ascending:false})
  ]);

  const cnhStatus = c.cnh_validade
    ? (new Date(c.cnh_validade)<new Date()
        ?'<span class="badge badge-red">Vencida</span>'
        :`<span class="badge badge-green">Válida até ${fmtData(c.cnh_validade)}</span>`)
    :'<span class="badge badge-gray">Não informada</span>';
  const ini=(c.nome||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const totalGasto=(locs||[]).reduce((acc,l)=>acc+(l.total||0),0);
  const locAtiva=(locs||[]).find(l=>l.status==='ativa');

  // Telefones e emails (múltiplos)
  let tels = [];
  try{ tels = c.telefones ? JSON.parse(c.telefones) : (c.telefone?[{tipo:'Principal',numero:c.telefone}]:[]); }catch(_){}
  let mails = [];
  try{ mails = c.emails ? JSON.parse(c.emails) : (c.email?[{tipo:'Principal',email:c.email}]:[]); }catch(_){}

  // Anexos
  let anexos = [];
  try{ anexos = c.anexos_urls ? (Array.isArray(c.anexos_urls)?c.anexos_urls:JSON.parse(c.anexos_urls)) : []; }catch(_){}

  const html = `
  <div style="padding:20px 20px 0">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div class="cavatar" style="width:52px;height:52px;font-size:18px;background:rgba(37,99,235,.12);color:#2563EB">${ini}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:17px;font-weight:700">${c.nome}</span>
          ${_statusBadge(c.status_analise||'em_analise')}
        </div>
        <div style="font-size:12px;color:var(--muted)">${mails[0]?.email||c.email||'sem email'}</div>
      </div>
      <button class="btn btn-ghost" style="font-size:12px" onclick="editarCliente('${c.id}');closeModal('perfil-cliente')">✏️ Editar</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.12);padding:12px;border-radius:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase">Locações</div>
        <div style="font-size:24px;font-weight:800;color:#2563EB">${(locs||[]).length}</div>
      </div>
      <div style="background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.12);padding:12px;border-radius:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase">Total gasto</div>
        <div style="font-size:14px;font-weight:800;color:#16a34a">R$ ${totalGasto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>
      <div style="background:${locAtiva?'rgba(220,38,38,.06)':'rgba(100,116,139,.06)'};border:1px solid ${locAtiva?'rgba(220,38,38,.15)':'rgba(100,116,139,.12)'};padding:12px;border-radius:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase">Status</div>
        <div style="font-size:13px;font-weight:700;color:${locAtiva?'#dc2626':'#64748B'}">${locAtiva?'Com veículo':'Livre'}</div>
      </div>
    </div>
  </div>

  <div style="display:flex;border-bottom:2px solid var(--border2);padding:0 20px;gap:0">
    ${[
      {id:'tab-dados',     label:'👤 Dados'},
      {id:'tab-locacoes',  label:`📋 Locações (${(locs||[]).length})`},
      {id:'tab-condutores',label:`🧑‍💼 Condutores (${(condutores||[]).length})`},
      {id:'tab-cartoes',   label:`💳 Cartões (${(cartoes||[]).length})`},
    ].map((t,i)=>`
      <button id="${t.id}" class="perfil-tab" onclick="showPerfilTab('${t.id.replace('tab-','')}')"
        style="padding:10px 14px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;
               color:${i===0?'var(--accent)':'var(--muted)'};border-bottom:${i===0?'2px solid var(--accent)':'2px solid transparent'};margin-bottom:-2px">
        ${t.label}
      </button>`).join('')}
  </div>

  <!-- PAINEL DADOS -->
  <div id="painel-dados" style="padding:16px 20px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="background:var(--bg2);padding:10px 12px;border-radius:8px"><div style="font-size:10px;color:var(--muted2);margin-bottom:3px">CPF</div><div style="font-size:13px;font-weight:500">${c.cpf||'—'}</div></div>
      <div style="background:var(--bg2);padding:10px 12px;border-radius:8px"><div style="font-size:10px;color:var(--muted2);margin-bottom:3px">Nascimento</div><div style="font-size:13px">${c.data_nascimento?fmtData(c.data_nascimento):'—'}</div></div>
      <div style="background:var(--bg2);padding:10px 12px;border-radius:8px"><div style="font-size:10px;color:var(--muted2);margin-bottom:3px">Origem</div><div style="font-size:13px">${c.origem||'—'}</div></div>
      ${c.cartao_dados ? `
      <div style="background:var(--bg2);padding:10px 12px;border-radius:8px;grid-column:1/-1">
        <div style="font-size:10px;color:var(--muted2);margin-bottom:6px">💳 Cartão Registrado</div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600">${c.cartao_dados.bandeira||'—'}</span>
          <span style="font-size:13px;letter-spacing:2px">•••• •••• •••• ${c.cartao_dados.ultimos4||'????'}</span>
          <span style="font-size:12px;color:var(--muted2)">Val: ${c.cartao_dados.validade||'—'}</span>
          <span style="font-size:12px;color:var(--muted2)">Titular: ${c.cartao_dados.titular||'—'}</span>
        </div>
      </div>` : ''}
      <div style="background:var(--bg2);padding:10px 12px;border-radius:8px;grid-column:1/-1"><div style="font-size:10px;color:var(--muted2);margin-bottom:6px">🌐 Redes Sociais</div><div style="display:flex;gap:8px;flex-wrap:wrap">${(()=>{const rs=c.redes_sociais||[];if(!rs.length)return'<span style="font-size:13px;color:var(--muted)">—</span>';const icons={'Instagram':'📸','Facebook':'👥','Twitter':'🐦','TikTok':'🎵','YouTube':'▶️','LinkedIn':'💼','WhatsApp':'💬','Outro':'🔗'};return rs.map(r=>`<a href="${r.url||'#'}" target="_blank" style="display:flex;align-items:center;gap:5px;background:var(--bg3,var(--bg));padding:4px 10px;border-radius:20px;font-size:12px;color:var(--accent);text-decoration:none;border:1px solid var(--border)">${icons[r.rede]||'🔗'} ${r.rede} ${r.usuario?'<span style=\'color:var(--muted)\'>'+r.usuario+'</span>':''}</a>`).join('')})()}</div></div>
      <div style="background:var(--bg2);padding:10px 12px;border-radius:8px"><div style="font-size:10px;color:var(--muted2);margin-bottom:3px">Status análise</div><div>${_statusBadge(c.status_analise||'em_analise')}</div></div>
    </div>

    ${tels.length ? `<div style="background:var(--bg2);padding:10px 12px;border-radius:8px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--muted2);margin-bottom:6px">📱 Telefones</div>
      ${tels.map(t=>`<div style="font-size:13px;margin-bottom:3px"><span style="color:var(--muted);font-size:11px">${t.tipo}: </span>${t.numero}</div>`).join('')}
    </div>` : ''}

    ${mails.length ? `<div style="background:var(--bg2);padding:10px 12px;border-radius:8px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--muted2);margin-bottom:6px">✉️ Emails</div>
      ${mails.map(e=>`<div style="font-size:13px;margin-bottom:3px"><span style="color:var(--muted);font-size:11px">${e.tipo}: </span>${e.email}</div>`).join('')}
    </div>` : ''}

    <div style="background:var(--bg2);padding:10px 12px;border-radius:8px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--muted2);margin-bottom:6px">🪪 CNH</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div><span style="color:var(--muted)">Nº CNH: </span>${c.cnh||'—'}</div>
        <div><span style="color:var(--muted)">Categoria: </span>${c.cnh_categoria||'—'}</div>
        <div><span style="color:var(--muted)">Validade: </span>${cnhStatus}</div>
        <div><span style="color:var(--muted)">Emissão: </span>${c.cnh_emissao?fmtData(c.cnh_emissao):'—'}</div>
        <div><span style="color:var(--muted)">Pai: </span>${c.nome_pai||'—'}</div>
        <div><span style="color:var(--muted)">Mãe: </span>${c.nome_mae||'—'}</div>
      </div>
    </div>

    ${c.endereco||c.endereco_rua ? `<div style="background:var(--bg2);padding:10px 12px;border-radius:8px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--muted2);margin-bottom:3px">📍 Endereço</div>
      <div style="font-size:13px">${c.endereco||[c.endereco_rua,c.endereco_numero,c.endereco_bairro,c.endereco_cidade].filter(Boolean).join(', ')}</div>
    </div>` : ''}

    ${anexos.length ? `<div style="background:var(--bg2);padding:10px 12px;border-radius:8px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--muted2);margin-bottom:6px">📎 Documentos</div>
      ${anexos.map(u=>{
        const name=_nomeArquivo(u);
        const icon=_iconeArquivo(name);
        return `<a href="${u}" target="_blank" style="display:flex;align-items:center;gap:8px;color:var(--text);font-size:12px;text-decoration:none;margin-bottom:6px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:6px 10px;transition:.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'">
          <span style="font-size:16px">${icon}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
          <span style="color:var(--accent);font-size:11px;flex-shrink:0">🔗 Abrir</span>
        </a>`;
      }).join('')}
    </div>` : ''}

    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="irParaChat('${c.id}');closeModal('perfil-cliente')">💬 Chat</button>
      <button class="btn btn-ghost" style="color:var(--red);border-color:var(--red)" onclick="excluirCliente('${c.id}','${c.nome}');closeModal('perfil-cliente')">🗑️ Excluir</button>
      <button class="btn btn-primary" style="flex:1" onclick="closeModal('perfil-cliente')">Fechar</button>
    </div>
  </div>

  <!-- PAINEL LOCAÇÕES -->
  <div id="painel-locacoes" style="display:none;padding:16px 20px">
    ${(locs||[]).length>0 ? (locs||[]).map(l=>{
      const dias=Math.ceil((new Date(l.data_fim)-new Date(l.data_inicio))/86400000);
      let badge=l.status==='ativa'?'<span class="badge badge-green">Ativa</span>':l.status==='encerrada'?'<span class="badge badge-blue">Encerrada</span>':'<span class="badge badge-gray">Cancelada</span>';
      return `<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">${l.veiculos?.tipo==='moto'?'🏍️':'🚗'}</span>
            <div><div style="font-size:13px;font-weight:600">${l.veiculos?.marca||''} ${l.veiculos?.modelo||''}</div><div style="font-size:11px;color:var(--muted)">${l.veiculos?.placa||''}</div></div>
          </div>${badge}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--muted)">
          <div>📅 ${fmtData(l.data_inicio)} → ${fmtData(l.data_fim)}</div>
          <div style="font-weight:600;color:var(--text)">Total: R$ ${(l.total||0).toFixed(2)}</div>
        </div>
        ${l.status==='ativa'?`<div style="margin-top:10px"><button class="btn btn-primary" style="font-size:11px;padding:5px 14px;width:100%" onclick="confirmarDevolucao('${l.id}','${l.veiculo_id}','${l.veiculos?.marca||''} ${l.veiculos?.modelo||''}');closeModal('perfil-cliente')">✅ Confirmar devolução</button></div>`:''}
      </div>`;
    }).join('') : '<div style="text-align:center;padding:20px;color:var(--muted2);font-size:13px">Nenhum contrato registrado.</div>'}
  </div>

  <!-- PAINEL CONDUTORES -->
  <div id="painel-condutores" style="display:none;padding:16px 20px">
    <div id="condutores-perfil-lista">
      ${(condutores||[]).length>0 ? (condutores||[]).map(cd=>`
        <div style="display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:8px">
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${cd.nome}</div>
            <div style="font-size:11px;color:var(--muted)">CPF: ${cd.cpf||'não informado'} ${cd.cnh?'· CNH: '+cd.cnh:''}</div>
          </div>
          <button onclick="_excluirCondutor('${cd.id}','${c.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px">🗑️</button>
        </div>`).join('')
      : '<div style="text-align:center;padding:16px;color:var(--muted2);font-size:13px">Nenhum condutor cadastrado.</div>'}
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-top:8px">
      <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--muted)">+ Novo condutor</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input type="text" id="novo-cond-nome" placeholder="Nome completo" style="width:100%">
        <input type="text" id="novo-cond-cpf" placeholder="CPF" style="width:100%">
        <input type="text" id="novo-cond-cnh" placeholder="CNH (opcional)" style="width:100%">
        <input type="date" id="novo-cond-val" style="width:100%">
      </div>
      <button class="btn btn-primary" style="width:100%;font-size:12px" onclick="_salvarCondutor('${c.id}')">+ Adicionar condutor</button>
    </div>
  </div>

  <!-- PAINEL CARTÕES -->
  <div id="painel-cartoes" style="display:none;padding:16px 20px">
    <div style="font-size:11px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);border-radius:6px;padding:8px 10px;margin-bottom:12px;color:#991b1b">
      🔒 Dados de cartão armazenados com segurança para uso exclusivo em cobranças futuras.
    </div>
    <div id="cartoes-perfil-lista">
      ${(cartoes||[]).length>0 ? (cartoes||[]).map(ct=>`
        <div style="display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:8px">
          <div style="font-size:22px">💳</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${ct.bandeira} •••• ${(ct.numero||'').slice(-4)||'????'}</div>
            <div style="font-size:11px;color:var(--muted)">${ct.titular} · Val: ${ct.validade||'—'}</div>
          </div>
          <button onclick="_excluirCartao('${ct.id}','${c.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px">🗑️</button>
        </div>`).join('')
      : '<div style="text-align:center;padding:16px;color:var(--muted2);font-size:13px">Nenhum cartão cadastrado.</div>'}
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-top:8px">
      <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--muted)">+ Novo cartão</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div class="form-group full" style="grid-column:1/-1"><input type="text" id="novo-cart-titular" placeholder="Nome do titular" style="width:100%"></div>
        <input type="text" id="novo-cart-numero" placeholder="Número do cartão" maxlength="19" style="width:100%" oninput="this.value=this.value.replace(/\D/g,'').replace(/(\d{4})/g,'$1 ').trim().slice(0,19)">
        <input type="text" id="novo-cart-validade" placeholder="MM/AA" maxlength="5" style="width:100%">
        <select id="novo-cart-bandeira" style="width:100%">
          <option>Visa</option><option>Mastercard</option><option>Elo</option>
          <option>American Express</option><option>Hipercard</option><option>Outra</option>
        </select>
      </div>
      <button class="btn btn-primary" style="width:100%;font-size:12px" onclick="_salvarCartao('${c.id}')">+ Adicionar cartão</button>
    </div>
  </div>`;

  document.getElementById('perfil-cliente-body').innerHTML = html;
}

function showPerfilTab(tab){
  const paineis = ['dados','locacoes','condutores','cartoes'];
  paineis.forEach(p=>{
    const painel = document.getElementById(`painel-${p}`);
    const btn    = document.getElementById(`tab-${p}`);
    const active = p===tab;
    if(painel) painel.style.display = active?'':'none';
    if(btn){
      btn.style.color = active?'var(--accent)':'var(--muted)';
      btn.style.borderBottomColor = active?'var(--accent)':'transparent';
    }
  });
}

// ══ CONDUTORES ══
async function _salvarCondutor(clienteId){
  const nome = document.getElementById('novo-cond-nome')?.value.trim();
  const cpf  = document.getElementById('novo-cond-cpf')?.value.trim();
  const cnh  = document.getElementById('novo-cond-cnh')?.value.trim();
  const val  = document.getElementById('novo-cond-val')?.value||null;
  if(!nome){ notify('Informe o nome do condutor','error'); return; }
  const {error} = await sb.from('condutores').insert({
    cliente_id:clienteId, nome, cpf:cpf||null, cnh:cnh||null, cnh_validade:val
  });
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Condutor adicionado!','success');
  const c = allClientes.find(x=>x.id===clienteId);
  if(c) await _renderPerfilCliente(c);
}

async function _excluirCondutor(id, clienteId){
  if(!confirm('Remover este condutor?')) return;
  await sb.from('condutores').delete().eq('id',id);
  notify('Condutor removido','success');
  const c = allClientes.find(x=>x.id===clienteId);
  if(c) await _renderPerfilCliente(c);
}

// ══ CARTÕES ══
async function _salvarCartao(clienteId){
  const titular  = document.getElementById('novo-cart-titular')?.value.trim();
  const numero   = document.getElementById('novo-cart-numero')?.value.trim();
  const validade = document.getElementById('novo-cart-validade')?.value.trim();
  const bandeira = document.getElementById('novo-cart-bandeira')?.value||'';
  if(!titular||!numero){ notify('Preencha titular e número','error'); return; }
  const {error} = await sb.from('cartoes').insert({
    cliente_id:clienteId, titular, numero, validade, bandeira
  });
  if(error){ notify('Erro: '+error.message,'error'); return; }
  notify('Cartão adicionado!','success');
  const c = allClientes.find(x=>x.id===clienteId);
  if(c) await _renderPerfilCliente(c);
}

async function _excluirCartao(id, clienteId){
  if(!confirm('Remover este cartão?')) return;
  await sb.from('cartoes').delete().eq('id',id);
  notify('Cartão removido','success');
  const c = allClientes.find(x=>x.id===clienteId);
  if(c) await _renderPerfilCliente(c);
}

// ══ EXCLUIR CLIENTE ══
async function excluirCliente(id, nome){
  if(!confirm(`Excluir o cliente "${nome}"?

Essa ação não pode ser desfeita.
Locações e contratos vinculados serão mantidos.`)) return;
  try{
    const {error} = await sb.from('clientes').delete().eq('id', id);
    if(error) throw error;
    notify('Cliente excluído.', 'success');
    await loadClientes();
    renderClientes();
    renderDashboard();
  }catch(e){
    notify('Erro ao excluir: ' + e.message, 'error');
  }
}

// ══ DEVOLUÇÃO ══
async function confirmarDevolucao(locId, veiculoId, nomeVeiculo){
  const kmFinal = prompt(`Confirmar devolução de ${nomeVeiculo}\n\nInforme o KM final (ou deixe vazio):`, '');
  if(kmFinal === null) return;
  try{
    const updateObj = {status:'encerrada'};
    if(kmFinal && !isNaN(parseInt(kmFinal))) updateObj.km_final = parseInt(kmFinal);
    const {error:e1} = await sb.from('locacoes').update(updateObj).eq('id',locId);
    if(e1) throw e1;
    const kmUpdate = {status:'disponivel'};
    if(kmFinal && !isNaN(parseInt(kmFinal))) kmUpdate.km_atual = parseInt(kmFinal);
    const {error:e2} = await sb.from('veiculos').update(kmUpdate).eq('id',veiculoId);
    if(e2) throw e2;
    notify('Devolução confirmada! Veículo disponível. ✅','success');
    await Promise.all([loadVeiculos(), loadLocacoes(), loadLocacoesCompletas()]);
    renderDashboard(); renderVeiculos(); renderLocacoes();
  }catch(e){
    notify('Erro ao confirmar devolução: '+e.message,'error');
  }
}

// ══ MASK CEP ══
function maskCEP(el){
  let v = el.value.replace(/\D/g,'').slice(0,8);
  if(v.length > 5) v = v.slice(0,5)+'-'+v.slice(5);
  el.value = v;
}

// ══ REDES SOCIAIS ══
const REDES_OPTIONS = ['Instagram','Facebook','Twitter/X','TikTok','YouTube','LinkedIn','WhatsApp','Outro'];

function _renderRedesSociais(prefix, lista){
  const wrap = document.getElementById(prefix+'-redes-lista');
  if(!wrap) return;
  lista = lista||[];
  if(!lista.length){ wrap.innerHTML=''; return; }
  wrap.innerHTML = lista.map((r,i)=>
    `<div id="${prefix}-rede-${i}" style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
      <select style="flex:0 0 120px;background:var(--bg3,var(--bg2));border:1px solid var(--border);border-radius:8px;padding:7px 8px;font-size:12px;color:var(--text)">
        ${REDES_OPTIONS.map(op=>`<option${op===r.rede?' selected':''}>${op}</option>`).join('')}
      </select>
      <input type="text" placeholder="@usuario ou URL" value="${r.usuario||r.url||''}"
        style="flex:1;background:var(--bg3,var(--bg2));border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:12px;color:var(--text)">
      <button onclick="this.closest('[id]').remove()" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--red,#dc2626)">×</button>
    </div>`
  ).join('');
}

function _addRedeSocial(prefix){
  const wrap = document.getElementById(prefix+'-redes-lista');
  if(!wrap) return;
  const idx = wrap.children.length;
  const div = document.createElement('div');
  div.id = `${prefix}-rede-${idx}`;
  div.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
  div.innerHTML = `
    <select style="flex:0 0 120px;background:var(--bg3,var(--bg2));border:1px solid var(--border);border-radius:8px;padding:7px 8px;font-size:12px;color:var(--text)">
      ${REDES_OPTIONS.map(op=>`<option>${op}</option>`).join('')}
    </select>
    <input type="text" placeholder="@usuario ou URL"
      style="flex:1;background:var(--bg3,var(--bg2));border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:12px;color:var(--text)">
    <button onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--red,#dc2626)">×</button>`;
  wrap.appendChild(div);
  div.querySelector('input').focus();
}

function _coletarRedesSociais(prefix){
  const wrap = document.getElementById(prefix+'-redes-lista');
  if(!wrap) return null;
  const rows = [...wrap.querySelectorAll('div[id]')];
  const lista = rows.map(row=>{
    const rede    = row.querySelector('select')?.value||'';
    const usuario = row.querySelector('input')?.value?.trim()||'';
    return rede && usuario ? {rede, usuario} : null;
  }).filter(Boolean);
  return lista.length ? lista : null;
}
