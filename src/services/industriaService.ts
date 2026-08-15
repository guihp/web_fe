import { supabase } from '../lib/supabase';
import { toIndustriaPadrao } from '../utils/vendasDomain';

export type Industria = {
  id: number;
  Nome: string;
  status?: string | null;
};

function mapIndustria(row: Industria): Industria {
  return {
    ...row,
    Nome: toIndustriaPadrao(row.Nome ?? ''),
  };
}

export async function fetchIndustrias(): Promise<Industria[]> {
  const { data, error } = await supabase.from('industrias').select('id, Nome, status').order('Nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Industria[]).map(mapIndustria);
}

export async function fetchIndustriasAtivas(): Promise<Industria[]> {
  const rows = await fetchIndustrias();
  return rows.filter((row) => {
    const status = (row.status ?? 'Ativo').trim().toLowerCase();
    return status === 'ativo' || status === '';
  });
}

/** Lista única de nomes padronizados (MAIÚSCULO, sem sufixos). */
export async function fetchIndustriaNomes(): Promise<string[]> {
  const rows = await fetchIndustriasAtivas();
  const set = new Set<string>();
  for (const row of rows) {
    const nome = toIndustriaPadrao(row.Nome);
    if (nome) set.add(nome);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function fetchIndustriaNomesAtivas(): Promise<string[]> {
  return fetchIndustriaNomes();
}
