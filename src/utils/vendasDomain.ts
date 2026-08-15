export type Regiao = 'MA/PI' | 'PA';

export const MESES_PT = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const;

export const VENDEDORES = ['JOAO ANTONIO', 'PAULO FREITAS', 'GEREMIAS SOUSA'] as const;

const ESTADO_MAP: Record<string, string> = {
  MARANHAO: 'MARANHÃO',
  MARANHÃO: 'MARANHÃO',
  PIAUI: 'PIAUÍ',
  PIAUÍ: 'PIAUÍ',
  PARA: 'PARÁ',
  PARÁ: 'PARÁ',
  CEARA: 'CEARÁ',
  CEARÁ: 'CEARÁ',
  BAHIA: 'BAHIA',
};

export function normalizeEstado(estado: string): string {
  const key = estado.trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  return ESTADO_MAP[key] ?? estado.trim().toUpperCase();
}

export function regiaoFromEstado(estado: string): Regiao {
  const normalized = estado.trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (normalized === 'PARA' || normalized === 'PARÁ') return 'PA';
  return 'MA/PI';
}

/** Normaliza nome de indústria para cruzar cadastro x baseVendas (ex: Predilecta Alimentos ↔ PREDILECTA). */
export function normalizeIndustriaKey(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[''`]/g, '')
    .replace(/\b(ALIMENTOS|ALIMENTO|LTDA|LTDA\.|S\/A|SA|BRASIL|OFICIAL)\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nome canônico para exibir e gravar: MAIÚSCULO sem sufixos (PREDILECTA, SANTA FE, PECCIN). */
export function toIndustriaPadrao(nome: string): string {
  return normalizeIndustriaKey(nome);
}

export function industriasMatch(a: string, b: string): boolean {
  const na = normalizeIndustriaKey(a);
  const nb = normalizeIndustriaKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokenA = na.split(' ')[0] ?? '';
  const tokenB = nb.split(' ')[0] ?? '';
  return tokenA.length >= 4 && tokenA === tokenB;
}

export function formatCdc(digits: string): string {
  return digits.replace(/\D/g, '').slice(-4).padStart(4, '0');
}

export function mesAnoFromDate(dateInput: string | Date): { mes: string; ano: string } {
  const date = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00`) : dateInput;
  const mes = MESES_PT[date.getMonth()] ?? 'JANEIRO';
  return { mes, ano: String(date.getFullYear()) };
}

export function mesNumeroFromNome(mes: string): number {
  const idx = MESES_PT.findIndex((m) => m === mes.toUpperCase());
  return idx >= 0 ? idx + 1 : 1;
}

export function mesNomeFromNumero(month: number): string {
  return MESES_PT[month - 1] ?? 'JANEIRO';
}

export type BaseCliente = {
  id: string;
  cdc: string;
  cnpj: string | null;
  nome_fantasia: string | null;
  razao_social: string | null;
  cidade: string | null;
  estado: string | null;
  status: string | null;
  created_at: string;
};

export type BaseVenda = {
  id: string;
  data: string;
  cdc: string;
  numero_pedido: string;
  valor: number;
  industria: string | null;
  categoria: string | null;
  vendedor: string | null;
  cliente: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  mes: string | null;
  ano: string | null;
  created_at: string;
};

export type MetaProjecao = {
  id: string;
  industria: string;
  regiao: Regiao;
  ano_base: number;
  ano_projecao: number;
  crescimento_percentual: number | null;
  modo_manual: boolean;
  meta_anual_manual: number | null;
  meta_mensal_manual: number | null;
  created_at: string;
  updated_at: string;
};

export type ComissaoIndustria = {
  id: string;
  industria: string;
  mes: string;
  ano: string;
  regiao: Regiao;
  valor_venda: number;
  percentual_aplicado: number;
  valor_comissao: number;
  created_at: string;
};

export type IndustriaPercentual = {
  industria: string;
  percentual: number;
  /** Se preenchida, o % só vale para vendas dessa categoria. */
  categoria?: string | null;
};
