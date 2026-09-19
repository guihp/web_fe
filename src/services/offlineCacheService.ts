import type { Loja } from './lojasService';
import type { UsuarioLoja } from './usuarioLojasService';
import type { Validade, ValidadeMesOption } from './validadeService';
import { getCache, putCache } from '../lib/offlineDb';

const KEYS = {
  usuarioLojas: (uid: number) => `usuario_lojas:${uid}`,
  industrias: 'industrias_ativas',
  senhaDoDia: 'senha_do_dia',
  lojasAll: 'lojas_ativas',
  validades: (uid: number) => `validades_snapshot:${uid}`,
  validadesFilters: 'validades_filters',
} as const;

export async function cacheUsuarioLojas(usuarioId: number, lojas: UsuarioLoja[]) {
  await putCache(KEYS.usuarioLojas(usuarioId), lojas);
}

export async function readCachedUsuarioLojas(
  usuarioId: number,
): Promise<UsuarioLoja[] | null> {
  const row = await getCache<UsuarioLoja[]>(KEYS.usuarioLojas(usuarioId));
  return row?.value ?? null;
}

export async function cacheIndustrias(nomes: string[]) {
  await putCache(KEYS.industrias, nomes);
}

export async function readCachedIndustrias(): Promise<string[] | null> {
  const row = await getCache<string[]>(KEYS.industrias);
  return row?.value ?? null;
}

export async function cacheSenhaDoDia(data: {
  senha: string | null;
  dia: string;
  label: string;
}) {
  await putCache(KEYS.senhaDoDia, data);
}

export async function readCachedSenhaDoDia(): Promise<{
  senha: string | null;
  dia: string;
  label: string;
} | null> {
  const row = await getCache<{ senha: string | null; dia: string; label: string }>(
    KEYS.senhaDoDia,
  );
  return row?.value ?? null;
}

export async function cacheLojasAtivas(lojas: Loja[]) {
  await putCache(KEYS.lojasAll, lojas);
}

export async function readCachedLojasAtivas(): Promise<Loja[] | null> {
  const row = await getCache<Loja[]>(KEYS.lojasAll);
  return row?.value ?? null;
}

export type ValidadesSnapshot = {
  items: Validade[];
  total: number;
  search: string;
  uf: string;
  industria: string;
  mes: string;
  status: string;
  sort: string;
  page: number;
  scopeIndustria?: string;
  scopeClienteGrupo?: string;
};

export async function cacheValidadesSnapshot(usuarioId: number, snap: ValidadesSnapshot) {
  await putCache(KEYS.validades(usuarioId), snap);
}

export async function readCachedValidadesSnapshot(
  usuarioId: number,
): Promise<{ value: ValidadesSnapshot; updatedAt: number } | null> {
  return getCache<ValidadesSnapshot>(KEYS.validades(usuarioId));
}

export async function cacheValidadesFilters(opts: {
  ufs: string[];
  industrias: string[];
  meses: ValidadeMesOption[];
}) {
  await putCache(KEYS.validadesFilters, opts);
}

export async function readCachedValidadesFilters(): Promise<{
  ufs: string[];
  industrias: string[];
  meses: ValidadeMesOption[];
} | null> {
  const row = await getCache<{
    ufs: string[];
    industrias: string[];
    meses: ValidadeMesOption[];
  }>(KEYS.validadesFilters);
  return row?.value ?? null;
}
