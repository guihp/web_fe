-- App lê a senha do dia (hub Merchandising). Só SELECT.
DROP POLICY IF EXISTS temp_anon_all_senhas ON public.senhas;
CREATE POLICY temp_anon_all_senhas ON public.senhas
  FOR SELECT
  USING (true);

GRANT SELECT ON public.senhas TO anon, authenticated;
