# Aplicação das mudanças no Bridge Server — Passo a Passo

## Ordem de aplicação

1. **PASSO C** (arquivo `PASSO-C-instrucoes-webhook.txt`) — edite o
   webhook existente para capturar o ID da mensagem recebida. É o único
   passo que edita código já existente; siga com atenção.

2. **PASSO A e B** (arquivo `PASSO-A-B-codigo-para-colar.js`) — este
   arquivo tem 3 blocos de código prontos para colar:
   - Substitua o endpoint `/api/enviar-mensagem` já existente pelo do PASSO A
   - Cole os dois endpoints novos do PASSO B logo abaixo dele
     (`/api/enviar-midia` e `/api/deletar-mensagem`)

   Localização exata no arquivo original: logo antes da seção
   `// ══ PORTAL DO CLIENTE ══` (comentário já existente no arquivo).

## Depois de aplicar os 2 passos

```bash
# 1. Validar sintaxe ANTES de reiniciar (crítico — evita bridge quebrado)
node --check /root/fleetpro-bridge/fleetpro-bridge-server.js

# Se não retornar nada = sintaxe OK. Se der erro, NÃO prossiga — me avise.

# 2. Reiniciar o serviço
docker service update --force fleetpro-bridge

# 3. Acompanhar os logs por alguns segundos para confirmar que subiu limpo
docker service logs fleetpro-bridge --tail 30
```

## Testes de verificação (rode um por vez)

```bash
# Teste 1 — health check simples (confirma que o serviço está no ar)
docker exec $(docker ps -q -f name=fleetpro-bridge) wget -qO- http://localhost:3001/health

# Teste 2 — enviar uma mensagem de texto simples (endpoint já existia,
# só confirma que a mudança do PASSO A não quebrou nada)
docker exec $(docker ps -q -f name=fleetpro-bridge) wget -qO- \
  --header="x-secret: FleetPro2025" \
  --header="Content-Type: application/json" \
  --post-data='{"numero":"SEU_NUMERO_AQUI","texto":"Teste de sistema — ignore"}' \
  http://localhost:3001/api/enviar-mensagem
```

Depois desses 2 testes básicos passarem, me avise — vou te dar o passo
de teste do áudio (Teste 3) e do deletar (Teste 4), que dependem de um
áudio real gravado no FleetPro, então prefiro validar isso já com o
frontend atualizado também.

## Se algo der errado

- Serviço não sobe / fica reiniciando em loop: rode
  `docker service logs fleetpro-bridge --tail 100` e me cole o erro.
- `node --check` acusa erro de sintaxe: me cole a mensagem de erro
  completa (ela aponta a linha exata) antes de tentar corrigir sozinho.
