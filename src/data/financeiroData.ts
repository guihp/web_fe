export type ContratoStatus = 'Rascunho' | 'Ativo' | 'Encerrado' | 'Cancelado';

export type Contrato = {
  id: string;
  titulo: string;
  subtitulo: string;
  industria: string;
  fechamento: string;
  valorMensal: number;
  status: ContratoStatus;
  tipo: string;
};

export type KanbanTask = {
  id: string;
  periodo: string;
  tag: string;
  titulo: string;
  industria: string;
  valor: number;
  coluna: 'pendente' | 'aguardando' | 'faturado';
};

export type ReceitaMes = {
  mes: string;
  contratos: number;
  comissoes: number;
};

export type ReceitaIndustria = {
  nome: string;
  contratos: number;
  comissoes: number;
};

export type ComparativoMes = {
  periodo: string;
  contratos: number;
  comissoes: number;
  total: number;
  variacao: number | null;
};

export const CONTRATOS_MOCK: Contrato[] = [
  {
    id: '1',
    titulo: 'Cobertura de Merchandising',
    subtitulo: 'Cobertura de Merchandising',
    industria: 'Peccin S/A',
    fechamento: '14/07/2026',
    valorMensal: 64080,
    status: 'Ativo',
    tipo: 'Cobertura de Merchandising',
  },
  {
    id: '2',
    titulo: 'Contrato de Representação Comercial',
    subtitulo: 'Contrato de Representação Comercial',
    industria: 'Predilecta Alimentos',
    fechamento: '31/12/2025',
    valorMensal: 0,
    status: 'Ativo',
    tipo: 'Contrato de Indústria',
  },
  {
    id: '3',
    titulo: 'Ajuda de Custo | Predilecta Alim.',
    subtitulo: 'Ajuda de Custo',
    industria: 'Predilecta Alimentos',
    fechamento: '31/12/2025',
    valorMensal: 21492,
    status: 'Ativo',
    tipo: 'Ação de Vendas',
  },
  {
    id: '4',
    titulo: 'Cobertura de Merchandising 2026',
    subtitulo: 'Cobertura de Merchandising',
    industria: 'DaColonia Alimentos',
    fechamento: '31/12/2025',
    valorMensal: 15400,
    status: 'Ativo',
    tipo: 'Cobertura de Merchandising',
  },
];

export const KANBAN_MOCK: KanbanTask[] = [
  {
    id: 'k1',
    periodo: 'Jul/2026',
    tag: 'Cobertura de Merchandising',
    titulo: 'Cobertura de Merchandising 2026',
    industria: 'DaColonia Alimentos',
    valor: 15400,
    coluna: 'aguardando',
  },
  {
    id: 'k2',
    periodo: 'Jul/2026',
    tag: 'Ajuda de Custo',
    titulo: 'Ajuda de Custo | Predilecta Alim.',
    industria: 'Predilecta Alimentos',
    valor: 21492,
    coluna: 'aguardando',
  },
];

export const RECEITA_MES_MOCK: ReceitaMes[] = [
  { mes: 'Ago', contratos: 0, comissoes: 0 },
  { mes: 'Set', contratos: 0, comissoes: 0 },
  { mes: 'Out', contratos: 0, comissoes: 0 },
  { mes: 'Nov', contratos: 0, comissoes: 0 },
  { mes: 'Dez', contratos: 36892, comissoes: 0 },
  { mes: 'Jan', contratos: 36892, comissoes: 0 },
  { mes: 'Fev', contratos: 36892, comissoes: 0 },
  { mes: 'Mar', contratos: 36892, comissoes: 0 },
  { mes: 'Abr', contratos: 36892, comissoes: 0 },
  { mes: 'Mai', contratos: 36892, comissoes: 0 },
  { mes: 'Jun', contratos: 36892, comissoes: 0 },
  { mes: 'Jul', contratos: 100972, comissoes: 0 },
];

export const RECEITA_INDUSTRIA_MOCK: ReceitaIndustria[] = [
  { nome: 'Peccin S/A', contratos: 64080, comissoes: 0 },
  { nome: 'Predilecta Alimentos', contratos: 21492, comissoes: 0 },
  { nome: 'DaColonia Alimentos', contratos: 15400, comissoes: 0 },
];

export const COMPARATIVO_MOCK: ComparativoMes[] = [
  {
    periodo: 'julho 2026',
    contratos: 100972,
    comissoes: 0,
    total: 100972,
    variacao: 173.7,
  },
  {
    periodo: 'junho 2026',
    contratos: 36892,
    comissoes: 0,
    total: 36892,
    variacao: null,
  },
];

export const FINANCEIRO_KPIS = {
  contratosAtivos: 4,
  totalComissoesMes: 0,
  totalAFaturar: 100972,
  receitaMensalTotal: 100972,
  receitaMesAtual: 100972,
  vsMesAnterior: 173.7,
  industriasAtivas: 3,
};

export type ContratoFilial = {
  id: string;
  codigo: number;
  nome: string;
  cidade: string;
  estado: string;
  regional: string;
  valorHora: number;
  horas: number;
  visitasSem: number;
  visitasMes: number;
};

export type ContratoAnexo = {
  id: string;
  nome: string;
  tamanho: string;
  data: string;
};

export type HistoricoEvento = {
  id: string;
  tipo: 'status' | 'valor' | 'filial' | 'anexo';
  titulo: string;
  detalhe: string;
  data: string;
};

const FILIAIS_BASE: Array<{
  codigo: number;
  nome: string;
  cidade: string;
  estado: string;
  regional: string;
}> = [
  { codigo: 1, nome: 'MATEUS SUPERMERCADOS S.A. - BALSAS', cidade: 'BALSAS', estado: 'MA', regional: 'MA' },
  { codigo: 2, nome: 'MATEUS SUPERMERCADOS S.A. - CAJAZEIRAS', cidade: 'SAO LUIS', estado: 'MA', regional: 'MA' },
  { codigo: 3, nome: 'MATEUS SUPERMERCADOS S.A. - COHAMA', cidade: 'SAO LUIS', estado: 'MA', regional: 'MA' },
  { codigo: 12, nome: 'MATEUS SUPERMERCADOS S.A. - TIMON', cidade: 'TIMON', estado: 'MA', regional: 'MA' },
  { codigo: 18, nome: 'MATEUS SUPERMERCADOS S.A. - PARNAIBA', cidade: 'PARNAIBA', estado: 'PI', regional: 'PI' },
  { codigo: 23, nome: 'MATEUS SUPERMERCADOS S.A. - PICOS', cidade: 'PICOS', estado: 'PI', regional: 'PI' },
  { codigo: 37, nome: 'MATEUS SUPERMERCADOS S A MIX BELEM', cidade: 'BELEM', estado: 'PA', regional: 'PA' },
  { codigo: 41, nome: 'MATEUS SUPERMERCADOS S.A. - ANANINDEUA', cidade: 'ANANINDEUA', estado: 'PA', regional: 'PA' },
  { codigo: 55, nome: 'POSTERUS SUPERMERCADOS LTDA - DIVINEIA', cidade: 'SAO LUIS', estado: 'MA', regional: 'MA' },
  { codigo: 62, nome: 'POSTERUS SUPERMERCADOS LTDA - RENASCENCA', cidade: 'SAO LUIS', estado: 'MA', regional: 'MA' },
  { codigo: 70, nome: 'ASSAI ATACADISTA - IMPERATRIZ', cidade: 'IMPERATRIZ', estado: 'MA', regional: 'MA' },
  { codigo: 77, nome: 'ASSAI ATACADISTA - TERESINA', cidade: 'TERESINA', estado: 'PI', regional: 'PI' },
  { codigo: 81, nome: 'ATACADAO S.A. - BELEM', cidade: 'BELEM', estado: 'PA', regional: 'PA' },
  { codigo: 88, nome: 'ATACADAO S.A. - SAO LUIS', cidade: 'SAO LUIS', estado: 'MA', regional: 'MA' },
  { codigo: 94, nome: 'CARREFOUR - TERESINA', cidade: 'TERESINA', estado: 'PI', regional: 'PI' },
  { codigo: 101, nome: 'CARREFOUR - BELEM', cidade: 'BELEM', estado: 'PA', regional: 'PA' },
  { codigo: 110, nome: 'MIX MATEUS - CODO', cidade: 'CODO', estado: 'MA', regional: 'MA' },
  { codigo: 118, nome: 'MIX MATEUS - CAXIAS', cidade: 'CAXIAS', estado: 'MA', regional: 'MA' },
  { codigo: 125, nome: 'SUPERMERCADO LIDER - SANTAREM', cidade: 'SANTAREM', estado: 'PA', regional: 'PA' },
  { codigo: 132, nome: 'SUPERMERCADO LIDER - MARABA', cidade: 'MARABA', estado: 'PA', regional: 'PA' },
];

export function valorTotalFilial(f: Pick<ContratoFilial, 'valorHora' | 'horas' | 'visitasMes'>) {
  return f.valorHora * f.horas * f.visitasMes;
}

export function buildFiliaisIniciais(contratoId: string): ContratoFilial[] {
  const seed = Number(contratoId) || 1;
  return FILIAIS_BASE.slice(0, 8 + (seed % 5)).map((base, index) => {
    const valorHora = 30;
    const horas = 2;
    const visitasSem = 3;
    const visitasMes = visitasSem * 4;
    return {
      id: `${contratoId}-f-${base.codigo}`,
      codigo: base.codigo,
      nome: base.nome,
      cidade: base.cidade,
      estado: base.estado,
      regional: base.regional,
      valorHora,
      horas,
      visitasSem,
      visitasMes,
      // keep index used to vary slightly
      ...(index === 0 ? {} : {}),
    };
  });
}

export const FILIAIS_DISPONIVEIS = FILIAIS_BASE;

export function buildHistoricoInicial(contrato: Contrato): HistoricoEvento[] {
  return [
    {
      id: `${contrato.id}-h1`,
      tipo: 'status',
      titulo: 'Status alterado de rascunho para ativo',
      detalhe: 'rascunho → ativo',
      data: '16/07/2026 às 10:13',
    },
    {
      id: `${contrato.id}-h2`,
      tipo: 'valor',
      titulo: 'Valor total ajustado',
      detalhe: '63360 → 64080',
      data: '16/07/2026 às 10:13',
    },
    {
      id: `${contrato.id}-h3`,
      tipo: 'valor',
      titulo: 'Valor total ajustado',
      detalhe: '62640 → 63360',
      data: '16/07/2026 às 10:13',
    },
    {
      id: `${contrato.id}-h4`,
      tipo: 'valor',
      titulo: 'Valor total ajustado',
      detalhe: '10800 → 11520',
      data: '16/07/2026 às 10:12',
    },
  ];
}
