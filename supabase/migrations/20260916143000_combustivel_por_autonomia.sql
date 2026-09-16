-- Cálculo oficial: (km_rodados / autonomia_km_l) * preco_combustivel
update public.veiculo_config
set formula_combustivel = 'km_div_consumo_x_litro',
    updated_at = now()
where id = 1;

-- Recalcula prestações ainda aguardando aprovação
update public.veiculo_entregas e
set
  valor_combustivel_calculado = round((e.km_rodados / nullif(v.consumo_medio_km_l, 0)) * e.preco_combustivel, 2),
  total_estimado = round(
    ((e.km_rodados / nullif(v.consumo_medio_km_l, 0)) * e.preco_combustivel)
    + coalesce(e.valor_lavagem, 0)
    + coalesce(e.valor_outros, 0),
    2
  ),
  updated_at = now()
from public.veiculos v
where e.veiculo_id = v.id
  and e.status = 'aguardando_aprovacao'
  and v.consumo_medio_km_l is not null
  and v.consumo_medio_km_l > 0
  and e.km_rodados is not null;
