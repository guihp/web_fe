import { supabase } from '../lib/supabase';
import type { ComissaoIndustria, IndustriaPercentual } from '../utils/vendasDomain';

function mapComissao(row: Record<string, unknown>): ComissaoIndustria {
  return {
    ...(row as unknown as ComissaoIndustria),
    valor_venda: Number(row.valor_venda),
    percentual_aplicado: Number(row.percentual_aplicado),
    valor_comissao: Number(row.valor_comissao),
  };
}

export async function calcularComissoes(ano: number, mes?: string): Promise<void> {
  const { error } = await supabase.rpc('calcular_comissoes', {
    p_ano: ano,
    p_mes: mes && mes !== 'Todos' ? mes : null,
  });
  if (error) throw new Error(error.message);
}

export async function fetchComissaoIndustria(filters: {
  ano?: string;
  mes?: string;
  regiao?: string;
}): Promise<ComissaoIndustria[]> {
  let query = supabase.from('comissao_industria').select('*').order('industria');

  if (filters.ano && filters.ano !== 'Todos') query = query.eq('ano', filters.ano);
  if (filters.mes && filters.mes !== 'Todos') query = query.eq('mes', filters.mes);
  if (filters.regiao && filters.regiao !== 'Todas') query = query.eq('regiao', filters.regiao);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapComissao);
}

export async function fetchPercentuais(): Promise<IndustriaPercentual[]> {
  const { data, error } = await supabase.from('industria_percentual').select('*').order('industria');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    industria: row.industria,
    percentual: Number(row.percentual),
  }));
}

export async function updatePercentual(industria: string, percentual: number): Promise<void> {
  const { error } = await supabase
    .from('industria_percentual')
    .upsert({ industria, percentual }, { onConflict: 'industria' });
  if (error) throw new Error(error.message);
}

export function aggregateComissaoPorIndustria(rows: ComissaoIndustria[]) {
  const map = new Map<string, { vendas: number; comissao: number; percentual: number }>();

  for (const row of rows) {
    const current = map.get(row.industria) ?? { vendas: 0, comissao: 0, percentual: row.percentual_aplicado };
    current.vendas += row.valor_venda;
    current.comissao += row.valor_comissao;
    map.set(row.industria, current);
  }

  return Array.from(map.entries()).map(([nome, vals]) => ({
    nome,
    vendas: vals.vendas,
    comissao: vals.comissao,
    percentual: vals.percentual,
  }));
}

export function aggregateComissaoPorRegiao(rows: ComissaoIndustria[]) {
  const map = new Map<string, { vendas: number; comissao: number }>();

  for (const row of rows) {
    const current = map.get(row.regiao) ?? { vendas: 0, comissao: 0 };
    current.vendas += row.valor_venda;
    current.comissao += row.valor_comissao;
    map.set(row.regiao, current);
  }

  return Array.from(map.entries()).map(([regiao, vals]) => ({
    regiao,
    vendas: vals.vendas,
    comissao: vals.comissao,
  }));
}

export function aggregateComissaoMensal(rows: ComissaoIndustria[]) {
  const map = new Map<string, { vendas: number; comissao: number }>();

  for (const row of rows) {
    const current = map.get(row.mes) ?? { vendas: 0, comissao: 0 };
    current.vendas += row.valor_venda;
    current.comissao += row.valor_comissao;
    map.set(row.mes, current);
  }

  return Array.from(map.entries()).map(([mes, vals]) => ({
    mes,
    vendas: vals.vendas,
    comissao: vals.comissao,
  }));
}
