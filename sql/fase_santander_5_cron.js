// ══ CRON — GERAR COBRANÇAS SANTANDER (N dias antes do vencimento) ══
//
// Diferente do Asaas (que gera cobranças futuras sozinho via "assinatura"),
// o Santander não tem esse conceito — cada cobranca_semanal vira UMA chamada
// de criação de boleto/PIX individual. Este cron varre as cobranças
// pendentes de locações marcadas com provedor_cobranca='santander' e cria
// a cobrança no banco DIAS_ANTECEDENCIA dias antes do vencimento.
//
// Depois de criar com sucesso, avisa o cliente via WhatsApp automaticamente
// com o link de pagamento — só nesse caminho (cron), não quando o próprio
// cliente clica em "Gerar forma de pagamento" na pagar.html (ele já está
// vendo a tela ali, não precisa de mensagem extra).
//
// Roda a cada 6h (mesmo intervalo do cron de sync do Asaas hoje).

const DIAS_ANTECEDENCIA = 3; // ajustar conforme preferência do negócio
// ⚠️ ATENÇÃO: pagar.html ainda só existe na branch dev (não foi mesclada
// pra main/produção ainda). Enquanto isso não mudar, o link tem que
// apontar pro domínio de dev — senão o cliente recebe um link que dá 404.
// TROCAR pra 'https://fleetpro.ruahsystems.com.br' assim que for pra produção.
const URL_BASE_PAGAMENTO = 'https://dev.fleetpro.ruahsystems.com.br';

async function gerarCobrancasSantanderPendentes(){
  try{
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ANTECEDENCIA);
    const limiteStr = limite.toISOString().slice(0,10);

    const { data: pendentes, error } = await sb.from('cobrancas_semanais')
      .select(`id, numero_semana, data_vencimento, valor, locacoes!inner(provedor_cobranca, num_contrato,
        veiculos(marca, modelo), clientes(nome, telefone))`)
      .eq('status', 'pendente')
      .is('santander_bank_number', null)
      .eq('locacoes.provedor_cobranca', 'santander')
      .lte('data_vencimento', limiteStr);
    if(error) throw error;

    for(const c of (pendentes || [])){
      try{
        const resp = await fetch(`http://localhost:${PORT}/api/santander/criar-cobranca`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ cobranca_id: c.id }),
        });
        if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
        console.log(`[cron/santander] cobrança criada para ${c.id}`);

        // Avisa o cliente via WhatsApp com o link de pagamento
        const cliente = c.locacoes?.clientes;
        if(cliente?.telefone){
          try{
            const veiculo = c.locacoes?.veiculos ? `${c.locacoes.veiculos.marca} ${c.locacoes.veiculos.modelo}` : 'seu veículo';
            const dataFmt = new Date(c.data_vencimento+'T12:00:00').toLocaleDateString('pt-BR');
            const link = `${URL_BASE_PAGAMENTO}/pagar.html?semana=${c.id}`;
            const texto = `Olá, ${cliente.nome?.split(' ')[0]||''}! 👋\n\nSua cobrança semanal (${veiculo} — Contrato #${c.locacoes?.num_contrato}) já está disponível:\n\n💰 Valor: R$ ${Number(c.valor).toFixed(2)}\n📅 Vencimento: ${dataFmt}\n\nPague por PIX ou boleto aqui:\n${link}\n\n_Pagando até 2 dias antes do vencimento, você garante 5% de desconto._`;

            await fetch(`http://localhost:${PORT}/api/enviar-mensagem`, {
              method: 'POST',
              headers: {'x-secret':'FleetPro2025','Content-Type':'application/json'},
              body: JSON.stringify({ numero: cliente.telefone, texto, nomeAtendente: '🤖 Cobrança automática' }),
            });
            console.log(`[cron/santander] WhatsApp enviado para ${cliente.nome} (cobranca ${c.id})`);
          }catch(eWpp){
            console.error(`[cron/santander] falhou ao enviar WhatsApp da cobranca ${c.id}:`, eWpp.message);
          }
        }else{
          console.warn(`[cron/santander] cobranca ${c.id} sem telefone do cliente — WhatsApp não enviado`);
        }
      }catch(e){
        console.error(`[cron/santander] falhou para cobranca ${c.id}:`, e.message);
      }
    }
  }catch(e){
    console.error('[cron/santander-gerar]', e.message);
  }
}

gerarCobrancasSantanderPendentes();
setInterval(gerarCobrancasSantanderPendentes, 6*60*60*1000); // a cada 6 horas
