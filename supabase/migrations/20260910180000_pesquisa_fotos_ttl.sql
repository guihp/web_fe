-- Fotos da captura OCR (Fazer Pesquisa): retention 2 dias
ALTER TABLE public.pesquisa
  ADD COLUMN IF NOT EXISTS foto_path text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS ocr_texto_raw text,
  ADD COLUMN IF NOT EXISTS ocr_preco_varejo text,
  ADD COLUMN IF NOT EXISTS ocr_preco_atacado text;

COMMENT ON COLUMN public.pesquisa.foto_path IS 'Path no bucket pesquisa-fotos (TTL 2 dias).';
COMMENT ON COLUMN public.pesquisa.foto_url IS 'URL pública da foto de captura (TTL 2 dias).';
COMMENT ON COLUMN public.pesquisa.ocr_texto_raw IS 'Texto bruto/limpo retornado pelo OCR na captura.';
COMMENT ON COLUMN public.pesquisa.ocr_preco_varejo IS 'Preço varejo sugerido pelo OCR (antes da edição manual).';
COMMENT ON COLUMN public.pesquisa.ocr_preco_atacado IS 'Preço atacado sugerido pelo OCR (antes da edição manual).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pesquisa-fotos',
  'pesquisa-fotos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS anon_read_pesquisa_fotos ON storage.objects;
DROP POLICY IF EXISTS anon_insert_pesquisa_fotos ON storage.objects;
DROP POLICY IF EXISTS anon_update_pesquisa_fotos ON storage.objects;
DROP POLICY IF EXISTS anon_delete_pesquisa_fotos ON storage.objects;

CREATE POLICY anon_read_pesquisa_fotos
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pesquisa-fotos');

CREATE POLICY anon_insert_pesquisa_fotos
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pesquisa-fotos');

CREATE POLICY anon_update_pesquisa_fotos
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'pesquisa-fotos');

CREATE POLICY anon_delete_pesquisa_fotos
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pesquisa-fotos');

CREATE OR REPLACE FUNCTION public.cleanup_pesquisa_fotos_expiradas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  removed_db int := 0;
  removed_storage int := 0;
BEGIN
  UPDATE public.pesquisa
  SET
    foto_path = NULL,
    foto_url = NULL,
    ocr_texto_raw = NULL,
    ocr_preco_varejo = NULL,
    ocr_preco_atacado = NULL
  WHERE created_at < (timezone('utc', now()) - interval '2 days')
    AND (
      foto_path IS NOT NULL
      OR foto_url IS NOT NULL
      OR ocr_texto_raw IS NOT NULL
    );
  GET DIAGNOSTICS removed_db = ROW_COUNT;

  DELETE FROM storage.objects
  WHERE bucket_id = 'pesquisa-fotos'
    AND created_at < (timezone('utc', now()) - interval '2 days');
  GET DIAGNOSTICS removed_storage = ROW_COUNT;

  RETURN removed_db + removed_storage;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_pesquisa_fotos_expiradas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_pesquisa_fotos_expiradas() TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-pesquisa-fotos') THEN
    PERFORM cron.unschedule('cleanup-pesquisa-fotos');
  END IF;
  PERFORM cron.schedule(
    'cleanup-pesquisa-fotos',
    '20 3 * * *',
    $cron$SELECT public.cleanup_pesquisa_fotos_expiradas();$cron$
  );
END;
$$;
