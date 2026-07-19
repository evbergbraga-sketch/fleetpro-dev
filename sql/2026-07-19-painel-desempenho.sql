-- Painel Desempenho — aplicada em producao 19/07/2026 via MCP
-- 1) Presença por atendente/dia + RPC de heartbeat
CREATE TABLE IF NOT EXISTS presenca_diaria (
  user_id uuid NOT NULL,
  dia date NOT NULL,
  minutos integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, dia)
);
CREATE OR REPLACE FUNCTION registrar_presenca()
RETURNS void AS $$
  INSERT INTO presenca_diaria (user_id, dia, minutos)
  VALUES (auth.uid(), (now() AT TIME ZONE 'America/Sao_Paulo')::date, 1)
  ON CONFLICT (user_id, dia)
  DO UPDATE SET minutos = presenca_diaria.minutos + 1, atualizado_em = now();
$$ LANGUAGE sql SECURITY DEFINER;
-- 2) Auditoria do funil
CREATE TABLE IF NOT EXISTS crm_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  de text,
  para text NOT NULL,
  por uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csl_created ON crm_status_log (created_at);
CREATE INDEX IF NOT EXISTS idx_csl_por ON crm_status_log (por);

-- 3) Gravacao da equipe do painel (sys_config tem RLS): RPC admin-only
CREATE OR REPLACE FUNCTION dp_salvar_equipe(ids jsonb)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND perfil = 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a equipe do painel';
  END IF;
  INSERT INTO sys_config (chave, valor, descricao, updated_at)
  VALUES ('dp_equipe', ids::text, 'IDs dos usuarios exibidos no painel Desempenho', now())
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
