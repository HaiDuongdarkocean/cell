import { getSrsDB } from './srsDatabase';
import { idbRequest, txDone } from '@/shared/lib/storage/idb';

/** Read a single record by primary key. */
export function getById<T>(store: IDBObjectStore, id: string): Promise<T | undefined> {
  return idbRequest(store.get(id)).then((result) => result as T | undefined);
}

/** Write a record (add or update) and return the written value. */
export function putRecord<T>(store: IDBObjectStore, value: T): Promise<T> {
  return idbRequest(store.put(value)).then(() => value);
}

/** Delete a record by primary key. */
export function deleteRecord(store: IDBObjectStore, id: string): Promise<void> {
  return idbRequest(store.delete(id)).then(() => undefined);
}

/** Count records matching an index key or range. */
export function countByIndex(
  store: IDBObjectStore,
  indexName: string,
  key: IDBValidKey | IDBKeyRange,
): Promise<number> {
  return idbRequest(store.index(indexName).count(key));
}

/** Get the first record matching an index key. */
export function getByIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return idbRequest(store.index(indexName).get(key)).then(
    (result) => result as T | undefined,
  );
}

/** Collect all records from an index in a range, up to maxResults. */
export function getAllByIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  key?: IDBValidKey | IDBKeyRange | null,
  maxResults?: number,
): Promise<T[]> {
  const index = store.index(indexName);
  const request: IDBRequest = key !== undefined && key !== null
    ? index.getAll(key, maxResults)
    : index.getAll(maxResults);
  return idbRequest(request).then((result) => result as T[]);
}

/** Open a readwrite transaction over the given stores; fn receives the first store plus the tx. */
export async function withStore<T>(
  storeNames: string | readonly string[],
  fn: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await getSrsDB();
  const names = Array.isArray(storeNames) ? [...storeNames] : [storeNames];
  const tx = db.transaction(names, 'readwrite');
  const store = tx.objectStore(names[0]!);
  const result = await fn(store, tx);
  await txDone(tx);
  return result;
}

/** Open a readonly transaction for the given store. */
export async function withReadonlyStore<T>(
  storeName: string,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await getSrsDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const result = await fn(store);
  await txDone(tx);
  return result;
}
