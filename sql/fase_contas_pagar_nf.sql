-- Fase — Contas a Pagar: número da Nota Fiscal no momento do pagamento
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS num_nota TEXT;
