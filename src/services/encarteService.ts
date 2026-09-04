import { supabase } from '../lib/supabase';
import { isExternalTipo, matchIndustriaScope, type TipoUsuario } from '../utils/externalAccess';
import { toIndustriaPadrao } from '../utils/vendasDomain';

export const ENCARTE_PAGE_SIZE = 20;

export type EncarteTipo = 'ENCARTE GERAL' | 'ENCARTE INTERNO' | 'UNICO';
export type EncarteEscopo = 'TODOS' | 'MATEUS' | 'ASSAI' | 'LISTA';

export type EncarteAviso = {
  id: number;
  marca: string | null;
  produto: string | null;
  dataPromocao: string | null;
  dataFim: string | null;
  preco: number | null;
  codigo: number | null;
  tipo: EncarteTipo;
  nomeGrupo: string | null;
  escopo_cliente: EncarteEscopo;
  lojaIds: number[];
  lojaCodigos: number[];
  lojaNomes: string[];
};

export type EncarteImportRow = {
  marca: string;
  produto: string;
  preco: number | null;
  codigo: number | null;
  tipo: EncarteTipo;
  escopo_cliente: EncarteEscopo;
  /** Códigos de loja (lojas.codigo) */
  lojasCodigos: number[];
  dataPromocao: string;
  dataFim: string;
  nomeGrupo: string | null;
};

export type EncarteViewerScope = {
  tipo_usuario?: TipoUsuario | string | null;
  cargo?: string | null;
  industria_nome?: string | null;
  cliente_grupo?: string | null;
  usuario_id?: number | null;
};

function todayKeyBRT(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Normaliza data para YYYY-MM-DD a partir de ISO, serial ou DD/MM/YYYY. */
export function normalizeEncarteDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    let [, dd, mm, yy] = br;
    let y = Number(yy);
    if (y < 100) y += 2000;
    return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  return null;
}

export function formatEncarteDateBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function isMateusGroupName(nome: string): boolean {
  const u = nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
  return u.includes('MATEUS') || u.includes('POSTERUS') || u.includes('CARONE');
}

function isAssaiGroupName(nome: string): boolean {
  const u = nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
  return u.includes('ASSA') || u.includes('SENDAS');
}

function mapEncarteRow(
  row: Record<string, unknown>,
  lojaIds: number[] = [],
  lojaCodigos: number[] = [],
  lojaNomes: string[] = [],
): EncarteAviso {
  return {
    id: Number(row.id),
    marca: row.marca != null ? toIndustriaPadrao(String(row.marca)) : null,
    produto: (row.produto as string | null) ?? null,
    dataPromocao: row.dataPromocao != null ? String(row.dataPromocao).slice(0, 10) : null,
    dataFim: row.dataFim != null ? String(row.dataFim).slice(0, 10) : null,
    preco: row.preco == null ? null : Number(row.preco),
    codigo: row.codigo == null ? null : Number(row.codigo),
    tipo: row.tipo as EncarteTipo,
    nomeGrupo: (row.nomeGrupo as string | null) ?? null,
    escopo_cliente: row.escopo_cliente as EncarteEscopo,
    lojaIds,
    lojaCodigos,
    lojaNomes,
  };
}

async function attachLojas(encartes: EncarteAviso[]): Promise<EncarteAviso[]> {
  if (encartes.length === 0) return encartes;
  const ids = encartes.map((e) => e.id);
  const { data: links, error } = await supabase
    .from('encarte_avisos_lojas')
    .select('encarte_id, loja_id')
    .in('encarte_id', ids);
  if (error) throw new Error(error.message);

  const lojaIds = [...new Set((links ?? []).map((l) => Number(l.loja_id)))];
  const lojaById = new Map<number, { codigo: number | null; nome: string }>();
  if (lojaIds.length > 0) {
    const { data: lojas, error: lojasErr } = await supabase
      .from('lojas')
      .select('id, codigo, Nome')
      .in('id', lojaIds);
    if (lojasErr) throw new Error(lojasErr.message);
    for (const l of lojas ?? []) {
      lojaById.set(Number(l.id), {
        codigo: l.codigo == null ? null : Number(l.codigo),
        nome: String(l.Nome ?? ''),
      });
    }
  }

  const byEncarte = new Map<number, number[]>();
  for (const link of links ?? []) {
    const eid = Number(link.encarte_id);
    const lid = Number(link.loja_id);
    const arr = byEncarte.get(eid) ?? [];
    arr.push(lid);
    byEncarte.set(eid, arr);
  }

  return encartes.map((e) => {
    const lids = byEncarte.get(e.id) ?? [];
    const codigos: number[] = [];
    const nomes: string[] = [];
    for (const lid of lids) {
      const info = lojaById.get(lid);
      if (info?.codigo != null) codigos.push(info.codigo);
      if (info?.nome) nomes.push(info.nome);
    }
    return { ...e, lojaIds: lids, lojaCodigos: codigos, lojaNomes: nomes };
  });
}

export async function fetchEncartes(page = 1, pageSize = ENCARTE_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('encarte_avisos')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  const mapped = (data ?? []).map((row) => mapEncarteRow(row as Record<string, unknown>));
  const withLojas = await attachLojas(mapped);
  return { data: withLojas, total: count ?? 0 };
}

export async function fetchAllEncartes(): Promise<EncarteAviso[]> {
  const { data, error } = await supabase
    .from('encarte_avisos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const mapped = (data ?? []).map((row) => mapEncarteRow(row as Record<string, unknown>));
  return attachLojas(mapped);
}

async function resolveLojaIdsByCodigos(codigos: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (codigos.length === 0) return map;
  const unique = [...new Set(codigos)];
  const { data, error } = await supabase.from('lojas').select('id, codigo').in('codigo', unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (row.codigo != null) map.set(Number(row.codigo), Number(row.id));
  }
  return map;
}

export async function insertEncartesBatch(rows: EncarteImportRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const allCodigos = rows.flatMap((r) => r.lojasCodigos);
  const codigoToId = await resolveLojaIdsByCodigos(allCodigos);

  let inserted = 0;
  for (const row of rows) {
    const payload = {
      marca: row.marca || null,
      produto: row.produto || null,
      preco: row.preco,
      codigo: row.codigo,
      tipo: row.tipo,
      escopo_cliente: row.escopo_cliente,
      dataPromocao: row.dataPromocao,
      dataFim: row.dataFim,
      nomeGrupo: row.nomeGrupo,
    };

    const { data, error } = await supabase.from('encarte_avisos').insert([payload]).select('id').single();
    if (error) throw new Error(error.message);
    const encarteId = Number(data.id);

    if (row.escopo_cliente === 'LISTA' && row.lojasCodigos.length > 0) {
      const links = row.lojasCodigos
        .map((c) => codigoToId.get(c))
        .filter((id): id is number => id != null)
        .map((loja_id) => ({ encarte_id: encarteId, loja_id }));
      if (links.length === 0) {
        throw new Error(
          `Nenhuma loja encontrada para os códigos: ${row.lojasCodigos.join(', ')} (${row.produto})`,
        );
      }
      const { error: linkErr } = await supabase.from('encarte_avisos_lojas').insert(links);
      if (linkErr) throw new Error(linkErr.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function fetchUsuarioLojaIds(usuarioId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('usuario_lojas')
    .select('loja_id')
    .eq('usuario_id', usuarioId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => Number(r.loja_id));
}

async function fetchLojaIdsByGrupo(escopo: 'MATEUS' | 'ASSAI'): Promise<number[]> {
  const { data, error } = await supabase.from('lojas').select('id, Nome');
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((l) => {
      const nome = String(l.Nome ?? '');
      return escopo === 'MATEUS' ? isMateusGroupName(nome) : isAssaiGroupName(nome);
    })
    .map((l) => Number(l.id));
}

function encarteMatchesViewer(
  encarte: EncarteAviso,
  scope: EncarteViewerScope,
  userLojaIds: number[],
  mateusIds: Set<number>,
  assaiIds: Set<number>,
): boolean {
  if (!isExternalTipo(scope.tipo_usuario ?? '')) {
    return true; // interno (incl. promotor)
  }

  if (scope.tipo_usuario === 'industria') {
    return matchIndustriaScope(encarte.marca, scope.industria_nome ?? '');
  }

  // cliente externo ou qualquer outro com lojas
  if (encarte.escopo_cliente === 'TODOS') return true;
  if (encarte.escopo_cliente === 'MATEUS') {
    return userLojaIds.some((id) => mateusIds.has(id));
  }
  if (encarte.escopo_cliente === 'ASSAI') {
    return userLojaIds.some((id) => assaiIds.has(id));
  }
  // LISTA
  return encarte.lojaIds.some((id) => userLojaIds.includes(id));
}

/**
 * Promoções ativas: dataPromocao <= hoje <= dataFim.
 * Internos: todas. Externos: match indústria ou loja.
 */
export async function fetchPromocoesAtivasParaUsuario(
  scope: EncarteViewerScope,
): Promise<EncarteAviso[]> {
  const today = todayKeyBRT();
  const { data, error } = await supabase.from('encarte_avisos').select('*');
  if (error) throw new Error(error.message);

  let list = (data ?? [])
    .map((row) => mapEncarteRow(row as Record<string, unknown>))
    .filter((e) => {
      const start = e.dataPromocao ?? '';
      const end = e.dataFim ?? '';
      return start && end && start <= today && today <= end;
    });

  list = await attachLojas(list);

  if (!isExternalTipo(scope.tipo_usuario ?? '')) {
    return list;
  }

  const userLojaIds =
    scope.usuario_id != null ? await fetchUsuarioLojaIds(scope.usuario_id) : [];
  const [mateus, assai] = await Promise.all([
    fetchLojaIdsByGrupo('MATEUS'),
    fetchLojaIdsByGrupo('ASSAI'),
  ]);
  const mateusIds = new Set(mateus);
  const assaiIds = new Set(assai);

  return list.filter((e) => encarteMatchesViewer(e, scope, userLojaIds, mateusIds, assaiIds));
}

/** Encartes cujo dataPromocao = hoje (para o sininho). */
export async function fetchEncartesDoDiaParaUsuario(
  scope: EncarteViewerScope,
): Promise<EncarteAviso[]> {
  const today = todayKeyBRT();
  const ativas = await fetchPromocoesAtivasParaUsuario(scope);
  return ativas.filter((e) => e.dataPromocao === today);
}

export function lojaLabelForEncarte(e: EncarteAviso): string {
  if (e.tipo === 'UNICO' && e.lojaNomes[0]) return e.lojaNomes[0];
  if (e.escopo_cliente === 'TODOS') return 'Todas as lojas';
  if (e.escopo_cliente === 'MATEUS') return 'Todas Mateus (Posterus/Carone)';
  if (e.escopo_cliente === 'ASSAI') return 'Todas Assaí';
  if (e.lojaNomes.length === 0) return '—';
  if (e.lojaNomes.length <= 2) return e.lojaNomes.join(', ');
  return `${e.lojaNomes[0]} +${e.lojaNomes.length - 1}`;
}

/** Código antes do nome — ex.: "#255927 TORRONE DACOLONIA…" */
export function produtoLabelForEncarte(
  e: Pick<EncarteAviso, 'codigo' | 'produto'>,
  fallback = 'Promoção',
): string {
  const nome = e.produto?.trim() || fallback;
  if (e.codigo == null || Number.isNaN(Number(e.codigo))) return nome;
  return `#${e.codigo} ${nome}`;
}
