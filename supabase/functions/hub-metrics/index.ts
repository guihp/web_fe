import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

type HubSistemaId = 'fe' | 'finance' | 'imobi' | 'daily';
type RemotePrefix = 'FINANCE' | 'IMOBI' | 'DAILY';

type RequestBody = {
  usuario_id?: number;
};

type SistemaResult = {
  sistema: HubSistemaId;
  ok: boolean;
  error?: string;
  metrics?: Record<string, unknown>;
};

type RemoteClient = {
  client: SupabaseClient;
  keyEnv: string;
  role: string | null;
};

const CACHE_TTL_MS = 60_000;
let cache: { key: string; at: number; body: unknown } | null = null;

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=60',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-usuario-id',
      ...extraHeaders,
    },
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-usuario-id',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

/** Current week Mon–Sat (Brazil-ish calendar week for Daily). */
function currentWeekMonSat(d = new Date()) {
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset));
  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  return {
    start: monday.toISOString().slice(0, 10),
    end: saturday.toISOString().slice(0, 10),
  };
}

/** Decode Supabase API key role without verifying the JWT signature. */
function decodeApiKeyRole(key: string): string | null {
  const trimmed = key.trim().replace(/^["']|["']$/g, '');
  if (trimmed.startsWith('sb_publishable_')) return 'anon';
  if (trimmed.startsWith('sb_secret_')) return 'service_role';
  if (trimmed.startsWith('sbp_')) return 'management_pat';

  const parts = trimmed.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

function decodeJwtRef(key: string): string | null {
  const trimmed = key.trim().replace(/^["']|["']$/g, '');
  const parts = trimmed.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { ref?: unknown };
    return typeof json.ref === 'string' ? json.ref : null;
  } catch {
    return null;
  }
}

function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname; // xxx.supabase.co
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

function anonKeyError(prefix: RemotePrefix, keyEnv: string): Error {
  return new Error(
    `${prefix}: chave em ${keyEnv} é anon/publishable, não service_role. ` +
      `Use Project Settings → API → service_role (JWT eyJ…) ou sb_secret_…`,
  );
}

/**
 * Resolve remote Supabase client.
 * Prefers `{PREFIX}_SERVICE_ROLE_KEY`; accepts `{PREFIX}_ANON_KEY` only to detect
 * misconfiguration and fail with a clear message (anon will not work under RLS).
 */
function remoteProject(prefix: RemotePrefix): RemoteClient {
  const url = Deno.env.get(`${prefix}_SUPABASE_URL`)?.trim().replace(/^["']|["']$/g, '');
  const serviceKey = Deno.env.get(`${prefix}_SERVICE_ROLE_KEY`)?.trim().replace(/^["']|["']$/g, '');
  const anonKey = Deno.env.get(`${prefix}_ANON_KEY`)?.trim().replace(/^["']|["']$/g, '');

  if (!url) {
    throw new Error(`Secret ${prefix}_SUPABASE_URL não configurado na Edge Function (não use Coolify para isso)`);
  }

  if (!serviceKey && anonKey) {
    throw anonKeyError(prefix, `${prefix}_ANON_KEY`);
  }
  if (!serviceKey) {
    throw new Error(
      `Secret ${prefix}_SERVICE_ROLE_KEY não configurado na Edge Function do App Fé`,
    );
  }

  const role = decodeApiKeyRole(serviceKey);
  if (role === 'management_pat') {
    throw new Error(
      `${prefix}: ${prefix}_SERVICE_ROLE_KEY começa com sbp_ (token de conta/Management API). ` +
        `Isso NÃO é a service_role do projeto. Em ${url} → Settings → API → copie service_role (eyJ…) ou sb_secret_…`,
    );
  }
  if (role === 'anon' || role === 'authenticated') {
    throw anonKeyError(prefix, `${prefix}_SERVICE_ROLE_KEY`);
  }
  if (role && role !== 'service_role') {
    throw new Error(
      `${prefix}: chave em ${prefix}_SERVICE_ROLE_KEY tem role="${role}"; esperado service_role.`,
    );
  }
  if (!role && !serviceKey.startsWith('eyJ') && !serviceKey.startsWith('sb_secret_')) {
    throw new Error(
      `${prefix}: formato de chave inválido em ${prefix}_SERVICE_ROLE_KEY ` +
        `(prefixo ${serviceKey.slice(0, 4)}…). Use service_role JWT (eyJ…) ou sb_secret_… do mesmo projeto da URL.`,
    );
  }

  const urlRef = projectRefFromUrl(url);
  const keyRef = decodeJwtRef(serviceKey);
  if (urlRef && keyRef && urlRef !== keyRef) {
    throw new Error(
      `${prefix}: a service_role é do projeto "${keyRef}" mas a URL é "${urlRef}". ` +
        `Cada *_SERVICE_ROLE_KEY deve ser do mesmo projeto da *_SUPABASE_URL correspondente.`,
    );
  }

  return {
    client: createClient(url, serviceKey, { auth: { persistSession: false } }),
    keyEnv: `${prefix}_SERVICE_ROLE_KEY`,
    role,
  };
}

/** Fail when a probe count is 0 and the key is not clearly service_role (RLS-empty pattern). */
function assertRemoteVisible(
  prefix: RemotePrefix,
  label: string,
  count: number,
  role: string | null,
) {
  if (count > 0) return;
  if (role === 'service_role') return;
  throw new Error(
    `${prefix}: ${label}=0 com chave sem role service_role detectável (${role ?? 'desconhecida'}). ` +
      `Provável anon/RLS ou secret errado — use ${prefix}_SERVICE_ROLE_KEY.`,
  );
}

async function countRows(
  client: SupabaseClient,
  table: string,
  apply?: (q: ReturnType<SupabaseClient['from']>) => unknown,
): Promise<number> {
  let q = client.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q) as typeof q;
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function metricsFe(local: SupabaseClient): Promise<Record<string, unknown>> {
  const now = new Date();
  const mes = now.getUTCMonth() + 1;
  const ano = now.getUTCFullYear();

  const [usuariosAtivos, vendasMes, pedidosAbertos] = await Promise.all([
    countRows(local, 'usuarios', (q) =>
      (q as { eq: (c: string, v: unknown) => unknown }).eq('status', true),
    ),
    countRows(local, 'baseVendas', (q) => {
      const typed = q as {
        eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => unknown };
      };
      return typed.eq('mes', mes).eq('ano', ano);
    }),
    countRows(local, 'pedido_kanban', (q) => {
      const typed = q as { not: (c: string, op: string, v: string) => unknown };
      return typed.not('status', 'in', '("Faturado","Entregue finalizado")');
    }).catch(() => countRows(local, 'pedido_kanban')),
  ]);

  return {
    usuarios_ativos: usuariosAtivos,
    vendas_mes: vendasMes,
    pedidos_kanban_abertos: pedidosAbertos,
  };
}

async function metricsFinance(): Promise<Record<string, unknown>> {
  const { client, role } = remoteProject('FINANCE');

  const [profiles, assinaturasAtivas, assinaturasTrial, assinantesFaturando] = await Promise.all([
    countRows(client, 'profiles'),
    countRows(client, 'subscriptions', (q) =>
      (q as { eq: (c: string, v: string) => unknown }).eq('status', 'active'),
    ),
    countRows(client, 'subscriptions', (q) =>
      (q as { eq: (c: string, v: boolean) => unknown }).eq('is_trial', true),
    ),
    countRows(client, 'subscriptions', (q) => {
      const typed = q as {
        eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => unknown };
      };
      return typed.eq('status', 'active').eq('is_trial', false);
    }),
  ]);

  assertRemoteVisible('FINANCE', 'profiles', profiles, role);

  const [{ data: settings }, { data: payments, error: payError }] = await Promise.all([
    client.from('app_settings').select('product_full_price').limit(1).maybeSingle(),
    client.from('payment_history').select('amount').in('status', ['RECEIVED', 'CONFIRMED']),
  ]);

  if (payError) throw new Error(payError.message);

  const amounts = (payments ?? [])
    .map((row) => Number((row as { amount?: number }).amount ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);

  const precoPlano = Number(
    (settings as { product_full_price?: number } | null)?.product_full_price ?? 0,
  );

  const ticketMedio =
    amounts.length > 0
      ? amounts.reduce((acc, n) => acc + n, 0) / amounts.length
      : precoPlano;

  const mrrEstimado = assinantesFaturando * (precoPlano || ticketMedio);

  return {
    clientes: profiles,
    assinaturas_ativas: assinaturasAtivas,
    assinaturas_trial: assinaturasTrial,
    assinantes_faturando: assinantesFaturando,
    ticket_medio_assinante: Math.round(ticketMedio * 100) / 100,
    mrr_estimado: Math.round(mrrEstimado * 100) / 100,
    preco_plano: Math.round(precoPlano * 100) / 100,
  };
}

async function metricsImobi(): Promise<Record<string, unknown>> {
  const { client, role } = remoteProject('IMOBI');

  const { data: companies, error: companiesError } = await client
    .from('companies')
    .select('id, is_active, subscription_status, blocked_at');
  if (companiesError) throw new Error(companiesError.message);

  const rows = companies ?? [];
  const empresasTotal = rows.length;
  assertRemoteVisible('IMOBI', 'companies', empresasTotal, role);

  const empresasAtivas = rows.filter(
    (c) => c.is_active && !c.blocked_at && c.subscription_status === 'active',
  ).length;
  const empresasTrial = rows.filter((c) => c.subscription_status === 'trial').length;
  const empresasBloqueadas = rows.filter((c) => Boolean(c.blocked_at)).length;

  const [usuariosAtivos, leads, imoveis] = await Promise.all([
    countRows(client, 'user_profiles', (q) =>
      (q as { eq: (c: string, v: boolean) => unknown }).eq('is_active', true),
    ),
    countRows(client, 'leads'),
    countRows(client, 'imoveisvivareal'),
  ]);

  return {
    empresas_total: empresasTotal,
    empresas_ativas: empresasAtivas,
    empresas_trial: empresasTrial,
    empresas_bloqueadas: empresasBloqueadas,
    usuarios_ativos: usuariosAtivos,
    leads,
    imoveis,
  };
}

async function metricsDaily(): Promise<Record<string, unknown>> {
  const { client, role } = remoteProject('DAILY');

  const week = currentWeekMonSat();

  const [usuarios, clientes] = await Promise.all([
    countRows(client, 'profiles'),
    countRows(client, 'clients'),
  ]);

  assertRemoteVisible('DAILY', 'profiles', usuarios, role);

  const { data: sprints, error: sprintError } = await client
    .from('sprints')
    .select('id, client_id, start_date, end_date')
    .lte('start_date', week.end)
    .gte('end_date', week.start);

  if (sprintError) throw new Error(sprintError.message);

  const sprintIds = (sprints ?? []).map((s) => s.id as string);
  let tasks: { status: string; client_id: string | null }[] = [];

  if (sprintIds.length > 0) {
    const { data: taskRows, error: taskError } = await client
      .from('tasks')
      .select('status, client_id, sprint_id')
      .in('sprint_id', sprintIds);
    if (taskError) throw new Error(taskError.message);
    tasks = (taskRows ?? []).map((t) => ({
      status: String((t as { status: string }).status),
      client_id: (t as { client_id?: string | null }).client_id ?? null,
    }));
  }

  const porStatus = { todo: 0, doing: 0, done: 0 };
  const porCliente = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === 'todo' || t.status === 'doing' || t.status === 'done') {
      porStatus[t.status] += 1;
    }
    if (t.client_id) {
      porCliente.set(t.client_id, (porCliente.get(t.client_id) ?? 0) + 1);
    }
  }

  const clientIds = [...porCliente.keys()];
  let clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clientRows } = await client.from('clients').select('id, name').in('id', clientIds);
    clientNames = new Map(
      (clientRows ?? []).map((c) => [String((c as { id: string }).id), String((c as { name: string }).name)]),
    );
  }

  const demandas_por_cliente = [...porCliente.entries()]
    .map(([id, total]) => ({ cliente: clientNames.get(id) ?? id, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return {
    usuarios,
    clientes,
    semana: week,
    demandas_semana: {
      total: tasks.length,
      ...porStatus,
    },
    demandas_por_cliente,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Supabase env missing' }, 500);
    }

    const local = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let body: RequestBody = {};
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      body = {};
    }

    const headerUsuario = req.headers.get('x-usuario-id');
    const usuarioId = Number(body.usuario_id ?? headerUsuario ?? 0);
    if (!usuarioId || Number.isNaN(usuarioId)) {
      return jsonResponse({ error: 'usuario_id obrigatório' }, 401);
    }

    const { data: usuario, error: userError } = await local
      .from('usuarios')
      .select('id, status, is_super_admin, tipo_usuario')
      .eq('id', usuarioId)
      .maybeSingle();

    if (userError || !usuario) {
      return jsonResponse({ error: 'Usuário não encontrado' }, 401);
    }
    if (usuario.status === false) {
      return jsonResponse({ error: 'Usuário inativo' }, 403);
    }

    const isSuperAdmin = Boolean(usuario.is_super_admin);
    let sistemas: HubSistemaId[] = [];

    if (isSuperAdmin) {
      sistemas = ['fe', 'finance', 'imobi', 'daily'];
    } else {
      const { data: rows, error: permError } = await local
        .from('hub_usuario_sistemas')
        .select('sistema_id')
        .eq('usuario_id', usuarioId);
      if (permError) return jsonResponse({ error: permError.message }, 500);
      sistemas = (rows ?? [])
        .map((r) => String((r as { sistema_id: string }).sistema_id))
        .filter((id): id is HubSistemaId =>
          id === 'fe' || id === 'finance' || id === 'imobi' || id === 'daily',
        );
    }

    if (sistemas.length === 0) {
      return jsonResponse({ error: 'Sem acesso ao Hub Grupo Fé' }, 403);
    }

    const cacheKey = `${usuarioId}:${sistemas.slice().sort().join(',')}`;
    if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
      return jsonResponse(cache.body, 200, { 'X-Cache': 'HIT' });
    }

    const results: SistemaResult[] = await Promise.all(
      sistemas.map(async (sistema) => {
        try {
          let metrics: Record<string, unknown>;
          if (sistema === 'fe') metrics = await metricsFe(local);
          else if (sistema === 'finance') metrics = await metricsFinance();
          else if (sistema === 'imobi') metrics = await metricsImobi();
          else metrics = await metricsDaily();
          return { sistema, ok: true, metrics };
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message || err.name || 'Falha ao carregar métricas'
              : typeof err === 'string'
                ? err
                : 'Falha ao carregar métricas';
          return {
            sistema,
            ok: false,
            error: message,
          };
        }
      }),
    );

    const payload = {
      generated_at: new Date().toISOString(),
      is_super_admin: isSuperAdmin,
      sistemas: results,
    };

    cache = { key: cacheKey, at: Date.now(), body: payload };
    return jsonResponse(payload, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      500,
    );
  }
});
