import { supabase } from '../lib/supabase';
import {
  HUB_SISTEMA_IDS,
  defaultHubSecoesForSistemas,
  type HubSistemaId,
} from '../data/hubPermissions';

export type HubPermissions = {
  sistemas: HubSistemaId[];
  secoes: string[];
};

export async function fetchHubPermissions(usuarioId: number): Promise<HubPermissions> {
  const [sistemasRes, secoesRes] = await Promise.all([
    supabase.from('hub_usuario_sistemas').select('sistema_id').eq('usuario_id', usuarioId),
    supabase.from('hub_usuario_secoes').select('secao_id').eq('usuario_id', usuarioId),
  ]);

  if (sistemasRes.error) throw new Error(sistemasRes.error.message);
  if (secoesRes.error) throw new Error(secoesRes.error.message);

  const sistemas = (sistemasRes.data ?? [])
    .map((row) => String((row as { sistema_id: string }).sistema_id))
    .filter((id): id is HubSistemaId => (HUB_SISTEMA_IDS as readonly string[]).includes(id));

  const secoes = (secoesRes.data ?? []).map((row) =>
    String((row as { secao_id: string }).secao_id),
  );

  return { sistemas, secoes };
}

export async function saveHubPermissions(
  usuarioId: number,
  sistemas: string[],
  secoes: string[],
): Promise<void> {
  const validSistemas = sistemas.filter((id) =>
    (HUB_SISTEMA_IDS as readonly string[]).includes(id),
  ) as HubSistemaId[];

  const allowedSecoes = new Set(defaultHubSecoesForSistemas(validSistemas));
  const validSecoes = secoes.filter((id) => allowedSecoes.has(id));

  const { error: delSistemasError } = await supabase
    .from('hub_usuario_sistemas')
    .delete()
    .eq('usuario_id', usuarioId);
  if (delSistemasError) throw new Error(delSistemasError.message);

  const { error: delSecoesError } = await supabase
    .from('hub_usuario_secoes')
    .delete()
    .eq('usuario_id', usuarioId);
  if (delSecoesError) throw new Error(delSecoesError.message);

  if (validSistemas.length > 0) {
    const { error } = await supabase.from('hub_usuario_sistemas').insert(
      validSistemas.map((sistema_id) => ({ usuario_id: usuarioId, sistema_id })),
    );
    if (error) throw new Error(error.message);
  }

  if (validSecoes.length > 0) {
    const { error } = await supabase.from('hub_usuario_secoes').insert(
      validSecoes.map((secao_id) => ({ usuario_id: usuarioId, secao_id })),
    );
    if (error) throw new Error(error.message);
  }
}
