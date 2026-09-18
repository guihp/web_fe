import { supabase } from '../lib/supabase';
import type { HubSistemaId } from '../data/hubPermissions';

export type HubSistemaMetricsResult = {
  sistema: HubSistemaId;
  ok: boolean;
  error?: string;
  metrics?: Record<string, unknown>;
};

export type HubMetricsResponse = {
  generated_at: string;
  is_super_admin: boolean;
  sistemas: HubSistemaMetricsResult[];
};

export async function fetchHubMetrics(usuarioId: number): Promise<HubMetricsResponse> {
  const { data, error } = await supabase.functions.invoke('hub-metrics', {
    body: { usuario_id: usuarioId },
    headers: {
      'x-usuario-id': String(usuarioId),
    },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar métricas do Grupo Fé.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Resposta inválida da função hub-metrics.');
  }

  if ('error' in data && typeof (data as { error: unknown }).error === 'string') {
    throw new Error((data as { error: string }).error);
  }

  return data as HubMetricsResponse;
}
