import { getStorage } from '@/shared/lib/chrome-apis';
import { onMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import { INITIAL_STUDY_MODE_STATE } from '../lib/migrateStudyModeState';
import { findActiveMode } from '../lib/findActiveMode';
import type { StudyMode, StudyModeAdvancedSettings, StudyModeState } from '@/entities/studyMode';

export interface ActiveStudyMode {
  activeMode: StudyMode;
  advanced: StudyModeAdvancedSettings;
}

let current: ActiveStudyMode | null = null;
const listeners = new Set<(state: ActiveStudyMode | null) => void>();

export function getActiveStudyMode(): ActiveStudyMode | null {
  return current;
}

export function setActiveStudyMode(next: ActiveStudyMode | null): void {
  current = next;
  listeners.forEach((cb) => cb(next));
}

export function subscribeToStudyMode(cb: (state: ActiveStudyMode | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function applyStudyModeState(state: StudyModeState): void {
  const activeMode = findActiveMode(state);
  setActiveStudyMode({ activeMode, advanced: state.advanced });
}

export function initializeStudyModeController(): void {
  void getStorage<Record<string, unknown>>(STORAGE_KEYS.STUDY_MODES)
    .then((data) => {
      const raw = data[STORAGE_KEYS.STUDY_MODES] as Partial<StudyModeState> | undefined;
      if (!raw) {
        setActiveStudyMode({
          activeMode: findActiveMode(INITIAL_STUDY_MODE_STATE),
          advanced: INITIAL_STUDY_MODE_STATE.advanced,
        });
        return;
      }
      const state: StudyModeState = {
        version: raw.version ?? 1,
        activeModeId: raw.activeModeId ?? 'normal',
        customModes: Array.isArray(raw.customModes) ? raw.customModes : [],
        advanced: raw.advanced ?? INITIAL_STUDY_MODE_STATE.advanced,
      };
      const activeMode = findActiveMode(state);
      if (activeMode.id !== state.activeModeId) {
        state.activeModeId = 'normal';
      }
      setActiveStudyMode({ activeMode, advanced: state.advanced });
    })
    .catch(() => {
      setActiveStudyMode({
        activeMode: findActiveMode(INITIAL_STUDY_MODE_STATE),
        advanced: INITIAL_STUDY_MODE_STATE.advanced,
      });
    });

  const remove = onMessage((msg) => {
    if ((msg as { type?: string }).type === MESSAGE_TYPES.APPLY_STUDY_MODE) {
      const payload = (msg as { payload?: unknown }).payload as ActiveStudyMode | undefined;
      if (payload && payload.activeMode && payload.advanced) {
        setActiveStudyMode(payload);
      }
    }
  });

  return remove;
}
