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
  // Direct element ref — the subtitle overlay lives in a shadow root, so
  // document.querySelector (getTokenById) can't reach these tokens. The ref
  // keeps clear/status updates working for shadow-DOM tokens.
  popupTokenEl: HTMLElement | null;
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
    popupTokenEl: null,
    highlight: createWordHighlight(),
  };
}
