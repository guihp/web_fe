import { supabase } from '../lib/supabase';
import { formatBRL } from '../utils/currency';
import {
  isExternalTipo,
  matchIndustriaScope,
  matchVendaByClienteGrupo,
  type TipoUsuario,
} from '../utils/externalAccess';
import { toIndustriaPadrao } from '../utils/vendasDomain';
import {
  fetchEncartesRecentesParaUsuario,
  formatEncarteDateBr,
  lojaLabelForEncarte,
  produtoLabelForEncarte,
} from './encarteService';
import { fetchMetaBatidaAlerts } from './metasService';

export type NotificationKind =
  | 'venda'
  | 'kanban_pedido'
  | 'kanban_financeiro'
  | 'aviso'
  | 'aniversario'
  | 'meta'
  | 'encarte'
  | 'atividade';

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
  cargo?: string | null;
  industria_nome?: string | null;
  cliente_grupo?: string | null;
  login_cnpj?: string | null;
  usuario_id?: number | null;
  usuario_nome?: string | null;
  data_nascimento?: string | null;
};

const FIN_COLUNA_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aguardando: 'Aguardando',
  faturado: 'Faturado',
};

function normalizeCargoKey(cargo: string) {
  return cargo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Promotor / Demonstradora: só avisos (salário, feriado, folha) + aniversário. */
export function isCampoMerchNotifCargo(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const key = normalizeCargoKey(cargo);
  return key === 'promotor' || key === 'demonstradora';
}

/**
 * Liderança interna: Gerente, Supervisor, Analista admin, RH e Financeiro.
 * Recebem aviso de meta mensal/anual batida por regional.
 */
export function isLiderancaNotifCargo(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const key = normalizeCargoKey(cargo);
  return (
    key === 'gerente' ||
    key === 'supervisor' ||
    key === 'analista admin' ||
    key === 'rh' ||
    key === 'financeiro'
  );
}

function toIso(value: string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  // YYYY-MM-DD → meio-dia BRT (evita UTC 00:00 cair no fim da fila)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T12:00:00-03:00`).toISOString();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date(0).toISOString();
  return d.toISOString();
}

function isExternalViewer(scope?: NotificationViewerScope | null) {
  return isExternalTipo(scope?.tipo_usuario ?? '');
}

/** Data de calendário hoje em America/Sao_Paulo (YYYY-MM-DD). */
function todayKeyBRT(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** ISO em BRT para um dia civil (horário estável, sem “fim do dia”). */
function brtDayAt(key: string, hour = 9, minute = 0): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${key}T${hh}:${mm}:00-03:00`).toISOString();
}

/** Lista do sino: retenção rolante de 48h a partir do horário do evento. */
const NOTIF_RETENTION_MS = 48 * 60 * 60 * 1000;

function notifWindowStartIso(now = new Date()): string {
  return new Date(now.getTime() - NOTIF_RETENTION_MS).toISOString();
}

/** YYYY-MM-DD BRT do início da janela de 48h (para filtros por data civil). */
function notifWindowStartKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now.getTime() - NOTIF_RETENTION_MS));
}

function isWithinRetention(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const n = now.getTime();
  // Ainda não “caiu”: horário do evento no futuro → fora da lista/badge
  if (t > n) return false;
  return t >= n - NOTIF_RETENTION_MS;
}

function filterRecentNotifications(items: AppNotification[], now = new Date()): AppNotification[] {
  return items.filter((item) => isWithinRetention(item.at, now));
}

function isBirthdayToday(dataNascimento: string | null | undefined, todayKey = todayKeyBRT()): boolean {
  const match = String(dataNascimento ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const birthMonth = match[2];
  const birthDay = match[3];
  const [, todayMonth, todayDay] = todayKey.split('-');

  // 29/02 em ano não bissexto: felicita em 28/02
  if (birthMonth === '02' && birthDay === '29') {
    const year = Number(todayKey.slice(0, 4));
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (isLeap) return todayMonth === '02' && todayDay === '29';
    return todayMonth === '02' && todayDay === '28';
  }

  return birthMonth === todayMonth && birthDay === todayDay;
}

function birthdayNotification(scope?: NotificationViewerScope | null): AppNotification | null {
  if (!isBirthdayToday(scope?.data_nascimento)) return null;
  const firstName = (scope?.usuario_nome ?? 'você').trim().split(/\s+/)[0] || 'você';
  const userId = scope?.usuario_id ?? 0;
  const today = todayKeyBRT();
  return {
    id: `aniversario-${userId}-${today}`,
    kind: 'aniversario',
    title: 'Feliz aniversário!',
    detail: `Olá, ${firstName}! A equipe Fé Merchandising deseja a você um dia repleto de alegrias, saúde e conquistas. Parabéns!`,
    at: brtDayAt(today, 8, 0),
    href: '/',
  };
}

function priorityRank(kind: NotificationKind): number {
  if (kind === 'aniversario') return 0;
  if (kind === 'atividade') return 1;
  if (kind === 'encarte') return 2;
  if (kind === 'meta') return 3;
  return 4;
}

function withBirthday(
  items: AppNotification[],
  limit: number,
  scope?: NotificationViewerScope | null,
  includeBirthday = true,
): AppNotification[] {
  const bday = includeBirthday ? birthdayNotification(scope) : null;
  const merged = bday ? [bday, ...items] : items;
  return merged
    .sort((a, b) => {
      const byKind = priorityRank(a.kind) - priorityRank(b.kind);
      if (byKind !== 0) return byKind;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    })
    .slice(0, limit);
}

function mapEncarteNotifications(
  encartes: Awaited<ReturnType<typeof fetchEncartesRecentesParaUsuario>>,
): AppNotification[] {
  return encartes.map((e) => {
    const day = e.dataPromocao ?? todayKeyBRT();
    return {
      id: `encarte-${e.id}-${day}`,
      kind: 'encarte' as const,
      title: `Promoção: ${produtoLabelForEncarte(e, 'Encarte')}`,
      detail: `${e.marca ?? '—'} · ${lojaLabelForEncarte(e)} · até ${formatEncarteDateBr(e.dataFim)}`,
      at: brtDayAt(day, 9, 0),
      href: '/merchandising',
    };
  });
}

async function safeEncartesRecentes(
  scope?: NotificationViewerScope | null,
): Promise<Awaited<ReturnType<typeof fetchEncartesRecentesParaUsuario>>> {
  try {
    return await fetchEncartesRecentesParaUsuario({
      tipo_usuario: scope?.tipo_usuario,
      cargo: scope?.cargo,
      industria_nome: scope?.industria_nome,
      cliente_grupo: scope?.cliente_grupo,
      usuario_id: scope?.usuario_id,
    });
  } catch (error) {
    console.warn(
      '[notificações] Falha ao buscar encartes recentes:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function formatAtividadePeriodo(inicio: string | null | undefined, fim: string | null | undefined) {
  const fmt = (v: string | null | undefined) => {
    if (!v) return '—';
    const [y, m, d] = String(v).slice(0, 10).split('-');
    if (!y || !m || !d) return String(v).slice(0, 10);
    return `${d}/${m}/${y}`;
  };
  const a = fmt(inicio);
  const b = fmt(fim);
  return a === b ? a : `${a} → ${b}`;
}

/** Tarefas cujo início caiu nas últimas 48h e ainda estão vigentes. */
async function fetchAtividadeNotificationsForUser(
  usuarioId: number | null | undefined,
  limit = 12,
): Promise<AppNotification[]> {
  if (!usuarioId) return [];
  try {
    const today = todayKeyBRT();
    const windowStart = notifWindowStartKey();
    const { data, error } = await supabase
      .from('atividades')
      .select('id, tipo, loja, industria, data_inicio, data_fim, status')
      .eq('usuario_responsavel', usuarioId)
      .order('id', { ascending: false })
      .limit(Math.max(limit * 3, 24));

    if (error) throw new Error(error.message);

    const now = new Date();
    return (data ?? [])
      .filter((row) => {
        const status = String(row.status ?? '').toLowerCase();
        if (status === 'cancelado' || status === 'cancelada') return false;
        const inicio = String(row.data_inicio ?? '').slice(0, 10);
        const fim = String(row.data_fim ?? '').slice(0, 10);
        if (!inicio) return false;
        if (inicio < windowStart || inicio > today) return false;
        if (fim && fim < today) return false;
        return isWithinRetention(brtDayAt(inicio, 8, 30), now);
      })
      .slice(0, limit)
      .map((row) => {
        const tipo = String(row.tipo ?? 'Tarefa');
        const loja = String(row.loja ?? '—');
        const industria = String(row.industria ?? '');
        const periodo = formatAtividadePeriodo(
          row.data_inicio as string,
          row.data_fim as string,
        );
        const inicio = String(row.data_inicio ?? '').slice(0, 10);
        return {
          id: `atividade-${row.id}-${inicio}`,
          kind: 'atividade' as const,
          title: `Nova tarefa: ${tipo}`,
          detail: `${loja}${industria ? ` · ${industria}` : ''} · ${periodo}`,
          at: brtDayAt(inicio || today, 8, 30),
          href: '/atividades',
        };
      });
  } catch (error) {
    console.warn(
      '[notificações] Falha ao buscar tarefas do usuário:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function resolveBirthdayScope(
  scope?: NotificationViewerScope | null,
): Promise<NotificationViewerScope | null | undefined> {
  if (!scope?.usuario_id) return scope;
  if (scope.data_nascimento) return scope;

  const { data, error } = await supabase
    .from('usuarios')
    .select('data_nascimento, nome')
    .eq('id', scope.usuario_id)
    .maybeSingle();

  if (error || !data) return scope;

  return {
    ...scope,
    data_nascimento: data.data_nascimento
      ? String(data.data_nascimento).slice(0, 10)
      : null,
    usuario_nome: scope.usuario_nome || (data.nome as string | null) || null,
  };
}

async function shouldIncludeBirthday(usuarioId?: number | null): Promise<boolean> {
  if (!usuarioId) return true;
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('notify_aniversario')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  if (error || !data) return true;
  return data.notify_aniversario !== false;
}

async function shouldIncludeMeta(usuarioId?: number | null): Promise<boolean> {
  if (!usuarioId) return true;
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('notify_meta')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  if (error || !data) return true;
  return data.notify_meta !== false;
}

function mesLabelPt(mesNome: string) {
  const lower = mesNome.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

async function fetchMetaNotifications(): Promise<AppNotification[]> {
  try {
    const alerts = await fetchMetaBatidaAlerts();
    return alerts.map((alert) => {
      const pct = alert.meta > 0 ? ((alert.realizado / alert.meta) * 100).toFixed(0) : '0';
      const periodoLabel =
        alert.periodo === 'mensal'
          ? `Meta mensal · ${mesLabelPt(alert.mesNome ?? '')}/${alert.ano}`
          : `Meta anual · ${alert.ano}`;
      return {
        id: alert.id,
        kind: 'meta' as const,
        title: alert.periodo === 'mensal' ? 'Meta mensal batida!' : 'Meta anual batida!',
        detail: `${alert.regiao} — ${periodoLabel}: ${formatBRL(alert.realizado)} de ${formatBRL(alert.meta)} (${pct}%)`,
        at: alert.at,
        href: '/fe-representacoes/vendas',
      };
    });
  } catch (error) {
    console.warn(
      '[notificações] Falha ao calcular metas batidas:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function fetchAppNotifications(
  limit = 20,
  scope?: NotificationViewerScope | null,
): Promise<AppNotification[]> {
  const resolvedScope = await resolveBirthdayScope(scope);
  const includeBirthday = await shouldIncludeBirthday(resolvedScope?.usuario_id);
  const externo = isExternalViewer(resolvedScope);
  const campoMerch = isCampoMerchNotifCargo(resolvedScope?.cargo);
  const lideranca =
    !externo && isLiderancaNotifCargo(resolvedScope?.cargo);
  const includeMeta =
    lideranca && (await shouldIncludeMeta(resolvedScope?.usuario_id));

  const finish = async (items: AppNotification[]) => {
    const metaItems = includeMeta ? await fetchMetaNotifications() : [];
    return withBirthday(
      filterRecentNotifications([...metaItems, ...items]),
      limit,
      resolvedScope,
      includeBirthday,
    );
  };

  const sinceIso = notifWindowStartIso();

  // Externos só acompanham Sucesso do cliente do próprio escopo (sem vendas gerais / financeiro).
  if (externo) {
    const [pedidoItems, encartes] = await Promise.all([
      fetchExternalPedidoNotifications(limit, resolvedScope),
      safeEncartesRecentes(resolvedScope),
    ]);
    return withBirthday(
      filterRecentNotifications([...mapEncarteNotifications(encartes), ...pedidoItems]),
      limit,
      resolvedScope,
      includeBirthday,
    );
  }

  // Promotor / Demonstradora: tarefas atribuídas + avisos + encartes do dia + aniversário.
  if (campoMerch) {
    const [avisosRes, encartes, atividadeItems] = await Promise.all([
      supabase
        .from('avisos')
        .select('id, tipo, titulo, corpo, created_at')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(limit),
      safeEncartesRecentes(resolvedScope),
      fetchAtividadeNotificationsForUser(resolvedScope?.usuario_id, limit),
    ]);

    if (avisosRes.error) throw new Error(avisosRes.error.message);

    const items: AppNotification[] = [
      ...atividadeItems,
      ...mapEncarteNotifications(encartes),
    ];
    for (const row of avisosRes.data ?? []) {
      const titulo = String(row.titulo ?? 'Aviso');
      const corpo = String(row.corpo ?? '').trim();
      items.push({
        id: `aviso-${row.id}`,
        kind: 'aviso',
        title: titulo,
        detail: corpo,
        at: toIso(row.created_at as string),
        href: '/',
      });
    }

    return withBirthday(
      filterRecentNotifications(items),
      limit,
      resolvedScope,
      includeBirthday,
    );
  }

  const [vendasRes, pedidosRes, fatRes, avisosRes, encartes] = await Promise.all([
    supabase
      .from('baseVendas')
      .select('id, numero_pedido, cliente, industria, valor, vendedor, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('pedido_kanban')
      .select('id, status, updated_at, venda_id')
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(12),
    supabase
      .from('contrato_faturamento')
      .select('id, coluna, valor, updated_at, contratos(titulo, industria)')
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(12),
    supabase
      .from('avisos')
      .select('id, tipo, titulo, corpo, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(12),
    safeEncartesRecentes(resolvedScope),
  ]);

  if (vendasRes.error) throw new Error(vendasRes.error.message);
  if (pedidosRes.error) throw new Error(pedidosRes.error.message);
  if (fatRes.error) throw new Error(fatRes.error.message);
  if (avisosRes.error) throw new Error(avisosRes.error.message);

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

  for (const row of avisosRes.data ?? []) {
    const titulo = String(row.titulo ?? 'Aviso');
    const corpo = String(row.corpo ?? '').trim();
    items.push({
      id: `aviso-${row.id}`,
      kind: 'aviso',
      title: titulo,
      detail: corpo,
      at: toIso(row.created_at as string),
      href: '/',
    });
  }

  items.unshift(...mapEncarteNotifications(encartes));

  return finish(items);
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
    .gte('updated_at', notifWindowStartIso())
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

export function countUnread(items: AppNotification[], seenAt: string | null, now = new Date()) {
  const nowMs = now.getTime();
  if (!seenAt) {
    return items.filter((item) => {
      const t = new Date(item.at).getTime();
      return Number.isFinite(t) && t <= nowMs;
    }).length;
  }
  const seen = new Date(seenAt).getTime();
  return items.filter((item) => {
    const t = new Date(item.at).getTime();
    if (!Number.isFinite(t) || t > nowMs) return false;
    return t > seen;
  }).length;
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
