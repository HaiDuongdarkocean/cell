import {
  getSessionStorage,
  getStorage,
  removeSessionStorage,
  removeStorage,
  setSessionStorage,
  setStorage,
} from '@/shared/lib/chrome-apis';
import type { KeyValueStore, KvArea } from '../../../ports/keyValueStore';

async function readArea(area: KvArea, key?: string | null): Promise<Record<string, unknown>> {
  if (area === 'local') return getStorage<Record<string, unknown>>(key ?? null);
  return getSessionStorage<Record<string, unknown>>(key ?? null);
}

export class ChromeKeyValueStore implements KeyValueStore {
  async get<T>(area: KvArea, key: string): Promise<T | undefined> {
    const data = await readArea(area, key);
    return data[key] as T | undefined;
  }

  async set(area: KvArea, key: string, value: unknown): Promise<void> {
    if (area === 'local') await setStorage({ [key]: value });
    else await setSessionStorage({ [key]: value });
  }

  async del(area: KvArea, key: string): Promise<void> {
    if (area === 'local') await removeStorage(key);
    else await removeSessionStorage(key);
  }

  async list(area: KvArea, prefix: string): Promise<string[]> {
    const data = await readArea(area);
    return Object.keys(data)
      .filter((key) => key.startsWith(prefix))
      .sort();
  }
}
