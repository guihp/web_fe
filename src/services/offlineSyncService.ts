import {
  getPendingOutbox,
  isLikelyNetworkError,
  loadPromotorBlobs,
  markOutboxStatus,
  removeOutbox,
  requestBackgroundSync,
  type OutboxItem,
  type PromotorOutboxPayload,
} from './offlineOutboxService';
import {
  submitLancarVencimento,
  type LancarVencimentoPayload,
} from './lancarVencimentoService';
import { submitPromotorAntesDepois } from './promotorAtividadeService';

type SyncListener = (state: OfflineSyncState) => void;

export type OfflineSyncState = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  items: OutboxItem[];
  lastFlushError: string | null;
};

let listeners = new Set<SyncListener>();
let flushing = false;
let started = false;
let lastFlushError: string | null = null;

function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

async function buildState(): Promise<OfflineSyncState> {
  const items = await getPendingOutbox().catch(() => [] as OutboxItem[]);
  return {
    online: isBrowserOnline(),
    syncing: flushing,
    pendingCount: items.length,
    items,
    lastFlushError,
  };
}

async function emit() {
  const state = await buildState();
  listeners.forEach((fn) => fn(state));
}

async function processItem(item: OutboxItem): Promise<void> {
  await markOutboxStatus(item.id, 'syncing');
  try {
    if (item.type === 'promotor_antes_depois') {
      const payload = item.payload as unknown as PromotorOutboxPayload;
      const { fotoAntes, fotoDepois } = await loadPromotorBlobs(item.id);
      await submitPromotorAntesDepois({
        usuarioId: payload.usuarioId,
        loja: payload.loja,
        industria: payload.industria,
        fotoAntes,
        fotoDepois,
        clientMutationId: payload.clientMutationId || item.id,
      });
    } else if (item.type === 'lancar_vencimento') {
      const raw = item.payload as Record<string, unknown>;
      const payload: LancarVencimentoPayload = {
        promoterName: String(raw.promoterName ?? ''),
        store: String(raw.store ?? ''),
        state: String(raw.state ?? ''),
        code: String(raw.code ?? ''),
        description: String(raw.description ?? ''),
        batch: String(raw.batch ?? ''),
        quantity: String(raw.quantity ?? ''),
        price: String(raw.price ?? ''),
        storeName: String(raw.storeName ?? ''),
        industria: String(raw.industria ?? ''),
        date: String(raw.date ?? ''),
        submittedAt: String(raw.submittedAt ?? new Date().toISOString()),
        clientMutationId: String(raw.clientMutationId ?? item.id),
      };
      await submitLancarVencimento(payload);
    } else {
      throw new Error(`Tipo de outbox desconhecido: ${item.type}`);
    }
    await removeOutbox(item.id);
    lastFlushError = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao sincronizar.';
    await markOutboxStatus(item.id, 'error', message);
    lastFlushError = message;
    throw err;
  }
}

/** Flush sequencial da fila. Retorna quantos itens foram enviados. */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  if (flushing) return { sent: 0, failed: 0 };
  if (!isBrowserOnline()) {
    lastFlushError = 'Sem conexão.';
    await emit();
    return { sent: 0, failed: 0 };
  }

  flushing = true;
  await emit();
  let sent = 0;
  let failed = 0;

  try {
    const items = await getPendingOutbox();
    // Itens travados em "syncing" (aba fechada no meio) voltam para a fila.
    for (const stuck of items.filter((i) => i.status === 'syncing')) {
      await markOutboxStatus(stuck.id, 'pending', stuck.lastError);
    }
    const queue = await getPendingOutbox();
    for (const item of queue) {
      if (!isBrowserOnline()) break;
      try {
        await processItem(item);
        sent += 1;
      } catch {
        failed += 1;
      }
    }
  } finally {
    flushing = false;
    await emit();
  }

  return { sent, failed };
}

export function subscribeOfflineSync(listener: SyncListener): () => void {
  listeners.add(listener);
  void buildState().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshOfflineSyncState(): Promise<OfflineSyncState> {
  const state = await buildState();
  listeners.forEach((fn) => fn(state));
  return state;
}

export function startOfflineSyncListeners(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const onOnline = () => {
    void emit();
    void flushOutbox();
  };
  const onOffline = () => {
    void emit();
  };
  const onOutboxChanged = () => {
    void emit();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && isBrowserOnline()) {
      void flushOutbox();
    }
  };
  const onSwMessage = (event: MessageEvent) => {
    if (event.data?.type === 'FE_OUTBOX_SYNC') {
      void flushOutbox();
    }
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  window.addEventListener('fe-outbox-changed', onOutboxChanged);
  document.addEventListener('visibilitychange', onVisibility);
  navigator.serviceWorker?.addEventListener('message', onSwMessage);

  void refreshOfflineSyncState();
  if (isBrowserOnline()) {
    void flushOutbox();
  }
  void requestBackgroundSync();
}

export { isLikelyNetworkError };
