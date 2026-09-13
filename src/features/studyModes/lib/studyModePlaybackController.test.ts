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

const advancedOff = { skipNoDialogue: 'OFF', removeBracketed: false } as const;
const advancedJump = { skipNoDialogue: 'JUMP', removeBracketed: false } as const;
const advanced2X = { skipNoDialogue: '2X', removeBracketed: false } as const;

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
    expect(actions).toEqual([{ type: 'setSpeed', speed: 2 }]);
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
    expect(ctrl.onTimeUpdate(2500)).toEqual([{ type: 'setSpeed', speed: 2 }]);
    expect(ctrl.onTimeUpdate(2600)).toEqual([]);
    expect(ctrl.onTimeUpdate(10000)).toEqual([{ type: 'setSpeed', speed: 2 }]);
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

  it('listen-check preset pauses after a blind listen, then reviews the cue with subtitles', () => {
    const listenCheck = PRESET_LOOKUP.get('listen-check');
    expect(listenCheck).toBeDefined();
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(listenCheck!, advancedOff, [cue]);

    expect(ctrl.enterCue(cue, 0)).toContainEqual({ type: 'setSubtitle', subtitle: 'none' });

    const end = ctrl.onTimeUpdate(5000);
    expect(end).toContainEqual({ type: 'pause' });

    const review = ctrl.continue();
    expect(review).toContainEqual({ type: 'seek', timeMs: 1000 });
    expect(review).toContainEqual({ type: 'setSubtitle', subtitle: 'both' });

    expect(ctrl.onTimeUpdate(5000)).toContainEqual({ type: 'pause' });
    expect(ctrl.continue()).toContainEqual({ type: 'play' });
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

  it('abort() clears the active cue and pause state', () => {
    const cue = makeCue(1, 1000, 5000, 'hi');
    const ctrl = new StudyModePlaybackController(readMode, advancedOff, [cue]);
    ctrl.enterCue(cue, 0);
    expect(ctrl.hasActiveCue).toBe(true);
    ctrl.abort();
    expect(ctrl.hasActiveCue).toBe(false);
    expect(ctrl.continue()).toEqual([]);
  });
});
