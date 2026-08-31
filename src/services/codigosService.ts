import { supabase } from '../lib/supabase';
import { toIndustriaPadrao } from '../utils/vendasDomain';

export type CodigoProduto = {
  codigo: string;
  produto: string;
  industria: string;
};

/** Busca produto e indústria pelo código reduzido em `public.codigos`. */
export async function fetchProdutoByCodigo(
  code: string,
): Promise<CodigoProduto | null> {
  const digits = code.replace(/\D/g, '').trim();
  if (!digits) return null;

  const asNum = Number(digits);
  if (!Number.isFinite(asNum)) return null;

  const { data, error } = await supabase
    .from('codigos')
    .select('codigo, produto, industria')
    .eq('codigo', asNum)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const produto = String(data.produto ?? '').trim();
  const industria = toIndustriaPadrao(String(data.industria ?? ''));
  if (!produto && !industria) return null;

  return {
    codigo: String(data.codigo ?? digits),
    produto,
    industria,
  };
}
