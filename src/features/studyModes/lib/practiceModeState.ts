import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import { migrateStudyModeState } from './migrateStudyModeState';
import { findActiveMode } from './findActiveMode';
import type { SubtitlePracticeMode } from './subtitlePractice';

export function practiceModeFromStudyModeId(id: string): SubtitlePracticeMode {
  return id === 'dictation' || id === 'cloze' ? id : 'off';
}

export async function setSubtitlePracticeMode(mode: SubtitlePracticeMode): Promise<void> {
  try {
    const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.STUDY_MODES);
    const state = migrateStudyModeState(data[STORAGE_KEYS.STUDY_MODES]);
    const next = { ...state, activeModeId: mode === 'off' ? 'normal' : mode };
    await setStorage({ [STORAGE_KEYS.STUDY_MODES]: next });
    const activeMode = findActiveMode(next);
    await sendMessage({
      type: MESSAGE_TYPES.APPLY_STUDY_MODE,
      payload: { activeMode, advanced: next.advanced },
    });
  } catch {
    return;
  }
}
