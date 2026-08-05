# Integração Santander — Cobrança v2 (boleto híbrido + PIX)

Substitui o Asaas para locações de moto (assinatura semanal). Contratos de
carro não são afetados — não usam cobrança automática.

## Ordem de implementação (no VPS, via Claude Code)

1. **Certificado**: subir o `.pfx` para `/root/fleetpro-bridge/certs/royal_santander.pfx`
   (permissão 600, fora do git).
2. **`.env`**: adicionar as variáveis abaixo (ver `fase_santander_env_exemplo.txt`).
3. **Confirmar no Swagger** (Portal do Desenvolvedor Santander, aba da API
   "Cobranças"): os paths marcados com `// CONFIRMAR` nos arquivos
   `fase_santander_2_*` e `fase_santander_3_*`, e a estrutura do payload do
   webhook em `fase_santander_4_*`. Eu montei esses arquivos com base em
   documentação de parceiros/terceiros (não a doc oficial em PDF/Swagger),
   então os nomes de campo podem ter pequenas diferenças — validar antes de
   rodar contra produção.
4. Copiar `fase_santander_1_auth.js` para o bridge, `require` normalmente.
5. Rodar `node fase_santander_2_criar_workspace.js` **uma única vez**.
   Copiar o `id` retornado para `SANTANDER_WORKSPACE_ID` no `.env`.
6. Montar `fase_santander_3_criar_cobranca.js` no bridge (endpoint).
7. Montar `fase_santander_4_webhook.js` no bridge (endpoint) e registrar essa
   URL (`https://bridge.ruahsystems.com.br/api/santander/webhook`) no
   workspace — ou via `webhookURL` na criação (passo 5) ou por endpoint de
   atualização de workspace, o que o Swagger permitir.
8. Montar `fase_santander_5_cron.js` no bridge.
9. `docker service update --force fleetpro-bridge` para aplicar.
10. Testar ponta a ponta em UMA locação de moto de teste antes de qualquer
    uso real (ver checklist de testes no chat).

## Escopo desta fase

- Só cobre locações **novas** com `provedor_cobranca = 'santander'`.
- Locações que já têm assinatura Asaas ativa continuam no Asaas por enquanto
  (botão de migração fica para depois, por decisão do Berg).
- Schema já aplicado na branch dev do Supabase (`jfdmhgbanbblxgkvicbq`):
  `locacoes.provedor_cobranca`, `cobrancas_semanais.santander_*`.
