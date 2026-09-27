export type KvArea = 'session' | 'local';

export interface KeyValueStore {
  get<T>(area: KvArea, key: string): Promise<T | undefined>;
  set(area: KvArea, key: string, value: unknown): Promise<void>;
  del(area: KvArea, key: string): Promise<void>;
  list(area: KvArea, prefix: string): Promise<string[]>;
}
