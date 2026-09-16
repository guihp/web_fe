-- Autonomia (km/L) por placa — base do cálculo de combustível
update public.veiculos
set consumo_medio_km_l = 11, updated_at = now()
where upper(replace(placa, ' ', '')) = 'SMU6A13';

update public.veiculos
set consumo_medio_km_l = 30, updated_at = now()
where upper(replace(placa, ' ', '')) = 'ROE3D99';

update public.veiculos
set consumo_medio_km_l = 12, updated_at = now()
where upper(replace(placa, ' ', '')) = 'SMU6A10';

update public.veiculos
set consumo_medio_km_l = 12, updated_at = now()
where upper(replace(placa, ' ', '')) = 'QQT9J53';

comment on column public.veiculos.consumo_medio_km_l is
  'Autonomia do veículo em km por litro (km/L). Usada no cálculo: (km_rodados / autonomia) * preco_combustivel.';
