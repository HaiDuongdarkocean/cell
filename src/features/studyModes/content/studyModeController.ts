import { getStorage, onStorageChanged } from '@/shared/lib/chrome-apis';
import { onMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import { INITIAL_STUDY_MODE_STATE, migrateStudyModeState } from '../lib/migrateStudyModeState';
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
  if (
    current !== null &&
    next !== null &&
    current.activeMode.id === next.activeMode.id &&
    JSON.stringify(current.activeMode.steps) === JSON.stringify(next.activeMode.steps) &&
    JSON.stringify(current.advanced) === JSON.stringify(next.advanced)
  ) {
    return;
  }
  current = next;
  listeners.forEach((cb) => cb(next));
}

export function subscribeToStudyMode(cb: (state: ActiveStudyMode | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function applyStudyModeState(state: StudyModeState): void {
  let activeMode = findActiveMode(state);
  if (activeMode.id !== state.activeModeId) {
    state = { ...state, activeModeId: 'normal' };
    activeMode = findActiveMode(state);
  }
  setActiveStudyMode({ activeMode, advanced: state.advanced });
}

export function initializeStudyModeController(): void {
  void getStorage<Record<string, unknown>>(STORAGE_KEYS.STUDY_MODES)
    .then((data) => {
      applyStudyModeState(migrateStudyModeState(data[STORAGE_KEYS.STUDY_MODES]));
    })
    .catch(() => {
      applyStudyModeState(INITIAL_STUDY_MODE_STATE);
    });

  onStorageChanged((changes, area) => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEYS.STUDY_MODES];
    if (!change) return;
    applyStudyModeState(migrateStudyModeState(change.newValue));
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
