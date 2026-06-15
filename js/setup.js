// setup.js — Setup Supabase, autenticação e início do app

// ══ SETUP ══
function toggleSQL(){
  const p=document.getElementById('sql-panel');
  p.style.display=p.style.display==='block'?'none':'block';
}
function copySQL(){ navigator.clipboard.writeText(document.getElementById('sql-text').textContent); notify('SQL copiado!','success'); }

function limparSetup(){
  localStorage.removeItem('fp_url'); localStorage.removeItem('fp_key');
  document.getElementById('sb-url').value='';
  document.getElementById('sb-key').value='';
  const e=document.getElementById('setup-err');
  e.innerHTML='Dados limpos. Cole suas credenciais novamente.';
  e.style.cssText='display:block;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--blue);line-height:1.5';
}

async function setupConectar(){
  const url=document.getElementById('sb-url').value.trim();
  const key=document.getElementById('sb-key').value.trim();
  const errEl=document.getElementById('setup-err');
  const okEl=document.getElementById('setup-ok');
  const btn=document.getElementById('setup-btn');
  const showErr=(msg)=>{
    errEl.innerHTML=msg;
    errEl.style.cssText='display:block;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--red);line-height:1.5;margin-top:0';
    okEl.style.display='none';
  };
  errEl.style.display='none'; okEl.style.display='none';

  if(!url && !key){ showErr('⚠️ Preencha os dois campos acima: <strong>Project URL</strong> e <strong>chave anon public</strong>.'); return; }
  if(!url){ showErr('⚠️ A <strong>Project URL</strong> está vazia. Formato: <code style="color:var(--accent)">https://xxxx.supabase.co</code>'); return; }
  if(!url.includes('supabase.co')){ showErr('⚠️ A URL parece incorreta. Deve terminar com <code style="color:var(--accent)">.supabase.co</code>'); return; }
  if(!key){ showErr('⚠️ A <strong>chave anon public</strong> está vazia. Deve começar com <code style="color:var(--accent)">eyJ</code>'); return; }
  if(!key.startsWith('eyJ')){ showErr('⚠️ Chave inválida — você colou a chave errada.<br><span style="color:var(--muted)">Use a <strong>anon public</strong>, que começa com <code style="color:var(--accent)">eyJ</code>. Não use a service_role.</span>'); return; }

  btn.textContent='⏳ Conectando...'; btn.disabled=true;
  try{
    sb=createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    const {error}=await sb.auth.getSession();
    if(error) throw error;
    localStorage.setItem('fp_url',url);
    localStorage.setItem('fp_key',key);
    okEl.innerHTML='✅ Conectado! Redirecionando...';
    okEl.style.cssText='display:block;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--green)';
    btn.textContent='✓ Conectado!';
    setTimeout(()=>goLayer('login'),900);
  }catch(e){
    btn.textContent='⚡ Conectar ao Supabase'; btn.disabled=false;
    let msg=e.message||'Erro desconhecido';
    if(msg.includes('Invalid API key')||msg.includes('apikey')) msg='Chave inválida. Verifique se copiou a <strong>anon public</strong> correta.';
    else if(msg.includes('fetch')||msg.includes('network')) msg='Não foi possível alcançar o Supabase. Verifique a URL.';
    showErr('❌ '+msg+'<br><span style="color:var(--muted);display:block;margin-top:4px">Se ainda não criou as tabelas, use o SQL acima no SQL Editor do Supabase primeiro.</span>');
  }
}

// ══ AUTH ══
function switchTab(t){
  document.getElementById('tab-login').classList.add('active');
  const tabReg = document.getElementById('tab-register');
  if(tabReg) tabReg.classList.remove('active');
  document.getElementById('form-login').style.display='flex';
  const formReg = document.getElementById('form-register');
  if(formReg) formReg.style.display='none';
}

async function fazerLogin(){
  const email=document.getElementById('l-email').value.trim();
  const senha=document.getElementById('l-senha').value;
  const errEl=document.getElementById('login-err');
  errEl.style.display='none';
  if(!email||!senha){errEl.textContent='Preencha email e senha.';errEl.style.display='block';return;}
  const {data,error}=await sb.auth.signInWithPassword({email,password:senha});
  if(error){errEl.textContent='❌ '+error.message;errEl.style.display='block';return;}
  await carregarPerfil(data.user);
}

async function fazerCadastro(){
  notify('Criação de conta desativada. Solicite acesso ao administrador.','error');
}

async function esqueceuSenha(){
  const email=document.getElementById('l-email').value.trim();
  if(!email){notify('Digite seu email primeiro','error');return;}
  await sb.auth.resetPasswordForEmail(email);
  notify('Email de recuperação enviado!','success');
}

async function fazerLogout(){
  await sb.auth.signOut();
  currentUser=null; currentPerfil=null;
  goLayer('login');
}

async function carregarPerfil(user){
  currentUser=user;
  const {data}=await sb.from('perfis').select('*').eq('id',user.id).single();
  currentPerfil=data;
  iniciarApp();
}

// ══ TROCA OBRIGATÓRIA DE SENHA (PRIMEIRO ACESSO) ══
function _verificarSenhaProvisoria(){
  if(currentPerfil?.senha_provisoria){
    document.getElementById('m-primeiro-acesso')?.classList.add('show');
  }
}

async function _salvarSenhaPrimeiroAcesso(){
  const nova = document.getElementById('pa-senha-nova')?.value;
  const conf = document.getElementById('pa-senha-conf')?.value;
  const errEl = document.getElementById('pa-senha-err');
  if(errEl) errEl.style.display='none';

  if(!nova||!conf){ if(errEl){errEl.textContent='Preencha os dois campos.';errEl.style.display='block';} return; }
  if(nova.length<6){ if(errEl){errEl.textContent='A senha deve ter pelo menos 6 caracteres.';errEl.style.display='block';} return; }
  if(nova!==conf){ if(errEl){errEl.textContent='As senhas não coincidem.';errEl.style.display='block';} return; }

  const btn = document.getElementById('pa-btn-salvar');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  try{
    const {error} = await sb.auth.updateUser({password: nova});
    if(error) throw error;
    // Se for troca provisória (primeiro acesso), limpa a flag
    if(currentUser?.id){
      await sb.from('perfis').update({senha_provisoria:false}).eq('id', currentUser.id);
      if(currentPerfil) currentPerfil.senha_provisoria = false;
    }
    document.getElementById('m-primeiro-acesso')?.classList.remove('show');
    notify('Senha definida com sucesso! Faça login com a nova senha.','success');
    // Se veio do recovery (não logado), redireciona para login após 2s
    if(!currentUser){
      setTimeout(()=>{ goLayer('login'); }, 2000);
    }
  }catch(e){
    if(errEl){errEl.textContent='Erro: '+e.message;errEl.style.display='block';}
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='🔐 Definir senha e continuar'; }
  }
}

// ══ APP INIT ══
function iniciarApp(){
  const p=currentPerfil;
  const nav=document.getElementById('sidebar-nav');
  const _todosMenus = ROLE_MENUS[p.perfil]||ROLE_MENUS.atendente;
  // Filtrar pelo permissoes.paginas (só para atendente com restrições)
  const _paginasPermitidas = (p.perfil==='atendente' && p.permissoes?.paginas) ? p.permissoes.paginas : null;
  const menus = _paginasPermitidas
    ? _todosMenus.filter(m => m.section || _paginasPermitidas.includes(m.id))
    : _todosMenus;
  nav.innerHTML=menus.map(m=>{
    if(m.section) return `<div class="nav-section">${m.section}</div>`;
    return `<div class="nav-item" id="nav-${m.id}" data-inv-page="${m.invPage||''}" onclick="${m.invPage?`goInvPage('${m.invPage}');goPage('${m.id}',this)`:`goPage('${m.id}',this)`}"><span class="icon">${m.icon}</span>${m.label}</div>`;
  }).join('');

  document.getElementById('sb-avatar').textContent=(p.nome||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('sb-nome').textContent=p.nome;
  document.getElementById('sb-role').textContent=ROLE_LABELS[p.perfil];
  const chip=document.getElementById('role-chip');
  chip.textContent=ROLE_LABELS[p.perfil];
  chip.className='role-chip '+p.perfil;

  goLayer('app');

  if(p.perfil === 'investidor'){
    // Investidor: carrega dados PRIMEIRO, só depois renderiza o painel
    _invPage = 'inv-dashboard';
    goPage('investidores'); // mostra a página (vai aparecer loading)
    carregarTudo().then(()=>{
      renderInvestidores(); // re-renderiza com dados completos
    });
  } else {
    goPage('dashboard');
    carregarTudo();
  }

  // ── Inject botão hamburguer no topbar (mobile) ──
  _injectHamburguer();

  // ── Primeiro acesso: força troca de senha provisória ──
  _verificarSenhaProvisoria();
}

// ══ HAMBURGUER MOBILE ══
function _injectHamburguer(){
  if(document.getElementById('btn-hamburguer')) return;
  const topbar = document.querySelector('.topbar');
  if(!topbar) return;

  // Botão hamburguer
  const btn = document.createElement('button');
  btn.id = 'btn-hamburguer';
  btn.className = 'topbar-btn';
  btn.innerHTML = '☰';
  btn.title = 'Menu';
  btn.style.cssText = 'display:none;font-size:18px;';
  btn.onclick = toggleSidebar;
  topbar.insertBefore(btn, topbar.firstChild);

  // Overlay escuro atrás da sidebar
  const overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;display:none;';
  overlay.onclick = closeSidebar;
  // Inserir no layer-app para ficar no mesmo contexto de stacking da sidebar
  (document.getElementById('layer-app') || document.body).appendChild(overlay);

  // Mostra o botão só em mobile via resize
  function checkMobile(){
    const isMobileOrTablet = window.innerWidth <= 1024;
    btn.style.display = isMobileOrTablet ? 'flex' : 'none';
    // No mobile/tablet, sidebar começa fechada
    if(isMobileOrTablet){
      document.querySelector('.sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay').style.display = 'none';
    }
  }
  checkMobile();
  window.addEventListener('resize', checkMobile);
}

function toggleSidebar(){
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if(!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  if(overlay) overlay.style.display = isOpen ? 'block' : 'none';
}

function closeSidebar(){
  document.querySelector('.sidebar')?.classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if(overlay) overlay.style.display = 'none';
}

// Fecha sidebar ao clicar em item de menu no mobile
document.addEventListener('click', e=>{
  if(window.innerWidth > 768) return;
  if(e.target.closest('.nav-item')){
    closeSidebar();
  }
});

// ══ ALTERAR SENHA (usuário logado) ══
async function alterarSenha(){
  const atual  = document.getElementById('p-senha-atual')?.value;
  const nova   = document.getElementById('p-senha-nova')?.value;
  const conf   = document.getElementById('p-senha-conf')?.value;
  const errEl  = document.getElementById('p-senha-err');
  const okEl   = document.getElementById('p-senha-ok');

  if(errEl) errEl.style.display='none';
  if(okEl)  okEl.style.display='none';

  if(!nova||!conf){ _senhaErr('Preencha todos os campos.',errEl); return; }
  if(nova.length<6){ _senhaErr('A nova senha deve ter pelo menos 6 caracteres.',errEl); return; }
  if(nova!==conf){ _senhaErr('A confirmação não coincide com a nova senha.',errEl); return; }

  const btn = document.getElementById('btn-alterar-senha');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }

  try{
    // Reautentica com a senha atual primeiro
    const {error:reErr} = await sb.auth.signInWithPassword({
      email: currentUser.email, password: atual
    });
    if(reErr){ _senhaErr('Senha atual incorreta.',errEl); return; }

    // Atualiza para a nova senha
    const {error} = await sb.auth.updateUser({password: nova});
    if(error) throw error;

    if(okEl){ okEl.textContent='✅ Senha alterada com sucesso!'; okEl.style.display='block'; }
    notify('Senha alterada com sucesso!','success');
    ['p-senha-atual','p-senha-nova','p-senha-conf'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
  }catch(e){
    _senhaErr('Erro: '+e.message, errEl);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='🔒 Alterar senha'; }
  }
}

function abrirMinhaConta(){
  const p = currentPerfil;
  const u = currentUser;
  if(!p||!u) return;
  const ini = (p.nome||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const el = document.getElementById('mc-avatar'); if(el) el.textContent=ini;
  const nm = document.getElementById('mc-nome-display'); if(nm) nm.textContent=p.nome||'—';
  const em = document.getElementById('mc-email-display'); if(em) em.textContent=u.email||'—';
  const rl = document.getElementById('mc-role-display');
  if(rl){ rl.innerHTML=`<span class="role-chip ${p.perfil}" style="font-size:10px">${ROLE_LABELS[p.perfil]||p.perfil}</span>`; }
  // Limpa campos de senha
  ['p-senha-atual','p-senha-nova','p-senha-conf'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const errEl=document.getElementById('p-senha-err'); if(errEl) errEl.style.display='none';
  const okEl=document.getElementById('p-senha-ok');   if(okEl)  okEl.style.display='none';

  // Seção investidor — mostra e preenche só se for investidor
  const invSection = document.getElementById('mc-inv-section');
  if(invSection){
    const isInv = p.perfil==='investidor';
    invSection.style.display = isInv ? '' : 'none';
    if(isInv){
      const set = (id,val)=>{ const e=document.getElementById(id); if(e) e.value=val||''; };
      set('inv-empresa',   p.empresa||p.nome||'');
      set('inv-razao',     p.razao_social||'');
      set('inv-cnpj',      p.cnpj_cpf||'');
      set('inv-responsavel',p.responsavel||'');
      set('inv-telefone',  p.telefone||'');
      set('inv-email-emp', p.email_empresa||u.email||'');
      const errI=document.getElementById('mc-inv-err'); if(errI) errI.style.display='none';
      const okI =document.getElementById('mc-inv-ok');  if(okI)  okI.style.display='none';
    }
  }

  document.getElementById('m-minha-conta').classList.add('show');
}

async function salvarDadosInvestidor(){
  const btn = document.querySelector('#mc-inv-section .btn-primary');
  const errEl = document.getElementById('mc-inv-err');
  const okEl  = document.getElementById('mc-inv-ok');
  if(errEl) errEl.style.display='none';
  if(okEl)  okEl.style.display='none';
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }

  const dados = {
    empresa:       document.getElementById('inv-empresa')?.value.trim()||null,
    razao_social:  document.getElementById('inv-razao')?.value.trim()||null,
    cnpj_cpf:      document.getElementById('inv-cnpj')?.value.trim()||null,
    responsavel:   document.getElementById('inv-responsavel')?.value.trim()||null,
    telefone:      document.getElementById('inv-telefone')?.value.trim()||null,
    email_empresa: document.getElementById('inv-email-emp')?.value.trim()||null,
  };

  try{
    const {error} = await sb.from('perfis').update(dados).eq('id', currentUser.id);
    if(error) throw error;
    // Atualiza currentPerfil em memória
    Object.assign(currentPerfil, dados);
    if(okEl){ okEl.textContent='✅ Dados salvos com sucesso!'; okEl.style.display='block'; }
    notify('Dados da empresa atualizados!','success');
  }catch(e){
    if(errEl){ errEl.textContent='Erro: '+e.message; errEl.style.display='block'; }
    notify('Erro ao salvar: '+e.message,'error');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar dados da empresa'; }
  }
}

function _senhaErr(msg, el){
  if(!el) return;
  el.textContent=msg; el.style.display='block';
}

// Toggle mostrar/ocultar senha
function toggleSenhaVisivel(inputId, btnId){
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if(!input) return;
  const visivel = input.type==='text';
  input.type = visivel ? 'password' : 'text';
  if(btn) btn.textContent = visivel ? '👁️' : '🙈';
}

// ══ TOGGLE CAMPOS INVESTIDOR NO MODAL CRIAR ══
function _toggleCamposInvestidor(){
  const perfil = document.getElementById('r-perfil')?.value;
  const el = document.getElementById('campos-novo-investidor');
  if(el) el.style.display = perfil==='investidor' ? '' : 'none';
}

// ══ CRIAR USUÁRIO (só admin) ══
async function criarUsuarioAdmin(){
  if(currentPerfil?.perfil !== 'admin'){
    notify('Apenas administradores podem criar usuários.','error');
    return;
  }
  const nome  = document.getElementById('r-nome')?.value.trim();
  const email = document.getElementById('r-email')?.value.trim();
  const perfil= document.getElementById('r-perfil')?.value;
  const setor = document.getElementById('r-setor')?.value || null;
  const telefone   = document.getElementById('r-telefone')?.value.trim()||null;
  const cpf        = document.getElementById('r-cpf')?.value.trim()||null;
  const nascimento = document.getElementById('r-nascimento')?.value||null;
  const errEl = document.getElementById('register-err');
  const okEl  = document.getElementById('register-ok');
  const senhaResultEl = document.getElementById('r-senha-result');
  if(errEl) errEl.style.display='none';
  if(okEl)  okEl.style.display='none';
  if(senhaResultEl) senhaResultEl.style.display='none';

  if(!nome||!email){
    if(errEl){errEl.textContent='Preencha nome e e-mail.';errEl.style.display='block';}
    return;
  }

  // Gera senha provisória aleatória
  const senha = _gerarSenhaProvisoria();

  const {data:signData, error}=await sb.auth.signUp({
    email, password:senha,
    options:{data:{nome,perfil}}
  });
  if(error){
    if(errEl){errEl.textContent='❌ '+error.message;errEl.style.display='block';}
    return;
  }

  // Salva dados extras no perfil (aguarda trigger criar a linha em perfis)
  if(signData?.user){
    const dadosPerfil = {
      setor, telefone, cpf,
      data_nascimento: nascimento,
      senha_provisoria: true,
    };
    if(perfil==='investidor'){
      dadosPerfil.empresa       = document.getElementById('r-empresa')?.value.trim()||null;
      dadosPerfil.razao_social  = document.getElementById('r-razao')?.value.trim()||null;
      dadosPerfil.cnpj_cpf      = document.getElementById('r-cnpj')?.value.trim()||null;
      dadosPerfil.responsavel   = document.getElementById('r-responsavel')?.value.trim()||null;
      dadosPerfil.telefone      = document.getElementById('r-telefone-inv')?.value.trim()||telefone;
      dadosPerfil.email_empresa = document.getElementById('r-email-emp')?.value.trim()||null;
    }
    setTimeout(async()=>{
      await sb.from('perfis').update(dadosPerfil).eq('id', signData.user.id);
    }, 2000);
  }

  if(okEl){okEl.textContent='✓ Usuário criado com sucesso!';okEl.style.display='block';}
  if(senhaResultEl){
    document.getElementById('r-senha-valor').textContent = senha;
    senhaResultEl.style.display='block';
  }
  notify('Usuário '+nome+' criado com sucesso!','success');
  ['r-nome','r-email','r-telefone','r-cpf','r-nascimento','r-empresa','r-razao','r-cnpj','r-responsavel','r-telefone-inv','r-email-emp'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('campos-novo-investidor').style.display='none';
  document.getElementById('r-perfil').value='atendente';
  document.getElementById('r-setor').value='';
}

function _gerarSenhaProvisoria(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let senha = '';
  for(let i=0;i<8;i++) senha += chars[Math.floor(Math.random()*chars.length)];
  return senha;
}

function _copiarSenhaProvisoria(){
  const txt = document.getElementById('r-senha-valor')?.textContent;
  if(!txt) return;
  navigator.clipboard.writeText(txt).then(()=>notify('Senha copiada!','success')).catch(()=>{});
}

// ══ ALTERAR SENHA ══

// ══ MODAL MEU PERFIL ══
function abrirModalMeuPerfil(){
  const p = currentPerfil;
  const u = currentUser;
  if(!p||!u) return;

  const ini = (p.nome||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const av = document.getElementById('mp-avatar'); if(av) av.textContent=ini;
  const nm = document.getElementById('mp-nome');   if(nm) nm.textContent=p.nome||'—';
  const em = document.getElementById('mp-email');  if(em) em.textContent=u.email||'—';
  const ro = document.getElementById('mp-role');   if(ro){ ro.textContent=ROLE_LABELS[p.perfil]||p.perfil; ro.className='role-chip '+p.perfil; }

  const setorDisplay = document.getElementById('mp-setor-display');
  if(setorDisplay) setorDisplay.textContent = p.setor || 'Não definido (solicite ao administrador)';
  _atualizarPreviewSetor();

  // Limpa campos e feedbacks
  ['nova-senha','conf-senha'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['senha-err','senha-ok'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; });

  document.getElementById('m-meu-perfil').classList.add('show');
}

function _atualizarPreviewSetor(){
  const nomeEl = document.getElementById('mp-setor-preview');
  const setorEl = document.getElementById('mp-setor-preview2');
  if(nomeEl) nomeEl.textContent = (currentPerfil?.nome||'SEU NOME').toUpperCase();
  if(setorEl) setorEl.textContent = currentPerfil?.setor?.trim() || 'Setor';
}
