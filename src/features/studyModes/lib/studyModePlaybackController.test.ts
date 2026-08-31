import { describe, it, expect } from '@jest/globals';
import { StudyModePlaybackController } from './studyModePlaybackController';
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
    { subtitle: 'both', pause: 'start', repeat: 1, speed: 1, after: 'wait' },
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
});
