import type { AnkiBridgeEvent } from '@/entities/ankiStatusSync';

/** Parse the addon feed body into events + next cursor. Accepts
 *  `{cursor, events}` JSON or JSONL rows `{cursor, cardId, kind, ts}`.
 *  Malformed rows are skipped — caller advances cursor only to the last
 *  parsed row. */
export function parseFeedBody(
  text: string,
): { events: AnkiBridgeEvent[]; cursor: number } | null {
  const trimmed = text.trim();
  if (trimmed === '') return { events: [], cursor: 0 };
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { cursor?: unknown; events?: unknown };
      const cursor = typeof json.cursor === 'number' && json.cursor >= 0 ? json.cursor : 0;
      const events = Array.isArray(json.events) ? parseRows(json.events) : [];
      return { events, cursor };
    } catch {
      // fall through to JSONL row parsing
    }
  }
  const events: AnkiBridgeEvent[] = [];
  let cursor = 0;
  let sawLine = false;
  for (const line of trimmed.split('\n')) {
    if (line.trim() === '') continue;
    sawLine = true;
    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      const event = parseRow(row);
      if (event === null) continue;
      events.push(event);
      if (typeof row.cursor === 'number' && row.cursor > cursor) cursor = row.cursor;
    } catch {
      continue;
    }
  }
  if (sawLine && events.length === 0 && cursor === 0) return null;
  return { events, cursor };
}

function parseRows(rows: readonly unknown[]): AnkiBridgeEvent[] {
  const events: AnkiBridgeEvent[] = [];
  for (const row of rows) {
    const event = parseRow(row as Record<string, unknown>);
    if (event !== null) events.push(event);
  }
  return events;
}

function parseRow(row: Record<string, unknown>): AnkiBridgeEvent | null {
  if (typeof row !== 'object' || row === null) return null;
  if (typeof row.cardId !== 'number' || !Number.isFinite(row.cardId)) return null;
  if (typeof row.ts !== 'number' || !Number.isFinite(row.ts)) return null;
  const kind = typeof row.kind === 'string' ? row.kind : 'unknown';
  return { cardId: row.cardId, kind, ts: row.ts };
}
