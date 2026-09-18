export type MockStatus = 'tracking' | 'known' | 'ignore';

export interface MockEntry {
  readonly term: string;
  readonly status: MockStatus;
  readonly updatedAt: number;
}

export interface MockTrashEntry {
  readonly term: string;
  readonly previousStatus: MockStatus;
  readonly trashedAt: number;
}

export const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

const now = Date.now();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export const MOCK_ENTRIES: MockEntry[] = [
  { term: 'serendipity', status: 'tracking', updatedAt: now - 12 * MIN },
  { term: 'ephemeral', status: 'tracking', updatedAt: now - 45 * MIN },
  { term: 'ubiquitous', status: 'known', updatedAt: now - 2 * HOUR },
  { term: 'meticulous', status: 'tracking', updatedAt: now - 3 * HOUR },
  { term: 'pragmatic', status: 'known', updatedAt: now - 5 * HOUR },
  { term: 'albeit', status: 'ignore', updatedAt: now - 7 * HOUR },
  { term: 'quintessential', status: 'tracking', updatedAt: now - 9 * HOUR },
  { term: 'nuance', status: 'known', updatedAt: now - 12 * HOUR },
  { term: 'resilient', status: 'tracking', updatedAt: now - 20 * HOUR },
  { term: 'hitherto', status: 'ignore', updatedAt: now - 26 * HOUR },
  { term: 'candid', status: 'known', updatedAt: now - 30 * HOUR },
  { term: 'vivid', status: 'known', updatedAt: now - 40 * HOUR },
];

export const MOCK_TRASH: MockTrashEntry[] = [
  { term: 'obfuscate', previousStatus: 'tracking', trashedAt: now - 2 * HOUR },
  { term: 'plethora', previousStatus: 'known', trashedAt: now - 9 * HOUR },
  { term: 'moot', previousStatus: 'ignore', trashedAt: now - 22 * HOUR },
];

export function hoursLeft(trashedAt: number): string {
  const left = trashedAt + TRASH_TTL_MS - Date.now();
  if (left <= 0) return 'expired';
  const h = Math.ceil(left / HOUR);
  return h <= 1 ? '<1h left' : `${h}h left`;
}

export function daysAgo(at: number): string {
  const diff = Date.now() - at;
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))}m ago`;
  if (diff < 24 * HOUR) return `${Math.round(diff / HOUR)}h ago`;
  return `${Math.round(diff / (24 * HOUR))}d ago`;
}
