import { supabase } from '../lib/supabase';
import { lojaOrFilterForClienteGrupo } from '../utils/externalAccess';
import { MESES_PT, toIndustriaPadrao } from '../utils/vendasDomain';

export type TipoPesquisa = 'interna' | 'externa';

export type PesquisaItem = {
  id: number;
  descricao: string;
  industria: string;
  loja: string | null;
  uf: string | null;
  promotor: string | null;
  preco_varejo: number | null;
  preco_atacado: number | null;
  preco_custo: number | null;
  tipo_pesquisa: TipoPesquisa;
  mes: string | null;
  created_at: string | null;
};

export const PRICE_PAGE_SIZE = 25;

export function mesVigente(): string {
  return MESES_PT[new Date().getMonth()] ?? 'JANEIRO';
}

export function normalizeMesPesquisa(value: unknown): string | null {
  if (value == null || value === '') return null;
  const raw = String(value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!raw) return null;

  const hit = MESES_PT.find((m) => m.normalize('NFD').replace(/\p{M}/gu, '') === raw);
  return hit ?? String(value).trim().toUpperCase();
}

/** 1 mês disponível → esse; vários → mês vigente se existir, senão o mais recente na lista. */
export function pickDefaultMes(available: string[]): string {
  if (available.length === 0) return mesVigente();
  if (available.length === 1) return available[0];
  const vigente = mesVigente();
  if (available.includes(vigente)) return vigente;
  const ordered = MESES_PT.filter((m) => available.includes(m));
  return ordered[ordered.length - 1] ?? available[0];
}

/** Aceita "12,50" / "1.234,56" / "12.50" / número. */
export function parseMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/[^\d.-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatMoneyInput(value: number | null): string {
  if (value == null) return '';
  return value.toFixed(2).replace('.', ',');
}

function mapRow(row: Record<string, unknown>): PesquisaItem {
  const tipoRaw = String(row.tipo_pesquisa ?? 'interna').toLowerCase();
  const tipo: TipoPesquisa = tipoRaw === 'externa' ? 'externa' : 'interna';
  return {
    id: Number(row.id),
    descricao: String(row.descricao ?? '').trim() || '—',
    industria: toIndustriaPadrao(String(row.industria ?? '')) || '—',
    loja: row.loja != null ? String(row.loja) : null,
    uf: row.uf != null ? String(row.uf) : null,
    promotor: row.promotor != null ? String(row.promotor) : null,
    preco_varejo: parseMoney(row.preco_varejo),
    preco_atacado: parseMoney(row.preco_atacado),
    preco_custo: parseMoney(row.preco_custo),
    tipo_pesquisa: tipo,
    mes: normalizeMesPesquisa(row.mes),
    created_at: row.created_at != null ? String(row.created_at) : null,
  };
}

export type FetchPesquisaFilters = {
  tipo: TipoPesquisa;
  search?: string;
  industria?: string;
  /** Mês da pesquisa (ex.: AGOSTO). */
  mes?: string;
  page?: number;
  pageSize?: number;
  /** Escopo externo indústria: só essa indústria (interna e externa). */
  scopeIndustria?: string;
  /** Escopo externo cliente: grupo no nome da loja (ex. MATEUS). */
  scopeClienteGrupo?: string;
};

export type FetchPesquisaResult = {
  data: PesquisaItem[];
  total: number;
};

function applyPesquisaScope<T extends { eq: Function; ilike: Function; or: Function }>(
  query: T,
  filters: Pick<FetchPesquisaFilters, 'scopeIndustria' | 'scopeClienteGrupo' | 'industria'>,
): T {
  let q = query;

  if (filters.scopeIndustria) {
    q = q.eq('industria', toIndustriaPadrao(filters.scopeIndustria)) as T;
  } else if (filters.industria && filters.industria !== 'Todas') {
    q = q.eq('industria', toIndustriaPadrao(filters.industria)) as T;
  }

  if (filters.scopeClienteGrupo) {
    const orFilter = lojaOrFilterForClienteGrupo(filters.scopeClienteGrupo, 'loja');
    if (orFilter) q = q.or(orFilter) as T;
  }

  return q;
}

export async function fetchPesquisas(filters: FetchPesquisaFilters): Promise<FetchPesquisaResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PRICE_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('pesquisa')
    .select('*', { count: 'exact' })
    .eq('tipo_pesquisa', filters.tipo)
    .order('descricao', { ascending: true });

  query = applyPesquisaScope(query, filters);

  const mes = normalizeMesPesquisa(filters.mes);
  if (mes) {
    query = query.eq('mes', mes);
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `descricao.ilike.${term},industria.ilike.${term},loja.ilike.${term},promotor.ilike.${term}`,
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return {
    data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    total: count ?? 0,
  };
}

/** Todas as linhas do filtro atual (para exportação Excel). */
export async function fetchAllPesquisas(
  filters: Omit<FetchPesquisaFilters, 'page' | 'pageSize'>,
): Promise<PesquisaItem[]> {
  const pageSize = 1000;
  let page = 1;
  const all: PesquisaItem[] = [];

  for (;;) {
    const chunk = await fetchPesquisas({ ...filters, page, pageSize });
    all.push(...chunk.data);
    if (all.length >= chunk.total || chunk.data.length === 0) break;
    page += 1;
    if (page > 50) break;
  }

  return all;
}

export async function fetchPesquisaIndustrias(
  tipo: TipoPesquisa,
  scope?: { scopeIndustria?: string; scopeClienteGrupo?: string; mes?: string },
): Promise<string[]> {
  let query = supabase
    .from('pesquisa')
    .select('industria')
    .eq('tipo_pesquisa', tipo)
    .not('industria', 'is', null);

  query = applyPesquisaScope(query, {
    scopeIndustria: scope?.scopeIndustria,
    scopeClienteGrupo: scope?.scopeClienteGrupo,
  });

  const mes = normalizeMesPesquisa(scope?.mes);
  if (mes) query = query.eq('mes', mes);

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const set = new Set<string>();
  for (const row of data ?? []) {
    const nome = toIndustriaPadrao(String((row as { industria?: string }).industria ?? ''));
    if (nome) set.add(nome);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function fetchPesquisaMeses(
  tipo: TipoPesquisa,
  scope?: { scopeIndustria?: string; scopeClienteGrupo?: string },
): Promise<string[]> {
  let query = supabase
    .from('pesquisa')
    .select('mes')
    .eq('tipo_pesquisa', tipo)
    .not('mes', 'is', null);

  query = applyPesquisaScope(query, {
    scopeIndustria: scope?.scopeIndustria,
    scopeClienteGrupo: scope?.scopeClienteGrupo,
  });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const set = new Set<string>();
  for (const row of data ?? []) {
    const mes = normalizeMesPesquisa((row as { mes?: string }).mes);
    if (mes) set.add(mes);
  }

  const known = MESES_PT.filter((m) => set.has(m));
  const extras = [...set]
    .filter((m) => !(MESES_PT as readonly string[]).includes(m))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return [...known, ...extras];
}

/** Atualiza custo de uma pesquisa interna. */
export async function updatePesquisaCusto(id: number, preco_custo: number | null): Promise<void> {
  const { error } = await supabase
    .from('pesquisa')
    .update({ preco_custo })
    .eq('id', id)
    .eq('tipo_pesquisa', 'interna');
  if (error) throw new Error(error.message);
}

export type PesquisaCustoUpdate = { id: number; preco_custo: number };

/** Atualiza custos em lote (por id). Só linhas internas. */
export async function updatePesquisasCustoBatch(rows: PesquisaCustoUpdate[]): Promise<number> {
  if (rows.length === 0) return 0;

  const chunkSize = 40;
  let updated = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async ({ id, preco_custo }) => {
        const { data, error } = await supabase
          .from('pesquisa')
          .update({ preco_custo })
          .eq('id', id)
          .eq('tipo_pesquisa', 'interna')
          .select('id');
        if (error) throw new Error(error.message);
        return data?.length ?? 0;
      }),
    );
    updated += results.reduce((sum, n) => sum + n, 0);
  }

  return updated;
}

/** Markup % = ((PV - PC) / PC) * 100 */
export function calcMarkupPercent(pv: number | null, pc: number | null): number | null {
  if (pv == null || pc == null || pc === 0) return null;
  return ((pv - pc) / pc) * 100;
}

/** Markup exibido = markup% * (multiplicador% / 100) */
export function calcMarkupExibido(markupPct: number | null, multiplicadorPct: number): number | null {
  if (markupPct == null) return null;
  return markupPct * (multiplicadorPct / 100);
}

/** Margem % a partir do markup exibido = markup / (100 + markup) * 100 */
export function calcMargemFromMarkup(markupExibidoPct: number | null): number | null {
  if (markupExibidoPct == null) return null;
  const denom = 100 + markupExibidoPct;
  if (denom === 0) return null;
  return (markupExibidoPct / denom) * 100;
}

export function formatPct(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits).replace('.', ',')}%`;
}
