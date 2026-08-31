import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type NotificationKind = 'venda' | 'kanban_pedido' | 'kanban_financeiro' | 'aviso';

type PushPayload = {
  title: string;
  body: string;
  href: string;
};

type WebhookBody = {
  kind: NotificationKind;
  record: Record<string, unknown>;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  usuario_id: number;
  usuarios: {
    tipo_usuario: string;
    cargo: string | null;
    cliente_grupo: string | null;
    login_cnpj: string | null;
    industrias: { Nome: string } | { Nome: string }[] | null;
  };
};

type NotificationPrefsRow = {
  usuario_id: number;
  notify_venda: boolean;
  notify_kanban_pedido: boolean;
  notify_kanban_financeiro: boolean;
  notify_aviso?: boolean;
};

const FIN_COLUNA_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aguardando: 'Aguardando',
  faturado: 'Faturado',
};

const CLIENTE_GRUPO_LOJA_ALIASES: Record<string, string[]> = {
  MATEUS: [
    'MATEUS',
    'MIX',
    'POSTERUS',
    'CARONE',
    'CAMINO',
    'SUPER CASTANHAL',
    'SUPER MATEUS',
  ],
  SENDAS: ['SENDAS', 'ASSAI'],
  ASSAI: ['SENDAS', 'ASSAI'],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeIndustriaKey(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[''`]/g, '')
    .replace(/\b(ALIMENTOS|ALIMENTO|LTDA|LTDA\.|S\/A|SA|BRASIL|OFICIAL)\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIndustriaPadrao(nome: string): string {
  return normalizeIndustriaKey(nome);
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function isExternalTipo(tipo: string | null | undefined): boolean {
  return tipo === 'industria' || tipo === 'cliente';
}

function normalizeCargoKey(cargo: string): string {
  return cargo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Promotor / Demonstradora: só avisos (salário, feriado, folha). */
function isCampoMerchNotifCargo(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const key = normalizeCargoKey(cargo);
  return key === 'promotor' || key === 'demonstradora';
}

function normalizeCnpjDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

function normalizeGrupoKey(grupo: string): string {
  return grupo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim();
}

function lojaTokensForClienteGrupo(grupo: string): string[] {
  const needle = normalizeGrupoKey(grupo);
  if (!needle) return [];
  return CLIENTE_GRUPO_LOJA_ALIASES[needle] ?? [needle];
}

function matchLojaByClienteGrupo(lojaNome: string | null | undefined, grupo: string): boolean {
  if (!grupo) return false;
  const hay = (lojaNome ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
  return lojaTokensForClienteGrupo(grupo).some((token) => hay.includes(token));
}

function matchIndustriaScope(
  industriaValue: string | null | undefined,
  industriaNome: string,
): boolean {
  if (!industriaNome) return false;
  return toIndustriaPadrao(industriaValue ?? '') === toIndustriaPadrao(industriaNome);
}

function matchVendaByClienteGrupo(
  venda: { cnpj?: string | null; cliente?: string | null },
  grupo: string,
  loginCnpj?: string | null,
): boolean {
  if (matchLojaByClienteGrupo(venda.cliente, grupo)) return true;

  const cnpj = normalizeCnpjDigits(venda.cnpj ?? '');
  const login = normalizeCnpjDigits(loginCnpj ?? '');
  if (login.length >= 8 && cnpj.length >= 8 && cnpj.slice(0, 8) === login.slice(0, 8)) {
    return true;
  }
  return false;
}

function industriaNomeFromUsuario(
  industrias: SubscriptionRow['usuarios']['industrias'],
): string | null {
  if (!industrias) return null;
  const row = Array.isArray(industrias) ? industrias[0] : industrias;
  return row?.Nome ? toIndustriaPadrao(row.Nome) : null;
}

async function resolveWebhookSecret(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const envSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (envSecret) return envSecret;

  const { data, error } = await supabase
    .from('push_webhook_config')
    .select('secret')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('push_webhook_config lookup failed:', error.message);
    return null;
  }

  return data?.secret ?? null;
}

async function buildNotificationPayload(
  supabase: ReturnType<typeof createClient>,
  kind: NotificationKind,
  record: Record<string, unknown>,
): Promise<PushPayload | null> {
  if (kind === 'venda') {
    const pedido = String(record.numero_pedido ?? '—');
    const cliente = String(record.cliente ?? 'Cliente');
    const industria = String(record.industria ?? '');
    const valor = formatBRL(Number(record.valor) || 0);
    return {
      title: 'Lançamento de venda',
      body: `Pedido ${pedido} · ${cliente}${industria ? ` · ${industria}` : ''} · ${valor}`,
      href: '/base-vendas',
    };
  }

  if (kind === 'kanban_pedido') {
    const vendaId = String(record.venda_id ?? '');
    if (!vendaId) return null;

    const { data: venda, error } = await supabase
      .from('baseVendas')
      .select('numero_pedido, cliente, industria, cnpj')
      .eq('id', vendaId)
      .maybeSingle();

    if (error) {
      console.error('baseVendas lookup failed:', error.message);
      return null;
    }

    const pedido = String(venda?.numero_pedido ?? '—');
    const cliente = String(venda?.cliente ?? 'Cliente');
    const status = String(record.status ?? 'Atualizado');
    return {
      title: 'Kanban Sucesso do Cliente',
      body: `Pedido ${pedido} · ${cliente} → ${status}`,
      href: '/fe-representacoes/sucesso-cliente',
    };
  }

  if (kind === 'kanban_financeiro') {
    const contratoId = String(record.contrato_id ?? '');
    if (!contratoId) return null;

    const { data: contrato, error } = await supabase
      .from('contratos')
      .select('titulo, industria')
      .eq('id', contratoId)
      .maybeSingle();

    if (error) {
      console.error('contratos lookup failed:', error.message);
      return null;
    }

    const titulo = String(contrato?.titulo ?? 'Contrato');
    const industria = String(contrato?.industria ?? '');
    const coluna = FIN_COLUNA_LABEL[String(record.coluna)] ?? String(record.coluna ?? '');
    const valor = formatBRL(Number(record.valor) || 0);
    return {
      title: 'Kanban Financeiro',
      body: `${titulo}${industria ? ` · ${industria}` : ''} → ${coluna} · ${valor}`,
      href: '/financeiro?tab=kanban',
    };
  }

  if (kind === 'aviso') {
    const titulo = String(record.titulo ?? 'Aviso').trim() || 'Aviso';
    const corpo = String(record.corpo ?? '').trim();
    if (!corpo) return null;
    return {
      title: titulo,
      body: corpo.length > 180 ? `${corpo.slice(0, 177)}…` : corpo,
      href: '/',
    };
  }

  return null;
}

async function fetchVendaForPedido(
  supabase: ReturnType<typeof createClient>,
  vendaId: string,
) {
  const { data, error } = await supabase
    .from('baseVendas')
    .select('numero_pedido, cliente, industria, cnpj')
    .eq('id', vendaId)
    .maybeSingle();

  if (error) {
    console.error('baseVendas scope lookup failed:', error.message);
    return null;
  }

  return data;
}

function shouldNotifyUser(
  kind: NotificationKind,
  usuario: SubscriptionRow['usuarios'],
  venda: { industria?: string | null; cliente?: string | null; cnpj?: string | null } | null,
): boolean {
  const tipo = usuario.tipo_usuario;

  // Avisos (salário / feriado / folha): somente internos
  if (kind === 'aviso') {
    return !isExternalTipo(tipo);
  }

  // Promotor / Demonstradora não recebem vendas nem kanbans
  if (isCampoMerchNotifCargo(usuario.cargo)) {
    return false;
  }

  if (!isExternalTipo(tipo)) {
    return true;
  }

  if (kind !== 'kanban_pedido' || !venda) {
    return false;
  }

  const industriaNome = industriaNomeFromUsuario(usuario.industrias);
  const clienteGrupo = (usuario.cliente_grupo ?? '').trim().toUpperCase();

  if (industriaNome && !matchIndustriaScope(venda.industria, industriaNome)) {
    return false;
  }

  if (
    clienteGrupo &&
    !matchVendaByClienteGrupo(
      { cnpj: venda.cnpj, cliente: venda.cliente },
      clienteGrupo,
      usuario.login_cnpj,
    )
  ) {
    return false;
  }

  if (!industriaNome && !clienteGrupo) {
    return false;
  }

  return true;
}

function shouldSendByPreferences(
  kind: NotificationKind,
  prefs: NotificationPrefsRow | undefined,
): boolean {
  if (!prefs) return true;
  if (kind === 'venda') return prefs.notify_venda !== false;
  if (kind === 'kanban_pedido') return prefs.notify_kanban_pedido !== false;
  if (kind === 'kanban_financeiro') return prefs.notify_kanban_financeiro !== false;
  if (kind === 'aviso') return prefs.notify_aviso !== false;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@femerchandising.com.br';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    return jsonResponse({ error: 'Missing required environment variables' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const expectedSecret = await resolveWebhookSecret(supabase);
  const providedSecret = req.headers.get('x-push-secret');

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: WebhookBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { kind, record } = body;
  if (!kind || !record || typeof record !== 'object') {
    return jsonResponse({ error: 'Invalid webhook payload' }, 400);
  }

  const payload = await buildNotificationPayload(supabase, kind, record);
  if (!payload) {
    return jsonResponse({ ok: true, sent: 0, skipped: 'no_payload' });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select(
      'id, endpoint, p256dh, auth, usuario_id, usuarios(tipo_usuario, cargo, cliente_grupo, login_cnpj, industrias(Nome))',
    );

  if (subsError) {
    console.error('push_subscriptions lookup failed:', subsError.message);
    return jsonResponse({ error: subsError.message }, 500);
  }

  const subscriptionRows = (subscriptions ?? []) as SubscriptionRow[];
  const usuarioIds = [...new Set(subscriptionRows.map((row) => row.usuario_id))];

  const prefsMap = new Map<number, NotificationPrefsRow>();
  if (usuarioIds.length > 0) {
    const { data: prefsRows, error: prefsError } = await supabase
      .from('notification_preferences')
      .select(
        'usuario_id, notify_venda, notify_kanban_pedido, notify_kanban_financeiro, notify_aviso',
      )
      .in('usuario_id', usuarioIds);

    if (prefsError) {
      console.error('notification_preferences lookup failed:', prefsError.message);
      return jsonResponse({ error: prefsError.message }, 500);
    }

    for (const row of (prefsRows ?? []) as NotificationPrefsRow[]) {
      prefsMap.set(row.usuario_id, row);
    }
  }

  let vendaForScope: Awaited<ReturnType<typeof fetchVendaForPedido>> = null;
  if (kind === 'kanban_pedido') {
    const vendaId = String(record.venda_id ?? '');
    if (vendaId) {
      vendaForScope = await fetchVendaForPedido(supabase, vendaId);
    }
  }

  const pushBody = JSON.stringify(payload);
  let sent = 0;
  const expiredIds: string[] = [];
  const errors: string[] = [];

  for (const row of subscriptionRows) {
    const usuario = row.usuarios;
    if (!usuario) continue;

    if (!shouldSendByPreferences(kind, prefsMap.get(row.usuario_id))) {
      continue;
    }

    if (!shouldNotifyUser(kind, usuario, vendaForScope)) {
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        pushBody,
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        expiredIds.push(row.id);
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${row.id}: ${message}`);
      console.error('web-push send failed:', message);
    }
  }

  if (expiredIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.error('expired subscription cleanup failed:', deleteError.message);
    }
  }

  return jsonResponse({
    ok: true,
    sent,
    removed: expiredIds.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});
