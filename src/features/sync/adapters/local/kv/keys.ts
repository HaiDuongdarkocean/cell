import { SYNCED_KV_REGISTRIES } from '@/features/sync/domain/settingsRegistry';

export const SYNC_DIRECTORY_STORAGE_KEY = 'syncState';
export const SYNC_META_KV_STORAGE_KEY = 'syncMetaKV';
export const SYNC_CONFLICT_LOG_STORAGE_KEY = 'syncConflictLog';

export const SYNCED_STORAGE_KEYS: readonly string[] = [
  ...Object.keys(SYNCED_KV_REGISTRIES),
];
