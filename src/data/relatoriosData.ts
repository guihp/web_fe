export type IndustriaComparativo = {
  nome: string;
  valor2025: number | null;
  valor2026: number | null;
};

export type TopQueda = {
  nome: string;
  variacao: number;
};

export type CrescimentoRegional = {
  label: string;
  valor2025: number;
  valor2026: number;
  variacao: number;
  diferenca: number;
};

export type MesComparativo = {
  mes: string;
  valor2025: number | null;
  valor2026: number | null;
  variacao: number | null;
};

export type VendaMensalIndustria = {
  mes: string;
  valor: number;
};

export const INDUSTRIAS_COMPARATIVO: IndustriaComparativo[] = [
  { nome: 'PREDILECTA', valor2025: 45_200_000, valor2026: 38_100_000 },
  { nome: 'DACOLONIA', valor2025: 12_800_000, valor2026: 9_400_000 },
  { nome: 'PRECIOSO', valor2025: 8_500_000, valor2026: 7_322_529 },
  { nome: 'TOURINHO', valor2025: 3_200_000, valor2026: 2_100_000 },
  { nome: 'SANTA FE', valor2025: 465_000, valor2026: 239_741 },
  { nome: 'VALE FERTIL', valor2025: 1_100_000, valor2026: 770_239 },
  { nome: 'RUPPERS', valor2025: 18_400_000, valor2026: 1_450_000 },
  { nome: 'HARIBO', valor2025: 4_900_000, valor2026: 450_328 },
  { nome: 'BENDO', valor2025: 2_450_000, valor2026: 192_000 },
  { nome: 'BRASPLASTICOS', valor2025: null, valor2026: null },
];

export const TOP_QUEDA: TopQueda[] = [
  { nome: 'BENDO', variacao: -92.1 },
  { nome: 'HARIBO', variacao: -90.8 },
  { nome: 'RUPPERS', variacao: -92.1 },
];

export const CRESCIMENTO_REGIONAL: CrescimentoRegional[] = [
  { label: 'Geral', valor2025: 61_600_000, valor2026: 74_800_000, variacao: 21.5, diferenca: 13_200_000 },
  { label: 'MA/PI', valor2025: 49_100_000, valor2026: 61_900_000, variacao: 26.2, diferenca: 12_800_000 },
  { label: 'Pará', valor2025: 12_500_000, valor2026: 12_874_000, variacao: 3.0, diferenca: 374_000 },
];

export const MESES_COMPARATIVO: MesComparativo[] = [
  { mes: 'Janeiro', valor2025: 9_800_000, valor2026: 10_500_000, variacao: 7.1 },
  { mes: 'Fevereiro', valor2025: 8_200_000, valor2026: 9_100_000, variacao: 11.0 },
  { mes: 'Março', valor2025: 11_500_000, valor2026: 12_800_000, variacao: 11.3 },
  { mes: 'Abril', valor2025: 14_200_000, valor2026: 17_300_000, variacao: 21.8 },
  { mes: 'Maio', valor2025: 12_000_000, valor2026: 13_000_000, variacao: 8.3 },
  { mes: 'Junho', valor2025: 5_900_000, valor2026: 994_000, variacao: -83.2 },
  { mes: 'Julho', valor2025: 6_900_000, valor2026: null, variacao: null },
  { mes: 'Agosto', valor2025: 7_200_000, valor2026: null, variacao: null },
  { mes: 'Setembro', valor2025: 6_900_000, valor2026: null, variacao: null },
  { mes: 'Outubro', valor2025: 21_900_000, valor2026: null, variacao: null },
  { mes: 'Novembro', valor2025: 3_100_000, valor2026: null, variacao: null },
  { mes: 'Dezembro', valor2025: 14_300_000, valor2026: null, variacao: null },
];

export const VENDAS_MENSAIS_2026: VendaMensalIndustria[] = [
  { mes: 'JAN', valor: 10_500_000 },
  { mes: 'FEV', valor: 9_100_000 },
  { mes: 'MAR', valor: 12_800_000 },
  { mes: 'ABR', valor: 17_300_000 },
  { mes: 'MAI', valor: 13_000_000 },
  { mes: 'JUN', valor: 994_000 },
  { mes: 'JUL', valor: 0 },
  { mes: 'AGO', valor: 0 },
  { mes: 'SET', valor: 0 },
  { mes: 'OUT', valor: 0 },
  { mes: 'NOV', valor: 0 },
  { mes: 'DEZ', valor: 0 },
];

export const FILTRO_MESES_REL = ['Todos os Meses', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'];
export const FILTRO_REGIOES = ['Todas', 'MA/PI', 'Pará'];
export const FILTRO_ANOS = ['2024', '2025', '2026'];
export const FILTRO_INDUSTRIAS_REL = ['Todas as Indústrias', 'PREDILECTA', 'RUPPERS', 'HARIBO', 'BENDO'];
