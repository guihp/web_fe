export type KpiCard = {
  id: string;
  title: string;
  realizado: number;
  meta: number;
  percentLabel: string;
  icon: 'target' | 'trend';
};

export type IndustrySale = {
  nome: string;
  valor: number;
};

export type MonthlySale = {
  mes: string;
  valor: number;
};

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const ANOS = ['2024', '2025', '2026'];

export const KPI_CARDS: KpiCard[] = [
  {
    id: 'ma-pi-mensal',
    title: 'Meta Mensal MA/PI',
    realizado: 422_097.94,
    meta: 12_600_000,
    percentLabel: '3,35% alcançado',
    icon: 'target',
  },
  {
    id: 'pa-mensal',
    title: 'Meta Mensal Pará',
    realizado: 0,
    meta: 3_250_000,
    percentLabel: '0,00% alcançado',
    icon: 'target',
  },
  {
    id: 'ma-pi-anual',
    title: 'Meta Anual MA/PI',
    realizado: 61_506_883.8,
    meta: 151_200_000,
    percentLabel: '40,68% do ano',
    icon: 'trend',
  },
  {
    id: 'pa-anual',
    title: 'Meta Anual Pará',
    realizado: 12_732_698.28,
    meta: 39_000_000,
    percentLabel: '32,65% do ano',
    icon: 'trend',
  },
];

export const VENDA_MES_INDUSTRIA_MAPI: IndustrySale[] = [
  { nome: 'RUPPERS', valor: 187_445.58 },
  { nome: 'TOURINHO', valor: 59_217.19 },
  { nome: 'PREDILECTA', valor: 35_183.1 },
];

export const VENDA_ANUAL_INDUSTRIA_PA: IndustrySale[] = [
  { nome: 'PREDILECTA', valor: 8_612_470.55 },
  { nome: 'DACOLONIA', valor: 1_316_838.25 },
  { nome: 'RUPPERS', valor: 1_206_963.34 },
  { nome: 'VALE FERTIL', valor: 770_239.17 },
  { nome: 'PRECIOSO', valor: 685_858.6 },
  { nome: 'HARIBO', valor: 450_328.37 },
];

export const VENDA_ANUAL_INDUSTRIA_MAPI: IndustrySale[] = [
  { nome: 'PREDILECTA', valor: 38_337_963 },
  { nome: 'RUPPERS', valor: 13_492_872 },
  { nome: 'PRECIOSO', valor: 7_322_529 },
];

export const VENDA_MENSAL_MAPI: MonthlySale[] = [
  { mes: 'JAN', valor: 8_200_000 },
  { mes: 'FEV', valor: 9_500_000 },
  { mes: 'MAR', valor: 12_800_000 },
  { mes: 'ABR', valor: 17_300_000 },
  { mes: 'MAI', valor: 13_000_000 },
  { mes: 'JUN', valor: 422_097.94 },
  { mes: 'JUL', valor: 0 },
  { mes: 'AGO', valor: 0 },
  { mes: 'SET', valor: 0 },
  { mes: 'OUT', valor: 0 },
  { mes: 'NOV', valor: 0 },
  { mes: 'DEZ', valor: 0 },
];

export const VENDA_MENSAL_PA: MonthlySale[] = [
  { mes: 'JAN', valor: 1_200_000 },
  { mes: 'FEV', valor: 2_100_000 },
  { mes: 'MAR', valor: 3_500_000 },
  { mes: 'ABR', valor: 3_100_000 },
  { mes: 'MAI', valor: 2_800_000 },
  { mes: 'JUN', valor: 0 },
  { mes: 'JUL', valor: 0 },
  { mes: 'AGO', valor: 0 },
  { mes: 'SET', valor: 0 },
  { mes: 'OUT', valor: 0 },
  { mes: 'NOV', valor: 0 },
  { mes: 'DEZ', valor: 0 },
];

export const META_MENSAL_MAPI = 12_600_000;
export const META_MENSAL_PA = 3_250_000;
export const TOTAL_ANUAL_MAPI = 61_506_883.8;
export const TOTAL_ANUAL_PA = 12_732_698.28;
