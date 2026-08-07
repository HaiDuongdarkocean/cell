// lookupLogStore — dev-only lookup log persistence via chrome.storage.local.
//
// Ring buffer 500 entry. Không dùng IndexedDB (tránh migration + DB_SCHEMA_VERSION
// bump). SW restart không mất data. Cap ~2.5MB < 10MB default limit.
//
// Gate bằng isDevMode — production build tree-shake toàn bộ module (caller check
// isDevMode trước khi import hàm save). Export/clear qua DevTools console.

import { isDevMode } from '@/shared/lib/env/devMode';
import type { LookupLogEntry } from './lookupLogTypes';

const STORAGE_KEY = 'lookupLog';
const MAX_ENTRIES = 500;

/** Append 1 entry vào ring buffer. Fire-and-forget — caller dùng void. */
export async function saveLookupLog(entry: LookupLogEntry): Promise<void> {
  if (!isDevMode) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const existing = await chrome.storage.local.get(STORAGE_KEY);
  const logs = (existing[STORAGE_KEY] as LookupLogEntry[] | undefined) ?? [];
  const updated = [...logs, entry].slice(-MAX_ENTRIES);
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
}

/** Đọc toàn bộ log (cho export). */
export async function readLookupLog(): Promise<LookupLogEntry[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return [];
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  return (existing[STORAGE_KEY] as LookupLogEntry[] | undefined) ?? [];
}

/** Xóa toàn bộ log. */
export async function clearLookupLog(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.remove(STORAGE_KEY);
}
