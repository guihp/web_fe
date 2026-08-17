import { toIndustriaPadrao } from '../utils/vendasDomain';

export type TipoUsuario = 'interno' | 'industria' | 'cliente';

export const EXTERNAL_SECTION_IDS = ['validades.home', 'merchandising.sucesso'] as const;

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
  const known = ['MATEUS', 'ASSAI', 'ATACADAO', 'CARREFOUR', 'SAMS', 'EXTRA', 'PAGUE MENOS'];
  for (const token of known) {
    if (upper.includes(token)) return token;
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

export function matchLojaByClienteGrupo(lojaNome: string | null | undefined, grupo: string): boolean {
  if (!grupo) return false;
  const hay = (lojaNome ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
  const needle = grupo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
  return hay.includes(needle);
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
