import { supabase } from '../lib/supabase';
import type { AuthUser } from './authService';

const BUCKET = 'perfil-fotos';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function getProfileAvatarUrl(user: Pick<AuthUser, 'nome' | 'foto_perfil_url'> | null): string {
  if (user?.foto_perfil_url) return user.foto_perfil_url;
  const seed = encodeURIComponent(user?.nome ?? 'user');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

function extensionForFile(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadProfilePhoto(userId: number, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  const ext = extensionForFile(file);
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ foto_perfil_url: publicUrl })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);

  return publicUrl;
}

export async function removeProfilePhoto(userId: number): Promise<void> {
  const { error } = await supabase
    .from('usuarios')
    .update({ foto_perfil_url: null })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}
