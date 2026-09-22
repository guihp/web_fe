import { industriasMatch, normalizeIndustriaKey } from './vendasDomain';

/** Indústrias conhecidas do catálogo estático (slugs alinhados a public/catalogo). */
export const CATALOGO_INDUSTRY_DEFS = [
  { slug: 'predilecta-alimentos', name: 'Predilecta Alimentos', shortName: 'Predilecta', code: '723' },
  { slug: 'precioso-alimentos', name: 'Precioso Alimentos', shortName: 'Precioso', code: '133612' },
  { slug: 'vale-fertil', name: 'Vale Fértil', shortName: 'Vale Fértil', code: '1968' },
  { slug: 'ruppers', name: 'Ruppers', shortName: 'Ruppers', code: '59324' },
  { slug: 'dacolonia-alimentos', name: 'DaColônia Alimentos', shortName: 'DaColônia', code: '67934' },
  { slug: 'tourinho-alimentos', name: 'Tourinho Alimentos', shortName: 'Tourinho', code: '11217' },
  { slug: 'peccin', name: 'Peccin', shortName: 'Peccin', code: null },
] as const;

/**
 * Resolve o slug do catálogo a partir do nome de indústria do portal
 * (ex.: "PREDILECTA" / "Predilecta Alimentos" → "predilecta-alimentos").
 */
export function resolveCatalogoIndustrySlug(
  industriaNome: string | null | undefined,
): string | null {
  const raw = (industriaNome ?? '').trim();
  if (!raw) return null;

  const key = normalizeIndustriaKey(raw);
  if (!key) return null;

  for (const ind of CATALOGO_INDUSTRY_DEFS) {
    if (
      industriasMatch(raw, ind.name) ||
      industriasMatch(raw, ind.shortName) ||
      normalizeIndustriaKey(ind.slug.replace(/-/g, ' ')) === key
    ) {
      return ind.slug;
    }
  }

  return null;
}

export function buildCatalogoIframeSrc(options: {
  gestao: boolean;
  industrySlug: string | null;
}): string {
  const params = new URLSearchParams();
  if (options.gestao) params.set('gestao', '1');
  if (options.industrySlug) params.set('industry', options.industrySlug);
  const qs = params.toString();
  return qs ? `/catalogo/index.html?${qs}` : '/catalogo/index.html';
}
