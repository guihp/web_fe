-- Loja operacional codigo 230 — MIX CAXIAS (MA).
INSERT INTO public.lojas ("Nome", codigo, regional, regional_id, cidade, estado, endereco, status)
SELECT
  'MATEUS SUPERMERCADOS S.A. MIX CAXIAS',
  230,
  'Fé Representações Maranhão / Piauí',
  1,
  'CAXIAS',
  'MA',
  'CAXIAS, MA',
  'Ativo'
WHERE NOT EXISTS (
  SELECT 1 FROM public.lojas WHERE codigo = 230
);
