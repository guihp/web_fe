import { supabase } from '../lib/supabase';
import {
  computeStats,
  isAtividadeAberta,
  normalizeStatus,
  overlapsPeriod,
  todayISO,
} from '../utils/atividadesDomain';
import type { Usuario } from '../utils/format';

export type Atividade = {
  id: number;
  tipo: string;
  usuario_responsavel: number;
  loja: string;
  industria: string;
  data_inicio: string;
  data_fim: string;
  status?: string;
  sincronizado: boolean;
  criado_por: number;
};

export type AtividadeRow = Atividade & {
  responsavelNome: string;
  criadorNome: string;
};

export type AtividadeStats = {
  total: number;
  pendentes: number;
  concluidas: number;
  justificadas: number;
  naoSincronizadas: number;
};

export type AtividadeFilters = {
  tab: 'acompanhamento' | 'historico';
  search?: string;
  status?: string;
  tipo?: string;
  promotorId?: number;
  dataInicio?: string;
  dataFim?: string;
};

export type AtividadeUpdateData = {
  usuario_responsavel: number;
  data_inicio: string;
  data_fim: string;
};

export type Loja = {
  id: number;
  Nome: string;
};

export type { Industria } from './industriaService';
export { fetchIndustrias } from './industriaService';

export type AtividadeFormData = {
  tipo: string;
  loja: string;
  industrias: string[];
  usuarioId: number;
  usuarioNome: string;
  dataInicio: string;
  dataFim: string;
};

async function enrichAtividades(rows: Atividade[]): Promise<AtividadeRow[]> {
  if (rows.length === 0) return [];

  const userIds = new Set<number>();
  for (const row of rows) {
    if (row.usuario_responsavel != null) userIds.add(row.usuario_responsavel);
    if (row.criado_por != null) userIds.add(row.criado_por);
  }

  if (userIds.size === 0) {
    return rows.map((row) => ({
      ...row,
      responsavelNome: '—',
      criadorNome: '—',
    }));
  }

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, nome')
    .in('id', Array.from(userIds));

  if (error) throw new Error(error.message);

  const nameById = new Map<number, string>();
  for (const u of usuarios ?? []) {
    nameById.set(u.id, u.nome);
  }

  return rows.map((row) => ({
    ...row,
    responsavelNome: nameById.get(row.usuario_responsavel) ?? `ID ${row.usuario_responsavel}`,
    criadorNome: nameById.get(row.criado_por) ?? `ID ${row.criado_por}`,
  }));
}

function applyClientFilters(rows: AtividadeRow[], filters: AtividadeFilters): AtividadeRow[] {
  let result = [...rows];

  if (filters.tab === 'acompanhamento') {
    result = result.filter(isAtividadeAberta);
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter((r) => {
      const loja = (r.loja ?? '').toLowerCase();
      const industria = (r.industria ?? '').toLowerCase();
      const responsavel = (r.responsavelNome ?? '').toLowerCase();
      const tipo = (r.tipo ?? '').toLowerCase();
      return loja.includes(q) || industria.includes(q) || responsavel.includes(q) || tipo.includes(q);
    });
  }

  if (filters.status && filters.status !== 'Todos') {
    result = result.filter((r) => {
      const n = normalizeStatus(r.status);
      if (filters.status === 'Pendente') return n === 'pendente';
      if (filters.status === 'Completo') return n === 'completo';
      if (filters.status === 'Justificada') return n === 'justificada';
      if (filters.status === 'Cancelado') return n === 'cancelado';
      return true;
    });
  }

  if (filters.tipo && filters.tipo !== 'Todos') {
    result = result.filter((r) => r.tipo === filters.tipo);
  }

  if (filters.promotorId) {
    result = result.filter((r) => r.usuario_responsavel === filters.promotorId);
  }

  if (filters.dataInicio || filters.dataFim) {
    result = result.filter((r) =>
      overlapsPeriod(r.data_inicio, r.data_fim, filters.dataInicio, filters.dataFim)
    );
  }

  result.sort((a, b) => {
    const aFim = a.data_fim ?? '';
    const bFim = b.data_fim ?? '';
    const dateCmp = bFim.localeCompare(aFim);
    if (dateCmp !== 0) return dateCmp;
    return b.id - a.id;
  });

  return result;
}

export async function fetchAtividades(filters: AtividadeFilters): Promise<AtividadeRow[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*')
    .order('id', { ascending: false });

  if (error) throw new Error(error.message);

  const enriched = await enrichAtividades((data ?? []) as Atividade[]);
  return applyClientFilters(enriched, filters);
}

export async function fetchAllAtividades(): Promise<AtividadeRow[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*')
    .order('id', { ascending: false });

  if (error) throw new Error(error.message);

  return enrichAtividades((data ?? []) as Atividade[]);
}

export function fetchAtividadeStats(rows: AtividadeRow[]): AtividadeStats {
  return computeStats(rows);
}

export async function fetchLojas(): Promise<Loja[]> {
  const { data, error } = await supabase.from('lojas').select('id, Nome').order('Nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Loja[];
}

export async function fetchPromotores(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('status', true)
    .in('cargo', ['Promotor', 'Degustação'])
    .order('nome');

  if (error) throw new Error(error.message);
  return (data ?? []) as Usuario[];
}

export async function addAtividade(data: AtividadeFormData, criadoPor: number) {
  if (data.industrias.length === 0) {
    throw new Error('Selecione ao menos uma indústria.');
  }

  const rows = data.industrias.map((industria) => ({
    tipo: data.tipo,
    usuario_responsavel: data.usuarioId,
    loja: data.loja,
    industria,
    data_inicio: data.dataInicio,
    data_fim: data.dataFim,
    status: 'Pendente',
    sincronizado: true,
    criado_por: criadoPor,
  }));

  const { error } = await supabase.from('atividades').insert(rows);
  if (error) throw new Error(error.message);

  return rows.length;
}

export async function updateAtividade(id: number, data: AtividadeUpdateData) {
  const { error } = await supabase
    .from('atividades')
    .update({
      usuario_responsavel: data.usuario_responsavel,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function cancelAtividade(id: number) {
  const { error } = await supabase
    .from('atividades')
    .update({ status: 'Cancelado' })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteAtividade(id: number) {
  const { error } = await supabase.from('atividades').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export type AtividadeDia = {
  id: number;
  atividade_id: number;
  data: string;
  status: string;
  justificativa_motivo?: string | null;
  justificativa_observacao?: string | null;
  foto_antes_url?: string | null;
  foto_depois_url?: string | null;
  foto_justificativa_url?: string | null;
};

export async function fetchAtividadeDias(atividadeId: number): Promise<AtividadeDia[]> {
  const { data, error } = await supabase
    .from('atividade_dia')
    .select('*')
    .eq('atividade_id', atividadeId)
    .order('data', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AtividadeDia[];
}

export async function fetchGerenteId(): Promise<number> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('cargo', 'Gerente')
    .eq('status', true)
    .limit(1)
    .single();

  if (error || !data) return 1;
  return data.id;
}

export function atividadeCoversDate(atividade: Atividade, dateISO: string): boolean {
  if (!atividade.data_inicio || !atividade.data_fim) return false;
  return atividade.data_inicio <= dateISO && atividade.data_fim >= dateISO;
}

export function atividadesForDate(rows: AtividadeRow[], dateISO: string): AtividadeRow[] {
  return rows.filter((r) => atividadeCoversDate(r, dateISO));
}

export { todayISO };
