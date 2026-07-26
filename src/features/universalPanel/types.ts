export type UniversalPanelTab = 'dictionary' | 'settings';

export interface UniversalPanelController {
  readonly open: (tab?: UniversalPanelTab) => void;
  readonly close: () => void;
  readonly switchTab: (tab: UniversalPanelTab) => void;
  readonly isOpen: () => boolean;
  readonly unmount: () => void;
}

export interface DictionaryPanelPrefill {
  readonly term?: string;
  readonly definitions?: string;
  readonly sentence?: string;
  readonly sentenceTranslation?: string;
  readonly wordAudioUrls?: readonly string[];
  readonly sentenceAudioUrls?: readonly string[];
  readonly imageUrls?: readonly string[];
}
