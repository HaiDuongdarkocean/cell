// dbHash — random 8-char hash cho IndexedDB name (ADR-023 D1).
//
// Tránh conflict khi uninstall/reinstall (DB cũ orphaned không ghi đè).
// Hash lưu chrome.storage.local.orca.dbHash, fallback 'devmode0' khi absent
// (test/dev mode). chrome.runtime.onInstalled → generate random + save.

import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

const STORAGE_KEY = 'orca';
const HASH_FIELD = 'dbHash';
const HASH_LENGTH = 8;
const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Fallback hash khi storage absent (test/dev mode). */
export const DEFAULT_DB_HASH = 'devmode0';

/** Generate random 8-char hash [a-z0-9]. */
export function generateDbHash(): string {
  const chars: string[] = [];
  const random = new Uint8Array(HASH_LENGTH);
  crypto.getRandomValues(random);
  for (let i = 0; i < HASH_LENGTH; i++) {
    chars.push(CHARSET[random[i] % CHARSET.length]);
  }
  return chars.join('');
}

/** Read dbHash from chrome.storage.local.orca.dbHash. Fallback DEFAULT_DB_HASH. */
export async function getDbHash(): Promise<string> {
  try {
    const data = await getStorage<Record<string, unknown>>(STORAGE_KEY);
    const orca = data[STORAGE_KEY] as Record<string, unknown> | undefined;
    const hash = orca?.[HASH_FIELD];
    if (typeof hash === 'string' && hash.length === HASH_LENGTH) return hash;
  } catch {
    // storage absent (test) → fallback
  }
  return DEFAULT_DB_HASH;
}

/** Save dbHash to chrome.storage.local.orca.dbHash. */
export async function saveDbHash(hash: string): Promise<void> {
  const data = await getStorage<Record<string, unknown>>(STORAGE_KEY);
  const orca = (data[STORAGE_KEY] as Record<string, unknown> | undefined) ?? {};
  orca[HASH_FIELD] = hash;
  await setStorage({ [STORAGE_KEY]: orca });
}

/** Initialize dbHash on chrome.runtime.onInstalled — generate + save if absent. */
export async function initDbHashOnInstalled(): Promise<string> {
  const existing = await getDbHash();
  if (existing !== DEFAULT_DB_HASH) return existing;
  const newHash = generateDbHash();
  await saveDbHash(newHash);
  return newHash;
}
