/** statusSyncStorage — IndexedDB for ankiStatusSync: card links, sync state,
 *  write-back queue, bounded write-back log. Extension-origin only. */

import type {
  AnkiCardLink,
  AnkiStatusSyncState,
  WriteBackLogEntry,
  WriteBackTask,
} from '@/entities/ankiStatusSync';
import { EMPTY_ANKI_SYNC_STATE } from '@/entities/ankiStatusSync';

const DB_NAME = 'cell-anki-status-sync';
const DB_VERSION = 1;

export const AKS_STORES = {
  LINKS: 'links',
  STATE: 'state',
  WB_QUEUE: 'writebackQueue',
  WB_LOG: 'writebackLog',
} as const;

const WB_LOG_CAP = 200;
export const WB_TASK_TTL_MS = 24 * 60 * 60 * 1000;

let dbCache: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbCache) return Promise.resolve(dbCache);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AKS_STORES.LINKS)) {
        const links = db.createObjectStore(AKS_STORES.LINKS, { keyPath: 'cardId' });
        links.createIndex('by_term', 'term', { unique: false });
      }
      if (!db.objectStoreNames.contains(AKS_STORES.STATE)) {
        db.createObjectStore(AKS_STORES.STATE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(AKS_STORES.WB_QUEUE)) {
        db.createObjectStore(AKS_STORES.WB_QUEUE, { keyPath: 'cardId' });
      }
      if (!db.objectStoreNames.contains(AKS_STORES.WB_LOG)) {
        db.createObjectStore(AKS_STORES.WB_LOG, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        if (dbCache === db) dbCache = null;
      };
      dbCache = db;
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('open status-sync db failed'));
  });
}

export function closeStatusSyncDb(): void {
  dbCache?.close();
  dbCache = null;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('idb request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('idb tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('idb tx aborted'));
  });
}

export async function putLinks(links: readonly AnkiCardLink[]): Promise<void> {
  if (links.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.LINKS, 'readwrite');
  const store = tx.objectStore(AKS_STORES.LINKS);
  for (const link of links) await req(store.put({ ...link }));
  await txDone(tx);
}

export async function deleteLinks(cardIds: readonly number[]): Promise<void> {
  if (cardIds.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.LINKS, 'readwrite');
  const store = tx.objectStore(AKS_STORES.LINKS);
  for (const id of cardIds) await req(store.delete(id));
  await txDone(tx);
}

export async function getLinksByTerm(term: string): Promise<readonly AnkiCardLink[]> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.LINKS, 'readonly');
  const rows = (await req(tx.objectStore(AKS_STORES.LINKS).index('by_term').getAll(term))) as
    AnkiCardLink[];
  await txDone(tx);
  return rows;
}

export async function getAllLinks(): Promise<readonly AnkiCardLink[]> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.LINKS, 'readonly');
  const rows = (await req(tx.objectStore(AKS_STORES.LINKS).getAll())) as AnkiCardLink[];
  await txDone(tx);
  return rows;
}

export async function putLink(link: AnkiCardLink): Promise<void> {
  await putLinks([link]);
}

export async function getSyncState(): Promise<AnkiStatusSyncState> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.STATE, 'readonly');
  const row = await req(tx.objectStore(AKS_STORES.STATE).get('state')) as
    | (AnkiStatusSyncState & { key: string })
    | undefined;
  await txDone(tx);
  return row ? { ...EMPTY_ANKI_SYNC_STATE, ...row } : EMPTY_ANKI_SYNC_STATE;
}

export async function putSyncState(state: AnkiStatusSyncState): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.STATE, 'readwrite');
  await req(tx.objectStore(AKS_STORES.STATE).put({ key: 'state', ...state }));
  await txDone(tx);
}

export async function enqueueWriteBack(task: WriteBackTask): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.WB_QUEUE, 'readwrite');
  await req(tx.objectStore(AKS_STORES.WB_QUEUE).put({ ...task }));
  await txDone(tx);
}

export async function dequeueWriteBack(cardId: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.WB_QUEUE, 'readwrite');
  await req(tx.objectStore(AKS_STORES.WB_QUEUE).delete(cardId));
  await txDone(tx);
}

export async function listWriteBackQueue(now: number): Promise<readonly WriteBackTask[]> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.WB_QUEUE, 'readonly');
  const rows = (await req(tx.objectStore(AKS_STORES.WB_QUEUE).getAll())) as WriteBackTask[];
  await txDone(tx);
  return rows.filter((t) => now - t.enqueuedAt < WB_TASK_TTL_MS);
}

export async function appendWriteBackLog(entry: WriteBackLogEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.WB_LOG, 'readwrite');
  const store = tx.objectStore(AKS_STORES.WB_LOG);
  await req(store.put({ key: `${entry.at}:${entry.cardId}`, ...entry }));
  const count = await req(store.count());
  if (count > WB_LOG_CAP) {
    const cursor = await new Promise<IDBCursorWithValue | null>((resolve, reject) => {
      const r = store.openCursor();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (cursor) await req(cursor.delete());
  }
  await txDone(tx);
}

export async function listWriteBackLog(): Promise<readonly WriteBackLogEntry[]> {
  const db = await openDb();
  const tx = db.transaction(AKS_STORES.WB_LOG, 'readonly');
  const rows = (await req(
    tx.objectStore(AKS_STORES.WB_LOG).getAll(),
  )) as (WriteBackLogEntry & { key: string })[];
  await txDone(tx);
  return rows.map(({ key: _key, ...entry }) => entry);
}
