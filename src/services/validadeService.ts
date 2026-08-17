import { toIndustriaPadrao } from '../utils/vendasDomain';
import { supabase } from '../lib/supabase';

export const VALIDADE_PAGE_SIZE = 15;

export type Validade = {
  id: number;
  promotor: string | null;
  lojas: string | null;
  uf: string | null;
  industria: string | null;
  codigo: string | null;
  descricao: string | null;
  preco: number | null;
  qtde_unit: number | null;
  lote: string | null;
  data_vencimento: string | null;
};

export type ValidadeStatusFilter = 'all' | 'soon' | 'expired';

export type ValidadeFilters = {
  search?: string;
  uf?: string;
  industria?: string;
  /** Formato YYYY-MM (mês de data_vencimento). */
  mes?: string;
  /** Filtro da legenda: próximos 30 dias ou já vencidos. */
  status?: ValidadeStatusFilter;
  page?: number;
  pageSize?: number;
  /** Escopo externo: só essa indústria. */
  scopeIndustria?: string;
  /** Escopo externo: grupo de lojas (ex. MATEUS) — ilike em lojas. */
  scopeClienteGrupo?: string;
};

export type ValidadeListResult = {
  data: Validade[];
  total: number;
};

function mapRow(row: Record<string, unknown>): Validade {
  return {
    id: Number(row.id),
    promotor: (row.promotor as string | null) ?? null,
    lojas: (row.lojas as string | null) ?? null,
    uf: (row.uf as string | null) ?? null,
    industria: row.industria ? toIndustriaPadrao(String(row.industria)) : null,
    codigo: row.codigo != null ? String(row.codigo) : null,
    descricao: (row.descricao as string | null) ?? null,
    preco: row.preco == null ? null : Number(row.preco),
    qtde_unit: row.qtde_unit == null ? null : Number(row.qtde_unit),
    lote: row.lote != null ? String(row.lote) : null,
    data_vencimento: row.data_vencimento != null ? String(row.data_vencimento) : null,
  };
}

export async function fetchValidades(filters: ValidadeFilters = {}): Promise<ValidadeListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? VALIDADE_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('validades')
    .select('*', { count: 'exact' })
    .order('data_vencimento', { ascending: true, nullsFirst: false });

  if (filters.scopeIndustria) {
    query = query.eq('industria', toIndustriaPadrao(filters.scopeIndustria));
  }

  if (filters.scopeClienteGrupo) {
    query = query.ilike('lojas', `%${filters.scopeClienteGrupo}%`);
  }

  if (filters.uf && filters.uf !== 'Todos') {
    query = query.eq('uf', filters.uf);
  }

  if (filters.industria && filters.industria !== 'Todos') {
    query = query.eq('industria', filters.industria);
  }

  if (filters.mes && filters.mes !== 'Todos') {
    const [yearStr, monthStr] = filters.mes.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (year && month >= 1 && month <= 12) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      query = query.gte('data_vencimento', start).lt('data_vencimento', end);
    }
  }

  if (filters.status === 'expired' || filters.status === 'soon') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    if (filters.status === 'expired') {
      query = query.lt('data_vencimento', todayIso);
    } else {
      const limit = new Date(today);
      limit.setDate(limit.getDate() + 30);
      const limitIso = limit.toISOString().slice(0, 10);
      query = query.gte('data_vencimento', todayIso).lte('data_vencimento', limitIso);
    }
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `promotor.ilike.${term},lojas.ilike.${term},codigo.ilike.${term},descricao.ilike.${term},lote.ilike.${term},industria.ilike.${term}`,
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return {
    data: (data ?? []).map(mapRow),
    total: count ?? 0,
  };
}

export async function fetchAllValidades(scope?: {
  scopeIndustria?: string;
  scopeClienteGrupo?: string;
}): Promise<Validade[]> {
  let query = supabase
    .from('validades')
    .select('*')
    .order('data_vencimento', { ascending: true, nullsFirst: false });

  if (scope?.scopeIndustria) {
    query = query.eq('industria', toIndustriaPadrao(scope.scopeIndustria));
  }
  if (scope?.scopeClienteGrupo) {
    query = query.ilike('lojas', `%${scope.scopeClienteGrupo}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

const MESES_LABEL = [
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
] as const;

export type ValidadeMesOption = { value: string; label: string };

export async function fetchValidadesFilterOptions(): Promise<{
  ufs: string[];
  industrias: string[];
  meses: ValidadeMesOption[];
}> {
  const { data, error } = await supabase.from('validades').select('uf, industria, data_vencimento');
  if (error) throw new Error(error.message);

  const ufs = new Set<string>();
  const industrias = new Set<string>();
  const meses = new Set<string>();

  for (const row of data ?? []) {
    if (row.uf) ufs.add(String(row.uf));
    if (row.industria) {
      const nome = toIndustriaPadrao(String(row.industria));
      if (nome) industrias.add(nome);
    }
    if (row.data_vencimento) {
      const ym = String(row.data_vencimento).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) meses.add(ym);
    }
  }

  const mesesOptions = Array.from(meses)
    .sort()
    .map((value) => {
      const [y, m] = value.split('-');
      const monthIdx = Number(m) - 1;
      const label = `${MESES_LABEL[monthIdx] ?? m}/${y}`;
      return { value, label };
    });

  return {
    ufs: Array.from(ufs).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    industrias: Array.from(industrias).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    meses: mesesOptions,
  };
}

/** Dias até o vencimento (negativo = já vencido). */
export function daysUntilVencimento(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const end = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

export function isExpiringSoon(dateStr: string | null | undefined): boolean {
  const days = daysUntilVencimento(dateStr);
  return days != null && days >= 0 && days <= 30;
}

export function isExpired(dateStr: string | null | undefined): boolean {
  const days = daysUntilVencimento(dateStr);
  return days != null && days < 0;
}
