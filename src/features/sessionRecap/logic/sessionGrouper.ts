import type {
  HistoryRecord,
  SessionEvent,
  VideoRecord,
} from '@/features/local-player';
import { normalizeStoredStatus, type StoredWordStatus } from '@/features/dictionary';
import {
  DERIVE_LOOKBACK_DAYS,
  LIVE_FLUSH_MS,
  SESSION_GROUP_GAP_MS,
  TERMS_CAP,
  type SessionRecap,
  type SessionRecapStatus,
  type SessionRecapStatusGroup,
} from '../types';

export interface StatusEntryLike {
  readonly term: string;
  readonly pos?: string;
  readonly status: string;
  readonly updatedAt: number;
  readonly source?: string;
  readonly sourceAt?: number;
}

const VALID_STATUSES = new Set<SessionRecapStatus>([
  'tracking',
  'known',
  'ignore',
]);

const STATUS_ORDER: readonly SessionRecapStatus[] = [
  'known',
  'tracking',
  'ignore',
];

interface RawSession {
  readonly videoId: string;
  readonly kind: 'local' | 'stream';
  readonly streamTabId?: number;
  readonly records: HistoryRecord[];
  readonly startMs: number;
  readonly endMs: number;
  readonly eventWindowStart: number;
  readonly eventWindowEnd: number;
}

const STREAM_ID_RE = /^stream-(-?\d+)-\d+$/;

function parseStreamTabId(recordId: string): number | undefined {
  const m = STREAM_ID_RE.exec(recordId);
  return m ? Number.parseInt(m[1]!, 10) : undefined;
}

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Group consecutive history records into user-facing sessions: same videoId,
 *  gap between segments ≤ SESSION_GROUP_GAP_MS. */
export function groupSessions(records: readonly HistoryRecord[]): RawSession[] {
  const sorted = [...records].sort((a, b) => toMs(a.watchedAt) - toMs(b.watchedAt));
  const sessions: RawSession[] = [];
  let cur: HistoryRecord[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    const first = cur[0]!;
    const last = cur[cur.length - 1]!;
    const startMs = toMs(first.watchedAt);
    const endMs = toMs(last.watchedAt) + last.watchDurationMs;
    sessions.push({
      videoId: first.videoId,
      kind: first.id.startsWith('stream-') ? 'stream' : 'local',
      streamTabId: parseStreamTabId(first.id),
      records: cur,
      startMs,
      endMs,
      eventWindowStart: startMs - SESSION_GROUP_GAP_MS,
      eventWindowEnd: endMs + SESSION_GROUP_GAP_MS,
    });
    cur = [];
  };

  for (const r of sorted) {
    const prev = cur[cur.length - 1];
    const start = toMs(r.watchedAt);
    const prevEnd = prev ? toMs(prev.watchedAt) + prev.watchDurationMs : 0;
    if (prev && (r.videoId !== prev.videoId || start - prevEnd > SESSION_GROUP_GAP_MS)) {
      flush();
    }
    cur.push(r);
  }
  flush();
  return sessions;
}

function attributeEvents(
  sessions: readonly RawSession[],
  events: readonly SessionEvent[],
): Map<RawSession, SessionEvent[]> {
  const byTabId = new Map<number, RawSession>();
  for (const s of sessions) {
    if (s.streamTabId !== undefined) byTabId.set(s.streamTabId, s);
  }
  const out = new Map<RawSession, SessionEvent[]>();
  for (const e of events) {
    let target: RawSession | undefined;
    if (e.surface === 'stream') {
      target = e.tabId >= 0 ? byTabId.get(e.tabId) : undefined;
    } else {
      const pool =
        e.surface === 'local-player' ? sessions.filter((s) => s.kind === 'local') : sessions;
      const hits = pool.filter(
        (s) => e.at >= s.eventWindowStart && e.at <= s.eventWindowEnd,
      );
      if (hits.length === 1) target = hits[0];
    }
    if (!target) continue;
    const list = out.get(target);
    if (list) list.push(e);
    else out.set(target, [e]);
  }
  return out;
}

function dedupTerms(values: readonly { term: string }[]): {
  terms: string[];
  moreCount: number;
} {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const v of values) {
    if (seen.has(v.term)) continue;
    seen.add(v.term);
    if (terms.length < TERMS_CAP) terms.push(v.term);
  }
  return { terms, moreCount: Math.max(0, seen.size - terms.length) };
}

function buildStatusGroups(
  entries: readonly { status?: string; term: string; pos?: string }[],
): { count: number; groups: SessionRecapStatusGroup[] } {
  const byStatus = new Map<SessionRecapStatus, { term: string; pos?: string }[]>();
  for (const e of entries) {
    if (e.status === undefined) continue;
    const k = normalizeStoredStatus(e.status as StoredWordStatus);
    if (k === 'unknown' || !VALID_STATUSES.has(k)) continue;
    const list = byStatus.get(k);
    if (list) list.push(e);
    else byStatus.set(k, [e]);
  }
  let count = 0;
  const groups: SessionRecapStatusGroup[] = [];
  for (const status of STATUS_ORDER) {
    const list = byStatus.get(status);
    if (!list) continue;
    const dedup = dedupTerms(list);
    count += list.length;
    groups.push({ status, terms: dedup.terms, moreCount: dedup.moreCount });
  }
  return { count, groups };
}

export interface ComposeInput {
  readonly records: readonly HistoryRecord[];
  readonly events: readonly SessionEvent[];
  readonly videos: readonly VideoRecord[];
  readonly statusEntries: readonly StatusEntryLike[];
  readonly nowMs: number;
}

/** Pure composer: records + events (+ derived statuses for pre-feature
 *  sessions) → display-ready SessionRecap[], newest first. */
export function composeSessionRecaps(input: ComposeInput): SessionRecap[] {
  const { records, events, videos, statusEntries, nowMs } = input;
  const sessions = groupSessions(records);
  const joined = attributeEvents(sessions, events);
  const videosById = new Map(videos.map((v) => [v.id, v]));
  const deriveFloor = nowMs - DERIVE_LOOKBACK_DAYS * 86_400_000;

  const recaps: SessionRecap[] = sessions.map((s) => {
    const sessionEvents = joined.get(s) ?? [];
    const lookups = sessionEvents.filter((e) => e.kind === 'lookup');
    const marks = sessionEvents.filter((e) => e.kind === 'status');

    const lookupDedup = dedupTerms(lookups);
    const lookupInfo =
      lookups.length > 0
        ? {
            count: lookups.length,
            terms: lookupDedup.terms,
            moreCount: lookupDedup.moreCount,
          }
        : undefined;

    let statusChanges: SessionRecap['statusChanges'];
    if (marks.length > 0) {
      const built = buildStatusGroups(marks);
      if (built.count > 0) {
        statusChanges = { count: built.count, groups: built.groups, derived: false };
      }
    } else if (s.startMs >= deriveFloor) {
      const derived = statusEntries.filter(
        (e) =>
          (e.source === undefined || e.source === 'user') &&
          (e.sourceAt ?? e.updatedAt) >= s.eventWindowStart &&
          (e.sourceAt ?? e.updatedAt) <= s.eventWindowEnd,
      );
      if (derived.length > 0) {
        const built = buildStatusGroups(derived);
        if (built.count > 0) {
          statusChanges = { count: built.count, groups: built.groups, derived: true };
        }
      }
    }

    const video = s.kind === 'local' ? videosById.get(s.videoId) : undefined;
    const sourceLabel =
      s.kind === 'local'
        ? (video?.title ?? video?.filename ?? s.videoId)
        : s.videoId.startsWith('stream:')
          ? s.videoId.slice('stream:'.length)
          : s.videoId;

    const lastRecord = s.records[s.records.length - 1]!;
    const coverage = video?.comprehension
      ? {
          value: video.comprehension.coverage,
          band: video.comprehension.band,
          computedAt: video.comprehension.computedAt,
        }
      : undefined;

    return {
      id: s.records[0]!.id,
      videoId: s.videoId,
      sourceLabel,
      kind: s.kind,
      startMs: s.startMs,
      endMs: s.endMs,
      durationMs: s.records.reduce((a, r) => a + r.watchDurationMs, 0),
      positionMs: lastRecord.positionMs,
      live: nowMs - s.endMs <= LIVE_FLUSH_MS && nowMs - s.endMs >= -60_000,
      ...(lookupInfo ? { lookups: lookupInfo } : {}),
      ...(statusChanges ? { statusChanges } : {}),
      ...(coverage ? { coverage } : {}),
    };
  });

  return recaps.sort((a, b) => b.startMs - a.startMs);
}
