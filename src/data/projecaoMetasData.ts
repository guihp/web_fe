export type MetaIndustria = {
  id: string;
  nome: string;
  total2026: number;
  media2026: number;
  manual: boolean;
  crescimento: number;
  metaMensalManual: number;
  projecaoAnualManual: number;
};

export const ANOS_PROJECAO = ['2024', '2025', '2026', '2027', '2028'];

export function calcMetaMensal(row: MetaIndustria) {
  if (row.manual) return row.metaMensalManual;
  return row.media2026 * (1 + row.crescimento / 100);
}

export function calcProjecaoAnual(row: MetaIndustria) {
  if (row.manual) return row.projecaoAnualManual;
  return calcMetaMensal(row) * 12;
}

export function sumTotals(rows: MetaIndustria[]) {
  const metaMensal = rows.reduce((acc, row) => acc + calcMetaMensal(row), 0);
  const projecaoAnual = rows.reduce((acc, row) => acc + calcProjecaoAnual(row), 0);
  const total2026 = rows.reduce((acc, row) => acc + row.total2026, 0);
  return { metaMensal, projecaoAnual, total2026 };
}
