import { supabase } from '../lib/supabase';
import { MESES_PT, regiaoFromEstado, type Regiao } from '../utils/vendasDomain';
import { calcMetaValues, fetchMetas, fetchRealizado } from './metasService';

export type DashboardFilters = {
  ano: string;
  mes?: string;
};

export type KpiCard = {
  label: string;
  value: number;
  meta?: number;
  variant?: 'default' | 'success';
};

function sumValores(rows: Array<{ valor: number }>) {
  return rows.reduce((acc, r) => acc + Number(r.valor), 0);
}

export async function fetchVendasRaw(ano: string, mes?: string) {
  let query = supabase.from('baseVendas').select('*').eq('ano', ano);
  if (mes && mes !== 'Todos') {
    query = query.eq('mes', mes.toUpperCase());
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, valor: Number(r.valor) }));
}

export async function fetchDashboardKpis(filters: DashboardFilters): Promise<KpiCard[]> {
  const rows = await fetchVendasRaw(filters.ano, filters.mes);
  const total = sumValores(rows);

  const mapi = rows.filter((r) => regiaoFromEstado(r.estado ?? '') === 'MA/PI');
  const pa = rows.filter((r) => regiaoFromEstado(r.estado ?? '') === 'PA');

  const anoNum = Number(filters.ano);
  const metas = await fetchMetas(anoNum);
  const metaTotal = metas.reduce((acc, m) => {
    const realizado = 0;
    const { projecaoAnual } = calcMetaValues(m, realizado);
    return acc + (filters.mes && filters.mes !== 'Todos' ? projecaoAnual / 12 : projecaoAnual);
  }, 0);

  return [
    { label: 'Total Vendas', value: total, meta: metaTotal || undefined },
    { label: 'MA / PI', value: sumValores(mapi) },
    { label: 'PA', value: sumValores(pa) },
    { label: 'Pedidos', value: rows.length },
  ];
}

export async function fetchVendasPorIndustria(ano: string, mes?: string, regiao?: Regiao) {
  const rows = await fetchVendasRaw(ano, mes);
  const map = new Map<string, number>();

  for (const row of rows) {
    if (regiao && regiaoFromEstado(row.estado ?? '') !== regiao) continue;
    const key = row.industria ?? 'Outros';
    map.set(key, (map.get(key) ?? 0) + Number(row.valor));
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function fetchVendasMensais(ano: string, regiao?: Regiao) {
  const rows = await fetchVendasRaw(ano);
  const map = new Map<string, number>();

  for (const row of rows) {
    if (regiao && regiaoFromEstado(row.estado ?? '') !== regiao) continue;
    const mes = row.mes ?? 'JANEIRO';
    map.set(mes, (map.get(mes) ?? 0) + Number(row.valor));
  }

  return MESES_PT.map((mes) => ({
    label: mes.slice(0, 3),
    value: map.get(mes) ?? 0,
  }));
}

export async function fetchVendasPorVendedor(ano: string, mes?: string) {
  const rows = await fetchVendasRaw(ano, mes);
  const map = new Map<string, number>();

  for (const row of rows) {
    const key = row.vendedor ?? 'Sem vendedor';
    map.set(key, (map.get(key) ?? 0) + Number(row.valor));
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function fetchRealizadoVsMeta(ano: string, mes?: string) {
  const anoNum = Number(ano);
  const metas = await fetchMetas(anoNum);
  const rows = await fetchVendasRaw(ano, mes);
  const realizadoTotal = sumValores(rows);

  let metaTotal = 0;
  for (const meta of metas) {
    const realizadoInd = await fetchRealizado(meta.ano_base, meta.regiao, meta.industria);
    const { projecaoAnual, metaMensal } = calcMetaValues(meta, realizadoInd);
    metaTotal += mes && mes !== 'Todos' ? metaMensal : projecaoAnual;
  }

  return {
    realizado: realizadoTotal,
    meta: metaTotal,
    percentual: metaTotal > 0 ? (realizadoTotal / metaTotal) * 100 : 0,
  };
}

export async function fetchCrescimentoRegional(anoBase: string, anoComp: string, ateMesNumero: number) {
  const mesesOrdem = MESES_PT;

  const sumAteMes = async (ano: string) => {
    const rows = await fetchVendasRaw(ano);
    let mapi = 0;
    let pa = 0;

    for (const row of rows) {
      const idx = mesesOrdem.indexOf((row.mes ?? '').toUpperCase());
      if (idx < 0 || idx >= ateMesNumero) continue;
      if (regiaoFromEstado(row.estado ?? '') === 'PA') pa += Number(row.valor);
      else mapi += Number(row.valor);
    }

    return { mapi, pa, total: mapi + pa };
  };

  const base = await sumAteMes(anoBase);
  const comp = await sumAteMes(anoComp);

  const pct = (curr: number, prev: number) => (prev > 0 ? ((curr - prev) / prev) * 100 : null);

  return {
    mapi: { atual: comp.mapi, anterior: base.mapi, variacao: pct(comp.mapi, base.mapi) },
    pa: { atual: comp.pa, anterior: base.pa, variacao: pct(comp.pa, base.pa) },
    geral: { atual: comp.total, anterior: base.total, variacao: pct(comp.total, base.total) },
  };
}

export async function fetchComparativoIndustrias(anoBase: string, anoComp: string) {
  const [baseRows, compRows] = await Promise.all([fetchVendasRaw(anoBase), fetchVendasRaw(anoComp)]);

  const sumByIndustria = (rows: typeof baseRows) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.industria ?? 'Outros';
      map.set(key, (map.get(key) ?? 0) + Number(row.valor));
    }
    return map;
  };

  const base = sumByIndustria(baseRows);
  const comp = sumByIndustria(compRows);
  const industrias = new Set([...base.keys(), ...comp.keys()]);

  return Array.from(industrias).map((industria) => {
    const valorBase = base.get(industria) ?? 0;
    const valorComp = comp.get(industria) ?? 0;
    const variacao = valorBase > 0 ? ((valorComp - valorBase) / valorBase) * 100 : null;
    return { industria, valorBase, valorComp, variacao };
  });
}

export async function fetchVendasMensaisComparativo(anoBase: string, anoComp: string) {
  const [baseRows, compRows] = await Promise.all([fetchVendasRaw(anoBase), fetchVendasRaw(anoComp)]);

  const sumByMes = (rows: typeof baseRows) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const mes = row.mes ?? 'JANEIRO';
      map.set(mes, (map.get(mes) ?? 0) + Number(row.valor));
    }
    return map;
  };

  const base = sumByMes(baseRows);
  const comp = sumByMes(compRows);

  return MESES_PT.map((mes) => ({
    mes,
    base: base.get(mes) ?? 0,
    comp: comp.get(mes) ?? 0,
  }));
}
