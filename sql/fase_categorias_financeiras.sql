-- ══ CATEGORIAS FINANCEIRAS (Financeiro + Contas a Pagar) ══
-- Antes disso, as categorias eram fixas no código (FIN_CAT_ICONES, CP_CAT_ICONES
-- e 4 <select> hardcoded no index.html). Agora viram uma tabela editável pela UI.

CREATE TABLE IF NOT EXISTS categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  icone TEXT NOT NULL DEFAULT '📎',
  mostrar_financeiro BOOLEAN NOT NULL DEFAULT true,     -- aparece no dropdown do Financeiro
  mostrar_contas_pagar BOOLEAN NOT NULL DEFAULT true,   -- aparece no dropdown de Contas a Pagar
  ativo BOOLEAN NOT NULL DEFAULT true,                  -- desativada = some dos dropdowns, mas mantém histórico
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catfin_ativo ON categorias_financeiras(ativo, ordem);

ALTER TABLE categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categorias_financeiras"
  ON categorias_financeiras FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage categorias_financeiras"
  ON categorias_financeiras FOR ALL
  USING (auth.role() = 'authenticated');

-- Seed com as categorias já existentes no sistema (Aluguel/IPVA/Caução são
-- específicas de receita de locação, por isso mostrar_contas_pagar = false)
INSERT INTO categorias_financeiras (nome, icone, mostrar_financeiro, mostrar_contas_pagar, ordem) VALUES
  ('Aluguel',               '🚗', true,  false, 1),
  ('IPVA',                  '📋', true,  false, 2),
  ('Caução',                '🔒', true,  false, 3),
  ('Manutenção',             '🔧', true,  true,  4),
  ('Combustível',           '⛽', true,  true,  5),
  ('Multa',                  '⚠️', true,  true,  6),
  ('Seguro',                 '🛡️', true,  true,  7),
  ('Salários',               '👥', true,  true,  8),
  ('Fornecedores',           '📦', true,  true,  9),
  ('Aluguel/Imóvel',        '🏢', true,  true,  10),
  ('Impostos',               '🧾', true,  true,  11),
  ('Assinaturas/Software',  '💻', true,  true,  12),
  ('Marketing',              '📣', true,  true,  13),
  ('Outros',                 '📎', true,  true,  14)
ON CONFLICT (nome) DO NOTHING;
