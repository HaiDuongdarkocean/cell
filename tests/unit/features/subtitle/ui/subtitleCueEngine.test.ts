import { describe, it, expect } from '@jest/globals';
import { SubtitleCueEngine } from '@/features/subtitle/ui/subtitleCueEngine';
import type { SrtCue } from '@/entities/media';

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    currentTime: 0,
    paused: true,
    play: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as HTMLVideoElement;
}

const CUES: SrtCue[] = [
  { index: 1, start: 0, end: 2000, text: 'Hello' },
  { index: 2, start: 3000, end: 5000, text: 'World' },
  { index: 3, start: 6000, end: 8000, text: 'Foo' },
];

describe('SubtitleCueEngine.repeatOnce — replay resumes paused playback', () => {
  it('resumes a paused video after seeking to the active cue', () => {
    const video = makeVideo({ currentTime: 4 });
    const engine = new SubtitleCueEngine(video);
    engine.loadCues(CUES);
    engine.repeatOnce();
    expect(video.currentTime).toBeCloseTo(3.08);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('resumes when falling back to the previous cue in a gap', () => {
    const video = makeVideo({ currentTime: 5.5 });
    const engine = new SubtitleCueEngine(video);
    engine.loadCues(CUES);
    engine.repeatOnce();
    expect(video.currentTime).toBeCloseTo(3.08);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('does not call play when already playing', () => {
    const video = makeVideo({ currentTime: 4, paused: false });
    const engine = new SubtitleCueEngine(video);
    engine.loadCues(CUES);
    engine.repeatOnce();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('does not resume when there is no cue to replay', () => {
    const video = makeVideo({ currentTime: 4 });
    const engine = new SubtitleCueEngine(video);
    engine.repeatOnce();
    expect(video.play).not.toHaveBeenCalled();
  });
});
