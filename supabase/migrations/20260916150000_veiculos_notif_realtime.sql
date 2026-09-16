-- Realtime para o sino refletir retirada/entrega/lembrete de 7 dias
do $$ begin
  alter publication supabase_realtime add table public.veiculo_retiradas;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.veiculo_entregas;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.veiculo_responsabilidades;
exception when duplicate_object then null;
end $$;
