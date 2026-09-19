import { describe, it, expect } from '@jest/globals';
import { StudyModePlaybackController } from './studyModePlaybackController';
import { PRESET_LOOKUP } from '@/entities/studyMode';
import type { SrtCue } from '@/entities/media';
import type { StudyMode } from '@/entities/studyMode';

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

const readMode: StudyMode = {
  id: 'read',
  type: 'preset',
  icon: 'bookOpen',
  title: 'Read',
  description: '',
  steps: [
    { subtitle: 'both', pause: 'start', repeat: 1, speed: 1, after: 'continue' },
  ],
};

const repeatMode: StudyMode = {
  id: 'repeat',
  type: 'custom',
  icon: 'slidersHorizontal',
  title: 'Repeat',
  description: '',
  steps: [
    { subtitle: 'target', pause: 'none', repeat: 2, speed: 0.75, after: 'continue' },
  ],
};

const advancedOff = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true } as const;
const advancedJump = { skipNoDialogue: 'JUMP', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true } as const;
const advanced2X = { skipNoDialogue: '2X', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true } as const;

describe('StudyModePlaybackController', () => {
  it('applies first step on enterCue', () => {
    const ctrl = new StudyModePlaybackController(hybridMode, advancedOff, [makeCue(1, 1000, 5000, 'hi')]);
    const actions = ctrl.enterCue(makeCue(1, 1000, 5000, 'hi'), 0);
    expect(actions).toEqual([
      { type: 'setSubtitle', subtitle: 'native' },
      { type: 'setSpeed', speed: 1 },
    ]);
  });

  it('pauses at cue start when step.pause is start', () => {
    const ctrl = new StudyModePlaybackController(readMode, advancedOff, [makeCue(1, 1000, 5000, 'hi')]);
    const actions = ctrl.enterCue(makeCue(1, 1000, 5000, 'hi'), 0);
    expect(actions).toContainEqual({ type: 'pause' });
  });

  it('repeats the cue N times then advances', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(repeatMode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);

    const first = ctrl.onTimeUpdate(5000);
    expect(first).toContainEqual({ type: 'seek', timeMs: 1000 });

    const second = ctrl.onTimeUpdate(5000);
    expect(second).toEqual([]);
    expect(ctrl['activeCueIndex']).toBe(-1);
  });

  it('cycles through multiple steps in the same cue', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(hybridMode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);

    const a = ctrl.onTimeUpdate(5000);
    expect(a).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
    expect(a).toContainEqual({ type: 'seek', timeMs: 1000 });

    const b = ctrl.onTimeUpdate(5000);
    expect(b).toContainEqual({ type: 'setSubtitle', subtitle: 'none' });

    const c = ctrl.onTimeUpdate(5000);
    expect(c).toEqual([]);
    expect(ctrl['activeCueIndex']).toBe(-1);
  });

  it('pauseOnUnknown END: pauses at cue end and emits autoPause with the term', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const advanced = { ...advancedOff, pauseOnUnknown: 'END' as const };
    const normal = PRESET_LOOKUP.get('normal')!;
    const ctrl = new StudyModePlaybackController(normal, advanced, [cue]);
    ctrl.setProbe((i) => (i === 0 ? { term: 'unknown-term', offset: 3 } : null));
    ctrl.enterCue(cue, 0);

    const end = ctrl.onTimeUpdate(5000);
    expect(end).toContainEqual({ type: 'pause' });
    expect(end).toContainEqual({ type: 'autoPause', term: 'unknown-term', cueIndex: 0, termOffset: 3 });

    const resume = ctrl.continue();
    expect(resume).toEqual([{ type: 'play' }]);
    expect(ctrl['activeCueIndex']).toBe(-1);
  });

  it('pauseOnUnknown END: no pause when cue has no learnable term', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const advanced = { ...advancedOff, pauseOnUnknown: 'END' as const };
    const normal = PRESET_LOOKUP.get('normal')!;
    const ctrl = new StudyModePlaybackController(normal, advanced, [cue]);
    ctrl.setProbe(() => null);
    ctrl.enterCue(cue, 0);

    expect(ctrl.onTimeUpdate(5000)).toEqual([]);
    expect(ctrl['activeCueIndex']).toBe(-1);
  });

  it('pauseOnUnknown START: pauses on cue entry and emits autoPause', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const advanced = { ...advancedOff, pauseOnUnknown: 'START' as const };
    const normal = PRESET_LOOKUP.get('normal')!;
    const ctrl = new StudyModePlaybackController(normal, advanced, [cue]);
    ctrl.setProbe(() => ({ term: 'term', offset: 0 }));
    const actions = ctrl.enterCue(cue, 0);

    expect(actions).toContainEqual({ type: 'pause' });
    expect(actions).toContainEqual({ type: 'autoPause', term: 'term', cueIndex: 0, termOffset: 0 });
    expect(ctrl.continue()).toEqual([{ type: 'play' }]);
  });

  it('pauseOnUnknown does not double-pause when the step already pauses', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const dictation = PRESET_LOOKUP.get('dictation')!;
    const advanced = { ...advancedOff, pauseOnUnknown: 'END' as const };
    const ctrl = new StudyModePlaybackController(dictation, advanced, [cue]);
    ctrl.setProbe(() => ({ term: 'term', offset: 0 }));
    ctrl.enterCue(cue, 0);

    const end = ctrl.onTimeUpdate(5000);
    expect(end.filter((a) => a.type === 'pause')).toHaveLength(1);
    expect(end.some((a) => a.type === 'autoPause')).toBe(false);
  });

  it('pauseOnUnknown with no probe set never pauses (fail-open)', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const advanced = { ...advancedOff, pauseOnUnknown: 'END' as const };
    const normal = PRESET_LOOKUP.get('normal')!;
    const ctrl = new StudyModePlaybackController(normal, advanced, [cue]);
    ctrl.enterCue(cue, 0);
    expect(ctrl.onTimeUpdate(5000)).toEqual([]);
  });

  it('pauses at end and continues to next cue on demand', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const mode: StudyMode = {
      ...readMode,
      steps: [{ subtitle: 'both', pause: 'end', repeat: 1, speed: 1, after: 'continue' }],
    };
    const ctrl = new StudyModePlaybackController(mode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);

    const end = ctrl.onTimeUpdate(5000);
    expect(end).toContainEqual({ type: 'pause' });

    const resume = ctrl.continue();
    expect(resume).toContainEqual({ type: 'play' });
    expect(ctrl['activeCueIndex']).toBe(-1);
  });

  it('loops a cue up to 5 times', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const mode: StudyMode = {
      ...hybridMode,
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'loop' }],
    };
    const ctrl = new StudyModePlaybackController(mode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);

    for (let i = 0; i < 5; i++) {
      const a = ctrl.onTimeUpdate(5000);
      expect(a).toContainEqual({ type: 'seek', timeMs: 1000 });
    }

    const final = ctrl.onTimeUpdate(5000);
    expect(final).toEqual([]);
    expect(ctrl['activeCueIndex']).toBe(-1);
  });

  it('jumps over silence when skipNoDialogue is JUMP', () => {
    const cues = [makeCue(1, 0, 1000, 'a'), makeCue(2, 5000, 8000, 'b')];
    const ctrl = new StudyModePlaybackController(hybridMode, advancedJump, cues);
    const actions = ctrl.onTimeUpdate(2500);
    expect(actions).toEqual([{ type: 'seek', timeMs: 5000 }]);
  });

  it('speeds up during silence when skipNoDialogue is 2X', () => {
    const cues = [makeCue(1, 0, 1000, 'a'), makeCue(2, 5000, 8000, 'b')];
    const ctrl = new StudyModePlaybackController(hybridMode, advanced2X, cues);
    const actions = ctrl.onTimeUpdate(2500);
    expect(actions).toEqual([{ type: 'setSpeed', speed: 2, transient: true }]);
  });

  it('emits raw cue start in seek actions when offsetMs is set', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(repeatMode, advancedOff, [cue], 500);
    ctrl.enterCue(cue, 0);
    const actions = ctrl.onTimeUpdate(4500);
    expect(actions).toContainEqual({ type: 'seek', timeMs: 1000 });
  });

  it('JUMP seeks to the raw start of the next cue, once per gap', () => {
    const cues = [makeCue(1, 0, 1000, 'a'), makeCue(2, 5000, 8000, 'b')];
    const ctrl = new StudyModePlaybackController(hybridMode, advancedJump, cues, 500);
    expect(ctrl.onTimeUpdate(2500)).toEqual([{ type: 'seek', timeMs: 5000 }]);
    expect(ctrl.onTimeUpdate(2600)).toEqual([]);
  });

  it('does not jump or fast-forward while inside a cue', () => {
    const cues = [makeCue(1, 0, 1000, 'a'), makeCue(2, 5000, 8000, 'b')];
    const jumpCtrl = new StudyModePlaybackController(hybridMode, advancedJump, cues);
    expect(jumpCtrl.onTimeUpdate(500)).toEqual([]);
    const speedCtrl = new StudyModePlaybackController(hybridMode, advanced2X, cues);
    expect(speedCtrl.onTimeUpdate(500)).toEqual([]);
  });

  it('emits the silence speed-up once per gap, again for the next gap', () => {
    const cues = [
      makeCue(1, 0, 1000, 'a'),
      makeCue(2, 5000, 8000, 'b'),
      makeCue(3, 12000, 15000, 'c'),
    ];
    const ctrl = new StudyModePlaybackController(hybridMode, advanced2X, cues);
    expect(ctrl.onTimeUpdate(2500)).toEqual([{ type: 'setSpeed', speed: 2, transient: true }]);
    expect(ctrl.onTimeUpdate(2600)).toEqual([]);
    expect(ctrl.onTimeUpdate(10000)).toEqual([{ type: 'setSpeed', speed: 2, transient: true }]);
  });

  it('read preset pauses at cue start only — resuming runs to next cue without an end pause', () => {
    const read = PRESET_LOOKUP.get('read');
    expect(read).toBeDefined();
    const cue1 = makeCue(1, 1000, 5000, 'a');
    const cue2 = makeCue(2, 8000, 11000, 'b');
    const ctrl = new StudyModePlaybackController(read!, advancedOff, [cue1, cue2]);

    expect(ctrl.enterCue(cue1, 0)).toContainEqual({ type: 'pause' });
    expect(ctrl.continue()).toContainEqual({ type: 'play' });

    const end = ctrl.onTimeUpdate(5000);
    expect(end).toEqual([]);
    expect(ctrl.hasActiveCue).toBe(false);

    expect(ctrl.enterCue(cue2, 1)).toContainEqual({ type: 'pause' });
  });

  it('listen-check preset reveals subtitles at the end after one blind listen', () => {
    const listenCheck = PRESET_LOOKUP.get('listen-check');
    expect(listenCheck).toBeDefined();
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(listenCheck!, advancedOff, [cue]);

    expect(ctrl.enterCue(cue, 0)).toEqual([
      { type: 'setSubtitle', subtitle: 'none' },
      { type: 'setSpeed', speed: 1 },
    ]);

    const end = ctrl.onTimeUpdate(5000);
    expect(end).toEqual([
      { type: 'setSubtitle', subtitle: 'both' },
      { type: 'setSpeed', speed: 1 },
      { type: 'pause' },
    ]);
    expect(ctrl.heldCueIndex).toBe(0);

    const resume = ctrl.continue();
    expect(resume).toContainEqual({ type: 'play' });
    expect(ctrl.hasActiveCue).toBe(false);
  });

  it('exposes the cue held while paused at its end', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const pauseEndMode: StudyMode = {
      id: 'pause-end',
      type: 'custom',
      icon: 'pencil',
      title: 'Pause End',
      description: '',
      steps: [{ subtitle: 'none', pause: 'end', repeat: 1, speed: 1, after: 'continue' }],
    };
    const waitMode: StudyMode = {
      id: 'wait',
      type: 'custom',
      icon: 'eye',
      title: 'Wait',
      description: '',
      steps: [{ subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'wait' }],
    };

    const ctrlPause = new StudyModePlaybackController(pauseEndMode, advancedOff, [cue]);
    ctrlPause.enterCue(cue, 0);
    expect(ctrlPause.heldCueIndex).toBe(-1);
    ctrlPause.onTimeUpdate(5000);
    expect(ctrlPause.heldCueIndex).toBe(0);
    ctrlPause.continue();
    expect(ctrlPause.heldCueIndex).toBe(-1);

    const ctrlWait = new StudyModePlaybackController(waitMode, advancedOff, [cue]);
    ctrlWait.enterCue(cue, 0);
    ctrlWait.onTimeUpdate(5000);
    expect(ctrlWait.heldCueIndex).toBe(0);
    ctrlWait.continue();
    expect(ctrlWait.heldCueIndex).toBe(-1);

    const ctrl = new StudyModePlaybackController(readMode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);
    expect(ctrl.heldCueIndex).toBe(-1);
  });

  it('skips textless cues — they play through instead of becoming a pause stop', () => {
    const dictation = PRESET_LOOKUP.get('dictation')!;
    const cues = [
      makeCue(1, 0, 5000, 'one'),
      makeCue(2, 5000, 7000, ''),
      makeCue(3, 7000, 12000, 'three'),
    ];
    const ctrl = new StudyModePlaybackController(dictation, advancedOff, cues);

    ctrl.enterCue(cues[0], 0);
    expect(ctrl.onTimeUpdate(5000)).toContainEqual({ type: 'pause' });
    expect(ctrl.heldCueIndex).toBe(0);
    ctrl.continue();

    expect(ctrl.enterCue(cues[1], 1)).toEqual([]);
    expect(ctrl.hasActiveCue).toBe(false);
    expect(ctrl.onTimeUpdate(7000)).toEqual([]);

    expect(ctrl.enterCue(cues[2], 2)).toEqual([
      { type: 'setSubtitle', subtitle: 'none' },
      { type: 'setSpeed', speed: 1 },
    ]);
    expect(ctrl.onTimeUpdate(12000)).toContainEqual({ type: 'pause' });
    expect(ctrl.heldCueIndex).toBe(2);
  });

  it('abort() clears the active cue and pause state', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(readMode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);
    expect(ctrl.hasActiveCue).toBe(true);
    ctrl.abort();
    expect(ctrl.hasActiveCue).toBe(false);
    expect(ctrl.continue()).toEqual([]);
  });

  it('suppresses step-end processing while the video is paused', () => {
    // A paused video cannot reach a cue end by playing — a timeupdate while
    // paused (e.g. after a seeked event, or a mode switch applied while parked
    // at cue end) must not consume a repeat or advance the step chain.
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(repeatMode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);

    const paused = ctrl.onTimeUpdate(5000, true);
    expect(paused).toEqual([]);

    // Once playing resumes past the end, the step-end runs normally and the
    // repeat is consumed exactly once.
    const resumed = ctrl.onTimeUpdate(5000, false);
    expect(resumed).toContainEqual({ type: 'seek', timeMs: 1000 });
  });

  it('keeps silence handling active while paused (JUMP still fires)', () => {
    const cues = [makeCue(1, 1000, 2000, 'a'), makeCue(2, 9000, 10000, 'b')];
    const ctrl = new StudyModePlaybackController(readMode, advancedJump, cues);
    // Paused in the gap between cues — JUMP should still seek to the next cue.
    const actions = ctrl.onTimeUpdate(5000, true);
    expect(actions).toContainEqual({ type: 'seek', timeMs: 9000 });
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

describe('resolveStepSubtitle', () => {
  it('returns static subtitle values unchanged', async () => {
    const { resolveStepSubtitle } = await import('./studyModePlaybackController');
    expect(resolveStepSubtitle('none', 0, () => 'easy')).toBe('none');
    expect(resolveStepSubtitle('both', 3, null)).toBe('both');
    expect(resolveStepSubtitle('target', 1, () => 'dense')).toBe('target');
  });

  it('maps adaptive bands to concrete visibility', async () => {
    const { resolveStepSubtitle } = await import('./studyModePlaybackController');
    expect(resolveStepSubtitle('adaptive', 0, () => 'easy')).toBe('none');
    expect(resolveStepSubtitle('adaptive', 0, () => 'i1')).toBe('target');
    expect(resolveStepSubtitle('adaptive', 0, () => 'dense')).toBe('both');
  });

  it('falls back to both when probe is null or returns null', async () => {
    const { resolveStepSubtitle } = await import('./studyModePlaybackController');
    expect(resolveStepSubtitle('adaptive', 0, null)).toBe('both');
    expect(resolveStepSubtitle('adaptive', 0, () => null)).toBe('both');
  });
});

describe('adaptive subtitle resolution', () => {
  it('resolves the step subtitle per cue band at entry', () => {
    const cues = [makeCue(1, 0, 4000, 'a'), makeCue(2, 4000, 8000, 'b'), makeCue(3, 8000, 12000, 'c')];
    const ctrl = new StudyModePlaybackController(adaptiveMode, advancedOff, cues);
    const bands = ['easy', 'dense', 'i1'] as const;
    ctrl.setBandProbe((i) => bands[i] ?? null);

    expect(ctrl.enterCue(cues[0], 0)).toContainEqual({ type: 'setSubtitle', subtitle: 'none' });
    expect(ctrl.onTimeUpdate(4000)).toEqual([]);

    expect(ctrl.enterCue(cues[1], 1)).toContainEqual({ type: 'setSubtitle', subtitle: 'both' });
    expect(ctrl.onTimeUpdate(8000)).toEqual([]);

    expect(ctrl.enterCue(cues[2], 2)).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
  });

  it('falls back to both when no band probe is set', () => {
    const cue = makeCue(1, 0, 4000, 'a');
    const ctrl = new StudyModePlaybackController(adaptiveMode, advancedOff, [cue]);
    expect(ctrl.enterCue(cue, 0)).toContainEqual({ type: 'setSubtitle', subtitle: 'both' });
  });

  it('re-resolves on a seek:false step entry (reapplyStep path)', () => {
    const cue = makeCue(1, 0, 4000, 'a');
    const twoStep: StudyMode = {
      id: 'custom-adaptive',
      type: 'custom',
      icon: 'gauge',
      title: 'TwoStep',
      description: '',
      steps: [
        { subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
        { subtitle: 'adaptive', pause: 'none', repeat: 1, speed: 1, after: 'continue', seek: false },
      ],
    };
    const ctrl = new StudyModePlaybackController(twoStep, advancedOff, [cue]);
    ctrl.setBandProbe(() => 'i1');
    ctrl.enterCue(cue, 0);

    const actions = ctrl.onTimeUpdate(4000);
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
  });
});

const i1ReplayMode: StudyMode = {
  id: 'i1-replay',
  type: 'preset',
  icon: 'repeat',
  title: 'i+1 Replay',
  description: '',
  steps: [{ subtitle: 'adaptive', pause: 'none', repeat: 3, speed: 1, after: 'continue', skip: 'non-i1' }],
};

const skipPlayMode: StudyMode = {
  id: 'skip-once',
  type: 'custom',
  icon: 'repeat',
  title: 'Skip Once',
  description: '',
  steps: [{ subtitle: 'adaptive', pause: 'none', repeat: 1, speed: 1, after: 'continue', skip: 'non-i1' }],
};

describe('resolveStepSkip', () => {
  const cues = [makeCue(0, 0, 4000, 'a'), makeCue(1, 4000, 8000, 'b'), makeCue(2, 8000, 12000, 'c')];
  const skipStep = { subtitle: 'adaptive', pause: 'none', repeat: 3, speed: 1, after: 'continue', skip: 'non-i1' } as const;

  it('returns -1 without a skip rule or without a probe', async () => {
    const { resolveStepSkip } = await import('./studyModePlaybackController');
    const noSkip = { ...skipStep, skip: undefined };
    expect(resolveStepSkip(noSkip, 0, cues, () => 'easy', new Set())).toBe(-1);
    expect(resolveStepSkip(skipStep, 0, cues, null, new Set())).toBe(-1);
  });

  it('returns -1 when the entered cue is i1 or has no band', async () => {
    const { resolveStepSkip } = await import('./studyModePlaybackController');
    expect(resolveStepSkip(skipStep, 0, cues, () => 'i1', new Set())).toBe(-1);
    expect(resolveStepSkip(skipStep, 0, cues, () => null, new Set())).toBe(-1);
  });

  it('returns the first i1 index ahead for easy and dense cues', async () => {
    const { resolveStepSkip } = await import('./studyModePlaybackController');
    const bands = ['easy', 'dense', 'i1'] as const;
    expect(resolveStepSkip(skipStep, 0, cues, (i) => bands[i] ?? null, new Set())).toBe(2);
    expect(resolveStepSkip(skipStep, 1, cues, (i) => bands[i] ?? null, new Set())).toBe(2);
  });

  it('returns -1 when no i1 cue follows', async () => {
    const { resolveStepSkip } = await import('./studyModePlaybackController');
    expect(resolveStepSkip(skipStep, 1, cues, () => 'dense', new Set())).toBe(-1);
  });

  it('skips bounced target indices during the scan', async () => {
    const { resolveStepSkip } = await import('./studyModePlaybackController');
    const bands = ['dense', 'i1', 'i1'] as const;
    expect(resolveStepSkip(skipStep, 0, cues, (i) => bands[i] ?? null, new Set([1]))).toBe(2);
  });
});

describe('skip non-i1 cue entry', () => {
  it('emits exactly one seek to the first i1 cue for an easy cue', () => {
    const cues = [makeCue(0, 0, 4000, 'a'), makeCue(1, 4000, 8000, 'b'), makeCue(2, 8000, 12000, 'c')];
    const bands = ['easy', 'dense', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    expect(ctrl.enterCue(cues[0], 0)).toEqual([{ type: 'seek', timeMs: 8000 }]);
  });

  it('plays i1 cues through the normal path', () => {
    const cues = [makeCue(0, 0, 4000, 'a'), makeCue(1, 4000, 8000, 'b')];
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);
    ctrl.setBandProbe(() => 'i1');

    expect(ctrl.enterCue(cues[0], 0)).toEqual([
      { type: 'setSubtitle', subtitle: 'target' },
      { type: 'setSpeed', speed: 1 },
    ]);
  });

  it('plays everything when the probe is null', () => {
    const cues = [makeCue(0, 0, 4000, 'a')];
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);

    expect(ctrl.enterCue(cues[0], 0)).toEqual([
      { type: 'setSubtitle', subtitle: 'both' },
      { type: 'setSpeed', speed: 1 },
    ]);
  });

  it('retargets to the next i1 after a bounce lands in an overlapping cue', () => {
    const cues = [
      makeCue(0, 0, 4000, 'a'),
      makeCue(1, 4000, 10500, 'b'),
      makeCue(2, 9000, 10800, 'c'),
      makeCue(3, 10000, 11000, 'd'),
      makeCue(4, 12000, 14000, 'e'),
    ];
    const bands = ['dense', 'dense', 'dense', 'i1', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    expect(ctrl.enterCue(cues[0], 0)).toEqual([{ type: 'seek', timeMs: 10000 }]);
    expect(ctrl.enterCue(cues[1], 1)).toEqual([{ type: 'seek', timeMs: 12000 }]);
    expect(ctrl.enterCue(cues[4], 4)).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
  });

  it('converges instead of looping when the only i1 target is unreachable', () => {
    const cues = [
      makeCue(0, 0, 4000, 'a'),
      makeCue(1, 4000, 10500, 'b'),
      makeCue(2, 9000, 10800, 'c'),
      makeCue(3, 10000, 11000, 'd'),
    ];
    const bands = ['dense', 'dense', 'dense', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(skipPlayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    ctrl.enterCue(cues[0], 0);
    expect(ctrl.enterCue(cues[1], 1)).toEqual([
      { type: 'setSubtitle', subtitle: 'both' },
      { type: 'setSpeed', speed: 1 },
    ]);
    expect(ctrl.onTimeUpdate(10500)).toEqual([]);
    expect(ctrl.enterCue(cues[2], 2)).toEqual([
      { type: 'setSubtitle', subtitle: 'both' },
      { type: 'setSpeed', speed: 1 },
    ]);
    expect(ctrl.onTimeUpdate(10800)).toEqual([]);
    expect(ctrl.enterCue(cues[3], 3)).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
  });

  it('suppresses silence skip while a skip seek is in transit', () => {
    const cues = [makeCue(0, 5000, 9000, 'a'), makeCue(1, 20000, 24000, 'b')];
    const bands = ['easy', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedJump, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    ctrl.enterCue(cues[0], 0);
    expect(ctrl.onTimeUpdate(1000)).toEqual([]);
  });

  it('clears the pending skip on abort so a landing is not misclassified', () => {
    const cues = [makeCue(0, 0, 4000, 'a'), makeCue(1, 4000, 10500, 'b'), makeCue(2, 10000, 11000, 'c')];
    const bands = ['dense', 'dense', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(skipPlayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    ctrl.enterCue(cues[0], 0);
    ctrl.abort();
    expect(ctrl.enterCue(cues[1], 1)).toEqual([{ type: 'seek', timeMs: 10000 }]);
  });

  it('keeps bounced targets across abort and clears them on cue changes', () => {
    const cues = [
      makeCue(0, 0, 4000, 'a'),
      makeCue(1, 4000, 10500, 'b'),
      makeCue(2, 9000, 10800, 'c'),
      makeCue(3, 10000, 11000, 'd'),
      makeCue(4, 12000, 14000, 'e'),
    ];
    const bands = ['dense', 'dense', 'dense', 'i1', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(skipPlayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    ctrl.enterCue(cues[0], 0);
    expect(ctrl.enterCue(cues[1], 1)).toEqual([{ type: 'seek', timeMs: 12000 }]);
    ctrl.abort();
    expect(ctrl.enterCue(cues[2], 2)).toEqual([{ type: 'seek', timeMs: 12000 }]);

    const shifted = cues.map((c) => ({ ...c, start: c.start + 500, end: c.end + 500 }));
    ctrl.setCues(shifted);
    expect(ctrl.enterCue(shifted[0], 0)).toEqual([{ type: 'seek', timeMs: 10500 }]);
  });

  it('clears bounced targets when cue boundaries change', () => {
    const cues = [
      makeCue(0, 0, 4000, 'a'),
      makeCue(1, 4000, 10500, 'b'),
      makeCue(2, 9000, 10800, 'c'),
      makeCue(3, 10000, 11000, 'd'),
      makeCue(4, 12000, 14000, 'e'),
    ];
    const bands = ['dense', 'dense', 'dense', 'i1', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    ctrl.enterCue(cues[0], 0);
    ctrl.enterCue(cues[1], 1);
    const shifted = cues.map((c) => ({ ...c, start: c.start + 500, end: c.end + 500 }));
    ctrl.setCues(shifted);
    expect(ctrl.enterCue(shifted[0], 0)).toEqual([{ type: 'seek', timeMs: 10500 }]);
  });

  it('re-skips when a user seek lands back in a non-i1 cue', () => {
    const cues = [makeCue(0, 0, 4000, 'a'), makeCue(1, 8000, 12000, 'b')];
    const bands = ['easy', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    ctrl.enterCue(cues[0], 0);
    ctrl.abort();
    expect(ctrl.enterCue(cues[0], 0)).toEqual([{ type: 'seek', timeMs: 8000 }]);
  });

  it('does not re-evaluate skip during repeat loops', () => {
    const cues = [makeCue(0, 0, 4000, 'a'), makeCue(1, 8000, 12000, 'b')];
    const bands = ['i1', 'i1'] as const;
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    ctrl.enterCue(cues[0], 0);
    const actions = ctrl.onTimeUpdate(4000);
    expect(actions).toContainEqual({ type: 'seek', timeMs: 0 });
    expect(actions).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
  });

  it('skips a cue whose band flipped to easy on re-entry', () => {
    const cues = [makeCue(0, 0, 4000, 'a'), makeCue(1, 8000, 12000, 'b')];
    const bands: ('easy' | 'i1' | 'dense' | null)[] = ['i1', 'i1'];
    const ctrl = new StudyModePlaybackController(i1ReplayMode, advancedOff, cues);
    ctrl.setBandProbe((i) => bands[i] ?? null);

    expect(ctrl.enterCue(cues[0], 0)).toContainEqual({ type: 'setSubtitle', subtitle: 'target' });
    bands[0] = 'easy';
    ctrl.abort();
    expect(ctrl.enterCue(cues[0], 0)).toEqual([{ type: 'seek', timeMs: 8000 }]);
  });
});
