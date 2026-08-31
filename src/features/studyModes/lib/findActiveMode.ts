import { PRESET_LOOKUP } from '@/entities/studyMode';
import type { StudyMode, StudyModeState } from '@/entities/studyMode';

export function findActiveMode(state: StudyModeState): StudyMode {
  if (state.activeModeId.startsWith('custom-')) {
    return state.customModes.find((m) => m.id === state.activeModeId) ?? PRESET_LOOKUP.get('normal')!;
  }
  return PRESET_LOOKUP.get(state.activeModeId) ?? PRESET_LOOKUP.get('normal')!;
}
