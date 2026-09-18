import { describe, it, expect } from '@jest/globals';
import { SubtitleStudyModeController } from './subtitleStudyModeController';
import type { SrtCue } from '@/entities/media';
import type { StudyMode, StudyModeAdvancedSettings } from '@/entities/studyMode';

const makeCue = (index: number, start: number, end: number, text: string): SrtCue => ({
  index,
  start,
  end,
  text,
});

const hybridMode: StudyMode = {
  id: 'hybrid',
  type: 'preset',
  icon: 'layers',
  title: 'Hybrid',
  description: '',
  steps: [
    { subtitle: 'native', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    { subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    { subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
  ],
};

const repeatMode: StudyMode = {
  id: 'repeat',
  type: 'custom',
  icon: 'slidersHorizontal',
  title: 'Repeat',
  description: '',
  steps: [{ subtitle: 'target', pause: 'none', repeat: 2, speed: 0.75, after: 'continue' }],
};

const advancedOff: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

describe('SubtitleStudyModeController', () => {
  it('runs the full step chain across a contiguous cue boundary', () => {
    const cues = [makeCue(1, 0, 4000, 'a'), makeCue(2, 4000, 8000, 'b')];
    const ctrl = new SubtitleStudyModeController();
    ctrl.applyStudyMode(hybridMode, advancedOff, cues, 0);

    let actions = ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1200 });
    expect(actions).toEqual([
      { type: 'setSubtitle', subtitle: 'native' },
      { type: 'setSpeed', speed: 1 },
    ]);

    // Engine already reports cue B at the boundary — cue A's chain must
    // still finish instead of being replaced by cue B's entry.
    actions = ctrl.onTimeUpdate({ targetIndex: 1, targetCues: cues, currentTimeMs: 4100 });
    expect(actions).toContainEqual({ type: 'seek', timeMs: 0 });
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });

    ctrl.onSeeking(200);
    actions = ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1300 });
    expect(actions).toEqual([]);

    actions = ctrl.onTimeUpdate({ targetIndex: 1, targetCues: cues, currentTimeMs: 4200 });
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'none' });

    ctrl.onSeeking(300);
    ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1400 });

    actions = ctrl.onTimeUpdate({ targetIndex: 1, targetCues: cues, currentTimeMs: 4300 });
    expect(actions).toEqual([]);

    actions = ctrl.onTimeUpdate({ targetIndex: 1, targetCues: cues, currentTimeMs: 4400 });
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'native' });
  });

  it('aborts the cue chain on an external seek and starts the new cue', () => {
    const cues = [makeCue(1, 0, 4000, 'a'), makeCue(2, 4000, 8000, 'b')];
    const ctrl = new SubtitleStudyModeController();
    ctrl.applyStudyMode(repeatMode, advancedOff, cues, 0);

    ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1200 });

    ctrl.onSeeking(6500);
    const actions = ctrl.onTimeUpdate({ targetIndex: 1, targetCues: cues, currentTimeMs: 6500 });
    expect(actions).toEqual([
      { type: 'setSubtitle', subtitle: 'target' },
      { type: 'setSpeed', speed: 0.75 },
    ]);
  });

  it('tolerates seeks issued by its own actions', () => {
    const cues = [makeCue(1, 0, 4000, 'a'), makeCue(2, 4000, 8000, 'b')];
    const ctrl = new SubtitleStudyModeController();
    ctrl.applyStudyMode(repeatMode, advancedOff, cues, 0);

    ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1200 });
    const repeat = ctrl.onTimeUpdate({ targetIndex: 1, targetCues: cues, currentTimeMs: 4100 });
    expect(repeat).toContainEqual({ type: 'seek', timeMs: 0 });

    ctrl.onSeeking(80);
    const actions = ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 500 });
    expect(actions).toEqual([]);

    const done = ctrl.onTimeUpdate({ targetIndex: 1, targetCues: cues, currentTimeMs: 4100 });
    expect(done).toEqual([]);
  });

  it('re-enters the current cue after the cue list is reloaded', () => {
    const cues = [makeCue(1, 0, 4000, 'a'), makeCue(2, 4000, 8000, 'b')];
    const ctrl = new SubtitleStudyModeController();
    ctrl.applyStudyMode(hybridMode, advancedOff, cues, 0);
    ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1200 });

    const fresh = [makeCue(1, 0, 5000, 'a2'), makeCue(2, 5000, 9000, 'b2')];
    ctrl.setCues(fresh, 0);
    const actions = ctrl.onTimeUpdate({ targetIndex: 0, targetCues: fresh, currentTimeMs: 1300 });
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'native' });
  });
});

const adaptiveMode: StudyMode = {
  id: 'adaptive',
  type: 'preset',
  icon: 'gauge',
  title: 'Adaptive',
  description: '',
  steps: [{ subtitle: 'adaptive', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
};

describe('band probe forwarding', () => {
  it('forwards the band probe to the playback machine and resolves per cue', () => {
    const cues = [makeCue(1, 0, 4000, 'a'), makeCue(2, 4000, 8000, 'b')];
    const ctrl = new SubtitleStudyModeController();
    ctrl.setBandProbe((i) => (i === 0 ? 'easy' : 'dense'));
    ctrl.applyStudyMode(adaptiveMode, advancedOff, cues, 0);

    const first = ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1200 });
    expect(first).toContainEqual({ type: 'setSubtitle', subtitle: 'none' });
  });

  it('re-forwards the cached band probe across applyStudyMode calls', () => {
    const cues = [makeCue(1, 0, 4000, 'a')];
    const ctrl = new SubtitleStudyModeController();
    ctrl.setBandProbe(() => 'i1');

    ctrl.applyStudyMode(adaptiveMode, advancedOff, cues, 0);
    // Switching modes recreates the inner playback controller — the probe
    // must survive the switch or adaptive silently degrades to 'both'.
    ctrl.applyStudyMode(hybridMode, advancedOff, cues, 0);
    ctrl.applyStudyMode(adaptiveMode, advancedOff, cues, 0);

    const actions = ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1200 });
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
  });

  it('null band probe resolves adaptive to both', () => {
    const cues = [makeCue(1, 0, 4000, 'a')];
    const ctrl = new SubtitleStudyModeController();
    ctrl.setBandProbe(null);
    ctrl.applyStudyMode(adaptiveMode, advancedOff, cues, 0);

    const actions = ctrl.onTimeUpdate({ targetIndex: 0, targetCues: cues, currentTimeMs: 1200 });
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'both' });
  });
});
