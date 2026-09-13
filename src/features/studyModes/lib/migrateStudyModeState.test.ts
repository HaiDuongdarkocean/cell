import { describe, it, expect } from '@jest/globals';
import { migrateStudyModeState, INITIAL_STUDY_MODE_STATE } from './migrateStudyModeState';
import type { StudyModeState } from '@/entities/studyMode';

describe('migrateStudyModeState', () => {
  it('returns defaults for null/undefined', () => {
    expect(migrateStudyModeState(null)).toEqual(INITIAL_STUDY_MODE_STATE);
    expect(migrateStudyModeState(undefined)).toEqual(INITIAL_STUDY_MODE_STATE);
  });

  it('returns defaults for old version', () => {
    const old = { version: 0, activeModeId: 'listen', customModes: [] as const, advanced: { skipNoDialogue: '2X', removeBracketed: true } };
    expect(migrateStudyModeState(old)).toEqual(INITIAL_STUDY_MODE_STATE);
  });

  it('keeps valid current state', () => {
    const state: StudyModeState = {
      version: 1,
      activeModeId: 'custom-1',
      customModes: [],
      advanced: { skipNoDialogue: 'JUMP', removeBracketed: true },
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
      advanced: { skipNoDialogue: 'OFF', removeBracketed: false },
    };
    const state = migrateStudyModeState(raw);
    expect(state.customModes).toHaveLength(1);
    expect(state.customModes[0]?.id).toBe('custom-ok');
  });
});
