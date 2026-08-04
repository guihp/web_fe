export type ComissaoIndustria = {
  nome: string;
  vendas: number;
  percentual: number;
  comissao: number;
};

export const COMISSAO_POR_INDUSTRIA: ComissaoIndustria[] = [
  { nome: 'PREDILECTA', vendas: 46_864_832.58, percentual: 2.25, comissao: 1_054_458.73 },
  { nome: 'RUPPERS', vendas: 7_139_126.81, percentual: 8.0, comissao: 571_130.14 },
  { nome: 'TOURINHO', vendas: 4_521_890.42, percentual: 3.5, comissao: 158_266.16 },
  { nome: 'DACOLONIA', vendas: 3_892_104.55, percentual: 2.0, comissao: 77_842.09 },
  { nome: 'PRECIOSO', vendas: 3_210_450.0, percentual: 4.0, comissao: 128_418.0 },
  { nome: 'HARIBO', vendas: 2_890_320.18, percentual: 3.0, comissao: 86_709.61 },
  { nome: 'SANTA FE', vendas: 1_950_200.0, percentual: 2.5, comissao: 48_755.0 },
  { nome: 'VALE FERTIL', vendas: 1_680_500.0, percentual: 3.0, comissao: 50_415.0 },
  { nome: 'BENDO', vendas: 982_510.61, percentual: 5.0, comissao: 49_125.53 },
  { nome: 'BRASPLASTICOS', vendas: 700_000.0, percentual: 2.0, comissao: 14_000.0 },
];

export const TOTAL_VENDAS = 73_831_935.15;
export const TOTAL_COMISSAO = 2_220_564.89;
export const PERCENTUAL_MEDIO = 3.01;

export const FILTRO_ANOS_COMISSAO = ['2024', '2025', '2026', '2027'];
export const FILTRO_MESES_COMISSAO = [
  'Todos os Meses',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
];
export const FILTRO_REGIOES_COMISSAO = ['Todas Regiões', 'MA/PI', 'Pará'];

export const COMISSAO_POR_REGIAO = [
  { nome: 'MA/PI', vendas: 61_343_236.2, percentual: 3.12, comissao: 1_913_909.0 },
  { nome: 'Pará', vendas: 12_488_698.95, percentual: 2.46, comissao: 306_655.89 },
];

export const COMISSAO_MENSAL = [
  { nome: 'Janeiro', vendas: 10_500_000, percentual: 3.0, comissao: 315_000 },
  { nome: 'Fevereiro', vendas: 9_100_000, percentual: 2.9, comissao: 263_900 },
  { nome: 'Março', vendas: 12_800_000, percentual: 3.1, comissao: 396_800 },
  { nome: 'Abril', vendas: 17_300_000, percentual: 3.0, comissao: 519_000 },
  { nome: 'Maio', vendas: 13_000_000, percentual: 3.2, comissao: 416_000 },
  { nome: 'Junho', vendas: 11_131_935.15, percentual: 2.8, comissao: 309_864.89 },
];

export const PERCENTUAIS_CONFIG = [
  { nome: 'PREDILECTA', percentual: 2.25 },
  { nome: 'RUPPERS', percentual: 8.0 },
  { nome: 'TOURINHO', percentual: 3.5 },
  { nome: 'DACOLONIA', percentual: 2.0 },
  { nome: 'PRECIOSO', percentual: 4.0 },
  { nome: 'HARIBO', percentual: 3.0 },
];
