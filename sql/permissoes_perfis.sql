-- Coluna usada para restringir páginas/campos visíveis de atendentes
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS permissoes JSONB;
