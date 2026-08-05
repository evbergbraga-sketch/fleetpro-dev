// ══ SANTANDER — AUTENTICAÇÃO mTLS + OAuth2 ══
// Requer no .env do bridge:
//   SANTANDER_CLIENT_ID
//   SANTANDER_CLIENT_SECRET
//   SANTANDER_CERT_PATH        (caminho absoluto do .pfx no VPS, ex: /root/fleetpro-bridge/certs/royal_santander.pfx)
//   SANTANDER_CERT_PASSWORD
//
// IMPORTANTE: colocar o .pfx fora do repo git, com permissão 600.
//   mkdir -p /root/fleetpro-bridge/certs && chmod 700 /root/fleetpro-bridge/certs
//   chmod 600 /root/fleetpro-bridge/certs/royal_santander.pfx
//
// Host de autenticação confirmado na doc oficial (seção 5.1 — API Servers):
//   Sandbox:  trust-sandbox.api.santander.com.br
//   Produção: trust-open.api.santander.com.br
// Escolhido via SANTANDER_ENV=SANDBOX ou SANTANDER_ENV=PRODUCAO no .env.
// Path de autenticação (igual nos dois ambientes): /auth/oauth/v2/token

const https = require('https');
const fs = require('fs');

function getSantanderHost(){
  return (process.env.SANTANDER_ENV || 'SANDBOX').toUpperCase() === 'PRODUCAO'
    ? 'trust-open.api.santander.com.br'
    : 'trust-sandbox.api.santander.com.br';
}

let _tokenCache = { token: null, expiraEm: 0 };

function _agenteSantander(){
  return new https.Agent({
    pfx: fs.readFileSync(process.env.SANTANDER_CERT_PATH),
    passphrase: process.env.SANTANDER_CERT_PASSWORD,
  });
}

function _httpsRequest(options, bodyStr){
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try{
          const json = data ? JSON.parse(data) : {};
          if(res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(`Santander ${res.statusCode}: ${JSON.stringify(json)}`));
        }catch(e){
          reject(new Error(`Resposta não-JSON do Santander (status ${res.statusCode}): ${data.slice(0,300)}`));
        }
      });
    });
    req.on('error', reject);
    if(bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getSantanderToken(){
  const agora = Date.now();
  if(_tokenCache.token && agora < _tokenCache.expiraEm) return _tokenCache.token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SANTANDER_CLIENT_ID,
    client_secret: process.env.SANTANDER_CLIENT_SECRET,
  }).toString();

  const resp = await _httpsRequest({
    hostname: getSantanderHost(),
    path: '/auth/oauth/v2/token',
    method: 'POST',
    agent: _agenteSantander(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if(!resp.access_token) throw new Error('Santander não retornou access_token: '+JSON.stringify(resp));

  _tokenCache = {
    token: resp.access_token,
    expiraEm: agora + (Number(resp.expires_in || 900) - 60) * 1000, // renova 60s antes de expirar
  };
  return _tokenCache.token;
}

module.exports = { getSantanderToken, _httpsRequest, _agenteSantander, getSantanderHost };
