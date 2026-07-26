import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/ui/popupDictionaryController';

export type UniversalPanelTab = 'dictionary' | 'settings';

export interface UniversalPanelController {
  readonly open: (tab?: UniversalPanelTab) => Promise<void>;
  readonly close: () => void;
  readonly switchTab: (tab: UniversalPanelTab) => Promise<void>;
  readonly isOpen: () => boolean;
  readonly sendToCard: (prefill: PopupCardCreatorPrefill) => Promise<void>;
  readonly unmount: () => void;
}

export type DictionaryPanelPrefill = PopupCardCreatorPrefill;
