import {
  accumulateDelta,
  FLUSH_INTERVAL_MS,
  SESSION_IDLE_MS,
} from '@/features/local-player/logic/immersionClock';
import type { HistoryRecord } from '@/features/local-player/services/mediaLibraryRepository';
import { serialQueue } from '@/shared/lib/async';

export interface ImmersionTrackerDeps {
  addEntry: (record: HistoryRecord) => Promise<void>;
  getHost: (tabId: number) => Promise<string | null>;
  hasSession: (tabId: number) => boolean;
  now?: () => number;
}

export interface ImmersionTracker {
  noteTimeUpdate(tabId: number, currentTimeMs: number, isPlaying?: boolean): void;
  notePlayState(tabId: number, isPlaying: boolean): void;
  closeTab(tabId: number): void;
}

interface Segment {
  id: string;
  videoId: string;
  startedAt: string;
  acc: number;
  flushedAcc: number;
  lastEventAt: number;
  positionMs: number;
}

/**
 * Per-tab wall-clock watch-time accumulator for streaming sites
 * (immersion-clock). Fed by the VIDEO_TIME_UPDATE/VIDEO_PLAY_STATE relay in
 * sidePanelRelay — only counts while `hasSession(tabId)` (Tihoka cues exist for
 * the tab). Segments upsert one HistoryRecord each (`stream-<tabId>-<start>`);
 * pause/close ends a segment, resume starts a new one. Fail-closed: write
 * failures keep accumulating, SW death loses < FLUSH_INTERVAL_MS.
 */
export function createImmersionTracker(deps: ImmersionTrackerDeps): ImmersionTracker {
  const now = deps.now ?? (() => Date.now());
  const segments = new Map<number, Segment>();
  const hosts = new Map<number, Promise<string>>();
  // Fresh senders carry isPlaying inside each timeupdate (ground truth at
  // emit time — fixes autoplay-before-attach, where no 'play' event ever
  // fires, and paused-scrub). Older payloads fall back to this map: absent
  // = assume playing (a tab emitting timeupdate usually is); an explicit
  // pause flips it and drops subsequent updates.
  const playingByTab = new Map<number, boolean>();
  const enqueue = serialQueue();

  const hostFor = (tabId: number): Promise<string> => {
    let p = hosts.get(tabId);
    if (!p) {
      p = deps
        .getHost(tabId)
        .then((h) => h ?? 'web')
        .catch(() => 'web');
      hosts.set(tabId, p);
    }
    return p;
  };

  const write = (seg: Segment, value: number): void => {
    const record: HistoryRecord = {
      id: seg.id,
      videoId: seg.videoId,
      watchedAt: seg.startedAt,
      watchDurationMs: Math.round(value),
      positionMs: seg.positionMs,
    };
    void enqueue(async () => {
      await deps.addEntry(record);
      seg.flushedAcc = Math.max(seg.flushedAcc, value);
    }).catch(() => {});
  };

  const flush = (seg: Segment, final: boolean): void => {
    if (final ? seg.acc <= seg.flushedAcc : seg.acc - seg.flushedAcc < FLUSH_INTERVAL_MS) return;
    write(seg, seg.acc);
  };

  const close = (tabId: number): void => {
    const seg = segments.get(tabId);
    if (!seg) return;
    flush(seg, true);
    segments.delete(tabId);
    hosts.delete(tabId);
  };

  const open = (tabId: number, t: number, positionMs: number): Segment => {
    const seg: Segment = {
      id: `stream-${tabId}-${t}`,
      videoId: 'stream:web',
      startedAt: new Date(t).toISOString(),
      acc: 0,
      flushedAcc: 0,
      lastEventAt: t,
      positionMs,
    };
    segments.set(tabId, seg);
    void hostFor(tabId).then((host) => {
      seg.videoId = `stream:${host}`;
    });
    return seg;
  };

  return {
    noteTimeUpdate(tabId, currentTimeMs, isPlaying) {
      if (!deps.hasSession(tabId)) return;
      if (isPlaying !== undefined) {
        playingByTab.set(tabId, isPlaying);
        if (!isPlaying) {
          close(tabId);
          return;
        }
      }
      if (playingByTab.get(tabId) === false) return;
      const t = now();
      let seg = segments.get(tabId);
      if (seg && t - seg.lastEventAt > SESSION_IDLE_MS) {
        close(tabId);
        seg = undefined;
      }
      if (!seg) {
        open(tabId, t, currentTimeMs);
        return;
      }
      seg.acc = accumulateDelta(seg.acc, seg.lastEventAt, t);
      seg.lastEventAt = t;
      seg.positionMs = currentTimeMs;
      flush(seg, false);
    },

    notePlayState(tabId, isPlaying) {
      if (!deps.hasSession(tabId)) return;
      const t = now();
      if (isPlaying) {
        playingByTab.set(tabId, true);
        const seg = segments.get(tabId);
        if (seg) seg.lastEventAt = t;
        else open(tabId, t, 0);
        return;
      }
      playingByTab.set(tabId, false);
      close(tabId);
    },

    closeTab(tabId) {
      playingByTab.delete(tabId);
      close(tabId);
    },
  };
}
