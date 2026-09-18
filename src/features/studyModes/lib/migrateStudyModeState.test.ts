import { describe, it, expect } from '@jest/globals';
import { migrateStudyModeState, INITIAL_STUDY_MODE_STATE } from './migrateStudyModeState';
import type { StudyModeState } from '@/entities/studyMode';

describe('migrateStudyModeState', () => {
  it('returns defaults for null/undefined', () => {
    expect(migrateStudyModeState(null)).toEqual(INITIAL_STUDY_MODE_STATE);
    expect(migrateStudyModeState(undefined)).toEqual(INITIAL_STUDY_MODE_STATE);
  });

  it('returns defaults for old version', () => {
    const old = { version: 0, activeModeId: 'listen', customModes: [] as const, advanced: { skipNoDialogue: '2X', removeBracketed: true, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true } };
    expect(migrateStudyModeState(old)).toEqual(INITIAL_STUDY_MODE_STATE);
  });

  it('keeps valid current state', () => {
    const state: StudyModeState = {
      version: 1,
      activeModeId: 'custom-1',
      customModes: [],
      advanced: { skipNoDialogue: 'JUMP', removeBracketed: true, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true },
    };
    expect(migrateStudyModeState(state)).toEqual({ ...state, version: 1 });
  });

  it('drops malformed custom modes from storage', () => {
    const raw = {
      version: 1,
      activeModeId: 'normal',
      customModes: [
        null,
        { id: 'custom-bad', type: 'custom', icon: 'play', title: 'No steps', description: '', steps: [] },
        { id: 'custom-badstep', type: 'custom', icon: 'play', title: 'Bad step', description: '', steps: [{ subtitle: 'loud' }] },
        {
          id: 'custom-ok',
          type: 'custom',
          icon: 'play',
          title: 'Ok',
          description: '',
          steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
        },
      ],
      advanced: { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true },
    };
    const state = migrateStudyModeState(raw);
    expect(state.customModes).toHaveLength(1);
    expect(state.customModes[0]?.id).toBe('custom-ok');
  });

  it('keeps steps with a valid seek flag and drops invalid seek values', () => {
    const raw = {
      version: 1,
      activeModeId: 'normal',
      customModes: [
        {
          id: 'custom-seek-ok',
          type: 'custom',
          icon: 'play',
          title: 'Seek ok',
          description: '',
          steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue', seek: false }],
        },
        {
          id: 'custom-seek-bad',
          type: 'custom',
          icon: 'play',
          title: 'Seek bad',
          description: '',
          steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue', seek: 'no' }],
        },
      ],
      advanced: { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true },
    };
    const state = migrateStudyModeState(raw);
    expect(state.customModes).toHaveLength(1);
    expect(state.customModes[0]?.id).toBe('custom-seek-ok');
    expect(state.customModes[0]?.steps[0].seek).toBe(false);
  });
});

describe('adaptive step persistence', () => {
  it('keeps custom modes whose steps use the adaptive sentinel', () => {
    const raw = {
      version: 1,
      activeModeId: 'custom-adaptive',
      customModes: [
        {
          id: 'custom-adaptive',
          type: 'custom',
          icon: 'gauge',
          title: 'Adaptive+',
          description: '',
          steps: [
            { subtitle: 'adaptive', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
            { subtitle: 'both', pause: 'end', repeat: 1, speed: 1, after: 'wait', seek: false },
          ],
        },
      ],
      advanced: { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true },
    };
    const state = migrateStudyModeState(raw);
    expect(state.customModes).toHaveLength(1);
    expect(state.customModes[0]?.steps[0]?.subtitle).toBe('adaptive');
    expect(state.activeModeId).toBe('custom-adaptive');
  });
});

describe('skip rule persistence', () => {
  const baseMode = {
    id: 'custom-skip',
    type: 'custom',
    icon: 'repeat',
    title: 'Skipper',
    description: '',
    steps: [{ subtitle: 'adaptive', pause: 'none', repeat: 3, speed: 1, after: 'continue' }],
  };
  const wrap = (steps: unknown[]) => ({
    version: 1,
    activeModeId: 'custom-skip',
    customModes: [{ ...baseMode, steps }],
    advanced: { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'common', popupOnAutoPause: false, popupCloseOnResume: true },
  });

  it('keeps custom modes whose first step uses skip non-i1', () => {
    const state = migrateStudyModeState(wrap([{ ...baseMode.steps[0], skip: 'non-i1' }]));
    expect(state.customModes).toHaveLength(1);
    expect(state.customModes[0]?.steps[0]?.skip).toBe('non-i1');
  });

  it('drops modes whose step carries an unknown skip value', () => {
    const state = migrateStudyModeState(wrap([{ ...baseMode.steps[0], skip: 'always' }]));
    expect(state.customModes).toHaveLength(0);
  });
});
