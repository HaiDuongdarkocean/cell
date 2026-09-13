import { describe, it, expect } from '@jest/globals';
import {
  findActiveCueIndex,
  findNearestCueIndex,
  prevSentence,
  nextSentence,
  seekBy,
} from '@/features/subtitle/ui/navClusterActions';
import type { SrtCue } from '@/entities/media';

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  const video = {
    currentTime: 0,
    duration: 100,
    ...overrides,
  } as unknown as HTMLVideoElement;
  return video;
}

const CUES: SrtCue[] = [
  { index: 1, start: 0, end: 2000, text: 'Hello' },
  { index: 2, start: 3000, end: 5000, text: 'World' },
  { index: 3, start: 6000, end: 8000, text: 'Foo' },
];

describe('navClusterActions — pure action helpers (ADR-018 D3, spec §F5-F8)', () => {
  describe('findActiveCueIndex', () => {
    it('returns target cue index when target cues present', () => {
      const result = findActiveCueIndex(CUES, [], 4000);
      expect(result.cues).toBe(CUES);
      expect(result.index).toBe(1);
    });

    it('falls back to native cues when target empty', () => {
      const result = findActiveCueIndex([], CUES, 4000);
      expect(result.cues).toBe(CUES);
      expect(result.index).toBe(1);
    });

    it('returns empty cues + index -1 when both empty', () => {
      const result = findActiveCueIndex([], [], 4000);
      expect(result.cues).toEqual([]);
      expect(result.index).toBe(-1);
    });

    it('returns -1 when currentTime is in gap', () => {
      const result = findActiveCueIndex(CUES, [], 2500);
      expect(result.index).toBe(-1);
    });
  });

  describe('findNearestCueIndex', () => {
    it('returns -1 when cues empty', () => {
      expect(findNearestCueIndex([], 1000)).toBe(-1);
    });

    it('returns 0 when single cue', () => {
      expect(findNearestCueIndex([CUES[0]], 10000)).toBe(0);
    });

    it('returns previous cue when closer by end boundary (in gap)', () => {
      // gap between cue[0] (0-2000) and cue[1] (3000-5000), t=2200
      // dist to cue[0].end(2000) = 200; dist to cue[1].start(3000) = 800
      expect(findNearestCueIndex(CUES, 2200)).toBe(0);
    });

    it('returns next cue when closer by start boundary (in gap)', () => {
      // t=2800: dist to cue[0].end(2000) = 800; dist to cue[1].start(3000) = 200
      expect(findNearestCueIndex(CUES, 2800)).toBe(1);
    });

    it('returns cue at exact tie boundary (earlier wins)', () => {
      // t=2500: dist to cue[0].end(2000) = 500; dist to cue[1].start(3000) = 500
      // tie-break: earlier cue wins (first match kept)
      expect(findNearestCueIndex(CUES, 2500)).toBe(0);
    });

    it('returns last cue when currentTime far beyond all cues', () => {
      expect(findNearestCueIndex(CUES, 100000)).toBe(2);
    });

    it('returns first cue when currentTime far before all cues', () => {
      expect(findNearestCueIndex(CUES, -100000)).toBe(0);
    });
  });

  describe('prevSentence', () => {
    it('seeks to previous cue start when index > 0', () => {
      const video = makeVideo({ currentTime: 4 }); // 4000ms → index 1 (World)
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBeCloseTo(0.08); // cues[0].start + landing eps
    });

    it('seeks to cue[index-1].start/1000', () => {
      const video = makeVideo({ currentTime: 7 }); // index 2 (Foo)
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBeCloseTo(3.08);
    });

    it('no-op when at first cue (index 0)', () => {
      const video = makeVideo({ currentTime: 1 });
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBe(1);
    });

    it('seeks to nearest previous cue when in gap (index -1)', () => {
      const video = makeVideo({ currentTime: 2.5 }); // gap between cue 0 and 1
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBeCloseTo(0.08);
    });

    it('no-op when no cues', () => {
      const video = makeVideo({ currentTime: 5 });
      prevSentence(video, [], []);
      expect(video.currentTime).toBe(5);
    });

    it('falls back to native cues when target empty', () => {
      const video = makeVideo({ currentTime: 7 });
      prevSentence(video, [], CUES);
      expect(video.currentTime).toBeCloseTo(3.08);
    });
  });

  describe('nextSentence', () => {
    it('seeks to next cue start when index < length-1', () => {
      const video = makeVideo({ currentTime: 1 }); // index 0
      nextSentence(video, CUES, []);
      expect(video.currentTime).toBeCloseTo(3.08);
    });

    it('no-op when at last cue', () => {
      const video = makeVideo({ currentTime: 7 }); // index 2 (last)
      nextSentence(video, CUES, []);
      expect(video.currentTime).toBe(7);
    });

    it('seeks to nearest next cue when in gap', () => {
      const video = makeVideo({ currentTime: 2.5 }); // gap
      nextSentence(video, CUES, []);
      expect(video.currentTime).toBeCloseTo(3.08);
    });

    it('no-op when no cues', () => {
      const video = makeVideo({ currentTime: 5 });
      nextSentence(video, [], []);
      expect(video.currentTime).toBe(5);
    });

    it('advances through overlapping cues instead of wedging on the earlier one', () => {
      // cues[1] (5-15) overlaps cues[2] (10-20). After seeking to cues[2].start,
      // binary search can still land on cues[1] → old code re-sought the same
      // position forever, making nav-next appear disabled while cues remain.
      const OVERLAP: SrtCue[] = [
        { index: 1, start: 0, end: 10000, text: 'A' },
        { index: 2, start: 5000, end: 15000, text: 'B' },
        { index: 3, start: 10000, end: 20000, text: 'C' },
        { index: 4, start: 30000, end: 40000, text: 'D' },
      ];
      const video = makeVideo({ currentTime: 0 });
      nextSentence(video, OVERLAP, []);
      expect(video.currentTime).toBeCloseTo(5.08);
      nextSentence(video, OVERLAP, []);
      expect(video.currentTime).toBeCloseTo(10.08);
      nextSentence(video, OVERLAP, []);
      expect(video.currentTime).toBeCloseTo(30.08);
      nextSentence(video, OVERLAP, []);
      expect(video.currentTime).toBeCloseTo(30.08);
    });

    it('advances when the browser lands the seek a frame before cue.start', () => {
      // Chrome resolves currentTime to the frame at/below the target, e.g.
      // requesting 2.066 lands at 2.065999. Without a landing tolerance the
      // next press treats that same cue as "ahead" and wedges forever —
      // reproduced on real Chrome (nav-next appeared disabled at cue 1).
      const EDGE: SrtCue[] = [
        { index: 1, start: 2066, end: 4500, text: 'first' },
        { index: 2, start: 6000, end: 8000, text: 'second' },
      ];
      const video = makeVideo({ currentTime: 2.065999 });
      nextSentence(video, EDGE, []);
      expect(video.currentTime).toBeCloseTo(6.08);
    });

    it('skips cues that already ended inside an overlap window', () => {
      // cues[0] is a long background cue; cues[1]/cues[2] already ended.
      // "next" must land on the first cue starting after now, not rewind.
      const LONG: SrtCue[] = [
        { index: 1, start: 0, end: 100000, text: 'long' },
        { index: 2, start: 10000, end: 12000, text: 'past1' },
        { index: 3, start: 20000, end: 22000, text: 'past2' },
        { index: 4, start: 60000, end: 70000, text: 'next' },
      ];
      const video = makeVideo({ currentTime: 50 });
      nextSentence(video, LONG, []);
      expect(video.currentTime).toBeCloseTo(60.08);
    });
  });

  describe('seekBy', () => {
    it('rewinds 5 seconds', () => {
      const video = makeVideo({ currentTime: 20 });
      seekBy(video, -5);
      expect(video.currentTime).toBe(15);
    });

    it('forwards 10 seconds', () => {
      const video = makeVideo({ currentTime: 20 });
      seekBy(video, 10);
      expect(video.currentTime).toBe(30);
    });

    it('clamps to 0 when rewinding past start', () => {
      const video = makeVideo({ currentTime: 2 });
      seekBy(video, -5);
      expect(video.currentTime).toBe(0);
    });

    it('clamps to duration when forwarding past end', () => {
      const video = makeVideo({ currentTime: 95, duration: 100 });
      seekBy(video, 10);
      expect(video.currentTime).toBe(100);
    });

    it('no upper clamp when duration is NaN (live stream)', () => {
      const video = makeVideo({ currentTime: 50, duration: NaN });
      seekBy(video, 10);
      expect(video.currentTime).toBe(60);
    });

    it('no upper clamp when duration is Infinity', () => {
      const video = makeVideo({ currentTime: 50, duration: Infinity });
      seekBy(video, 10);
      expect(video.currentTime).toBe(60);
    });
  });
});
