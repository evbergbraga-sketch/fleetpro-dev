-- Fase B — Pagamento no ato + restante + segunda forma de pagamento
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS valor_pago_ato NUMERIC;
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS valor_restante NUMERIC;
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS forma_pgto_2 TEXT;
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS valor_pgto_2 NUMERIC;
