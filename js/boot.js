// boot.js — Inicialização do sistema
const FP_URL = 'https://jjeogfafgbexgxqhubha.supabase.co';
const FP_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZW9nZmFmZ2JleGd4cWh1YmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTA1MzUsImV4cCI6MjA4OTk2NjUzNX0.Y8ZrP5kM8dySPaWvWELAPgXAFaAo9iN7ucKKEQzc_DE';

// Flag global — evita reinicializar o app quando o Supabase dispara auth events
let _appIniciado = false;

// ── PRESENÇA (painel Desempenho) ──
// Heartbeat: a cada 60s com a aba visível, soma 1 minuto em presenca_diaria
// via RPC registrar_presenca(). Idempotente (não cria intervalos duplicados)
// e fail-safe: qualquer erro é silencioso, nunca afeta o app.
let _presencaTimer = null;
function iniciarPresenca(){
  if(_presencaTimer) return;
  _presencaTimer = setInterval(async ()=>{
    if(document.visibilityState !== 'visible') return;
    try{ await sb.rpc('registrar_presenca'); }catch(_e){ /* silencioso */ }
  }, 60000);
}

window.addEventListener('DOMContentLoaded', async()=>{
  const url = localStorage.getItem('fp_url') || FP_URL;
  const key = localStorage.getItem('fp_key') || FP_KEY;
  if(!localStorage.getItem('fp_url')) localStorage.setItem('fp_url', FP_URL);
  if(!localStorage.getItem('fp_key')) localStorage.setItem('fp_key', FP_KEY);

  // ── Detecta erros na URL (ex: link expirado) ──
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const urlError = params.get('error');
  const urlErrorCode = params.get('error_code');
  if(urlError){
    history.replaceState(null,'',window.location.pathname);
    goLayer('login');
    const msgEl = document.getElementById('login-recovery-msg');
    if(msgEl){
      const isExpired = urlErrorCode === 'otp_expired';
      msgEl.style.display = 'block';
      msgEl.style.background = 'rgba(248,113,113,.1)';
      msgEl.style.borderColor = 'rgba(248,113,113,.3)';
      msgEl.innerHTML = `
        <div style="font-size:20px;margin-bottom:6px">${isExpired ? '⏰' : '❌'}</div>
        <div style="font-size:13px;font-weight:600;color:#F87171;margin-bottom:4px">${isExpired ? 'Link expirado' : 'Link inválido'}</div>
        <div style="font-size:12px;color:var(--muted)">${isExpired ? 'Este link de redefinição expirou. Clique em "Esqueci minha senha" para solicitar um novo.' : 'O link é inválido. Solicite uma nova redefinição de senha.'}</div>
      `;
    }
    return;
  }

  goLayer('app');
  sb = createClient(url, key, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  // ── Detecta link de redefinição de senha ──
  sb.auth.onAuthStateChange((event, session)=>{
    if(event === 'PASSWORD_RECOVERY'){
      // Limpa o hash da URL para não reprocessar
      history.replaceState(null,'',window.location.pathname);
      // Mostra o modal de definir nova senha (mesmo do primeiro acesso)
      goLayer('app');
      setTimeout(()=>{
        document.getElementById('m-primeiro-acesso')?.classList.add('show');
      }, 800);
    }
  });

  try{
    const {data:{session}, error} = await sb.auth.getSession();
    if(error) throw error;
    if(session?.user){
      await carregarPerfil(session.user);
      _appIniciado = true;
      iniciarPresenca();
      if(currentPerfil?.perfil !== 'investidor'){
        const lastPage = sessionStorage.getItem('fp_last_page');
        const lastChat = sessionStorage.getItem('fp_last_chat');
        sessionStorage.removeItem('fp_last_page');
        sessionStorage.removeItem('fp_last_chat');
        if(lastPage){
          setTimeout(async ()=>{
            goPage(lastPage);
            if(lastPage==='chat' && lastChat){
              // Aguarda carregarTudo (allClientes, allVeiculos etc.) antes de abrir o chat
              if(window._carregarTudoPromise) await window._carregarTudoPromise;
              if(typeof abrirChat==='function') abrirChat(lastChat);
            }
          }, 800);
        }
      }
    } else {
      goLayer('login');
    }
  }catch(e){
    goLayer('login');
  }

  sb.auth.onAuthStateChange(async(event, session)=>{
    // Ignora eventos disparados após o app já estar rodando
    // (ex: recriação do cliente Supabase no visibilitychange)
    if(event==='SIGNED_IN' && session?.user){
      if(_appIniciado){
        // App já rodando — só atualiza currentUser/currentPerfil sem reiniciar
        currentUser = session.user;
        if(!currentPerfil){
          const {data} = await sb.from('perfis').select('*').eq('id', session.user.id).single();
          currentPerfil = data;
        }
        return;
      }
      // App ainda não tinha terminado de iniciar (corrida com getSession) —
      // captura a página atual ANTES de reiniciar, pois iniciarApp() força 'dashboard'.
      const lastPage = sessionStorage.getItem('fp_last_page');
      const lastChat = sessionStorage.getItem('fp_last_chat');
      await carregarPerfil(session.user);
      _appIniciado = true;
      iniciarPresenca();
      if(lastPage && lastPage!=='dashboard' && currentPerfil?.perfil !== 'investidor'){
        setTimeout(async ()=>{
          goPage(lastPage);
          if(lastPage==='chat' && lastChat){
            if(window._carregarTudoPromise) await window._carregarTudoPromise;
            if(typeof abrirChat==='function') abrirChat(lastChat);
          }
        }, 400);
      }
    }
    if(event==='SIGNED_OUT') goLayer('login');
  });

  const cfg = JSON.parse(localStorage.getItem('fp_evo_cfg')||'{}');
  if(cfg.bridgeUrl && cfg.secret){
    setTimeout(()=> conectarSSE(cfg.bridgeUrl, cfg.secret), 2500);
  }
});
