-- Data de nascimento no cadastro de usuários (nullable para legados).
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS data_nascimento date;

COMMENT ON COLUMN public.usuarios.data_nascimento IS 'Data de nascimento do usuário';
