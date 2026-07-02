-- ══ CONTAS A PAGAR ══

CREATE TABLE IF NOT EXISTS contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  valor NUMERIC NOT NULL,
  forma_pgto TEXT,
  vencimento DATE NOT NULL,
  recorrente BOOLEAN NOT NULL DEFAULT false,
  recorrencia_tipo TEXT,              -- semanal | mensal | anual (só relevante se recorrente = true)
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | pago  ("atrasado" é calculado no front pela data)
  data_pagamento TIMESTAMPTZ,
  veiculo_id UUID REFERENCES veiculos(id),
  lancamento_id UUID REFERENCES lancamentos(id),
  conta_origem_id UUID REFERENCES contas_pagar(id),  -- aponta pra conta "mãe" quando gerada por recorrência
  observacoes TEXT,
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_status     ON contas_pagar(status, vencimento);
CREATE INDEX IF NOT EXISTS idx_cp_veiculo    ON contas_pagar(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_cp_lancamento ON contas_pagar(lancamento_id);

ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contas_pagar"
  ON contas_pagar FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage contas_pagar"
  ON contas_pagar FOR ALL
  USING (auth.role() = 'authenticated');
