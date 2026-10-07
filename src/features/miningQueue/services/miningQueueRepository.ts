// miningQueueRepository — background-owned IndexedDB store for the mining
// queue (spec mining-queue.md §Data). Own isolated DB `orca-mining-queue` v1
// so queue storage never collides with the per-lang dictionary DBs or the
// local-player DB. All callers reach it via QUEUE_* messages — content
// scripts cannot touch extension-origin IDB directly (spec REQ-7 rules).

import { awaitTx } from '@/features/dictionary';
import { generateId } from '@/features/srs';
import type {
  MiningQueueInput,
  MiningQueueItem,
  MiningQueueRow,
} from '@/entities/miningQueue';
import {
  buildQueueItem,
  evictOverflow,
  toQueueRow,
} from '../logic/queueLogic';

export const MINING_QUEUE_DB = 'orca-mining-queue';
export const MINING_QUEUE_DB_VERSION = 1;
const ITEMS_STORE = 'items';
const IDX_DEDUPE = 'by_dedupeKey';
const IDX_CREATED = 'by_createdAt';

let dbPromise: Promise<IDBDatabase> | null = null;
let dbInstance: IDBDatabase | null = null;

function openQueueDB(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(MINING_QUEUE_DB, MINING_QUEUE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        const store = db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
        store.createIndex(IDX_DEDUPE, 'dedupeKey', { unique: false });
        store.createIndex(IDX_CREATED, 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        if (dbInstance === db) dbInstance = null;
        dbPromise = null;
      };
      dbInstance = db;
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('mining-queue: IndexedDB open blocked'));
    };
  });
  return dbPromise;
}

/** Close the cached connection (test cleanup). */
export function closeQueueDB(): void {
  dbInstance?.close();
  dbInstance = null;
  dbPromise = null;
}

function idbValue<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbAll<T>(req: IDBRequest<T[]>): Promise<T[]> {
  return idbValue<T[]>(req);
}

/**
 * Add (or dedupe-refresh) a queue item in one transaction.
 * Same dedupeKey already queued → its `createdAt` bumps to now, no new row
 * (spec REQ-1 rules). After the write, rows beyond the cap evict oldest-first
 * (spec REQ-8).
 */
export async function addQueueItem(
  input: MiningQueueInput,
  now: number = Date.now(),
): Promise<{ item: MiningQueueItem; deduped: boolean }> {
  const db = await openQueueDB();
  const tx = db.transaction(ITEMS_STORE, 'readwrite');
  const store = tx.objectStore(ITEMS_STORE);

  const item = buildQueueItem(input, generateId(), now);
  const existing = await idbAll<MiningQueueItem>(store.index(IDX_DEDUPE).getAll(item.dedupeKey));

  if (existing.length > 0) {
    for (const row of existing) {
      store.put({ ...row, createdAt: now });
    }
  } else {
    store.put(item);
  }

  const allRows = await idbAll<Pick<MiningQueueItem, 'id' | 'createdAt'>>(store.getAll());
  for (const id of evictOverflow(allRows)) {
    store.delete(id);
  }

  await awaitTx(tx);
  return {
    item: existing[0] ? { ...existing[0], createdAt: now } : item,
    deduped: existing.length > 0,
  };
}

/** All queued rows newest-first, projected lean (spec §Data projection). */
export async function listQueueRows(): Promise<MiningQueueRow[]> {
  const db = await openQueueDB();
  const tx = db.transaction(ITEMS_STORE, 'readonly');
  const rows = await idbAll<MiningQueueItem>(tx.objectStore(ITEMS_STORE).getAll());
  await awaitTx(tx);
  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toQueueRow);
}

/** Full item including the snapshot — cardify/quick-add replays it. */
export async function getQueueItem(id: string): Promise<MiningQueueItem | undefined> {
  const db = await openQueueDB();
  const tx = db.transaction(ITEMS_STORE, 'readonly');
  const item = await idbValue<MiningQueueItem | undefined>(tx.objectStore(ITEMS_STORE).get(id));
  await awaitTx(tx);
  return item;
}

export async function removeQueueItem(id: string): Promise<boolean> {
  const db = await openQueueDB();
  const tx = db.transaction(ITEMS_STORE, 'readwrite');
  const store = tx.objectStore(ITEMS_STORE);
  const existing = await idbValue<MiningQueueItem | undefined>(store.get(id));
  if (existing) store.delete(id);
  await awaitTx(tx);
  return existing !== undefined;
}

/** Used by tests + cap bookkeeping. */
export async function countQueueItems(): Promise<number> {
  const db = await openQueueDB();
  const tx = db.transaction(ITEMS_STORE, 'readonly');
  const count = await idbValue<number>(tx.objectStore(ITEMS_STORE).count());
  await awaitTx(tx);
  return count;
}
