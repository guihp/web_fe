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

const MAPI_INDUSTRIAS = [
  { nome: 'PREDILECTA', total: 38_337_963.38, media: 3_194_830.28 },
  { nome: 'RUPPERS', total: 13_492_872, media: 1_124_406 },
  { nome: 'PRECIOSO', total: 7_322_529, media: 610_210.75 },
  { nome: 'TOURINHO', total: 2_100_000, media: 175_000 },
  { nome: 'SANTA FE', total: 239_741, media: 19_978.42 },
  { nome: 'DACOLONIA', total: 1_316_838, media: 109_736.5 },
  { nome: 'HARIBO', total: 450_328, media: 37_527.33 },
  { nome: 'BENDO', total: 192_000, media: 16_000 },
  { nome: 'PECCIN ALIMENTOS', total: 890_000, media: 74_166.67 },
  { nome: 'BRASPLASTICOS', total: 1_450_000, media: 120_833.33 },
];

const PA_INDUSTRIAS = [
  { nome: 'PREDILECTA', total: 8_612_470.55, media: 717_705.88 },
  { nome: 'RUPPERS', total: 1_206_963.34, media: 100_580.28 },
  { nome: 'PRECIOSO', total: 685_858.6, media: 57_154.88 },
  { nome: 'VALE FERTIL', total: 770_239.17, media: 64_186.6 },
  { nome: 'DACOLONIA', total: 1_316_838.25, media: 109_736.52 },
  { nome: 'HARIBO', total: 450_328.37, media: 37_527.36 },
  { nome: 'TOURINHO', total: 520_000, media: 43_333.33 },
  { nome: 'SANTA FE', total: 180_000, media: 15_000 },
  { nome: 'BENDO', total: 95_000, media: 7_916.67 },
  { nome: 'PECCIN ALIMENTOS', total: 310_000, media: 25_833.33 },
];

function buildRows(items: { nome: string; total: number; media: number }[], prefix: string): MetaIndustria[] {
  return items.map((item, index) => ({
    id: `${prefix}-${index}`,
    nome: item.nome,
    total2026: item.total,
    media2026: item.media,
    manual: item.nome === 'PECCIN ALIMENTOS',
    crescimento: 20,
    metaMensalManual: 0,
    projecaoAnualManual: 0,
  }));
}

export const METAS_MAPI_INICIAL = buildRows(MAPI_INDUSTRIAS, 'mapi');
export const METAS_PA_INICIAL = buildRows(PA_INDUSTRIAS, 'pa');

export const ANOS_PROJECAO = ['2025', '2026', '2027', '2028'];

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
