-- Lookup de produto/indústria no formulário Lançar vencimentos (anon key do app).
DROP POLICY IF EXISTS codigos_select_anon_authenticated ON public.codigos;
CREATE POLICY codigos_select_anon_authenticated ON public.codigos
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.codigos TO anon, authenticated;
