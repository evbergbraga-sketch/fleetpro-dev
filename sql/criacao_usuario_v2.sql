-- Novos campos para criação de usuário pelo admin
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS senha_provisoria BOOLEAN DEFAULT false;
