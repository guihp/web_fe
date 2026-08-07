import { supabase } from '../lib/supabase';
import { normalizeCpf } from '../lib/cpf';
import {
  defaultSecoesForCargo,
  encodeNivelAcesso,
  sanitizeSecoes,
} from '../data/portalModules';

async function hashPassword(password: string): Promise<string> {
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
  cpf: string;
  senha: string;
  cargo: string;
  endereco?: string;
  modulos?: string[];
  secoes?: string[];
};

export async function saveUser(data: SaveUserInput) {
  const { cidade, estado_id } = parseEndereco(data.endereco ?? '');
  const originalPassword = data.senha;
  const hashedPassword = await hashPassword(originalPassword);
  const secoes = sanitizeSecoes(
    data.cargo,
    data.secoes?.length
      ? data.secoes
      : data.modulos?.length
        ? data.modulos
        : defaultSecoesForCargo(data.cargo),
  );
  const nivel_acesso = encodeNivelAcesso(data.cargo, secoes);

  const { error } = await supabase.from('usuarios').insert([
    {
      nome: data.nome.trim(),
      email: data.email?.trim() || null,
      telefone: data.telefone.replace(/\D/g, ''),
      cpf: normalizeCpf(data.cpf),
      senha: hashedPassword,
      cargo: data.cargo,
      cidade,
      estado_id,
      status: true,
      nivel_acesso,
    },
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const webhookUrl = import.meta.env.EXPO_PUBLIC_WEBHOOK_SENHA;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.nome,
          telefone: data.telefone,
          cpf: data.cpf,
          senha: originalPassword,
          cargo: data.cargo,
          cidade,
          estado: estado_id,
          nivel_acesso,
          secoes,
        }),
      });
    } catch {
      // Webhook opcional — não bloqueia o cadastro
    }
  }

  return { success: true };
}

export type UpdateUserInput = {
  nome: string;
  email?: string;
  telefone: string;
  cpf: string;
  cargo: string;
  endereco?: string;
  senha?: string;
  modulos?: string[];
  secoes?: string[];
};

export async function updateUser(userId: number, data: UpdateUserInput) {
  const { cidade, estado_id } = parseEndereco(data.endereco ?? '');
  const secoes = sanitizeSecoes(
    data.cargo,
    data.secoes?.length
      ? data.secoes
      : data.modulos?.length
        ? data.modulos
        : defaultSecoesForCargo(data.cargo),
  );

  const payload: Record<string, string | null> = {
    nome: data.nome.trim(),
    email: data.email?.trim() || null,
    telefone: data.telefone.replace(/\D/g, ''),
    cpf: normalizeCpf(data.cpf),
    cargo: data.cargo,
    cidade,
    estado_id,
    nivel_acesso: encodeNivelAcesso(data.cargo, secoes),
  };

  if (data.senha?.trim()) {
    payload.senha = await hashPassword(data.senha.trim());
  }

  const { error } = await supabase.from('usuarios').update(payload).eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
