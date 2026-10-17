// phraseIndexRepository — CRUD cho langPhraseIndex (ADR-037 §7.1).
//
// 1 row per dictionary resource. Value: { resourceId, compilerVersion, termCount, blob }.
// Blob is a compact ArrayBuffer produced by phraseIndexCompiler.

import { getDB, STORES, INDEXES } from './baseRepository';
import { idbRequest } from '@/shared/lib/storage/idb';

/** Stored phrase index record (langPhraseIndex store). */
export interface StoredPhraseIndex {
  readonly resourceId: number;
  readonly compilerVersion: number;
  readonly termCount: number;
  readonly blob: ArrayBuffer;
}

/** Internal stored record — blob may be a legacy Array<number> (older writes
 *  expanded the bytes for structuredClone compat) or a raw ArrayBuffer. */
interface InternalPhraseIndex {
  readonly resourceId: number;
  readonly compilerVersion: number;
  readonly termCount: number;
  readonly blob: number[] | ArrayBuffer | Uint8Array;
}

function blobToArrayBuffer(blob: number[] | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (blob instanceof ArrayBuffer) return blob;
  if (blob instanceof Uint8Array) {
    return blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength) as ArrayBuffer;
  }
  return new Uint8Array(blob).buffer as ArrayBuffer;
}

/** Put a phrase index blob for a resource (insert or replace). */
export async function putPhraseIndex(
  langCode: string,
  resourceId: number,
  blob: ArrayBuffer,
  meta: { readonly compilerVersion: number; readonly termCount: number },
): Promise<void> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.PHRASE_INDEX, 'readwrite');
  const store = tx.objectStore(STORES.PHRASE_INDEX);
  const record: InternalPhraseIndex = {
    resourceId,
    compilerVersion: meta.compilerVersion,
    termCount: meta.termCount,
    blob,
  };
  await idbRequest(store.put(record));
}

/** Get a phrase index by resourceId. Returns undefined if not found. */
export async function getPhraseIndex(langCode: string, resourceId: number): Promise<StoredPhraseIndex | undefined> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.PHRASE_INDEX, 'readonly');
  const store = tx.objectStore(STORES.PHRASE_INDEX);
  const raw = (await idbRequest(store.get(resourceId))) as InternalPhraseIndex | undefined;
  if (!raw) return undefined;
  const ab = blobToArrayBuffer(raw.blob);
  if (Array.isArray(raw.blob)) {
    void putPhraseIndex(langCode, raw.resourceId, ab, {
      compilerVersion: raw.compilerVersion,
      termCount: raw.termCount,
    }).catch(() => undefined);
  }
  return {
    resourceId: raw.resourceId,
    compilerVersion: raw.compilerVersion,
    termCount: raw.termCount,
    blob: ab,
  };
}

/** Check whether a phrase index exists for a resource. */
export async function hasPhraseIndex(langCode: string, resourceId: number): Promise<boolean> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.PHRASE_INDEX, 'readonly');
  const store = tx.objectStore(STORES.PHRASE_INDEX);
  const index = store.index(INDEXES.by_resource);
  return (await idbRequest(index.count(resourceId))) > 0;
}

/** Delete a phrase index by resourceId. No-op if not found. */
export async function deletePhraseIndex(langCode: string, resourceId: number): Promise<void> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.PHRASE_INDEX, 'readwrite');
  const store = tx.objectStore(STORES.PHRASE_INDEX);
  await idbRequest(store.delete(resourceId));
}

/** Get all phrase indexes for a lang (usually 1 per dictionary resource). */
export async function getAllPhraseIndexes(langCode: string): Promise<StoredPhraseIndex[]> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.PHRASE_INDEX, 'readonly');
  const store = tx.objectStore(STORES.PHRASE_INDEX);
  const raw = (await idbRequest(store.getAll())) as InternalPhraseIndex[] | undefined;
  if (!raw || raw.length === 0) return [];
  return raw.map((r) => ({
    resourceId: r.resourceId,
    compilerVersion: r.compilerVersion,
    termCount: r.termCount,
    blob: blobToArrayBuffer(r.blob),
  }));
}
