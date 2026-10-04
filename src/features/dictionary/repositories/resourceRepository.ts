// resourceRepository — CRUD cho langResourceInfo (ADR-023 D1).
//
// 1 row per imported file. Methods: add, get, getAll, update, delete,
// findBySignature (dedupe), count, deleteAll.

import { getDB, getStore, awaitTx, STORES, INDEXES } from './baseRepository';
import type { DictionaryComponent, ImportFormat, ResourceInfo } from '@/entities/dictionary';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, scopeForTarget, stableJson, targetOf, type Scope } from '@/features/sync';

const WRITE_STORES = [STORES.RESOURCE, STORES.SYNC_OUTBOX, STORES.SYNC_META];

const SYNCED_FIELDS = ['name', 'enabled', 'priority', 'disabledComponents'] as const;
type SyncedField = (typeof SYNCED_FIELDS)[number];

function resourceScope(langCode: string): Scope {
  return scopeForTarget(targetOf(langCode));
}

function recordTokenOf(resource: Pick<ResourceInfo, 'contentHash' | 'signature'>): string {
  return resource.contentHash ?? resource.signature;
}

function fieldCapture(scope: Scope, token: string, field: SyncedField, value: unknown) {
  const absent = value === undefined || value === null;
  return {
    scope,
    dataClass: 'dictResource' as const,
    key: `resource:${token}/${field}`,
    op: absent ? ('delete' as const) : ('put' as const),
  };
}

async function captureResourceFields(
  store: IDBObjectStore,
  scope: Scope,
  token: string,
  prev: ResourceInfo | undefined,
  next: ResourceInfo,
): Promise<void> {
  for (const field of SYNCED_FIELDS) {
    const changed = !prev || stableJson(prev[field]) !== stableJson(next[field]);
    if (changed) await captureChange(store, fieldCapture(scope, token, field, next[field]));
  }
}

async function captureResourceTombstones(
  store: IDBObjectStore,
  scope: Scope,
  token: string,
): Promise<void> {
  await captureChange(store, { scope, dataClass: 'dictResource', key: `resource:${token}`, op: 'delete' });
  for (const field of SYNCED_FIELDS) {
    await captureChange(store, fieldCapture(scope, token, field, undefined));
  }
}

/** Legacy format ids persisted before the structural rename → current id. */
const LEGACY_FORMAT_MAP: Record<string, ImportFormat> = {
  'yomitan': 'term-bank',
  'cambridge-json': 'json-entries',
  'migaku-wordlist': 'wordlist-json',
};

function migrateResource(resource: ResourceInfo | undefined): ResourceInfo | undefined {
  if (!resource) return resource;
  const format = LEGACY_FORMAT_MAP[resource.format as string];
  return format ? { ...resource, format } : resource;
}

/** Add a resource. Returns the auto-generated id. */
export async function addResource(langCode: string, resource: Omit<ResourceInfo, 'id'>): Promise<number> {
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const store = getStore(db, WRITE_STORES);
  const request = store.add(resource);
  const id = await new Promise<number>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
  if (isCaptureEnabled()) {
    const scope = resourceScope(langCode);
    const token = recordTokenOf(resource as ResourceInfo);
    await captureChange(store, { scope, dataClass: 'dictResource', key: `resource:${token}`, op: 'put' });
    await captureResourceFields(store, scope, token, undefined, resource as ResourceInfo);
  }
  await awaitTx(store.transaction);
  return id;
}

/** Get a resource by id. */
export async function getResource(langCode: string, id: number): Promise<ResourceInfo | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE, 'readonly');
    const request = store.get(id);
    request.onsuccess = () => resolve(migrateResource(request.result as ResourceInfo | undefined));
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
      const results = (request.result as ResourceInfo[]).map((r) => migrateResource(r)!);
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

/** Update a resource (full replace by id); capture emits one record per changed synced field. */
export async function updateResource(langCode: string, resource: ResourceInfo): Promise<void> {
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const store = getStore(db, WRITE_STORES);
  const prev = isCaptureEnabled() && resource.id !== undefined
    ? migrateResource(
        await new Promise<ResourceInfo | undefined>((resolve, reject) => {
          const getReq = store.get(resource.id!);
          getReq.onsuccess = () => resolve(getReq.result as ResourceInfo | undefined);
          getReq.onerror = () => reject(getReq.error);
        }),
      )
    : undefined;
  await new Promise<void>((resolve, reject) => {
    const putReq = store.put(resource);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
  if (isCaptureEnabled()) {
    const scope = resourceScope(langCode);
    const token = recordTokenOf(resource);
    const prevToken = prev ? recordTokenOf(prev) : undefined;
    const tokenChanged = prevToken !== undefined && prevToken !== token;
    if (tokenChanged) {
      await captureResourceTombstones(store, scope, prevToken!);
    }
    await captureChange(store, { scope, dataClass: 'dictResource', key: `resource:${token}`, op: 'put' });
    if (!prev || tokenChanged) {
      await captureResourceFields(store, scope, token, undefined, resource);
    } else {
      await captureResourceFields(store, scope, token, prev, resource);
    }
  }
  await awaitTx(store.transaction);
}

/** Delete a resource by id. */
export async function deleteResource(langCode: string, id: number): Promise<void> {
  const db = await getDB(langCode);
  await ensureSyncRuntime();
  const store = getStore(db, WRITE_STORES);
  const prev = isCaptureEnabled()
    ? await new Promise<ResourceInfo | undefined>((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => resolve(getReq.result as ResourceInfo | undefined);
        getReq.onerror = () => reject(getReq.error);
      })
    : undefined;
  await new Promise<void>((resolve, reject) => {
    const delReq = store.delete(id);
    delReq.onsuccess = () => resolve();
    delReq.onerror = () => reject(delReq.error);
  });
  if (isCaptureEnabled() && prev?.signature) {
    await captureResourceTombstones(store, resourceScope(langCode), recordTokenOf(prev));
  }
  await awaitTx(store.transaction);
}

/** Find a resource by signature (dedupe check — ADR-023 D7). */
export async function findResourceBySignature(langCode: string, signature: string): Promise<ResourceInfo | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.RESOURCE, 'readonly');
    const index = store.index(INDEXES.by_signature);
    const request = index.get(signature);
    request.onsuccess = () => resolve(migrateResource(request.result as ResourceInfo | undefined));
    request.onerror = () => reject(request.error);
  });
}

/** Reorder resources along the single global priority axis — writes
 *  priority 0..n onto each resource in the supplied order. */
export async function reorderResources(langCode: string, orderedIds: readonly number[]): Promise<void> {
  const all = await getAllResources(langCode);
  const byId = new Map<number, ResourceInfo>();
  for (const resource of all) {
    if (resource.id !== undefined) {
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

/** Rename a resource (user-facing display name). */
export async function setResourceName(langCode: string, id: number, name: string): Promise<void> {
  const resource = await getResource(langCode, id);
  if (!resource) {
    throw new Error(`Không tìm thấy resource id ${id}.`);
  }
  await updateResource(langCode, { ...resource, name });
}

/** Set the language profiles a resource belongs to. */
export async function setResourceProfiles(langCode: string, id: number, profileIds: readonly string[]): Promise<void> {
  const resource = await getResource(langCode, id);
  if (!resource) {
    throw new Error(`Không tìm thấy resource id ${id}.`);
  }
  await updateResource(langCode, { ...resource, profileIds });
}

/** Persist the user-disabled component list for a dictionary resource. */
export async function setResourceDisabledComponents(
  langCode: string,
  id: number,
  disabledComponents: readonly DictionaryComponent[],
): Promise<void> {
  const resource = await getResource(langCode, id);
  if (!resource) {
    throw new Error(`Không tìm thấy resource id ${id}.`);
  }
  await updateResource(langCode, { ...resource, disabledComponents });
}

/** Persist the detected component list (import-time or lazy scan). */
export async function setResourceComponents(
  langCode: string,
  id: number,
  components: readonly DictionaryComponent[],
): Promise<void> {
  const resource = await getResource(langCode, id);
  if (!resource) {
    throw new Error(`Không tìm thấy resource id ${id}.`);
  }
  await updateResource(langCode, { ...resource, components });
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
  await ensureSyncRuntime();
  const store = getStore(db, WRITE_STORES);
  const tokens = isCaptureEnabled()
    ? await new Promise<string[]>((resolve, reject) => {
        const getReq = store.getAll();
        getReq.onsuccess = () =>
          resolve(
            (getReq.result as ResourceInfo[])
              .map((r) => recordTokenOf(r))
              .filter((s): s is string => typeof s === 'string' && s.length > 0),
          );
        getReq.onerror = () => reject(getReq.error);
      })
    : [];
  await new Promise<void>((resolve, reject) => {
    const clearReq = store.clear();
    clearReq.onsuccess = () => resolve();
    clearReq.onerror = () => reject(clearReq.error);
  });
  const scope = resourceScope(langCode);
  for (const token of tokens) {
    await captureResourceTombstones(store, scope, token);
  }
  await awaitTx(store.transaction);
}
