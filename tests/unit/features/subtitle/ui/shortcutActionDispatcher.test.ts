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
