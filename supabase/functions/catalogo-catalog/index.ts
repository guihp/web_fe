import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CATALOG_KEY = 'catalogo-fe:v1';
const DELETED_PRODUCTS_KEY = 'catalogo-fe:deleted-products:v1';
const GOOGLE_CLIENT_ID =
  '1084907924579-93i3dfhtnvckmhrh4mc7n2rtl4rmet5s.apps.googleusercontent.com';

const DEFAULT_INDUSTRIES = [
  {
    slug: 'predilecta-alimentos',
    name: 'Predilecta Alimentos',
    shortName: 'Predilecta',
    monogram: 'PA',
    logo: 'assets/brands/predilecta.png',
  },
  {
    slug: 'precioso-alimentos',
    name: 'Precioso Alimentos',
    shortName: 'Precioso',
    monogram: 'PR',
    logo: 'assets/brands/precioso.avif',
  },
  {
    slug: 'vale-fertil',
    name: 'Vale Fértil',
    shortName: 'Vale Fértil',
    monogram: 'VF',
    logo: 'assets/brands/vale-fertil.avif',
  },
  { slug: 'bendo-alimentos', name: 'Bendo Alimentos', shortName: 'Bendo', monogram: 'BA', logo: null },
  {
    slug: 'ruppers',
    name: 'Ruppers',
    shortName: 'Ruppers',
    monogram: 'RU',
    logo: 'assets/brands/ruppers.avif',
  },
  {
    slug: 'dacolonia-alimentos',
    name: 'DaColônia Alimentos',
    shortName: 'DaColônia',
    monogram: 'DC',
    logo: 'assets/brands/dacolonia.avif',
  },
  {
    slug: 'tourinho-alimentos',
    name: 'Tourinho Alimentos',
    shortName: 'Tourinho',
    monogram: 'TA',
    logo: 'assets/brands/tourinho.avif',
  },
  {
    slug: 'peccin',
    name: 'Peccin',
    shortName: 'Peccin',
    monogram: 'P',
    logo: 'assets/brands/peccin.png',
  },
];

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Banco do catalogo nao configurado.');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function kvGet(key: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('catalogo_fe_kv')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const value = data.value as unknown;
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, '__str')) {
    return (value as { __str: string }).__str;
  }
  if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, '__set')) {
    return (value as { __set: string[] }).__set;
  }
  return value;
}

async function kvSet(key: string, raw: unknown) {
  const supabase = getServiceClient();
  let value: unknown;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = { __str: raw };
    }
  } else {
    value = raw;
  }
  const { error } = await supabase
    .from('catalogo_fe_kv')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return 'OK';
}

async function kvSadd(key: string, ...members: string[]) {
  const existing = await kvGet(key);
  const set = new Set(Array.isArray(existing) ? (existing as string[]) : []);
  for (const m of members) set.add(String(m));
  await kvSet(key, { __set: [...set] });
  return set.size;
}

async function kvSmembers(key: string) {
  const existing = await kvGet(key);
  return Array.isArray(existing) ? (existing as string[]) : [];
}

async function authorize(req: Request) {
  const header = req.headers.get('authorization') || '';
  const accessToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!accessToken) return null;

  const tokenResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!tokenResponse.ok) return null;
  const tokenInfo = await tokenResponse.json();
  const tokenAudience = tokenInfo.aud || tokenInfo.azp || '';
  if (tokenAudience !== GOOGLE_CLIENT_ID) return null;

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileResponse.ok) return null;
  const profile = await profileResponse.json();
  if (profile.email_verified === false) return null;
  const email = String(profile.email || '').toLowerCase();
  if (email === 'marketingrupofe@gmail.com') return 'master';
  if (email === 'marcio@ferepresentacoes.com') return 'editor';
  return null;
}

function validCatalog(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const v = value as { products?: unknown; industries?: unknown };
  return (
    Array.isArray(v.products) &&
    Array.isArray(v.industries) &&
    v.products.length <= 5000 &&
    v.industries.length <= 500 &&
    JSON.stringify(value).length <= 8 * 1024 * 1024
  );
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json',
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

type Catalog = {
  products: Array<{ id: string; [k: string]: unknown }>;
  industries: unknown[];
  updatedAt?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    if (req.method === 'GET') {
      const stored = await kvGet(CATALOG_KEY);
      let catalog: Catalog = stored
        ? typeof stored === 'string'
          ? JSON.parse(stored)
          : (stored as Catalog)
        : {
            products: [],
            industries: DEFAULT_INDUSTRIES,
            updatedAt: new Date().toISOString(),
          };

      if (!stored) {
        await kvSet(CATALOG_KEY, catalog);
      }

      const deletedIds = new Set(await kvSmembers(DELETED_PRODUCTS_KEY));
      if (deletedIds.size) {
        const visible = catalog.products.filter((p) => !deletedIds.has(p.id));
        if (visible.length !== catalog.products.length) {
          catalog = { ...catalog, products: visible, updatedAt: new Date().toISOString() };
          await kvSet(CATALOG_KEY, catalog);
        }
      }

      return json(req, 200, catalog);
    }

    if (req.method !== 'PUT' && req.method !== 'DELETE') {
      return json(req, 405, { error: 'Metodo nao permitido.' });
    }

    const role = await authorize(req);
    if (!role) return json(req, 401, { error: 'Administrador nao autorizado.' });

    if (req.method === 'DELETE') {
      if (role !== 'master') {
        return json(req, 403, { error: 'Editor nao pode retirar produtos.' });
      }
      const url = new URL(req.url);
      let body: { id?: string } | null = null;
      try {
        body = await req.json();
      } catch {
        body = null;
      }
      const id = String(url.searchParams.get('id') || body?.id || '').trim();
      if (!id) return json(req, 400, { error: 'Produto nao informado.' });

      const stored = await kvGet(CATALOG_KEY);
      const current: Catalog = stored
        ? typeof stored === 'string'
          ? JSON.parse(stored)
          : (stored as Catalog)
        : { products: [], industries: DEFAULT_INDUSTRIES };

      await kvSadd(DELETED_PRODUCTS_KEY, id);
      const catalog: Catalog = {
        products: current.products.filter((p) => p.id !== id),
        industries: current.industries,
        updatedAt: new Date().toISOString(),
      };
      await kvSet(CATALOG_KEY, catalog);
      return json(req, 200, catalog);
    }

    const body = await req.json();
    if (!validCatalog(body)) {
      return json(req, 400, { error: 'Catalogo invalido ou muito grande.' });
    }

    const incoming = body as Catalog;
    if (role === 'editor') {
      const stored = await kvGet(CATALOG_KEY);
      const current: Catalog = stored
        ? typeof stored === 'string'
          ? JSON.parse(stored)
          : (stored as Catalog)
        : { products: [], industries: DEFAULT_INDUSTRIES };
      const currentIds = current.products.map((p) => p.id).sort();
      const incomingIds = incoming.products.map((p) => p.id).sort();
      if (
        JSON.stringify(currentIds) !== JSON.stringify(incomingIds) ||
        JSON.stringify(current.industries) !== JSON.stringify(incoming.industries)
      ) {
        return json(req, 403, { error: 'Editor pode alterar apenas produtos existentes.' });
      }
    }

    const deletedIds = new Set(await kvSmembers(DELETED_PRODUCTS_KEY));
    const catalog: Catalog = {
      products: incoming.products.filter((p) => !deletedIds.has(p.id)),
      industries: incoming.industries,
      updatedAt: new Date().toISOString(),
    };
    await kvSet(CATALOG_KEY, catalog);
    return json(req, 200, catalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha interna.';
    return json(req, 500, { error: message });
  }
});
