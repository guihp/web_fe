import { supabase } from '../lib/supabase';

export type Loja = {
  id: number;
  Nome: string;
  codigo: number | null;
  cnpj: string | null;
  regional: string | null;
  regional_id: number | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  status: string | null;
};

export type RegionalOption = {
  id: number;
  Nome: string;
};

export type LojaFormInput = {
  nome: string;
  codigo?: string;
  cnpj?: string;
  regionalId: number;
  regionalNome: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
};

export type CreateLojaInput = LojaFormInput;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCnpjDisplay(cnpj: string | null | undefined): string {
  const d = digitsOnly(cnpj ?? '');
  if (d.length !== 14) return cnpj?.trim() || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatLojaNome(loja: Pick<Loja, 'Nome' | 'codigo'>): string {
  if (loja.codigo != null) return `${loja.codigo} - ${loja.Nome}`;
  return loja.Nome;
}

/** Chave estável para cruzar nome gravado em validade.lojas com cadastro de lojas. */
export function normalizeLojaNomeKey(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mapa nome normalizado / código → rótulo "codigo - Nome". */
export function buildLojaLabelLookup(lojas: Loja[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const loja of lojas) {
    const label = formatLojaNome(loja);
    const nomeKey = normalizeLojaNomeKey(loja.Nome);
    if (nomeKey) map.set(nomeKey, label);
    if (loja.codigo != null) {
      map.set(String(loja.codigo), label);
      map.set(normalizeLojaNomeKey(`${loja.codigo} ${loja.Nome}`), label);
    }
  }
  return map;
}

/**
 * Exibe loja no formato do lançamento (ex.: "1 - MATEUS SUPERMERCADOS S.A. - BALSAS").
 * Aceita nome puro ou código gravado em `validade.lojas`.
 */
export function formatLojaLabelFromStored(
  stored: string | null | undefined,
  lookup: Map<string, string>,
): string {
  const raw = (stored ?? '').trim();
  if (!raw) return '—';
  if (/^\d+\s*-/.test(raw)) return raw;

  const byExactCode = lookup.get(raw);
  if (byExactCode) return byExactCode;

  const key = normalizeLojaNomeKey(raw);
  const byName = lookup.get(key);
  if (byName) return byName;

  // Match parcial: nome cadastrado contido no gravado (ou o contrário)
  for (const [mapKey, label] of lookup) {
    if (!/^\d+$/.test(mapKey) && (key.includes(mapKey) || mapKey.includes(key))) {
      return label;
    }
  }

  return raw;
}

function buildLojaPayload(input: LojaFormInput, options?: { keepStatus?: string | null }) {
  const nome = input.nome.trim();
  if (!nome) throw new Error('Informe o nome da filial.');
  if (!input.regionalId) throw new Error('Selecione a regional.');

  const codigoRaw = input.codigo?.trim() ?? '';
  let codigo: number | null = null;
  if (codigoRaw) {
    const parsed = Number(codigoRaw.replace(/\D/g, ''));
    if (!Number.isFinite(parsed)) throw new Error('Código inválido.');
    codigo = parsed;
  }

  const cnpjDigits = digitsOnly(input.cnpj ?? '');
  const cnpj = cnpjDigits ? cnpjDigits.padStart(14, '0').slice(-14) : null;

  const cidade = input.cidade?.trim() || null;
  const estado = input.estado?.trim().toUpperCase().slice(0, 2) || null;
  const endereco =
    input.endereco?.trim() ||
    (cidade && estado ? `${cidade}, ${estado}` : cidade || estado || null);

  return {
    Nome: nome,
    codigo,
    cnpj,
    regional: input.regionalNome,
    regional_id: input.regionalId,
    cidade,
    estado,
    endereco,
    status: options?.keepStatus ?? 'Ativo',
  };
}

export async function fetchRegionais(): Promise<RegionalOption[]> {
  const { data, error } = await supabase.from('regionais').select('id, Nome').order('id');
  if (error) throw new Error(error.message);
  return (data ?? []) as RegionalOption[];
}

export async function fetchLojas(): Promise<Loja[]> {
  const { data, error } = await supabase
    .from('lojas')
    .select('id, Nome, codigo, cnpj, regional, regional_id, cidade, estado, endereco, status')
    .order('id');
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Loja[];
  return rows.sort((a, b) => {
    const ca = a.codigo ?? Number.MAX_SAFE_INTEGER;
    const cb = b.codigo ?? Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;
    return (a.Nome ?? '').localeCompare(b.Nome ?? '', 'pt-BR');
  });
}

export async function createLoja(input: LojaFormInput): Promise<Loja> {
  const payload = buildLojaPayload(input);
  const { data, error } = await supabase.from('lojas').insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as Loja;
}

export async function updateLoja(id: number, input: LojaFormInput, currentStatus?: string | null): Promise<Loja> {
  const payload = buildLojaPayload(input, { keepStatus: currentStatus || 'Ativo' });
  const { data, error } = await supabase.from('lojas').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as Loja;
}

export async function deleteLoja(id: number): Promise<void> {
  const { error } = await supabase.from('lojas').delete().eq('id', id);
  if (error) {
    if (error.message.toLowerCase().includes('foreign key') || error.code === '23503') {
      throw new Error(
        'Esta filial está vinculada a contratos e não pode ser excluída. Remova o vínculo antes.',
      );
    }
    throw new Error(error.message);
  }
}
