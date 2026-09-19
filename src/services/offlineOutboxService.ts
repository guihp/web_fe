import {
  deleteOutboxItem,
  getOutboxItem,
  listOutboxBlobs,
  listOutboxItems,
  newClientMutationId,
  putOutboxBlob,
  putOutboxItem,
  type OutboxItem,
  type OutboxItemType,
} from '../lib/offlineDb';
import { compressImageForUpload } from '../lib/compressImage';
import type { LancarVencimentoPayload } from './lancarVencimentoService';
import type { Loja } from './lojasService';

export type PromotorOutboxPayload = {
  usuarioId: number;
  loja: Loja;
  industria: string;
  clientMutationId: string;
};

export type EnqueuePromotorInput = {
  usuarioId: number;
  loja: Loja;
  industria: string;
  fotoAntes: File;
  fotoDepois: File;
};

export type EnqueueLancarInput = LancarVencimentoPayload & {
  usuarioId: number;
};

function notifyChanged() {
  window.dispatchEvent(new CustomEvent('fe-outbox-changed'));
}

export async function enqueuePromotorAntesDepois(
  input: EnqueuePromotorInput,
): Promise<OutboxItem> {
  const id = newClientMutationId();
  const now = Date.now();
  const [antes, depois] = await Promise.all([
    compressImageForUpload(input.fotoAntes),
    compressImageForUpload(input.fotoDepois),
  ]);

  const payload: PromotorOutboxPayload = {
    usuarioId: input.usuarioId,
    loja: input.loja,
    industria: input.industria.trim(),
    clientMutationId: id,
  };

  const item: OutboxItem = {
    id,
    type: 'promotor_antes_depois',
    usuarioId: input.usuarioId,
    status: 'pending',
    payload: payload as unknown as Record<string, unknown>,
    label: `${input.loja.Nome} · ${input.industria.trim()}`,
    attempts: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  await putOutboxItem(item);
  await putOutboxBlob({
    id: `${id}:antes`,
    outboxId: id,
    kind: 'antes',
    blob: antes,
    mimeType: antes.type,
    fileName: antes.name,
  });
  await putOutboxBlob({
    id: `${id}:depois`,
    outboxId: id,
    kind: 'depois',
    blob: depois,
    mimeType: depois.type,
    fileName: depois.name,
  });
  notifyChanged();
  void requestBackgroundSync();
  return item;
}

export async function enqueueLancarVencimento(
  input: EnqueueLancarInput,
): Promise<OutboxItem> {
  const id = newClientMutationId();
  const now = Date.now();
  const { usuarioId, ...rest } = input;
  const payload = {
    ...rest,
    clientMutationId: id,
  };

  const item: OutboxItem = {
    id,
    type: 'lancar_vencimento',
    usuarioId,
    status: 'pending',
    payload: payload as unknown as Record<string, unknown>,
    label: `${rest.storeName} · ${rest.description}`,
    attempts: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  await putOutboxItem(item);
  notifyChanged();
  void requestBackgroundSync();
  return item;
}

export async function getPendingOutbox(): Promise<OutboxItem[]> {
  const all = await listOutboxItems();
  return all.filter((i) => i.status === 'pending' || i.status === 'error' || i.status === 'syncing');
}

export async function markOutboxStatus(
  id: string,
  status: OutboxItem['status'],
  lastError: string | null = null,
): Promise<void> {
  const item = await getOutboxItem(id);
  if (!item) return;
  item.status = status;
  item.lastError = lastError;
  item.updatedAt = Date.now();
  if (status === 'syncing') item.attempts += 1;
  await putOutboxItem(item);
  notifyChanged();
}

export async function removeOutbox(id: string): Promise<void> {
  await deleteOutboxItem(id);
  notifyChanged();
}

export async function loadPromotorBlobs(
  outboxId: string,
): Promise<{ fotoAntes: File; fotoDepois: File }> {
  const blobs = await listOutboxBlobs(outboxId);
  const antes = blobs.find((b) => b.kind === 'antes');
  const depois = blobs.find((b) => b.kind === 'depois');
  if (!antes || !depois) {
    throw new Error('Fotos do envio pendente não encontradas no aparelho.');
  }
  return {
    fotoAntes: new File([antes.blob], antes.fileName || 'antes.jpg', {
      type: antes.mimeType || 'image/jpeg',
    }),
    fotoDepois: new File([depois.blob], depois.fileName || 'depois.jpg', {
      type: depois.mimeType || 'image/jpeg',
    }),
  };
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('internet') ||
    msg.includes('load failed') ||
    msg.includes('networkerror')
  );
}

export async function requestBackgroundSync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return;
    const syncManager = (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;
    if (syncManager) {
      await syncManager.register('fe-outbox-sync');
    }
  } catch {
    /* Background Sync pode não existir / precisar de permissão */
  }
}

export type { OutboxItem, OutboxItemType };
