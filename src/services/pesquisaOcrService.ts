import type { TipoPesquisa } from './priceService';

export type PesquisaOcrCandidate = {
  codigo?: string;
  produto: string;
  industria?: string;
  score?: number;
};

export type PesquisaOcrResponse = {
  product_text: string;
  /** Preço legado: só preenche varejo se atacado também vier vazio. */
  preco: string | null;
  /** Varejo explícito do OCR (pode ser null se só houver atacado Mateus). */
  preco_varejo: string | null;
  preco_atacado: string | null;
  candidates: PesquisaOcrCandidate[];
};

export type PesquisaOcrRequest = {
  produtoCrop: Blob;
  precoCrop: Blob;
  tipo: TipoPesquisa;
  industria: string;
};

/** Prefer `VITE_PESQUISA_OCR_URL`, fallback `EXPO_PUBLIC_WEBHOOK_PESQUISA`. */
export function getPesquisaOcrBaseUrl(): string | null {
  const raw = (
    import.meta.env.VITE_PESQUISA_OCR_URL ||
    import.meta.env.EXPO_PUBLIC_WEBHOOK_PESQUISA ||
    ''
  ).trim();
  return raw || null;
}

/** Full POST URL for `POST /ocr/pesquisa` (env may be base or already the path). */
export function getPesquisaOcrUrl(): string | null {
  const base = getPesquisaOcrBaseUrl();
  if (!base) return null;
  if (/\/ocr\/pesquisa\/?$/i.test(base)) return base.replace(/\/$/, '');
  return `${base.replace(/\/$/, '')}/ocr/pesquisa`;
}

/** Trim + strip accidental surrounding quotes (Coolify paste / mis-quoted .env). */
function normalizeOcrSecret(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getOcrSecret(): string | null {
  const secret = normalizeOcrSecret(import.meta.env.VITE_PESQUISA_OCR_SECRET || '');
  return secret || null;
}

function asCandidate(raw: unknown): PesquisaOcrCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const produto = String(row.produto ?? row.product_text ?? row.descricao ?? '').trim();
  if (!produto) return null;
  return {
    produto,
    codigo: row.codigo != null ? String(row.codigo) : undefined,
    industria: row.industria != null ? String(row.industria) : undefined,
    score: typeof row.score === 'number' ? row.score : undefined,
  };
}

/** Só auto-preenche descrição com candidato do catálogo se score >= isto. */
export const OCR_AUTO_PICK_MIN_SCORE = 75;

function parseOcrResponse(body: unknown): PesquisaOcrResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Resposta OCR inválida.');
  }
  const row = body as Record<string, unknown>;
  // Prefer raw OCR (`texto_ocr`). Never use `descricao` first — backend may overwrite it with a weak catalog match.
  const product_text =
    String(row.texto_ocr ?? row.product_text ?? row.produto ?? '').trim() ||
    String(row.descricao ?? '').trim();
  const asPrice = (raw: unknown): string | null => {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    return s || null;
  };

  const preco = asPrice(row.preco);
  // Prefer explicit varejo/atacado. Backend may put a single Mateus price in atacado only.
  // Fallback `preco` fills varejo only when varejo is absent AND atacado is also absent.
  const preco_varejo_explicit = asPrice(row.preco_varejo);
  const preco_atacado = asPrice(row.preco_atacado);
  const preco_varejo =
    preco_varejo_explicit ?? (preco_atacado == null ? preco : null);
  const candidatesRaw = Array.isArray(row.candidates)
    ? row.candidates
    : Array.isArray(row.candidatos)
      ? row.candidatos
      : [];
  const candidates = candidatesRaw
    .map(asCandidate)
    .filter((c): c is PesquisaOcrCandidate => c != null);

  return { product_text, preco, preco_varejo, preco_atacado, candidates };
}

/**
 * Envia crops produto + preço ao serviço OCR (multipart + `X-OCR-Secret`).
 */
export async function postPesquisaOcr(
  input: PesquisaOcrRequest,
): Promise<PesquisaOcrResponse> {
  const url = getPesquisaOcrUrl();
  if (!url) {
    throw new Error(
      'URL do OCR não configurada (VITE_PESQUISA_OCR_URL ou EXPO_PUBLIC_WEBHOOK_PESQUISA).',
    );
  }

  const industria = input.industria.trim();
  if (!industria) throw new Error('Informe a indústria.');

  const form = new FormData();
  form.append('produto_crop', input.produtoCrop, 'produto.jpg');
  form.append('preco_crop', input.precoCrop, 'preco.jpg');
  form.append('tipo', input.tipo);
  form.append('industria', industria);

  const secret = getOcrSecret();
  if (!secret) {
    throw new Error(
      'Secret OCR não configurado (VITE_PESQUISA_OCR_SECRET). Use aspas se contiver # e reinicie o npm run dev.',
    );
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-OCR-Secret': secret,
  };

  const response = await fetch(url, { method: 'POST', headers, body: form });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error(
        'Secret OCR rejeitado (401). Confira se VITE_PESQUISA_OCR_SECRET (local, entre aspas se tiver #) é idêntico a OCR_SHARED_SECRET no Coolify do serviço OCR, e reinicie o Vite após alterar .env.',
      );
    }
    throw new Error(
      text.trim()
        ? `OCR retornou ${response.status}: ${text.slice(0, 160)}`
        : `OCR retornou status ${response.status}.`,
    );
  }

  const json = (await response.json()) as unknown;
  const parsed = parseOcrResponse(json);
  return parsed;
}
