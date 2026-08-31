-- Lojas atribuídas ao Promotor/Demonstradora (máximo 7).
CREATE TABLE IF NOT EXISTS public.usuario_lojas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id bigint NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  loja_id bigint NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_lojas_unique UNIQUE (usuario_id, loja_id)
);

CREATE INDEX IF NOT EXISTS usuario_lojas_usuario_idx ON public.usuario_lojas (usuario_id);
CREATE INDEX IF NOT EXISTS usuario_lojas_loja_idx ON public.usuario_lojas (loja_id);

COMMENT ON TABLE public.usuario_lojas IS 'PDVs atribuídos ao usuário de campo (Promotor/Demonstradora); máximo 7.';

CREATE OR REPLACE FUNCTION public.enforce_usuario_lojas_max_7()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  qtde integer;
BEGIN
  SELECT COUNT(*) INTO qtde
  FROM public.usuario_lojas
  WHERE usuario_id = NEW.usuario_id;

  IF TG_OP = 'INSERT' AND qtde >= 7 THEN
    RAISE EXCEPTION 'Cada usuário pode ter no máximo 7 lojas cadastradas.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuario_lojas_max_7 ON public.usuario_lojas;
CREATE TRIGGER trg_usuario_lojas_max_7
  BEFORE INSERT ON public.usuario_lojas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_usuario_lojas_max_7();

ALTER TABLE public.usuario_lojas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_all_usuario_lojas ON public.usuario_lojas;
CREATE POLICY anon_all_usuario_lojas ON public.usuario_lojas
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_lojas TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.usuario_lojas_id_seq TO anon, authenticated;
