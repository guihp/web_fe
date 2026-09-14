-- KV store for Catalogo Fe (replaces Vercel Redis / Upstash).
create table if not exists public.catalogo_fe_kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.catalogo_fe_kv enable row level security;

revoke all on table public.catalogo_fe_kv from anon, authenticated;
grant all on table public.catalogo_fe_kv to service_role;

comment on table public.catalogo_fe_kv is
  'KV store for Catalogo Fe (products/industries/seeds). Accessed only via Edge Functions with service role.';
