import type { KeyValueStore, KvArea } from '../../ports/keyValueStore';

export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly areas: Record<KvArea, Map<string, unknown>> = {
    session: new Map(),
    local: new Map(),
  };

  async get<T>(area: KvArea, key: string): Promise<T | undefined> {
    return this.areas[area].get(key) as T | undefined;
  }

  async set(area: KvArea, key: string, value: unknown): Promise<void> {
    this.areas[area].set(key, value);
  }

  async del(area: KvArea, key: string): Promise<void> {
    this.areas[area].delete(key);
  }

  async list(area: KvArea, prefix: string): Promise<string[]> {
    return [...this.areas[area].keys()].filter((key) => key.startsWith(prefix)).sort();
  }
}
