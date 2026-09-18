import type { LookupRequest, PopupCardCreatorPrefill } from '@/entities/dictionary';
import type { PopupStatusTarget } from '@/features/tokenize';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import type { CardCreatorOpenContext } from '@/entities/cardCreator';

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
  dismissLookup(): void;
  closePopup(): void;
  hasOpenPopup(): boolean;
  /** The term the deepest open popup is showing, so 1-4 status keys can target
   *  the looked-up word. Optional — bridges without popup support omit it. */
  getPopupStatusTarget?(): PopupStatusTarget | null;
  updateSettings(settings: {
    dictionaryPopup: DictionaryPopupSettings;
    cardCreator: CardCreatorSettings;
    subtitleOverlayNativeLanguage?: string;
  }): void;
  configureVideo(config: {
    hasVideo: boolean;
    video?: HTMLVideoElement;
    getTargetCues?: () => readonly DictionaryCueRange[];
    getNativeCues?: () => readonly DictionaryCueRange[];
  }): void;
  updateCardCreatorSettings(settings: CardCreatorSettings): void;
  sendToCard(
    context: CardCreatorOpenContext,
    action?: 'quick-add' | 'quick-update' | 'edit-card',
    selection?: PopupCardCreatorPrefill,
  ): void;
  isCardCreatorOpen(): boolean;
}
