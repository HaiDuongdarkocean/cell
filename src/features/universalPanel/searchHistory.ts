import { getSessionStorage, setSessionStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';

export const MAX_SEARCH_HISTORY = 10;

export function addSearchHistoryTerm(history: readonly string[], term: string): string[] {
  const normalized = term.trim();
  if (!normalized) return [...history];
  return [normalized, ...history.filter((entry) => entry !== normalized)].slice(0, MAX_SEARCH_HISTORY);
}

export function removeSearchHistoryTerm(history: readonly string[], term: string): string[] {
  return history.filter((entry) => entry !== term);
}

export function readSearchHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).slice(0, MAX_SEARCH_HISTORY);
}

let historyWriteQueue: Promise<void> = Promise.resolve();

export function loadSearchHistory(): Promise<string[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return Promise.resolve([]);
  return getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.DICTIONARY_SEARCH_HISTORY)
    .then((data) => readSearchHistory(data[STORAGE_KEYS.DICTIONARY_SEARCH_HISTORY]))
    .catch(() => []);
}

export function persistSearchHistory(history: readonly string[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return Promise.resolve();
  historyWriteQueue = historyWriteQueue.then(() => setSessionStorage({
    [STORAGE_KEYS.DICTIONARY_SEARCH_HISTORY]: [...history].slice(0, MAX_SEARCH_HISTORY),
  })).catch(() => undefined);
  return historyWriteQueue;
}
