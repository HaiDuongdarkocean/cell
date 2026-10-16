// Iframe popup bridge types — remote-mount protocol for the dictionary popup.
//
// A child iframe (cross-origin player embed, e.g. playembed.vip) keeps its
// whole popup lifecycle — lookup, highlight, pause/resume, stack, trail —
// but mounts the actual popup surface on the TOP frame document, because
// position:fixed inside an iframe is clipped to the iframe's viewport.
//
//   child → parent: POPUP_OPEN { id, opts } / POPUP_CALL { id, method, args }
//                   POPUP_CLOSE { id } / POPUP_PDOWN { id, reanchor }
//   parent → child: POPUP_OPENED { id, ok } / POPUP_CB { id, name, args }
//
// Intermediate frames translate rect-bearing payloads by the sender iframe's
// bounding rect and repost upward, so nested embeds accumulate correctly.

import type { LookupResult, PopupTab } from '@/entities/dictionary';
import type { PopupAnchor, PopupLineRect, PopupPointerHint, PopupSize } from '../ui/popupGeometry';

export const POPUP_OPEN_MSG = '__Tihoka_POPUP_OPEN';
export const POPUP_OPENED_MSG = '__Tihoka_POPUP_OPENED';
export const POPUP_CALL_MSG = '__Tihoka_POPUP_CALL';
export const POPUP_CLOSE_MSG = '__Tihoka_POPUP_CLOSE';
export const POPUP_CB_MSG = '__Tihoka_POPUP_CB';
export const POPUP_PDOWN_MSG = '__Tihoka_POPUP_PDOWN';

/** JSON/structured-clone-safe subset of MountPopupDictionaryOptions.
 *  Callbacks are re-created on the host and relayed back as POPUP_CB. */
export interface RemotePopupOptions {
  readonly anchor: PopupAnchor;
  readonly pointer?: PopupPointerHint;
  readonly lineRect?: PopupLineRect | null;
  readonly langCode: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly initialTerm?: string;
  readonly contextSentence?: string;
  readonly cursorOffset?: number;
  readonly initialResult?: LookupResult;
  readonly initialCandidates?: readonly LookupResult[];
  readonly isLoading?: boolean;
  readonly initialSize?: Partial<PopupSize>;
  readonly initialSheetHeight?: number;
  /** Sheet height as viewport fraction — the host recomputes px from its own
   *  innerHeight so the iframe's tiny viewport can't pin the sheet. */
  readonly sheetHeightVh?: number;
  readonly trail?: readonly string[];
  readonly defaultActiveTab?: PopupTab | null;
  /** Anchor/pointer/lineRect already expressed in top-frame coordinates —
   *  set when the lookup came from a host-rendered surface (remote cue
   *  panel), or by a middle frame after translating once. */
  readonly anchorInTopCoords?: boolean;
}

/** Controller methods callable cross-frame. */
export type RemotePopupCall =
  | { method: 'setLoading'; args: [boolean] }
  | { method: 'setResult'; args: [LookupResult] | [LookupResult, readonly LookupResult[]] }
  | { method: 'setStatus'; args: [string, string] }
  | { method: 'setOptions'; args: [Partial<RemotePopupOptions>] }
  | { method: 'setAnchor'; args: [PopupAnchor, PopupPointerHint | undefined, PopupLineRect | null] }
  | { method: 'setZIndex'; args: [string] }
  | { method: 'focus'; args: [] }
  | { method: 'destroy'; args: [] };

/** Popup-side callbacks relayed host → child. */
export type RemotePopupCallbackName =
  | 'onClose'
  | 'onResult'
  | 'onSizeChange'
  | 'onSendToCard'
  | 'onQuickAdd'
  | 'onStatusChange'
  | 'onCandidateChange'
  | 'onOpenSettings'
  | 'onTrailNavigate'
  | 'onOutsidePointerDown';
