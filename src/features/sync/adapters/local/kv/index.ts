import { STORAGE_KEYS } from '@/shared/config/config';
import { removeStorage, setStorage } from '@/shared/lib/chrome-apis';
import { persistSyncedSettings } from '@/shared/lib/storage/settingsStore';
import { SYNCED_KV_REGISTRIES } from '../../../domain/settingsRegistry';
import type { KeyValueStore } from '../../../ports/keyValueStore';
import type { Hlc } from '../../../domain/types';
import { createKvLocalSources as createSources } from './kvLocalSource';
import type {
  KvLocalSource,
  KvLocalSourceDeps,
  KvValueWriter,
} from './kvLocalSource';
import { SYNC_DIRECTORY_STORAGE_KEY } from './keys';

export interface KvLocalSourcesDeps {
  readonly kv: KeyValueStore;
  readonly tick: () => Hlc;
  readonly now?: () => number;
  readonly writers?: Partial<Record<string, KvValueWriter>>;
}

export function rawStorageWriter(storageKey: string): KvValueWriter {
  return async (value) => {
    if (value === undefined) {
      await removeStorage(storageKey);
    } else {
      await setStorage({ [storageKey]: value });
    }
  };
}

export function kvStorageWriters(): Record<string, KvValueWriter> {
  const writers: Record<string, KvValueWriter> = {};
  for (const storageKey of Object.keys(SYNCED_KV_REGISTRIES)) {
    writers[storageKey] = rawStorageWriter(storageKey);
  }
  writers[SYNC_DIRECTORY_STORAGE_KEY] = rawStorageWriter(SYNC_DIRECTORY_STORAGE_KEY);
  writers[STORAGE_KEYS.SETTINGS] = async (value) => {
    if (value === undefined) {
      await removeStorage(STORAGE_KEYS.SETTINGS);
      return;
    }
    await persistSyncedSettings(value as Record<string, unknown>);
  };
  return writers;
}

export function createKvLocalSources(deps: KvLocalSourcesDeps): KvLocalSource[] {
  const writers = { ...kvStorageWriters(), ...deps.writers };
  const sourceDeps: KvLocalSourceDeps = {
    kv: deps.kv,
    tick: deps.tick,
    now: deps.now,
    writers,
  };
  return createSources(sourceDeps);
}

export { ChromeKeyValueStore } from './chromeKvStore';
export { appendConflictLog, SYNC_CONFLICT_LOG_LIMIT } from './conflictLog';
export type { ConflictLogEntry } from './conflictLog';
export { scheduleOnExternalChange } from './externalChanges';
export type { ExternalChangeDeps, StorageChangeListener } from './externalChanges';
export { createKvLocalSource, KV_DATA_CLASSES } from './kvLocalSource';
export type { KvDataClass, KvLocalSource, KvLocalSourceDeps, KvValueWriter } from './kvLocalSource';
export { kvMetaKey, parseKvMetaKey, readSyncMetaKV, stampKvMeta } from './kvMeta';
export type { KvRecordMeta, SyncMetaKV } from './kvMeta';
export { directoryKvShape, flattenedKvShape, isDirectoryRecordKey } from './kvShapes';
export type { KvProjection, KvShape } from './kvShapes';
export { directoryKvSlice, flattenedKvSlice, profilesKvSlice } from './kvSlices';
export type { KvSlice, ScopedLeaf } from './kvSlices';
export {
  SYNC_CONFLICT_LOG_STORAGE_KEY,
  SYNC_DIRECTORY_STORAGE_KEY,
  SYNC_META_KV_STORAGE_KEY,
  SYNCED_STORAGE_KEYS,
} from './keys';
export { kvValueHash } from './valueHash';
