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

  it('clearCues releases a held cue so a new cue list is not pinned', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    engine.loadCues([makeCue(1, 2000, 6000, 'One')]);
    engine.setHeldCue(0);

    engine.clearCues();
    engine.loadCues([makeCue(1, 0, 1000, 'Fresh'), makeCue(2, 2000, 3000, 'Two')]);

    video.currentTime = 2.5;
    engine.onTimeUpdate();
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

describe('SubtitleCueEngine.loadBilingualCues', () => {
  const collect = (engine: SubtitleCueEngine): number[] => {
    const hits: number[] = [];
    engine.setCallbacks({ onCuesUpdated: () => hits.push(1) });
    return hits;
  };

  it('keeps array refs and skips the emit when re-fed element-equal cues', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    const targetCues = [makeCue(1, 0, 1000, 'A'), makeCue(2, 1000, 2000, 'B')];
    const nativeCues = [makeCue(1, 0, 1000, 'a'), makeCue(2, 1000, 2000, 'b')];
    engine.loadBilingualCues(targetCues, nativeCues);
    const targetRef = engine.getTargetCues();
    const nativeRef = engine.getNativeCues();
    const hits = collect(engine);

    engine.loadBilingualCues(
      targetCues.map((c) => ({ ...c })),
      nativeCues.map((c) => ({ ...c })),
    );

    expect(hits).toHaveLength(0);
    expect(engine.getTargetCues()).toBe(targetRef);
    expect(engine.getNativeCues()).toBe(nativeRef);
  });

  it('emits and swaps the ref when a translate chunk changes the native cues', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    const targetCues = [makeCue(1, 0, 1000, 'A'), makeCue(2, 1000, 2000, 'B')];
    const nativeCues = [makeCue(1, 0, 1000, 'a')];
    engine.loadBilingualCues(targetCues, nativeCues);
    const nativeRef = engine.getNativeCues();
    const hits = collect(engine);

    engine.loadBilingualCues(targetCues, [...nativeCues, makeCue(2, 1000, 2000, 'b')]);

    expect(hits).toHaveLength(1);
    expect(engine.getNativeCues()).not.toBe(nativeRef);
    expect(engine.getNativeCues()).toHaveLength(2);
  });

  it('detects a single changed field inside an otherwise equal list', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    const targetCues = [makeCue(1, 0, 1000, 'A'), makeCue(2, 1000, 2000, 'B')];
    engine.loadBilingualCues(targetCues, []);
    const targetRef = engine.getTargetCues();
    const hits = collect(engine);

    engine.loadBilingualCues([targetCues[0]!, { ...targetCues[1]!, text: 'B2' }], []);

    expect(hits).toHaveLength(1);
    expect(engine.getTargetCues()).not.toBe(targetRef);
    expect(engine.getTargetCues()[1]?.text).toBe('B2');
  });

  it('keeps the other side when only one side re-arrives empty', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    const targetCues = [makeCue(1, 0, 1000, 'A')];
    const nativeCues = [makeCue(1, 0, 1000, 'a')];
    engine.loadBilingualCues(targetCues, nativeCues);
    const hits = collect(engine);

    engine.loadBilingualCues(targetCues.map((c) => ({ ...c })), []);

    expect(hits).toHaveLength(0);
    expect(engine.getTargetCues()).toHaveLength(1);
    expect(engine.getNativeCues()).toHaveLength(1);
  });

  it('clears both lanes and emits once when both sides arrive empty', () => {
    const video = document.createElement('video');
    const engine = new SubtitleCueEngine(video);
    engine.loadBilingualCues([makeCue(1, 0, 1000, 'A')], [makeCue(1, 0, 1000, 'a')]);
    const hits = collect(engine);

    engine.loadBilingualCues([], []);

    expect(hits).toHaveLength(1);
    expect(engine.hasSubtitles()).toBe(false);
  });
});
