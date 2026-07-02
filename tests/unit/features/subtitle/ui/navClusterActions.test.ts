import { describe, it, expect } from '@jest/globals';
import {
  findActiveCueIndex,
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

  describe('prevSentence', () => {
    it('seeks to previous cue start when index > 0', () => {
      const video = makeVideo({ currentTime: 4 }); // 4000ms → index 1 (World)
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBe(0); // cues[0].start/1000 = 0
    });

    it('seeks to cue[index-1].start/1000', () => {
      const video = makeVideo({ currentTime: 7 }); // index 2 (Foo)
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBe(3); // cues[1].start/1000 = 3
    });

    it('no-op when at first cue (index 0)', () => {
      const video = makeVideo({ currentTime: 1 });
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBe(1);
    });

    it('seeks to nearest previous cue when in gap (index -1)', () => {
      const video = makeVideo({ currentTime: 2.5 }); // gap between cue 0 and 1
      prevSentence(video, CUES, []);
      expect(video.currentTime).toBe(0); // cues[0].start/1000
    });

    it('no-op when no cues', () => {
      const video = makeVideo({ currentTime: 5 });
      prevSentence(video, [], []);
      expect(video.currentTime).toBe(5);
    });

    it('falls back to native cues when target empty', () => {
      const video = makeVideo({ currentTime: 7 });
      prevSentence(video, [], CUES);
      expect(video.currentTime).toBe(3);
    });
  });

  describe('nextSentence', () => {
    it('seeks to next cue start when index < length-1', () => {
      const video = makeVideo({ currentTime: 1 }); // index 0
      nextSentence(video, CUES, []);
      expect(video.currentTime).toBe(3); // cues[1].start/1000
    });

    it('no-op when at last cue', () => {
      const video = makeVideo({ currentTime: 7 }); // index 2 (last)
      nextSentence(video, CUES, []);
      expect(video.currentTime).toBe(7);
    });

    it('seeks to nearest next cue when in gap', () => {
      const video = makeVideo({ currentTime: 2.5 }); // gap
      nextSentence(video, CUES, []);
      expect(video.currentTime).toBe(3); // cues[1].start/1000
    });

    it('no-op when no cues', () => {
      const video = makeVideo({ currentTime: 5 });
      nextSentence(video, [], []);
      expect(video.currentTime).toBe(5);
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
