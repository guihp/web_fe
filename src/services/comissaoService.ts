import { supabase } from '../lib/supabase';
import type { ComissaoIndustria, IndustriaPercentual } from '../utils/vendasDomain';
import { toIndustriaPadrao } from '../utils/vendasDomain';
import { CATEGORIAS_VENDAS } from '../data/lancamentoVendasData';

export type ComissaoAggRow = {
  nome: string;
  mes: string;
  ano: string;
  regiao: string;
  valor_venda: number;
  percentual_aplicado: number;
  valor_comissao: number;
};

function isMesTodos(mes?: string | null) {
  if (!mes) return true;
  const n = mes.trim().toUpperCase();
  return n === '' || n === 'TODOS' || n === 'TODOS OS MESES';
}

function mapComissaoIndustria(row: Record<string, unknown>): ComissaoAggRow {
  return {
    nome: toIndustriaPadrao(String(row.industria ?? '')),
    mes: String(row.mes ?? ''),
    ano: String(row.ano ?? ''),
    regiao: String(row.regiao ?? ''),
    valor_venda: Number(row.valor_venda) || 0,
    percentual_aplicado: Number(row.percentual_aplicado) || 0,
    valor_comissao: Number(row.valor_comissao) || 0,
  };
}

/** Recalcula e salva comissão por indústria. Categoria opcional no % filtra as vendas. */
export async function calcularComissoes(ano: number, mes?: string): Promise<void> {
  const { error } = await supabase.rpc('calcular_comissoes', {
    p_ano: ano,
    p_mes: isMesTodos(mes) ? null : String(mes).toUpperCase(),
    p_modo: 'industria',
  });
  if (error) throw new Error(error.message);
}

export async function fetchComissaoRows(filters: {
  ano?: string;
  mes?: string;
  regiao?: string;
}): Promise<ComissaoAggRow[]> {
  let query = supabase.from('comissao_industria').select('*');

  if (filters.ano && filters.ano !== 'Todos') query = query.eq('ano', filters.ano);
  if (!isMesTodos(filters.mes)) query = query.eq('mes', String(filters.mes).toUpperCase());
  if (filters.regiao && filters.regiao !== 'Todas' && filters.regiao !== 'Todas Regiões') {
    query = query.eq('regiao', filters.regiao);
  }

  query = query.order('industria');

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapComissaoIndustria(row as Record<string, unknown>));
}

export async function fetchComissaoIndustria(filters: {
  ano?: string;
  mes?: string;
  regiao?: string;
}): Promise<ComissaoIndustria[]> {
  const rows = await fetchComissaoRows(filters);
  return rows.map((r) => ({
    id: '',
    industria: r.nome,
    mes: r.mes,
    ano: r.ano,
    regiao: r.regiao as ComissaoIndustria['regiao'],
    valor_venda: r.valor_venda,
    percentual_aplicado: r.percentual_aplicado,
    valor_comissao: r.valor_comissao,
    created_at: '',
  }));
}

export async function fetchPercentuais(): Promise<IndustriaPercentual[]> {
  const [{ data: pctRows, error: pctError }, { data: indRows, error: indError }] = await Promise.all([
    supabase.from('industria_percentual').select('*').order('industria'),
    supabase.from('industrias').select('"Nome", status').order('Nome'),
  ]);

  if (pctError) throw new Error(pctError.message);
  if (indError) throw new Error(indError.message);

  const pctMap = new Map<string, { percentual: number; categoria: string | null }>();
  for (const row of pctRows ?? []) {
    const nome = toIndustriaPadrao(String(row.industria ?? ''));
    if (!nome) continue;
    if (pctMap.has(nome)) continue;
    const cat = String(row.categoria ?? '')
      .trim()
      .toUpperCase();
    pctMap.set(nome, {
      percentual: Number(row.percentual) || 0,
      categoria: cat || null,
    });
  }

  const names = new Set<string>();
  for (const row of indRows ?? []) {
    const status = (row as { status?: string | null }).status;
    const s = (status ?? 'Ativo').trim().toLowerCase();
    if (s && s !== 'ativo') continue;
    const nome = toIndustriaPadrao(String((row as { Nome?: string }).Nome ?? ''));
    if (nome) names.add(nome);
  }

  return [...names]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((industria) => {
      const saved = pctMap.get(industria);
      return {
        industria,
        percentual: saved?.percentual ?? 2,
        categoria: saved?.categoria ?? null,
      };
    });
}

export async function updatePercentual(
  nome: string,
  percentual: number,
  categoria?: string | null,
): Promise<void> {
  const industria = toIndustriaPadrao(nome);
  const cat = categoria?.trim() ? categoria.trim().toUpperCase() : null;
  const { error } = await supabase.from('industria_percentual').upsert(
    { industria, percentual, categoria: cat },
    { onConflict: 'industria' },
  );
  if (error) throw new Error(error.message);
}

export const CATEGORIAS_COMISSAO = CATEGORIAS_VENDAS.map((c) => c.toUpperCase());

export function aggregateComissaoPorNome(rows: ComissaoAggRow[]) {
  const map = new Map<string, { vendas: number; comissao: number; percentual: number }>();

  for (const row of rows) {
    const key = row.nome || '—';
    const current = map.get(key) ?? { vendas: 0, comissao: 0, percentual: row.percentual_aplicado };
    current.vendas += row.valor_venda;
    current.comissao += row.valor_comissao;
    current.percentual = row.percentual_aplicado;
    map.set(key, current);
  }

  return Array.from(map.entries()).map(([nome, vals]) => ({
    nome,
    vendas: vals.vendas,
    comissao: vals.comissao,
    percentual: vals.percentual,
  }));
}

export function aggregateComissaoPorIndustria(rows: ComissaoIndustria[] | ComissaoAggRow[]) {
  const normalized: ComissaoAggRow[] = rows.map((row) => {
    if ('nome' in row) return row as ComissaoAggRow;
    const r = row as ComissaoIndustria;
    return {
      nome: toIndustriaPadrao(r.industria),
      mes: r.mes,
      ano: r.ano,
      regiao: r.regiao,
      valor_venda: r.valor_venda,
      percentual_aplicado: r.percentual_aplicado,
      valor_comissao: r.valor_comissao,
    };
  });
  return aggregateComissaoPorNome(normalized);
}

export function aggregateComissaoPorRegiao(rows: ComissaoAggRow[] | ComissaoIndustria[]) {
  const map = new Map<string, { vendas: number; comissao: number }>();

  for (const row of rows) {
    const regiao = 'regiao' in row ? row.regiao : '';
    const vendas = 'valor_venda' in row ? Number(row.valor_venda) : 0;
    const comissao = 'valor_comissao' in row ? Number(row.valor_comissao) : 0;
    const current = map.get(regiao) ?? { vendas: 0, comissao: 0 };
    current.vendas += vendas;
    current.comissao += comissao;
    map.set(regiao, current);
  }

  return Array.from(map.entries()).map(([regiao, vals]) => ({
    regiao,
    vendas: vals.vendas,
    comissao: vals.comissao,
  }));
}

export function aggregateComissaoMensal(rows: ComissaoAggRow[] | ComissaoIndustria[]) {
  const map = new Map<string, { vendas: number; comissao: number }>();

  for (const row of rows) {
    const mes = 'mes' in row ? row.mes : '';
    const vendas = 'valor_venda' in row ? Number(row.valor_venda) : 0;
    const comissao = 'valor_comissao' in row ? Number(row.valor_comissao) : 0;
    const current = map.get(mes) ?? { vendas: 0, comissao: 0 };
    current.vendas += vendas;
    current.comissao += comissao;
    map.set(mes, current);
  }

  return Array.from(map.entries()).map(([mes, vals]) => ({
    mes,
    vendas: vals.vendas,
    comissao: vals.comissao,
  }));
}
