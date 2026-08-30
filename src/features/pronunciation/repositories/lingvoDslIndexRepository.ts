/**
 * IndexedDB repository for the Lingvo DSL audio index.
 *
 * Maps packageId + term -> audio file paths. Designed to support multiple
 * local packages in the future; for MVP a single package is used at a time.
 *
 * ponytail: stores one record per term. For very large dictionaries this is
 * fine; bulk put is used during indexing to avoid thousands of round-trips.
 */

import type { LingvoDslIndexEntry } from '../services/lingvoDslParser';

const DB_NAME = 'cell-local-audio-index';
const STORE_NAME = 'lingvoDslIndex';
const DB_VERSION = 1;

interface StoredEntry {
  readonly id: string;
  readonly packageId: string;
  readonly term: string;
  readonly audioPaths: readonly string[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('packageId_term', ['packageId', 'term'], { unique: true });
      }
    };
  });
}

function toStored(entry: LingvoDslIndexEntry): StoredEntry {
  return {
    id: entry.id,
    packageId: entry.packageId,
    term: entry.term,
    audioPaths: entry.audioPaths,
  };
}

/** Save a batch of parsed DSL index entries, replacing existing ones by id. */
export async function saveLingvoDslIndex(
  _packageId: string,
  entries: readonly LingvoDslIndexEntry[],
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const entry of entries) {
      store.put(toStored(entry));
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to save DSL index'));
    });
  } finally {
    db.close();
  }
}

/** Look up audio paths for a term in a package. */
export async function getLingvoDslAudioPaths(
  packageId: string,
  term: string,
): Promise<readonly string[] | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const id = `${packageId}:${term.toLowerCase()}`;
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as StoredEntry | undefined;
        resolve(record?.audioPaths);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to load DSL index entry'));
    });
  } finally {
    db.close();
  }
}

/** Delete all stored entries for a package. */
export async function clearLingvoDslIndex(packageId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('packageId_term');
    // Range that covers every term for this packageId on the compound index.
    const range = IDBKeyRange.bound([packageId, ''], [packageId, '\uFFFF']);
    return new Promise((resolve, reject) => {
      const cursorReq = index.openCursor(range);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('Failed to clear DSL index'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Transaction error during clear'));
    });
  } finally {
    db.close();
  }
}
