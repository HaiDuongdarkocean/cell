export const IMMERSION_MILESTONES_H = [0, 50, 150, 300, 600, 1000, 1500] as const;
export const MAX_SESSION_GAP_MS = 2000;
export const FLUSH_INTERVAL_MS = 15_000;
export const SESSION_IDLE_MS = 30_000;

const DAY_MS = 86_400_000;

export function accumulateDelta(acc: number, lastEventAt: number, now: number): number {
  const gap = now - lastEventAt;
  if (gap <= 0) return acc;
  return acc + Math.min(gap, MAX_SESSION_GAP_MS);
}

export function levelForHours(hours: number): {
  level: number;
  floorH: number;
  nextH: number | null;
  progress: number;
} {
  let level = 1;
  for (let i = 1; i < IMMERSION_MILESTONES_H.length; i += 1) {
    if (hours >= IMMERSION_MILESTONES_H[i]) level = i + 1;
  }
  const floorH = IMMERSION_MILESTONES_H[level - 1];
  const nextH = level < IMMERSION_MILESTONES_H.length ? IMMERSION_MILESTONES_H[level] : null;
  const progress = nextH === null ? 1 : Math.min(1, (hours - floorH) / (nextH - floorH));
  return { level, floorH, nextH, progress };
}

export type ImmersionSummary = {
  totalMs: number;
  last7dMs: number;
  todayMs: number;
  streakDays: number;
  bySource: { localMs: number; streamMs: number };
};

export type ImmersionRecordLike = {
  id: string;
  watchedAt: string;
  watchDurationMs: number;
};

const dayKey = (ms: number): string => new Date(ms).toDateString();

function localMidnightAfter(ms: number): number {
  const d = new Date(ms);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function localDayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function aggregateHistory(records: readonly ImmersionRecordLike[], now: Date): ImmersionSummary {
  const dayMs = new Map<string, number>();
  let totalMs = 0;
  let localMs = 0;
  let streamMs = 0;
  const weekFloor = now.getTime() - 7 * DAY_MS;
  let last7dMs = 0;

  for (const record of records) {
    const dur = record.watchDurationMs;
    if (dur <= 0) continue;
    const start = Date.parse(record.watchedAt);
    if (Number.isNaN(start)) continue;
    totalMs += dur;
    if (record.id.startsWith('stream-')) streamMs += dur;
    else localMs += dur;

    let cursor = start;
    const end = start + dur;
    while (cursor < end) {
      const chunkEnd = Math.min(localMidnightAfter(cursor), end);
      const chunk = chunkEnd - cursor;
      const key = dayKey(cursor);
      dayMs.set(key, (dayMs.get(key) ?? 0) + chunk);
      if (chunkEnd > weekFloor) last7dMs += chunk;
      cursor = chunkEnd;
    }
  }

  let streakDays = 0;
  let cursor = localDayStart(now.getTime());
  if (!dayMs.has(dayKey(cursor))) cursor -= DAY_MS;
  while ((dayMs.get(dayKey(cursor)) ?? 0) > 0) {
    streakDays += 1;
    cursor -= DAY_MS;
  }

  return {
    totalMs,
    last7dMs,
    todayMs: dayMs.get(dayKey(now.getTime())) ?? 0,
    streakDays,
    bySource: { localMs, streamMs },
  };
}
