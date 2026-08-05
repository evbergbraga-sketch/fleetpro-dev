// ══ SANTANDER — CRIAR WORKSPACE (rodar UMA VEZ, manualmente) ══
//
// Uso no VPS:
//   node fase_santander_2_criar_workspace.js
//
// Depois de rodar com sucesso, copie o campo "id" da resposta para
// SANTANDER_WORKSPACE_ID no .env — todos os endpoints seguintes dependem dele.
//
// ⚠️ ATENÇÃO — CONFIRMAR ANTES DE RODAR:
//   O path abaixo (/collection_bill_management/v2/workspaces) foi obtido de
//   documentação de terceiros, não da doc oficial em PDF/Swagger do Santander.
//   Antes de rodar, abrir o Swagger no Portal do Desenvolvedor (aba da API
//   "Cobranças"/"Cobrança v2") e confirmar:
//     1) o path exato de criação de workspace
//     2) se o host de cobrança é o mesmo de autenticação (trust-open.api.santander.com.br)
//        ou um host dedicado (ex: trust-open.api.santander.com.br/collection_bill_management)
//
// Requer no .env, além dos já usados na autenticação:
//   SANTANDER_CONVENIO   (número do convênio de cobrança já contratado no banco)

require('dotenv').config();
const { getSantanderToken, _httpsRequest, _agenteSantander } = require('./fase_santander_1_auth');

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
      // Descomentar quando o endpoint de webhook já estiver publicado e testável:
      // webhookURL: 'https://bridge.ruahsystems.com.br/api/santander/webhook',
      // bankSlipBillingWebhookActive: true,
      // pixBillingWebhookActive: true,
    });

    const resp = await _httpsRequest({
      hostname: 'trust-open.api.santander.com.br',
      path: '/collection_bill_management/v2/workspaces', // CONFIRMAR no Swagger antes de rodar
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
