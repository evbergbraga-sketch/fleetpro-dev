-- ══ FASE 1 — Cobranças Semanais (Plano Assinatura Moto) ══

-- Novas colunas em locacoes
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;
ALTER TABLE locacoes ADD COLUMN IF NOT EXISTS primeira_semana_incluida BOOLEAN DEFAULT true;

-- Tabela de cobranças semanais
CREATE TABLE IF NOT EXISTS cobrancas_semanais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locacao_id UUID REFERENCES locacoes(id) ON DELETE CASCADE,
  numero_semana INTEGER NOT NULL,
  data_vencimento DATE NOT NULL,
  valor NUMERIC NOT NULL,
  valor_pago NUMERIC,
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | pago | atrasado
  data_pagamento TIMESTAMPTZ,
  asaas_payment_id TEXT,
  lancamento_id UUID REFERENCES lancamentos(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobr_locacao   ON cobrancas_semanais(locacao_id);
CREATE INDEX IF NOT EXISTS idx_cobr_asaas_pay ON cobrancas_semanais(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_cobr_status    ON cobrancas_semanais(status, data_vencimento);

-- RLS (segue padrão das outras tabelas — ajustar policy conforme necessário)
ALTER TABLE cobrancas_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cobrancas_semanais"
  ON cobrancas_semanais FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage cobrancas_semanais"
  ON cobrancas_semanais FOR ALL
  USING (auth.role() = 'authenticated');
