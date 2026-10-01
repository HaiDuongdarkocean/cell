import type { CondensedAudioRecord } from '@/entities/condensedAudio';
import { getDB, STORES } from '@/features/local-player';

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveRecord(record: CondensedAudioRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.CONDENSED_AUDIO, 'readwrite');
  tx.objectStore(STORES.CONDENSED_AUDIO).put(record);
  await txDone(tx);
}

export async function getRecord(id: string): Promise<CondensedAudioRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORES.CONDENSED_AUDIO, 'readonly');
  return reqToPromise(tx.objectStore(STORES.CONDENSED_AUDIO).get(id)) as Promise<
    CondensedAudioRecord | undefined
  >;
}

export async function getAllRecords(): Promise<CondensedAudioRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.CONDENSED_AUDIO, 'readonly');
  const all = (await reqToPromise(
    tx.objectStore(STORES.CONDENSED_AUDIO).getAll(),
  )) as CondensedAudioRecord[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.CONDENSED_AUDIO, 'readwrite');
  tx.objectStore(STORES.CONDENSED_AUDIO).delete(id);
  await txDone(tx);
}

export async function updateRecord(
  id: string,
  patch: Partial<CondensedAudioRecord>,
): Promise<CondensedAudioRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORES.CONDENSED_AUDIO, 'readwrite');
  const store = tx.objectStore(STORES.CONDENSED_AUDIO);
  const existing = (await reqToPromise(store.get(id))) as CondensedAudioRecord | undefined;
  if (!existing) {
    await txDone(tx).catch(() => {});
    return undefined;
  }
  const next = { ...existing, ...patch, id: existing.id, updatedAt: Date.now() };
  store.put(next);
  await txDone(tx);
  return next;
}
