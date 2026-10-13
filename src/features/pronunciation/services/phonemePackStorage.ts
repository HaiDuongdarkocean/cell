import type { PhonemePack, PhonemePackMeta } from './phonemePack';

/**
 * Imported (custom) phoneme packs live in chrome.storage.local:
 *   'phonemePacks'         → index of pack metadata (resolve order)
 *   'phonemePack:<id>'     → full pack payload (base64 audio inline)
 *
 * An in-memory StorageArea stand-in is injected in tests — the service
 * degrades to "no custom packs" outside extension contexts.
 */

export interface StorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

const INDEX_KEY = 'phonemePacks';
const PACK_KEY_PREFIX = 'phonemePack:';

function defaultStorage(): StorageArea | null {
  const area = globalThis.chrome?.storage?.local as StorageArea | undefined;
  return area ?? null;
}

export async function listPhonemePacks(
  storage: StorageArea | null = defaultStorage(),
): Promise<readonly PhonemePackMeta[]> {
  if (!storage) return [];
  const res = await storage.get(INDEX_KEY);
  const idx = res[INDEX_KEY];
  return Array.isArray(idx) ? (idx as PhonemePackMeta[]) : [];
}

export async function getPhonemePack(
  id: string,
  storage: StorageArea | null = defaultStorage(),
): Promise<PhonemePack | null> {
  if (!storage) return null;
  const res = await storage.get(`${PACK_KEY_PREFIX}${id}`);
  const pack = res[`${PACK_KEY_PREFIX}${id}`];
  return pack && typeof pack === 'object' ? (pack as PhonemePack) : null;
}

export async function savePhonemePack(
  pack: PhonemePack,
  storage: StorageArea | null = defaultStorage(),
): Promise<PhonemePackMeta | null> {
  if (!storage) return null;
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const meta: PhonemePackMeta = {
    id,
    name: pack.name,
    license: pack.license,
    symbolCount: Object.keys(pack.files).length,
    addedAt: Date.now(),
  };
  const index = [...(await listPhonemePacks(storage)), meta];
  await storage.set({ [INDEX_KEY]: index, [`${PACK_KEY_PREFIX}${id}`]: pack });
  return meta;
}

export async function removePhonemePack(
  id: string,
  storage: StorageArea | null = defaultStorage(),
): Promise<void> {
  if (!storage) return;
  const index = (await listPhonemePacks(storage)).filter((m) => m.id !== id);
  await storage.set({ [INDEX_KEY]: index });
  await storage.remove(`${PACK_KEY_PREFIX}${id}`);
}
