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
  oficial. Únicas coisas que ainda dependem de confirmação prática: se há
  validação de origem/assinatura no webhook, e o comportamento exato do
  campo `qrCodeUrl` (se é uma imagem pronta pra `<img src>` ou precisa
  gerar a imagem do QR no cliente a partir do `qrCodePix`).

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
