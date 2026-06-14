-- CRM Fase 1: status do lead, responsável e follow-up em clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS status_crm TEXT DEFAULT 'sem_status';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES perfis(id);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS followup_em DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

-- Índice para consultas rápidas no pipeline
CREATE INDEX IF NOT EXISTS idx_clientes_status_crm ON clientes(status_crm);

-- CRM Fase 1: notas internas
CREATE TABLE IF NOT EXISTS notas_internas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criado_por UUID REFERENCES perfis(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CRM Fase 1: encaminhamentos
CREATE TABLE IF NOT EXISTS encaminhamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  setor_destino TEXT NOT NULL,
  encaminhado_por UUID REFERENCES perfis(id),
  lido BOOLEAN DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: notas_internas (só equipe interna)
ALTER TABLE notas_internas ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "notas_internas_acesso" ON notas_internas
  FOR ALL USING (auth.role() = 'authenticated');

-- RLS: encaminhamentos (só equipe interna)
ALTER TABLE encaminhamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "encaminhamentos_acesso" ON encaminhamentos
  FOR ALL USING (auth.role() = 'authenticated');
