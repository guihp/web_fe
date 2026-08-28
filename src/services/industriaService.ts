import { supabase } from '../lib/supabase';
import { toIndustriaPadrao } from '../utils/vendasDomain';

export type Industria = {
  id: number;
  Nome: string;
  status?: string | null;
};

function mapIndustria(row: Industria): Industria {
  return {
    ...row,
    Nome: toIndustriaPadrao(row.Nome ?? ''),
  };
}

/** Status Ativo (ou vazio legado) — Inativo e outros ficam de fora dos selects. */
export function isIndustriaStatusAtivo(status: string | null | undefined): boolean {
  const s = (status ?? 'Ativo')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return s === 'ativo' || s === '';
}

/** Todas as indústrias (inclui Inativo) — uso admin / auditoria. */
export async function fetchIndustrias(): Promise<Industria[]> {
  const { data, error } = await supabase.from('industrias').select('id, Nome, status').order('Nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Industria[]).map(mapIndustria);
}

/** Cadastro com status Ativo — padrão para qualquer dropdown operacional. */
export async function fetchIndustriasAtivas(): Promise<Industria[]> {
  const { data, error } = await supabase
    .from('industrias')
    .select('id, Nome, status')
    .or('status.eq.Ativo,status.is.null')
    .order('Nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Industria[])
    .map(mapIndustria)
    .filter((row) => isIndustriaStatusAtivo(row.status));
}

/** Nomes padronizados só de indústrias ativas. */
export async function fetchIndustriaNomes(): Promise<string[]> {
  const rows = await fetchIndustriasAtivas();
  const set = new Set<string>();
  for (const row of rows) {
    const nome = toIndustriaPadrao(row.Nome);
    if (nome) set.add(nome);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function fetchIndustriaNomesAtivas(): Promise<string[]> {
  return fetchIndustriaNomes();
}

/** Filtra uma lista de nomes (ex.: vindos de vendas/pesquisas) para só ativas no cadastro. */
export async function keepIndustriaNomesAtivos(nomes: Iterable<string>): Promise<string[]> {
  const ativas = new Set(await fetchIndustriaNomes());
  const out = new Set<string>();
  for (const raw of nomes) {
    const nome = toIndustriaPadrao(raw);
    if (nome && ativas.has(nome)) out.add(nome);
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
