// phraseIndexRepository — CRUD cho langPhraseIndex (ADR-037 §7.1).
//
// 1 row per dictionary resource. Value: { resourceId, compilerVersion, termCount, blob }.
// Blob is a compact ArrayBuffer produced by phraseIndexCompiler.

import { getDB, STORES, INDEXES } from './baseRepository';

/** Stored phrase index record (langPhraseIndex store). */
export interface StoredPhraseIndex {
  readonly resourceId: number;
  readonly compilerVersion: number;
  readonly termCount: number;
  readonly blob: ArrayBuffer;
}

/** Internal stored record — blob stored as Array<number> for structuredClone compat (fake-indexeddb/jsdom). */
interface InternalPhraseIndex {
  readonly resourceId: number;
  readonly compilerVersion: number;
  readonly termCount: number;
  readonly blob: number[];
}

/** Put a phrase index blob for a resource (insert or replace). */
export async function putPhraseIndex(
  langCode: string,
  resourceId: number,
  blob: ArrayBuffer,
  meta: { readonly compilerVersion: number; readonly termCount: number },
): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PHRASE_INDEX, 'readwrite');
    const store = tx.objectStore(STORES.PHRASE_INDEX);
    const record: InternalPhraseIndex = {
      resourceId,
      compilerVersion: meta.compilerVersion,
      termCount: meta.termCount,
      blob: Array.from(new Uint8Array(blob)),
    };
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Get a phrase index by resourceId. Returns undefined if not found. */
export async function getPhraseIndex(langCode: string, resourceId: number): Promise<StoredPhraseIndex | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PHRASE_INDEX, 'readonly');
    const store = tx.objectStore(STORES.PHRASE_INDEX);
    const request = store.get(resourceId);
    request.onsuccess = () => {
      try {
        const raw = request.result as InternalPhraseIndex | undefined;
        if (!raw) { resolve(undefined); return; }
        const blob = raw.blob;
        // blob is number[] (stored as Array); reconstruct ArrayBuffer.
        const ab = blob instanceof Uint8Array
          ? blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength) as ArrayBuffer
          : new Uint8Array(blob).buffer as ArrayBuffer;
        resolve({
          resourceId: raw.resourceId,
          compilerVersion: raw.compilerVersion,
          termCount: raw.termCount,
          blob: ab,
        });
      } catch (err) {
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

/** Check whether a phrase index exists for a resource. */
export async function hasPhraseIndex(langCode: string, resourceId: number): Promise<boolean> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PHRASE_INDEX, 'readonly');
    const store = tx.objectStore(STORES.PHRASE_INDEX);
    const index = store.index(INDEXES.by_resource);
    const request = index.count(resourceId);
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete a phrase index by resourceId. No-op if not found. */
export async function deletePhraseIndex(langCode: string, resourceId: number): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PHRASE_INDEX, 'readwrite');
    const store = tx.objectStore(STORES.PHRASE_INDEX);
    const request = store.delete(resourceId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all phrase indexes for a lang (usually 1 per dictionary resource). */
export async function getAllPhraseIndexes(langCode: string): Promise<StoredPhraseIndex[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PHRASE_INDEX, 'readonly');
    const store = tx.objectStore(STORES.PHRASE_INDEX);
    const request = store.getAll();
    request.onsuccess = () => {
      const raw = request.result as InternalPhraseIndex[] | undefined;
      if (!raw || raw.length === 0) { resolve([]); return; }
      resolve(raw.map((r) => {
        const blob = r.blob;
        const ab = blob instanceof Uint8Array
          ? blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength) as ArrayBuffer
          : new Uint8Array(blob).buffer as ArrayBuffer;
        return {
          resourceId: r.resourceId,
          compilerVersion: r.compilerVersion,
          termCount: r.termCount,
          blob: ab,
        };
      }));
    };
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}
