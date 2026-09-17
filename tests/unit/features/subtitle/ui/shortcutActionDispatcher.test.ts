import { describe, it, expect } from '@jest/globals';
import { navigateCue } from '@/features/subtitle/ui/shortcutActionDispatcher';
import type { BilingualCue } from '@/entities/media';

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    currentTime: 0,
    paused: true,
    play: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as HTMLVideoElement;
}

const CUES: BilingualCue[] = [
  { index: 1, start: 0, end: 2000, targetText: 'Hello', nativeText: 'Xin chào' },
  { index: 2, start: 3000, end: 5000, targetText: 'World', nativeText: 'Thế giới' },
  { index: 3, start: 6000, end: 8000, targetText: 'Foo', nativeText: 'Foo' },
];

describe('navigateCue — replay resumes paused playback', () => {
  it('replay-cue seeks to current cue and resumes when paused', () => {
    const video = makeVideo();
    navigateCue('replay-cue', video, CUES, 4000, 0);
    expect(video.currentTime).toBeCloseTo(3.08);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('replay-cue in gap falls back to previous cue and resumes', () => {
    const video = makeVideo();
    navigateCue('replay-cue', video, CUES, 5500, 0);
    expect(video.currentTime).toBeCloseTo(3.08);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('replay-cue does not call play when already playing', () => {
    const video = makeVideo({ paused: false });
    navigateCue('replay-cue', video, CUES, 4000, 0);
    expect(video.play).not.toHaveBeenCalled();
  });

  it('replay-cue does not resume when no cue is found', () => {
    const video = makeVideo();
    navigateCue('replay-cue', video, [], 4000, 0);
    expect(video.play).not.toHaveBeenCalled();
  });

  it('prev-cue / next-cue leave paused state untouched', () => {
    const prevVideo = makeVideo();
    navigateCue('prev-cue', prevVideo, CUES, 4000, 0);
    expect(prevVideo.play).not.toHaveBeenCalled();

    const nextVideo = makeVideo();
    navigateCue('next-cue', nextVideo, CUES, 1000, 0);
    expect(nextVideo.play).not.toHaveBeenCalled();
  });
});

describe('navigateCue — paused anchors at the active cue', () => {
  // Pause-on-unknown holds cue N while currentTime sits near cue N's end;
  // anchored nav must resolve relative to cue N, not the drifted position.
  const HELD_CUES: BilingualCue[] = [
    { index: 1, start: 0, end: 2000, targetText: 'One', nativeText: '' },
    { index: 2, start: 2050, end: 4000, targetText: 'Two', nativeText: '' },
    { index: 3, start: 6000, end: 8000, targetText: 'Three', nativeText: '' },
  ];
  const CONTIG_CUES: BilingualCue[] = [
    { index: 1, start: 0, end: 2000, targetText: 'One', nativeText: '' },
    { index: 2, start: 2000, end: 4000, targetText: 'Two', nativeText: '' },
    { index: 3, start: 4000, end: 6000, targetText: 'Three', nativeText: '' },
  ];

  it('next-cue paused at cue 1 seeks cue 2, not cue 3', () => {
    const video = makeVideo({ paused: true, currentTime: 2 });
    navigateCue('next-cue', video, HELD_CUES, 2000, 0, 0);
    expect(video.currentTime).toBeCloseTo(2.13);
  });

  it('next-cue while playing ignores the anchor (effectiveMs unchanged)', () => {
    const video = makeVideo({ paused: false, currentTime: 2 });
    navigateCue('next-cue', video, HELD_CUES, 2000, 0, 0);
    expect(video.currentTime).toBeCloseTo(6.08);
  });

  it('next-cue paused with no active cue (-1) keeps effectiveMs behavior', () => {
    const video = makeVideo({ paused: true, currentTime: 2 });
    navigateCue('next-cue', video, HELD_CUES, 2000, 0, -1);
    expect(video.currentTime).toBeCloseTo(6.08);
  });

  it('next-cue paused with a stale out-of-range index keeps effectiveMs behavior', () => {
    const video = makeVideo({ paused: true, currentTime: 2 });
    navigateCue('next-cue', video, HELD_CUES, 2000, 0, 99);
    expect(video.currentTime).toBeCloseTo(6.08);
  });

  it('prev-cue paused at cue 3 seeks the contiguous previous cue 2', () => {
    const video = makeVideo({ paused: true, currentTime: 4 });
    navigateCue('prev-cue', video, CONTIG_CUES, 4000, 0, 2);
    expect(video.currentTime).toBeCloseTo(2.08);
  });

  it('replay-cue paused at cue 2 re-seeks cue 2 and resumes', () => {
    const video = makeVideo({ paused: true, currentTime: 6 });
    navigateCue('replay-cue', video, CONTIG_CUES, 6000, 0, 1);
    expect(video.currentTime).toBeCloseTo(2.08);
    expect(video.play).toHaveBeenCalledTimes(1);
  });
});
