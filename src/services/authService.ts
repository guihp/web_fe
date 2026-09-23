import { supabase } from '../lib/supabase';
import { normalizeCpf } from '../lib/cpf';
import { sha256Hex } from '../lib/sha256';
import {
  canManageUsers,
  parseAcessoFromNivelAcesso,
  type PortalModuleId,
} from '../data/portalModules';
import type { HubSistemaId } from '../data/hubPermissions';
import { HUB_SISTEMA_IDS } from '../data/hubPermissions';
import { fetchHubPermissions } from './hubPermissionsService';
import {
  cargoForExternalTipo,
  externalSecoesForTipo,
  isExternalTipo,
  isTipoUsuario,
  normalizeCnpjDigits,
  type TipoUsuario,
} from '../utils/externalAccess';
import { toIndustriaPadrao } from '../utils/vendasDomain';

export type AuthUser = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string;
  cpf: string;
  foto_perfil_url: string | null;
  modulos_acesso: PortalModuleId[];
  secoes_acesso: string[];
  tipo_usuario: TipoUsuario;
  industria_id: number | null;
  industria_nome: string | null;
  cliente_grupo: string | null;
  login_cnpj: string | null;
  data_nascimento: string | null;
  /** Somente visualização (indústria/cliente externo). */
  somente_leitura: boolean;
  /** Admin supremo do Grupo Fé (hub multi-sistema). */
  is_super_admin: boolean;
  /** Sistemas liberados no hub (hub_usuario_sistemas). */
  hub_sistemas: HubSistemaId[];
  /** Seções/cards liberados no hub (hub_usuario_secoes). */
  hub_secoes: string[];
};

export type LoginTipo = 'interno' | 'industria' | 'cliente';

const WEB_ALLOWED_CARGOS = [
  'Gerente',
  'Supervisor',
  'Financeiro',
  'RH',
  'Analista admin',
  'Vendedor',
  'Promotor',
  'Demonstradora',
] as const;

export function isWebAdminCargo(cargo: string): boolean {
  const key = cargo.trim().toLowerCase();
  return WEB_ALLOWED_CARGOS.some((c) => c.toLowerCase() === key) || canManageUsers(cargo);
}

export { canManageUsers };

async function verifyPassword(senha: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;

  const newHash = await sha256Hex(senha + salt);
  return newHash === hash;
}

type UsuarioRow = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string;
  cpf: string | null;
  senha: string;
  status: boolean | null;
  foto_perfil_url: string | null;
  nivel_acesso: string | null;
  tipo_usuario?: string | null;
  industria_id?: number | null;
  cliente_grupo?: string | null;
  login_cnpj?: string | null;
  data_nascimento?: string | null;
  is_super_admin?: boolean | null;
};

const USUARIO_SELECT =
  'id, nome, email, telefone, cargo, cpf, senha, status, foto_perfil_url, nivel_acesso, tipo_usuario, industria_id, cliente_grupo, login_cnpj, data_nascimento, is_super_admin';

async function resolveIndustriaNome(industriaId: number | null | undefined): Promise<string | null> {
  if (!industriaId) return null;
  const { data, error } = await supabase.from('industrias').select('id, "Nome"').eq('id', industriaId).maybeSingle();
  if (error || !data) return null;
  return toIndustriaPadrao(String((data as { Nome?: string }).Nome ?? ''));
}

function toAuthUser(
  user: UsuarioRow,
  industriaNome: string | null,
  hub: { sistemas: HubSistemaId[]; secoes: string[] },
): AuthUser {
  const tipo: TipoUsuario = isTipoUsuario(user.tipo_usuario) ? user.tipo_usuario : 'interno';
  const acesso = isExternalTipo(tipo)
    ? {
        secoes: externalSecoesForTipo(tipo),
        modulos: ['merchandising', 'fe-representacoes'] as PortalModuleId[],
      }
    : parseAcessoFromNivelAcesso(user.nivel_acesso, user.cargo);

  const isSuperAdmin = Boolean(user.is_super_admin) && tipo === 'interno';

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    telefone: user.telefone,
    cargo: user.cargo || cargoForExternalTipo(tipo),
    cpf: user.cpf ?? '',
    foto_perfil_url: user.foto_perfil_url ?? null,
    modulos_acesso: acesso.modulos,
    secoes_acesso: acesso.secoes,
    tipo_usuario: tipo,
    industria_id: user.industria_id ?? null,
    industria_nome: industriaNome,
    cliente_grupo: user.cliente_grupo ? String(user.cliente_grupo).trim().toUpperCase() : null,
    login_cnpj: user.login_cnpj ? normalizeCnpjDigits(String(user.login_cnpj)) : null,
    data_nascimento: user.data_nascimento
      ? String(user.data_nascimento).slice(0, 10)
      : null,
    somente_leitura: isExternalTipo(tipo),
    is_super_admin: isSuperAdmin,
    hub_sistemas: isSuperAdmin ? [...HUB_SISTEMA_IDS] : hub.sistemas,
    hub_secoes: isSuperAdmin ? [] : hub.secoes,
  };
}

async function finalizeLogin(user: UsuarioRow): Promise<AuthUser> {
  if (user.status === false) {
    throw new Error('Usuário inativo. Contacte o administrador.');
  }

  const tipo: TipoUsuario = isTipoUsuario(user.tipo_usuario) ? user.tipo_usuario : 'interno';

  if (tipo === 'interno' && !isWebAdminCargo(user.cargo)) {
    throw new Error('Acesso restrito ao painel web. Promotores e degustação devem usar o aplicativo mobile.');
  }

  const industriaNome =
    tipo === 'industria' ? await resolveIndustriaNome(user.industria_id) : null;

  if (tipo === 'industria' && !industriaNome) {
    throw new Error('Indústria vinculada não encontrada. Contacte o administrador.');
  }

  if (tipo === 'cliente' && !user.cliente_grupo) {
    throw new Error('Grupo de cliente não configurado. Contacte o administrador.');
  }

  let hub = { sistemas: [] as HubSistemaId[], secoes: [] as string[] };
  if (tipo === 'interno') {
    try {
      hub = await fetchHubPermissions(user.id);
    } catch {
      hub = { sistemas: [], secoes: [] };
    }
  }

  return toAuthUser(user, industriaNome, hub);
}

export async function loginWithCpf(cpf: string, senha: string): Promise<AuthUser> {
  return loginAs('interno', cpf, senha);
}

/** Recarrega o usuário logado do banco (ex.: data_nascimento atualizada). */
export async function refreshAuthUser(userId: number): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(USUARIO_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as UsuarioRow;
  if (row.status === false) return null;

  const tipo: TipoUsuario = isTipoUsuario(row.tipo_usuario) ? row.tipo_usuario : 'interno';
  const industriaNome =
    tipo === 'industria' ? await resolveIndustriaNome(row.industria_id) : null;

  let hub = { sistemas: [] as HubSistemaId[], secoes: [] as string[] };
  if (tipo === 'interno') {
    try {
      hub = await fetchHubPermissions(row.id);
    } catch {
      hub = { sistemas: [], secoes: [] };
    }
  }

  return toAuthUser(row, industriaNome, hub);
}

export async function loginAs(
  loginTipo: LoginTipo,
  identifier: string,
  senha: string,
): Promise<AuthUser> {
  let user: UsuarioRow | null = null;

  if (loginTipo === 'interno') {
    const normalizedCpf = normalizeCpf(identifier);
    if (normalizedCpf.length !== 11) {
      throw new Error('Informe um CPF válido com 11 dígitos.');
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select(USUARIO_SELECT)
      .eq('cpf', normalizedCpf)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Usuário não encontrado. Verifique o CPF.');
    }
    user = data as UsuarioRow;
    if (isTipoUsuario(user.tipo_usuario) && user.tipo_usuario !== 'interno') {
      throw new Error('Este usuário deve entrar como Indústria ou Cliente.');
    }
  } else if (loginTipo === 'industria') {
    const nome = toIndustriaPadrao(identifier);
    if (!nome) {
      throw new Error('Informe o nome da indústria.');
    }

    const { data: industrias, error: indError } = await supabase
      .from('industrias')
      .select('id, "Nome", status');

    if (indError) throw new Error(indError.message);

    const industria = (industrias ?? []).find(
      (row) => toIndustriaPadrao(String((row as { Nome?: string }).Nome ?? '')) === nome,
    ) as { id: number; Nome?: string; status?: string | null } | undefined;

    if (!industria) {
      throw new Error('Indústria não encontrada. Verifique o nome.');
    }

    const status = (industria.status ?? 'Ativo').trim().toLowerCase();
    if (status && status !== 'ativo') {
      throw new Error('Esta indústria está inativa. Contacte o administrador.');
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select(USUARIO_SELECT)
      .eq('tipo_usuario', 'industria')
      .eq('industria_id', industria.id)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Usuário da indústria não encontrado.');
    }
    user = data as UsuarioRow;
  } else {
    const cnpj = normalizeCnpjDigits(identifier);
    if (cnpj.length !== 14) {
      throw new Error('Informe um CNPJ válido com 14 dígitos.');
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select(USUARIO_SELECT)
      .eq('tipo_usuario', 'cliente')
      .eq('login_cnpj', cnpj)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Usuário cliente não encontrado. Verifique o CNPJ.');
    }
    user = data as UsuarioRow;
  }

  const valid = await verifyPassword(senha, user.senha);
  if (!valid) {
    throw new Error('Senha incorreta.');
  }

  return finalizeLogin(user);
}
