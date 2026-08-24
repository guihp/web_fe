import { supabase } from '../lib/supabase';
import { formatBRL } from '../utils/currency';
import {
  isExternalTipo,
  matchIndustriaScope,
  matchVendaByClienteGrupo,
  type TipoUsuario,
} from '../utils/externalAccess';
import { toIndustriaPadrao } from '../utils/vendasDomain';

export type NotificationKind = 'venda' | 'kanban_pedido' | 'kanban_financeiro';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  at: string;
  href: string;
};

export type NotificationViewerScope = {
  tipo_usuario?: TipoUsuario | string | null;
  industria_nome?: string | null;
  cliente_grupo?: string | null;
  login_cnpj?: string | null;
};

const FIN_COLUNA_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aguardando: 'Aguardando',
  faturado: 'Faturado',
};

function toIso(value: string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  return new Date(value).toISOString();
}

function isExternalViewer(scope?: NotificationViewerScope | null) {
  return isExternalTipo(scope?.tipo_usuario ?? '');
}

export async function fetchAppNotifications(
  limit = 20,
  scope?: NotificationViewerScope | null,
): Promise<AppNotification[]> {
  const externo = isExternalViewer(scope);

  // Externos só acompanham Sucesso do cliente do próprio escopo (sem vendas gerais / financeiro).
  if (externo) {
    return fetchExternalPedidoNotifications(limit, scope);
  }

  const [vendasRes, pedidosRes, fatRes] = await Promise.all([
    supabase
      .from('baseVendas')
      .select('id, numero_pedido, cliente, industria, valor, vendedor, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('pedido_kanban')
      .select('id, status, updated_at, venda_id')
      .order('updated_at', { ascending: false })
      .limit(12),
    supabase
      .from('contrato_faturamento')
      .select('id, coluna, valor, updated_at, contratos(titulo, industria)')
      .order('updated_at', { ascending: false })
      .limit(12),
  ]);

  if (vendasRes.error) throw new Error(vendasRes.error.message);
  if (pedidosRes.error) throw new Error(pedidosRes.error.message);
  if (fatRes.error) throw new Error(fatRes.error.message);

  const pedidoRows = pedidosRes.data ?? [];
  const vendaIds = [...new Set(pedidoRows.map((row) => String(row.venda_id)).filter(Boolean))];
  const vendaById = new Map<
    string,
    { numero_pedido?: string; cliente?: string; industria?: string }
  >();

  if (vendaIds.length > 0) {
    const { data: vendasKanban, error: vendasKanbanError } = await supabase
      .from('baseVendas')
      .select('id, numero_pedido, cliente, industria')
      .in('id', vendaIds);
    if (vendasKanbanError) throw new Error(vendasKanbanError.message);
    for (const row of vendasKanban ?? []) {
      vendaById.set(String(row.id), row);
    }
  }

  const items: AppNotification[] = [];

  for (const row of vendasRes.data ?? []) {
    const pedido = String(row.numero_pedido ?? '—');
    const cliente = String(row.cliente ?? 'Cliente');
    const industria = String(row.industria ?? '');
    const valor = formatBRL(Number(row.valor) || 0);
    items.push({
      id: `venda-${row.id}`,
      kind: 'venda',
      title: 'Lançamento de venda',
      detail: `Pedido ${pedido} · ${cliente}${industria ? ` · ${industria}` : ''} · ${valor}`,
      at: toIso(row.created_at as string),
      href: '/base-vendas',
    });
  }

  for (const row of pedidoRows) {
    const venda = vendaById.get(String(row.venda_id));
    const pedido = String(venda?.numero_pedido ?? '—');
    const cliente = String(venda?.cliente ?? 'Cliente');
    const status = String(row.status ?? 'Atualizado');
    items.push({
      id: `pedido-${row.id}-${row.updated_at}`,
      kind: 'kanban_pedido',
      title: 'Kanban Sucesso do Cliente',
      detail: `Pedido ${pedido} · ${cliente} → ${status}`,
      at: toIso(row.updated_at as string),
      href: '/fe-representacoes/sucesso-cliente',
    });
  }

  for (const row of fatRes.data ?? []) {
    const contrato = Array.isArray(row.contratos) ? row.contratos[0] : row.contratos;
    const titulo = String((contrato as { titulo?: string } | null)?.titulo ?? 'Contrato');
    const industria = String((contrato as { industria?: string } | null)?.industria ?? '');
    const coluna = FIN_COLUNA_LABEL[String(row.coluna)] ?? String(row.coluna ?? '');
    const valor = formatBRL(Number(row.valor) || 0);
    items.push({
      id: `fat-${row.id}-${row.updated_at}`,
      kind: 'kanban_financeiro',
      title: 'Kanban Financeiro',
      detail: `${titulo}${industria ? ` · ${industria}` : ''} → ${coluna} · ${valor}`,
      at: toIso(row.updated_at as string),
      href: '/financeiro?tab=kanban',
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

async function fetchExternalPedidoNotifications(
  limit: number,
  scope?: NotificationViewerScope | null,
): Promise<AppNotification[]> {
  const industriaNome = scope?.industria_nome ? toIndustriaPadrao(scope.industria_nome) : '';
  const clienteGrupo = (scope?.cliente_grupo ?? '').trim().toUpperCase();
  const loginCnpj = scope?.login_cnpj ?? null;

  if (!industriaNome && !clienteGrupo) {
    return [];
  }

  // Busca mais linhas e filtra no escopo (evita vazar notificações de terceiros).
  const { data: pedidoRows, error } = await supabase
    .from('pedido_kanban')
    .select('id, status, updated_at, venda_id')
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);

  const rows = pedidoRows ?? [];
  const vendaIds = [...new Set(rows.map((row) => String(row.venda_id)).filter(Boolean))];
  if (vendaIds.length === 0) return [];

  const { data: vendasKanban, error: vendasKanbanError } = await supabase
    .from('baseVendas')
    .select('id, numero_pedido, cliente, industria, cnpj')
    .in('id', vendaIds);

  if (vendasKanbanError) throw new Error(vendasKanbanError.message);

  const vendaById = new Map<
    string,
    { numero_pedido?: string; cliente?: string; industria?: string; cnpj?: string }
  >();
  for (const row of vendasKanban ?? []) {
    vendaById.set(String(row.id), row);
  }

  const items: AppNotification[] = [];

  for (const row of rows) {
    const venda = vendaById.get(String(row.venda_id));
    if (!venda) continue;

    if (industriaNome && !matchIndustriaScope(venda.industria, industriaNome)) {
      continue;
    }
    if (
      clienteGrupo &&
      !matchVendaByClienteGrupo(
        { cnpj: venda.cnpj, cliente: venda.cliente },
        clienteGrupo,
        loginCnpj,
      )
    ) {
      continue;
    }

    const pedido = String(venda.numero_pedido ?? '—');
    const cliente = String(venda.cliente ?? 'Cliente');
    const status = String(row.status ?? 'Atualizado');
    items.push({
      id: `pedido-${row.id}-${row.updated_at}`,
      kind: 'kanban_pedido',
      title: 'Kanban Sucesso do Cliente',
      detail: `Pedido ${pedido} · ${cliente} → ${status}`,
      at: toIso(row.updated_at as string),
      href: '/fe-representacoes/sucesso-cliente',
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

const SEEN_KEY = 'fe_web_notifications_seen_at';

export function getNotificationsSeenAt(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markNotificationsSeen(at = new Date().toISOString()) {
  try {
    localStorage.setItem(SEEN_KEY, at);
  } catch {
    /* ignore */
  }
}

export function countUnread(items: AppNotification[], seenAt: string | null) {
  if (!seenAt) return items.length;
  const seen = new Date(seenAt).getTime();
  return items.filter((item) => new Date(item.at).getTime() > seen).length;
}

export function formatNotificationTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return date.toLocaleDateString('pt-BR');
}
