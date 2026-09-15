-- Gestão de Veículos: frota, responsabilidades, retirada/entrega, gastos, aprovação, auditoria

create extension if not exists pgcrypto;

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('carro', 'moto')),
  marca text not null,
  modelo text not null,
  placa text not null,
  ano int,
  cor text,
  consumo_medio_km_l numeric(10,2),
  foto_url text,
  situacao text not null default 'disponivel'
    check (situacao in ('disponivel', 'em_uso', 'manutencao', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists veiculos_placa_unique on public.veiculos (upper(trim(placa)));

create table if not exists public.veiculo_config (
  id int primary key default 1 check (id = 1),
  formula_combustivel text not null default 'km_x_preco'
    check (formula_combustivel in ('km_x_preco', 'km_div_consumo_x_litro')),
  preco_padrao numeric(12,4),
  updated_at timestamptz not null default now(),
  updated_by bigint
);
insert into public.veiculo_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.veiculo_responsabilidades (
  id uuid primary key default gen_random_uuid(),
  usuario_id bigint not null,
  veiculo_id uuid not null references public.veiculos(id),
  inicio_em timestamptz not null default now(),
  devolucao_prevista_em timestamptz,
  observacoes text,
  status text not null default 'programado'
    check (status in ('programado', 'em_uso', 'entregue', 'aguardando_aprovacao', 'finalizado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists veiculo_resp_veiculo_idx on public.veiculo_responsabilidades (veiculo_id);
create index if not exists veiculo_resp_usuario_idx on public.veiculo_responsabilidades (usuario_id);
create index if not exists veiculo_resp_status_idx on public.veiculo_responsabilidades (status);

create table if not exists public.veiculo_manutencoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  data_inicio timestamptz not null default now(),
  data_fim timestamptz,
  descricao text,
  oficina text,
  valor numeric(12,2),
  comprovante_url text,
  status text not null default 'aberta'
    check (status in ('aberta', 'concluida', 'cancelada')),
  criado_por bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.veiculo_retiradas (
  id uuid primary key default gen_random_uuid(),
  responsabilidade_id uuid not null references public.veiculo_responsabilidades(id),
  usuario_id bigint not null,
  veiculo_id uuid not null references public.veiculos(id),
  retirada_em timestamptz not null default now(),
  foto_hodometro_url text not null,
  km_ia numeric(12,1),
  km_confirmado numeric(12,1) not null,
  confianca_ia numeric(5,2),
  combustivel_nivel text,
  conservacao text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists veiculo_retiradas_resp_unique on public.veiculo_retiradas (responsabilidade_id);

create table if not exists public.veiculo_entregas (
  id uuid primary key default gen_random_uuid(),
  retirada_id uuid not null unique references public.veiculo_retiradas(id),
  responsabilidade_id uuid not null references public.veiculo_responsabilidades(id),
  usuario_id bigint not null,
  veiculo_id uuid not null references public.veiculos(id),
  entrega_em timestamptz not null default now(),
  foto_hodometro_url text not null,
  km_ia numeric(12,1),
  km_confirmado numeric(12,1) not null,
  confianca_ia numeric(5,2),
  combustivel_nivel text,
  lavado boolean not null default false,
  preco_combustivel numeric(12,4) not null default 0,
  km_rodados numeric(12,1),
  valor_combustivel_calculado numeric(12,2),
  valor_abastecido_notas numeric(12,2) default 0,
  valor_lavagem numeric(12,2) default 0,
  valor_outros numeric(12,2) default 0,
  total_estimado numeric(12,2) default 0,
  observacoes text,
  status text not null default 'rascunho'
    check (status in (
      'rascunho',
      'veiculo_retirado',
      'entrega_registrada',
      'aguardando_aprovacao',
      'correcao_solicitada',
      'rejeitado',
      'aprovado',
      'finalizado'
    )),
  motivo_correcao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.veiculo_abastecimentos (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.veiculo_entregas(id) on delete cascade,
  data date not null default current_date,
  valor numeric(12,2) not null,
  preco_litro numeric(12,4),
  litros numeric(12,3),
  posto text,
  nota_url text,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.veiculo_lavagens (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null unique references public.veiculo_entregas(id) on delete cascade,
  valor numeric(12,2) not null,
  data date not null default current_date,
  estabelecimento text,
  comprovante_url text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.veiculo_despesas (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.veiculo_entregas(id) on delete cascade,
  tipo text not null default 'outro',
  valor numeric(12,2) not null,
  descricao text,
  comprovante_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.veiculo_fotos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references public.veiculos(id),
  retirada_id uuid references public.veiculo_retiradas(id) on delete cascade,
  entrega_id uuid references public.veiculo_entregas(id) on delete cascade,
  tipo text not null check (tipo in ('hodometro_inicial','hodometro_final','veiculo','nota','outro','frota')),
  url text not null,
  usuario_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.veiculo_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.veiculo_entregas(id) on delete cascade,
  acao text not null check (acao in ('aprovar','rejeitar','solicitar_correcao','ajustar_valor','observacao','confirmar_debito')),
  valor_anterior numeric(12,2),
  valor_novo numeric(12,2),
  justificativa text,
  actor_usuario_id bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.veiculo_auditoria (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id text not null,
  usuario_id bigint,
  acao text not null,
  payload_antes jsonb,
  payload_depois jsonb,
  justificativa text,
  created_at timestamptz not null default now()
);
create index if not exists veiculo_auditoria_entidade_idx on public.veiculo_auditoria (entidade, entidade_id);

do $$
begin
  alter table public.veiculos enable row level security;
  alter table public.veiculo_config enable row level security;
  alter table public.veiculo_responsabilidades enable row level security;
  alter table public.veiculo_manutencoes enable row level security;
  alter table public.veiculo_retiradas enable row level security;
  alter table public.veiculo_entregas enable row level security;
  alter table public.veiculo_abastecimentos enable row level security;
  alter table public.veiculo_lavagens enable row level security;
  alter table public.veiculo_despesas enable row level security;
  alter table public.veiculo_fotos enable row level security;
  alter table public.veiculo_aprovacoes enable row level security;
  alter table public.veiculo_auditoria enable row level security;
exception when others then null;
end $$;

do $$ begin create policy veiculos_all on public.veiculos for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_config_all on public.veiculo_config for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_resp_all on public.veiculo_responsabilidades for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_manut_all on public.veiculo_manutencoes for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_ret_all on public.veiculo_retiradas for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_ent_all on public.veiculo_entregas for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_abast_all on public.veiculo_abastecimentos for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_lav_all on public.veiculo_lavagens for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_desp_all on public.veiculo_despesas for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_fotos_all on public.veiculo_fotos for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_aprov_all on public.veiculo_aprovacoes for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_aud_all on public.veiculo_auditoria for all using (true) with check (true); exception when duplicate_object then null; end $$;

grant all on public.veiculos to anon, authenticated, service_role;
grant all on public.veiculo_config to anon, authenticated, service_role;
grant all on public.veiculo_responsabilidades to anon, authenticated, service_role;
grant all on public.veiculo_manutencoes to anon, authenticated, service_role;
grant all on public.veiculo_retiradas to anon, authenticated, service_role;
grant all on public.veiculo_entregas to anon, authenticated, service_role;
grant all on public.veiculo_abastecimentos to anon, authenticated, service_role;
grant all on public.veiculo_lavagens to anon, authenticated, service_role;
grant all on public.veiculo_despesas to anon, authenticated, service_role;
grant all on public.veiculo_fotos to anon, authenticated, service_role;
grant all on public.veiculo_aprovacoes to anon, authenticated, service_role;
grant all on public.veiculo_auditoria to anon, authenticated, service_role;

insert into storage.buckets (id, name, public)
values ('veiculo-anexos', 'veiculo-anexos', true)
on conflict (id) do update set public = excluded.public;

do $$ begin create policy veiculo_anexos_select on storage.objects for select using (bucket_id = 'veiculo-anexos'); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_anexos_insert on storage.objects for insert with check (bucket_id = 'veiculo-anexos'); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_anexos_update on storage.objects for update using (bucket_id = 'veiculo-anexos'); exception when duplicate_object then null; end $$;
do $$ begin create policy veiculo_anexos_delete on storage.objects for delete using (bucket_id = 'veiculo-anexos'); exception when duplicate_object then null; end $$;

comment on table public.veiculos is 'Frota da empresa — Gestão de Veículos';
