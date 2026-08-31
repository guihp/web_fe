import { supabase } from '../lib/supabase';
import { formatLojaNome, type Loja } from './lojasService';

export const MAX_USUARIO_LOJAS = 7;

export type UsuarioLoja = Loja & {
  vinculo_id: number;
};

/** IDs das lojas vinculadas ao usuário. */
export async function fetchUsuarioLojaIds(usuarioId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('usuario_lojas')
    .select('loja_id')
    .eq('usuario_id', usuarioId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => Number(row.loja_id));
}

/** Lojas completas atribuídas ao usuário (com cidade/estado). */
export async function fetchUsuarioLojas(usuarioId: number): Promise<UsuarioLoja[]> {
  const { data, error } = await supabase
    .from('usuario_lojas')
    .select(
      'id, loja_id, lojas(id, Nome, codigo, cnpj, regional, regional_id, cidade, estado, endereco, status)',
    )
    .eq('usuario_id', usuarioId)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);

  const rows: UsuarioLoja[] = [];
  for (const row of data ?? []) {
    const lojaRaw = Array.isArray(row.lojas) ? row.lojas[0] : row.lojas;
    if (!lojaRaw) continue;
    rows.push({
      ...(lojaRaw as Loja),
      vinculo_id: Number(row.id),
    });
  }
  return rows;
}

/**
 * Substitui o conjunto de lojas do usuário.
 * Aceita no máximo {@link MAX_USUARIO_LOJAS} IDs.
 */
export async function setUsuarioLojas(
  usuarioId: number,
  lojaIds: number[],
): Promise<void> {
  const unique = [...new Set(lojaIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length > MAX_USUARIO_LOJAS) {
    throw new Error(`Selecione no máximo ${MAX_USUARIO_LOJAS} lojas.`);
  }

  const { error: delError } = await supabase
    .from('usuario_lojas')
    .delete()
    .eq('usuario_id', usuarioId);

  if (delError) throw new Error(delError.message);

  if (unique.length === 0) return;

  const { error: insError } = await supabase.from('usuario_lojas').insert(
    unique.map((loja_id) => ({ usuario_id: usuarioId, loja_id })),
  );

  if (insError) throw new Error(insError.message);
}

export function formatUsuarioLojaLabel(loja: Pick<Loja, 'Nome' | 'codigo' | 'cidade' | 'estado'>) {
  const base = formatLojaNome(loja);
  const cidade = (loja.cidade ?? '').trim();
  const estado = (loja.estado ?? '').trim().toUpperCase();
  if (cidade && estado) return `${base} · ${cidade}/${estado}`;
  if (cidade) return `${base} · ${cidade}`;
  if (estado) return `${base} · ${estado}`;
  return base;
}
