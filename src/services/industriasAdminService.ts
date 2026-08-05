import { supabase } from '../lib/supabase';

export type IndustriaAdmin = {
  id: number;
  Nome: string;
  codigo: string | null;
  descricao: string | null;
  status: string | null;
  Criado_por: string | null;
  Data_Criacao: string | null;
};

export type IndustriaFormInput = {
  nome: string;
  codigo?: string;
  descricao?: string;
};

export async function fetchIndustriasAdmin(): Promise<IndustriaAdmin[]> {
  const { data, error } = await supabase
    .from('industrias')
    .select('id, Nome, codigo, descricao, status, Criado_por, Data_Criacao')
    .order('Nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as IndustriaAdmin[];
}

export async function createIndustria(input: IndustriaFormInput): Promise<IndustriaAdmin> {
  const nome = input.nome.trim();
  if (!nome) throw new Error('Informe o nome da indústria.');

  const payload = {
    Nome: nome,
    codigo: input.codigo?.trim() || null,
    descricao: input.descricao?.trim() || null,
    status: 'Ativo',
  };

  const { data, error } = await supabase.from('industrias').insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as IndustriaAdmin;
}

export async function updateIndustria(id: number, input: IndustriaFormInput): Promise<IndustriaAdmin> {
  const nome = input.nome.trim();
  if (!nome) throw new Error('Informe o nome da indústria.');

  const payload = {
    Nome: nome,
    codigo: input.codigo?.trim() || null,
    descricao: input.descricao?.trim() || null,
  };

  const { data, error } = await supabase
    .from('industrias')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as IndustriaAdmin;
}

export async function setIndustriaStatus(
  id: number,
  status: 'Ativo' | 'Inativo',
): Promise<IndustriaAdmin> {
  const { data, error } = await supabase
    .from('industrias')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as IndustriaAdmin;
}
