# Aplicação das mudanças no Bridge Server — Passo a Passo

Duas mudanças, dois scripts. Ambos seguem o mesmo padrão de segurança:
backup automático antes de escrever, validação de sintaxe com
`node --check` logo depois, e restauração automática do backup se
qualquer coisa der errado.

## PASSO C — `aplicar_passo_c.py` (já aplicado ✓)

Captura o `wpp_message_id` das mensagens recebidas via webhook —
necessário para poder responder/apagar mensagens recebidas no futuro.

```bash
python3 /root/aplicar_passo_c.py /root/fleetpro-bridge/fleetpro-bridge-server.js
```

## PASSO A/B — `aplicar_passo_ab.py`

- Substitui o endpoint `/api/enviar-mensagem` (adiciona suporte a
  responder mensagem específica via `quotedMsgId`)
- Adiciona `/api/enviar-midia` (envia áudio/imagem/documento pela
  Evolution API e salva no banco — corrige o bug do áudio, que hoje
  nunca persiste e usa uma blob URL local que expira)
- Adiciona `/api/deletar-mensagem` (apaga a mensagem no WhatsApp para
  todos + marca como apagada no banco)

### Como rodar

Copie o conteúdo de `aplicar_passo_ab.py` para o VPS (mesmo processo
do script anterior: `nano /root/aplicar_passo_ab.py`, cola, salva) e
rode:

```bash
python3 /root/aplicar_passo_ab.py /root/fleetpro-bridge/fleetpro-bridge-server.js
```

Saída esperada em caso de sucesso:
```
Backup salvo em: /root/fleetpro-bridge/fleetpro-bridge-server.js.bak_20260706_031439
Arquivo modificado: /root/fleetpro-bridge/fleetpro-bridge-server.js

✓ Sintaxe validada com sucesso (node --check).
✓ Endpoint /api/enviar-mensagem atualizado (suporte a resposta/quoted).
✓ Endpoint /api/enviar-midia adicionado.
✓ Endpoint /api/deletar-mensagem adicionado.

Próximo passo: docker service update --force fleetpro-bridge
```

Testado localmente antes de entregar: reconstruí um cenário completo
do bridge (com o endpoint `/api/enviar-mensagem` original + a seção
`PORTAL DO CLIENTE` que vem depois dele no arquivo real) e confirmei
que:
- As 3 mudanças são aplicadas corretamente, sem sobrar nem faltar nada
- A seção `PORTAL DO CLIENTE` (e qualquer coisa depois dela) permanece
  100% intacta
- Rodar o script duas vezes é seguro — na segunda vez ele detecta que
  o endpoint original não existe mais e para sem tocar no arquivo

## Depois de aplicar os dois passos

```bash
# 1. Validar sintaxe ANTES de reiniciar (crítico — evita bridge quebrado)
node --check /root/fleetpro-bridge/fleetpro-bridge-server.js

# Se não retornar nada = sintaxe OK. Se der erro, NÃO prossiga — me avise.

# 2. Reiniciar o serviço
docker service update --force fleetpro-bridge

# 3. Acompanhar os logs por alguns segundos para confirmar que subiu limpo
docker service logs fleetpro-bridge --tail 30
```

## Testes de verificação

```bash
# Teste 1 — health check simples
docker exec $(docker ps -q -f name=fleetpro-bridge) wget -qO- http://localhost:3001/health

# Teste 2 — enviar mensagem de texto simples (confirma que a mudança
# do endpoint /api/enviar-mensagem não quebrou o fluxo já existente)
docker exec $(docker ps -q -f name=fleetpro-bridge) wget -qO- \
  --header="x-secret: FleetPro2025" \
  --header="Content-Type: application/json" \
  --post-data='{"numero":"SEU_NUMERO_AQUI","texto":"Teste de sistema — ignore"}' \
  http://localhost:3001/api/enviar-mensagem
```

Depois desses 2 testes passarem, me avise — sigo com o frontend
(botão de responder, botão de apagar, correção do envio de áudio) que
vai consumir esses novos endpoints. Os testes de áudio e deletar são
mais fáceis de validar já com a UI pronta.

## Se algo der errado

- Serviço não sobe / fica reiniciando em loop: rode
  `docker service logs fleetpro-bridge --tail 100` e me cole o erro.
- `node --check` acusa erro de sintaxe: me cole a mensagem de erro
  completa (ela aponta a linha exata) antes de tentar corrigir sozinho.
- Precisa reverter tudo: os backups ficam salvos ao lado do arquivo
  original, com sufixo `.bak_AAAAMMDD_HHMMSS`. Para restaurar:
  `cp fleetpro-bridge-server.js.bak_XXXXXXXX_XXXXXX fleetpro-bridge-server.js`
