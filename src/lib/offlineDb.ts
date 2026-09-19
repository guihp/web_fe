/** IndexedDB leve para outbox offline + caches de leitura (sem Dexie). */

const DB_NAME = 'fe-offline-sync';
const DB_VERSION = 1;

export type OutboxStatus = 'pending' | 'syncing' | 'error';

export type OutboxItemType = 'promotor_antes_depois' | 'lancar_vencimento';

export type OutboxItem = {
  id: string;
  type: OutboxItemType;
  usuarioId: number;
  status: OutboxStatus;
  /** Metadados serializáveis (sem blobs). */
  payload: Record<string, unknown>;
  /** Rótulo curto para a UI. */
  label: string;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

export type OutboxBlobRecord = {
  id: string;
  outboxId: string;
  kind: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
};

export type CacheRecord = {
  key: string;
  value: unknown;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'id' });
        store.createIndex('by_status', 'status', { unique: false });
        store.createIndex('by_usuario', 'usuarioId', { unique: false });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        const store = db.createObjectStore('blobs', { keyPath: 'id' });
        store.createIndex('by_outbox', 'outboxId', { unique: false });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB.'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transação IndexedDB falhou.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transação IndexedDB abortada.'));
  });
}

export async function putOutboxItem(item: OutboxItem): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('outbox', 'readwrite');
  tx.objectStore('outbox').put(item);
  await txDone(tx);
  db.close();
}

export async function getOutboxItem(id: string): Promise<OutboxItem | null> {
  const db = await openDb();
  const tx = db.transaction('outbox', 'readonly');
  const req = tx.objectStore('outbox').get(id);
  const item = await new Promise<OutboxItem | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as OutboxItem | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return item ?? null;
}

export async function listOutboxItems(): Promise<OutboxItem[]> {
  const db = await openDb();
  const tx = db.transaction('outbox', 'readonly');
  const req = tx.objectStore('outbox').getAll();
  const rows = await new Promise<OutboxItem[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OutboxItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteOutboxItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['outbox', 'blobs'], 'readwrite');
  tx.objectStore('outbox').delete(id);
  const blobIdx = tx.objectStore('blobs').index('by_outbox');
  const blobReq = blobIdx.getAllKeys(id);
  await new Promise<void>((resolve, reject) => {
    blobReq.onsuccess = () => {
      const keys = (blobReq.result as IDBValidKey[]) ?? [];
      for (const key of keys) tx.objectStore('blobs').delete(key);
      resolve();
    };
    blobReq.onerror = () => reject(blobReq.error);
  });
  await txDone(tx);
  db.close();
}

export async function putOutboxBlob(record: OutboxBlobRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('blobs', 'readwrite');
  tx.objectStore('blobs').put(record);
  await txDone(tx);
  db.close();
}

export async function listOutboxBlobs(outboxId: string): Promise<OutboxBlobRecord[]> {
  const db = await openDb();
  const tx = db.transaction('blobs', 'readonly');
  const req = tx.objectStore('blobs').index('by_outbox').getAll(outboxId);
  const rows = await new Promise<OutboxBlobRecord[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OutboxBlobRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function putCache(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('cache', 'readwrite');
  const record: CacheRecord = { key, value, updatedAt: Date.now() };
  tx.objectStore('cache').put(record);
  await txDone(tx);
  db.close();
}

export async function getCache<T>(key: string): Promise<{ value: T; updatedAt: number } | null> {
  const db = await openDb();
  const tx = db.transaction('cache', 'readonly');
  const req = tx.objectStore('cache').get(key);
  const row = await new Promise<CacheRecord | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as CacheRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  if (!row) return null;
  return { value: row.value as T, updatedAt: row.updatedAt };
}

export function newClientMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
