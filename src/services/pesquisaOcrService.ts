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
  // Prefer cleaned descricao when it looks like a full product name; else raw OCR.
  const rawText = String(row.texto_ocr ?? row.product_text ?? row.produto ?? '').trim();
  const cleaned = String(row.descricao ?? '').trim();
  const product_text =
    (cleaned.length >= 12 ? cleaned : '') ||
    (rawText.length > cleaned.length ? rawText : cleaned) ||
    rawText ||
    cleaned;
  const asPrice = (raw: unknown): string | null => {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    return s || null;
  };

  const preco = asPrice(row.preco);
  // Prefer explicit varejo/atacado. Backend may put a single Mateus price in atacado only.
  // Fallback `preco` fills varejo only when varejo is absent AND atacado is also absent.
  let preco_varejo_explicit = asPrice(row.preco_varejo);
  let preco_atacado = asPrice(row.preco_atacado);
  const precoOcrRaw = String(row.preco_ocr_raw ?? '').trim();
  // Include product/tag OCR text — dual prices often appear without "R$" prefix.
  const priceBlob = `${precoOcrRaw} ${rawText}`.trim();

  // Coolify OCR sometimes invents EMB-derived prices; reconcile from amounts in OCR text.
  const reconciled = reconcilePricesFromOcrRaw(
    priceBlob,
    preco_varejo_explicit,
    preco_atacado,
  );
  preco_varejo_explicit = reconciled.varejo;
  preco_atacado = reconciled.atacado;

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

function priceToNumber(p: string): number {
  return Number.parseFloat(p.replace(/\./g, '').replace(',', '.'));
}

function normPriceToken(raw: string): string {
  return raw.includes(',') ? raw : raw.replace('.', ',');
}

/**
 * Mateus dual-column labels (ATACADO + VAREJO) in OCR text.
 */
function isMateusDualColumnRaw(raw: string): boolean {
  return /\bATACADO\b/i.test(raw) && /\bVAREJO\b/i.test(raw);
}

function extractAllOcrPrices(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(?:R\$\s*)?(\d{1,3}[.,]\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) != null) {
    const norm = normPriceToken(m[1]);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

/**
 * Two close unit prices (e.g. 2,39 / 2,49) → Mateus atacado < varejo.
 * Ignores EMB pack totals and OCR junk (0,50).
 */
function findDualUnitPair(
  prices: string[],
): { atacado: string; varejo: string } | null {
  const units = prices
    .map((p) => ({ p, v: priceToNumber(p) }))
    .filter((x) => x.v >= 0.8 && x.v <= 30);

  let best: { atacado: string; varejo: string; score: number } | null = null;
  for (let i = 0; i < units.length; i += 1) {
    for (let j = i + 1; j < units.length; j += 1) {
      const [lo, hi] =
        units[i].v <= units[j].v ? [units[i], units[j]] : [units[j], units[i]];
      const rel = (hi.v - lo.v) / lo.v;
      // Typical gôndola gap is a few %; reject EMB pack vs unit (e.g. 2,79 vs 9,56).
      if (rel < 0.005 || rel > 0.2) continue;
      const mid = (lo.v + hi.v) / 2;
      const score = (1 / (rel + 0.01)) * (mid >= 1 && mid <= 20 ? 2 : 1);
      if (!best || score > best.score) {
        best = { atacado: lo.p, varejo: hi.p, score };
      }
    }
  }
  return best ? { atacado: best.atacado, varejo: best.varejo } : null;
}

/**
 * Reconcile API prices with amounts visible in OCR text.
 * - Close dual pair (2,39/2,49) or ATACADO+VAREJO labels → both
 * - Single unit (PRECO POR UNIDADE / EMB) → varejo only
 */
export function reconcilePricesFromOcrRaw(
  raw: string,
  varejo: string | null,
  atacado: string | null,
): { varejo: string | null; atacado: string | null } {
  if (!raw.trim()) return { varejo, atacado };

  const prices = extractAllOcrPrices(raw);
  const dualLabels = isMateusDualColumnRaw(raw);
  const pair = findDualUnitPair(prices);

  if (pair) {
    return { varejo: pair.varejo, atacado: pair.atacado };
  }

  const unitCandidates = prices.filter((p) => {
    const v = priceToNumber(p);
    return v >= 0.8 && v < 40;
  });
  let nextVarejo = varejo;
  if (unitCandidates.length) {
    const bestUnit = unitCandidates.reduce((a, b) =>
      priceToNumber(a) <= priceToNumber(b) ? a : b,
    );
    const apiV = varejo ? priceToNumber(varejo) : NaN;
    if (
      !varejo ||
      !Number.isFinite(apiV) ||
      Math.abs(apiV - priceToNumber(bestUnit)) > 0.12 ||
      apiV < 0.8
    ) {
      nextVarejo = bestUnit;
    }
  }

  if (!dualLabels) {
    return { varejo: nextVarejo, atacado: null };
  }

  return { varejo: nextVarejo, atacado };
}

/** iPhone crops can be multi‑MB; keep OCR payload small for LAN + remote upload. */
const OCR_MAX_EDGE = 1280;
const OCR_JPEG_QUALITY = 0.82;
/** Remote vision models can be slow; fail instead of hanging forever on "Analisando…". */
const OCR_FETCH_TIMEOUT_MS = 45_000;

async function downscaleJpegForOcr(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, OCR_MAX_EDGE / maxSide);
    const alreadySmall =
      scale >= 1 && blob.type === 'image/jpeg' && blob.size <= 350_000;
    if (alreadySmall) return blob;

    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const out = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', OCR_JPEG_QUALITY);
    });
    return out ?? blob;
  } finally {
    bitmap.close();
  }
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

  const [produtoCrop, precoCrop] = await Promise.all([
    downscaleJpegForOcr(input.produtoCrop),
    // Same blob is often passed twice — reuse downscale when identical.
    input.precoCrop === input.produtoCrop
      ? Promise.resolve(null)
      : downscaleJpegForOcr(input.precoCrop),
  ]);
  const precoOut = precoCrop ?? produtoCrop;

  const form = new FormData();
  form.append('produto_crop', produtoCrop, 'produto.jpg');
  form.append('preco_crop', precoOut, 'preco.jpg');
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

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      throw new Error(
        'OCR demorou demais (45s). O serviço pode estar lento ou fora do ar — tente de novo.',
      );
    }
    if (err instanceof TypeError) {
      throw new Error(
        'Não foi possível conectar ao OCR (rede, CORS ou serviço indisponível). Confira https://ocr.iafeoficial.com/health.',
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error(
        'Secret OCR rejeitado (401). Confira se VITE_PESQUISA_OCR_SECRET (local, entre aspas se tiver #) é idêntico a OCR_SHARED_SECRET no Coolify do serviço OCR, e reinicie o Vite após alterar .env.',
      );
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(
        'Serviço OCR indisponível agora (sem backend saudável). Verifique o container no Coolify e tente de novo.',
      );
    }
    throw new Error(
      text.trim()
        ? `OCR retornou ${response.status}: ${text.slice(0, 160)}`
        : `OCR retornou status ${response.status}.`,
    );
  }

  const json = (await response.json()) as unknown;
  return parseOcrResponse(json);
}
