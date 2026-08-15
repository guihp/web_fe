import { supabase } from '../lib/supabase';
import { MESES_PT, type BaseVenda } from '../utils/vendasDomain';
import { toIndustriaPadrao } from '../utils/vendasDomain';
import { formatBRL } from '../utils/currency';

export const KANBAN_STATUSES = [
  'Enviado ou gerado',
  'Faturado',
  'Em trânsito',
  'Aguardando recebimento',
  'Entregue finalizado',
] as const;

export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

export const KANBAN_STATUS_DEFAULT: KanbanStatus = 'Enviado ou gerado';

export type PedidoKanbanCard = {
  vendaId: string;
  numeroPedido: string;
  cliente: string;
  cnpj: string;
  valor: number;
  industria: string;
  cidade: string;
  estado: string;
  vendedor: string;
  data: string;
  mes: string;
  ano: string;
  status: KanbanStatus;
};

export type KanbanFilters = {
  mes?: string;
  ano?: string;
  industria?: string;
  vendedor?: string;
  estado?: string;
  search?: string;
};

function mapVenda(row: Record<string, unknown>): BaseVenda {
  return {
    ...(row as unknown as BaseVenda),
    valor: Number(row.valor),
  };
}

function isKanbanStatus(value: string): value is KanbanStatus {
  return (KANBAN_STATUSES as readonly string[]).includes(value);
}

export function formatKanbanValor(valor: number) {
  return formatBRL(valor);
}

export function currentMesAnoLabel() {
  const now = new Date();
  return {
    mes: MESES_PT[now.getMonth()] ?? 'JANEIRO',
    ano: String(now.getFullYear()),
  };
}

export async function fetchKanbanPedidos(filters: KanbanFilters): Promise<PedidoKanbanCard[]> {
  let query = supabase.from('baseVendas').select('*').order('data', { ascending: false });

  if (filters.mes && filters.mes !== 'Todos') {
    query = query.eq('mes', filters.mes.toUpperCase());
  }
  if (filters.ano && filters.ano !== 'Todos') {
    query = query.eq('ano', filters.ano);
  }
  if (filters.industria && filters.industria !== 'Todas') {
    query = query.eq('industria', filters.industria);
  }
  if (filters.vendedor && filters.vendedor !== 'Todos') {
    query = query.eq('vendedor', filters.vendedor);
  }
  if (filters.estado && filters.estado !== 'Todos') {
    query = query.eq('estado', filters.estado);
  }

  const { data: vendas, error } = await query.limit(2000);
  if (error) throw new Error(error.message);

  const rows = (vendas ?? []).map(mapVenda);
  const ids = rows.map((r) => r.id);

  const statusByVenda = new Map<string, KanbanStatus>();
  if (ids.length > 0) {
    const { data: statuses, error: statusError } = await supabase
      .from('pedido_kanban')
      .select('venda_id, status')
      .in('venda_id', ids);

    if (statusError) throw new Error(statusError.message);

    for (const row of statuses ?? []) {
      const status = String(row.status ?? '');
      if (isKanbanStatus(status)) {
        statusByVenda.set(String(row.venda_id), status);
      }
    }
  }

  const term = filters.search?.trim().toLowerCase() ?? '';

  return rows
    .map((v) => ({
      vendaId: v.id,
      numeroPedido: v.numero_pedido,
      cliente: v.cliente?.trim() || '—',
      cnpj: v.cnpj?.trim() || '—',
      valor: Number(v.valor) || 0,
      industria: toIndustriaPadrao(v.industria?.trim() || '') || '—',
      cidade: v.cidade?.trim() || '—',
      estado: v.estado?.trim() || '',
      vendedor: v.vendedor?.trim() || '—',
      data: v.data,
      mes: v.mes ?? '',
      ano: v.ano ?? '',
      status: statusByVenda.get(v.id) ?? KANBAN_STATUS_DEFAULT,
    }))
    .filter((card) => {
      if (!term) return true;
      return (
        card.numeroPedido.toLowerCase().includes(term) ||
        card.cliente.toLowerCase().includes(term) ||
        card.cnpj.toLowerCase().includes(term) ||
        card.industria.toLowerCase().includes(term) ||
        card.cidade.toLowerCase().includes(term) ||
        card.vendedor.toLowerCase().includes(term)
      );
    });
}

export async function setPedidoKanbanStatus(
  vendaId: string,
  status: KanbanStatus,
): Promise<void> {
  const { error } = await supabase.from('pedido_kanban').upsert(
    {
      venda_id: vendaId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'venda_id' },
  );

  if (error) throw new Error(error.message);
}

export async function fetchKanbanFilterOptions(ano?: string) {
  let query = supabase.from('baseVendas').select('industria, vendedor, estado, ano');
  if (ano && ano !== 'Todos') {
    query = query.eq('ano', ano);
  }

  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);

  const industrias = new Set<string>();
  const vendedores = new Set<string>();
  const estados = new Set<string>();
  const anos = new Set<string>();

  for (const row of data ?? []) {
    if (row.industria) {
      const nome = toIndustriaPadrao(String(row.industria));
      if (nome) industrias.add(nome);
    }
    if (row.vendedor) vendedores.add(String(row.vendedor));
    if (row.estado) estados.add(String(row.estado));
    if (row.ano) anos.add(String(row.ano));
  }

  return {
    industrias: [...industrias].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    vendedores: [...vendedores].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    estados: [...estados].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    anos: [...anos].sort((a, b) => Number(b) - Number(a)),
  };
}
