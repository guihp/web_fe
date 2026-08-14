import { supabase } from '../lib/supabase';
import { MESES_PT, industriasMatch, normalizeIndustriaKey, regiaoFromEstado, type Regiao } from '../utils/vendasDomain';
import { fetchMetasDashboard } from './metasService';

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

  const metasDash = await fetchMetasDashboard(Number(filters.ano));
  const useMensal = Boolean(filters.mes && filters.mes !== 'Todos');
  const metaTotal = useMensal ? metasDash.geral.mensal : metasDash.geral.anual;

  return [
    { label: 'Total Vendas', value: total, meta: metaTotal || undefined },
    {
      label: 'MA / PI',
      value: sumValores(mapi),
      meta: useMensal ? metasDash.mapi.mensal : metasDash.mapi.anual,
    },
    {
      label: 'PA',
      value: sumValores(pa),
      meta: useMensal ? metasDash.pa.mensal : metasDash.pa.anual,
    },
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

export async function fetchVendasMensais(
  ano: string,
  regiao?: Regiao,
  industria?: string,
) {
  const rows = await fetchVendasRaw(ano);
  const map = new Map<string, number>();
  const filterIndustria =
    Boolean(industria?.trim()) &&
    !['todas as indústrias', 'todas as industrias', 'todas'].includes(
      industria!.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''),
    );

  for (const row of rows) {
    if (regiao && regiaoFromEstado(row.estado ?? '') !== regiao) continue;
    if (filterIndustria && !industriasMatch(row.industria ?? '', industria!)) continue;
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
  const useMensal = Boolean(mes && mes !== 'Todos');
  const [metasDash, rows] = await Promise.all([
    fetchMetasDashboard(anoNum),
    fetchVendasRaw(ano, mes),
  ]);

  const realizadoTotal = sumValores(rows);
  const metaTotal = useMensal ? metasDash.geral.mensal : metasDash.geral.anual;

  return {
    realizado: realizadoTotal,
    meta: metaTotal,
    percentual: metaTotal > 0 ? (realizadoTotal / metaTotal) * 100 : 0,
    mapi: {
      mensal: metasDash.mapi.mensal,
      anual: metasDash.mapi.anual,
      meta: useMensal ? metasDash.mapi.mensal : metasDash.mapi.anual,
    },
    pa: {
      mensal: metasDash.pa.mensal,
      anual: metasDash.pa.anual,
      meta: useMensal ? metasDash.pa.mensal : metasDash.pa.anual,
    },
  };
}

export { fetchMetasDashboard };

function matchesRegiao(estado: string | null | undefined, regiao?: Regiao) {
  if (!regiao) return true;
  return regiaoFromEstado(estado ?? '') === regiao;
}

function mesIndex(mesRow: string | null | undefined): number {
  const raw = (mesRow ?? '').trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  return MESES_PT.findIndex(
    (m) => m.normalize('NFD').replace(/\p{M}/gu, '') === raw,
  );
}

/** Mês específico OU YTD até ateMesNumero (índice 1..12). */
function matchesMesPeriodo(
  mesRow: string | null | undefined,
  ateMesNumero: number,
  mesNome?: string,
) {
  const idx = mesIndex(mesRow);
  if (idx < 0) return false;
  if (mesNome) {
    const target = mesNome.trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
    const row = (mesRow ?? '').trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
    return row === target;
  }
  return idx < ateMesNumero;
}

export async function fetchCrescimentoRegional(
  anoBase: string,
  anoComp: string,
  ateMesNumero: number,
  regiao?: Regiao,
) {
  const sumAteMes = async (ano: string) => {
    const rows = await fetchVendasRaw(ano);
    let mapi = 0;
    let pa = 0;

    for (const row of rows) {
      if (!matchesMesPeriodo(row.mes, ateMesNumero)) continue;
      if (!matchesRegiao(row.estado, regiao)) continue;
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

export async function fetchComparativoIndustrias(
  anoBase: string,
  anoComp: string,
  regiao?: Regiao,
  mesNome?: string,
  ateMesNumero = 12,
) {
  const [baseRows, compRows, industriasAtivas] = await Promise.all([
    fetchVendasRaw(anoBase),
    fetchVendasRaw(anoComp),
    supabase.from('industrias').select('"Nome", status'),
  ]);

  if (industriasAtivas.error) throw new Error(industriasAtivas.error.message);

  const ativas = (industriasAtivas.data ?? [])
    .filter((row: { Nome?: string; status?: string | null }) => {
      const status = (row.status ?? 'Ativo').trim().toLowerCase();
      return Boolean(row.Nome) && (status === 'ativo' || status === '');
    })
    .map((row: { Nome: string }) => row.Nome);

  const isIndustriaAtiva = (nomeVenda: string) =>
    ativas.some((nomeCadastro) => industriasMatch(nomeCadastro, nomeVenda));

  const sumByIndustria = (rows: typeof baseRows) => {
    const map = new Map<string, { valor: number; label: string }>();
    for (const row of rows) {
      if (!matchesRegiao(row.estado, regiao)) continue;
      if (!matchesMesPeriodo(row.mes, ateMesNumero, mesNome)) continue;
      const label = (row.industria ?? 'Outros').trim() || 'Outros';
      if (!isIndustriaAtiva(label)) continue;
      const key = normalizeIndustriaKey(label) || 'OUTROS';
      const prev = map.get(key);
      if (prev) {
        prev.valor += Number(row.valor);
        if (label.length > prev.label.length) prev.label = label;
      } else {
        map.set(key, { valor: Number(row.valor), label });
      }
    }
    return map;
  };

  const base = sumByIndustria(baseRows);
  const comp = sumByIndustria(compRows);
  const keys = new Set([...base.keys(), ...comp.keys()]);

  return Array.from(keys)
    .map((key) => {
      const baseItem = base.get(key);
      const compItem = comp.get(key);
      const valorBase = baseItem?.valor ?? 0;
      const valorComp = compItem?.valor ?? 0;
      const industria = compItem?.label ?? baseItem?.label ?? key;
      let variacao: number | null = null;
      if (valorBase > 0) {
        variacao = ((valorComp - valorBase) / valorBase) * 100;
      } else if (valorComp > 0) {
        // Indústria só no ano comparativo: conta como crescimento
        variacao = 100;
      }
      return { industria, valorBase, valorComp, variacao };
    })
    .filter((item) => item.valorBase > 0 || item.valorComp > 0)
    .sort((a, b) => b.valorComp - a.valorComp || b.valorBase - a.valorBase);
}

export async function fetchVendasMensaisComparativo(
  anoBase: string,
  anoComp: string,
  regiao?: Regiao,
) {
  const [baseRows, compRows] = await Promise.all([fetchVendasRaw(anoBase), fetchVendasRaw(anoComp)]);

  const sumByMes = (rows: typeof baseRows) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (!matchesRegiao(row.estado, regiao)) continue;
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
