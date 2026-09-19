export type LancarVencimentoPayload = {
  promoterName: string;
  store: string;
  state: string;
  code: string;
  description: string;
  batch: string;
  quantity: string;
  price: string;
  storeName: string;
  industria: string;
  date: string;
  submittedAt: string;
  /** UUID do outbox — n8n pode ignorar; evita confusão no retry local. */
  clientMutationId?: string;
};

const DEFAULT_WEBHOOK_URL =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/comercial1';

function resolveWebhookUrl(): string {
  const fromEnv = (import.meta.env.EXPO_PUBLIC_WEBHOOK_VALIDADE ?? '').trim();
  return fromEnv || DEFAULT_WEBHOOK_URL;
}

/** Envia o mesmo body do app validade.vercel.app — n8n comercial1. */
export async function submitLancarVencimento(
  payload: LancarVencimentoPayload,
): Promise<void> {
  const url = resolveWebhookUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      text.trim()
        ? `Webhook retornou ${response.status}: ${text.slice(0, 160)}`
        : `Webhook retornou status ${response.status}.`,
    );
  }
}

/** Formata preço BR com vírgula (ex.: 3,79). */
export function maskPriceBrInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '');
  const parts = cleaned.split(',');
  if (parts.length === 1) return parts[0].slice(0, 10);
  return `${parts[0].slice(0, 10)},${parts.slice(1).join('').slice(0, 2)}`;
}
