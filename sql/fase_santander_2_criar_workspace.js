// ══ SANTANDER — CRIAR WORKSPACE (rodar UMA VEZ, manualmente) ══
//
// Uso no VPS:
//   node fase_santander_2_criar_workspace.js
//
// Depois de rodar com sucesso, copie o campo "id" da resposta para
// SANTANDER_WORKSPACE_ID no .env — todos os endpoints seguintes dependem dele.
//
// Path e payload confirmados no "USERGUIDE - API DE COBRANÇA V2.1" oficial
// do Santander (seção 5.3.1 — Criação de Workspace).
//
// Requer no .env, além dos já usados na autenticação:
//   SANTANDER_CONVENIO   (número do convênio de cobrança já contratado no banco)
//
// Rodar no VPS com: npx dotenvx run -- node fase_santander_2_criar_workspace.js
// (usa dotenvx, igual ao resto do bridge — não precisa de require('dotenv'))

const { getSantanderToken, _httpsRequest, _agenteSantander, getSantanderHost } = require('./santander-auth');

(async () => {
  try{
    if(!process.env.SANTANDER_CONVENIO){
      throw new Error('SANTANDER_CONVENIO não definido no .env — obtenha o número do convênio antes de rodar');
    }

    const token = await getSantanderToken();
    console.log('Token obtido com sucesso.');

    const body = JSON.stringify({
      type: 'BILLING',
      description: 'Workspace de Cobrança - FleetPro Royal',
      covenants: [{ code: process.env.SANTANDER_CONVENIO }],
      // Só a PRIMEIRA workspace registrada para o convênio grava a config de
      // webhook — se já existir outra workspace pro mesmo convênio, isso é
      // ignorado (ver manual, seção 5.3.1). Publicar o endpoint de webhook
      // (fase_santander_4) ANTES de rodar este script, ou ajustar depois via
      // PATCH /workspaces/{WORKSPACE_ID}.
      webhookURL: 'https://bridge.ruahsystems.com.br/api/santander/webhook',
      bankSlipBillingWebhookActive: true,
      pixBillingWebhookActive: true,
    });

    const resp = await _httpsRequest({
      hostname: getSantanderHost(),
      // ⚠️ Path MUDA entre ambientes (confirmado no manual E empiricamente —
      // barra final em produção causa 502 no sandbox):
      //   Sandbox:  /collection_bill_management/v2/workspaces   (SEM barra)
      //   Produção: /collection_bill_management/v2/workspaces/  (COM barra)
      path: (process.env.SANTANDER_ENV || 'SANDBOX').toUpperCase() === 'PRODUCAO'
        ? '/collection_bill_management/v2/workspaces/'
        : '/collection_bill_management/v2/workspaces',
      method: 'POST',
      agent: _agenteSantander(),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
        'X-Application-Key': process.env.SANTANDER_CLIENT_ID,
      },
    }, body);

    console.log('\n=== WORKSPACE CRIADO ===');
    console.log(JSON.stringify(resp, null, 2));
    console.log('\n>>> Copie o campo "id" acima para SANTANDER_WORKSPACE_ID no .env <<<\n');
  }catch(e){
    console.error('[santander/criar-workspace] ERRO:', e.message);
    process.exit(1);
  }
})();
