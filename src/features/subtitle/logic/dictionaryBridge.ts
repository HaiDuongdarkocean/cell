import type { LookupRequest } from '@/entities/dictionary';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import type { CardCreatorOpenContext } from '@/features/cardCreator/types';

export interface DictionaryCueRange {
  readonly index?: number;
  readonly start: number;
  readonly end: number;
  readonly text?: string;
}

export interface DictionaryBridge {
  handleLookup(
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    highlightTarget: Range | HTMLElement,
  ): void;
  cancelLookup(requestId: string): void;
  updateSettings(settings: {
    dictionaryPopup: DictionaryPopupSettings;
    cardCreator: CardCreatorSettings;
    subtitleOverlayNativeLanguage?: string;
  }): void;
  configureVideo(config: {
    hasVideo: boolean;
    video?: HTMLVideoElement;
    getTargetCues?: () => readonly DictionaryCueRange[];
  }): void;
  updateCardCreatorSettings(settings: CardCreatorSettings): void;
  sendToCard(
    context: CardCreatorOpenContext,
    action?: 'quick-add' | 'quick-update' | 'edit-card',
  ): void;
  isCardCreatorOpen(): boolean;
}
