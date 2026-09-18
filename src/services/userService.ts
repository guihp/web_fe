import { supabase } from '../lib/supabase';
import { normalizeCpf } from '../lib/cpf';
import {
  defaultSecoesForCargo,
  encodeNivelAcesso,
  isCampoMerchCargo,
  sanitizeSecoes,
} from '../data/portalModules';
import {
  cargoForExternalTipo,
  externalSecoesForTipo,
  isExternalTipo,
  isTipoUsuario,
  normalizeClienteGrupo,
  normalizeCnpjDigits,
  type TipoUsuario,
} from '../utils/externalAccess';
import { setUsuarioLojas } from './usuarioLojasService';
import { saveHubPermissions } from './hubPermissionsService';

async function hashPassword(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Abra via HTTPS ou localhost. HTTP na rede local não permite gerar hash de senha.');
  }

  const saltArray = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const passwordWithSalt = password + salt;
  const data = new TextEncoder().encode(passwordWithSalt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${salt}$${hash}`;
}

function parseEndereco(endereco: string) {
  const parts = endereco
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const estadoPart = parts[parts.length - 1];
    const cidade = parts.slice(0, -1).join(', ');
    return {
      cidade: cidade || 'São Luís',
      estado_id: estadoPart.length <= 2 ? estadoPart.toUpperCase() : 'MA',
    };
  }

  return {
    cidade: endereco.trim() || 'São Luís',
    estado_id: 'MA',
  };
}

export type SaveUserInput = {
  nome: string;
  email?: string;
  telefone: string;
  cpf?: string;
  senha: string;
  cargo: string;
  endereco?: string;
  modulos?: string[];
  secoes?: string[];
  tipo_usuario?: TipoUsuario;
  industria_id?: number | null;
  cliente_grupo?: string | null;
  login_cnpj?: string | null;
  data_nascimento: string;
  /** Lojas do Promotor/Demonstradora (máx. 7). */
  lojaIds?: number[];
  is_super_admin?: boolean;
  hub_sistemas?: string[];
  hub_secoes?: string[];
};

function resolveTipo(data: { tipo_usuario?: TipoUsuario; cargo: string }): TipoUsuario {
  if (data.tipo_usuario && isTipoUsuario(data.tipo_usuario)) return data.tipo_usuario;
  return 'interno';
}

function buildNivelAcesso(tipo: TipoUsuario, cargo: string, secoes?: string[], modulos?: string[]) {
  if (isExternalTipo(tipo)) {
    return encodeNivelAcesso(cargo, externalSecoesForTipo(tipo));
  }
  const resolved = sanitizeSecoes(
    cargo,
    secoes?.length ? secoes : modulos?.length ? modulos : defaultSecoesForCargo(cargo),
  );
  return encodeNivelAcesso(cargo, resolved);
}

export async function saveUser(data: SaveUserInput) {
  const tipo = resolveTipo(data);
  const cargo = isExternalTipo(tipo) ? cargoForExternalTipo(tipo) : data.cargo;
  const { cidade, estado_id } = parseEndereco(data.endereco ?? '');
  const originalPassword = data.senha;
  const hashedPassword = await hashPassword(originalPassword);
  const nivel_acesso = buildNivelAcesso(tipo, cargo, data.secoes, data.modulos);

  if (tipo === 'interno' && !normalizeCpf(data.cpf ?? '')) {
    throw new Error('CPF é obrigatório para usuários internos.');
  }
  if (tipo === 'industria' && !data.industria_id) {
    throw new Error('Selecione a indústria vinculada.');
  }
  if (tipo === 'cliente') {
    const cnpj = normalizeCnpjDigits(data.login_cnpj ?? '');
    const grupo = normalizeClienteGrupo(data.cliente_grupo ?? data.nome);
    if (cnpj.length !== 14) throw new Error('CNPJ de login inválido (14 dígitos).');
    if (!grupo) throw new Error('Informe o grupo do cliente (ex.: MATEUS).');
  }

  const dataNascimento = (data.data_nascimento ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    throw new Error('Informe a data de nascimento.');
  }

  const payload: Record<string, unknown> = {
    nome: data.nome.trim(),
    email: data.email?.trim() || null,
    telefone: (data.telefone || '').replace(/\D/g, '') || null,
    cpf: tipo === 'interno' ? normalizeCpf(data.cpf ?? '') : null,
    senha: hashedPassword,
    cargo,
    cidade,
    estado_id,
    status: true,
    nivel_acesso,
    tipo_usuario: tipo,
    industria_id: tipo === 'industria' ? data.industria_id : null,
    cliente_grupo:
      tipo === 'cliente' ? normalizeClienteGrupo(data.cliente_grupo ?? data.nome) : null,
    login_cnpj: tipo === 'cliente' ? normalizeCnpjDigits(data.login_cnpj ?? '') : null,
    data_nascimento: dataNascimento,
    is_super_admin: tipo === 'interno' ? Boolean(data.is_super_admin) : false,
  };

  const { data: created, error } = await supabase
    .from('usuarios')
    .insert([payload])
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (isCampoMerchCargo(cargo) && created?.id) {
    await setUsuarioLojas(Number(created.id), data.lojaIds ?? []);
  }

  if (tipo === 'interno' && created?.id && data.hub_sistemas !== undefined) {
    await saveHubPermissions(
      Number(created.id),
      data.is_super_admin ? [] : (data.hub_sistemas ?? []),
      data.is_super_admin ? [] : (data.hub_secoes ?? []),
    );
  }

  const webhookUrl = import.meta.env.EXPO_PUBLIC_WEBHOOK_SENHA;
  if (webhookUrl && tipo === 'interno') {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.nome,
          telefone: data.telefone,
          cpf: data.cpf,
          senha: originalPassword,
          cargo,
          cidade,
          estado: estado_id,
          nivel_acesso,
        }),
      });
    } catch {
      // Webhook opcional — não bloqueia o cadastro
    }
  }

  return { success: true, id: Number(created.id) };
}

export type UpdateUserInput = {
  nome: string;
  email?: string;
  telefone: string;
  cpf?: string;
  cargo: string;
  endereco?: string;
  senha?: string;
  modulos?: string[];
  secoes?: string[];
  tipo_usuario?: TipoUsuario;
  industria_id?: number | null;
  cliente_grupo?: string | null;
  login_cnpj?: string | null;
  data_nascimento?: string | null;
  lojaIds?: number[];
  is_super_admin?: boolean;
  hub_sistemas?: string[];
  hub_secoes?: string[];
};

export async function updateUser(userId: number, data: UpdateUserInput) {
  const tipo = resolveTipo(data);
  const cargo = isExternalTipo(tipo) ? cargoForExternalTipo(tipo) : data.cargo;
  const { cidade, estado_id } = parseEndereco(data.endereco ?? '');
  const nivel_acesso = buildNivelAcesso(tipo, cargo, data.secoes, data.modulos);

  if (tipo === 'interno' && !normalizeCpf(data.cpf ?? '')) {
    throw new Error('CPF é obrigatório para usuários internos.');
  }
  if (tipo === 'industria' && !data.industria_id) {
    throw new Error('Selecione a indústria vinculada.');
  }
  if (tipo === 'cliente') {
    const cnpj = normalizeCnpjDigits(data.login_cnpj ?? '');
    const grupo = normalizeClienteGrupo(data.cliente_grupo ?? data.nome);
    if (cnpj.length !== 14) throw new Error('CNPJ de login inválido (14 dígitos).');
    if (!grupo) throw new Error('Informe o grupo do cliente (ex.: MATEUS).');
  }

  const dataNascimento = (data.data_nascimento ?? '').trim();
  if (dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    throw new Error('Data de nascimento inválida.');
  }

  const payload: Record<string, string | number | boolean | null> = {
    nome: data.nome.trim(),
    email: data.email?.trim() || null,
    telefone: (data.telefone || '').replace(/\D/g, '') || null,
    cpf: tipo === 'interno' ? normalizeCpf(data.cpf ?? '') : null,
    cargo,
    cidade,
    estado_id,
    nivel_acesso,
    tipo_usuario: tipo,
    industria_id: tipo === 'industria' ? (data.industria_id ?? null) : null,
    cliente_grupo:
      tipo === 'cliente' ? normalizeClienteGrupo(data.cliente_grupo ?? data.nome) : null,
    login_cnpj: tipo === 'cliente' ? normalizeCnpjDigits(data.login_cnpj ?? '') : null,
    data_nascimento: dataNascimento || null,
  };

  if (data.is_super_admin !== undefined) {
    payload.is_super_admin = tipo === 'interno' ? Boolean(data.is_super_admin) : false;
  }

  if (data.senha?.trim()) {
    payload.senha = await hashPassword(data.senha.trim());
  }

  const { error } = await supabase.from('usuarios').update(payload).eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  if (isCampoMerchCargo(cargo)) {
    await setUsuarioLojas(userId, data.lojaIds ?? []);
  } else if (data.lojaIds !== undefined) {
    await setUsuarioLojas(userId, []);
  }

  if (tipo === 'interno' && data.hub_sistemas !== undefined) {
    await saveHubPermissions(
      userId,
      data.is_super_admin ? [] : (data.hub_sistemas ?? []),
      data.is_super_admin ? [] : (data.hub_secoes ?? []),
    );
  }

  return { success: true };
}
