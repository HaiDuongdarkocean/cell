import { useState, useCallback } from 'react';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';

export interface DictionaryPopupMockState {
  settings: DictionaryPopupSettings;
}

const INITIAL: DictionaryPopupMockState = {
  settings: DEFAULT_DICTIONARY_POPUP_SETTINGS,
};

export interface UseMockDictionaryPopupReturn {
  state: DictionaryPopupMockState;
  update: (partial: Partial<DictionaryPopupSettings>) => void;
  applyPreset: (preset: 'watch' | 'translate' | 'speed' | 'power') => void;
}

export function useMockDictionaryPopup(): UseMockDictionaryPopupReturn {
  const [state, setState] = useState<DictionaryPopupMockState>(INITIAL);

  const update = useCallback((partial: Partial<DictionaryPopupSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
  }, []);

  const applyPreset = useCallback(
    (preset: 'watch' | 'translate' | 'speed' | 'power') => {
      const base: Partial<DictionaryPopupSettings> =
        preset === 'watch'
          ? { triggerMode: 'click', defaultActiveTab: 'audio', srsDestination: 'anki' }
          : preset === 'translate'
            ? { triggerMode: 'click', defaultActiveTab: 'translate', srsDestination: 'ocean-srs' }
            : preset === 'speed'
              ? { triggerMode: 'hover', defaultActiveTab: null, srsDestination: 'anki' }
              : { triggerMode: 'hover-ctrl', defaultActiveTab: 'pronunciation', srsDestination: 'anki' };
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...base },
      }));
    },
    [],
  );

  return { state, update, applyPreset };
}
