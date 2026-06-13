// ajuda.js — Guia "Como Funciona" (visão geral para Locadora Royal)

const AJUDA_SECOES = [
  {
    icon: '🚗',
    titulo: '1. Frota (Carros e Motos)',
    resumo: 'Cadastro e controle de todos os veículos da locadora.',
    conteudo: `
      <p>Em <strong>Carros</strong> e <strong>Motos</strong> você cadastra cada veículo da frota: placa, modelo, ano, cor, KM atual, documentação e fotos.</p>
      <p>Cada veículo tem um <strong>status</strong>:</p>
      <ul>
        <li>🟢 <strong>Disponível</strong> — pronto para nova locação</li>
        <li>🔵 <strong>Alugado</strong> — em uso por um cliente</li>
        <li>🟡 <strong>Em manutenção</strong> — fora de operação temporariamente</li>
      </ul>
      <p>O sistema atualiza esse status automaticamente quando um contrato é criado ou uma devolução é concluída — não é preciso alterar manualmente.</p>
    `,
  },
  {
    icon: '👤',
    titulo: '2. Clientes',
    resumo: 'Cadastro completo de clientes, documentos e histórico.',
    conteudo: `
      <p>Cada cliente tem um perfil com dados pessoais, CNH, telefones (incluindo contatos de familiares), endereço, dados de cartão e redes sociais.</p>
      <p>No perfil do cliente você também encontra:</p>
      <ul>
        <li>📋 Todos os contratos (ativos e encerrados)</li>
        <li>💰 Total gasto pelo cliente</li>
        <li>💬 Histórico de conversas no WhatsApp</li>
      </ul>
    `,
  },
  {
    icon: '📅',
    titulo: '3. Reservas',
    resumo: 'Pré-agendamento de locações antes de virar contrato.',
    conteudo: `
      <p>Uma <strong>reserva</strong> bloqueia um veículo para um cliente em uma data futura, sem ainda gerar o contrato definitivo.</p>
      <p>Quando o cliente chega para retirar o veículo, a reserva é <strong>convertida em contrato</strong> com um clique — todos os dados (cliente, veículo, valores) já vêm preenchidos automaticamente.</p>
    `,
  },
  {
    icon: '📄',
    titulo: '4. Contratos — Como criar',
    resumo: 'Passo a passo para gerar um novo contrato de locação.',
    conteudo: `
      <p>Na página <strong>Contratos</strong>, escolha o tipo: 🚗 Carro ou 🏍️ Moto.</p>
      <ol>
        <li><strong>Cliente e veículo</strong> — selecione quem vai alugar e qual veículo.</li>
        <li><strong>Período</strong> — data/hora de retirada e devolução (para motos com plano de assinatura, a devolução é calculada automaticamente).</li>
        <li><strong>Valores</strong> — defina a diária/semanal, aplique <strong>desconto</strong> (em R$ ou %) se necessário, e a caução.</li>
        <li><strong>Pagamento no ato</strong> — informe quanto o cliente já está pagando agora. O sistema calcula automaticamente o <strong>valor restante</strong>. É possível dividir o pagamento em duas formas (ex: parte PIX + parte cartão).</li>
        <li><strong>Pré-visualização</strong> — confira todos os dados antes de gerar.</li>
      </ol>
      <p>Ao confirmar, o sistema gera o <strong>PDF do contrato</strong>, envia para o WhatsApp do cliente e (se configurado) inicia a assinatura digital via Autentique.</p>
    `,
  },
  {
    icon: '🏍️',
    titulo: '5. Planos de Assinatura (Motos)',
    resumo: 'Planos semanais de 12 ou 36 meses para motos.',
    conteudo: `
      <p>As motos podem ser alugadas por <strong>planos de assinatura semanal</strong>:</p>
      <ul>
        <li><strong>Plano 12 meses</strong> — 52 semanas</li>
        <li><strong>Plano Conquista 36 meses</strong> — 156 semanas</li>
      </ul>
      <p>Ao escolher o plano, o sistema:</p>
      <ul>
        <li>Calcula automaticamente a data de devolução final</li>
        <li>Gera o cronograma completo de cobranças semanais</li>
        <li>Registra a caução e (se aplicável) a primeira semana no financeiro</li>
        <li>Cria a cobrança recorrente no Asaas, que envia os links de pagamento ao cliente automaticamente</li>
      </ul>
      <p>No detalhe da locação, a aba <strong>Cobranças Semanais</strong> mostra todas as semanas, com status: <span style="color:var(--green);font-weight:600">✓ Pago</span>, ⏳ Pendente ou <span style="color:var(--red);font-weight:600">⚠ Atrasado</span>. Pagamentos em dinheiro na loja podem ser marcados manualmente clicando na semana.</p>
    `,
  },
  {
    icon: '✅',
    titulo: '6. Devolução do Veículo',
    resumo: 'Checklist de saída/entrada e encerramento do contrato.',
    conteudo: `
      <p>Cada contrato tem duas vistorias:</p>
      <ul>
        <li><strong>Saída</strong> — feita na entrega do veículo (KM, combustível, fotos, observações)</li>
        <li><strong>Entrada</strong> — feita na devolução</li>
      </ul>
      <p>Na vistoria de <strong>Entrada</strong>, é possível registrar <strong>Pagamentos da Devolução</strong> (multas, tag/pedágio, reparos, lavagem) — todos entram como receita no financeiro.</p>
      <p><strong>⚠️ Importante:</strong> se o contrato tiver <strong>saldo restante</strong> (valor ainda não pago), o sistema <strong>bloqueia a devolução</strong> até que o pagamento seja informado (com a forma de pagamento). Isso garante que nenhum veículo seja liberado sem o pagamento completo.</p>
      <p>Ao concluir, o sistema marca o contrato como <strong>encerrado</strong>, libera o veículo (volta a ficar "Disponível") e atualiza o histórico automaticamente.</p>
    `,
  },
  {
    icon: '📆',
    titulo: '7. Extensão de Contrato',
    resumo: 'Adicionar diárias/semanas extras a uma locação ativa.',
    conteudo: `
      <p>Em qualquer locação <strong>ativa</strong>, a aba <strong>Estender</strong> permite adicionar diárias (carro) ou semanas (moto) extras.</p>
      <p>O sistema:</p>
      <ul>
        <li>Calcula a nova data de devolução automaticamente</li>
        <li>Permite adicionar <strong>serviços extras</strong> (ex: cadeirinha, GPS)</li>
        <li>Mostra o valor total da extensão</li>
        <li>Gera um <strong>PDF de Aditivo Contratual</strong> para assinatura</li>
      </ul>
      <p>Se o cliente já pagou na hora, o valor entra direto no financeiro. Se não, soma ao saldo restante e será cobrado na devolução.</p>
    `,
  },
  {
    icon: '💰',
    titulo: '8. Financeiro',
    resumo: 'Fluxo de caixa, receitas, despesas e relatórios.',
    conteudo: `
      <p>O <strong>Fluxo de Caixa</strong> registra automaticamente todas as movimentações geradas pelo sistema:</p>
      <ul>
        <li>Receita de aluguel (contrato, semanas de plano, extensões, saldo final)</li>
        <li>Caução recebida</li>
        <li>Pagamentos da devolução (multas, danos, lavagem, tag/pedágio)</li>
        <li>Despesas de manutenção</li>
      </ul>
      <p>É possível filtrar por período, tipo, categoria e veículo, além de exportar relatórios em PDF.</p>
      <p>No detalhe de cada locação, a seção <strong>Histórico de Pagamentos e Aditivos</strong> mostra todos os lançamentos relacionados àquele contrato, com data, forma de pagamento e origem.</p>
    `,
  },
  {
    icon: '💬',
    titulo: '9. Chat WhatsApp',
    resumo: 'Atendimento integrado direto pelo sistema.',
    conteudo: `
      <p>Toda a equipe pode atender pelo mesmo número de WhatsApp da locadora, direto pelo FleetPro — sem precisar de WhatsApp Web ou QR Code individual.</p>
      <p>Cada mensagem enviada recebe automaticamente a <strong>assinatura do atendente</strong> (nome e setor), para o cliente saber quem está respondendo.</p>
      <p>O assistente automático <strong>SARA</strong> (identificado com 🤖 e cor roxa) pode responder dúvidas simples automaticamente, 24h por dia.</p>
    `,
  },
  {
    icon: '📊',
    titulo: '10. Investidores',
    resumo: 'Painel para acompanhamento de veículos investidos.',
    conteudo: `
      <p>Investidores têm acesso a um painel próprio mostrando:</p>
      <ul>
        <li>Veículos em que investiram e seu status atual</li>
        <li>Rendimentos gerados</li>
        <li>Localização via rastreador (quando disponível)</li>
      </ul>
      <p>O acesso é restrito apenas às informações dos veículos vinculados a cada investidor.</p>
    `,
  },
];

function renderAjudaAcordeon(){
  const wrap = document.getElementById('ajuda-acordeon');
  if(!wrap) return;
  wrap.innerHTML = AJUDA_SECOES.map((s,i)=>`
    <div class="ajuda-item" style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;margin-bottom:10px;overflow:hidden">
      <div onclick="_toggleAjuda(${i})" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none">
        <span style="font-size:22px">${s.icon}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px;color:var(--text)">${s.titulo}</div>
          <div style="font-size:12px;color:var(--muted2)">${s.resumo}</div>
        </div>
        <span id="ajuda-chevron-${i}" style="font-size:13px;color:var(--muted);transition:transform .2s">▼</span>
      </div>
      <div id="ajuda-conteudo-${i}" style="display:none;padding:0 16px 16px 16px;font-size:13px;line-height:1.6;color:var(--text2)">
        ${s.conteudo}
      </div>
    </div>`).join('');
}

function _toggleAjuda(i){
  const conteudo = document.getElementById(`ajuda-conteudo-${i}`);
  const chevron  = document.getElementById(`ajuda-chevron-${i}`);
  if(!conteudo) return;
  const aberto = conteudo.style.display !== 'none';
  conteudo.style.display = aberto ? 'none' : 'block';
  if(chevron) chevron.style.transform = aberto ? 'rotate(0deg)' : 'rotate(180deg)';
}
