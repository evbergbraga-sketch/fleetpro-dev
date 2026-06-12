-- Fase A — Desconto na diária/semanal
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS diaria_original NUMERIC;
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC;
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS desconto_tipo TEXT; -- 'reais' | 'pct'
