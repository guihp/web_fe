-- Guarda a senha do dia no momento do envio das fotos (auditoria padrão).
ALTER TABLE public.atividade_dia
  ADD COLUMN IF NOT EXISTS senha_do_dia text;

COMMENT ON COLUMN public.atividade_dia.senha_do_dia IS 'Senha do dia (BRT) no momento do registro Antes/Depois.';
