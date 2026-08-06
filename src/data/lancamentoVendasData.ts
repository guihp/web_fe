export const ESTADOS_VENDAS = [
  'MARANHAO',
  'PIAUI',
  'PARA',
  'CEARA',
  'BAHIA',
];

export const MESES_VENDAS = [
  'JANEIRO',
  'FEVEREIRO',
  'MARCO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

export const CATEGORIAS_VENDAS = [
  'FEIJÃO',
  'GOMA',
  'MILHO',
  'REGULAR',
  'FOOD',
  'MANTEIGA',
  'QUEIJO',
  'EMPORIO',
  'DOCE',
];

export const VENDEDORES_MOCK = ['JOAO ANTONIO', 'MARIA SILVA', 'CARLOS SANTOS'];

export type LancamentoVendaForm = {
  dataLancamento: string;
  cdc: string;
  cnpj: string;
  pedido: string;
  valor: string;
  industria: string;
  categoria: string;
  vendedor: string;
  nomeFantasia: string;
  estado: string;
  cidade: string;
  mes: string;
  ano: string;
};

export const emptyLancamentoForm = (): LancamentoVendaForm => {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  return {
    dataLancamento: isoDate,
    cdc: '',
    cnpj: '',
    pedido: '',
    valor: '',
    industria: '',
    categoria: '',
    vendedor: 'JOAO ANTONIO',
    nomeFantasia: '',
    estado: 'MARANHAO',
    cidade: '',
    mes: 'JUNHO',
    ano: String(today.getFullYear()),
  };
};
