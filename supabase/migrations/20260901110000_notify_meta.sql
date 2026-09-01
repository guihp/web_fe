-- Preferência: aviso de meta mensal/anual batida (só liderança no app).
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_meta boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.notify_meta IS
  'Aviso no sino quando meta mensal/anual for batida (MA/PI ou PA). Destinado a cargos de liderança internos.';

UPDATE public.notification_preferences
SET notify_meta = true
WHERE notify_meta IS DISTINCT FROM true;
