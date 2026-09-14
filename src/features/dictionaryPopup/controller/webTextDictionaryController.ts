// webTextDictionaryController — spec §2: top-level popup + lookup + highlight wiring.
//
// Manages the dictionary popup lifecycle independently of video presence.
// - Lives in content-script top-level and inside subtitle overlay controller.
// - Owns one WebTriggerController for web-text (document-level hover/click).
// - Receives SubtitleTriggerController callbacks for subtitle token lookup.
// - Owns WordHighlight to mark the target word/token.
// - Delegates popup rendering to popupDictionaryController.
// - Handles Card Creator / Quick Add actions from the popup.


import type {
  LookupRequest,
  LookupResult,
  TriggerMode,
  WordStatus,
  FetchCommunityAudioResponse,
  FetchImagesResponse,
  AudioItem,
  ImageItem,
  TtsFetchAudioResponse,
  PopupCardCreatorPrefill,
  PopupCardCreatorAction,
  OnCardCreatorActionResult,
} from '@/entities/dictionary';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import type { BilingualCue } from '@/entities/media';
import type { PopupLineRect } from '../ui/popupGeometry';
import { POPUP_SHEET_BREAKPOINT_PX } from '../ui/popupGeometry';
import type { PopupAnchor, PopupSize } from '../ui/usePopupPosition';
import {
  mountPopupDictionary,
  type PopupDictionaryMountController,
  type MountPopupDictionaryOptions,
} from '../ui/mountPopupDictionary';
import { WebTriggerController, type WebTriggerPointer } from '@/features/dictionaryPopup/trigger/webTriggerController';
import {
  extractWordAtOffset,
  WORD_CHAR_RE,
} from '@/features/dictionaryPopup/sentence/sentenceModule';
import { nextRequestId } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import { createWordHighlight, type HighlightTarget, type WordHighlight } from '@/features/dictionaryPopup/ui/wordHighlight';
import { type PointerPreset } from '@/features/dictionaryPopup/badgePointer/pointerPosition';
import { mountOrbitalBadge, type OrbitalBadgeMountController } from '@/features/dictionaryPopup/ui/mountOrbitalBadge';
import { formatDefinitions } from '@/features/dictionary/logic/formatDefinitions';
import { buildSubtitleQueue } from '@/features/subtitle/actions/cardActions';
import { emitWordStatusChanged } from '@/features/dictionary/services/wordStatusEvents';

import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message/types';

import type { DictionaryPanelPrefill } from '@/entities/dictionary';
import { openSettingsSection, type PanelMountController } from './panelBridge';
import { mountCardCreatorDialog, type CardCreatorMountController, type CardCreatorOpenContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio, seekAndWaitReady } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';

import { addToOceanSrs, openSrsStudyPage } from '@/features/dictionaryPopup/services/addToOceanSrs';
import { fetchMediaFile, type MediaFile } from '@/features/cardCreator/media/mediaFile';
import { loadSettingsOrToast } from '@/features/subtitle/ui/subtitleControllerHelpers';
import { showToast, showProgressToast } from '@/features/subtitle/ui/subtitleUI';
import { t } from '@/shared/i18n';
import { isChildFrame } from '@/shared/lib/dom/isChildFrame';

/** Minimal cue range used for sentence audio capture. */
export interface CueRange {
  readonly index?: number;
  readonly start: number;
  readonly end: number;
  readonly text?: string;
}

/** Delay before actually hiding the popup when {@link dismissLookup} is called
 *  explicitly. If a new lookup arrives within this window, the dismiss is
 *  canceled and the popup repositions seamlessly.
 *  NOTE: auto-dismiss on hover-leave (onClear) was removed — the popup now
 *  only closes on explicit user action (click outside / Esc / close button).
 *  dismissLookup remains as a public API for explicit/programmatic dismiss. */
const POPUP_DISMISS_DELAY_MS = 500;

export interface WebTextDictionaryControllerDeps {
  readonly container: HTMLElement; // document.body or subtitle overlay container
  readonly dictionaryPopupSettings: DictionaryPopupSettings;
  readonly cardCreatorSettings: CardCreatorSettings;
  readonly nativeLanguage?: string;
  readonly hasVideo: boolean;
  readonly video?: HTMLVideoElement;
  /** Callback to get current target cues for sentence audio capture (subtitle path). */
  readonly getTargetCues?: () => readonly CueRange[];
  /** Called when the user cycles the word status inside the popup. The popup
   *  already persists the new status via its own WORD_STATUS_SET message; this
   *  callback lets external systems (tokenize controller) update their cached
   *  token metadata and rebind affected token spans so the new status sticks
   *  instead of reverting on the next scroll/toggle rebind. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Get the locally cached word status from the tokenize controller, used as a
   *  fallback when the background DB read races or fails. */
  readonly getTokenStatus?: (term: string) => WordStatus;

  /** Generic panel controller toggled by the orbital badge (ADR-065).
   *  When present, Send to Card routes to the integrated universal panel
   *  instead of opening a standalone Card Creator dialog. */
  readonly panelController?: PanelMountController;
}

/** Video/cue configuration for subtitle path. Can be set after construction. */
export interface WebTextDictionaryVideoConfig {
  readonly hasVideo: boolean;
  readonly video?: HTMLVideoElement;
  readonly getTargetCues?: () => readonly CueRange[];
}

export interface WebTextDictionaryController {
  readonly attach: (mode: TriggerMode) => void;
  readonly detach: () => void;
  readonly updateSettings: (settings: {
    dictionaryPopup: DictionaryPopupSettings;
    cardCreator: CardCreatorSettings;
    subtitleOverlayNativeLanguage?: string;
  }) => void;
  /** Late-bind video + cue source when subtitle overlay initializes. */
  readonly configureVideo: (config: WebTextDictionaryVideoConfig) => void;
  readonly destroy: () => void;
  /** Handle a lookup request and render popup + highlight. */
  readonly handleLookup: (
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    highlightTarget: HighlightTarget,
    pointer?: WebTriggerPointer,
  ) => void;
  /** Cancel an in-flight lookup. */
  readonly cancelLookup: (requestId: string) => void;
  /** Hide the popup, clear highlight, and cancel the current lookup. */
  readonly dismissLookup: () => void;
  /** Highlight a token span (subtitle) or a Range (web text). */
  readonly showHighlight: (target: HighlightTarget) => void;
  /** Clear active highlight. */
  readonly clearHighlight: () => void;
  /** Sync the popup status with an external status change (e.g. keyboard shortcut). */
  readonly syncStatus: (term: string, status: WordStatus) => void;
  /** Update card creator settings (lazy-updates the dialog mount if it exists). */
  readonly updateCardCreatorSettings: (settings: CardCreatorSettings) => void;
  /** Open the Card Creator dialog with the given context + optional action. */
  readonly openCardCreator: (context: CardCreatorOpenContext, action?: 'quick-add' | 'quick-update' | 'edit-card') => void;
  /** Send the context to the integrated Card Creator in the universal panel.
   *  `selection` carries the full popup prefill (lookup result + loaded media
   *  + selection snapshot) so the integrated Dictionary can initialize as an
   *  exact clone of the popup (Task 4).
   *  Falls back to the standalone dialog when no panel controller is available. */
  readonly sendToCard: (context: CardCreatorOpenContext, action?: 'quick-add' | 'quick-update' | 'edit-card', selection?: PopupCardCreatorPrefill) => void;
  /** Whether the Card Creator dialog is currently open. */
  readonly isCardCreatorOpen: () => boolean;
}

/** Wait for the video to reach readyState ≥ 2 (HAVE_CURRENT_DATA) with a timeout. */
async function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 2000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return;
  const start = Date.now();
  await new Promise<void>((resolve) => {
    const check = (): void => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

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
function computeLineRect(target: HighlightTarget): PopupLineRect | null {
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

export function createWebTextDictionaryController(deps: WebTextDictionaryControllerDeps): WebTextDictionaryController {
  let dpSettings = deps.dictionaryPopupSettings;
  let ccSettings = deps.cardCreatorSettings;
  let nativeLang = deps.nativeLanguage ?? '';

  // Mutable video/cue config — late-bound by subtitle overlay controller.
  let hasVideo = deps.hasVideo;
  let video: HTMLVideoElement | undefined = deps.video;
  let getTargetCues: (() => readonly CueRange[]) | undefined = deps.getTargetCues;

  let popupDictWasPlaying = false;

  const MAX_POPUP_DEPTH = 6;

  interface PopupLevel {
    mount: PopupDictionaryMountController | null;
    requestId: string | null;
    highlightTarget: HighlightTarget | null;
    originalHighlightTarget: HighlightTarget | null;
    highlightAnchor: { parent: Element; wordStart: number } | null;
    popupTokenId: { term: string; start: string; blockId: string } | null;
    highlight: WordHighlight;
  }

  // popupStack[0] is the level-1 popup anchored to page/subtitle text. A lookup
  // triggered from inside level N lands on level N+1, keeping ancestors open.
  const popupStack: PopupLevel[] = [];
  // Backing highlight for the public showHighlight/clearHighlight API when no
  // popup level exists yet.
  const apiHighlight = createWordHighlight();

  // Bounded in-memory lookup cache. Key = `${langCode}:${term.toLowerCase()}`.
  // Capacity scales with device memory (low-end: 50, high-end: 250) to avoid
  // bloat on 1GB machines while still giving repeat-hover instant popups.
  const deviceMemory = Number((navigator as { deviceMemory?: number }).deviceMemory ?? 4);
  const MAX_LOOKUP_CACHE_SIZE = Math.min(250, Math.max(50, Math.round(deviceMemory * 25)));
  const lookupCache = new Map<string, LookupResult[]>();

  function cacheKeyFor(term: string, langCode: string): string {
    return `${langCode}:${term.toLowerCase()}`;
  }

  function getCachedResult(term: string, langCode: string): LookupResult[] | undefined {
    return lookupCache.get(cacheKeyFor(term, langCode));
  }

  function setCachedResult(term: string, langCode: string, results: LookupResult[]): void {
    const key = cacheKeyFor(term, langCode);
    // Move to most-recent position on access.
    if (lookupCache.has(key)) lookupCache.delete(key);
    lookupCache.set(key, results);
    // Evict oldest if over capacity.
    if (lookupCache.size > MAX_LOOKUP_CACHE_SIZE) {
      const first = lookupCache.keys().next().value;
      if (first) lookupCache.delete(first);
    }
  }

  /** Return the previous/next word in `sentence` relative to the current term. */
  function getAdjacentTerms(
    sentence: string,
    cursorOffset: number,
    currentTerm: string,
  ): { term: string; start: number }[] {
    const terms: { term: string; start: number }[] = [];

    // Previous word: scan left from cursorOffset - 1 over non-word chars.
    let i = cursorOffset - 1;
    while (i >= 0 && !WORD_CHAR_RE.test(sentence[i]!)) i--;
    if (i >= 0) {
      const prev = extractWordAtOffset(sentence, i);
      if (prev && prev.text !== currentTerm) terms.push({ term: prev.text, start: prev.start });
    }

    // Next word: scan right from the end of the current term.
    i = cursorOffset + currentTerm.length;
    while (i < sentence.length && !WORD_CHAR_RE.test(sentence[i]!)) i++;
    if (i < sentence.length) {
      const next = extractWordAtOffset(sentence, i);
      if (next && next.text !== currentTerm && !terms.some((t) => t.term === next.text)) {
        terms.push({ term: next.text, start: next.start });
      }
    }

    return terms;
  }

  /** Quietly lookup previous/next words so the popup is already cached when the user moves. */
  function prefetchAdjacentTerms(request: LookupRequest): void {
    if (!request.contextSentence) return;
    const adjacent = getAdjacentTerms(request.contextSentence, request.cursorOffset, request.term);
    for (const { term, start } of adjacent) {
      const key = cacheKeyFor(term, request.langCode);
      if (lookupCache.has(key)) continue;
      const prefetchRequest: LookupRequest = {
        term,
        langCode: request.langCode,
        contextSentence: request.contextSentence,
        cursorOffset: start,
      };
      void Promise.resolve(sendMessage({
        type: MESSAGE_TYPES.LOOKUP_REQUEST,
        payload: { requestId: nextRequestId(), request: prefetchRequest },
      }))
        .then((response: unknown) => {
          const { success, data } = response as { success: boolean; data?: LookupResult[] };
          if (success && data && data.length > 0) {
            setCachedResult(term, request.langCode, data);
          }
        })
        .catch(() => { /* prefetch failures are best-effort */ });
    }
  }

  let webTrigger: WebTriggerController | null = null;
  let currentAttachedMode: TriggerMode | null = null;
  let orbitalBadge: OrbitalBadgeMountController | null = null;
  let orbitalHoverTrigger: WebTriggerController | null = null;
  let orbitalBadgeSize: number | null = null;
  let orbitalBadgeScale: number | null = null;
  // In a child iframe, the orbital badge only mounts while the child document
  // is in native fullscreen (the top-frame badge covers the viewport otherwise).
  // This listener re-runs syncOrbitalBadge on fullscreen transitions so the
  // badge appears on enter and is torn down on exit — keeping exactly one
  // visible badge across normal + fullscreen modes.
  let orbitalFullscreenListener: (() => void) | null = null;
  let cardCreatorMount: CardCreatorMountController | null = null;
  let popupDismissTimer: ReturnType<typeof setTimeout> | null = null;

  function showHighlight(target: HighlightTarget): void {
    (popupStack[popupStack.length - 1]?.highlight ?? apiHighlight).show(target);
  }

  function clearHighlight(): void {
    apiHighlight.clear();
    for (const level of popupStack) level.highlight.clear();
  }

  /** Expand or restore the word highlight to match the given term.
   *  - Single word (no spaces): restore the original highlight target (the
   *    single word the user hovered/clicked).
   *  - Phrase (contains spaces): create a new Range covering the full phrase
   *    in the DOM. For web text, search the text node for the phrase starting
   *    from the original word's position. For subtitle tokens, find adjacent
   *    .js-cell-token spans that together form the phrase.
   *  Called after renderLookupResult (winner) and on candidate switch. */
  function expandHighlightForTerm(level: PopupLevel, term: string): void {
    if (!level.originalHighlightTarget) return;

    // Always clear the current highlight before computing the new range.
    // The original range is mutated by wordHighlight.show's surroundContents
    // (the text node gets split and wrapped), so ranges must be recreated from
    // the highlight anchor after the DOM is restored.
    level.highlight.clear();

    const isPhrase = term.includes(' ');
    if (!isPhrase) {
      level.highlightTarget = (level.highlightAnchor && createPhraseRangeFromAnchor(level.highlightAnchor, term))
        || level.originalHighlightTarget;
      level.highlight.show(level.highlightTarget);
      return;
    }

    // Phrase — try to create a Range covering the full phrase.
    const phraseRange = createPhraseRange(level, level.originalHighlightTarget, term);
    if (phraseRange) {
      level.highlightTarget = phraseRange;
      level.highlight.show(phraseRange);
    } else {
      // Fallback: keep original single-word highlight.
      level.highlightTarget = level.originalHighlightTarget;
      level.highlight.show(level.originalHighlightTarget);
    }
  }

  /** Create a DOM Range covering the given phrase term, starting from the
   *  original highlight target (single word). Returns null if the phrase
   *  cannot be found in the DOM near the original word. */
  function createPhraseRange(level: PopupLevel, original: HighlightTarget, phrase: string): Range | null {
    if (level.highlightAnchor) {
      return createPhraseRangeFromAnchor(level.highlightAnchor, phrase);
    }
    if (original instanceof Range) {
      return createPhraseRangeFromTextRange(original, phrase);
    }
    if (original instanceof HTMLElement) {
      return createPhraseRangeFromToken(original, phrase);
    }
    return null;
  }

  /** Web text path: the original Range covers a single word in a Text node.
   *  Search for the phrase starting from the word's position. */
  function createPhraseRangeFromTextRange(original: Range, phrase: string): Range | null {
    const textNode = original.startContainer;
    if (!(textNode instanceof Text)) return null;
    const nodeText = textNode.textContent ?? '';
    const wordStart = original.startOffset;
    const lowerPhrase = phrase.toLowerCase();
    const lowerNodeText = nodeText.toLowerCase();
    // Try: phrase starts at the same position as the hovered word.
    if (lowerNodeText.startsWith(lowerPhrase, wordStart)) {
      const range = document.createRange();
      try {
        range.setStart(textNode, wordStart);
        range.setEnd(textNode, wordStart + phrase.length);
        return range;
      } catch { return null; }
    }
    // Try: phrase starts before the hovered word (user hovered the 2nd word
    // of the phrase, e.g. hovered "up" → result "pick up").
    const maxBack = Math.min(wordStart, phrase.length * 2);
    for (let back = 1; back <= maxBack; back++) {
      const start = wordStart - back;
      if (lowerNodeText.startsWith(lowerPhrase, start)) {
        const range = document.createRange();
        try {
          range.setStart(textNode, start);
          range.setEnd(textNode, start + phrase.length);
          return range;
        } catch { return null; }
      }
    }
    return null;
  }

  /** Compute the character offset of `offset` inside `textNode` relative to
   *  `parent`'s full textContent. Sums text-node siblings that come first. */
  function computeTextOffset(parent: Element, textNode: Node, offset: number): number {
    let total = 0;
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) !== null) {
      if (node === textNode) return total + offset;
      total += node.textContent?.length ?? 0;
    }
    return total;
  }

  /** Web text path after the single-word highlight has been wrapped: the parent
   *  element still contains the full sentence text, so search it and build a
   *  Range that may span multiple split Text nodes. */
  function createPhraseRangeFromAnchor(
    anchor: { parent: Element; wordStart: number },
    phrase: string,
  ): Range | null {
    const { parent, wordStart } = anchor;
    const parentText = parent.textContent ?? '';
    const lowerPhrase = phrase.toLowerCase();
    const lowerParentText = parentText.toLowerCase();

    let phraseStart = -1;
    if (lowerParentText.startsWith(lowerPhrase, wordStart)) {
      phraseStart = wordStart;
    } else {
      const maxBack = Math.min(wordStart, phrase.length * 2);
      for (let back = 1; back <= maxBack; back++) {
        const start = wordStart - back;
        if (lowerParentText.startsWith(lowerPhrase, start)) {
          phraseStart = start;
          break;
        }
      }
    }
    if (phraseStart === -1) return null;

    const phraseEnd = phraseStart + phrase.length;
    const range = document.createRange();
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startSet = false;
    let node;
    while ((node = walker.nextNode()) !== null) {
      const nodeText = node.textContent ?? '';
      const nodeLen = nodeText.length;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + nodeLen;
      if (!startSet && phraseStart >= nodeStart && phraseStart < nodeEnd) {
        try {
          range.setStart(node, phraseStart - nodeStart);
          startSet = true;
        } catch {
          return null;
        }
      }
      if (startSet && phraseEnd > nodeStart && phraseEnd <= nodeEnd) {
        try {
          range.setEnd(node, phraseEnd - nodeStart);
          return range;
        } catch {
          return null;
        }
      }
      currentOffset += nodeLen;
    }
    return null;
  }

  /** Subtitle token path: the original target is a .js-cell-token span (one
   *  word). Find adjacent .js-cell-token spans that together form the phrase. */
  function createPhraseRangeFromToken(token: HTMLElement, phrase: string): Range | null {
    const line = token.closest('[data-role="target"]');
    if (!line) return null;
    const tokens = Array.from(line.querySelectorAll('.js-cell-token--word'));
    const tokenIdx = tokens.indexOf(token as HTMLElement);
    if (tokenIdx === -1) return null;
    const phraseWords = phrase.toLowerCase().split(/\s+/);
    // Try: phrase starts at the hovered token.
    for (let startIdx = Math.max(0, tokenIdx - phraseWords.length + 1); startIdx <= tokenIdx; startIdx++) {
      const endIdx = startIdx + phraseWords.length;
      if (endIdx > tokens.length) continue;
      const candidateWords = tokens.slice(startIdx, endIdx).map((t) => (t.getAttribute('data-cell-term') ?? '').toLowerCase());
      if (candidateWords.join(' ') === phraseWords.join(' ')) {
        const range = document.createRange();
        try {
          range.setStartBefore(tokens[startIdx]!);
          range.setEndAfter(tokens[endIdx - 1]!);
          return range;
        } catch { return null; }
      }
    }
    return null;
  }

  /** Schedule a delayed popup dismiss. Cancel in-flight immediately but
   *  keep the popup + highlight alive for POPUP_DISMISS_DELAY_MS so a new
   *  lookup (hover to another word in the same sentence) can reposition
   *  seamlessly without dismiss flicker. */
  function dismissLookup(): void {
    cancelInFlightLookup();
    if (popupDismissTimer) return; // already pending
    popupDismissTimer = setTimeout(() => {
      popupDismissTimer = null;
      closePopup();
    }, POPUP_DISMISS_DELAY_MS);
  }

  /** Cancel a pending delayed dismiss — called when a new lookup renders. */
  function cancelPendingDismiss(): void {
    if (popupDismissTimer) {
      clearTimeout(popupDismissTimer);
      popupDismissTimer = null;
    }
  }

  const ALL_STATUSES: WordStatus[] = ['unknown', 'tracking', 'known', 'ignore'];
  const POPUP_OPEN_CLASS = 'js-cell-token--popup-open';

  function getTokenElement(target: HighlightTarget): HTMLElement | null {
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

  function lookupAnchorElement(level: PopupLevel): Element | null {
    const target = level.highlightTarget;
    if (!target) return null;
    const node = target instanceof Range ? target.startContainer : target;
    return node instanceof Element ? node : node.parentElement;
  }

  /** Check if the level's lookup target is inside the subtitle overlay block
   *  or a subtitle panel cue. Media recording (screenshot + sentence audio)
   *  is only allowed for subtitle-origin lookups, not plain web text. */
  function isLookupFromSubtitle(level: PopupLevel): boolean {
    const el = lookupAnchorElement(level);
    return el?.closest('[data-cell-id="subtitle-block"], [data-cue-start]') !== null;
  }

  /** Resolve the cue range a panel lookup was made on. CueList items carry
   *  data-cue-start/data-cue-end so the clicked cue is identified directly
   *  instead of being inferred from video.currentTime — the selected cue is
   *  often not the currently-playing one. */
  function lookupCueRange(level: PopupLevel): CueRange | null {
    const item = lookupAnchorElement(level)?.closest('[data-cue-start][data-cue-end]');
    if (!item) return null;
    const start = Number(item.getAttribute('data-cue-start'));
    const end = Number(item.getAttribute('data-cue-end'));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return { start, end };
  }

  function getTokenById(id: { term: string; start: string; blockId: string }): HTMLElement | null {
    return document.querySelector(
      `[data-cell-term="${CSS.escape(id.term)}"][data-cell-start="${id.start}"][data-cell-block-id="${id.blockId}"]`,
    );
  }

  function setPopupTokenId(level: PopupLevel, token: HTMLElement): void {
    level.popupTokenId = {
      term: token.getAttribute('data-cell-term') ?? '',
      start: token.getAttribute('data-cell-start') ?? '',
      blockId: token.getAttribute('data-cell-block-id') ?? '',
    };
    token.classList.add(POPUP_OPEN_CLASS);
  }

  function clearPopupTokenId(level: PopupLevel): void {
    if (level.popupTokenId) {
      getTokenById(level.popupTokenId)?.classList.remove(POPUP_OPEN_CLASS);
      level.popupTokenId = null;
    }
  }

  function applyTokenStatus(target: HighlightTarget | HTMLElement, status: WordStatus): void {
    const token = target instanceof HTMLElement ? target : getTokenElement(target);
    if (!token) return;
    for (const s of ALL_STATUSES) {
      token.classList.remove(`js-cell-token--status-${s}`);
    }
    token.classList.add(`js-cell-token--status-${status}`);
    if (status === 'known' || status === 'ignore') {
      token.classList.add('js-cell-token--frequency-off');
    } else {
      token.classList.remove('js-cell-token--frequency-off');
    }
  }

  function pauseVideoIfNeeded(): void {
    if (hasVideo && video && !video.paused) {
      video.pause();
      popupDictWasPlaying = true;
    }
  }

  function resumeVideoIfNeeded(): void {
    if (hasVideo && video && popupDictWasPlaying) {
      void video.play();
      popupDictWasPlaying = false;
    }
  }

  function configureVideo(config: WebTextDictionaryVideoConfig): void {
    hasVideo = config.hasVideo;
    video = config.video;
    getTargetCues = config.getTargetCues;
  }

  // Sheet mode (mobile/narrow viewport): the popup is a bottom sheet that
  // stays open across lookups so the user can chain word lookups without the
  // sheet vanishing on each outside tap. Desktop popup dismisses on outside
  // click as before.
  function isSheetMode(): boolean {
    return window.innerWidth < POPUP_SHEET_BREAKPOINT_PX;
  }

  /** Index of the popup level whose shadow host contains the lookup target,
   *  or -1 when the target is page/subtitle text. */
  function levelIndexForTarget(target: HighlightTarget): number {
    const node = target instanceof Range ? target.startContainer : target;
    const root = node.getRootNode();
    if (!(root instanceof ShadowRoot)) return -1;
    const host = root.host;
    if (!(host instanceof HTMLElement) || !host.classList.contains('js-cell-popup-host')) return -1;
    return popupStack.findIndex((level) => level.mount?.host === host);
  }

  /** Outside-click guard for each mount: a pointerdown inside ANY stack host
   *  must not dismiss a sibling level. */
  function isInsideStackHostEvent(e: PointerEvent): boolean {
    return e.composedPath().some(
      (el) => el instanceof HTMLElement && el.classList.contains('js-cell-popup-host'),
    );
  }

  function destroyLevel(level: PopupLevel): void {
    if (level.requestId) {
      cancelLookup(level.requestId);
      level.requestId = null;
    }
    clearPopupTokenId(level);
    level.highlight.clear();
    level.mount?.destroy();
    level.mount = null;
  }

  /** Close level `index` and every deeper level. Resumes the video only once
   *  the whole stack is gone; otherwise focus lands on the exposed parent. */
  function closeFromLevel(index: number): void {
    if (index < 0 || index >= popupStack.length) return;
    while (popupStack.length > index) {
      destroyLevel(popupStack.pop()!);
    }
    if (popupStack.length === 0) {
      resumeVideoIfNeeded();
      popupDictWasPlaying = false;
    } else {
      popupStack[popupStack.length - 1]?.mount?.focus();
    }
  }

  function closePopup(): void {
    cancelPendingDismiss();
    closeFromLevel(0);
  }

  /** Mount a popup for `level`, wiring every popup callback back to that
   *  level so nested lookups / status changes / card actions stay scoped. */
  function mountPopupLevel(level: PopupLevel, options: MountPopupDictionaryOptions): void {
    level.mount = mountPopupDictionary({
      ...options,
      onClose: () => closeFromLevel(popupStack.indexOf(level)),
      onSizeChange: handlePopupSizeChange,
      onSendToCard: (prefill) => handlePopupCardCreatorAction(level, 'edit-card', prefill),
      onQuickAdd: (prefill) => { void handlePopupQuickAdd(level, prefill); },
      onStatusChange: (term, langCode, status) => handlePopupStatusChange(level, term, langCode, status),
      onCandidateChange: (term) => expandHighlightForTerm(level, term),
      onOpenSettings: deps.panelController
        ? () => { closePopup(); void openSettingsSection(deps.panelController!, 'resources'); }
        : undefined,
      dismissOnOutsideClick: !isSheetMode(),
      isInsideOtherHost: isInsideStackHostEvent,
      onOutsidePointerDown: closePopup,
    });
  }

  function handlePopupSizeChange(size: PopupSize, sheetHeight: number): void {
    const sheetHeightVh = Math.round((sheetHeight / window.innerHeight) * 100);
    dpSettings = {
      ...dpSettings,
      popupWidthPx: size.width,
      popupMaxHeightPx: size.maxHeight,
      popupSheetHeightVh: Math.max(20, Math.min(95, sheetHeightVh)),
    };
    void sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: {
        settings: {
          dictionaryPopup: dpSettings,
        },
      },
    });
  }

  function handlePopupStatusChange(level: PopupLevel, term: string, langCode: string, status: WordStatus): void {
    emitWordStatusChanged({ term, langCode, status });
    deps.onStatusChange?.(term, langCode, status);
    const token = level.popupTokenId ? getTokenById(level.popupTokenId) : null;
    if (token) {
      applyTokenStatus(token, status);
      token.classList.add(POPUP_OPEN_CLASS);
    } else if (level.highlightTarget) {
      applyTokenStatus(level.highlightTarget, status);
    }
    const key = cacheKeyFor(term, langCode);
    const cached = lookupCache.get(key);
    if (cached && cached[0].status !== status) {
      lookupCache.set(key, [{ ...cached[0], status }, ...cached.slice(1)]);
    }
  }

  function renderLookupResult(
    level: PopupLevel,
    result: LookupResult,
    additional: readonly LookupResult[],
    anchorRect: DOMRect,
    request: LookupRequest,
    pointer?: WebTriggerPointer,
    isResponseUpdate = false,
  ): void {
    pauseVideoIfNeeded();
    // A new lookup is taking over — cancel any pending delayed dismiss.
    cancelPendingDismiss();
    // Compute line rect from the level's highlight target for line-aware
    // popup positioning ("không che chữ cùng hàng").
    const lineRect: PopupLineRect | null = level.highlightTarget
      ? computeLineRect(level.highlightTarget)
      : null;
    const anchor: PopupAnchor = {
      top: anchorRect.top,
      left: anchorRect.left,
      right: anchorRect.right,
      bottom: anchorRect.bottom + 4,
    };
    const pointerHint = pointer
      ? {
          tip: { x: pointer.x, y: pointer.y },
          badgeCenter: pointer.badgeCenter,
          badgeRadius: pointer.badgeRadius,
          pointerRadius: pointer.pointerRadius,
        }
      : undefined;

    const perLang = dpSettings.defaultActiveTabPerLang?.[result.langCode];
    const defaultTab = perLang !== undefined ? perLang : dpSettings.defaultActiveTab;

    if (level.mount) {
      // Reused level (same-level re-lookup, sheet chain, or the async
      // response for a loading shell): feed the result in without
      // re-mounting and move the popup to the new anchor.
      level.mount.setResult(result, additional);
      level.mount.setOptions({
        sourceLang: result.langCode,
        targetLang: nativeLang || 'vi',
        initialTerm: request.term,
        contextSentence: request.contextSentence,
        cursorOffset: request.cursorOffset,
        defaultActiveTab: defaultTab,
      });
      if (!isResponseUpdate) {
        level.mount.setAnchor(anchor, pointerHint, lineRect);
      }
    } else {
      mountPopupLevel(level, {
        anchor,
        pointer: pointerHint,
        lineRect,
        langCode: result.langCode,
        sourceLang: result.langCode,
        targetLang: nativeLang || 'vi',
        initialTerm: request.term,
        contextSentence: request.contextSentence,
        cursorOffset: request.cursorOffset,
        initialResult: result,
        initialCandidates: additional,
        getTokenStatus: deps.getTokenStatus,
        isLoading: false,
        defaultActiveTab: defaultTab,
        initialSize: { width: dpSettings.popupWidthPx, maxHeight: dpSettings.popupMaxHeightPx },
        initialSheetHeight: Math.round(window.innerHeight * ((dpSettings.popupSheetHeightVh ?? 72) / 100)),
      });
    }

    // Apply token status + popup-open pin to the looked-up token.
    const token = level.highlightTarget ? getTokenElement(level.highlightTarget) : null;
    if (token) {
      setPopupTokenId(level, token);
      applyTokenStatus(token, result.status);
    }

    // Expand highlight if the winner is a phrase (e.g. "pick up" or the
    // detectedPhrase surface "machine learning"). The original highlight covers
    // only the single word the user hovered; this extends it to cover the full
    // matched phrase. Prefer the detected surface when it is a phrase; otherwise
    // fall back to the dictionary term (which may be a multi-word headword).
    const surface = result.detectedPhrase?.surface;
    const phraseTerm = surface && surface.includes(' ') ? surface : result.term;
    expandHighlightForTerm(level, phraseTerm);
    prefetchAdjacentTerms(request);
  }

  function applyLocalStatusFallback(result: LookupResult, term: string): LookupResult {
    if (result.status !== 'unknown') return result;
    const localStatus = deps.getTokenStatus?.(term);
    if (!localStatus || localStatus === 'unknown') return result;
    return { ...result, status: localStatus };
  }

  function handleLookup(
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    highlightTarget: HighlightTarget,
    pointer?: WebTriggerPointer,
  ): void {
    // A new lookup is starting — cancel any pending delayed dismiss so the
    // popup doesn't vanish mid-interaction.
    cancelPendingDismiss();

    // Route the lookup to its level: page/subtitle text → level 1 (index 0),
    // content inside popup level N → level N+1. Deeper levels are pruned; the
    // target level is reused when it exists.
    const sourceIdx = levelIndexForTarget(highlightTarget);
    const targetIdx = isSheetMode() ? 0 : Math.min(sourceIdx + 1, MAX_POPUP_DEPTH - 1);
    if (popupStack.length > targetIdx + 1) closeFromLevel(targetIdx + 1);

    let level = popupStack[targetIdx];
    if (level) {
      if (level.requestId) {
        cancelLookup(level.requestId);
        level.requestId = null;
      }
      clearPopupTokenId(level);
      level.highlight.clear();
    } else {
      level = {
        mount: null,
        requestId: null,
        highlightTarget: null,
        originalHighlightTarget: null,
        highlightAnchor: null,
        popupTokenId: null,
        highlight: createWordHighlight(),
      };
      popupStack.push(level);
    }

    level.highlightTarget = highlightTarget;
    level.originalHighlightTarget = highlightTarget;
    if (highlightTarget instanceof Range && highlightTarget.startContainer instanceof Text) {
      const parent = highlightTarget.startContainer.parentElement;
      level.highlightAnchor = parent
        ? {
            parent,
            wordStart: computeTextOffset(parent, highlightTarget.startContainer, highlightTarget.startOffset),
          }
        : null;
    } else {
      level.highlightAnchor = null;
    }
    level.highlight.show(highlightTarget);

    const token = getTokenElement(highlightTarget);
    if (token) {
      setPopupTokenId(level, token);
      const localStatus = deps.getTokenStatus?.(request.term);
      if (localStatus && localStatus !== 'unknown') {
        applyTokenStatus(token, localStatus);
      }
    }

    const lineRect = computeLineRect(highlightTarget);
    const anchor: PopupAnchor = {
      top: anchorRect.top,
      left: anchorRect.left,
      right: anchorRect.right,
      bottom: anchorRect.bottom + 4,
    };
    const pointerHint = pointer
      ? {
          tip: { x: pointer.x, y: pointer.y },
          badgeCenter: pointer.badgeCenter,
          badgeRadius: pointer.badgeRadius,
          pointerRadius: pointer.pointerRadius,
        }
      : undefined;

    // Fast path: if we already looked this term up, show the popup immediately
    // without paying for a background round-trip. Cache stores the full
    // LookupResult[] so candidates survive repeat lookups (ADR-xxx).
    const cached = getCachedResult(request.term, request.langCode);
    if (cached) {
      const finalWinner = applyLocalStatusFallback(cached[0]!, request.term);
      const finalCached = finalWinner === cached[0] ? cached : [finalWinner, ...cached.slice(1)];
      if (finalCached !== cached) setCachedResult(request.term, request.langCode, finalCached);
      renderLookupResult(level, finalCached[0]!, finalCached.slice(1), anchorRect, request, pointer);
      return;
    }

    // Mount a React loading shell immediately with the term + context so the
    // user gets instant feedback on click/hover. When data arrives,
    // renderLookupResult calls setResult on the same mount.
    if (level.mount) {
      const perLang = dpSettings.defaultActiveTabPerLang?.[request.langCode];
      const defaultTab = perLang !== undefined ? perLang : dpSettings.defaultActiveTab;
      level.mount.setLoading(true);
      level.mount.setOptions({
        sourceLang: request.langCode,
        targetLang: nativeLang || 'vi',
        initialTerm: request.term,
        contextSentence: request.contextSentence,
        cursorOffset: request.cursorOffset,
        defaultActiveTab: defaultTab,
      });
      level.mount.setAnchor(anchor, pointerHint, lineRect);
    } else {
      const perLang = dpSettings.defaultActiveTabPerLang?.[request.langCode];
      const defaultTab = perLang !== undefined ? perLang : dpSettings.defaultActiveTab;
      mountPopupLevel(level, {
        anchor,
        pointer: pointerHint,
        lineRect,
        langCode: request.langCode,
        sourceLang: request.langCode,
        targetLang: nativeLang || 'vi',
        initialTerm: request.term,
        contextSentence: request.contextSentence,
        cursorOffset: request.cursorOffset,
        getTokenStatus: deps.getTokenStatus,
        isLoading: true,
        defaultActiveTab: defaultTab,
        initialSize: { width: dpSettings.popupWidthPx, maxHeight: dpSettings.popupMaxHeightPx },
        initialSheetHeight: Math.round(window.innerHeight * ((dpSettings.popupSheetHeightVh ?? 72) / 100)),
      });
    }

    level.requestId = requestId;

    void Promise.resolve(sendMessage({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: { requestId, request },
    }))
      .then((response: unknown) => {
        // Stale guard: the level was pruned or already re-used for a newer
        // lookup → drop this response entirely.
        const owner = popupStack.find((l) => l.requestId === requestId);
        if (!owner) return;
        owner.requestId = null;
        const { success, data, error } = response as { success: boolean; data?: LookupResult[]; error?: string };
        if (success && data && data.length > 0) {
          const [winner, ...rest] = data;
          const finalWinner = applyLocalStatusFallback(winner!, request.term);
          const finalData = finalWinner === winner ? data : [finalWinner, ...rest];
          setCachedResult(request.term, request.langCode, finalData);
          renderLookupResult(owner, finalWinner, finalWinner === winner ? rest : finalData.slice(1), anchorRect, request, pointer, true);
        } else {
          console.warn('[web-text-dict] lookup failed', error);
        }
      })
      .catch((err) => {
        console.warn('[web-text-dict] lookup error', err);
      });
  }

  function cancelLookup(requestId: string): void {
    void sendMessage({
      type: MESSAGE_TYPES.LOOKUP_CANCEL,
      payload: { requestId },
    });
  }

  function cancelInFlightLookup(): void {
    for (const level of popupStack) {
      if (level.requestId) {
        cancelLookup(level.requestId);
        level.requestId = null;
      }
    }
  }

  function updateCardCreatorSettings(settings: CardCreatorSettings): void {
    ccSettings = settings;
    cardCreatorMount?.updateSettings(settings);
  }

  function openCardCreator(
    context: CardCreatorOpenContext,
    action?: 'quick-add' | 'quick-update' | 'edit-card',
  ): void {
    if (!cardCreatorMount) {
      cardCreatorMount = mountCardCreatorDialog(ccSettings);
    } else {
      cardCreatorMount.updateSettings(ccSettings);
    }
    cardCreatorMount.open(context, action);
  }

  function sendToCard(
    context: CardCreatorOpenContext,
    action?: 'quick-add' | 'quick-update' | 'edit-card',
    selection?: PopupCardCreatorPrefill,
  ): void {
    if (!deps.panelController) {
      openCardCreator(context, action);
      return;
    }

    const hasQueue = (context.queue?.length ?? 0) > 0;
    const sentence = context.prefill?.sentence ?? context.cue?.targetText ?? '';
    const translation =
      context.prefill?.sentenceTranslation ??
      context.cue?.nativeText ??
      selection?.translation ??
      '';
    // When a queue is present, the panel starts with an empty Dictionary state
    // and the user picks a term to look up. No term or definitions are resolved
    // yet, so the integrated Dictionary must not pre-fill a single word.
    const definitionsText = hasQueue
      ? ''
      : (context.prefill?.definitions ?? '');
    const term = hasQueue
      ? undefined
      : (context.prefill?.targetWord ?? context.cue?.targetText ?? '');

    const contextDefinitions: { readonly pos?: string; readonly text: string }[] = definitionsText
      ? definitionsText.split('\n').filter((line) => line.trim()).map((text) => ({ text: text.trim() }))
      : [];
    const definitions = contextDefinitions.length > 0
      ? contextDefinitions
      : (hasQueue ? [] : (selection?.definitions ?? []));

    const rawDefinitions: string[] =
      selection?.rawDefinitions && selection.rawDefinitions.length > 0 && !hasQueue
        ? [...selection.rawDefinitions]
        : definitionsText
          ? definitionsText.split('\n').filter((line) => line.trim())
          : [];

    const wordAudioUrls = context.prefill?.wordAudioUrls?.length
      ? context.prefill.wordAudioUrls
      : (selection?.wordAudioUrls ?? []);
    const hasRecordedAudio = (context.initialMedia ?? []).some((f) => f.kind === 'audio');
    const sentenceAudioUrls = hasRecordedAudio
      ? []
      : context.prefill?.sentenceAudioUrls?.length
        ? context.prefill.sentenceAudioUrls
        : (selection?.sentenceAudioUrls ?? []);
    const imageUrls = context.prefill?.imageUrls?.length
      ? context.prefill.imageUrls
      : (selection?.imageUrls ?? []);

    const prefill: DictionaryPanelPrefill = {
      term,
      langCode: context.sourceLang,
      reading: selection?.reading ?? '',
      definitions,
      rawDefinitions,
      contextSentence: sentence,
      translation,
      wordAudioUrls,
      sentenceAudioUrls,
      imageUrls,
      // Clone the full popup lookup result and loaded media items so the
      // integrated Dictionary can re-render the exact candidate + tabs.
      lookupResult: selection?.lookupResult,
      audioItems: selection?.audioItems,
      imageItems: selection?.imageItems,
      video: context.video,
      cue: context.cue,
      initialMedia: context.initialMedia,
      queue: context.queue,
      initialAction: action,
      // Popup selection snapshot — cloned by the integrated Dictionary.
      selectedImageIds: selection?.selectedImageIds,
      selectedAudioIds: selection?.selectedAudioIds,
      selectedDefinitionIds: selection?.selectedDefinitionIds,
      translationSelected: selection?.translationSelected,
    };

    deps.panelController.sendToCard(prefill).catch((err: unknown) => {
      console.warn('[web-text-dict] sendToCard failed:', err);
    });
  }

  function isCardCreatorOpen(): boolean {
    return (cardCreatorMount?.isOpen() ?? false) || (deps.panelController?.isOpen() ?? false);
  }

  /** Capture screenshot + sentence audio for the cue a subtitle-origin lookup
   *  belongs to. When lookupCue names a cue that is not currently playing
   *  (subtitle panel), the video is first seeked into it and must land with
   *  decodable data — otherwise nothing is captured rather than attaching a
   *  wrong-position screenshot or a different sentence's audio. */
  async function captureCueMedia(
    captureVideo: HTMLVideoElement,
    lookupCue: CueRange | undefined,
    onRecordingStart?: () => void,
  ): Promise<{ screenshot?: MediaFile; audio?: MediaFile; cue?: BilingualCue }> {
    await waitForVideoReady(captureVideo);
    const currentMs = captureVideo.currentTime * 1000;

    if (lookupCue && !(currentMs >= lookupCue.start && currentMs <= lookupCue.end)) {
      const landed = await seekAndWaitReady(captureVideo, lookupCue.start / 1000);
      if (!landed) return {};
    }

    const result: { screenshot?: MediaFile; audio?: MediaFile; cue?: BilingualCue } = {};
    try {
      result.screenshot = await captureScreenshot(captureVideo);
    } catch { /* non-fatal */ }

    const target =
      lookupCue ??
      (() => {
        const cues = getTargetCues?.() ?? [];
        const ms = captureVideo.currentTime * 1000;
        return cues.find((c) => ms >= c.start && ms <= c.end);
      })();

    if (target) {
      result.cue = {
        index: target.index ?? 0,
        start: target.start,
        end: target.end,
        targetText: target.text ?? '',
        nativeText: '',
      };
      onRecordingStart?.();
      try {
        const audioR = await captureSentenceAudio(captureVideo, { start: target.start, end: target.end });
        if (audioR.ok) result.audio = audioR.file;
      } catch { /* non-fatal */ }
    }
    return result;
  }

  async function openStandaloneCardCreator(
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
    fromSubtitle: boolean,
    lookupCue?: CueRange,
  ): Promise<void> {
    const settings = await loadSettingsOrToast(deps.container);
    if (!settings) return;
    updateCardCreatorSettings(settings.cardCreator);

    void prefetchAnkiConnectData(ccSettings.ankiConnectUrl).catch(() => {
      // Prefetch failure is non-fatal — loadData will retry.
    });

    const definitionsText = formatDefinitions(prefill.definitions);

    const sourceLang = settings.subtitleOverlayTargetLanguage || prefill.langCode || 'en';
    const targetLang = settings.subtitleOverlayNativeLanguage || nativeLang || 'vi';

    const captureVideo = video && video.videoWidth > 0 && fromSubtitle ? video : undefined;

    // Open the dialog IMMEDIATELY with whatever data is already available
    // (term, definitions, sentence, translation, media URLs selected in popup).
    // Missing media is fetched in the background and pushed into the open
    // dialog via addMediaFiles / updateTextField — so the user sees the dialog
    // right away instead of waiting for network calls to complete.
    openCardCreator({
      video: captureVideo,
      sourceLang,
      targetLang,
      prefill: {
        targetWord: prefill.term,
        definitions: definitionsText,
        sentenceTranslation: prefill.translation,
        sentence: prefill.contextSentence,
        wordAudioUrls: prefill.wordAudioUrls,
        sentenceAudioUrls: captureVideo ? [] : prefill.sentenceAudioUrls,
        imageUrls: prefill.imageUrls,
      },
    }, action);

    // --- Background media fetch (non-blocking) ---
    // Screenshot + sentence audio (subtitle case only — requires video).
    if (captureVideo) {
      const chip = showProgressToast(t('dict.toast.recording'), deps.container);
      void (async () => {
        let recorded = false;
        try {
          const captured = await captureCueMedia(captureVideo, lookupCue);
          if (captured.screenshot) {
            cardCreatorMount?.addMediaFiles('images', [captured.screenshot]);
          }
          if (captured.audio) {
            cardCreatorMount?.addMediaFiles('sentenceAudios', [captured.audio]);
            recorded = true;
          }
        } catch { /* non-fatal */ }
        chip.dismiss();
        if (recorded) return;
        for (const url of prefill.sentenceAudioUrls ?? []) {
          try {
            const file = await fetchMediaFile(url, 'audio');
            cardCreatorMount?.addMediaFiles('sentenceAudios', [file]);
          } catch { /* non-fatal */ }
        }
        if ((prefill.sentenceAudioUrls ?? []).length === 0 && prefill.contextSentence) {
          try {
            const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
              type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
              payload: { tabId: 0, text: prefill.contextSentence.slice(0, 200), langCode: fromSubtitle ? sourceLang : prefill.langCode },
            });
            if (res?.success && res.data?.url) {
              const file = await fetchMediaFile(res.data.url, 'audio');
              cardCreatorMount?.addMediaFiles('sentenceAudios', [file]);
            }
          } catch { /* non-fatal */ }
        }
      })();
    }

    // Auto-fetch missing media (audio, images, translation) from the popup
    // dictionary's data sources. The popup lazily fetches these when the user
    // opens the Audio/Images/Translate tabs. If the user clicks "Send to Card"
    // without opening those tabs, the media is not yet available — fetch it
    // in the background and push into the open dialog.
    const needsAudio = !prefill.wordAudioUrls?.length;
    const needsImages = !prefill.imageUrls?.length;
    const needsSentenceAudio = !captureVideo && !prefill.sentenceAudioUrls?.length && !!prefill.contextSentence;
    const needsTranslation = !prefill.translation && !!prefill.contextSentence;

    if (needsAudio) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
            type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
            payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, kind: 'word' },
          });
          const items = res?.data?.items ?? [];
          const wordItems = items.filter((a: AudioItem) => a.url && a.kind === 'word').slice(0, 1);
          if (wordItems.length > 0) {
            const file = await fetchMediaFile(wordItems[0].url!, 'audio');
            cardCreatorMount?.addMediaFiles('wordAudios', [file]);
            return;
          }
        } catch { /* non-fatal */ }
        // Fallback: TTS if community audio has no URL.
        try {
          const ttsRes = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
            type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
            payload: { tabId: 0, text: prefill.term, langCode: prefill.langCode },
          });
          if (ttsRes?.success && ttsRes.data?.url) {
            const file = await fetchMediaFile(ttsRes.data.url, 'audio');
            cardCreatorMount?.addMediaFiles('wordAudios', [file]);
          }
        } catch { /* non-fatal */ }
      })();
    }

    if (needsImages) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<FetchImagesResponse>>({
            type: MESSAGE_TYPES.FETCH_IMAGES,
            payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, maxResults: 8 },
          });
          const items = res?.data?.items ?? [];
          if (items.length > 0) {
            const file = await fetchMediaFile(items[0].src, 'image');
            cardCreatorMount?.addMediaFiles('images', [file]);
          }
        } catch { /* non-fatal */ }
      })();
    }

    if (needsSentenceAudio) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
            type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
            payload: { tabId: 0, text: prefill.contextSentence!.slice(0, 200), langCode: fromSubtitle ? sourceLang : prefill.langCode },
          });
          if (res?.success && res.data?.url) {
            const file = await fetchMediaFile(res.data.url, 'audio');
            cardCreatorMount?.addMediaFiles('sentenceAudios', [file]);
          }
        } catch { /* non-fatal */ }
      })();
    }

    if (needsTranslation) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<{ translated: string[] }>>({
            type: MESSAGE_TYPES.TRANSLATE,
            payload: { tabId: 0, text: prefill.contextSentence, sl: sourceLang, tl: targetLang },
          });
          if (res?.success && res.data?.translated?.length) {
            cardCreatorMount?.updateTextField('sentenceTranslation', res.data.translated.join(' '));
          }
        } catch { /* non-fatal */ }
      })();
    }
  }

  /** Collect audio/image URLs + captured subtitle media (screenshot + sentence audio)
   *  for a popup Card Creator / Quick Add action. Reused by both the integrated
   *  panel and standalone dialog paths so neither path forgets the recording.
   *  URL fetches run in parallel with the video capture; a recorded cue clip
   *  wins over TTS sentence audio. */
  async function collectCardCreatorMedia(
    prefill: PopupCardCreatorPrefill,
    sourceLang: string,
    fromSubtitle: boolean,
    warnings?: string[],
    onRecordingStart?: () => void,
    lookupCue?: CueRange,
  ): Promise<{
    wordAudioUrls: readonly string[];
    sentenceAudioUrls: readonly string[];
    imageUrls: readonly string[];
    initialMedia: MediaFile[];
    cue?: BilingualCue;
  }> {
    const initialMedia: MediaFile[] = [];
    let cue: BilingualCue | undefined;
    let wordAudioUrls = prefill.wordAudioUrls ?? [];
    let imageUrls = prefill.imageUrls ?? [];
    let ttsSentenceUrls: readonly string[] = [];

    const captureTask = (async (): Promise<void> => {
      if (video && video.videoWidth > 0 && fromSubtitle) {
        try {
          const captured = await captureCueMedia(video, lookupCue, onRecordingStart);
          if (captured.screenshot) {
            initialMedia.push(captured.screenshot);
          } else {
            warnings?.push('screenshot');
          }
          if (captured.cue) {
            cue = {
              ...captured.cue,
              targetText: captured.cue.targetText || prefill.contextSentence || '',
            };
          }
          if (captured.audio) {
            initialMedia.push(captured.audio);
          } else if (captured.cue) {
            warnings?.push('sentence audio capture');
          }
        } catch { warnings?.push('sentence audio capture'); }
      }
    })();

    const fetchTask = (async (): Promise<void> => {
      const needsWordAudio = wordAudioUrls.length === 0;
      const needsImages = imageUrls.length === 0;
      const wantsSentenceTts = (prefill.sentenceAudioUrls ?? []).length === 0 && !!prefill.contextSentence;
      if (!needsWordAudio && !needsImages && !wantsSentenceTts) return;

      const tasks: Promise<void>[] = [];

      if (needsWordAudio) {
        tasks.push((async (): Promise<void> => {
          try {
            const res = await sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
              type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
              payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, kind: 'word' },
            });
            const items = res?.data?.items ?? [];
            const wordItems = items.filter((a: AudioItem) => a.url && a.kind === 'word').slice(0, 1);
            if (wordItems.length > 0) {
              wordAudioUrls = wordItems.map((a: AudioItem) => a.url!);
            }
          } catch { /* non-fatal */ }
          if (!wordAudioUrls.length) {
            try {
              const ttsRes = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
                type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
                payload: { tabId: 0, text: prefill.term, langCode: prefill.langCode },
              });
              if (ttsRes?.success && ttsRes.data?.url) {
                wordAudioUrls = [ttsRes.data.url];
              }
            } catch { /* non-fatal */ }
          }
        })());
      }

      if (needsImages) {
        tasks.push((async (): Promise<void> => {
          try {
            const res = await sendMessage<MessageResponse<FetchImagesResponse>>({
              type: MESSAGE_TYPES.FETCH_IMAGES,
              payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, maxResults: 8 },
            });
            const items = res?.data?.items ?? [];
            if (items.length > 0) {
              imageUrls = items.slice(0, 1).map((img: ImageItem) => img.src);
            }
          } catch { /* non-fatal */ }
        })());
      }

      if (wantsSentenceTts) {
        tasks.push((async (): Promise<void> => {
          try {
            const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
              type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
              payload: { tabId: 0, text: prefill.contextSentence!.slice(0, 200), langCode: fromSubtitle ? sourceLang : prefill.langCode },
            });
            if (res?.success && res.data?.url) {
              ttsSentenceUrls = [res.data.url];
            }
          } catch { /* non-fatal */ }
        })());
      }

      await Promise.all(tasks);
    })();

    await Promise.all([captureTask, fetchTask]);

    const hasRecordedAudio = initialMedia.some((f) => f.kind === 'audio');
    const sentenceAudioUrls = hasRecordedAudio
      ? []
      : (prefill.sentenceAudioUrls?.length ? prefill.sentenceAudioUrls : ttsSentenceUrls);

    return { wordAudioUrls, sentenceAudioUrls, imageUrls, initialMedia, cue };
  }

  function handlePopupCardCreatorAction(
    level: PopupLevel,
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
  ): OnCardCreatorActionResult {
    // Capture subtitle context BEFORE returning — closePopup clears the
    // level's highlightTarget synchronously after this function returns.
    const fromSubtitle = isLookupFromSubtitle(level);
    const lookupCue = lookupCueRange(level) ?? undefined;
    closePopup();

    if (deps.panelController) {
      // ADR-065: route to the integrated universal panel. Media is collected
      // asynchronously so the panel opens with screenshot/audio/image while
      // the progress chip reports the recording state over the video.
      const chip = showProgressToast(t('dict.toast.preparingCard'), deps.container);
      void (async (): Promise<void> => {
        try {
          const settings = await loadSettingsOrToast(deps.container);
          if (!settings) {
            chip.dismiss();
            return;
          }

          const sourceLang = settings.subtitleOverlayTargetLanguage || prefill.langCode || 'en';
          const targetLang = settings.subtitleOverlayNativeLanguage || nativeLang || 'vi';
          const translationTask = (async (): Promise<string | undefined> => {
            if (prefill.translation || !prefill.contextSentence) return prefill.translation;
            try {
              const res = await sendMessage<MessageResponse<{ translated: string[] }>>({
                type: MESSAGE_TYPES.TRANSLATE,
                payload: { tabId: 0, text: prefill.contextSentence, sl: sourceLang, tl: targetLang },
              });
              if (res?.success && res.data?.translated?.length) {
                return res.data.translated.join(' ');
              }
            } catch { /* non-fatal */ }
            return undefined;
          })();
          const media = await collectCardCreatorMedia(prefill, sourceLang, fromSubtitle, undefined, () => {
            chip.update(t('dict.toast.recording'));
          }, lookupCue);
          const sentenceTranslation = prefill.translation ?? (await translationTask);

          // Build a lazy queue from the subtitle cue / context sentence. The
          // queue is shown first; the user selects a term before any lookup.
          const queueText = fromSubtitle
            ? (lookupCue?.text ?? media.cue?.targetText ?? prefill.contextSentence)
            : prefill.contextSentence;
          const queue = queueText ? await buildSubtitleQueue(queueText, sourceLang) : [];

          const context: CardCreatorOpenContext = {
            video: video && video.videoWidth > 0 && fromSubtitle ? video : undefined,
            sourceLang,
            targetLang,
            cue: media.cue,
            initialMedia: media.initialMedia,
            prefill: {
              targetWord: prefill.term,
              definitions: formatDefinitions(prefill.definitions),
              sentence: prefill.contextSentence,
              sentenceTranslation,
              wordAudioUrls: media.wordAudioUrls,
              sentenceAudioUrls: media.sentenceAudioUrls,
              imageUrls: media.imageUrls,
            },
            queue,
          };

          sendToCard(context, action, prefill);
          chip.dismiss();
        } catch (err: unknown) {
          console.warn('[web-text-dict] sendToCard failed:', err);
          chip.finish(t('dict.toast.sendToCardFailed', [err instanceof Error ? err.message : String(err)]), 'error');
        }
      })();
      return { stayOpen: false };
    }

    // Standalone Card Creator dialog fallback — open the dialog in the background.
    void openStandaloneCardCreator(action, prefill, fromSubtitle, lookupCue);
    return { stayOpen: false };
  }

  function handlePopupQuickAdd(level: PopupLevel, prefill: PopupCardCreatorPrefill): void {
    const destination = deps.dictionaryPopupSettings.srsDestination ?? 'anki';
    if (destination === 'ocean-srs') {
      void handlePopupAddToSrs(prefill);
      return;
    }
    // Anki Quick Add now routes through the same queue + Dictionary flow so the
    // user can pick one term before it is added.
    handlePopupCardCreatorAction(level, 'quick-add', prefill);
  }



  async function handlePopupAddToSrs(prefill: PopupCardCreatorPrefill): Promise<void> {
    closePopup();
    showToast(t('dict.toast.srsAdding'), deps.container, { variant: 'info' });
    try {
      await addToOceanSrs(prefill);
      showToast(t('dict.toast.srsAdded'), deps.container, { variant: 'success' });
      await openSrsStudyPage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(t('dict.toast.srsFailed', [msg]), deps.container, { variant: 'error' });
    }
  }

  function attach(mode: TriggerMode): void {
    if (currentAttachedMode === mode) return;
    detach();
    currentAttachedMode = mode;
    webTrigger = new WebTriggerController({
      triggerMode: mode,
      onLookup: (request, requestId, anchorRect, range, pointer) => {
        void handleLookup(request, requestId, anchorRect, range, pointer);
      },
      onCancel: (requestId) => { cancelLookup(requestId); },
      // Auto-dismiss on hover-leave removed: popup only closes on explicit
      // user action (click outside / Esc / close button).
    });
    webTrigger.attach();
  }

  function detach(): void {
    // Detach is intentional teardown (mode switch, settings update) — cancel
    // any pending delayed dismiss and in-flight lookup so they don't fire
    // after re-attach.
    cancelPendingDismiss();
    cancelInFlightLookup();
    webTrigger?.detach();
    webTrigger = null;
    currentAttachedMode = null;
    orbitalBadge?.destroy();
    orbitalBadge = null;
    orbitalHoverTrigger?.detach();
    orbitalHoverTrigger = null;
  }

  function destroy(): void {
    detach();
    cancelPendingDismiss();
    document.removeEventListener('keydown', onStackKeydown);
    document.removeEventListener('pointerdown', onStackPointerDown, true);
    for (const level of popupStack) level.highlight.destroy();
    closePopup();
    cardCreatorMount?.unmount();
    cardCreatorMount = null;
    if (orbitalFullscreenListener) {
      document.removeEventListener('fullscreenchange', orbitalFullscreenListener);
      document.removeEventListener('webkitfullscreenchange', orbitalFullscreenListener);
      orbitalFullscreenListener = null;
    }
    apiHighlight.destroy();
    lookupCache.clear();
  }

  function persistBadgePointerPreset(preset: PointerPreset): void {
    dpSettings = { ...dpSettings, badgePointerTrigger: { ...dpSettings.badgePointerTrigger, position: preset } };
    void sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { dictionaryPopup: dpSettings } },
    });
  }

  function syncOrbitalBadge(dp: DictionaryPopupSettings): void {
    if (!dp.enabled) {
      orbitalBadge?.destroy();
      orbitalBadge = null;
      orbitalBadgeSize = null;
      orbitalBadgeScale = null;
      orbitalHoverTrigger?.detach();
      orbitalHoverTrigger = null;
      return;
    }
    // Install the fullscreen transition listener once (child frames only) so
    // the badge mounts when entering native fullscreen and tears down on exit.
    // Must be installed before the child-fullscreen gate below, otherwise the
    // early return in normal mode would leave the child unable to react to
    // fullscreen transitions.
    if (isChildFrame() && !orbitalFullscreenListener) {
      const onFs = (): void => { syncOrbitalBadge(dpSettings); };
      orbitalFullscreenListener = onFs;
      document.addEventListener('fullscreenchange', onFs);
      document.addEventListener('webkitfullscreenchange', onFs);
    }
    // Child iframe: the orbital badge is only useful while this child document
    // is in native fullscreen. In normal mode the top-frame badge covers the
    // viewport, so mounting a second badge here would duplicate it (the
    // original 2-badge bug). Mount on fullscreen enter, tear down on exit.
    if (isChildFrame() && !document.fullscreenElement) {
      orbitalBadge?.destroy();
      orbitalBadge = null;
      orbitalBadgeSize = null;
      orbitalBadgeScale = null;
      orbitalHoverTrigger?.detach();
      orbitalHoverTrigger = null;
      return;
    }
    const trigger = dp.badgePointerTrigger;
    // Orbital badge is always mounted when the dictionary popup is enabled
    // (no longer conditional on triggerMode === 'orbital'). The hover trigger
    // handles pointer-tip lookups regardless of the page-level trigger mode.
    if (!orbitalHoverTrigger) {
      orbitalHoverTrigger = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: (request, requestId, anchorRect, range, pointer) => {
          void handleLookup(request, requestId, anchorRect, range, pointer);
        },
        onCancel: (requestId) => { cancelLookup(requestId); },
      });
    }
    const sameDimensions = orbitalBadgeSize === trigger.size && orbitalBadgeScale === trigger.pointerScale;
    console.log('[DEBUG syncOrbitalBadge]', { enabled: dp.enabled, hasBadge: !!orbitalBadge, sameDimensions, size: trigger.size, scale: trigger.pointerScale });
    if (orbitalBadge && sameDimensions) {
      orbitalBadge.setPreset(trigger.position);
    } else {
      console.log('[DEBUG syncOrbitalBadge] destroying + re-mounting badge');
      orbitalBadge?.destroy();
      orbitalBadge = mountOrbitalBadge({
        badgeSize: trigger.size,
        pointerScale: trigger.pointerScale,
        initialPreset: trigger.position,
        onPresetChange: (preset: PointerPreset) => { persistBadgePointerPreset(preset); },
        onTipReady: (tip, _preset, badgeCenter) => { orbitalHoverTrigger?.processPoint(tip.x, tip.y, badgeCenter, trigger.size / 2, (trigger.size * (trigger.pointerScale ?? 0.25)) / 2); },
        panelController: deps.panelController,
      });
      orbitalBadgeSize = trigger.size;
      orbitalBadgeScale = trigger.pointerScale;
      // ADR-065: the generic `panelController` is toggled by the badge and
      // manages its own subscription lifecycle.
    }
  }

  function updateSettings(settings: {
    dictionaryPopup: DictionaryPopupSettings;
    cardCreator: CardCreatorSettings;
    subtitleOverlayNativeLanguage?: string;
  }): void {
    dpSettings = settings.dictionaryPopup;
    ccSettings = settings.cardCreator;
    nativeLang = settings.subtitleOverlayNativeLanguage ?? nativeLang;
    cardCreatorMount?.updateSettings(ccSettings);
    for (const level of popupStack) {
      level.mount?.setOptions({
        targetLang: nativeLang,
        initialSize: { width: dpSettings.popupWidthPx, maxHeight: dpSettings.popupMaxHeightPx },
        initialSheetHeight: Math.round(window.innerHeight * ((dpSettings.popupSheetHeightVh ?? 72) / 100)),
      });
    }
    if (dpSettings.enabled) {
      attach(dpSettings.triggerMode);
    } else {
      detach();
    }
    syncOrbitalBadge(dpSettings);
  }

  function syncStatus(term: string, status: WordStatus): void {
    for (const level of popupStack) {
      level.mount?.setStatus(term, status);
    }
  }

  // Stack-level keyboard/pointer routing. The per-popup Surface already owns
  // Escape when focus is inside it (and stops propagation); this document
  // listener covers Escape with focus outside the popup — it closes the top
  // level only, so repeated Escape walks the stack down level by level.
  const onStackKeydown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || popupStack.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    closeFromLevel(popupStack.length - 1);
  };

  // A pointerdown inside an ancestor level's host closes every deeper level
  // and lands focus on that ancestor; the surviving level stays interactive.
  const onStackPointerDown = (e: PointerEvent): void => {
    if (popupStack.length < 2) return;
    const path = e.composedPath();
    const idx = popupStack.findIndex(
      (level) => level.mount !== null && path.includes(level.mount.host),
    );
    if (idx < 0 || idx >= popupStack.length - 1) return;
    closeFromLevel(idx + 1);
  };

  document.addEventListener('keydown', onStackKeydown);
  document.addEventListener('pointerdown', onStackPointerDown, true);

  return {
    attach,
    detach,
    updateSettings,
    configureVideo,
    destroy,
    handleLookup,
    cancelLookup,
    dismissLookup,
    showHighlight,
    clearHighlight,
    syncStatus,
    updateCardCreatorSettings,
    openCardCreator,
    sendToCard,
    isCardCreatorOpen,
  };
}
