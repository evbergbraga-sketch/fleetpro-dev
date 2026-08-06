# Integração Santander — Cobrança v2 (boleto híbrido + PIX)

Substitui o Asaas para locações de moto (assinatura semanal). Contratos de
carro não são afetados — não usam cobrança automática.

## Decisão de arquitetura (confirmada com o Berg em 05/08/2026)

- **PIX + Boleto**, os dois juntos — usando o "boleto híbrido" da própria
  API de Cobrança v2 (uma única cobrança já vem com linha digitável/código
  de barras E QR PIX/copia-e-cola). Não precisa de uma API de PIX separada.
- **Geração antecipada via cron**, não sob demanda — o cron
  (`fase_santander_5`) cria a cobrança alguns dias antes do vencimento, e o
  link já sai pronto no WhatsApp. O botão "Gerar forma de pagamento" na
  `pagar.html` fica só como fallback, caso o cliente abra o link antes do
  cron ter rodado.
- Specs corrigidos em 05/08/2026 com base no manual oficial **"USERGUIDE -
  API DE COBRANÇA V2.1"** do Santander (não mais em docs de terceiros) —
  paths, nomes de campo e estrutura do webhook já validados contra a fonte
  oficial.
- QR Code do PIX é gerado **no navegador do cliente**, a partir do texto
  "copia e cola" (`qrCodePix`, padrão EMV do Banco Central) — usando a lib
  `qrcodejs` via CDN na `pagar.html`. Isso evita depender do campo
  `qrCodeUrl` do Santander (cujo comportamento exato — imagem pronta ou
  não — não conseguimos confirmar na documentação). O campo `qrCodeUrl`
  continua sendo salvo no banco (`santander_qrcode_url`) só como
  informação extra, sem uso obrigatório.
- **Achado confirmado em teste real (05/08/2026):** o path de criação de
  workspace muda de barra final entre ambientes — Sandbox **sem** barra
  (`.../v2/workspaces`), Produção **com** barra (`.../v2/workspaces/`).
  Usar o errado dá 502. Já corrigido em `fase_santander_2`.
- **Achado confirmado em teste real:** as rotas GET (lista e por ID) do
  Workspace **não são confiáveis no sandbox** — devolvem respostas fixas/
  mockadas, não o que foi realmente criado. Não usar GET pra validar nada
  no sandbox; confiar sempre no retorno do POST. Isso pode valer também
  pras rotas de consulta de boleto (Sonda/Bills) — testar com cautela
  quando chegar nessa etapa.
- **Achado confirmado em teste real:** o bridge roda em container Docker
  com bind mount `/root/fleetpro-bridge` (host) → `/app` (container). O
  `SANTANDER_CERT_PATH` no `.env` precisa usar o caminho **de dentro do
  container** (`/app/certs/royal_santander.pfx`), não o do host — senão dá
  `ENOENT`. Isso vale pra qualquer variável de path novo que a gente
  adicionar no futuro.
- **Bug real corrigido em `_httpsRequest` (05/08/2026):** os chunks da
  resposta HTTP eram concatenados como string (`data += chunk`) em vez de
  acumulados como Buffer e decodificados só no final. Um caractere UTF-8
  multibyte (acento em "endereço", "número" etc.) partido entre dois
  chunks TCP corrompia o JSON perto do fim do corpo. Corrigido para
  `Buffer.concat(chunks).toString('utf8')`. Isso já está certo nos
  arquivos deste repo — se recriar esse módulo do zero, não reintroduzir
  o bug antigo.
- Ainda pendente de confirmação prática: se há validação de origem/
  assinatura no webhook do Santander (IP allowlist, header secreto etc.).

## Ordem de implementação (no VPS, via Claude Code)

1. **Certificado**: subir o `.pfx` para `/root/fleetpro-bridge/certs/royal_santander.pfx`
   (permissão 600, fora do git).
2. **`.env`**: adicionar as variáveis abaixo (ver `fase_santander_env_exemplo.txt`),
   incluindo `SANTANDER_CONVENIO=0863038`, `SANTANDER_CHAVE_PIX` e
   `SANTANDER_CHAVE_PIX_TIPO`.
3. Copiar `fase_santander_1_auth.js` para o bridge, `require` normalmente.
4. Publicar primeiro o endpoint de webhook (`fase_santander_4_webhook.js`),
   ele precisa estar no ar ANTES de criar o workspace com `webhookURL`.
5. Rodar `node fase_santander_2_criar_workspace.js` **uma única vez**.
   Copiar o `id` retornado para `SANTANDER_WORKSPACE_ID` no `.env`.
6. Montar `fase_santander_3_criar_cobranca.js` no bridge (endpoint).
7. Montar `fase_santander_5_cron.js` no bridge.
8. Montar `fase_santander_6_endpoints_pagamento.js` no bridge (endpoints
   públicos usados pela `pagar.html`, sem exigir login).
9. `docker service update --force fleetpro-bridge` para aplicar.
10. Testar ponta a ponta em UMA locação de moto de teste, em ambiente
    `SANTANDER_ENV=TESTE` primeiro, antes de qualquer uso real.

## Escopo desta fase

- Só cobre locações **novas** com `provedor_cobranca = 'santander'`.
- Locações que já têm assinatura Asaas ativa continuam no Asaas por enquanto
  (botão de migração fica para depois, por decisão do Berg).
- Schema já aplicado na branch dev do Supabase (`jfdmhgbanbblxgkvicbq`):
  `locacoes.provedor_cobranca`, `cobrancas_semanais.santander_*`.
