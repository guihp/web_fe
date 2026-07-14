import { supabase } from '../lib/supabase';
import type { MetaProjecao, Regiao } from '../utils/vendasDomain';
import { regiaoFromEstado } from '../utils/vendasDomain';

function mapRow(row: Record<string, unknown>): MetaProjecao {
  return row as unknown as MetaProjecao;
}

export async function fetchMetas(anoProjecao: number): Promise<MetaProjecao[]> {
  const { data, error } = await supabase
    .from('metas_projecao')
    .select('*')
    .eq('ano_projecao', anoProjecao)
    .order('industria');

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function upsertMeta(meta: Omit<MetaProjecao, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
  const payload = {
    ...meta,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('metas_projecao')
    .upsert(payload, { onConflict: 'industria,regiao,ano_projecao' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function deleteMeta(id: string): Promise<void> {
  const { error } = await supabase.from('metas_projecao').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchRealizado(
  ano: number,
  regiao?: Regiao,
  industria?: string,
  ateMesNumero?: number
): Promise<number> {
  let query = supabase.from('baseVendas').select('valor, estado, mes, industria, ano').eq('ano', String(ano));

  if (industria) {
    query = query.eq('industria', industria);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const mesesOrdem = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
  ];

  return (data ?? []).reduce((acc, row) => {
    if (regiao && regiaoFromEstado(row.estado ?? '') !== regiao) return acc;
    if (ateMesNumero) {
      const idx = mesesOrdem.indexOf((row.mes ?? '').toUpperCase());
      if (idx >= ateMesNumero) return acc;
    }
    return acc + Number(row.valor);
  }, 0);
}

export function calcMetaFromCrescimento(realizado: number, crescimentoPercentual: number) {
  const projecaoAnual = realizado * (1 + crescimentoPercentual / 100);
  return {
    projecaoAnual,
    metaMensal: projecaoAnual / 12,
  };
}

export function calcMetaValues(meta: MetaProjecao, realizadoAnoBase: number) {
  if (meta.modo_manual) {
    if (meta.meta_mensal_manual) {
      return {
        projecaoAnual: meta.meta_mensal_manual * 12,
        metaMensal: meta.meta_mensal_manual,
      };
    }
    if (meta.meta_anual_manual) {
      return {
        projecaoAnual: meta.meta_anual_manual,
        metaMensal: meta.meta_anual_manual / 12,
      };
    }
  }
  return calcMetaFromCrescimento(realizadoAnoBase, meta.crescimento_percentual ?? 0);
}
