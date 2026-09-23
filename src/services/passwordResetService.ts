import { supabase } from '../lib/supabase';
import type { LoginTipo } from './authService';

export async function requestPasswordReset(input: {
  tipo: LoginTipo;
  identifier: string;
  redirectTo?: string;
}): Promise<{ message: string }> {
  const redirectTo =
    input.redirectTo?.trim() ||
    `${window.location.origin}/redefinir-senha`;

  const { data, error } = await supabase.functions.invoke('request-password-reset', {
    body: {
      tipo: input.tipo,
      identifier: input.identifier.trim(),
      redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível solicitar a redefinição.');
  }

  const message =
    (data as { message?: string } | null)?.message ??
    'Se houver e-mail cadastrado para este acesso, enviamos um link para redefinir a senha.';

  return { message };
}

export async function syncPasswordAfterReset(password: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('Sessão de recuperação inválida. Abra o link do e-mail novamente.');
  }

  const { data, error } = await supabase.functions.invoke('sync-password-after-reset', {
    body: { password },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao salvar a nova senha no app.');
  }

  const errMsg = (data as { error?: string } | null)?.error;
  if (errMsg) {
    throw new Error(errMsg);
  }
}
