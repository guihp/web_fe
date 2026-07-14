const DEFAULT_WEBHOOK_URL =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/SistemofSales';

export type WebhookEvent = 'venda_lancada' | 'venda_editada' | 'venda_cancelada';

export async function sendVendaWebhook(event: WebhookEvent, payload: Record<string, unknown>) {
  const url = import.meta.env.VITE_WEBHOOK_URL || import.meta.env.EXPO_PUBLIC_WEBHOOK_VENDAS || DEFAULT_WEBHOOK_URL;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
    });
  } catch {
    // Webhook failure should not block the main flow
  }
}
