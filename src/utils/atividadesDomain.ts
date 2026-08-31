export type StatusNormalizado = 'pendente' | 'completo' | 'justificada' | 'cancelado';

export type DiaStatus = 'em_andamento' | 'concluida' | 'justificada' | 'atrasada';

export type AtividadeDiaRecord = {
  data: string;
  status: string;
  justificativa_motivo?: string | null;
  justificativa_observacao?: string | null;
  foto_antes_url?: string | null;
  foto_depois_url?: string | null;
  foto_justificativa_url?: string | null;
  senha_do_dia?: string | null;
};

export type AtividadeLike = {
  status?: string | null;
  data_inicio?: string | null;
  data_fim: string;
  sincronizado?: boolean;
};

export type DiaTimelineItem = {
  data: string;
  label: string;
  weekday: string;
  status: DiaStatus;
  record?: AtividadeDiaRecord;
};

export function normalizeStatus(status?: string | null): StatusNormalizado {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'completo' || s === 'concluida' || s === 'concluída') return 'completo';
  if (s === 'cancelado') return 'cancelado';
  if (s.includes('justific')) return 'justificada';
  return 'pendente';
}

export function statusLabel(status?: string | null): string {
  const n = normalizeStatus(status);
  const labels: Record<StatusNormalizado, string> = {
    pendente: 'Em andamento',
    completo: 'Concluída',
    justificada: 'Justificada',
    cancelado: 'Cancelado',
  };
  return labels[n];
}

export function diaStatusLabel(status: DiaStatus): string {
  const labels: Record<DiaStatus, string> = {
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    justificada: 'Justificada',
    atrasada: 'Em atraso',
  };
  return labels[status];
}

export function diaStatusColor(status: DiaStatus): string {
  const colors: Record<DiaStatus, string> = {
    em_andamento: '#f59e0b',
    concluida: '#16a34a',
    justificada: '#2563eb',
    atrasada: '#dc2626',
  };
  return colors[status];
}

export function statusColor(status?: string | null): string {
  const n = normalizeStatus(status);
  const colors: Record<StatusNormalizado, string> = {
    pendente: '#f59e0b',
    completo: '#16a34a',
    justificada: '#2563eb',
    cancelado: '#6b7280',
  };
  return colors[n];
}

export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function isSingleDayActivity(atividade: AtividadeLike): boolean {
  return Boolean(
    atividade.data_inicio && atividade.data_fim && atividade.data_inicio === atividade.data_fim
  );
}

export function isAtividadeAberta(atividade: AtividadeLike): boolean {
  const n = normalizeStatus(atividade.status);
  if (n === 'completo' || n === 'cancelado') return false;
  if (!atividade.data_fim) return false;
  return atividade.data_fim >= todayISO();
}

export function canEditAtividade(status?: string | null): boolean {
  const n = normalizeStatus(status);
  return n === 'pendente' || n === 'justificada';
}

export function canCancelAtividade(status?: string | null): boolean {
  return canEditAtividade(status);
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDateLongBR(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return formatDateBR(iso);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function enumerateElapsedDays(dataInicio?: string | null, dataFim?: string | null): string[] {
  if (!dataInicio || !dataFim) return [];
  const end = dataFim < todayISO() ? dataFim : todayISO();
  if (dataInicio > end) return [];

  const days: string[] = [];
  let current = dataInicio;
  while (current <= end) {
    days.push(current);
    current = addDaysISO(current, 1);
  }
  return days;
}

function normalizeDiaRecordStatus(status?: string | null): DiaStatus | null {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'concluida' || s === 'concluído' || s === 'completo') return 'concluida';
  if (s.includes('justific')) return 'justificada';
  if (s === 'atrasada' || s === 'atraso') return 'atrasada';
  if (s === 'pendente' || s === 'em_andamento') return 'em_andamento';
  return null;
}

export function resolveDiaStatus(
  atividade: AtividadeLike,
  dateISO: string,
  record?: AtividadeDiaRecord
): DiaStatus {
  if (record) {
    const fromRecord = normalizeDiaRecordStatus(record.status);
    if (fromRecord) return fromRecord;
    if (record.foto_antes_url || record.foto_depois_url) return 'concluida';
    if (record.justificativa_motivo) return 'justificada';
  }

  if (!record && isSingleDayActivity(atividade)) {
    const activityStatus = normalizeStatus(atividade.status);
    if (activityStatus === 'completo') return 'concluida';
    if (activityStatus === 'justificada') return 'justificada';
  }

  if (dateISO < todayISO()) return 'atrasada';
  return 'em_andamento';
}

export function buildDiaTimeline(
  atividade: AtividadeLike,
  records: AtividadeDiaRecord[]
): DiaTimelineItem[] {
  const byDate = new Map(records.map((r) => [r.data, r]));
  const days = enumerateElapsedDays(atividade.data_inicio, atividade.data_fim);

  return days
    .map((data) => {
      const record = byDate.get(data);
      const date = new Date(`${data}T12:00:00`);
      return {
        data,
        label: formatDateBR(data),
        weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
        status: resolveDiaStatus(atividade, data, record),
        record,
      };
    })
    .reverse();
}

export function formatPeriodo(dataInicio?: string | null, dataFim?: string | null): string {
  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };
  return `${fmt(dataInicio)} – ${fmt(dataFim)}`;
}

export function overlapsPeriod(
  atividadeInicio: string,
  atividadeFim: string,
  filterInicio?: string,
  filterFim?: string
): boolean {
  if (filterInicio && atividadeFim < filterInicio) return false;
  if (filterFim && atividadeInicio > filterFim) return false;
  return true;
}

export function computeStats<T extends AtividadeLike>(rows: T[]) {
  let pendentes = 0;
  let concluidas = 0;
  let justificadas = 0;
  let naoSincronizadas = 0;

  for (const row of rows) {
    const n = normalizeStatus(row.status);
    if (n === 'pendente') pendentes += 1;
    if (n === 'completo') concluidas += 1;
    if (n === 'justificada') justificadas += 1;
    if (row.sincronizado === false) naoSincronizadas += 1;
  }

  return {
    total: rows.length,
    pendentes,
    concluidas,
    justificadas,
    naoSincronizadas,
  };
}
