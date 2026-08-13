import { supabase } from '../lib/supabase';
import type { LancamentoVendaForm } from '../data/lancamentoVendasData';
import {
  formatCdc,
  mesAnoFromDate,
  normalizeEstado,
  VENDEDORES,
  type BaseVenda,
} from '../utils/vendasDomain';
import { fetchClienteByCdc } from './clienteService';
import { fetchIndustriaNomes } from './industriaService';
import { sendVendaWebhook } from './webhookService';

export const VENDA_PAGE_SIZE = 15;

export type VendaFilters = {
  search?: string;
  industria?: string;
  mes?: string;
  ano?: string;
  estado?: string;
  vendedor?: string;
  page?: number;
  pageSize?: number;
};

export type VendaListResult = {
  data: BaseVenda[];
  total: number;
};

function mapRow(row: Record<string, unknown>): BaseVenda {
  return {
    ...(row as unknown as BaseVenda),
    valor: Number(row.valor),
  };
}

function parseValor(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  return Number(normalized) || 0;
}

function normalizeVendedor(value: string | null | undefined): (typeof VENDEDORES)[number] {
  const raw = (value ?? '').trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  const match = VENDEDORES.find(
    (nome) => nome.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '') === raw,
  );
  if (match) return match;
  // fallback seguro para a constraint do banco
  return 'JOAO ANTONIO';
}

export async function createVenda(form: LancamentoVendaForm): Promise<BaseVenda> {
  const cdc = formatCdc(form.cdc);
  const cliente = await fetchClienteByCdc(cdc);
  if (!cliente) {
    throw new Error(`Cliente com CDC ${cdc} não encontrado. Cadastre em Cadastro de Clientes.`);
  }

  const { mes, ano } = mesAnoFromDate(form.dataLancamento);
  const valor = parseValor(form.valor);

  const payload = {
    data: form.dataLancamento,
    cdc,
    numero_pedido: form.pedido.trim(),
    valor,
    industria: form.industria,
    categoria: form.categoria || null,
    vendedor: form.vendedor,
    cliente: cliente.nome_fantasia?.trim() || form.nomeFantasia.trim(),
    cnpj: cliente.cnpj,
    cidade: cliente.cidade,
    estado: normalizeEstado(cliente.estado ?? form.estado),
    mes,
    ano,
  };

  const { data, error } = await supabase.from('baseVendas').insert([payload]).select('*').single();
  if (error) throw new Error(error.message);

  const venda = mapRow(data);
  await sendVendaWebhook('venda_lancada', { venda });
  return venda;
}

export async function fetchVendas(filters: VendaFilters = {}): Promise<VendaListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? VENDA_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('baseVendas').select('*', { count: 'exact' }).order('data', { ascending: false });

  if (filters.industria && filters.industria !== 'Todas') {
    query = query.eq('industria', filters.industria);
  }
  if (filters.mes && filters.mes !== 'Todos') {
    query = query.eq('mes', filters.mes);
  }
  if (filters.ano && filters.ano !== 'Todos') {
    query = query.eq('ano', filters.ano);
  }
  if (filters.estado && filters.estado !== 'Todos') {
    query = query.ilike('estado', filters.estado);
  }
  if (filters.vendedor && filters.vendedor !== 'Todos') {
    query = query.eq('vendedor', filters.vendedor);
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `cdc.ilike.${term},numero_pedido.ilike.${term},cliente.ilike.${term},industria.ilike.${term},vendedor.ilike.${term}`
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return {
    data: (data ?? []).map(mapRow),
    total: count ?? 0,
  };
}

export async function updateVenda(id: string, patch: Partial<BaseVenda>): Promise<BaseVenda> {
  const payload: Record<string, unknown> = {};
  if (patch.data !== undefined) payload.data = patch.data;
  if (patch.cdc !== undefined) payload.cdc = patch.cdc;
  if (patch.numero_pedido !== undefined) payload.numero_pedido = patch.numero_pedido;
  if (patch.valor !== undefined) payload.valor = Number(patch.valor);
  if (patch.industria !== undefined) payload.industria = patch.industria;
  if (patch.categoria !== undefined) payload.categoria = patch.categoria;
  if (patch.vendedor !== undefined) payload.vendedor = normalizeVendedor(patch.vendedor);
  if (patch.cliente !== undefined) payload.cliente = patch.cliente;
  if (patch.cnpj !== undefined) payload.cnpj = patch.cnpj;
  if (patch.cidade !== undefined) payload.cidade = patch.cidade;
  if (patch.estado !== undefined) payload.estado = normalizeEstado(patch.estado ?? '');
  if (patch.mes !== undefined) payload.mes = (patch.mes ?? '').toUpperCase();
  if (patch.ano !== undefined) payload.ano = patch.ano;

  const { data, error } = await supabase
    .from('baseVendas')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const venda = mapRow(data);
  await sendVendaWebhook('venda_editada', { venda });
  return venda;
}

export async function deleteVenda(id: string): Promise<void> {
  const { data: existing } = await supabase.from('baseVendas').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase.from('baseVendas').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (existing) {
    await sendVendaWebhook('venda_cancelada', { venda: mapRow(existing) });
  }
}

export async function fetchAllVendas(): Promise<BaseVenda[]> {
  const { data, error } = await supabase.from('baseVendas').select('*').order('data', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function fetchVendasFilterOptions() {
  const [{ data, error }, industriaNomes] = await Promise.all([
    supabase.from('baseVendas').select('mes, ano, estado, vendedor'),
    fetchIndustriaNomes(),
  ]);
  if (error) throw new Error(error.message);

  const meses = new Set<string>();
  const anos = new Set<string>();
  const estados = new Set<string>();
  const vendedores = new Set<string>();

  for (const row of data ?? []) {
    if (row.mes) meses.add(row.mes);
    if (row.ano) anos.add(row.ano);
    if (row.estado) estados.add(row.estado);
    if (row.vendedor) vendedores.add(row.vendedor);
  }

  return {
    industrias: ['Todas', ...industriaNomes],
    meses: ['Todos', ...Array.from(meses).sort()],
    anos: ['Todos', ...Array.from(anos).sort((a, b) => Number(b) - Number(a))],
    estados: ['Todos', ...Array.from(estados).sort()],
    vendedores: ['Todos', ...Array.from(vendedores).sort()],
  };
}

export async function upsertVendasBatch(
  rows: Array<{
    data: string;
    cdc: string;
    numero_pedido: string;
    valor: number;
    industria: string;
    categoria?: string;
    vendedor: string;
    cliente?: string;
    cnpj?: string;
    cidade?: string;
    estado?: string;
    mes?: string;
    ano?: string;
  }>
): Promise<number> {
  const payload = await Promise.all(
    rows.map(async (row) => {
      const cliente = await fetchClienteByCdc(row.cdc);
      const derived = mesAnoFromDate(row.data);
      return {
        data: row.data,
        cdc: formatCdc(row.cdc),
        numero_pedido: row.numero_pedido.trim(),
        valor: row.valor,
        industria: row.industria || null,
        categoria: row.categoria || null,
        vendedor: normalizeVendedor(row.vendedor),
        cliente: cliente?.nome_fantasia?.trim() || row.cliente || null,
        cnpj: cliente?.cnpj || row.cnpj || null,
        cidade: cliente?.cidade || row.cidade || null,
        estado: normalizeEstado(cliente?.estado ?? row.estado ?? ''),
        mes: row.mes || derived.mes,
        ano: row.ano || derived.ano,
      };
    })
  );

  const { error } = await supabase.from('baseVendas').insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

export { parseValor };
