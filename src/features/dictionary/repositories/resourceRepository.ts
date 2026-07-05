// resourceRepository — CRUD cho langResourceInfo (ADR-023 D1).
//
// 1 row per imported file. Methods: add, get, getAll, update, delete,
// findBySignature (dedupe), count, deleteAll.

import { getDB, getStore, STORES, INDEXES } from './baseRepository';
import type { ResourceInfo } from '@/entities/dictionary';

/** Add a resource. Returns the auto-generated id. */
export async function addResource(langCode: string, resource: Omit<ResourceInfo, 'id'>): Promise<number> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE);
    const request = store.add(resource);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/** Get a resource by id. */
export async function getResource(langCode: string, id: number): Promise<ResourceInfo | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE, 'readonly');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as ResourceInfo | undefined);
    request.onerror = () => reject(request.error);
  });
}

/** Get all resources (sorted by importedAt desc). */
export async function getAllResources(langCode: string): Promise<ResourceInfo[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE, 'readonly');
    const index = store.index(INDEXES.by_order);
    const request = index.getAll();
    request.onsuccess = () => {
      const results = request.result as ResourceInfo[];
      // by_order index on importedAt — sort desc (newest first)
      results.sort((a, b) => b.importedAt - a.importedAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Update a resource (full replace by id). */
export async function updateResource(langCode: string, resource: ResourceInfo): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE);
    const request = store.put(resource);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Delete a resource by id. */
export async function deleteResource(langCode: string, id: number): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Find a resource by signature (dedupe check — ADR-023 D7). */
export async function findResourceBySignature(langCode: string, signature: string): Promise<ResourceInfo | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE, 'readonly');
    const index = store.index(INDEXES.by_signature);
    const request = index.get(signature);
    request.onsuccess = () => resolve(request.result as ResourceInfo | undefined);
    request.onerror = () => reject(request.error);
  });
}

/** Count resources. */
export async function countResources(langCode: string): Promise<number> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE, 'readonly');
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Delete all resources (test cleanup). */
export async function deleteAllResources(langCode: string): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
