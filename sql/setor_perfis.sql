-- Campo "Setor" customizável por usuário, para assinatura do chat
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS setor TEXT;
