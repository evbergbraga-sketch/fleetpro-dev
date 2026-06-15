// ══════════════════════════════════════════════════════════════════
// FLEETPRO API v1 — Endpoints para n8n e agente de IA
// Adicionar este bloco no fleetpro-bridge-server.js
// ══════════════════════════════════════════════════════════════════
//
// AUTENTICAÇÃO: Bearer token no header Authorization
//   Authorization: Bearer fp_live_SEU_TOKEN_AQUI
//
// Gerar token seguro (rodar no terminal):
//   node -e "require('crypto').randomBytes(32).toString('hex').then?console.log:console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Configurar no .env do bridge:
//   FLEETPRO_API_KEY=fp_live_xxxxxxxxxxxx
//
// Base URL: https://bridge.ruahsystems.com.br/api/v1
// ══════════════════════════════════════════════════════════════════

// ── MIDDLEWARE DE AUTENTICAÇÃO ──
function autenticarAPI(req, res, next){
  const header = req.headers['authorization']||'';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token || token !== process.env.FLEETPRO_API_KEY){
    return res.status(401).json({ error: 'Não autorizado. Forneça um Bearer token válido.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/crm/leads
// Adiciona um lead no CRM (via n8n ou agente de IA)
//
// Body (JSON):
//   nome            string  obrigatório — nome ou apelido do lead
//   telefone        string  obrigatório — ex: "21999991234" (com DDD, sem 55)
//   interesse       string  opcional   — "carro" | "moto" | "ambos" | "indefinido"
//   status_crm      string  opcional   — label do status (ex: "Interesse", "Potencial")
//   observacoes     string  opcional   — nota inicial sobre o lead
//   responsavel_id  uuid    opcional   — ID do atendente responsável (perfis.id)
//   origem          string  opcional   — ex: "Instagram", "WhatsApp", "Indicação"
//
// Response 201: { ok: true, lead: { id, nome, telefone, status_crm } }
// ─────────────────────────────────────────────────────────────────
app.post('/api/v1/crm/leads', autenticarAPI, async (req, res) => {
  try{
    const { nome, telefone, interesse, status_crm, observacoes, responsavel_id, origem } = req.body;

    if(!nome?.trim())     return res.status(400).json({ error: 'Campo "nome" é obrigatório.' });
    if(!telefone?.trim()) return res.status(400).json({ error: 'Campo "telefone" é obrigatório.' });

    // Verifica se já existe um cliente/lead com esse telefone
    const telLimpo = String(telefone).replace(/\D/g,'').slice(-11);
    const { data: existente } = await sb.from('clientes')
      .select('id, nome, tipo, status_crm')
      .ilike('telefone', `%${telLimpo}`)
      .maybeSingle();

    if(existente){
      return res.status(409).json({
        error: 'Já existe um registro com esse telefone.',
        existente: { id: existente.id, nome: existente.nome, tipo: existente.tipo, status_crm: existente.status_crm }
      });
    }

    const { data: lead, error } = await sb.from('clientes').insert({
      nome:              nome.trim(),
      telefone:          telLimpo,
      tipo:              'lead',
      status_crm:        status_crm || 'Interesse',
      interesse_veiculo: interesse  || 'indefinido',
      observacoes:       observacoes?.trim() || null,
      responsavel_id:    responsavel_id || null,
      origem:            origem?.trim() || null,
    }).select('id, nome, telefone, tipo, status_crm, interesse_veiculo, origem, created_at').single();

    if(error) throw error;

    console.log(`[api/v1/crm/leads] Lead criado: ${lead.nome} (${lead.id})`);
    res.status(201).json({ ok: true, lead });

  }catch(e){
    console.error('[api/v1/crm/leads POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/v1/crm/leads/:id/status
// Move um lead para outro status no pipeline
//
// Params:
//   id — UUID do cliente/lead (clientes.id)
//
// Body (JSON):
//   status   string  obrigatório — label do status (ex: "Potencial", "Ativo", "Reprovado")
//   nota     string  opcional    — registra uma nota interna junto com a mudança
//
// Response 200: { ok: true, id, status_anterior, status_novo }
// ─────────────────────────────────────────────────────────────────
app.patch('/api/v1/crm/leads/:id/status', autenticarAPI, async (req, res) => {
  try{
    const { id }    = req.params;
    const { status, nota } = req.body;

    if(!status?.trim()) return res.status(400).json({ error: 'Campo "status" é obrigatório.' });

    // Verifica se o status existe na tabela crm_status
    const { data: statusValido } = await sb.from('crm_status')
      .select('id, label')
      .eq('label', status.trim())
      .eq('ativo', true)
      .maybeSingle();

    if(!statusValido) return res.status(400).json({
      error: `Status "${status}" não encontrado no pipeline. Verifique os status cadastrados.`
    });

    // Busca o lead atual
    const { data: lead, error: errLead } = await sb.from('clientes')
      .select('id, nome, status_crm, tipo')
      .eq('id', id)
      .maybeSingle();

    if(errLead || !lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const statusAnterior = lead.status_crm;

    // Atualiza o status
    const { error } = await sb.from('clientes')
      .update({ status_crm: status.trim() })
      .eq('id', id);

    if(error) throw error;

    // Registra a mudança como nota interna (se enviada) e sempre como encaminhamento de log
    const promises = [];

    if(nota?.trim()){
      promises.push(
        sb.from('notas_internas').insert({
          cliente_id: id,
          texto: nota.trim(),
          criado_por: null, // API (sem usuário específico)
        })
      );
    }

    // Registra histórico de movimentação
    promises.push(
      sb.from('notas_internas').insert({
        cliente_id: id,
        texto: `🤖 Status atualizado via API: "${statusAnterior}" → "${status.trim()}"`,
        criado_por: null,
      })
    );

    await Promise.all(promises);

    console.log(`[api/v1/crm/leads/${id}/status] ${lead.nome}: ${statusAnterior} → ${status}`);
    res.json({ ok: true, id, nome: lead.nome, status_anterior: statusAnterior, status_novo: status.trim() });

  }catch(e){
    console.error('[api/v1/crm/leads/:id/status PATCH]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/veiculos/disponibilidade
// Verifica quais veículos estão disponíveis (com filtro opcional)
//
// Query params (todos opcionais):
//   tipo    — "carro" | "moto"
//   data    — "YYYY-MM-DD" — considera buffer de 4h após devolução
//
// Response 200: { disponiveis: [...], total: N, consultado_em: "..." }
// ─────────────────────────────────────────────────────────────────
app.get('/api/v1/veiculos/disponibilidade', autenticarAPI, async (req, res) => {
  try{
    const { tipo, data } = req.query;

    // Busca todos os veículos (com filtro de tipo se informado)
    let query = sb.from('veiculos')
      .select('id, marca, modelo, placa, tipo, status, diaria, km_atual, cor, ano')
      .order('tipo').order('marca');

    if(tipo) query = query.eq('tipo', tipo);

    const { data: veiculos, error } = await query;
    if(error) throw error;

    let disponiveis = [];
    let alugados    = [];
    let manutencao  = [];

    if(data){
      // Se data informada: considera locações ativas com devolução próxima (buffer 4h)
      const dataRef = new Date(data+'T00:00:00');

      const { data: locacoes } = await sb.from('locacoes')
        .select('veiculo_id, data_fim, data_fim_hora')
        .eq('status', 'ativa');

      const locsByVei = {};
      (locacoes||[]).forEach(l => { locsByVei[l.veiculo_id] = l; });

      veiculos.forEach(v => {
        const loc = locsByVei[v.id];
        if(v.status === 'manutencao'){
          manutencao.push({ ...v, motivo: 'Em manutenção' });
          return;
        }
        if(loc){
          // Calcula disponibilidade real: data_fim_hora + 4h de buffer
          const fimDt = loc.data_fim_hora
            ? new Date(loc.data_fim_hora)
            : new Date(loc.data_fim+'T23:59:00');
          const dispDt = new Date(fimDt.getTime() + 4*60*60*1000);

          if(dispDt <= dataRef){
            // Já estará disponível na data solicitada
            disponiveis.push({
              ...v,
              disponivel_a_partir: dispDt.toISOString(),
              observacao: `Devolução prevista: ${fimDt.toLocaleString('pt-BR')} · Livre após ${dispDt.toLocaleString('pt-BR')}`
            });
          } else {
            alugados.push({
              ...v,
              data_devolucao: fimDt.toISOString(),
              disponivel_a_partir: dispDt.toISOString(),
            });
          }
        } else {
          disponiveis.push({ ...v, disponivel_a_partir: null, observacao: 'Disponível agora' });
        }
      });
    } else {
      // Sem data: usa o status atual do veículo
      veiculos.forEach(v => {
        if(v.status === 'disponivel') disponiveis.push(v);
        else if(v.status === 'alugado') alugados.push(v);
        else if(v.status === 'manutencao') manutencao.push(v);
        else disponiveis.push(v);
      });
    }

    res.json({
      ok: true,
      consultado_em: new Date().toISOString(),
      data_referencia: data || null,
      resumo: {
        disponiveis: disponiveis.length,
        alugados:    alugados.length,
        manutencao:  manutencao.length,
        total:       veiculos.length,
      },
      disponiveis,
      alugados,
      manutencao,
    });

  }catch(e){
    console.error('[api/v1/veiculos/disponibilidade GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/clientes/verificar
// Consulta se um número/CPF é um cliente ativo (com locação em andamento)
//
// Query params (pelo menos um obrigatório):
//   telefone  — ex: "21999991234"
//   cpf       — ex: "12345678901"
//
// Response 200:
//   { encontrado: true/false, cliente: {...}, locacao_ativa: {...} | null, tipo: "cliente"|"lead"|null }
// ─────────────────────────────────────────────────────────────────
app.get('/api/v1/clientes/verificar', autenticarAPI, async (req, res) => {
  try{
    const { telefone, cpf } = req.query;

    if(!telefone && !cpf){
      return res.status(400).json({ error: 'Informe "telefone" ou "cpf" como parâmetro.' });
    }

    let clienteQuery = sb.from('clientes')
      .select('id, nome, telefone, cpf, email, tipo, status_crm, interesse_veiculo, created_at');

    if(telefone){
      const telLimpo = String(telefone).replace(/\D/g,'').slice(-11);
      clienteQuery = clienteQuery.ilike('telefone', `%${telLimpo}`);
    } else {
      const cpfLimpo = String(cpf).replace(/\D/g,'');
      clienteQuery = clienteQuery.ilike('cpf', `%${cpfLimpo}`);
    }

    const { data: cliente, error } = await clienteQuery.maybeSingle();

    if(error) throw error;

    if(!cliente){
      return res.json({
        encontrado: false,
        cliente: null,
        locacao_ativa: null,
        tipo: null,
        mensagem: 'Nenhum registro encontrado com os dados informados.',
      });
    }

    // Verifica se tem locação ativa
    const { data: locacao } = await sb.from('locacoes')
      .select(`
        id, num_contrato, status, data_inicio, data_fim, data_fim_hora,
        tipo_contrato, total, caucao,
        veiculos(marca, modelo, placa, tipo)
      `)
      .eq('cliente_id', cliente.id)
      .eq('status', 'ativa')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const eClienteAtivo = cliente.tipo === 'cliente' && !!locacao;

    res.json({
      encontrado:    true,
      tipo:          cliente.tipo,       // "cliente" | "lead"
      cliente_ativo: eClienteAtivo,      // true só se tem locação em andamento
      cliente: {
        id:              cliente.id,
        nome:            cliente.nome,
        telefone:        cliente.telefone,
        cpf:             cliente.cpf,
        email:           cliente.email,
        tipo:            cliente.tipo,
        status_crm:      cliente.status_crm,
        interesse:       cliente.interesse_veiculo,
        cliente_desde:   cliente.created_at,
      },
      locacao_ativa: locacao ? {
        id:            locacao.id,
        contrato:      `#${locacao.num_contrato}`,
        tipo:          locacao.tipo_contrato,
        data_inicio:   locacao.data_inicio,
        data_fim:      locacao.data_fim,
        data_fim_hora: locacao.data_fim_hora,
        veiculo:       locacao.veiculos ? `${locacao.veiculos.marca} ${locacao.veiculos.modelo} — ${locacao.veiculos.placa}` : null,
        tipo_veiculo:  locacao.veiculos?.tipo || null,
        valor_total:   locacao.total,
      } : null,
      mensagem: eClienteAtivo
        ? `Cliente ativo. Locação #${locacao.num_contrato} em andamento.`
        : cliente.tipo === 'cliente'
          ? 'Cliente cadastrado, sem locação ativa no momento.'
          : `Lead cadastrado no CRM com status "${cliente.status_crm}".`,
    });

  }catch(e){
    console.error('[api/v1/clientes/verificar GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/crm/status
// Lista os status disponíveis no pipeline (para o agente saber quais usar)
//
// Response 200: { status: [{ id, label, ordem }] }
// ─────────────────────────────────────────────────────────────────
app.get('/api/v1/crm/status', autenticarAPI, async (req, res) => {
  try{
    const { data, error } = await sb.from('crm_status')
      .select('id, label, cor, ordem')
      .eq('ativo', true)
      .order('ordem');
    if(error) throw error;
    res.json({ ok: true, status: data });
  }catch(e){
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// FIM DOS ENDPOINTS API v1
// ══════════════════════════════════════════════════════════════════
