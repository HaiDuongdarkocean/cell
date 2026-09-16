import type { PopupDictionaryMountController } from '../ui/mountPopupDictionary';
import { createWordHighlight, type HighlightTarget, type WordHighlight } from '../ui/wordHighlight';

/** Minimal cue range used for sentence audio capture. */
export interface CueRange {
  readonly index?: number;
  readonly start: number;
  readonly end: number;
  readonly text?: string;
}

export interface PopupTokenId {
  term: string;
  start: string;
  blockId: string;
}

export interface HighlightAnchor {
  parent: Element;
  wordStart: number;
}

export interface PopupLevel {
  mount: PopupDictionaryMountController | null;
  requestId: string | null;
  highlightTarget: HighlightTarget | null;
  originalHighlightTarget: HighlightTarget | null;
  highlightAnchor: HighlightAnchor | null;
  popupTokenId: PopupTokenId | null;
  highlight: WordHighlight;
}

export function createPopupLevel(): PopupLevel {
  return {
    mount: null,
    requestId: null,
    highlightTarget: null,
    originalHighlightTarget: null,
    highlightAnchor: null,
    popupTokenId: null,
    highlight: createWordHighlight(),
  };
}
