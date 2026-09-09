import { supabase } from '../lib/supabase';
import { fetchLojas, type Loja } from './lojasService';

export type EbookPhotoKind = 'antes' | 'depois';

export type EbookPhoto = {
  id: string;
  diaId: number;
  atividadeId: number;
  url: string;
  loja: string;
  industria: string;
  tipo: string;
  promotor: string;
  data: string;
  uf: string;
  kind: EbookPhotoKind;
  senhaDoDia: string;
};

export type EbookPhotoFilters = {
  search?: string;
  industria?: string;
  uf?: string;
  tipo?: string;
  loja?: string;
  promotor?: string;
  data?: string;
};

type DiaRow = {
  id: number;
  atividade_id: number;
  data: string;
  foto_antes_url: string | null;
  foto_depois_url: string | null;
  senha_do_dia: string | null;
};

type AtividadeLite = {
  id: number;
  tipo: string | null;
  loja: string | null;
  industria: string | null;
  usuario_responsavel: number | null;
};

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function buildLojaEstadoMap(lojas: Loja[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const loja of lojas) {
    const estado = (loja.estado ?? '').trim().toUpperCase();
    if (!estado) continue;
    const nome = (loja.Nome ?? '').trim();
    if (nome) {
      map.set(normalizeKey(nome), estado);
      if (loja.codigo != null) {
        map.set(normalizeKey(`${loja.codigo} - ${nome}`), estado);
        map.set(normalizeKey(`${loja.codigo}-${nome}`), estado);
        map.set(String(loja.codigo), estado);
      }
    }
  }
  return map;
}

function resolveUf(lojaNome: string, lojaMap: Map<string, string>): string {
  const raw = lojaNome.trim();
  if (!raw) return '';
  const direct = lojaMap.get(normalizeKey(raw));
  if (direct) return direct;

  const codeMatch = raw.match(/^(\d+)\s*[-–]/);
  if (codeMatch) {
    const byCode = lojaMap.get(codeMatch[1]);
    if (byCode) return byCode;
  }

  const key = normalizeKey(raw);
  for (const [nome, uf] of lojaMap) {
    if (key.includes(nome) || nome.includes(key)) return uf;
  }
  return '';
}

function kindLabel(kind: EbookPhotoKind): string {
  return kind === 'antes' ? 'ANTES' : 'DEPOIS';
}

/** Rótulo de tipo para filtro/UI — Antes e Depois vira o kind da foto. */
export function ebookTipoLabel(photo: EbookPhoto): string {
  const tipo = (photo.tipo ?? '').trim();
  if (/antes\s*e\s*depois/i.test(tipo)) return kindLabel(photo.kind);
  return tipo || kindLabel(photo.kind);
}

export function formatEbookDateBr(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export async function fetchEbookPhotos(): Promise<EbookPhoto[]> {
  const pageSize = 1000;
  const dias: DiaRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('atividade_dia')
      .select('id, atividade_id, data, foto_antes_url, foto_depois_url, senha_do_dia')
      .or('foto_antes_url.not.is.null,foto_depois_url.not.is.null')
      .order('data', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as DiaRow[];
    dias.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  if (dias.length === 0) return [];

  const atividadeIds = [...new Set(dias.map((d) => d.atividade_id))];
  const atividadeMap = new Map<number, AtividadeLite>();

  const chunk = 200;
  for (let i = 0; i < atividadeIds.length; i += chunk) {
    const slice = atividadeIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('atividades')
      .select('id, tipo, loja, industria, usuario_responsavel')
      .in('id', slice);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as AtividadeLite[]) {
      atividadeMap.set(row.id, row);
    }
  }

  const userIds = [
    ...new Set(
      [...atividadeMap.values()]
        .map((a) => a.usuario_responsavel)
        .filter((id): id is number => id != null),
    ),
  ];
  const nomeByUser = new Map<number, string>();
  for (let i = 0; i < userIds.length; i += chunk) {
    const slice = userIds.slice(i, i + chunk);
    const { data, error } = await supabase.from('usuarios').select('id, nome').in('id', slice);
    if (error) throw new Error(error.message);
    for (const u of data ?? []) {
      nomeByUser.set(Number(u.id), String(u.nome ?? '').trim() || `ID ${u.id}`);
    }
  }

  const lojas = await fetchLojas().catch(() => [] as Loja[]);
  const lojaMap = buildLojaEstadoMap(lojas);

  const photos: EbookPhoto[] = [];
  for (const dia of dias) {
    const at = atividadeMap.get(dia.atividade_id);
    const loja = (at?.loja ?? '').trim();
    const industria = (at?.industria ?? '').trim();
    const tipo = (at?.tipo ?? '').trim();
    const promotor =
      at?.usuario_responsavel != null
        ? (nomeByUser.get(at.usuario_responsavel) ?? `ID ${at.usuario_responsavel}`)
        : '—';
    const uf = resolveUf(loja, lojaMap);
    const data = (dia.data ?? '').slice(0, 10);
    const senhaDoDia = (dia.senha_do_dia ?? '').trim();

    if (dia.foto_antes_url) {
      photos.push({
        id: `dia-${dia.id}-antes`,
        diaId: dia.id,
        atividadeId: dia.atividade_id,
        url: dia.foto_antes_url,
        loja,
        industria,
        tipo,
        promotor,
        data,
        uf,
        kind: 'antes',
        senhaDoDia,
      });
    }
    if (dia.foto_depois_url) {
      photos.push({
        id: `dia-${dia.id}-depois`,
        diaId: dia.id,
        atividadeId: dia.atividade_id,
        url: dia.foto_depois_url,
        loja,
        industria,
        tipo,
        promotor,
        data,
        uf,
        kind: 'depois',
        senhaDoDia,
      });
    }
  }

  photos.sort((a, b) => {
    if (a.data !== b.data) return b.data.localeCompare(a.data);
    if (a.diaId !== b.diaId) return b.diaId - a.diaId;
    return a.kind.localeCompare(b.kind);
  });

  return photos;
}

export function filterEbookPhotos(
  photos: EbookPhoto[],
  filters: EbookPhotoFilters,
): EbookPhoto[] {
  const search = normalizeKey(filters.search ?? '');
  const industria = normalizeKey(filters.industria ?? '');
  const uf = (filters.uf ?? '').trim().toUpperCase();
  const tipo = normalizeKey(filters.tipo ?? '');
  const loja = normalizeKey(filters.loja ?? '');
  const promotor = normalizeKey(filters.promotor ?? '');
  const data = (filters.data ?? '').trim().slice(0, 10);

  return photos.filter((p) => {
    if (industria && normalizeKey(p.industria) !== industria) return false;
    if (uf && p.uf.toUpperCase() !== uf) return false;
    if (loja && normalizeKey(p.loja) !== loja) return false;
    if (promotor && normalizeKey(p.promotor) !== promotor) return false;
    if (data && p.data !== data) return false;
    if (tipo) {
      const label = normalizeKey(ebookTipoLabel(p));
      const raw = normalizeKey(p.tipo);
      if (label !== tipo && raw !== tipo) return false;
    }
    if (search) {
      const hay = normalizeKey(`${p.loja} ${p.promotor} ${p.industria} ${p.tipo}`);
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}
