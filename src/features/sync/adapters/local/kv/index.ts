import { STORAGE_KEYS } from '@/shared/config/config';
import { removeStorage, setStorage } from '@/shared/lib/chrome-apis';
import { persistSyncedSettings } from '@/shared/lib/storage/settingsStore';
import { SYNCED_KV_REGISTRIES } from '../../../domain/settingsRegistry';
import type { KeyValueStore } from '../../../ports/keyValueStore';
import type { LocalSource } from '../../../ports/localSource';
import type { DataClass, Hlc } from '../../../domain/types';
import { KvLocalSource } from './kvLocalSource';
import type { KvLocalSourceDeps } from './kvLocalSource';
import { directoryKvShape, flattenedKvShape } from './kvShapes';
import { SYNC_DIRECTORY_STORAGE_KEY } from './keys';

export interface KvLocalSourcesDeps {
  readonly kv: KeyValueStore;
  readonly tick: () => Hlc;
  readonly now?: () => number;
  readonly writers?: Partial<Record<string, KvValueWriter>>;
}

export type KvValueWriter = (value: unknown) => Promise<void>;

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

export function createKvLocalSources(deps: KvLocalSourcesDeps): LocalSource[] {
  const writers = { ...kvStorageWriters(), ...deps.writers };
  const sources: LocalSource[] = [];
  for (const [storageKey, registry] of Object.entries(SYNCED_KV_REGISTRIES)) {
    const dataClass: DataClass =
      storageKey === STORAGE_KEYS.SETTINGS ? 'settings' : 'secondaryKey';
    const sourceDeps: KvLocalSourceDeps = {
      kv: deps.kv,
      tick: deps.tick,
      now: deps.now,
      writeValue: writers[storageKey] ?? rawStorageWriter(storageKey),
    };
    sources.push(
      new KvLocalSource(dataClass, flattenedKvShape(storageKey, registry), sourceDeps),
    );
  }
  sources.push(
    new KvLocalSource('syncDirectory', directoryKvShape(SYNC_DIRECTORY_STORAGE_KEY), {
      kv: deps.kv,
      tick: deps.tick,
      now: deps.now,
      writeValue:
        writers[SYNC_DIRECTORY_STORAGE_KEY] ?? rawStorageWriter(SYNC_DIRECTORY_STORAGE_KEY),
    }),
  );
  return sources;
}

export { ChromeKeyValueStore } from './chromeKvStore';
export { appendConflictLog, SYNC_CONFLICT_LOG_LIMIT } from './conflictLog';
export type { ConflictLogEntry } from './conflictLog';
export { scheduleOnExternalChange } from './externalChanges';
export type { ExternalChangeDeps, StorageChangeListener } from './externalChanges';
export { KvLocalSource } from './kvLocalSource';
export type { KvLocalSourceDeps } from './kvLocalSource';
export { readSyncMetaKV, stampKvMeta } from './kvMeta';
export type { SyncMetaKV } from './kvMeta';
export {
  directoryKvShape,
  flattenedKvShape,
  isDirectoryRecordKey,
} from './kvShapes';
export type { KvProjection, KvShape } from './kvShapes';
export {
  SYNC_CONFLICT_LOG_STORAGE_KEY,
  SYNC_DIRECTORY_STORAGE_KEY,
  SYNC_META_KV_STORAGE_KEY,
  SYNCED_STORAGE_KEYS,
} from './keys';
export { kvValueHash } from './valueHash';
