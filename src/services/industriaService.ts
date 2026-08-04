import { supabase } from '../lib/supabase';

export type Industria = {
  id: number;
  Nome: string;
};

export async function fetchIndustrias(): Promise<Industria[]> {
  const { data, error } = await supabase.from('industrias').select('id, Nome').order('Nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Industria[];
}

export async function fetchIndustriaNomes(): Promise<string[]> {
  const rows = await fetchIndustrias();
  return rows.map((row) => row.Nome).filter(Boolean);
}
