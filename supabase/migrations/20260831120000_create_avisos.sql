-- Avisos internos (salário / feriado manuais; folha automática dia 25).
-- Push via trigger → send-web-push (kind = aviso). Só internos no app/edge.

CREATE TABLE IF NOT EXISTS avisos (
  id bigserial PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('salario', 'feriado', 'folha')),
  titulo text NOT NULL,
  corpo text NOT NULL,
  criado_por bigint REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avisos_created_at_idx ON avisos (created_at DESC);
CREATE INDEX IF NOT EXISTS avisos_tipo_created_at_idx ON avisos (tipo, created_at DESC);

ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY temp_anon_all_avisos ON avisos
  FOR SELECT USING (true);

-- Inserts só via RPC SECURITY DEFINER (ou cron)
REVOKE INSERT, UPDATE, DELETE ON avisos FROM anon, authenticated;
GRANT SELECT ON avisos TO anon, authenticated;

CREATE OR REPLACE FUNCTION enviar_aviso(
  p_tipo text,
  p_titulo text,
  p_corpo text,
  p_criado_por bigint DEFAULT NULL
)
RETURNS avisos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_aviso avisos;
  t text;
  tit text;
  corp text;
BEGIN
  t := lower(trim(p_tipo));
  IF t NOT IN ('salario', 'feriado') THEN
    RAISE EXCEPTION 'Tipo inválido. Use salario ou feriado.';
  END IF;

  tit := trim(p_titulo);
  corp := trim(p_corpo);
  IF tit = '' OR corp = '' THEN
    RAISE EXCEPTION 'Título e corpo são obrigatórios.';
  END IF;

  INSERT INTO avisos (tipo, titulo, corpo, criado_por)
  VALUES (t, tit, corp, p_criado_por)
  RETURNING * INTO row_aviso;

  RETURN row_aviso;
END;
$$;

GRANT EXECUTE ON FUNCTION enviar_aviso(text, text, text, bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION fn_enviar_aviso_folha_dia_25()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ja_existe boolean;
BEGIN
  -- Evita duplicata no mesmo dia (timezone America/Sao_Paulo)
  SELECT EXISTS (
    SELECT 1
    FROM avisos
    WHERE tipo = 'folha'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date
          = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  )
  INTO ja_existe;

  IF ja_existe THEN
    RETURN;
  END IF;

  INSERT INTO avisos (tipo, titulo, corpo, criado_por)
  VALUES (
    'folha',
    'Ótimo diaa! 😊',
    E'Atenção:\n\nLembramos que a folha de ponto é encerrada no dia 25 de cada mês.\nCaso essa data caia em um domingo, o envio de justificativas de faltas, atestados ou comunicados poderá ser realizado no próximo dia útil.\n\nReforçamos também a importância de sincronizar seus pontos e envio de justificativas de faltas no aplicativo correspondente, para evitar quaisquer desconfortos no futuro.\n\nAgradecemos pela compreensão e nos colocamos à disposição para esclarecer quaisquer dúvidas.',
    NULL
  );
END;
$$;

CREATE TRIGGER tr_push_notify_avisos
  AFTER INSERT ON avisos
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_push_event('aviso');

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_aviso boolean NOT NULL DEFAULT true;

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE avisos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- Cron dia 25 às 12:00 UTC (~09:00 BRT)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'aviso-folha-dia-25';
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
END;
$$;

SELECT cron.schedule(
  'aviso-folha-dia-25',
  '0 12 25 * *',
  $$SELECT fn_enviar_aviso_folha_dia_25();$$
);
