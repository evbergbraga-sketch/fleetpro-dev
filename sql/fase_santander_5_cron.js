// ══ CRON — RÉGUA DE COBRANÇA SANTANDER (roda 3x/dia: 10h, 17h, 20h - horário de Brasília) ══
//
// Cada cobranca_semanal pendente recebe UMA notificação por dia,
// dependendo de quantos dias faltam (ou já passaram) do vencimento:
//   2 dias antes  → oferece desconto de 5% (último dia da janela de desconto)
//   1 dia antes   → lembrete "vence amanhã"
//   no dia        → "vence hoje"
//   atrasado      → "atrasado há X dias" (repete 1x/dia até pagar)
//
// O boleto/PIX é gerado (se ainda não existir) no momento da primeira
// notificação que a cobrança receber — geralmente nos "2 dias antes",
// mas se por algum motivo a cobrança só entrar na régua depois disso
// (ex: contrato criado em cima da hora), gera na hora mesmo assim.
//
// Roda de verdade só nas 3 janelas de horário — checagem a cada 5 min,
// com controle de "já notificado hoje" pra nunca duplicar mensagem.

const HORARIOS_ENVIO = [10, 17, 20]; // horas, horário de Brasília (UTC-3, sem horário de verão)
// ⚠️ pagar.html ainda só existe na branch dev — trocar pra
// 'https://fleetpro.ruahsystems.com.br' quando for pra produção.
const URL_BASE_PAGAMENTO = 'https://dev.fleetpro.ruahsystems.com.br';

function _horaBrasilia(){
  const agora = new Date();
  return new Date(agora.getTime() - 3*60*60*1000).getUTCHours(); // UTC-3 fixo (Brasil não tem mais horário de verão)
}

function _dataBrasiliaISO(){
  const agora = new Date();
  const br = new Date(agora.getTime() - 3*60*60*1000);
  return br.toISOString().slice(0,10);
}

async function _enviarWhatsApp(numero, texto){
  await fetch(`http://localhost:${PORT}/api/enviar-mensagem`, {
    method: 'POST',
    headers: {'x-secret':'FleetPro2025','Content-Type':'application/json'},
    body: JSON.stringify({ numero, texto, nomeAtendente: '🤖 Cobrança automática' }),
  });
}

function _montarMensagem(tipo, ctx){
  const { primeiroNome, veiculo, numContrato, valor, dataFmt, link, diasAtraso } = ctx;
  const valorFmt = Number(valor).toFixed(2);
  switch(tipo){
    case 'desconto':
      return `Olá, ${primeiroNome}! 👋\n\nSua cobrança semanal (${veiculo} — Contrato #${numContrato}) vence em 2 dias (${dataFmt}).\n\n💰 Valor: R$ ${valorFmt}\n\n✨ *Hoje é o último dia* pra pagar com 5% de desconto!\n\nPague por PIX ou boleto aqui:\n${link}`;
    case 'lembrete_amanha':
      return `Olá, ${primeiroNome}! 👋\n\nSó lembrando: sua cobrança semanal (${veiculo} — Contrato #${numContrato}) vence *amanhã* (${dataFmt}).\n\n💰 Valor: R$ ${valorFmt}\n\nPague por PIX ou boleto aqui:\n${link}`;
    case 'vence_hoje':
      return `Olá, ${primeiroNome}! 👋\n\nSua cobrança semanal (${veiculo} — Contrato #${numContrato}) *vence hoje*.\n\n💰 Valor: R$ ${valorFmt}\n\nPague por PIX ou boleto aqui:\n${link}`;
    case 'atrasado':
      return `Olá, ${primeiroNome}. ⚠️\n\nSua cobrança semanal (${veiculo} — Contrato #${numContrato}) está *atrasada há ${diasAtraso} dia(s)* (venceu em ${dataFmt}).\n\nO valor já inclui multa e juros por atraso — confira o valor atualizado no link abaixo.\n\nRegularize hoje pra evitar bloqueio do veículo:\n${link}`;
    default:
      return null;
  }
}

async function reguaDeCobrancaSantander(forcar){
  try{
    const horaAtual = _horaBrasilia();
    if(!forcar && !HORARIOS_ENVIO.includes(horaAtual)) return; // fora das janelas de envio, não faz nada

    const hoje = _dataBrasiliaISO();

    // Traz tudo que está pendente e ainda não foi notificado hoje —
    // filtra os "dias até vencer" certos em JS (mais simples que SQL aqui)
    const { data: candidatas, error } = await sb.from('cobrancas_semanais')
      .select(`id, data_vencimento, valor, santander_bank_number, santander_notif_data,
        locacoes!inner(provedor_cobranca, num_contrato, veiculos(marca, modelo), clientes(nome, telefone))`)
      .eq('status', 'pendente')
      .eq('locacoes.provedor_cobranca', 'santander')
      .or(`santander_notif_data.is.null,santander_notif_data.lt.${hoje}`);
    if(error) throw error;

    for(const c of (candidatas || [])){
      try{
        const diasParaVencer = Math.round((new Date(c.data_vencimento+'T12:00:00') - new Date(hoje+'T12:00:00')) / 86400000);

        let tipo = null;
        if(diasParaVencer === 2) tipo = 'desconto';
        else if(diasParaVencer === 1) tipo = 'lembrete_amanha';
        else if(diasParaVencer === 0) tipo = 'vence_hoje';
        else if(diasParaVencer < 0) tipo = 'atrasado';
        if(!tipo) continue; // fora da janela de interesse (ex: vence daqui 10 dias) — não faz nada ainda

        // Gera o boleto/PIX agora, se ainda não existir
        if(!c.santander_bank_number){
          const respCriar = await fetch(`http://localhost:${PORT}/api/santander/criar-cobranca`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ cobranca_id: c.id }),
          });
          if(!respCriar.ok) throw new Error(`criar-cobranca HTTP ${respCriar.status}`);
          console.log(`[regua/santander] cobrança criada para ${c.id}`);
        }

        const cliente = c.locacoes?.clientes;
        if(!cliente?.telefone){
          console.warn(`[regua/santander] cobranca ${c.id} sem telefone do cliente — mensagem não enviada`);
        }else{
          const texto = _montarMensagem(tipo, {
            primeiroNome: cliente.nome?.split(' ')[0] || '',
            veiculo: c.locacoes?.veiculos ? `${c.locacoes.veiculos.marca} ${c.locacoes.veiculos.modelo}` : 'seu veículo',
            numContrato: c.locacoes?.num_contrato,
            valor: c.valor,
            dataFmt: new Date(c.data_vencimento+'T12:00:00').toLocaleDateString('pt-BR'),
            link: `${URL_BASE_PAGAMENTO}/pagar.html?semana=${c.id}`,
            diasAtraso: Math.abs(diasParaVencer),
          });
          await _enviarWhatsApp(cliente.telefone, texto);
          console.log(`[regua/santander] WhatsApp '${tipo}' enviado para ${cliente.nome} (cobranca ${c.id})`);
        }

        await sb.from('cobrancas_semanais').update({ santander_notif_data: hoje }).eq('id', c.id);
      }catch(e){
        console.error(`[regua/santander] falhou para cobranca ${c.id}:`, e.message);
      }
    }
  }catch(e){
    console.error('[regua/santander-geral]', e.message);
  }
}

reguaDeCobrancaSantander(); // roda uma vez ao subir (só executa de verdade se já estiver numa das 3 janelas)
setInterval(reguaDeCobrancaSantander, 5*60*1000); // checa a cada 5 minutos

// Gatilho manual pra testes — roda a régua ignorando a janela de horário.
// Protegido por x-secret. Fica disponível pra depuração futura, sem custo
// (só executa quando chamado).
app.post('/api/santander/regua-forcar', async (req, res) => {
  if(req.headers['x-secret'] !== 'FleetPro2025') return res.status(401).json({error:'unauthorized'});
  try{
    await reguaDeCobrancaSantander(true);
    res.json({ok:true, message:'Régua executada manualmente'});
  }catch(e){
    res.status(500).json({error: e.message});
  }
});
