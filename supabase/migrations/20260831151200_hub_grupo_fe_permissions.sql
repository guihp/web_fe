-- Hub Grupo Fé: admin supremo + catálogo de sistemas e permissões

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS hub_sistemas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS hub_usuario_sistemas (
  usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sistema_id text NOT NULL REFERENCES hub_sistemas(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, sistema_id)
);

CREATE TABLE IF NOT EXISTS hub_usuario_secoes (
  usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  secao_id text NOT NULL,
  PRIMARY KEY (usuario_id, secao_id)
);

CREATE INDEX IF NOT EXISTS hub_usuario_sistemas_usuario_idx
  ON hub_usuario_sistemas (usuario_id);

CREATE INDEX IF NOT EXISTS hub_usuario_secoes_usuario_idx
  ON hub_usuario_secoes (usuario_id);

INSERT INTO hub_sistemas (id, nome, descricao, ordem, ativo) VALUES
  ('fe', 'Fé Merchandising', 'Operação e vendas do App Fé', 1, true),
  ('finance', 'IAFÉ Finance', 'Assinaturas e finanças pessoais', 2, true),
  ('imobi', 'IAFÉ Imobi', 'CRM imobiliário e leads', 3, true),
  ('daily', 'Daily', 'Demandas e sprints de desenvolvimento', 4, true)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;
