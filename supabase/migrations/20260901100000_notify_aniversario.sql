-- Preferência de aviso de aniversário (próprio usuário).
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_aniversario boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.notify_aniversario IS
  'Aviso de aniversário só para o próprio usuário (sino / alerta local).';

UPDATE public.notification_preferences
SET notify_aniversario = true
WHERE notify_aniversario IS DISTINCT FROM true;
