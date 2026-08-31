CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE push_webhook_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  edge_function_url text NOT NULL
);

REVOKE ALL ON push_webhook_config FROM anon, authenticated;

INSERT INTO push_webhook_config (id, secret, edge_function_url)
VALUES (
  1,
  gen_random_uuid()::text,
  'https://sjapbromslgohlxcndrj.supabase.co/functions/v1/send-web-push'
);

CREATE OR REPLACE FUNCTION fn_notify_push_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg record;
  kind text;
BEGIN
  kind := TG_ARGV[0];

  SELECT secret, edge_function_url
  INTO cfg
  FROM push_webhook_config
  WHERE id = 1;

  IF cfg IS NULL OR cfg.edge_function_url IS NULL OR cfg.secret IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM net.http_post(
    url := cfg.edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg.secret
    ),
    body := jsonb_build_object(
      'kind', kind,
      'record', to_jsonb(NEW)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tr_push_notify_base_vendas
  AFTER INSERT ON "baseVendas"
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_push_event('venda');

CREATE TRIGGER tr_push_notify_pedido_kanban
  AFTER INSERT OR UPDATE OF status ON pedido_kanban
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_push_event('kanban_pedido');

CREATE TRIGGER tr_push_notify_contrato_faturamento
  AFTER INSERT OR UPDATE OF coluna ON contrato_faturamento
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_push_event('kanban_financeiro');
