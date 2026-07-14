export type VendaRegistro = {
  id: number;
  cdc: string;
  pedido: string;
  cliente: string;
  industria: string;
  categoria: string;
  vendedor: string;
  estado: string;
  mes: string;
  ano: string;
  valor: number;
};

const CLIENTES = [
  'SUPERMERCADOS ELIZEU MARTINS',
  'CD 338 ALTOS',
  'ARMAZÉM MATEUS CD 87',
  'SUPERMERCADO BOM PREÇO',
  'DISTRIBUIDORA NORTE',
  'MERCADO CENTRAL',
];

const INDUSTRIAS = ['RUPPERS', 'DACOLONIA', 'PREDILECTA', 'TOURINHO', 'PRECIOSO'];
const CATEGORIAS = ['REGULAR', 'PROMOCIONAL', 'ESPECIAL'];
const VENDEDORES = ['JOAO ANTONIO', 'MARIA SILVA'];
const ESTADOS = ['PIAUI', 'MARANHAO', 'PARA'];
const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO'];

function buildMockVendas(): VendaRegistro[] {
  const items: VendaRegistro[] = [];

  for (let i = 1; i <= 839; i += 1) {
    const cdc = String(1000 + (i % 9000)).padStart(4, '0');
    items.push({
      id: i,
      cdc,
      pedido: String(15000 + i * 13),
      cliente: CLIENTES[i % CLIENTES.length],
      industria: INDUSTRIAS[i % INDUSTRIAS.length],
      categoria: i % 5 === 0 ? '-' : CATEGORIAS[i % CATEGORIAS.length],
      vendedor: VENDEDORES[i % VENDEDORES.length],
      estado: ESTADOS[i % ESTADOS.length],
      mes: MESES[i % MESES.length],
      ano: i % 3 === 0 ? '2025' : '2026',
      valor: Math.round((5000 + (i * 1737) % 200000) * 100) / 100,
    });
  }

  // Destaque do mockup na primeira página
  items[0] = {
    id: 1,
    cdc: '0793',
    pedido: '15596',
    cliente: 'SUPERMERCADOS ELIZEU MARTINS',
    industria: 'RUPPERS',
    categoria: 'REGULAR',
    vendedor: 'JOAO ANTONIO',
    estado: 'PIAUI',
    mes: 'JUNHO',
    ano: '2026',
    valor: 195_847.6,
  };

  items[1] = {
    id: 2,
    cdc: '0793',
    pedido: '15238',
    cliente: 'SUPERMERCADOS ELIZEU MARTINS',
    industria: 'RUPPERS',
    categoria: '-',
    vendedor: 'JOAO ANTONIO',
    estado: 'PIAUI',
    mes: 'MAIO',
    ano: '2026',
    valor: 12_234.32,
  };

  items[2] = {
    id: 3,
    cdc: '5078',
    pedido: '4157671',
    cliente: 'CD 338 ALTOS',
    industria: 'DACOLONIA',
    categoria: '-',
    vendedor: 'JOAO ANTONIO',
    estado: 'MARANHAO',
    mes: 'MAIO',
    ano: '2026',
    valor: 149_432.5,
  };

  return items;
}

export const VENDAS_REGISTRADAS = buildMockVendas();
export const PAGE_SIZE = 50;

export const FILTRO_INDUSTRIAS = ['Todas', ...INDUSTRIAS];
export const FILTRO_MESES = ['Todos', ...MESES];
export const FILTRO_ESTADOS = ['Todos', ...ESTADOS];
