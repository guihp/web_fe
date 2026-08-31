CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_usuario_id ON push_subscriptions (usuario_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY temp_anon_all_push_subscriptions ON push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);
