-- Sincroniza lojas da lista operacional: insere ausentes e Assaí → SENDAS.
WITH novos(codigo, nome, regional, regional_id, estado) AS (
  VALUES
    (24, 'MATEUS SUPERMERCADOS S A SUPER MARABA', 'Fé Representações Pará', 2, 'PA'),
    (25, 'MATEUS SUPERMERCADOS S A - MIX NOVA MARABA', 'Fé Representações Pará', 2, 'PA'),
    (49, 'MATEUS SUPERMERCADOS SA MIX CASTANHAL', 'Fé Representações Pará', 2, 'PA'),
    (50, 'MATEUS SUPERMERCADOS S A MIX ABAETETUBA', 'Fé Representações Pará', 2, 'PA'),
    (204, 'MATEUS SUPERMERCADOS S A SUPER BARCARENA', 'Fé Representações Pará', 2, 'PA'),
    (208, 'MATEUS SUPERMERCADOS S A SUPER CANAA DOS CARAJAS', 'Fé Representações Pará', 2, 'PA'),
    (253, 'MATEUS SUPERMERCADOS S A MIX PEDREIRA BELEM', 'Fé Representações Pará', 2, 'PA'),
    (254, 'MATEUS SUPERMERCADOS S A MIX PARQUE DOS CARAJAS', 'Fé Representações Pará', 2, 'PA'),
    (256, 'MATEUS SUPERMERCADOS S.A. MIX CAPANEMA', 'Fé Representações Pará', 2, 'PA'),
    (257, 'MATEUS SUPERMERCADOS S A MIX COQUEIRO', 'Fé Representações Pará', 2, 'PA'),
    (260, 'MATEUS SUPERMERCADOS S A MIX TUCURUI', 'Fé Representações Pará', 2, 'PA'),
    (263, 'MATEUS SUPERMERCADOS S A MIX MARIO COVAS', 'Fé Representações Pará', 2, 'PA'),
    (267, 'MATEUS SUPERMERCADOS S A MIX BRAGANCA', 'Fé Representações Pará', 2, 'PA'),
    (268, 'MATEUS SUPERMERCADOS S A MIX PARAGOMINAS', 'Fé Representações Pará', 2, 'PA'),
    (276, 'MATEUS SUPERMERCADOS S A MIX BENGUI', 'Fé Representações Pará', 2, 'PA'),
    (207, 'MATEUS SUPERMERCADOS S A SUPER BURITICUPU', 'Fé Representações Maranhão / Piauí', 1, 'MA'),
    (222, 'MIX MATEUS SUPERMERCADO - ROSARIO', 'Fé Representações Maranhão / Piauí', 1, 'MA'),
    (531, 'MIX MATEUS SUPERMERCADO - MARITUBA', 'Fé Representações Pará', 2, 'PA'),
    (539, 'MIX MATEUS SUPERMERCADO - BACANGA', 'Fé Representações Maranhão / Piauí', 1, 'MA'),
    (546, 'MATEUS SUPERMERCADO - SUPER REI DE FRANÇA', 'Fé Representações Maranhão / Piauí', 1, 'MA'),
    (477, 'POSTERUS SUPERMERCADOS - PARQUE ATHENAS', 'Fé Representações Maranhão / Piauí', 1, 'MA'),
    (261, 'MIX MATEUS - REDENCAO', 'Fé Representações Pará', 2, 'PA'),
    (223, 'SUPER MATEUS - DOCAS', 'Fé Representações Pará', 2, 'PA'),
    (33, 'MIX MATEUS SUPERMERCADOS S - AV. JK', 'Fé Representações Maranhão / Piauí', 1, 'MA'),
    (22, 'MATEUS SUPERMERCADOS S.A SUPER ESTRADA DO ARROZ', 'Fé Representações Maranhão / Piauí', 1, 'MA')
)
INSERT INTO public.lojas ("Nome", codigo, regional, regional_id, estado, status)
SELECT n.nome, n.codigo, n.regional, n.regional_id, n.estado, 'Ativo'
FROM novos n
WHERE NOT EXISTS (
  SELECT 1 FROM public.lojas l WHERE l.codigo = n.codigo
);

UPDATE public.lojas
SET "Nome" = CASE codigo
  WHEN 141 THEN 'SENDAS ATACADISTA (ASSAÍ) - TURU'
  WHEN 172 THEN 'SENDAS ATACADISTA (ASSAÍ) - IMPERATRIZ'
  WHEN 193 THEN 'SENDAS ATACADISTA (ASSAÍ) - GUAJAJARAS'
  WHEN 311 THEN 'SENDAS ATACADISTA (ASSAÍ) - ANGELIM'
  ELSE "Nome"
END
WHERE codigo IN (141, 172, 193, 311);

UPDATE public.lojas
SET status = 'Ativo'
WHERE codigo IN (
  1,2,3,4,5,7,8,11,12,15,16,17,18,19,20,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,49,50,51,52,
  91,92,93,94,95,96,97,99,141,172,193,200,201,202,204,207,208,215,217,218,222,223,251,252,253,254,255,256,257,259,260,261,263,267,268,269,271,275,276,296,311,
  408,410,411,412,414,415,418,424,425,426,429,433,434,445,450,451,457,477,502,526,531,537,539,546,548
);
