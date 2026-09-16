import { LruCache } from '@/shared/lib/lruCache';

export const FILE_CACHE_CAP = 500;

export type FileCache = LruCache<string, File>;

export function createFileCache(
  entries?: Iterable<readonly [string, File]>,
): FileCache {
  const cache = new LruCache<string, File>(FILE_CACHE_CAP);
  if (entries) {
    for (const [name, file] of entries) {
      cache.set(name, file);
    }
  }
  return cache;
}
