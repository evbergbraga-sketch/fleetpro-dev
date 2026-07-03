-- Conciliação de cartão de crédito em Contas a Pagar

-- Indica que essa conta é uma fatura de cartão:
-- ao marcar como pago, concilia os gastos do período (não vai pro Financeiro)
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS eh_fatura_cartao BOOLEAN NOT NULL DEFAULT false;

-- Período de corte da fatura (YYYY-MM, ex: '2026-06')
-- Regra: gastos de 01/MM até o último dia do mês
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS fatura_periodo TEXT;

-- Em contas de gasto (forma_pgto = 'Cartão Crédito'), guarda qual fatura conciliou
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS conciliada_por UUID REFERENCES contas_pagar(id);

-- Categoria 'Fatura Cartão' só aparece em Contas a Pagar (não no Financeiro)
INSERT INTO categorias_financeiras (nome, icone, mostrar_financeiro, mostrar_contas_pagar, ordem)
VALUES ('Fatura Cartão', '💳', false, true, 15)
ON CONFLICT (nome) DO NOTHING;
