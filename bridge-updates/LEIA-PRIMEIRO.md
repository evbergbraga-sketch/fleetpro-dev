# Aplicação das mudanças no Bridge Server — Passo a Passo

## PASSO C — Script automatizado (recomendado, sem edição manual)

Em vez de editar o arquivo manualmente com `nano`, use o script
`aplicar_passo_c.py`. Ele:
- Faz backup automático antes de qualquer mudança
- Aplica as 3 substituições necessárias com precisão exata
- Valida a sintaxe com `node --check` logo em seguida
- Se der qualquer erro, **restaura o backup automaticamente** — o
  arquivo original nunca fica em estado quebrado
- Se rodado duas vezes, detecta que já foi aplicado e para sem tocar
  no arquivo

### Como rodar

```bash
# 1. Copie o arquivo aplicar_passo_c.py para o VPS, por exemplo colando
#    o conteúdo direto com nano num arquivo novo:
#    nano /root/aplicar_passo_c.py
#    (cole o conteúdo do arquivo, salve e saia)

# 2. Rode o script apontando para o bridge:
python3 /root/aplicar_passo_c.py /root/fleetpro-bridge/fleetpro-bridge-server.js
```

Saída esperada em caso de sucesso:
```
Backup salvo em: /root/fleetpro-bridge/fleetpro-bridge-server.js.bak_20260706_030452
Arquivo modificado: /root/fleetpro-bridge/fleetpro-bridge-server.js

✓ Sintaxe validada com sucesso (node --check).
✓ As 3 substituições foram aplicadas corretamente.

Próximo passo: docker service update --force fleetpro-bridge
```

Se aparecer `ERRO: não encontrei o trecho da SUBSTITUIÇÃO ...`, o
arquivo não foi modificado — me avise a mensagem completa antes de
tentar de novo.

## PASSO A e B — Código para colar (arquivo `PASSO-A-B-codigo-para-colar.js`)

Este arquivo tem 3 blocos de código prontos:
- Substitua o endpoint `/api/enviar-mensagem` já existente pelo do PASSO A
- Cole os dois endpoints novos do PASSO B logo abaixo dele
  (`/api/enviar-midia` e `/api/deletar-mensagem`)

Localização exata no arquivo original: logo antes da seção
`// ══ PORTAL DO CLIENTE ══` (comentário já existente no arquivo).

## Depois de aplicar os passos A, B e C

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
- Precisa reverter tudo: os backups ficam salvos ao lado do arquivo
  original, com sufixo `.bak_AAAAMMDD_HHMMSS`. Para restaurar:
  `cp fleetpro-bridge-server.js.bak_XXXXXXXX_XXXXXX fleetpro-bridge-server.js`
