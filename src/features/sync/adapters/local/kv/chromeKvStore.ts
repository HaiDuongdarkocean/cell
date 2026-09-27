import {
  getSessionStorage,
  getStorage,
  removeSessionStorage,
  removeStorage,
  setSessionStorage,
  setStorage,
} from '@/shared/lib/chrome-apis';
import type { KeyValueStore, KvArea } from '../../../ports/keyValueStore';

export class ChromeKeyValueStore implements KeyValueStore {
  async get<T>(area: KvArea, key: string): Promise<T | undefined> {
    const data =
      area === 'local'
        ? await getStorage<Record<string, unknown>>(key)
        : await getSessionStorage<Record<string, unknown>>(key);
    return data[key] as T | undefined;
  }

  async set(area: KvArea, key: string, value: unknown): Promise<void> {
    if (area === 'local') {
      await setStorage({ [key]: value });
    } else {
      await setSessionStorage({ [key]: value });
    }
  }

  async del(area: KvArea, key: string): Promise<void> {
    if (area === 'local') {
      await removeStorage(key);
    } else {
      await removeSessionStorage(key);
    }
  }

  async list(area: KvArea, prefix: string): Promise<string[]> {
    const all =
      area === 'local'
        ? await getStorage<Record<string, unknown>>(null)
        : await getSessionStorage<Record<string, unknown>>(null);
    return Object.keys(all)
      .filter((key) => key.startsWith(prefix))
      .sort();
  }
}
