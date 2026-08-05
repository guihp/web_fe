import { supabase } from '../lib/supabase';

export type Regional = {
  id: number;
  Nome: string;
  codigo: string | null;
  descricao: string | null;
  status: string | null;
  Criado_por: string | null;
  Data_Criacao: string | null;
};

export type RegionalFormInput = {
  nome: string;
  codigo?: string;
  descricao?: string;
};

export async function fetchRegionaisAdmin(): Promise<Regional[]> {
  const { data, error } = await supabase
    .from('regionais')
    .select('id, Nome, codigo, descricao, status, Criado_por, Data_Criacao')
    .order('id');
  if (error) throw new Error(error.message);
  return (data ?? []) as Regional[];
}

export async function createRegional(input: RegionalFormInput): Promise<Regional> {
  const nome = input.nome.trim();
  if (!nome) throw new Error('Informe o nome da regional.');

  const payload = {
    Nome: nome,
    codigo: input.codigo?.trim() || null,
    descricao: input.descricao?.trim() || null,
    status: 'Ativo',
  };

  const { data, error } = await supabase.from('regionais').insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as Regional;
}

export async function updateRegional(id: number, input: RegionalFormInput): Promise<Regional> {
  const nome = input.nome.trim();
  if (!nome) throw new Error('Informe o nome da regional.');

  const payload = {
    Nome: nome,
    codigo: input.codigo?.trim() || null,
    descricao: input.descricao?.trim() || null,
  };

  const { data, error } = await supabase
    .from('regionais')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Regional;
}

export async function setRegionalStatus(id: number, status: 'Ativo' | 'Inativo'): Promise<Regional> {
  const { data, error } = await supabase
    .from('regionais')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Regional;
}
