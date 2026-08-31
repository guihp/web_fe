import { supabase } from '../lib/supabase';

export type SenhaDoDia = {
  senha: string;
  dia: string; // YYYY-MM-DD (America/Sao_Paulo)
};

const TZ = 'America/Sao_Paulo';

/** Data de calendário hoje em BRT (YYYY-MM-DD). */
export function todayDateKeyBRT(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function formatDiaBR(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
}

function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Busca a senha cujo `dia` é o calendário de hoje em America/Sao_Paulo.
 * Se houver mais de uma linha no mesmo dia, usa a mais recente.
 */
export async function fetchSenhaDoDia(): Promise<SenhaDoDia | null> {
  const hoje = todayDateKeyBRT();
  const amanha = addDaysKey(hoje, 1);

  // dia é timestamp without time zone (ex.: 2026-08-31 00:00:00)
  // PostgREST aceita melhor o formato com espaço do que com "T"
  const { data, error } = await supabase
    .from('senhas')
    .select('senha, dia, created_at, id')
    .gte('dia', `${hoje} 00:00:00`)
    .lt('dia', `${amanha} 00:00:00`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  const row = data?.[0];
  const senha = String(row?.senha ?? '').trim();
  if (!senha) return null;

  return { senha, dia: hoje };
}
