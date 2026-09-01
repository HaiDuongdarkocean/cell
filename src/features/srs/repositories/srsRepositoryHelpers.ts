import { getSrsDB } from './srsDatabase';

/** Read a single record by primary key. */
export function getById<T>(store: IDBObjectStore, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

/** Write a record (add or update) and return the written value. */
export function putRecord<T>(store: IDBObjectStore, value: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = store.put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

/** Delete a record by primary key. */
export function deleteRecord(store: IDBObjectStore, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Count records matching an index key or range. */
export function countByIndex(
  store: IDBObjectStore,
  indexName: string,
  key: IDBValidKey | IDBKeyRange,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const index = store.index(indexName);
    const request = index.count(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Get the first record matching an index key. */
export function getByIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const index = store.index(indexName);
    const request = index.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

/** Collect all records from an index in a range, up to maxResults. */
export function getAllByIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  key?: IDBValidKey | IDBKeyRange | null,
  maxResults?: number,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const index = store.index(indexName);
    const request: IDBRequest = key !== undefined && key !== null
      ? index.getAll(key, maxResults)
      : index.getAll(maxResults);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/** Open a readwrite transaction for the given store. */
export async function withStore<T>(
  storeName: string,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await getSrsDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const result = await fn(store);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result;
}
