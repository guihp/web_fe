import { toIndustriaPadrao } from '../utils/vendasDomain';

export type TipoUsuario = 'interno' | 'industria' | 'cliente';

export const EXTERNAL_SECTION_IDS = [
  'validades.home',
  'atividades.home',
  'fe-representacoes.sucesso',
  'fe-representacoes.price',
] as const;

export const EXTERNAL_CARGO_INDUSTRIA = 'Indústria (externo)';
export const EXTERNAL_CARGO_CLIENTE = 'Cliente (externo)';

export function isTipoUsuario(value: unknown): value is TipoUsuario {
  return value === 'interno' || value === 'industria' || value === 'cliente';
}

export function isExternalTipo(tipo: TipoUsuario | string | null | undefined): boolean {
  return tipo === 'industria' || tipo === 'cliente';
}

export function normalizeCnpjDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

export function maskCnpjInput(value: string): string {
  const d = normalizeCnpjDigits(value);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Chave de grupo a partir do nome (ex.: "Armazém Mateus CD 116" → "MATEUS"). */
export function normalizeClienteGrupo(value: string): string {
  const upper = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!upper) return '';

  // Preferência: token conhecido de redes
  const known = ['MATEUS', 'SENDAS', 'ASSAI', 'ATACADAO', 'CARREFOUR', 'SAMS', 'EXTRA', 'PAGUE MENOS'];
  for (const token of known) {
    if (upper.includes(token)) {
      // Assaí pertence ao grupo Sendas
      if (token === 'ASSAI') return 'SENDAS';
      return token;
    }
  }

  // Fallback: maior palavra com 4+ letras
  const parts = upper.split(' ').filter((p) => p.length >= 4);
  return parts.sort((a, b) => b.length - a.length)[0] ?? upper.slice(0, 24);
}

export function externalSecoesForTipo(tipo: TipoUsuario): string[] {
  if (!isExternalTipo(tipo)) return [];
  return [...EXTERNAL_SECTION_IDS];
}

export function cargoForExternalTipo(tipo: TipoUsuario): string {
  if (tipo === 'industria') return EXTERNAL_CARGO_INDUSTRIA;
  if (tipo === 'cliente') return EXTERNAL_CARGO_CLIENTE;
  return 'Colaborador';
}

export type ExternalScope = {
  tipo: TipoUsuario;
  /** Nome padronizado da indústria (ex.: PREDILECTA) */
  industriaNome: string | null;
  industriaId: number | null;
  /** Grupo de lojas (ex.: MATEUS) — match por nome */
  clienteGrupo: string | null;
  /** CNPJ de login (dígitos) */
  loginCnpj: string | null;
};

/**
 * Em Price/pesquisas as lojas às vezes vêm no nome curto da bandeira
 * (ex.: "Mix Belém", "Super Castanhal", Posterus/Carone) sem a palavra MATEUS.
 * Assaí → grupo SENDAS.
 */
const CLIENTE_GRUPO_LOJA_ALIASES: Record<string, string[]> = {
  MATEUS: [
    'MATEUS',
    'MIX',
    'POSTERUS',
    'CARONE',
    'CAMINO',
    'SUPER CASTANHAL',
    'SUPER MATEUS',
    'SUPER ANIL',
    'SUPER COHATRAC',
    'SUPER CODO',
    'SUPER COELHO',
    'SUPER RAPOSA',
    'SUPER SAO RAIMUNDO',
    'SUPER SANTA CLARA',
    'SUPER ALEMANHA',
    'SUPER MARABA',
    'SUPER BARCARENA',
    'SUPER CANAA',
    'SUPER BURITICUPU',
    'SUPER REI',
    'SUPER DOCAS',
    'SUPER ESTRADA',
    'SUPER MARITUBA',
    'JADERLANDIA',
    'JARDELANDIA',
  ],
  SENDAS: ['SENDAS', 'ASSAI'],
  ASSAI: ['SENDAS', 'ASSAI'],
};

function normalizeGrupoKey(grupo: string): string {
  return grupo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim();
}

/** Tokens usados para casar nome de loja com o grupo do cliente. */
export function lojaTokensForClienteGrupo(grupo: string): string[] {
  const needle = normalizeGrupoKey(grupo);
  if (!needle) return [];
  return CLIENTE_GRUPO_LOJA_ALIASES[needle] ?? [needle];
}

/**
 * Cláusula `or` do PostgREST para filtrar coluna de loja pelo grupo
 * (inclui aliases de bandeira).
 */
export function lojaOrFilterForClienteGrupo(grupo: string, column = 'loja'): string | null {
  const tokens = lojaTokensForClienteGrupo(grupo)
    .map((t) => t.replace(/[%*,()]/g, '').trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${column}.ilike.%${t}%`).join(',');
}

export function matchLojaByClienteGrupo(lojaNome: string | null | undefined, grupo: string): boolean {
  if (!grupo) return false;
  const hay = (lojaNome ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
  return lojaTokensForClienteGrupo(grupo).some((token) => hay.includes(token));
}

export function matchIndustriaScope(
  industriaValue: string | null | undefined,
  industriaNome: string,
): boolean {
  if (!industriaNome) return false;
  return toIndustriaPadrao(industriaValue ?? '') === toIndustriaPadrao(industriaNome);
}

/** CNPJ da venda pertence ao grupo se a raiz (8 dígitos) casar com o login ou o cliente/nome tiver o grupo. */
export function matchVendaByClienteGrupo(
  venda: { cnpj?: string | null; cliente?: string | null },
  grupo: string,
  loginCnpj?: string | null,
): boolean {
  if (matchLojaByClienteGrupo(venda.cliente, grupo)) return true;

  const cnpj = normalizeCnpjDigits(venda.cnpj ?? '');
  const login = normalizeCnpjDigits(loginCnpj ?? '');
  if (login.length >= 8 && cnpj.length >= 8 && cnpj.slice(0, 8) === login.slice(0, 8)) {
    return true;
  }
  return false;
}
