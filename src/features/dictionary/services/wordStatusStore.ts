// wordStatusStore — spec §D1: IndexedDB 5-status cycle for words.
//
// Status cycle: unknown → tracking → known → ignore → unknown (loop).
// Keyed by term (unique). The popup footer cycles status on click.
//
// Storage: langWordStatus store, keyPath 'term', index by_status.
// Quota exceeded (spec §10 failure path): graceful — status not saved,
// caller shows toast, lookup still works with existing data.

import { getDB, awaitTx, STORES } from '@/features/dictionary/repositories/baseRepository';
import { STATUS_CYCLE, type WordStatus } from '@/entities/dictionary';
import { decideStatusWrite, type WordStatusSource } from '@/features/dictionary/services/wordStatusArbitration';
import { t } from '@/shared/i18n';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, scopeForTarget, targetOf } from '@/features/sync';

const WORD_WRITE_STORES = [STORES.WORD_STATUS, STORES.WORD_TRASH, STORES.SYNC_OUTBOX, STORES.SYNC_META];

export { STATUS_CYCLE };

/** Separator between term and pos inside a composite pos-status key
 *  (spec pos-dictionary-variants REQ-8): `term␟pos`, ␟ = U+241F. */
export const POS_KEY_SEP = '␟';

/** Composite status-store key for a (term, pos) variant. */
export function posStatusKey(term: string, pos: string): string {
  return `${term}${POS_KEY_SEP}${pos}`;
}

/** Inverse of posStatusKey — returns undefined for plain term keys. */
export function splitPosKey(key: string): { term: string; pos: string } | undefined {
  const i = key.indexOf(POS_KEY_SEP);
  if (i <= 0 || i === key.length - 1) return undefined;
  return { term: key.slice(0, i), pos: key.slice(i + 1) };
}

/** Word status entry — 1 row per term, or per (term␟pos) variant
 *  (langWordStatus store). */
export interface WordStatusEntry {
  /** The term (unique key) — literal `term␟pos` on pos rows. */
  readonly term: string;
  /** Normalized pos — convenience field mirroring the key suffix (pos rows only). */
  readonly pos?: string;
  /** The status: unknown | tracking | learning | known | ignore. */
  readonly status: WordStatus;
  /** Last updated timestamp (ms). */
  readonly updatedAt: number;
  /** Write provenance — who produced this status. Absent on legacy rows = user. */
  readonly source?: WordStatusSource;
  /** Origin event timestamp (ms). For sync writes this is the source system's
   *  change time (e.g. Anki card `mod`), for user writes it equals updatedAt. */
  readonly sourceAt?: number;
}

/** Error thrown when IndexedDB quota is exceeded. */
export class WordStatusQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordStatusQuotaError';
  }
}

/** Check if an error is a QuotaExceededError (IDB or DOM). */
function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') return true;
  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    return lower.includes('quota') || lower.includes('storage') || lower.includes('full');
  }
  return false;
}

/** The 5-status cycle order lives in entities/dictionary (spec §D1). */

/** Get the next status in the cycle. */
export function nextStatus(current: WordStatus): WordStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

/** Default status for a word not in the store. */
export const DEFAULT_STATUS: WordStatus = 'unknown';

/** Least-learned ordering for status aggregation (spec REQ-9). 'ignore' is
 *  excluded unless every variant is ignored. */
const LEARNED_RANK: Record<WordStatus, number> = {
  unknown: 0, tracking: 1, learning: 2, known: 3, ignore: 4,
};

/** Aggregate a term-level status from resolved per-variant statuses.
 *  variantPoses: dictionary-informed variant set when the caller has it;
 *  absent → hot-path approximation over materialized pos rows only
 *  (spec REQ-9 alt flow). */
export function aggregatePosStatus(
  termStatus: WordStatus | undefined,
  posStatuses: ReadonlyMap<string, WordStatus>,
  variantPoses?: readonly string[],
): WordStatus {
  const poses = variantPoses?.length ? variantPoses : [...posStatuses.keys()];
  if (!poses.length) return termStatus ?? DEFAULT_STATUS;
  const resolved = poses.map((p) => posStatuses.get(p) ?? termStatus ?? DEFAULT_STATUS);
  const live = resolved.filter((s) => s !== 'ignore');
  if (!live.length) return 'ignore';
  let best: WordStatus = 'known';
  for (const s of live) if (LEARNED_RANK[s] < LEARNED_RANK[best]) best = s;
  return best;
}

/** Get the status for a term. Returns 'unknown' if not stored. */
export async function getWordStatus(langCode: string, term: string): Promise<WordStatus> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  return new Promise((resolve, reject) => {
    const req = store.get(term);
    req.onsuccess = () => {
      const entry = req.result as WordStatusEntry | undefined;
      resolve(entry?.status ?? DEFAULT_STATUS);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get statuses for multiple terms in one transaction. Terms with pos rows
 *  fold to the least-learned aggregate over materialized rows (spec REQ-9
 *  hot-path approximation). */
export async function getWordStatuses(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, WordStatus>> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  const result = new Map<string, WordStatus>();
  await Promise.all(
    terms.map(
      (term) =>
        new Promise<void>((resolve, reject) => {
          const req = store.get(term);
          req.onsuccess = () => {
            const entry = req.result as WordStatusEntry | undefined;
            result.set(term, entry?.status ?? DEFAULT_STATUS);
            resolve();
          };
          req.onerror = () => reject(req.error);
        }),
    ),
  );
  const posRows = await getPosStatuses(langCode, terms);
  for (const [term, rows] of posRows) {
    result.set(term, aggregatePosStatus(result.get(term), rows));
  }
  return result;
}

/**
 * Set the status for a term (upsert).
 * 'unknown' normalizes to a status-row delete — only tracking|known|ignore
 * rows are ever persisted (single normalization point; 'unknown' writes do
 * NOT touch pending trash records so an unmarked word keeps its recovery
 * window). A successful real-status write clears any pending trash record —
 * re-marking cancels pending deletion.
 * Throws WordStatusQuotaError on IDB quota exceeded (spec §10 failure path).
 * Caller should catch + show toast "Bộ nhớ đầy — xóa resource cũ".
 * Lookup still works with existing data — graceful degradation.
 */
export async function setWordStatus(
  langCode: string,
  term: string,
  status: WordStatus,
  provenance?: { source?: WordStatusSource; sourceAt?: number },
): Promise<void> {
  try {
    const db = await getDB(langCode);
    await ensureSyncRuntime();
    const capture = isCaptureEnabled();
    const scope = scopeForTarget(targetOf(langCode));
    if (status === 'unknown') {
      const tx = db.transaction(WORD_WRITE_STORES, 'readwrite');
      const store = tx.objectStore(STORES.WORD_STATUS);
      store.delete(term);
      if (capture) {
        await captureChange(store, { scope, dataClass: 'wordStatus', key: `word:${term}`, op: 'delete' });
      }
      await awaitTx(tx);
      return;
    }
    const now = Date.now();
    const tx = db.transaction(WORD_WRITE_STORES, 'readwrite');
    const store = tx.objectStore(STORES.WORD_STATUS);
    store.put({
      term,
      status,
      updatedAt: now,
      source: provenance?.source ?? 'user',
      sourceAt: provenance?.sourceAt ?? now,
    });
    tx.objectStore(STORES.WORD_TRASH).delete(term);
    if (capture) {
      await captureChange(store, { scope, dataClass: 'wordStatus', key: `word:${term}`, op: 'put' });
    }
    await awaitTx(tx);
  } catch (err) {
    if (isQuotaError(err)) {
      throw new WordStatusQuotaError(t('dict.error.statusQuota'));
    }
    throw err;
  }
}

/** Sync-originated status write — arbitrates against the stored entry via
 *  last-write-wins (candidate sourceAt vs stored sourceAt/updatedAt, source
 *  priority tiebreak, never downgrades 'known'). Returns true when written. */
export async function setWordStatusFromSync(
  langCode: string,
  term: string,
  status: Exclude<WordStatus, 'unknown'>,
  provenance: { source: Exclude<WordStatusSource, 'user'>; sourceAt: number },
): Promise<boolean> {
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const capture = isCaptureEnabled();
  const scope = scopeForTarget(targetOf(langCode));
  const now = Date.now();
  const tx = db.transaction(WORD_WRITE_STORES, 'readwrite');
  const store = tx.objectStore(STORES.WORD_STATUS);
  const existing = await new Promise<WordStatusEntry | undefined>((resolve, reject) => {
    const req = store.get(term);
    req.onsuccess = () => resolve(req.result as WordStatusEntry | undefined);
    req.onerror = () => reject(req.error);
  });
  const decision = decideStatusWrite(existing, {
    status,
    source: provenance.source,
    sourceAt: provenance.sourceAt,
  });
  if (decision === 'skip') {
    await awaitTx(tx);
    return false;
  }
  store.put({
    term,
    status,
    updatedAt: now,
    source: provenance.source,
    sourceAt: provenance.sourceAt,
  });
  tx.objectStore(STORES.WORD_TRASH).delete(term);
  if (capture) {
    await captureChange(store, { scope, dataClass: 'wordStatus', key: `word:${term}`, op: 'put' });
  }
  await awaitTx(tx);
  return true;
}

export interface SyncStatusUpdate {
  readonly term: string;
  readonly status: Exclude<WordStatus, 'unknown'>;
  readonly sourceAt: number;
}

/** Batch variant of setWordStatusFromSync for sync passes that write many
 *  terms at once — one transaction + pipelined gets instead of N sequential
 *  transactions. Arbitration (decideStatusWrite) is applied per term exactly
 *  as in the single-write path. Transaction-level failure (quota, abort)
 *  rejects the whole batch — matching the per-term outcome under a
 *  persistent failure mode, where every term would fail anyway. */
export async function setWordStatusesFromSync(
  langCode: string,
  updates: readonly SyncStatusUpdate[],
  provenance: { source: Exclude<WordStatusSource, 'user'> },
): Promise<{ written: number }> {
  if (updates.length === 0) return { written: 0 };
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const capture = isCaptureEnabled();
  const scope = scopeForTarget(targetOf(langCode));
  const now = Date.now();
  const tx = db.transaction(WORD_WRITE_STORES, 'readwrite');
  try {
    const store = tx.objectStore(STORES.WORD_STATUS);
    const trashStore = tx.objectStore(STORES.WORD_TRASH);
    const existing = await Promise.all(
      updates.map(
        (u) =>
          new Promise<WordStatusEntry | undefined>((resolve, reject) => {
            const req = store.get(u.term);
            req.onsuccess = () => resolve(req.result as WordStatusEntry | undefined);
            req.onerror = () => reject(req.error);
          }),
      ),
    );
    let written = 0;
    for (const [i, u] of updates.entries()) {
      const decision = decideStatusWrite(existing[i], {
        status: u.status,
        source: provenance.source,
        sourceAt: u.sourceAt,
      });
      if (decision === 'skip') continue;
      store.put({
        term: u.term,
        status: u.status,
        updatedAt: now,
        source: provenance.source,
        sourceAt: u.sourceAt,
      });
      trashStore.delete(u.term);
      if (capture) {
        await captureChange(store, { scope, dataClass: 'wordStatus', key: `word:${u.term}`, op: 'put' });
      }
      written += 1;
    }
    await awaitTx(tx);
    return { written };
  } catch (err) {
    if (isQuotaError(err)) {
      throw new WordStatusQuotaError(t('dict.error.statusQuota'));
    }
    throw err;
  }
}

/**
 * Cycle the status for a term: get current → next → set.
 * On quota error: returns the next status (UI updates) but throws
 * WordStatusQuotaError so caller can show toast. The status is not
 * persisted — next lookup will show the old status. Graceful degradation.
 */
export async function cycleWordStatus(langCode: string, term: string): Promise<WordStatus> {
  const current = await getWordStatus(langCode, term);
  const next = nextStatus(current);
  await setWordStatus(langCode, term, next);
  return next;
}

/** Delete the status entry for a term — also clears any pending trash record
 *  so an intentionally deleted word keeps no restorable record (spec REQ-12). */
export async function deleteWordStatus(langCode: string, term: string): Promise<void> {
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const tx = db.transaction(WORD_WRITE_STORES, 'readwrite');
  const store = tx.objectStore(STORES.WORD_STATUS);
  store.delete(term);
  tx.objectStore(STORES.WORD_TRASH).delete(term);
  if (isCaptureEnabled()) {
    await captureChange(store, { scope: scopeForTarget(targetOf(langCode)), dataClass: 'wordStatus', key: `word:${term}`, op: 'delete' });
  }
  await awaitTx(tx);
}

/** Get every stored word-status entry for a lang. Legacy `unknown` rows found
 *  on read are deleted in the same tx (sweep) — only the 3 statuses persist. */
export async function getAllWordStatuses(langCode: string): Promise<WordStatusEntry[]> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readwrite');
  const store = tx.objectStore(STORES.WORD_STATUS);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const entries = req.result as WordStatusEntry[];
      const live = entries.filter((e) => {
        if (e.status === 'unknown') {
          store.delete(e.term);
          return false;
        }
        return true;
      });
      tx.oncomplete = () => resolve(live);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get all terms with a given status. */
export async function getTermsByStatus(langCode: string, status: WordStatus): Promise<string[]> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  const index = store.index('by_status');
  return new Promise((resolve, reject) => {
    const req = index.getAll(status);
    req.onsuccess = () => {
      const entries = req.result as WordStatusEntry[];
      resolve(entries.map((e) => e.term));
    };
    req.onerror = () => reject(req.error);
  });
}

// === Pos-variant status (spec pos-dictionary-variants REQ-8) ===

/** Pos-keyed status rows for a term — prefix scan `term␟…` in one tx.
 *  Returns pos → status for rows that materialized. */
export async function getPosStatusRows(
  langCode: string,
  term: string,
): Promise<Map<string, WordStatus>> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  const lower = `${term}${POS_KEY_SEP}`;
  const range = IDBKeyRange.bound(lower, `${lower}\uffff`);
  return new Promise((resolve, reject) => {
    const req = store.getAll(range);
    req.onsuccess = () => {
      const rows = new Map<string, WordStatus>();
      for (const e of req.result as WordStatusEntry[]) {
        const split = splitPosKey(e.term);
        if (split) rows.set(split.pos, e.status);
      }
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Batch pos-row read — one tx, per-term `term␟…` prefix scan. Terms with no
 *  materialized pos rows are absent from the result map. */
export async function getPosStatuses(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, Map<string, WordStatus>>> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  const result = new Map<string, Map<string, WordStatus>>();
  await Promise.all(
    terms.map(
      (term) =>
        new Promise<void>((resolve, reject) => {
          const lower = `${term}${POS_KEY_SEP}`;
          const req = store.getAll(IDBKeyRange.bound(lower, `${lower}\uffff`));
          req.onsuccess = () => {
            const rows = new Map<string, WordStatus>();
            for (const e of req.result as WordStatusEntry[]) {
              const split = splitPosKey(e.term);
              if (split) rows.set(split.pos, e.status);
            }
            if (rows.size) result.set(term, rows);
            resolve();
          };
          req.onerror = () => reject(req.error);
        }),
    ),
  );
  return result;
}

/** Variant status read: `term␟pos` row ?? `term` row ?? 'unknown'. */
export async function getWordStatusPos(
  langCode: string,
  term: string,
  pos: string,
): Promise<WordStatus> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  return new Promise((resolve, reject) => {
    const posReq = store.get(posStatusKey(term, pos));
    posReq.onsuccess = () => {
      const posEntry = posReq.result as WordStatusEntry | undefined;
      if (posEntry) {
        resolve(posEntry.status);
        return;
      }
      const termReq = store.get(term);
      termReq.onsuccess = () =>
        resolve((termReq.result as WordStatusEntry | undefined)?.status ?? DEFAULT_STATUS);
      termReq.onerror = () => reject(termReq.error);
    };
    posReq.onerror = () => reject(posReq.error);
  });
}

/** Write a pos-variant status — same cycle/normalization as term writes:
 *  'unknown' deletes the composite key; real statuses clear the composite
 *  key's trash record and capture `word:term␟pos` for sync. */
export async function setWordStatusPos(
  langCode: string,
  term: string,
  pos: string,
  status: WordStatus,
  provenance?: { source?: WordStatusSource; sourceAt?: number },
): Promise<void> {
  if (!pos) return setWordStatus(langCode, term, status, provenance);
  const key = posStatusKey(term, pos);
  try {
    const db = await getDB(langCode);
    await ensureSyncRuntime();
    const capture = isCaptureEnabled();
    const scope = scopeForTarget(targetOf(langCode));
    if (status === 'unknown') {
      const tx = db.transaction(WORD_WRITE_STORES, 'readwrite');
      const store = tx.objectStore(STORES.WORD_STATUS);
      store.delete(key);
      if (capture) {
        await captureChange(store, { scope, dataClass: 'wordStatus', key: `word:${key}`, op: 'delete' });
      }
      await awaitTx(tx);
      return;
    }
    const now = Date.now();
    const tx = db.transaction(WORD_WRITE_STORES, 'readwrite');
    const store = tx.objectStore(STORES.WORD_STATUS);
    store.put({
      term: key,
      pos,
      status,
      updatedAt: now,
      source: provenance?.source ?? 'user',
      sourceAt: provenance?.sourceAt ?? now,
    });
    tx.objectStore(STORES.WORD_TRASH).delete(key);
    if (capture) {
      await captureChange(store, { scope, dataClass: 'wordStatus', key: `word:${key}`, op: 'put' });
    }
    await awaitTx(tx);
  } catch (err) {
    if (isQuotaError(err)) {
      throw new WordStatusQuotaError(t('dict.error.statusQuota'));
    }
    throw err;
  }
}

/** Cycle a pos-variant's status; returns the new status. Reads resolve
 *  through the term-row fallback before cycling. */
export async function cycleWordStatusPos(
  langCode: string,
  term: string,
  pos: string,
): Promise<WordStatus> {
  if (!pos) return cycleWordStatus(langCode, term);
  const current = await getWordStatusPos(langCode, term, pos);
  const next = nextStatus(current);
  await setWordStatusPos(langCode, term, pos, next);
  return next;
}
