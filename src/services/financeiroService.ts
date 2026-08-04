import { supabase } from '../lib/supabase';
import type {
  ComparativoMes,
  Contrato,
  ContratoAnexo,
  ContratoFilial,
  ContratoStatus,
  HistoricoEvento,
  KanbanTask,
  ReceitaIndustria,
  ReceitaMes,
} from '../data/financeiroData';
import { valorTotalFilial } from '../data/financeiroData';

const BUCKET = 'contrato-anexos';
const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export type ContratoCreateInput = {
  titulo: string;
  descricao?: string;
  tipo: string;
  industria: string;
  status?: ContratoStatus;
  dataFechamento?: string | null;
  dataInicio?: string | null;
  dataTermino?: string | null;
  diaInicioFat?: number;
  diaFimFat?: number;
  valorMensal?: number;
  criadoPor?: number | null;
};

export type ContratoUpdateInput = Partial<{
  titulo: string;
  descricao: string;
  tipo: string;
  industria: string;
  status: ContratoStatus;
  dataFechamento: string | null;
  dataInicio: string | null;
  dataTermino: string | null;
  diaInicioFat: number;
  diaFimFat: number;
  valorMensal: number;
}>;

export type FinanceiroKpis = {
  contratosAtivos: number;
  totalContratos: number;
  totalComissoesMes: number;
  totalAFaturar: number;
  receitaMensalTotal: number;
  receitaMesAtual: number;
  vsMesAnterior: number | null;
  industriasAtivas: number;
};

type ContratoRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  industria: string;
  status: ContratoStatus;
  data_fechamento: string | null;
  data_inicio: string | null;
  data_termino: string | null;
  dia_inicio_faturamento: number | null;
  dia_fim_faturamento: number | null;
  valor_mensal: number | string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type FilialRow = {
  id: string;
  contrato_id: string;
  loja_id: number | null;
  codigo: number | null;
  nome: string;
  cidade: string | null;
  estado: string | null;
  regional: string | null;
  valor_hora: number | string;
  horas: number | string;
  visitas_sem: number | string;
  visitas_mes: number | string;
  valor_total: number | string;
};

type AnexoRow = {
  id: string;
  contrato_id: string;
  nome: string;
  storage_path: string | null;
  url: string | null;
  tamanho_bytes: number | null;
  created_at: string;
};

type HistoricoRow = {
  id: string;
  contrato_id: string;
  tipo: HistoricoEvento['tipo'] | 'criacao' | 'edicao';
  titulo: string;
  detalhe: string | null;
  created_at: string;
};

type FaturamentoRow = {
  id: string;
  contrato_id: string;
  periodo: string;
  ano: number;
  mes: number;
  coluna: KanbanTask['coluna'];
  valor: number | string;
  tag: string | null;
  contratos?: { titulo: string; industria: string; tipo: string; deleted_at: string | null } | null;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function formatBrDate(iso: string | null | undefined) {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.slice(0, 10).split('-');
  if (!yyyy || !mm || !dd) return '';
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function mapContrato(row: ContratoRow): Contrato {
  return {
    id: row.id,
    titulo: row.titulo,
    subtitulo: row.descricao || row.titulo,
    industria: row.industria,
    fechamento: formatBrDate(row.data_fechamento),
    valorMensal: toNumber(row.valor_mensal),
    status: row.status,
    tipo: row.tipo,
  };
}

function mapFilial(row: FilialRow): ContratoFilial {
  return {
    id: row.id,
    codigo: row.codigo ?? 0,
    nome: row.nome,
    cidade: row.cidade ?? '',
    estado: row.estado ?? '',
    regional: row.regional ?? '',
    valorHora: toNumber(row.valor_hora),
    horas: toNumber(row.horas),
    visitasSem: toNumber(row.visitas_sem),
    visitasMes: toNumber(row.visitas_mes),
  };
}

function mapAnexo(row: AnexoRow): ContratoAnexo {
  return {
    id: row.id,
    nome: row.nome,
    tamanho: formatBytes(toNumber(row.tamanho_bytes)),
    data: formatDateTime(row.created_at),
  };
}

function mapHistorico(row: HistoricoRow): HistoricoEvento {
  const tipo =
    row.tipo === 'criacao' || row.tipo === 'edicao'
      ? 'status'
      : (row.tipo as HistoricoEvento['tipo']);
  return {
    id: row.id,
    tipo,
    titulo: row.titulo,
    detalhe: row.detalhe ?? '',
    data: formatDateTime(row.created_at),
  };
}

function mapKanban(row: FaturamentoRow): KanbanTask {
  return {
    id: row.id,
    periodo: row.periodo,
    tag: row.tag || row.contratos?.tipo || '',
    titulo: row.contratos?.titulo || 'Contrato',
    industria: row.contratos?.industria || '',
    valor: toNumber(row.valor),
    coluna: row.coluna,
  };
}

function currentPeriod() {
  const now = new Date();
  return {
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
    periodo: `${MESES_CURTO[now.getMonth()]}/${now.getFullYear()}`,
  };
}

async function addHistorico(
  contratoId: string,
  tipo: string,
  titulo: string,
  detalhe?: string
) {
  const { error } = await supabase.from('contrato_historico').insert({
    contrato_id: contratoId,
    tipo,
    titulo,
    detalhe: detalhe ?? null,
  });
  if (error) throw new Error(error.message);
}

async function recalcContratoValor(contratoId: string) {
  const { data, error } = await supabase
    .from('contrato_filiais')
    .select('valor_total')
    .eq('contrato_id', contratoId);
  if (error) throw new Error(error.message);

  const total = (data ?? []).reduce((acc, row) => acc + toNumber(row.valor_total), 0);
  const { error: updateError } = await supabase
    .from('contratos')
    .update({ valor_mensal: total, updated_at: new Date().toISOString() })
    .eq('id', contratoId);
  if (updateError) throw new Error(updateError.message);

  const { ano, mes } = currentPeriod();
  await supabase
    .from('contrato_faturamento')
    .update({ valor: total, updated_at: new Date().toISOString() })
    .eq('contrato_id', contratoId)
    .eq('ano', ano)
    .eq('mes', mes);

  return total;
}

export async function fetchContratos(): Promise<Contrato[]> {
  const { data, error } = await supabase
    .from('contratos')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ContratoRow[]).map(mapContrato);
}

export async function createContrato(input: ContratoCreateInput): Promise<Contrato> {
  const { ano, mes, periodo } = currentPeriod();

  const { data, error } = await supabase
    .from('contratos')
    .insert({
      titulo: input.titulo,
      descricao: input.descricao || null,
      tipo: input.tipo,
      industria: input.industria,
      status: input.status ?? 'Rascunho',
      data_fechamento: input.dataFechamento || null,
      data_inicio: input.dataInicio || null,
      data_termino: input.dataTermino || null,
      dia_inicio_faturamento: input.diaInicioFat ?? 1,
      dia_fim_faturamento: input.diaFimFat ?? 28,
      valor_mensal: input.valorMensal ?? 0,
      criado_por: input.criadoPor ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const row = data as ContratoRow;

  const { error: fatError } = await supabase.from('contrato_faturamento').insert({
    contrato_id: row.id,
    periodo,
    ano,
    mes,
    coluna: 'pendente',
    valor: toNumber(row.valor_mensal),
    tag: row.tipo,
  });
  if (fatError) throw new Error(fatError.message);

  await addHistorico(row.id, 'criacao', 'Contrato criado', `${row.tipo} • ${row.industria}`);

  return mapContrato(row);
}

export async function updateContrato(id: string, patch: ContratoUpdateInput): Promise<Contrato> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.titulo !== undefined) payload.titulo = patch.titulo;
  if (patch.descricao !== undefined) payload.descricao = patch.descricao;
  if (patch.tipo !== undefined) payload.tipo = patch.tipo;
  if (patch.industria !== undefined) payload.industria = patch.industria;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.dataFechamento !== undefined) payload.data_fechamento = patch.dataFechamento;
  if (patch.dataInicio !== undefined) payload.data_inicio = patch.dataInicio;
  if (patch.dataTermino !== undefined) payload.data_termino = patch.dataTermino;
  if (patch.diaInicioFat !== undefined) payload.dia_inicio_faturamento = patch.diaInicioFat;
  if (patch.diaFimFat !== undefined) payload.dia_fim_faturamento = patch.diaFimFat;
  if (patch.valorMensal !== undefined) payload.valor_mensal = patch.valorMensal;

  const { data, error } = await supabase
    .from('contratos')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await addHistorico(id, 'edicao', 'Contrato atualizado', patch.titulo ?? patch.status ?? '');

  return mapContrato(data as ContratoRow);
}

export async function deleteContrato(id: string): Promise<void> {
  const { error } = await supabase
    .from('contratos')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateContratoStatus(id: string, status: ContratoStatus, previous: ContratoStatus) {
  const { data, error } = await supabase
    .from('contratos')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await addHistorico(
    id,
    'status',
    `Status alterado de ${previous.toLowerCase()} para ${status.toLowerCase()}`,
    `${previous.toLowerCase()} → ${status.toLowerCase()}`
  );

  return mapContrato(data as ContratoRow);
}

export async function fetchContratoFiliais(contratoId: string): Promise<ContratoFilial[]> {
  const { data, error } = await supabase
    .from('contrato_filiais')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilialRow[]).map(mapFilial);
}

export async function addContratoFiliais(
  contratoId: string,
  filiais: Array<{
    lojaId?: number | null;
    codigo?: number;
    nome: string;
    cidade?: string;
    estado?: string;
    regional?: string;
    valorHora: number;
    horas: number;
    visitasSem: number;
  }>
): Promise<ContratoFilial[]> {
  if (filiais.length === 0) return [];

  const rows = filiais.map((f) => {
    const visitasMes = f.visitasSem * 4;
    const valorTotal = valorTotalFilial({
      valorHora: f.valorHora,
      horas: f.horas,
      visitasMes,
    });
    return {
      contrato_id: contratoId,
      loja_id: f.lojaId ?? null,
      codigo: f.codigo ?? null,
      nome: f.nome,
      cidade: f.cidade ?? null,
      estado: f.estado ?? null,
      regional: f.regional ?? null,
      valor_hora: f.valorHora,
      horas: f.horas,
      visitas_sem: f.visitasSem,
      visitas_mes: visitasMes,
      valor_total: valorTotal,
    };
  });

  const { data, error } = await supabase.from('contrato_filiais').insert(rows).select('*');
  if (error) throw new Error(error.message);

  const prev = await supabase.from('contratos').select('valor_mensal').eq('id', contratoId).single();
  const oldValor = toNumber(prev.data?.valor_mensal);
  const newValor = await recalcContratoValor(contratoId);

  await addHistorico(
    contratoId,
    'filial',
    `${rows.length} filial(is) adicionada(s)`,
    rows.map((r) => r.codigo ?? r.nome).join(', ')
  );
  await addHistorico(contratoId, 'valor', 'Valor total ajustado', `${Math.round(oldValor)} → ${Math.round(newValor)}`);

  return ((data ?? []) as FilialRow[]).map(mapFilial);
}

export async function removeContratoFilial(contratoId: string, filialId: string, label: string) {
  const prev = await supabase.from('contratos').select('valor_mensal').eq('id', contratoId).single();
  const oldValor = toNumber(prev.data?.valor_mensal);

  const { error } = await supabase.from('contrato_filiais').delete().eq('id', filialId);
  if (error) throw new Error(error.message);

  const newValor = await recalcContratoValor(contratoId);
  await addHistorico(contratoId, 'filial', 'Filial removida do contrato', label);
  await addHistorico(contratoId, 'valor', 'Valor total ajustado', `${Math.round(oldValor)} → ${Math.round(newValor)}`);
}

export async function fetchContratoAnexos(contratoId: string): Promise<ContratoAnexo[]> {
  const { data, error } = await supabase
    .from('contrato_anexos')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AnexoRow[]).map(mapAnexo);
}

export async function uploadContratoAnexo(contratoId: string, file: File): Promise<ContratoAnexo> {
  const safeName = file.name.replace(/\s+/g, '_');
  const path = `${contratoId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/pdf',
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from('contrato_anexos')
    .insert({
      contrato_id: contratoId,
      nome: file.name,
      storage_path: path,
      url: publicData.publicUrl,
      tamanho_bytes: file.size,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await addHistorico(contratoId, 'anexo', 'PDF anexado', file.name);
  return mapAnexo(data as AnexoRow);
}

export async function deleteContratoAnexo(contratoId: string, anexoId: string) {
  const { data, error } = await supabase
    .from('contrato_anexos')
    .select('*')
    .eq('id', anexoId)
    .single();
  if (error) throw new Error(error.message);

  const row = data as AnexoRow;
  if (row.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }

  const { error: delError } = await supabase.from('contrato_anexos').delete().eq('id', anexoId);
  if (delError) throw new Error(delError.message);

  await addHistorico(contratoId, 'anexo', 'Anexo removido', row.nome);
}

export async function fetchContratoHistorico(contratoId: string): Promise<HistoricoEvento[]> {
  const { data, error } = await supabase
    .from('contrato_historico')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as HistoricoRow[]).map(mapHistorico);
}

export async function fetchKanbanTasks(): Promise<KanbanTask[]> {
  const { ano, mes } = currentPeriod();
  const { data, error } = await supabase
    .from('contrato_faturamento')
    .select('*, contratos(titulo, industria, tipo, deleted_at)')
    .eq('ano', ano)
    .eq('mes', mes)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as FaturamentoRow[])
    .filter((row) => !row.contratos?.deleted_at)
    .map(mapKanban);
}

export async function moveKanbanTask(taskId: string, coluna: KanbanTask['coluna']) {
  const { error } = await supabase
    .from('contrato_faturamento')
    .update({ coluna, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw new Error(error.message);
}

export async function advanceKanbanTask(taskId: string) {
  const { data, error } = await supabase
    .from('contrato_faturamento')
    .select('coluna')
    .eq('id', taskId)
    .single();
  if (error) throw new Error(error.message);

  const atual = data.coluna as KanbanTask['coluna'];
  const next = atual === 'pendente' ? 'aguardando' : atual === 'aguardando' ? 'faturado' : 'faturado';
  await moveKanbanTask(taskId, next);
}

export async function generateKanbanMesAtual(): Promise<number> {
  const { ano, mes, periodo } = currentPeriod();
  const { data: contratos, error } = await supabase
    .from('contratos')
    .select('id, tipo, valor_mensal, status')
    .is('deleted_at', null)
    .eq('status', 'Ativo');
  if (error) throw new Error(error.message);

  let created = 0;
  for (const c of contratos ?? []) {
    const { error: upsertError } = await supabase.from('contrato_faturamento').upsert(
      {
        contrato_id: c.id,
        periodo,
        ano,
        mes,
        coluna: 'pendente',
        valor: toNumber(c.valor_mensal),
        tag: c.tipo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'contrato_id,ano,mes' }
    );
    if (!upsertError) created += 1;
  }
  return created;
}

export async function fetchFinanceiroKpis(): Promise<FinanceiroKpis> {
  const [{ data: contratos, error }, tasks, comissoes] = await Promise.all([
    supabase.from('contratos').select('status, industria, valor_mensal').is('deleted_at', null),
    fetchKanbanTasks(),
    fetchComissoesMesAtual(),
  ]);
  if (error) throw new Error(error.message);

  const rows = contratos ?? [];
  const ativos = rows.filter((c) => c.status === 'Ativo');
  const receitaMensalTotal = ativos.reduce((acc, c) => acc + toNumber(c.valor_mensal), 0);
  const totalAFaturar = tasks
    .filter((t) => t.coluna === 'pendente' || t.coluna === 'aguardando')
    .reduce((acc, t) => acc + t.valor, 0);

  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const prev = new Date(anoAtual, mesAtual - 1, 1);
  const receitaAnterior = await fetchReceitaMes(prev.getFullYear(), prev.getMonth() + 1);
  const vs =
    receitaAnterior > 0 ? ((receitaMensalTotal - receitaAnterior) / receitaAnterior) * 100 : null;

  return {
    contratosAtivos: ativos.length,
    totalContratos: rows.length,
    totalComissoesMes: comissoes,
    totalAFaturar,
    receitaMensalTotal,
    receitaMesAtual: receitaMensalTotal,
    vsMesAnterior: vs,
    industriasAtivas: new Set(ativos.map((c) => c.industria).filter(Boolean)).size,
  };
}

async function fetchComissoesMesAtual() {
  const agora = new Date();
  const mesNome = MESES_LONGO[agora.getMonth()];
  const ano = String(agora.getFullYear());
  const { data, error } = await supabase
    .from('comissao_industria')
    .select('valor_comissao, mes, ano')
    .eq('ano', ano);
  if (error) return 0;

  return (data ?? [])
    .filter((row) => String(row.mes).toLowerCase().startsWith(mesNome.slice(0, 3)))
    .reduce((acc, row) => acc + toNumber(row.valor_comissao), 0);
}

async function fetchReceitaMes(ano: number, mes: number) {
  const { data, error } = await supabase
    .from('contrato_faturamento')
    .select('valor, contratos!inner(deleted_at, status)')
    .eq('ano', ano)
    .eq('mes', mes);
  if (error) return 0;

  const rows = (data ?? []) as Array<{
    valor: number | string;
    contratos:
      | { deleted_at: string | null; status: string }
      | Array<{ deleted_at: string | null; status: string }>
      | null;
  }>;
  return rows
    .filter((row) => {
      const c = Array.isArray(row.contratos) ? row.contratos[0] : row.contratos;
      return c && !c.deleted_at && c.status === 'Ativo';
    })
    .reduce((acc, row) => acc + toNumber(row.valor), 0);
}

export async function fetchReceitaPorMes(): Promise<ReceitaMes[]> {
  const agora = new Date();
  const pontos: ReceitaMes[] = [];

  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const contratos = await fetchReceitaMes(ano, mes);
    const comissoes = await fetchComissoesMes(ano, mes);
    pontos.push({
      mes: MESES_CURTO[d.getMonth()],
      contratos,
      comissoes,
    });
  }

  return pontos;
}

async function fetchComissoesMes(ano: number, mes: number) {
  const mesNome = MESES_LONGO[mes - 1];
  const { data, error } = await supabase
    .from('comissao_industria')
    .select('valor_comissao, mes')
    .eq('ano', String(ano));
  if (error) return 0;
  return (data ?? [])
    .filter((row) => String(row.mes).toLowerCase().includes(mesNome.slice(0, 3)))
    .reduce((acc, row) => acc + toNumber(row.valor_comissao), 0);
}

export async function fetchReceitaPorIndustria(): Promise<ReceitaIndustria[]> {
  const { data, error } = await supabase
    .from('contratos')
    .select('industria, valor_mensal, status')
    .is('deleted_at', null)
    .eq('status', 'Ativo');
  if (error) throw new Error(error.message);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.industria || 'Outros';
    map.set(key, (map.get(key) ?? 0) + toNumber(row.valor_mensal));
  }

  const agora = new Date();
  const comissoesMes = await fetchComissoesMes(agora.getFullYear(), agora.getMonth() + 1);

  return Array.from(map.entries())
    .map(([nome, contratos]) => ({
      nome,
      contratos,
      comissoes: map.size === 1 ? comissoesMes : 0,
    }))
    .sort((a, b) => b.contratos - a.contratos);
}

export async function fetchComparativoMeses(): Promise<ComparativoMes[]> {
  const agora = new Date();
  const atualAno = agora.getFullYear();
  const atualMes = agora.getMonth() + 1;
  const prevDate = new Date(atualAno, atualMes - 2, 1);
  const prevAno = prevDate.getFullYear();
  const prevMes = prevDate.getMonth() + 1;

  const [atualContratos, prevContratos, atualComissoes, prevComissoes] = await Promise.all([
    fetchReceitaMes(atualAno, atualMes),
    fetchReceitaMes(prevAno, prevMes),
    fetchComissoesMes(atualAno, atualMes),
    fetchComissoesMes(prevAno, prevMes),
  ]);

  const atualTotal = atualContratos + atualComissoes;
  const prevTotal = prevContratos + prevComissoes;
  const variacao = prevTotal > 0 ? ((atualTotal - prevTotal) / prevTotal) * 100 : null;

  return [
    {
      periodo: `${MESES_LONGO[atualMes - 1]} ${atualAno}`,
      contratos: atualContratos,
      comissoes: atualComissoes,
      total: atualTotal,
      variacao,
    },
    {
      periodo: `${MESES_LONGO[prevMes - 1]} ${prevAno}`,
      contratos: prevContratos,
      comissoes: prevComissoes,
      total: prevTotal,
      variacao: null,
    },
  ];
}

export async function fetchRegionaisNomes(): Promise<string[]> {
  const { data, error } = await supabase.from('regionais').select('"Nome"').order('Nome');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { Nome: string }) => row.Nome).filter(Boolean);
}

export type FilialCatalogItem = {
  id: number;
  codigo: number;
  nome: string;
  cidade: string;
  estado: string;
  regional: string;
};

export async function fetchFiliaisCatalog(): Promise<FilialCatalogItem[]> {
  const { data, error } = await supabase
    .from('lojas')
    .select('id, Nome, codigo, cidade, estado, regional, status')
    .order('codigo');
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row: { status?: string | null }) => !row.status || row.status === 'Ativo')
    .map(
      (
        row: {
          id: number;
          Nome: string;
          codigo: number | null;
          cidade: string | null;
          estado: string | null;
          regional: string | null;
        },
        index: number,
      ) => ({
        id: row.id,
        codigo: row.codigo ?? row.id ?? index + 1,
        nome: row.Nome,
        cidade: row.cidade ?? '',
        estado: row.estado ?? '',
        regional: row.regional ?? '',
      }),
    );
}
