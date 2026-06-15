# FleetPro API v1

Base URL: `https://bridge.ruahsystems.com.br/api/v1`

## Autenticação

Todas as requisições exigem o header:
```
Authorization: Bearer fp_live_SEU_TOKEN_AQUI
```

---

## 1. Adicionar lead no CRM

**`POST /api/v1/crm/leads`**

```json
{
  "nome": "João Silva",
  "telefone": "21999991234",
  "interesse": "moto",
  "status_crm": "Interesse",
  "observacoes": "Quer moto para trabalho, orçamento até R$400/sem",
  "origem": "Instagram"
}
```

**Campos obrigatórios:** `nome`, `telefone`

**Resposta 201:**
```json
{
  "ok": true,
  "lead": {
    "id": "uuid",
    "nome": "João Silva",
    "telefone": "21999991234",
    "tipo": "lead",
    "status_crm": "Interesse",
    "interesse_veiculo": "moto"
  }
}
```

**Resposta 409** (telefone já cadastrado):
```json
{
  "error": "Já existe um registro com esse telefone.",
  "existente": { "id": "uuid", "nome": "João Silva", "tipo": "lead", "status_crm": "Interesse" }
}
```

---

## 2. Mover lead no pipeline

**`PATCH /api/v1/crm/leads/:id/status`**

```json
{
  "status": "Potencial",
  "nota": "Demonstrou interesse em fechar essa semana"
}
```

**Campos obrigatórios:** `status` (deve ser um label válido do pipeline)

**Resposta 200:**
```json
{
  "ok": true,
  "id": "uuid",
  "nome": "João Silva",
  "status_anterior": "Interesse",
  "status_novo": "Potencial"
}
```

---

## 3. Verificar disponibilidade de veículos

**`GET /api/v1/veiculos/disponibilidade`**

Query params opcionais:
- `tipo` — `carro` ou `moto`
- `data` — `YYYY-MM-DD` (considera buffer de 4h após devolução)

Exemplos:
```
GET /api/v1/veiculos/disponibilidade
GET /api/v1/veiculos/disponibilidade?tipo=moto
GET /api/v1/veiculos/disponibilidade?tipo=carro&data=2026-06-20
```

**Resposta 200:**
```json
{
  "ok": true,
  "consultado_em": "2026-06-13T15:00:00.000Z",
  "data_referencia": "2026-06-20",
  "resumo": {
    "disponiveis": 2,
    "alugados": 1,
    "manutencao": 0,
    "total": 3
  },
  "disponiveis": [
    {
      "id": "uuid",
      "marca": "Yamaha",
      "modelo": "Factor 150",
      "placa": "TUW4B13",
      "tipo": "moto",
      "status": "disponivel",
      "diaria": 379.99,
      "disponivel_a_partir": null,
      "observacao": "Disponível agora"
    }
  ],
  "alugados": [...],
  "manutencao": [...]
}
```

---

## 4. Verificar se é cliente ativo

**`GET /api/v1/clientes/verificar`**

Query params (pelo menos um):
- `telefone` — ex: `21999991234`
- `cpf` — ex: `12345678901`

Exemplos:
```
GET /api/v1/clientes/verificar?telefone=21999991234
GET /api/v1/clientes/verificar?cpf=12345678901
```

**Resposta 200 — cliente com locação ativa:**
```json
{
  "encontrado": true,
  "tipo": "cliente",
  "cliente_ativo": true,
  "cliente": {
    "id": "uuid",
    "nome": "João Silva",
    "telefone": "21999991234",
    "tipo": "cliente",
    "status_crm": "Ativo"
  },
  "locacao_ativa": {
    "id": "uuid",
    "contrato": "#42",
    "tipo": "carro",
    "data_inicio": "2026-06-11",
    "data_fim": "2026-06-16",
    "veiculo": "Volkswagen Saveiro Robust — TQA6A66",
    "valor_total": 1200.00
  },
  "mensagem": "Cliente ativo. Locação #42 em andamento."
}
```

**Resposta 200 — não encontrado:**
```json
{
  "encontrado": false,
  "cliente": null,
  "locacao_ativa": null,
  "tipo": null,
  "mensagem": "Nenhum registro encontrado com os dados informados."
}
```

---

## 5. Listar status do pipeline (auxiliar)

**`GET /api/v1/crm/status`**

Retorna os status cadastrados — útil para o agente de IA saber quais labels usar.

```json
{
  "ok": true,
  "status": [
    { "id": "uuid", "label": "Interesse", "cor": "#F5B942", "ordem": 1 },
    { "id": "uuid", "label": "Potencial", "cor": "#60A5FA", "ordem": 2 },
    { "id": "uuid", "label": "Ativo",     "cor": "#4ADE80", "ordem": 3 },
    { "id": "uuid", "label": "Reprovado", "cor": "#F87171", "ordem": 4 }
  ]
}
```

---

## Códigos de erro

| Código | Significado |
|--------|-------------|
| 400 | Parâmetro obrigatório faltando ou inválido |
| 401 | Token ausente ou inválido |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex: telefone já cadastrado) |
| 500 | Erro interno do servidor |

---

## Como configurar no n8n

1. Adicione um nó **HTTP Request**
2. Method: `POST` / `GET` / `PATCH` conforme o endpoint
3. URL: `https://bridge.ruahsystems.com.br/api/v1/...`
4. Headers: `Authorization: Bearer fp_live_SEU_TOKEN`
5. Body: JSON com os campos necessários

## Como configurar no agente de IA

Passe as instruções abaixo no system prompt:

```
Você tem acesso à API do FleetPro (sistema de gestão da Locadora Royal).
Base URL: https://bridge.ruahsystems.com.br/api/v1
Authorization: Bearer fp_live_SEU_TOKEN

Use os endpoints disponíveis para:
- Cadastrar leads: POST /crm/leads
- Mover leads no pipeline: PATCH /crm/leads/{id}/status
- Verificar disponibilidade de veículos: GET /veiculos/disponibilidade
- Verificar se é cliente ativo: GET /clientes/verificar?telefone={tel}
- Listar status do pipeline: GET /crm/status

Sempre consulte GET /crm/status antes de usar PATCH /crm/leads/:id/status
para garantir que o label do status é válido.
```
