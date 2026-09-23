import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

type HubSistemaId = 'fe' | 'finance' | 'imobi' | 'daily';
type RemotePrefix = 'FINANCE' | 'IMOBI' | 'DAILY';

type RequestBody = {
  usuario_id?: number;
  detail?: 'imobi' | 'finance' | 'daily';
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

type FinancePagamentoRecente = {
  amount: number;
  status: string | null;
  paid_at: string | null;
  payment_method: string | null;
};

type FinanceClienteRecente = {
  full_name: string | null;
  email: string | null;
  created_at: string | null;
};

async function metricsFinanceDetail(): Promise<{
  resumo: Record<string, unknown>;
  assinaturas_por_status: { status: string; is_trial: boolean; n: number }[];
  pagamentos: {
    recebidos_count: number;
    recebidos_soma: number;
    recentes: FinancePagamentoRecente[];
  };
  transacoes_mes: {
    total: number;
    receitas: number;
    despesas: number;
    por_tipo: { type: string; n: number; soma: number }[];
  };
  funil: {
    pending_registrations: number;
    partial_leads: number;
    desistentes: number;
  };
  clientes_recentes: FinanceClienteRecente[];
}> {
  const { client, role } = remoteProject('FINANCE');

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  const [
    profiles,
    assinaturasAtivas,
    assinaturasTrial,
    assinantesFaturando,
    assinaturasOverdue,
    assinaturasCancelled,
    pendingRegistrations,
    partialLeads,
    desistentes,
    subStatusRows,
    { data: settings },
    { data: payments, error: payError },
    { data: paymentRecentes, error: payRecentesError },
    txMonthRows,
    { data: clientesRecentes, error: clientesError },
  ] = await Promise.all([
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
    countRows(client, 'subscriptions', (q) =>
      (q as { eq: (c: string, v: string) => unknown }).eq('status', 'overdue'),
    ),
    countRows(client, 'subscriptions', (q) =>
      (q as { eq: (c: string, v: string) => unknown }).eq('status', 'cancelled'),
    ),
    countRows(client, 'pending_registrations'),
    countRows(client, 'partial_leads'),
    countRows(client, 'desistentes'),
    selectAllPaged<{ status: string | null; is_trial: boolean | null }>(
      client,
      'subscriptions',
      'status, is_trial',
    ),
    client.from('app_settings').select('product_full_price').limit(1).maybeSingle(),
    client.from('payment_history').select('amount').in('status', ['RECEIVED', 'CONFIRMED']),
    client
      .from('payment_history')
      .select('amount, status, paid_at, payment_method')
      .order('paid_at', { ascending: false })
      .limit(20),
    selectAllPaged<{ type: string | null; amount: number | null }>(
      client,
      'transactions',
      'type, amount',
      1000,
      (q) => {
        const typed = q as {
          gte: (c: string, v: string) => { lt: (c: string, v: string) => unknown };
        };
        return typed.gte('transaction_date', monthStartStr).lt('transaction_date', monthEndStr);
      },
    ),
    client
      .from('profiles')
      .select('full_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  if (payError) throw new Error(payError.message);
  if (payRecentesError) throw new Error(payRecentesError.message);
  if (clientesError) throw new Error(clientesError.message);

  assertRemoteVisible('FINANCE', 'profiles', profiles, role);

  const amounts = (payments ?? [])
    .map((row) => Number((row as { amount?: number }).amount ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);

  const recebidosSoma = amounts.reduce((acc, n) => acc + n, 0);
  const precoPlano = Number(
    (settings as { product_full_price?: number } | null)?.product_full_price ?? 0,
  );
  const ticketMedio =
    amounts.length > 0
      ? amounts.reduce((acc, n) => acc + n, 0) / amounts.length
      : precoPlano;
  const mrrEstimado = assinantesFaturando * (precoPlano || ticketMedio);

  const statusMap = new Map<string, number>();
  for (const row of subStatusRows) {
    const status = String(row.status ?? 'unknown');
    const isTrial = Boolean(row.is_trial);
    const key = `${status}\0${isTrial ? '1' : '0'}`;
    statusMap.set(key, (statusMap.get(key) ?? 0) + 1);
  }

  const tipoMap = new Map<string, { n: number; soma: number }>();
  let receitas = 0;
  let despesas = 0;
  for (const row of txMonthRows) {
    const type = String(row.type ?? 'unknown');
    const amount = Number(row.amount ?? 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const prev = tipoMap.get(type) ?? { n: 0, soma: 0 };
    tipoMap.set(type, { n: prev.n + 1, soma: prev.soma + safeAmount });
    if (type === 'income') receitas += safeAmount;
    else if (type === 'expense') despesas += safeAmount;
  }

  return {
    resumo: {
      clientes: profiles,
      assinaturas_ativas: assinaturasAtivas,
      assinaturas_trial: assinaturasTrial,
      assinantes_faturando: assinantesFaturando,
      assinaturas_overdue: assinaturasOverdue,
      assinaturas_cancelled: assinaturasCancelled,
      ticket_medio_assinante: Math.round(ticketMedio * 100) / 100,
      mrr_estimado: Math.round(mrrEstimado * 100) / 100,
      preco_plano: Math.round(precoPlano * 100) / 100,
    },
    assinaturas_por_status: [...statusMap.entries()]
      .map(([key, n]) => {
        const [status, trialFlag] = key.split('\0');
        return { status, is_trial: trialFlag === '1', n };
      })
      .sort((a, b) => b.n - a.n || a.status.localeCompare(b.status)),
    pagamentos: {
      recebidos_count: amounts.length,
      recebidos_soma: Math.round(recebidosSoma * 100) / 100,
      recentes: (paymentRecentes ?? []).map((p) => ({
        amount: Number((p as { amount?: number }).amount ?? 0),
        status: (p as { status?: string | null }).status ?? null,
        paid_at: (p as { paid_at?: string | null }).paid_at ?? null,
        payment_method: (p as { payment_method?: string | null }).payment_method ?? null,
      })),
    },
    transacoes_mes: {
      total: txMonthRows.length,
      receitas: Math.round(receitas * 100) / 100,
      despesas: Math.round(despesas * 100) / 100,
      por_tipo: [...tipoMap.entries()]
        .map(([type, v]) => ({
          type,
          n: v.n,
          soma: Math.round(v.soma * 100) / 100,
        }))
        .sort((a, b) => b.n - a.n),
    },
    funil: {
      pending_registrations: pendingRegistrations,
      partial_leads: partialLeads,
      desistentes,
    },
    clientes_recentes: (clientesRecentes ?? []).map((c) => ({
      full_name: (c as { full_name?: string | null }).full_name ?? null,
      email: (c as { email?: string | null }).email ?? null,
      created_at: (c as { created_at?: string | null }).created_at ?? null,
    })),
  };
}

function isEmpresaAtiva(c: {
  is_active?: boolean | null;
  blocked_at?: string | null;
  subscription_status?: string | null;
}) {
  return Boolean(c.is_active) && !c.blocked_at && c.subscription_status === 'active';
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

  const empresasAtivas = rows.filter(isEmpresaAtiva).length;
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

type ImobiVisitRecente = {
  id: string;
  company_id: string | null;
  start_at: string | null;
  status: string | null;
  lead_id: string | null;
};

type ImobiEmpresaAtiva = {
  id: string;
  name: string;
  leads: number;
  visitas: number;
  msgs: number;
  subscription_status: string | null;
};

/** Page through a narrow select to avoid the PostgREST 1000-row default cap. */
async function selectAllPaged<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  columns: string,
  pageSize = 1000,
  apply?: (q: ReturnType<SupabaseClient['from']>) => unknown,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    let q = client.from(table).select(columns);
    if (apply) q = apply(q) as typeof q;
    const { data, error } = await (q as { range: (a: number, b: number) => Promise<{ data: T[] | null; error: { message: string } | null }> })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function metricsImobiDetail(): Promise<{
  resumo: Record<string, unknown>;
  visitas: {
    total: number;
    futuras: number;
    por_status: { status: string; n: number }[];
    recentes: ImobiVisitRecente[];
  };
  atendimentos: {
    mensagens_7d: number;
    mensagens_30d: number;
    conversas_distintas: number;
    mensagens_total: number;
  };
  leads_por_stage: { stage: string; n: number }[];
  empresas_ativas: ImobiEmpresaAtiva[];
}> {
  const { client, role } = remoteProject('IMOBI');
  const nowIso = new Date().toISOString();
  const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: companies, error: companiesError } = await client
    .from('companies')
    .select('id, name, is_active, subscription_status, blocked_at');
  if (companiesError) throw new Error(companiesError.message);

  const companyRows = companies ?? [];
  assertRemoteVisible('IMOBI', 'companies', companyRows.length, role);

  const activeCompanies = companyRows.filter(isEmpresaAtiva);
  const empresasTrial = companyRows.filter((c) => c.subscription_status === 'trial').length;
  const empresasBloqueadas = companyRows.filter((c) => Boolean(c.blocked_at)).length;

  const [
    usuariosAtivos,
    leadsTotal,
    imoveis,
    visitasTotal,
    visitasFuturas,
    mensagensTotal,
    mensagens7d,
    mensagens30d,
    { data: visitRecentes, error: visitRecentesError },
    visitStatusRows,
    leadStageRows,
    contactRows,
  ] = await Promise.all([
    countRows(client, 'user_profiles', (q) =>
      (q as { eq: (c: string, v: boolean) => unknown }).eq('is_active', true),
    ),
    countRows(client, 'leads'),
    countRows(client, 'imoveisvivareal'),
    countRows(client, 'visit_bookings'),
    countRows(client, 'visit_bookings', (q) =>
      (q as { gte: (c: string, v: string) => unknown }).gte('start_at', nowIso),
    ),
    countRows(client, 'mensagens'),
    countRows(client, 'mensagens', (q) =>
      (q as { gte: (c: string, v: string) => unknown }).gte('created_at', d7),
    ),
    countRows(client, 'mensagens', (q) =>
      (q as { gte: (c: string, v: string) => unknown }).gte('created_at', d30),
    ),
    client
      .from('visit_bookings')
      .select('id, company_id, start_at, status, lead_id')
      .order('start_at', { ascending: false })
      .limit(20),
    selectAllPaged<{ status: string | null }>(client, 'visit_bookings', 'status'),
    selectAllPaged<{ stage: string | null }>(client, 'leads', 'stage'),
    selectAllPaged<{ contact_norm: string | null }>(client, 'mensagens', 'contact_norm'),
  ]);

  if (visitRecentesError) throw new Error(visitRecentesError.message);

  const statusMap = new Map<string, number>();
  for (const v of visitStatusRows) {
    const status = String(v.status ?? 'unknown');
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  }

  const stageMap = new Map<string, number>();
  for (const row of leadStageRows) {
    const stage = String(row.stage ?? 'sem_stage');
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
  }

  const uniqueContacts = new Set<string>();
  for (const row of contactRows) {
    if (row.contact_norm) uniqueContacts.add(row.contact_norm);
  }

  const empresas_ativas: ImobiEmpresaAtiva[] = await Promise.all(
    activeCompanies.map(async (c) => {
      const id = String(c.id);
      const [leads, visitas, msgs] = await Promise.all([
        countRows(client, 'leads', (q) =>
          (q as { eq: (col: string, v: string) => unknown }).eq('company_id', id),
        ),
        countRows(client, 'visit_bookings', (q) =>
          (q as { eq: (col: string, v: string) => unknown }).eq('company_id', id),
        ),
        countRows(client, 'mensagens', (q) =>
          (q as { eq: (col: string, v: string) => unknown }).eq('company_id', id),
        ),
      ]);
      return {
        id,
        name: String((c as { name?: string | null }).name ?? 'Sem nome'),
        leads,
        visitas,
        msgs,
        subscription_status:
          (c as { subscription_status?: string | null }).subscription_status ?? null,
      };
    }),
  );
  empresas_ativas.sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));

  return {
    resumo: {
      empresas_total: companyRows.length,
      empresas_ativas: activeCompanies.length,
      empresas_trial: empresasTrial,
      empresas_bloqueadas: empresasBloqueadas,
      usuarios_ativos: usuariosAtivos,
      leads: leadsTotal,
      imoveis,
    },
    visitas: {
      total: visitasTotal,
      futuras: visitasFuturas,
      por_status: [...statusMap.entries()]
        .map(([status, n]) => ({ status, n }))
        .sort((a, b) => b.n - a.n),
      recentes: (visitRecentes ?? []).map((v) => ({
        id: String((v as { id: string }).id),
        company_id: (v as { company_id?: string | null }).company_id ?? null,
        start_at: (v as { start_at?: string | null }).start_at ?? null,
        status: (v as { status?: string | null }).status ?? null,
        lead_id: (v as { lead_id?: string | null }).lead_id ?? null,
      })),
    },
    atendimentos: {
      mensagens_7d: mensagens7d,
      mensagens_30d: mensagens30d,
      conversas_distintas: uniqueContacts.size,
      mensagens_total: mensagensTotal,
    },
    leads_por_stage: [...stageMap.entries()]
      .map(([stage, n]) => ({ stage, n }))
      .sort((a, b) => b.n - a.n),
    empresas_ativas,
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

type DailyTarefaRecente = {
  title: string;
  status: string;
  due_date: string | null;
  client_name: string | null;
  assignee_name: string | null;
  updated_at: string | null;
};

type DailyProjeto = {
  name: string;
  status: string | null;
  week_priority: number | null;
  tarefas_abertas: number;
};

type DailyArteRecente = {
  title: string | null;
  status: string;
  created_at: string | null;
};

type DailyAtividade = {
  action: string;
  created_at: string | null;
  client_name: string | null;
};

async function metricsDailyDetail(): Promise<{
  resumo: Record<string, unknown>;
  demandas_por_status: { status: string; n: number }[];
  demandas_por_cliente: { cliente: string; total: number }[];
  tarefas_recentes: DailyTarefaRecente[];
  projetos: DailyProjeto[];
  artes: { pendentes: number; recentes: DailyArteRecente[] };
  atividade_recente: DailyAtividade[];
}> {
  const { client, role } = remoteProject('DAILY');
  const week = currentWeekMonSat();
  const todayStr = new Date().toISOString().slice(0, 10);

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
  let weekTasks: {
    status: string;
    client_id: string | null;
  }[] = [];

  if (sprintIds.length > 0) {
    const { data: taskRows, error: taskError } = await client
      .from('tasks')
      .select('status, client_id, sprint_id')
      .in('sprint_id', sprintIds);
    if (taskError) throw new Error(taskError.message);
    weekTasks = (taskRows ?? []).map((t) => ({
      status: String((t as { status: string }).status),
      client_id: (t as { client_id?: string | null }).client_id ?? null,
    }));
  }

  const porStatus = { todo: 0, doing: 0, done: 0 };
  const porCliente = new Map<string, number>();
  for (const t of weekTasks) {
    if (t.status === 'todo' || t.status === 'doing' || t.status === 'done') {
      porStatus[t.status] += 1;
    }
    if (t.client_id) {
      porCliente.set(t.client_id, (porCliente.get(t.client_id) ?? 0) + 1);
    }
  }

  const [
    tarefasAtrasadas,
    artesPendentes,
    tarefasDaily,
    { data: clientesRows, error: clientesError },
    { data: tarefasRecentes, error: tarefasRecentesError },
    { data: artesRecentes, error: artesRecentesError },
    { data: atividadeRows, error: atividadeError },
    openTaskRows,
  ] = await Promise.all([
    countRows(client, 'tasks', (q) => {
      const typed = q as {
        lt: (c: string, v: string) => {
          in: (c: string, v: string[]) => unknown;
        };
      };
      return typed.lt('due_date', todayStr).in('status', ['todo', 'doing']);
    }),
    countRows(client, 'task_arts', (q) =>
      (q as { eq: (c: string, v: string) => unknown }).eq('status', 'pendente'),
    ),
    countRows(client, 'tasks', (q) =>
      (q as { eq: (c: string, v: boolean) => unknown }).eq('is_daily', true),
    ),
    client.from('clients').select('id, name, status, week_priority'),
    client
      .from('tasks')
      .select('title, status, due_date, client_id, assignee_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    client
      .from('task_arts')
      .select('title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    client
      .from('activity_logs')
      .select('action, created_at, client_id')
      .order('created_at', { ascending: false })
      .limit(15),
    selectAllPaged<{ client_id: string | null; status: string | null }>(
      client,
      'tasks',
      'client_id, status',
      1000,
      (q) => {
        const typed = q as { in: (c: string, v: string[]) => unknown };
        return typed.in('status', ['todo', 'doing']);
      },
    ),
  ]);

  if (clientesError) throw new Error(clientesError.message);
  if (tarefasRecentesError) throw new Error(tarefasRecentesError.message);
  if (artesRecentesError) throw new Error(artesRecentesError.message);
  if (atividadeError) throw new Error(atividadeError.message);

  const clientNameById = new Map<string, string>();
  for (const c of clientesRows ?? []) {
    const id = String((c as { id: string }).id);
    clientNameById.set(id, String((c as { name?: string | null }).name ?? 'Sem nome'));
  }

  // Ensure week-task client names are available even if not in the limited clients list
  const missingClientIds = [...porCliente.keys()].filter((id) => !clientNameById.has(id));
  if (missingClientIds.length > 0) {
    const { data: extraClients } = await client
      .from('clients')
      .select('id, name')
      .in('id', missingClientIds);
    for (const c of extraClients ?? []) {
      clientNameById.set(
        String((c as { id: string }).id),
        String((c as { name?: string | null }).name ?? 'Sem nome'),
      );
    }
  }

  const openByClient = new Map<string, number>();
  for (const t of openTaskRows) {
    if (!t.client_id) continue;
    openByClient.set(t.client_id, (openByClient.get(t.client_id) ?? 0) + 1);
  }

  const assigneeIds = [
    ...new Set(
      (tarefasRecentes ?? [])
        .map((t) => (t as { assignee_id?: string | null }).assignee_id ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const assigneeNameById = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: profileRows, error: profileError } = await client
      .from('profiles')
      .select('id, full_name')
      .in('id', assigneeIds);
    if (profileError) throw new Error(profileError.message);
    for (const p of profileRows ?? []) {
      const id = String((p as { id: string }).id);
      const fullName = (p as { full_name?: string | null }).full_name?.trim();
      if (fullName) assigneeNameById.set(id, fullName);
    }
  }

  const demandas_por_cliente = [...porCliente.entries()]
    .map(([id, total]) => ({ cliente: clientNameById.get(id) ?? id, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const demandas_por_status = (['todo', 'doing', 'done'] as const).map((status) => ({
    status,
    n: porStatus[status],
  }));

  const projetos: DailyProjeto[] = (clientesRows ?? [])
    .map((c) => {
      const id = String((c as { id: string }).id);
      return {
        name: String((c as { name?: string | null }).name ?? 'Sem nome'),
        status: (c as { status?: string | null }).status ?? null,
        week_priority: (c as { week_priority?: number | null }).week_priority ?? null,
        tarefas_abertas: openByClient.get(id) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (a.week_priority ?? 999) - (b.week_priority ?? 999) ||
        a.name.localeCompare(b.name),
    );

  return {
    resumo: {
      usuarios,
      clientes,
      semana: week,
      demandas_semana: {
        total: weekTasks.length,
        ...porStatus,
      },
      tarefas_atrasadas: tarefasAtrasadas,
      artes_pendentes: artesPendentes,
      tarefas_daily: tarefasDaily,
    },
    demandas_por_status,
    demandas_por_cliente,
    tarefas_recentes: (tarefasRecentes ?? []).map((t) => {
      const clientId = (t as { client_id?: string | null }).client_id ?? null;
      const assigneeId = (t as { assignee_id?: string | null }).assignee_id ?? null;
      return {
        title: String((t as { title?: string }).title ?? 'Sem título'),
        status: String((t as { status?: string }).status ?? 'todo'),
        due_date: (t as { due_date?: string | null }).due_date ?? null,
        client_name: clientId ? (clientNameById.get(clientId) ?? null) : null,
        assignee_name: assigneeId ? (assigneeNameById.get(assigneeId) ?? null) : null,
        updated_at: (t as { updated_at?: string | null }).updated_at ?? null,
      };
    }),
    projetos,
    artes: {
      pendentes: artesPendentes,
      recentes: (artesRecentes ?? []).map((a) => ({
        title: (a as { title?: string | null }).title ?? null,
        status: String((a as { status?: string }).status ?? 'pendente'),
        created_at: (a as { created_at?: string | null }).created_at ?? null,
      })),
    },
    atividade_recente: (atividadeRows ?? []).map((a) => {
      const clientId = (a as { client_id?: string | null }).client_id ?? null;
      return {
        action: String((a as { action?: string }).action ?? ''),
        created_at: (a as { created_at?: string | null }).created_at ?? null,
        client_name: clientId ? (clientNameById.get(clientId) ?? null) : null,
      };
    }),
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

    const detail =
      body.detail === 'imobi'
        ? 'imobi'
        : body.detail === 'finance'
          ? 'finance'
          : body.detail === 'daily'
            ? 'daily'
            : undefined;

    if (detail === 'imobi') {
      if (!sistemas.includes('imobi')) {
        return jsonResponse({ error: 'Sem acesso ao sistema Imobi' }, 403);
      }

      const detailCacheKey = `${usuarioId}:detail:imobi`;
      if (cache && cache.key === detailCacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
        return jsonResponse(cache.body, 200, { 'X-Cache': 'HIT' });
      }

      try {
        const detailPayload = await metricsImobiDetail();
        const payload = {
          generated_at: new Date().toISOString(),
          is_super_admin: isSuperAdmin,
          detail: 'imobi' as const,
          ...detailPayload,
        };
        cache = { key: detailCacheKey, at: Date.now(), body: payload };
        return jsonResponse(payload, 200, { 'X-Cache': 'MISS' });
      } catch (err) {
        return jsonResponse(
          {
            error:
              err instanceof Error
                ? err.message || err.name || 'Falha ao carregar detalhe Imobi'
                : 'Falha ao carregar detalhe Imobi',
          },
          500,
        );
      }
    }

    if (detail === 'finance') {
      if (!sistemas.includes('finance')) {
        return jsonResponse({ error: 'Sem acesso ao sistema Finance' }, 403);
      }

      const detailCacheKey = `${usuarioId}:detail:finance`;
      if (cache && cache.key === detailCacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
        return jsonResponse(cache.body, 200, { 'X-Cache': 'HIT' });
      }

      try {
        const detailPayload = await metricsFinanceDetail();
        const payload = {
          generated_at: new Date().toISOString(),
          is_super_admin: isSuperAdmin,
          detail: 'finance' as const,
          ...detailPayload,
        };
        cache = { key: detailCacheKey, at: Date.now(), body: payload };
        return jsonResponse(payload, 200, { 'X-Cache': 'MISS' });
      } catch (err) {
        return jsonResponse(
          {
            error:
              err instanceof Error
                ? err.message || err.name || 'Falha ao carregar detalhe Finance'
                : 'Falha ao carregar detalhe Finance',
          },
          500,
        );
      }
    }

    if (detail === 'daily') {
      if (!sistemas.includes('daily')) {
        return jsonResponse({ error: 'Sem acesso ao sistema Daily' }, 403);
      }

      const detailCacheKey = `${usuarioId}:detail:daily`;
      if (cache && cache.key === detailCacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
        return jsonResponse(cache.body, 200, { 'X-Cache': 'HIT' });
      }

      try {
        const detailPayload = await metricsDailyDetail();
        const payload = {
          generated_at: new Date().toISOString(),
          is_super_admin: isSuperAdmin,
          detail: 'daily' as const,
          ...detailPayload,
        };
        cache = { key: detailCacheKey, at: Date.now(), body: payload };
        return jsonResponse(payload, 200, { 'X-Cache': 'MISS' });
      } catch (err) {
        return jsonResponse(
          {
            error:
              err instanceof Error
                ? err.message || err.name || 'Falha ao carregar detalhe Daily'
                : 'Falha ao carregar detalhe Daily',
          },
          500,
        );
      }
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
