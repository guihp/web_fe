/**
 * Rascunho local das fotos do Meu roteiro (IndexedDB / mesma base do outbox).
 * Sobrevive a fechar o app, reiniciar o aparelho e ficar offline —
 * até o envio definitivo (ou troca da foto).
 */
import { compressImageForUpload } from '../lib/compressImage';
import { listOutboxBlobs, putOutboxBlob } from '../lib/offlineDb';
import { todayDateKeyBRT } from './senhaDoDiaService';

export type PromotorDraftKind = 'antes' | 'depois';

function draftId(
  usuarioId: number,
  lojaId: number,
  industria: string,
  dia = todayDateKeyBRT(),
): string {
  const ind = industria
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .slice(0, 80);
  return `promotor-draft:${usuarioId}:${lojaId}:${ind}:${dia}`;
}

async function blobToFile(blob: Blob, fileName: string, mimeType: string): Promise<File> {
  return new File([blob], fileName || 'foto.jpg', {
    type: mimeType || blob.type || 'image/jpeg',
  });
}

async function deleteDraftBlobs(draftKey: string): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('fe-offline-sync', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB.'));
  });
  const tx = db.transaction('blobs', 'readwrite');
  const keysReq = tx.objectStore('blobs').index('by_outbox').getAllKeys(draftKey);
  await new Promise<void>((resolve, reject) => {
    keysReq.onsuccess = () => {
      for (const key of (keysReq.result as IDBValidKey[]) ?? []) {
        tx.objectStore('blobs').delete(key);
      }
      resolve();
    };
    keysReq.onerror = () => reject(keysReq.error);
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao limpar rascunho.'));
  });
  db.close();
}

/** Grava (ou substitui) uma foto do rascunho no aparelho. */
export async function savePromotorDraftFoto(input: {
  usuarioId: number;
  lojaId: number;
  industria: string;
  kind: PromotorDraftKind;
  file: File;
}): Promise<void> {
  const industria = input.industria.trim();
  if (!industria) return;

  const id = draftId(input.usuarioId, input.lojaId, industria);
  const compressed = await compressImageForUpload(input.file);
  await putOutboxBlob({
    id: `${id}:${input.kind}`,
    outboxId: id,
    kind: input.kind,
    blob: compressed,
    mimeType: compressed.type || 'image/jpeg',
    fileName: compressed.name || `${input.kind}.jpg`,
  });
}

export type PromotorDraftFotos = {
  fotoAntes: File | null;
  fotoDepois: File | null;
};

/** Lê o rascunho do dia corrente (BRT). */
export async function loadPromotorDraftFotos(input: {
  usuarioId: number;
  lojaId: number;
  industria: string;
}): Promise<PromotorDraftFotos> {
  const industria = input.industria.trim();
  if (!industria) return { fotoAntes: null, fotoDepois: null };

  const blobs = await listOutboxBlobs(draftId(input.usuarioId, input.lojaId, industria));
  const antes = blobs.find((b) => b.kind === 'antes');
  const depois = blobs.find((b) => b.kind === 'depois');

  return {
    fotoAntes: antes
      ? await blobToFile(antes.blob, antes.fileName, antes.mimeType)
      : null,
    fotoDepois: depois
      ? await blobToFile(depois.blob, depois.fileName, depois.mimeType)
      : null,
  };
}

/** Remove o rascunho após envio bem-sucedido. */
export async function clearPromotorDraft(input: {
  usuarioId: number;
  lojaId: number;
  industria: string;
}): Promise<void> {
  const industria = input.industria.trim();
  if (!industria) return;
  await deleteDraftBlobs(draftId(input.usuarioId, input.lojaId, industria));
}
