import type { PopupDictionaryMountController } from '../ui/mountPopupDictionary';
import type { PopupAnchor } from '../ui/usePopupPosition';
import type { LookupRequest, LookupResult } from '@/entities/dictionary';
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
  /** Winner term currently displayed in this level's popup (1-4 status keys
   *  target it). Null while a lookup is still loading. */
  term: string | null;
  termLangCode: string | null;
  /** Term the user looked up at this level — breadcrumb label. Known at
   *  request time, unlike `term` which waits for the winning result. */
  lookupTerm: string | null;
  /** Lookup request + result snapshot so the level can be re-rendered without
   *  a worker round-trip — breadcrumb restore in sheet mode and re-materializing
   *  desktop popups after a viewport breakpoint crossing. */
  request: LookupRequest | null;
  result: LookupResult | null;
  candidates: readonly LookupResult[];
  /** Last anchor rect this level's popup/sheet was placed on — fallback
   *  position when re-materializing after the source token is gone. */
  anchor: PopupAnchor | null;
  abovePanel: boolean;
  /** Anchor geometry already expressed in top-frame coordinates — set when
   *  the lookup target is a host-rendered stand-in (remote cue panel). */
  hostAnchored: boolean;
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
    term: null,
    termLangCode: null,
    lookupTerm: null,
    request: null,
    result: null,
    candidates: [],
    anchor: null,
    abovePanel: true,
    hostAnchored: false,
    highlight: createWordHighlight(),
  };
}
