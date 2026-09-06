// resourceRepository — CRUD cho langResourceInfo (ADR-023 D1).
//
// 1 row per imported file. Methods: add, get, getAll, update, delete,
// findBySignature (dedupe), count, deleteAll.

import { getDB, getStore, STORES, INDEXES } from './baseRepository';
import type { ResourceInfo, ResourceType } from '@/entities/dictionary';

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

/** Get all resources (priority asc, then resourceId desc as the default fallback). */
export async function getAllResources(langCode: string): Promise<ResourceInfo[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE, 'readonly');
    const index = store.index(INDEXES.by_order);
    const request = index.getAll();
    request.onsuccess = () => {
      const results = request.result as ResourceInfo[];
      // priority lower wins; absent priority is treated as Infinity so it comes last
      results.sort((a, b) => {
        const aPriority = a.priority ?? Number.POSITIVE_INFINITY;
        const bPriority = b.priority ?? Number.POSITIVE_INFINITY;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (b.id ?? 0) - (a.id ?? 0);
      });
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

/** Reorder resources of a given type by writing priority 0..n onto each resource in the supplied order. */
export async function reorderResources(langCode: string, type: ResourceType, orderedIds: readonly number[]): Promise<void> {
  const all = await getAllResources(langCode);
  const byId = new Map<number, ResourceInfo>();
  for (const resource of all) {
    if (resource.type === type && resource.id !== undefined) {
      byId.set(resource.id, resource);
    }
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const resource = byId.get(id);
    if (resource) {
      await updateResource(langCode, { ...resource, priority: i });
    }
  }
}

/** Enable or disable a resource by id. */
export async function setResourceEnabled(langCode: string, id: number, enabled: boolean): Promise<void> {
  const resource = await getResource(langCode, id);
  if (!resource) {
    throw new Error(`Không tìm thấy resource id ${id}.`);
  }
  await updateResource(langCode, { ...resource, enabled });
}

/** Set the language profiles a resource belongs to. */
export async function setResourceProfiles(langCode: string, id: number, profileIds: readonly string[]): Promise<void> {
  const resource = await getResource(langCode, id);
  if (!resource) {
    throw new Error(`Không tìm thấy resource id ${id}.`);
  }
  await updateResource(langCode, { ...resource, profileIds });
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
