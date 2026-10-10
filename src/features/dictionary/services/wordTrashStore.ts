// wordTrashStore — 24h soft-delete window for word statuses (spec REQ-7..12).
//
// A removed word keeps a record in langWordTrash ({term, previousStatus,
// trashedAt}) for 24h so Remove is recoverable. Trash and restore run as
// single multi-store transactions so a term never lands in both stores.
// Expired records purge lazily on list reads.

import { getDB, awaitTx, STORES } from '@/features/dictionary/repositories/baseRepository';
import type { WordStatus } from '@/entities/dictionary';
import type { WordStatusEntry } from './wordStatusStore';
import { normalizeStoredStatus, type StoredWordStatus } from './wordStatusSemantics';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, scopeForTarget, targetOf } from '@/features/sync';

export interface TrashedWordEntry {
  readonly term: string;
  readonly previousStatus: WordStatus;
  readonly trashedAt: number;
}

export const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

const RESTORE_FALLBACK_STATUS: WordStatus = 'tracking';

/** Legacy `learning` values stored before the tracking/hasCard split — both
 *  status rows copied into trash and trash records written by older builds. */
function normalizePreviousStatus(status: StoredWordStatus): WordStatus {
  return normalizeStoredStatus(status);
}

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
    trashStore.put({ term, previousStatus: normalizePreviousStatus(row.status as StoredWordStatus), trashedAt: Date.now() });
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
      const previousStatus = normalizePreviousStatus(entry.previousStatus as StoredWordStatus);
      survivors.push(previousStatus === entry.previousStatus ? entry : { ...entry, previousStatus });
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

/** Batch variant of trashWordStatus — one tx over the same stores; per-term
 *  semantics identical (trash record from the stored row's status, no status
 *  row → skip). */
export async function trashWordStatuses(
  langCode: string,
  terms: readonly string[],
): Promise<void> {
  if (terms.length === 0) return;
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.WORD_STATUS, STORES.WORD_TRASH, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const statusStore = tx.objectStore(STORES.WORD_STATUS);
  const trashStore = tx.objectStore(STORES.WORD_TRASH);
  const rows = await Promise.all(
    terms.map((term) => request(statusStore.get(term)) as Promise<WordStatusEntry | undefined>),
  );
  const now = Date.now();
  for (const [i, term] of terms.entries()) {
    const row = rows[i];
    if (row === undefined) continue;
    trashStore.put({ term, previousStatus: normalizePreviousStatus(row.status as StoredWordStatus), trashedAt: now });
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
  const status = record.previousStatus === undefined
    ? RESTORE_FALLBACK_STATUS
    : normalizePreviousStatus(record.previousStatus as StoredWordStatus);
  const now = Date.now();
  statusStore.put({ term, status, updatedAt: now, source: 'user', sourceAt: now });
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

/** Batch variant of restoreWordStatus — one tx; per-term semantics identical
 *  (missing record → skipped, corrupt previousStatus → 'tracking'). Returns
 *  the term → restored-status map for terms that were actually restored. */
export async function restoreWordStatuses(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, WordStatus>> {
  const restored = new Map<string, WordStatus>();
  if (terms.length === 0) return restored;
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.WORD_TRASH, STORES.WORD_STATUS, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const trashStore = tx.objectStore(STORES.WORD_TRASH);
  const statusStore = tx.objectStore(STORES.WORD_STATUS);
  const records = await Promise.all(
    terms.map((term) => request(trashStore.get(term)) as Promise<TrashedWordEntry | undefined>),
  );
  const now = Date.now();
  for (const [i, term] of terms.entries()) {
    const record = records[i];
    if (record === undefined) continue;
    const status = record.previousStatus === undefined
      ? RESTORE_FALLBACK_STATUS
      : normalizePreviousStatus(record.previousStatus as StoredWordStatus);
    statusStore.put({ term, status, updatedAt: now, source: 'user', sourceAt: now });
    trashStore.delete(term);
    restored.set(term, status);
    if (isCaptureEnabled()) {
      await captureChange(statusStore, {
        scope: scopeForTarget(targetOf(langCode)),
        dataClass: 'wordStatus',
        key: `word:${term}`,
        op: 'put',
      });
    }
  }
  await awaitTx(tx);
  return restored;
}

/** Delete a trash record permanently (delete-forever or re-mark cleanup). */
export async function deleteWordTrash(langCode: string, term: string): Promise<void> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_TRASH, 'readwrite');
  tx.objectStore(STORES.WORD_TRASH).delete(term);
  await awaitTx(tx);
}
