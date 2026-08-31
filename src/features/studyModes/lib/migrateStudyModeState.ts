import type { StudyModeState } from '@/entities/studyMode';

const CURRENT_VERSION = 1;

export const INITIAL_STUDY_MODE_STATE: StudyModeState = {
  version: CURRENT_VERSION,
  activeModeId: 'normal',
  customModes: [],
  advanced: {
    skipNoDialogue: 'OFF',
    removeBracketed: false,
  },
};

export function migrateStudyModeState(raw: unknown): StudyModeState {
  if (!raw || typeof raw !== 'object') {
    return { ...INITIAL_STUDY_MODE_STATE };
  }

  const state = raw as Partial<StudyModeState>;
  const version = state.version ?? 0;

  if (version < CURRENT_VERSION) {
    return { ...INITIAL_STUDY_MODE_STATE };
  }

  return {
    ...INITIAL_STUDY_MODE_STATE,
    ...state,
    version: CURRENT_VERSION,
  };
}
