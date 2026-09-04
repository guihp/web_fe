import { supabase } from '../lib/supabase';
import type { MetaProjecao, Regiao } from '../utils/vendasDomain';
import { industriasMatch, MESES_PT, regiaoFromEstado, toIndustriaPadrao } from '../utils/vendasDomain';

export type VendaRealizadoRow = {
  valor: number;
  estado: string | null;
  industria: string | null;
  mes: string | null;
  ano: string | null;
};

function mapRow(row: Record<string, unknown>): MetaProjecao {
  return row as unknown as MetaProjecao;
}

export async function fetchMetas(anoProjecao: number): Promise<MetaProjecao[]> {
  const { data, error } = await supabase
    .from('metas_projecao')
    .select('*')
    .eq('ano_projecao', anoProjecao)
    .order('industria');

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function upsertMeta(
  meta: Omit<MetaProjecao, 'id' | 'created_at' | 'updated_at'> & { id?: string },
) {
  const payload = {
    ...meta,
    industria: toIndustriaPadrao(meta.industria),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('metas_projecao')
    .upsert(payload, { onConflict: 'industria,regiao,ano_projecao' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function deleteMeta(id: string): Promise<void> {
  const { error } = await supabase.from('metas_projecao').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Busca todas as vendas do ano base em baseVendas (uma vez). */
export async function fetchVendasRealizadoAno(ano: number): Promise<VendaRealizadoRow[]> {
  const { data, error } = await supabase
    .from('baseVendas')
    .select('valor, estado, industria, mes, ano')
    .eq('ano', String(ano));

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    valor: Number(row.valor) || 0,
    estado: row.estado ?? null,
    industria: row.industria ?? null,
    mes: row.mes ?? null,
    ano: row.ano ?? null,
  }));
}

/** Soma realizado filtrando região/indústria com match flexível de nome. */
export function sumRealizado(
  rows: VendaRealizadoRow[],
  regiao?: Regiao,
  industria?: string,
  ateMesNumero?: number,
): number {
  return rows.reduce((acc, row) => {
    if (regiao && regiaoFromEstado(row.estado ?? '') !== regiao) return acc;
    if (industria && !industriasMatch(industria, row.industria ?? '')) return acc;
    if (ateMesNumero) {
      const idx = MESES_PT.indexOf((row.mes ?? '').toUpperCase() as (typeof MESES_PT)[number]);
      // mes desconhecido: inclui; se índice >= ateMesNumero, corta
      if (idx >= 0 && idx >= ateMesNumero) return acc;
    }
    return acc + row.valor;
  }, 0);
}

export async function fetchRealizado(
  ano: number,
  regiao?: Regiao,
  industria?: string,
  ateMesNumero?: number,
): Promise<number> {
  const rows = await fetchVendasRealizadoAno(ano);
  return sumRealizado(rows, regiao, industria, ateMesNumero);
}

export function calcMetaFromCrescimento(realizado: number, crescimentoPercentual: number) {
  const projecaoAnual = realizado * (1 + crescimentoPercentual / 100);
  return {
    projecaoAnual,
    metaMensal: projecaoAnual / 12,
  };
}

export function calcMetaValues(meta: MetaProjecao, realizadoAnoBase: number) {
  // Mesma regra da tela de Projeção:
  // - Manual ON: usa meta_mensal/anual (se vazio = 0, não aplica crescimento)
  // - Manual OFF: média do ano base × (1 + crescimento%)
  if (meta.modo_manual) {
    const mensal = Number(meta.meta_mensal_manual) || 0;
    const anual = Number(meta.meta_anual_manual) || 0;

    if (mensal > 0) {
      return { projecaoAnual: mensal * 12, metaMensal: mensal };
    }
    if (anual > 0) {
      return { projecaoAnual: anual, metaMensal: anual / 12 };
    }
    return { projecaoAnual: 0, metaMensal: 0 };
  }

  return calcMetaFromCrescimento(realizadoAnoBase, Number(meta.crescimento_percentual) || 0);
}

export type MetasRegiaoTotais = {
  mensal: number;
  anual: number;
};

export type MetasDashboardTotais = {
  mapi: MetasRegiaoTotais;
  pa: MetasRegiaoTotais;
  geral: MetasRegiaoTotais;
};

/**
 * Soma metas mensais/anuais de metas_projecao para o ano do dashboard (ano_projecao),
 * agrupadas por região. Usa valores manuais ou cálculo com vendas do ano_base.
 */
export async function fetchMetasDashboard(anoProjecao: number): Promise<MetasDashboardTotais> {
  const metas = await fetchMetas(anoProjecao);
  const empty = { mensal: 0, anual: 0 };
  const result: MetasDashboardTotais = {
    mapi: { ...empty },
    pa: { ...empty },
    geral: { ...empty },
  };

  if (metas.length === 0) return result;

  const anosBase = Array.from(new Set(metas.map((m) => m.ano_base)));
  const vendasByAno = new Map<number, VendaRealizadoRow[]>();
  await Promise.all(
    anosBase.map(async (anoBase) => {
      vendasByAno.set(anoBase, await fetchVendasRealizadoAno(anoBase));
    }),
  );

  for (const meta of metas) {
    const vendas = vendasByAno.get(meta.ano_base) ?? [];
    const realizado = sumRealizado(vendas, meta.regiao, meta.industria);
    const { projecaoAnual, metaMensal } = calcMetaValues(meta, realizado);
    const bucket = meta.regiao === 'PA' ? result.pa : result.mapi;
    bucket.mensal += metaMensal;
    bucket.anual += projecaoAnual;
  }

  result.geral = {
    mensal: result.mapi.mensal + result.pa.mensal,
    anual: result.mapi.anual + result.pa.anual,
  };

  return result;
}

export type MetaBatidaAlert = {
  id: string;
  periodo: 'mensal' | 'anual';
  regiao: Regiao;
  ano: number;
  mesNome?: string;
  realizado: number;
  meta: number;
  at: string;
};

function todayPartsBRT(now = new Date()) {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [anoStr, mesStr] = key.split('-');
  const ano = Number(anoStr);
  const mesNumero = Number(mesStr);
  const mesNome = MESES_PT[mesNumero - 1] ?? 'JANEIRO';
  return { key, ano, mesStr, mesNumero, mesNome };
}

function sumRealizadoByRegiao(
  rows: Array<{ valor: number; estado?: string | null }>,
  regiao: Regiao,
): number {
  return rows.reduce((acc, row) => {
    if (regiaoFromEstado(row.estado ?? '') !== regiao) return acc;
    return acc + (Number(row.valor) || 0);
  }, 0);
}

/**
 * Detecta metas mensais/anuais batidas por regional (MA/PI e PA) no calendário BRT.
 * Usado no sino para cargos de liderança.
 */
export async function fetchMetaBatidaAlerts(now = new Date()): Promise<MetaBatidaAlert[]> {
  const { key, ano, mesStr, mesNome } = todayPartsBRT(now);
  const at = new Date(`${key}T08:00:00-03:00`).toISOString();

  const [metasDash, rowsAno] = await Promise.all([
    fetchMetasDashboard(ano),
    fetchVendasRealizadoAno(ano),
  ]);
  const mesKey = mesNome
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const rowsMes = rowsAno.filter((r) => {
    const rowKey = (r.mes ?? '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return rowKey === mesKey;
  });

  const alerts: MetaBatidaAlert[] = [];
  const regions: Regiao[] = ['MA/PI', 'PA'];

  for (const regiao of regions) {
    const bucket = regiao === 'PA' ? metasDash.pa : metasDash.mapi;
    const realizadoMes = sumRealizadoByRegiao(rowsMes, regiao);
    const realizadoAno = sumRealizadoByRegiao(rowsAno, regiao);

    if (bucket.mensal > 0 && realizadoMes >= bucket.mensal) {
      alerts.push({
        id: `meta-mensal-${regiao === 'PA' ? 'pa' : 'mapi'}-${ano}-${mesStr}`,
        periodo: 'mensal',
        regiao,
        ano,
        mesNome,
        realizado: realizadoMes,
        meta: bucket.mensal,
        at,
      });
    }

    if (bucket.anual > 0 && realizadoAno >= bucket.anual) {
      alerts.push({
        id: `meta-anual-${regiao === 'PA' ? 'pa' : 'mapi'}-${ano}`,
        periodo: 'anual',
        regiao,
        ano,
        realizado: realizadoAno,
        meta: bucket.anual,
        at,
      });
    }
  }

  return alerts;
}
