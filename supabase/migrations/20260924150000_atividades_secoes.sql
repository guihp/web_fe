-- Seções da loja informadas pelo criador da atividade (texto livre).
ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS secoes text;

COMMENT ON COLUMN public.atividades.secoes IS
  'Seções da loja informadas pelo criador da atividade (ex.: Padaria, Hortifruti), exibidas ao promotor na notificação e no detalhe.';
