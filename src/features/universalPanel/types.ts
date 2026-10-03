import type { DictionaryPanelPrefill } from '@/entities/dictionary';

export type { DictionaryPanelPrefill };

export type UniversalPanelTab = 'dictionary' | 'playlist' | 'recap' | 'settings' | 'studyModes' | 'vocabulary';

export interface UniversalPanelController {
  readonly open: (tab?: UniversalPanelTab) => Promise<void>;
  readonly close: () => void;
  readonly switchTab: (tab: UniversalPanelTab) => Promise<void>;
  readonly isOpen: () => boolean;
  readonly sendToCard: (prefill: DictionaryPanelPrefill) => Promise<void>;
  readonly openDictionaryLookup: (term: string) => Promise<void>;
  readonly onOpenChange: (listener: (open: boolean) => void) => () => void;
  readonly unmount: () => void;
}
