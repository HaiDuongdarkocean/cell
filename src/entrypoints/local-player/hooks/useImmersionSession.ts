import { useEffect } from 'react';
import { addHistoryEntry } from '@/features/local-player/services/mediaLibraryRepository';
import { accumulateDelta, FLUSH_INTERVAL_MS } from '@/features/local-player/logic/immersionClock';
import { serialQueue } from '@/shared/lib/async';

interface Segment {
  id: string;
  startedAt: string;
  acc: number;
  flushedAcc: number;
  lastEventAt: number;
}

/**
 * useImmersionSession — records wall-clock watch time for the loaded local
 * video into the `history` IDB store (immersion-clock). One HistoryRecord per
 * play-segment (`watch-<videoId>-<startMs>`), upserted as `watchDurationMs`
 * grows so a session never duplicates. Accumulates only while playing —
 * `timeupdate` on seek-while-paused is ignored. pause/ended/unmount closes
 * the segment; resuming opens a new one.
 */
export function useImmersionSession(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  videoId: string | null,
  videoFile?: File | null,
): void {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoId) return;

    let segment: Segment | null = null;
    const enqueue = serialQueue();

    const flush = (final: boolean): void => {
      const seg = segment;
      if (!seg) return;
      if (final ? seg.acc <= seg.flushedAcc : seg.acc - seg.flushedAcc < FLUSH_INTERVAL_MS) {
        return;
      }
      const value = seg.acc;
      const record = {
        id: seg.id,
        videoId,
        watchedAt: seg.startedAt,
        watchDurationMs: Math.round(value),
        positionMs: video.currentTime * 1000,
      };
      void enqueue(async () => {
        await addHistoryEntry(record);
        seg.flushedAcc = Math.max(seg.flushedAcc, value);
      }).catch(() => {});
    };

    const closeSegment = (): void => {
      flush(true);
      segment = null;
    };

    const onTimeUpdate = (): void => {
      const now = Date.now();
      if (!segment) {
        segment = {
          id: `watch-${videoId}-${now}`,
          startedAt: new Date(now).toISOString(),
          acc: 0,
          flushedAcc: 0,
          lastEventAt: now,
        };
        return;
      }
      if (!video.paused) segment.acc = accumulateDelta(segment.acc, segment.lastEventAt, now);
      segment.lastEventAt = now;
      flush(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('pause', closeSegment);
    video.addEventListener('ended', closeSegment);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('pause', closeSegment);
      video.removeEventListener('ended', closeSegment);
      closeSegment();
    };
  }, [videoRef, videoId, videoFile]);
}
