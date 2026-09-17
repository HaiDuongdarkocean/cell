import { PLAYBACK_SPEEDS, type StudyMode, type StudyModeAdvancedSettings, type StudyModeState, type StudyStep } from '@/entities/studyMode';

const CURRENT_VERSION = 1;

const SUBTITLE_VALUES = new Set(['none', 'native', 'target', 'both']);
const PAUSE_VALUES = new Set(['none', 'start', 'end']);
const REPEAT_VALUES = new Set([1, 2, 3]);
const SPEED_VALUES = new Set<number>(PLAYBACK_SPEEDS);
const AFTER_VALUES = new Set(['continue', 'wait', 'loop']);
const SKIP_VALUES = new Set(['OFF', '2X', '4X', '6X', '8X', 'JUMP']);
const PAUSE_UNKNOWN_VALUES = new Set(['OFF', 'START', 'END']);
const UNKNOWN_SCOPE_VALUES = new Set(['FREQ_LIST', 'ALL']);

export const INITIAL_STUDY_MODE_STATE: StudyModeState = {
  version: CURRENT_VERSION,
  activeModeId: 'normal',
  customModes: [],
  advanced: {
    skipNoDialogue: 'OFF',
    removeBracketed: false,
    pauseOnUnknown: 'OFF',
    unknownScope: 'FREQ_LIST',
    popupOnAutoPause: false,
    popupCloseOnResume: true,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidStep(step: unknown): step is StudyStep {
  if (!isRecord(step)) return false;
  return (
    SUBTITLE_VALUES.has(step.subtitle as string) &&
    PAUSE_VALUES.has(step.pause as string) &&
    REPEAT_VALUES.has(step.repeat as number) &&
    SPEED_VALUES.has(step.speed as number) &&
    AFTER_VALUES.has(step.after as string) &&
    (step.seek === undefined || typeof step.seek === 'boolean')
  );
}

function isValidMode(mode: unknown): mode is StudyMode {
  if (!isRecord(mode)) return false;
  return (
    typeof mode.id === 'string' &&
    typeof mode.title === 'string' &&
    Array.isArray(mode.steps) &&
    mode.steps.length > 0 &&
    mode.steps.every(isValidStep)
  );
}

function sanitizeAdvanced(raw: unknown): StudyModeAdvancedSettings {
  const fallback = INITIAL_STUDY_MODE_STATE.advanced;
  if (!isRecord(raw)) return { ...fallback };
  return {
    skipNoDialogue: SKIP_VALUES.has(raw.skipNoDialogue as string)
      ? (raw.skipNoDialogue as StudyModeAdvancedSettings['skipNoDialogue'])
      : fallback.skipNoDialogue,
    removeBracketed:
      typeof raw.removeBracketed === 'boolean' ? raw.removeBracketed : fallback.removeBracketed,
    pauseOnUnknown: PAUSE_UNKNOWN_VALUES.has(raw.pauseOnUnknown as string)
      ? (raw.pauseOnUnknown as StudyModeAdvancedSettings['pauseOnUnknown'])
      : fallback.pauseOnUnknown,
    unknownScope: UNKNOWN_SCOPE_VALUES.has(raw.unknownScope as string)
      ? (raw.unknownScope as StudyModeAdvancedSettings['unknownScope'])
      : fallback.unknownScope,
    popupOnAutoPause:
      typeof raw.popupOnAutoPause === 'boolean' ? raw.popupOnAutoPause : fallback.popupOnAutoPause,
    popupCloseOnResume:
      typeof raw.popupCloseOnResume === 'boolean' ? raw.popupCloseOnResume : fallback.popupCloseOnResume,
  };
}

export function migrateStudyModeState(raw: unknown): StudyModeState {
  if (!isRecord(raw)) {
    return { ...INITIAL_STUDY_MODE_STATE };
  }

  const state = raw as Partial<StudyModeState>;
  const version = state.version ?? 0;

  if (version < CURRENT_VERSION) {
    return { ...INITIAL_STUDY_MODE_STATE };
  }

  return {
    version: CURRENT_VERSION,
    activeModeId: typeof state.activeModeId === 'string' ? state.activeModeId : 'normal',
    customModes: Array.isArray(state.customModes) ? state.customModes.filter(isValidMode) : [],
    advanced: sanitizeAdvanced(state.advanced),
  };
}
