import { supabase } from '../lib/supabase';
import type { BaseCliente } from '../utils/vendasDomain';
import { formatCdc, normalizeEstado } from '../utils/vendasDomain';
import type { ClienteForm } from '../data/clientesData';

export const CLIENTE_PAGE_SIZE = 15;

export type ClienteFilters = {
  search?: string;
  estado?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export type ClienteListResult = {
  data: BaseCliente[];
  total: number;
};

function mapRow(row: Record<string, unknown>): BaseCliente {
  return row as unknown as BaseCliente;
}

export async function fetchClientes(filters: ClienteFilters = {}): Promise<ClienteListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? CLIENTE_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('baseCliente').select('*', { count: 'exact' }).order('nome_fantasia');

  if (filters.estado && filters.estado !== 'Todos') {
    query = query.ilike('estado', filters.estado);
  }

  if (filters.status && filters.status !== 'Todos') {
    query = query.eq('status', filters.status);
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `cdc.ilike.${term},cnpj.ilike.${term},nome_fantasia.ilike.${term},razao_social.ilike.${term},cidade.ilike.${term},estado.ilike.${term}`
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return {
    data: (data ?? []).map(mapRow),
    total: count ?? 0,
  };
}

export async function fetchClienteByCdc(cdc: string): Promise<BaseCliente | null> {
  const formatted = formatCdc(cdc);
  const { data, error } = await supabase.from('baseCliente').select('*').eq('cdc', formatted).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function createCliente(form: ClienteForm): Promise<BaseCliente> {
  const payload = {
    cdc: formatCdc(form.cdc),
    cnpj: form.cnpj.replace(/\D/g, '') || form.cnpj.trim(),
    nome_fantasia: form.nomeFantasia.trim(),
    razao_social: form.razaoSocial.trim(),
    cidade: form.cidade.trim() || null,
    estado: normalizeEstado(form.estado),
    status: 'Ativo',
  };

  const { data, error } = await supabase.from('baseCliente').insert([payload]).select('*').single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateCliente(id: string, form: ClienteForm): Promise<BaseCliente> {
  const payload = {
    cdc: formatCdc(form.cdc),
    cnpj: form.cnpj.replace(/\D/g, '') || form.cnpj.trim(),
    nome_fantasia: form.nomeFantasia.trim(),
    razao_social: form.razaoSocial.trim(),
    cidade: form.cidade.trim() || null,
    estado: normalizeEstado(form.estado),
  };

  const { data, error } = await supabase.from('baseCliente').update(payload).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from('baseCliente').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setClienteStatus(
  id: string,
  status: 'Ativo' | 'Inativo',
): Promise<BaseCliente> {
  const { data, error } = await supabase
    .from('baseCliente')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function fetchAllClientes(): Promise<BaseCliente[]> {
  const { data, error } = await supabase.from('baseCliente').select('*').order('nome_fantasia');
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function upsertClientesBatch(rows: ClienteForm[]): Promise<number> {
  const payload = rows.map((form) => ({
    cdc: formatCdc(form.cdc),
    cnpj: form.cnpj.replace(/\D/g, '') || form.cnpj.trim(),
    nome_fantasia: form.nomeFantasia.trim(),
    razao_social: form.razaoSocial.trim(),
    cidade: form.cidade.trim() || null,
    estado: normalizeEstado(form.estado),
    status: form.status === 'Inativo' ? 'Inativo' : 'Ativo',
  }));

  const { error } = await supabase.from('baseCliente').upsert(payload, { onConflict: 'cdc' });
  if (error) throw new Error(error.message);
  return payload.length;
}

export function clienteToForm(cliente: BaseCliente): ClienteForm {
  return {
    cdc: cliente.cdc,
    cnpj: cliente.cnpj ?? '',
    razaoSocial: cliente.razao_social ?? '',
    nomeFantasia: cliente.nome_fantasia ?? '',
    cidade: cliente.cidade ?? '',
    estado: cliente.estado ?? 'MARANHÃO',
    status: (cliente.status === 'Inativo' ? 'Inativo' : 'Ativo'),
  };
}
