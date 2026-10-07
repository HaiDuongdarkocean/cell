import type { PumpItem } from '../types';

export const PUMP_SESSION_CAP = 200;

function normalizeSentence(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Assemble the ordered session: filter items lacking text → dedupe identical
 * sentences across sources (SRS wins) → SRS items sorted by `dueAt` ascending →
 * queue items appended newest-first (`createdAt` desc) → cap.
 * Pure — callers supply already-resolved items.
 */
export function buildPumpSession(items: readonly PumpItem[], cap = PUMP_SESSION_CAP): PumpItem[] {
  const seen = new Set<string>();
  const srs: PumpItem[] = [];
  const queue: PumpItem[] = [];

  const accept = (item: PumpItem, bucket: PumpItem[]): void => {
    if (!item.sentence || item.sentence.trim().length === 0) return;
    const key = normalizeSentence(item.sentence);
    if (seen.has(key)) return;
    seen.add(key);
    bucket.push(item);
  };

  for (const item of items) if (item.source === 'srs') accept(item, srs);
  for (const item of items) if (item.source !== 'srs') accept(item, queue);

  srs.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
  queue.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return [...srs, ...queue].slice(0, cap);
}
