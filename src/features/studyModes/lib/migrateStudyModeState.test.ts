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
});
