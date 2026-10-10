import {
  composeSessionRecaps,
  groupSessions,
  type StatusEntryLike,
} from '@/features/sessionRecap/logic/sessionGrouper';
import type {
  HistoryRecord,
  SessionEvent,
  VideoRecord,
} from '@/features/local-player/services/mediaLibraryRepository';
import { SESSION_GROUP_GAP_MS } from '@/features/sessionRecap/types';

const T0 = Date.parse('2026-10-03T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const rec = (id: string, videoId: string, start: number, dur: number): HistoryRecord => ({
  id,
  videoId,
  watchedAt: iso(start),
  watchDurationMs: dur,
  positionMs: dur,
});

const ev = (
  kind: 'lookup' | 'status',
  at: number,
  over: Partial<SessionEvent> = {},
): SessionEvent => ({
  id: `${at}-${kind}`,
  at,
  tabId: 1,
  surface: 'stream',
  kind,
  term: 'term',
  ...over,
});

const video = (id: string, title: string, coverage?: number): VideoRecord => ({
  id,
  filename: `${title}.mp4`,
  title,
  durationMs: 1000,
  addedAt: iso(T0),
  lastWatchedAt: null,
  resumePositionMs: 0,
  ...(coverage !== undefined
    ? { comprehension: { coverage, band: 'comfortable', newTerms: 0, subtitleFilename: 's.srt', computedAt: iso(T0) } }
    : {}),
});

const status = (
  term: string,
  s: string,
  at: number,
  source?: string,
): StatusEntryLike => ({ term, status: s, updatedAt: at, sourceAt: at, source });

describe('groupSessions', () => {
  it('merges records of same videoId within gap, splits on gap or videoId', () => {
    const sessions = groupSessions([
      rec('watch-v1-1', 'v1', T0, 60_000),
      rec('watch-v1-2', 'v1', T0 + 70_000, 60_000),
      rec('watch-v2-1', 'v2', T0 + 140_000, 60_000),
      rec('watch-v1-3', 'v1', T0 + 70_000 + 60_000 + SESSION_GROUP_GAP_MS + 1, 60_000),
    ]);
    expect(sessions).toHaveLength(3);
    expect(sessions[0]!.records).toHaveLength(2);
    expect(sessions[0]!.eventWindowEnd).toBe(T0 + 130_000 + SESSION_GROUP_GAP_MS);
    expect(sessions[1]!.records).toHaveLength(1);
    expect(sessions[2]!.records).toHaveLength(1);
  });

  it('extracts stream tabId from stream-<tabId>-* records', () => {
    const [s] = groupSessions([rec('stream-42-1', 'stream:youtube.com', T0, 60_000)]);
    expect(s!.kind).toBe('stream');
    expect(s!.streamTabId).toBe(42);
  });
});

describe('composeSessionRecaps', () => {
  it('attributes events by tabId to the matching stream session', () => {
    const recaps = composeSessionRecaps({
      records: [
        rec('stream-7-1', 'stream:youtube.com', T0, 300_000),
        rec('stream-9-1', 'stream:netflix.com', T0 + 10_000, 300_000),
      ],
      events: [
        ev('lookup', T0 + 5_000, { tabId: 7, term: 'alpha' }),
        ev('lookup', T0 + 6_000, { tabId: 9, term: 'beta' }),
      ],
      videos: [],
      statusEntries: [],
      nowMs: T0 + 400_000,
    });
    const yt = recaps.find((r) => r.videoId === 'stream:youtube.com')!;
    const nf = recaps.find((r) => r.videoId === 'stream:netflix.com')!;
    expect(yt.lookups?.terms).toEqual(['alpha']);
    expect(nf.lookups?.terms).toEqual(['beta']);
  });

  it('attributes unattributed events by unique window overlap (pause lookup)', () => {
    const recap = composeSessionRecaps({
      records: [rec('watch-v1-1', 'v1', T0, 60_000), rec('watch-v1-2', 'v1', T0 + 660_000, 60_000)],
      events: [ev('lookup', T0 + 300_000, { tabId: 55, term: 'pause-word', surface: 'local-player' })],
      videos: [video('v1', 'Ep1')],
      statusEntries: [],
      nowMs: T0 + 800_000,
    });
    expect(recap).toHaveLength(1);
    expect(recap[0]!.lookups?.terms).toEqual(['pause-word']);
    expect(recap[0]!.durationMs).toBe(120_000);
  });

  it('drops events overlapping multiple sessions', () => {
    const recaps = composeSessionRecaps({
      records: [
        rec('watch-a-1', 'a', T0, 600_000),
        rec('watch-b-1', 'b', T0, 600_000),
      ],
      events: [ev('lookup', T0 + 100_000, { tabId: -1 })],
      videos: [],
      statusEntries: [],
      nowMs: T0 + 700_000,
    });
    expect(recaps.every((r) => r.lookups === undefined)).toBe(true);
  });

  it('groups status events by status with derived=false', () => {
    const recaps = composeSessionRecaps({
      records: [rec('watch-v1-1', 'v1', T0, 300_000)],
      events: [
        ev('status', T0 + 10_000, { term: '猫', status: 'known', surface: 'local-player' }),
        ev('status', T0 + 20_000, { term: '犬', status: 'known', surface: 'local-player' }),
        ev('status', T0 + 30_000, { term: '山', status: 'tracking', surface: 'local-player' }),
        ev('status', T0 + 40_000, { term: '水', status: 'bogus', surface: 'local-player' }),
      ],
      videos: [video('v1', 'Ep1')],
      statusEntries: [],
      nowMs: T0 + 400_000,
    });
    const changes = recaps[0]!.statusChanges!;
    expect(changes.count).toBe(3);
    expect(changes.derived).toBe(false);
    const known = changes.groups.find((g) => g.status === 'known')!;
    expect(known.terms).toEqual(['猫', '犬']);
    const tracking = changes.groups.find((g) => g.status === 'tracking')!;
    expect(tracking.terms).toEqual(['山']);
  });

  it('derives status changes for sessions with no captured events (source user, in-window)', () => {
    const recaps = composeSessionRecaps({
      records: [rec('watch-v1-1', 'v1', T0, 300_000)],
      events: [],
      videos: [video('v1', 'Ep1')],
      statusEntries: [
        status('猫', 'known', T0 + 50_000, 'user'),
        status('犬', 'known', T0 + 60_000, 'sync'),
        status('古い', 'known', T0 - 50 * 86_400_000, 'user'),
      ],
      nowMs: T0 + 400_000,
    });
    const changes = recaps[0]!.statusChanges!;
    expect(changes.derived).toBe(true);
    const known = changes.groups.find((g) => g.status === 'known')!;
    expect(known.terms).toEqual(['猫']);
  });

  it('does not derive for sessions older than DERIVE_LOOKBACK_DAYS', () => {
    const old = T0 - 40 * 86_400_000;
    const recaps = composeSessionRecaps({
      records: [rec('watch-v1-1', 'v1', old, 300_000)],
      events: [],
      videos: [],
      statusEntries: [status('猫', 'known', old + 10_000, 'user')],
      nowMs: T0,
    });
    expect(recaps[0]!.statusChanges).toBeUndefined();
  });

  it('attaches coverage for local videos only', () => {
    const recaps = composeSessionRecaps({
      records: [
        rec('watch-v1-1', 'v1', T0, 300_000),
        rec('stream-1-1', 'stream:youtube.com', T0 + 1_000, 300_000),
      ],
      events: [],
      videos: [video('v1', 'Ep1', 0.68)],
      statusEntries: [],
      nowMs: T0 + 400_000,
    });
    const local = recaps.find((r) => r.kind === 'local')!;
    const stream = recaps.find((r) => r.kind === 'stream')!;
    expect(local.coverage?.value).toBeCloseTo(0.68);
    expect(local.sourceLabel).toBe('Ep1');
    expect(stream.coverage).toBeUndefined();
    expect(stream.sourceLabel).toBe('youtube.com');
  });

  it('dedups lookups by term with moreCount, caps list', () => {
    const events = Array.from({ length: 40 }, (_, i) =>
      ev('lookup', T0 + i * 1000, { term: `w${i % 35}`, tabId: 1 }),
    );
    const recaps = composeSessionRecaps({
      records: [rec('stream-1-1', 'stream:youtube.com', T0, 60_000)],
      events,
      videos: [],
      statusEntries: [],
      nowMs: T0 + 200_000,
    });
    const l = recaps[0]!.lookups!;
    expect(l.count).toBe(40);
    expect(l.terms).toHaveLength(30);
    expect(l.moreCount).toBe(5);
  });

  it('marks sessions flushing within LIVE_FLUSH_MS as live', () => {
    const recaps = composeSessionRecaps({
      records: [
        rec('watch-v1-1', 'v1', T0, 60_000),
        rec('watch-v2-1', 'v2', T0 - 600_000, 60_000),
      ],
      events: [],
      videos: [],
      statusEntries: [],
      nowMs: T0 + 70_000,
    });
    expect(recaps[0]!.live).toBe(true);
    expect(recaps[1]!.live).toBe(false);
  });
});
