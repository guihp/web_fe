export type BibleVerse = {
  reference: string;
  text: string;
};

const FALLBACK_VERSE: BibleVerse = {
  reference: 'Josué 1:9',
  text:
    'Não fui eu que ordenei a você? Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.',
};

type BibleApiRandomResponse = {
  random_verse?: {
    book: string;
    chapter: number;
    verse: number;
    text: string;
  };
};

export async function fetchRandomVerse(): Promise<BibleVerse> {
  const response = await fetch('https://bible-api.com/data/almeida/random');

  if (!response.ok) {
    throw new Error('Não foi possível carregar o versículo.');
  }

  const data = (await response.json()) as BibleApiRandomResponse;
  const verse = data.random_verse;

  if (!verse?.text) {
    throw new Error('Resposta inválida da API da Bíblia.');
  }

  return {
    reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
    text: verse.text.trim().replace(/\s+/g, ' '),
  };
}

export function getFallbackVerse(): BibleVerse {
  return FALLBACK_VERSE;
}
