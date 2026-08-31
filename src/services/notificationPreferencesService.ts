import { supabase } from '../lib/supabase';
import { isExternalTipo } from '../utils/externalAccess';

export type NotificationPreferences = {
  notify_venda: boolean;
  notify_kanban_pedido: boolean;
  notify_kanban_financeiro: boolean;
  notify_aviso: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  notify_venda: true,
  notify_kanban_pedido: true,
  notify_kanban_financeiro: true,
  notify_aviso: true,
};

type PrefsRow = NotificationPreferences & { usuario_id: number };

function rowToPrefs(row: PrefsRow | null): NotificationPreferences {
  if (!row) return { ...DEFAULT_PREFS };
  return {
    notify_venda: row.notify_venda,
    notify_kanban_pedido: row.notify_kanban_pedido,
    notify_kanban_financeiro: row.notify_kanban_financeiro,
    notify_aviso: row.notify_aviso !== false,
  };
}

export async function fetchNotificationPreferences(
  usuarioId: number,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('notify_venda, notify_kanban_pedido, notify_kanban_financeiro, notify_aviso')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error) {
    console.warn('[prefs] Falha ao carregar preferências:', error.message);
    return { ...DEFAULT_PREFS };
  }

  return rowToPrefs(data as PrefsRow | null);
}

export async function saveNotificationPreferences(
  usuarioId: number,
  prefs: NotificationPreferences,
): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      usuario_id: usuarioId,
      notify_venda: prefs.notify_venda,
      notify_kanban_pedido: prefs.notify_kanban_pedido,
      notify_kanban_financeiro: prefs.notify_kanban_financeiro,
      notify_aviso: prefs.notify_aviso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'usuario_id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function enableAllNotificationPreferences(
  usuarioId: number,
  tipoUsuario?: string | null,
): Promise<void> {
  const external = isExternalTipo(tipoUsuario);
  const prefs: NotificationPreferences = {
    notify_venda: !external,
    notify_kanban_pedido: true,
    notify_kanban_financeiro: !external,
    notify_aviso: !external,
  };
  await saveNotificationPreferences(usuarioId, prefs);
}
