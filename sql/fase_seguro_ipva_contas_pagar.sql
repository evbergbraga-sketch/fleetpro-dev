-- Fase — Seguro/IPVA do cadastro de veículo agora vão para Contas a Pagar
-- (antes: iam direto pro Financeiro como lançamento já pago)

-- Link idempotente entre o seguro do veículo e a conta a pagar gerada,
-- para nunca duplicar ao re-salvar o formulário do veículo.
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS seguro_conta_pagar_id UUID REFERENCES contas_pagar(id);

-- IPVA agora também aparece no dropdown de Contas a Pagar (antes só no Financeiro,
-- porque era tratado como categoria de receita de locação, o que estava errado)
UPDATE categorias_financeiras SET mostrar_contas_pagar = true WHERE nome = 'IPVA';

-- Obs: o vínculo de cada ano de IPVA com sua respectiva conta a pagar é guardado
-- dentro do próprio JSON salvo em veiculos.ipvas (campo conta_pagar_id em cada
-- item do array), não precisa de coluna nova — mesmo padrão já usado pro resto
-- do IPVA (ano, valor, vencimento).
