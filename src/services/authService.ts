import { supabase } from '../lib/supabase';
import { normalizeCpf } from '../lib/cpf';
import {
  canManageUsers,
  parseModulosFromNivelAcesso,
  type PortalModuleId,
} from '../data/portalModules';

export type AuthUser = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string;
  cpf: string;
  foto_perfil_url: string | null;
  modulos_acesso: PortalModuleId[];
};

const WEB_ALLOWED_CARGOS = ['Gerente', 'Dono', 'CEO', 'Presidente'] as const;

export function isWebAdminCargo(cargo: string): boolean {
  const key = cargo.trim().toLowerCase();
  return WEB_ALLOWED_CARGOS.some((c) => c.toLowerCase() === key) || canManageUsers(cargo);
}

export { canManageUsers };

async function verifyPassword(senha: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;

  const data = new TextEncoder().encode(senha + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const newHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return newHash === hash;
}

export async function loginWithCpf(cpf: string, senha: string): Promise<AuthUser> {
  const normalizedCpf = normalizeCpf(cpf);

  if (normalizedCpf.length !== 11) {
    throw new Error('Informe um CPF válido com 11 dígitos.');
  }

  const { data: user, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, telefone, cargo, cpf, senha, status, foto_perfil_url, nivel_acesso')
    .eq('cpf', normalizedCpf)
    .maybeSingle();

  if (error || !user) {
    throw new Error('Usuário não encontrado. Verifique o CPF.');
  }

  if (user.status === false) {
    throw new Error('Usuário inativo. Contacte o administrador.');
  }

  if (!isWebAdminCargo(user.cargo)) {
    throw new Error('Acesso restrito ao painel web. Promotores e degustação devem usar o aplicativo mobile.');
  }

  const valid = await verifyPassword(senha, user.senha);
  if (!valid) {
    throw new Error('Senha incorreta.');
  }

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    telefone: user.telefone,
    cargo: user.cargo,
    cpf: user.cpf,
    foto_perfil_url: user.foto_perfil_url ?? null,
    modulos_acesso: parseModulosFromNivelAcesso(user.nivel_acesso, user.cargo),
  };
}
