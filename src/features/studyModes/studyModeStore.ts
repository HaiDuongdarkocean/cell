import { create } from 'zustand';
import type { StudyMode, StudyModeAdvancedSettings, StudyModeState, StudyStep } from '@/entities/studyMode';
import { STORAGE_KEYS } from '@/shared/config/config';
import { getStorage, setStorage, onStorageChanged } from '@/shared/lib/chrome-apis';
import { applyStudyModeState } from './content/studyModeController';
import { migrateStudyModeState, INITIAL_STUDY_MODE_STATE } from './lib/migrateStudyModeState';
import { deriveRemoveBracketed } from '@/entities/studyMode';
import { validateModeName } from './lib/validateModeName';
import { generateModeId } from './lib/generateModeId';
import { formatModeDescription } from './lib/formatStepSummary';
import { t } from '@/shared/i18n';
import { findActiveMode } from './lib/findActiveMode';

export interface StudyModeStore extends StudyModeState {
  isLoaded: boolean;
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  setActiveModeId: (id: string) => void;
  setAdvanced: (advanced: StudyModeAdvancedSettings) => void;
  createCustomMode: (title: string, steps: StudyStep[]) => StudyMode | null;
  updateCustomMode: (id: string, patch: { title?: string; steps?: StudyStep[] }) => StudyMode | null;
  deleteCustomMode: (id: string) => void;
  applyActiveMode: () => Promise<void>;
}

async function persist(state: StudyModeState): Promise<void> {
  try {
    const toStore: StudyModeState = {
      version: state.version,
      activeModeId: state.activeModeId,
      customModes: state.customModes,
      advanced: state.advanced,
    };
    await setStorage({ [STORAGE_KEYS.STUDY_MODES]: toStore });
  } catch (e) {
    console.error('[studyModeStore] persist failed', e);
  }
}

function applyToPlayer(state: StudyModeState): void {
  applyStudyModeState(state);
}

export const useStudyModeStore = create<StudyModeStore>((set, get) => ({
  ...INITIAL_STUDY_MODE_STATE,
  isLoaded: false,
  advancedOpen: false,

  setAdvancedOpen: (open) => {
    set({ advancedOpen: open });
    void setStorage({ [STORAGE_KEYS.STUDY_MODES_ADVANCED_OPEN]: open }).catch(() => undefined);
  },

  setActiveModeId: (id) => {
    const state = get();
    const next: StudyModeState = { ...state, activeModeId: id };
    const validated = findActiveMode(next).id === id ? id : 'normal';
    if (validated !== id) {
      next.activeModeId = 'normal';
    }
    set(next);
    void persist(next);
    if (next.activeModeId !== state.activeModeId) {
      applyToPlayer(next);
    }
  },

  setAdvanced: (advanced) => {
    const state = get();
    const next: StudyModeState = {
      ...state,
      advanced: { ...advanced, removeBracketed: deriveRemoveBracketed(advanced.cleanupRules) },
    };
    set(next);
    void persist(next);
    applyToPlayer(next);
  },

  createCustomMode: (title, steps) => {
    const state = get();
    const validation = validateModeName(title, state.customModes);
    if (!validation.valid) return null;

    const newMode: StudyMode = {
      id: generateModeId(),
      type: 'custom',
      icon: 'slidersHorizontal',
      title: title.trim(),
      description: formatModeDescription(
        {
          id: '',
          type: 'custom',
          icon: 'slidersHorizontal',
          title: '',
          description: '',
          steps,
        },
        t,
      ),
      steps,
    };
    const next: StudyModeState = {
      ...state,
      customModes: [...state.customModes, newMode],
      activeModeId: newMode.id,
    };
    set(next);
    void persist(next);
    applyToPlayer(next);
    return newMode;
  },

  updateCustomMode: (id, { title, steps }) => {
    const state = get();
    const index = state.customModes.findIndex((m) => m.id === id);
    if (index === -1) return null;

    const current = state.customModes[index];
    if (title !== undefined) {
      const validation = validateModeName(title, state.customModes, id);
      if (!validation.valid) return null;
    }

    const updated: StudyMode = {
      ...current,
      title: title !== undefined ? title.trim() : current.title,
      steps: steps !== undefined ? steps : current.steps,
      description: formatModeDescription(
        {
          ...current,
          title: title !== undefined ? title.trim() : current.title,
          steps: steps !== undefined ? steps : current.steps,
        },
        t,
      ),
    };
    const nextCustomModes = [...state.customModes];
    nextCustomModes[index] = updated;

    const next: StudyModeState = { ...state, customModes: nextCustomModes };
    if (state.activeModeId === id) {
      next.activeModeId = updated.id;
    }
    set(next);
    void persist(next);
    if (next.activeModeId === id) {
      applyToPlayer(next);
    }
    return updated;
  },

  deleteCustomMode: (id) => {
    const state = get();
    const next: StudyModeState = {
      ...state,
      customModes: state.customModes.filter((m) => m.id !== id),
    };
    if (state.activeModeId === id) {
      next.activeModeId = 'normal';
    }
    set(next);
    void persist(next);
    if (state.activeModeId === id) {
      applyToPlayer(next);
    }
  },

  applyActiveMode: async () => {
    applyToPlayer(get());
  },
}));

let storageSyncBound = false;

export async function loadStudyModeState(): Promise<void> {
  try {
    const data = await getStorage<Record<string, unknown>>([
      STORAGE_KEYS.STUDY_MODES,
      STORAGE_KEYS.STUDY_MODES_ADVANCED_OPEN,
    ]);
    const raw = data[STORAGE_KEYS.STUDY_MODES];
    const migrated = migrateStudyModeState(raw);

    // Ensure active mode still exists.
    const active = findActiveMode(migrated);
    if (active.id !== migrated.activeModeId) {
      migrated.activeModeId = 'normal';
    }

    useStudyModeStore.setState({
      ...migrated,
      isLoaded: true,
      advancedOpen: data[STORAGE_KEYS.STUDY_MODES_ADVANCED_OPEN] === true,
    });
    // ponytail: storage sync across tabs/pages. Registered once per context —
    // the tab re-mounts on every panel open and addListener would leak.
    if (storageSyncBound) return;
    storageSyncBound = true;
    onStorageChanged((changes, area) => {
      if (area !== 'local') return;
      const openChange = changes[STORAGE_KEYS.STUDY_MODES_ADVANCED_OPEN];
      if (openChange) {
        useStudyModeStore.setState({ advancedOpen: openChange.newValue === true });
      }
      const change = changes[STORAGE_KEYS.STUDY_MODES];
      if (!change) return;
      const next = migrateStudyModeState(change.newValue);
      const nextActive = findActiveMode(next);
      if (nextActive.id !== next.activeModeId) {
        next.activeModeId = 'normal';
      }
      useStudyModeStore.setState(next);
    });
  } catch (e) {
    console.error('[studyModeStore] load failed', e);
    useStudyModeStore.setState({ ...INITIAL_STUDY_MODE_STATE, isLoaded: true });
  }
}
