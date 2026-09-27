// wordTrashStore — 24h soft-delete window for word statuses (spec REQ-7..12).
//
// A removed word keeps a record in langWordTrash ({term, previousStatus,
// trashedAt}) for 24h so Remove is recoverable. Trash and restore run as
// single multi-store transactions so a term never lands in both stores.
// Expired records purge lazily on list reads.

import { getDB, awaitTx, STORES } from '@/features/dictionary/repositories/baseRepository';
import type { WordStatus } from '@/entities/dictionary';
import type { WordStatusEntry } from './wordStatusStore';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, scopeForTarget, targetOf } from '@/features/sync';

export interface TrashedWordEntry {
  readonly term: string;
  readonly previousStatus: WordStatus;
  readonly trashedAt: number;
}

export const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

const RESTORE_FALLBACK_STATUS: WordStatus = 'tracking';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Soft-delete: read the status row, write a trash record, delete the row —
 * one tx, so the word is never in both stores. previousStatus derives from
 * the stored row, never the client. No status row → no-op (idempotent).
 */
export async function trashWordStatus(langCode: string, term: string): Promise<void> {
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.WORD_STATUS, STORES.WORD_TRASH, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const statusStore = tx.objectStore(STORES.WORD_STATUS);
  const trashStore = tx.objectStore(STORES.WORD_TRASH);
  const row = (await request(statusStore.get(term))) as WordStatusEntry | undefined;
  if (row !== undefined) {
    trashStore.put({ term, previousStatus: row.status, trashedAt: Date.now() });
    statusStore.delete(term);
    if (isCaptureEnabled()) {
      await captureChange(statusStore, {
        scope: scopeForTarget(targetOf(langCode)),
        dataClass: 'wordStatus',
        key: `word:${term}`,
        op: 'delete',
      });
    }
  }
  await awaitTx(tx);
}

/**
 * Read trash with lazy purge: expired records and records whose term already
 * has a status row (status wins) are deleted in the same tx scope, then
 * survivors return ordered trashedAt desc. Purge failure does not fail the read.
 */
export async function listWordTrash(langCode: string): Promise<TrashedWordEntry[]> {
  const db = await getDB(langCode);
  const tx = db.transaction([STORES.WORD_TRASH, STORES.WORD_STATUS], 'readwrite');
  const trashStore = tx.objectStore(STORES.WORD_TRASH);
  const statusStore = tx.objectStore(STORES.WORD_STATUS);
  const [entries, statusKeys] = await Promise.all([
    request(trashStore.getAll()) as Promise<TrashedWordEntry[]>,
    request(statusStore.getAllKeys()),
  ]);
  const cutoff = Date.now() - TRASH_TTL_MS;
  const marked = new Set(statusKeys.map(String));
  const survivors: TrashedWordEntry[] = [];
  for (const entry of entries) {
    if (entry.trashedAt < cutoff || marked.has(entry.term)) {
      trashStore.delete(entry.term);
    } else {
      survivors.push(entry);
    }
  }
  await awaitTx(tx);
  return survivors.sort((a, b) => b.trashedAt - a.trashedAt);
}

/**
 * Purge expired/reconciled trash without returning entries — run on
 * WORD_STATUS_LIST reads so trash cannot linger when the trash view is
 * never opened. Never touches langWordStatus.
 */
export async function purgeExpiredTrash(langCode: string): Promise<void> {
  await listWordTrash(langCode);
}

/**
 * Restore a trashed word: write {previousStatus, updatedAt: now} to the
 * status store and delete the trash record — one tx. Missing/corrupt
 * previousStatus falls back to 'tracking'; missing trash record →
 * success (idempotent). Returns the restored status.
 */
export async function restoreWordStatus(langCode: string, term: string): Promise<WordStatus> {
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.WORD_TRASH, STORES.WORD_STATUS, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const trashStore = tx.objectStore(STORES.WORD_TRASH);
  const statusStore = tx.objectStore(STORES.WORD_STATUS);
  const record = (await request(trashStore.get(term))) as TrashedWordEntry | undefined;
  if (record === undefined) {
    await awaitTx(tx);
    return RESTORE_FALLBACK_STATUS;
  }
  const status = record.previousStatus ?? RESTORE_FALLBACK_STATUS;
  statusStore.put({ term, status, updatedAt: Date.now() });
  trashStore.delete(term);
  if (isCaptureEnabled()) {
    await captureChange(statusStore, {
      scope: scopeForTarget(targetOf(langCode)),
      dataClass: 'wordStatus',
      key: `word:${term}`,
      op: 'put',
    });
  }
  await awaitTx(tx);
  return status;
}

/** Delete a trash record permanently (delete-forever or re-mark cleanup). */
export async function deleteWordTrash(langCode: string, term: string): Promise<void> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_TRASH, 'readwrite');
  tx.objectStore(STORES.WORD_TRASH).delete(term);
  await awaitTx(tx);
}
