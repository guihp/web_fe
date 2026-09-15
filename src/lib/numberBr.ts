/** Converte "200.000,50" → 200000.5 */
export function parseNumberBr(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  const normalized = t.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Formata número no padrão brasileiro (ex.: 200.000,00). */
export function formatNumberBr(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value == null || !Number.isFinite(value)) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Máscara de digitação BR: milhar com ponto e decimais com vírgula.
 * Ex.: 200000 → 200.000 | 200000,5 → 200.000,5
 */
export function maskNumberBrInput(raw: string, maxDecimals = 2): string {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return '';

  const commaIdx = cleaned.indexOf(',');
  let intDigits: string;
  let decDigits = '';

  if (commaIdx >= 0) {
    intDigits = cleaned.slice(0, commaIdx).replace(/\D/g, '');
    decDigits = cleaned
      .slice(commaIdx + 1)
      .replace(/\D/g, '')
      .slice(0, maxDecimals);
  } else {
    intDigits = cleaned.replace(/\D/g, '');
  }

  if (!intDigits && commaIdx < 0) return '';

  const intNorm = intDigits.replace(/^0+(?=\d)/, '') || '0';
  const intFormatted = intNorm.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (commaIdx >= 0) return `${intFormatted},${decDigits}`;
  return intFormatted;
}
