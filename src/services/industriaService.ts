import { supabase } from '../lib/supabase';

export type Industria = {
  id: number;
  Nome: string;
  status?: string | null;
};

export async function fetchIndustrias(): Promise<Industria[]> {
  const { data, error } = await supabase.from('industrias').select('id, Nome, status').order('Nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Industria[];
}

export async function fetchIndustriasAtivas(): Promise<Industria[]> {
  const rows = await fetchIndustrias();
  return rows.filter((row) => {
    const status = (row.status ?? 'Ativo').trim().toLowerCase();
    return status === 'ativo' || status === '';
  });
}

export async function fetchIndustriaNomes(): Promise<string[]> {
  const rows = await fetchIndustriasAtivas();
  return rows.map((row) => row.Nome).filter(Boolean);
}

export async function fetchIndustriaNomesAtivas(): Promise<string[]> {
  return fetchIndustriaNomes();
}
