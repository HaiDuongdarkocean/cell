import { describe, it, expect } from '@jest/globals';
import { SubtitleCueEngine } from './subtitleCueEngine';
import type { SrtCue } from '@/entities/media';

const makeCue = (index: number, start: number, end: number, text: string): SrtCue => ({
  index,
  start,
  end,
  text,
});

describe('SubtitleCueEngine', () => {
  it('holds a finished cue visible when the video pauses just past its end', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    const cues = [makeCue(1, 2000, 6000, 'One'), makeCue(2, 7000, 11000, 'Two')];
    engine.loadCues(cues);

    const updates: number[] = [];
    engine.setCallbacks({ onCuesUpdated: (detail) => updates.push(detail.targetActiveIndex) });

    video.currentTime = 3;
    engine.onTimeUpdate();
    expect(engine.getActiveIndices().target).toBe(0);

    video.currentTime = 6.5;
    engine.onTimeUpdate();
    expect(engine.getActiveIndices().target).toBe(-1);

    engine.setHeldCue(0);
    expect(engine.getActiveIndices().target).toBe(0);
    expect(updates.at(-1)).toBe(0);

    video.currentTime = 6.8;
    engine.onTimeUpdate();
    expect(engine.getActiveIndices().target).toBe(0);

    engine.setHeldCue(-1);
    expect(engine.getActiveIndices().target).toBe(-1);
  });

  it('keeps a held cue over a contiguous next cue', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    const cues = [makeCue(1, 2000, 6000, 'One'), makeCue(2, 6000, 10000, 'Two')];
    engine.loadCues(cues);
    engine.setHeldCue(0);

    video.currentTime = 6.1;
    engine.onTimeUpdate();
    expect(engine.getActiveIndices().target).toBe(0);

    engine.setHeldCue(-1);
    expect(engine.getActiveIndices().target).toBe(1);
  });

  it('resolves the native cue that overlaps the held target cue', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    const targetCues = [makeCue(1, 2000, 6000, 'Target'), makeCue(2, 7000, 11000, 'Target 2')];
    const nativeCues = [makeCue(1, 2000, 6000, 'Native'), makeCue(2, 7000, 11000, 'Native 2')];
    engine.loadBilingualCues(targetCues, nativeCues);

    video.currentTime = 6.5;
    engine.onTimeUpdate();
    expect(engine.getActiveIndices()).toEqual({ target: -1, native: -1 });

    engine.setHeldCue(0);
    expect(engine.getActiveIndices()).toEqual({ target: 0, native: 0 });

    engine.setHeldCue(-1);
    expect(engine.getActiveIndices()).toEqual({ target: -1, native: -1 });
  });
});
