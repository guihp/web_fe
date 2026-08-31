CREATE TABLE notification_preferences (
  usuario_id bigint PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  notify_venda boolean NOT NULL DEFAULT true,
  notify_kanban_pedido boolean NOT NULL DEFAULT true,
  notify_kanban_financeiro boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY temp_anon_all_notification_preferences ON notification_preferences
  FOR ALL USING (true) WITH CHECK (true);
