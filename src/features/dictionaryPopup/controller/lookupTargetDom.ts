import type { WordStatus } from '@/entities/dictionary';
import type { PopupLineRect } from '../ui/popupGeometry';
import { resolveWordAtPoint } from '@/features/dictionaryPopup/sentence/sentenceModule';
import { isInsideUniversalPanelHost } from '@/shared/lib/dom/cellUiHosts';
import { refreshIPlus1Marking } from '@/features/tokenize';
import type { HighlightTarget } from '../ui/wordHighlight';
import type { CueRange, PopupLevel, PopupTokenId } from './controllerTypes';

export const POPUP_OPEN_CLASS = 'js-cell-token--popup-open';
export const ALL_STATUSES: WordStatus[] = ['unknown', 'tracking', 'known', 'ignore'];

const LOOKUP_TRIGGER_SELECTOR = '.js-cell-token, .cell-ocr-hitbox';
const LOOKUP_TEXT_SELECTOR = '[data-allow-lookup]';

/**
 * Avoidance band for the line/cue containing the looked-up word.
 *
 * Subtitle path (HTMLElement token): parent cue box — often 1–2 visual lines.
 *   Popup must clear the whole cue so neighbors on the same row stay clickable.
 * Web text path (Range): single visual line via getClientRects (not whole <p>).
 *
 * Horizontal span is expanded to full viewport width later in computePopupPosition
 * so side placements cannot cover same-row neighbors.
 */
export function computeLineRect(target: HighlightTarget): PopupLineRect | null {
  if (target instanceof HTMLElement) {
    const parent = target.parentElement;
    const box = (parent ?? target).getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return { top: box.top, left: box.left, right: box.right, bottom: box.bottom };
  }

  // Web text: keep the line geometry anchored to the selected word. Using
  // the block's bounding rect here makes later words in a multi-line
  // paragraph position relative to the paragraph instead of the word.
  const wordRect = typeof target.getBoundingClientRect === 'function'
    ? target.getBoundingClientRect()
    : null;
  if (!wordRect || wordRect.width <= 0 || wordRect.height <= 0) return null;
  return { top: wordRect.top, left: wordRect.left, right: wordRect.right, bottom: wordRect.bottom };
}

export function getTokenElement(target: HighlightTarget): HTMLElement | null {
  if (target instanceof HTMLElement) {
    return target.closest('.js-cell-token');
  }
  if (target instanceof Range) {
    const node = target.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    return element?.closest('.js-cell-token') ?? null;
  }
  return null;
}

export function lookupAnchorElement(level: PopupLevel): Element | null {
  const target = level.highlightTarget;
  if (!target) return null;
  const node = target instanceof Range ? target.startContainer : target;
  return node instanceof Element ? node : node.parentElement;
}

/** Check if the level's lookup target is inside the subtitle overlay block
 *  or a subtitle panel cue. Media recording (screenshot + sentence audio)
 *  is only allowed for subtitle-origin lookups, not plain web text. */
export function isLookupFromSubtitle(level: PopupLevel): boolean {
  const el = lookupAnchorElement(level);
  return el?.closest('[data-cell-id="subtitle-block"], [data-cue-start]') !== null;
}

/** Resolve the cue range a panel lookup was made on. CueList items carry
 *  data-cue-start/data-cue-end so the clicked cue is identified directly
 *  instead of being inferred from video.currentTime — the selected cue is
 *  often not the currently-playing one. */
export function lookupCueRange(level: PopupLevel): CueRange | null {
  const item = lookupAnchorElement(level)?.closest('[data-cue-start][data-cue-end]');
  if (!item) return null;
  const start = Number(item.getAttribute('data-cue-start'));
  const end = Number(item.getAttribute('data-cue-end'));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

export function getTokenById(id: PopupTokenId): HTMLElement | null {
  return document.querySelector(
    `[data-cell-term="${CSS.escape(id.term)}"][data-cell-start="${id.start}"][data-cell-block-id="${id.blockId}"]`,
  );
}

export function setPopupTokenId(level: PopupLevel, token: HTMLElement): void {
  level.popupTokenId = {
    term: token.getAttribute('data-cell-term') ?? '',
    start: token.getAttribute('data-cell-start') ?? '',
    blockId: token.getAttribute('data-cell-block-id') ?? '',
  };
  level.popupTokenEl = token;
  token.classList.add(POPUP_OPEN_CLASS);
}

export function clearPopupTokenId(level: PopupLevel): void {
  // Prefer the stored element ref: subtitle token spans live inside the
  // overlay's shadow root where document.querySelector can't reach them.
  const el = level.popupTokenEl ?? (level.popupTokenId ? getTokenById(level.popupTokenId) : null);
  el?.classList.remove(POPUP_OPEN_CLASS);
  level.popupTokenId = null;
  level.popupTokenEl = null;
}

export function applyTokenStatus(target: HighlightTarget | HTMLElement, status: WordStatus): void {
  const token = target instanceof HTMLElement ? target : getTokenElement(target);
  if (!token) return;
  for (const s of ALL_STATUSES) {
    token.classList.remove(`js-cell-token--status-${s}`);
  }
  token.classList.add(`js-cell-token--status-${status}`);
  refreshIPlus1Marking(token);
}

export function isLookupFromUniversalPanel(target: HighlightTarget): boolean {
  const node = target instanceof Range ? target.startContainer : target;
  return isInsideUniversalPanelHost(node);
}

/** Index of the popup level whose shadow host contains the lookup target,
 *  or -1 when the target is page/subtitle text. */
export function levelIndexForTarget(popupStack: readonly PopupLevel[], target: HighlightTarget): number {
  const node = target instanceof Range ? target.startContainer : target;
  const root = node.getRootNode();
  if (!(root instanceof ShadowRoot)) return -1;
  const host = root.host;
  if (!(host instanceof HTMLElement) || !host.classList.contains('js-cell-popup-host')) return -1;
  return popupStack.findIndex((level) => level.mount?.host === host);
}

/** Outside-click guard for each mount: a pointerdown inside ANY stack host
 *  must not dismiss a sibling level. */
export function isInsideStackHostEvent(e: PointerEvent): boolean {
  return e.composedPath().some(
    (el) => el instanceof HTMLElement && el.classList.contains('js-cell-popup-host'),
  );
}

export function isReanchorPointerDown(e: PointerEvent): boolean {
  const path = e.composedPath();
  if (path.some((el) => el instanceof Element && el.matches(LOOKUP_TRIGGER_SELECTOR))) {
    return true;
  }
  if (!path.some((el) => el instanceof Element && el.matches(LOOKUP_TEXT_SELECTOR))) {
    return false;
  }
  return resolveWordAtPoint(e.clientX, e.clientY) !== null;
}
