-- Limite de desconto (%) que cada usuario pode aplicar em contratos
-- admin não é afetado (sempre ilimitado); NULL/0 = não pode dar desconto
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS desconto_max_pct NUMERIC DEFAULT 0;
