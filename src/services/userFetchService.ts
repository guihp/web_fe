import { supabase } from '../lib/supabase';
import type { Usuario } from '../utils/format';

export async function fetchUsers(filter: { nome?: string } = {}): Promise<Usuario[]> {
  let query = supabase.from('usuarios').select('*').eq('status', true);

  if (filter.nome) {
    query = query.ilike('nome', `%${filter.nome}%`);
  }

  const { data, error } = await query.order('id', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Usuario[];
}

export async function updateUserStatus(userId: number, status: boolean) {
  const { error } = await supabase.from('usuarios').update({ status }).eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function updateUserDetails(userId: number, userDetails: Partial<Usuario>) {
  const { error } = await supabase.from('usuarios').update(userDetails).eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
