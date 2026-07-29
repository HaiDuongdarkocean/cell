// webTextDictionaryController — spec §2: top-level popup + lookup + highlight wiring.
//
// Manages the dictionary popup lifecycle independently of video presence.
// - Lives in content-script top-level and inside subtitle overlay controller.
// - Owns one WebTriggerController for web-text (document-level hover/click).
// - Receives SubtitleTriggerController callbacks for subtitle token lookup.
// - Owns WordHighlight to mark the target word/token and its sentence.
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
} from '../types';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import type { BilingualCue } from '@/entities/media';
import type { PopupLineRect } from '../ui/popupGeometry';
import type { PopupAnchor, PopupSize } from '../ui/usePopupPosition';
import {
  mountPopupDictionary,
  type PopupDictionaryMountController,
  type MountPopupDictionaryOptions,
} from '../ui/mountPopupDictionary';
import { WebTriggerController, type WebTriggerPointer } from '@/features/dictionaryPopup/trigger/webTriggerController';
import {
  extractSentenceContext,
  extractWordAtOffset,
  createSentenceRange,
  WORD_CHAR_RE,
} from '@/features/dictionaryPopup/sentence/sentenceModule';
import { nextRequestId } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import { createWordHighlight, createSentenceHighlight, type HighlightTarget } from '@/features/dictionaryPopup/ui/wordHighlight';
import { type PointerPreset } from '@/features/dictionaryPopup/badgePointer/pointerPosition';
import { mountOrbitalBadge, type OrbitalBadgeMountController } from '@/features/dictionaryPopup/ui/mountOrbitalBadge';

import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message/types';

import type { UniversalPanelMountController, DictionaryPanelPrefill } from '@/features/universalPanel';
import { mountCardCreatorDialog, type CardCreatorMountController, type CardCreatorOpenContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';
import { quickAddNote } from '@/features/cardCreator/service/quickAddNote';
import { fetchMediaFile, type MediaFile } from '@/features/cardCreator/media/mediaFile';
import { DraftAutosaver } from '@/features/cardCreator/state/cardDraft';
import { loadSettingsOrToast } from '@/features/subtitle/ui/subtitleControllerHelpers';
import { showToast } from '@/features/subtitle/ui/subtitleUI';

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
  readonly panelController?: UniversalPanelMountController;
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
   *  Falls back to the standalone dialog when no panel controller is available. */
  readonly sendToCard: (context: CardCreatorOpenContext, action?: 'quick-add' | 'quick-update' | 'edit-card') => void;
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

  // Web text: pick the visual line box closest to the word center.
  const wordRect = typeof target.getBoundingClientRect === 'function'
    ? target.getBoundingClientRect()
    : null;
  if (!wordRect) return null;
  const anchorCenterY = (wordRect.top + wordRect.bottom) / 2;

  let el: HTMLElement | null =
    target.startContainer.nodeType === Node.ELEMENT_NODE
      ? (target.startContainer as HTMLElement)
      : target.startContainer.parentElement;
  while (el && !isBlockContainer(el)) el = el.parentElement;
  if (!el) {
    return { top: wordRect.top, left: wordRect.left, right: wordRect.right, bottom: wordRect.bottom };
  }

  const blockRange = document.createRange();
  blockRange.selectNodeContents(el);
  const rects = typeof blockRange.getClientRects === 'function' ? blockRange.getClientRects() : [];
  if (rects.length === 0) {
    return { top: wordRect.top, left: wordRect.left, right: wordRect.right, bottom: wordRect.bottom };
  }

  let best = rects[0];
  let bestDist = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const rc = rects[i];
    const dist = Math.abs((rc.top + rc.bottom) / 2 - anchorCenterY);
    if (dist < bestDist) { bestDist = dist; best = rc; }
  }
  return { top: best.top, left: best.left, right: best.right, bottom: best.bottom };
}

function isBlockContainer(el: HTMLElement): boolean {
  const display = getComputedStyle(el).display;
  if (display === 'block' || display === 'list-item' || display === 'table-cell') return true;
  return ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TD'].includes(el.tagName);
}

const BULLET_PREFIX_RE = /^(?:\s*•\s*)+/;

/** Format selected definitions for Card Creator / Quick Add:
 *  - Each definition: `• {pos} {text}` (or `• {text}` if no pos)
 *  - Definitions separated by exactly one blank line (\n\n)
 *  Respects user selection — only checked definitions are included.
 *  Strips any leading `•` characters already present in the source text so
 *  the output always has exactly one bullet. */
export function formatDefinitions(defs: readonly { readonly pos?: string; readonly text: string }[]): string {
  return defs
    .map((d) => {
      const text = d.text.replace(BULLET_PREFIX_RE, '');
      return `• ${d.pos ? `${d.pos} ` : ''}${text}`.trim();
    })
    .join('\n\n')
    .trim();
}

export function createWebTextDictionaryController(deps: WebTextDictionaryControllerDeps): WebTextDictionaryController {
  let dpSettings = deps.dictionaryPopupSettings;
  let ccSettings = deps.cardCreatorSettings;
  let nativeLang = deps.nativeLanguage ?? '';

  // Mutable video/cue config — late-bound by subtitle overlay controller.
  let hasVideo = deps.hasVideo;
  let video: HTMLVideoElement | undefined = deps.video;
  let getTargetCues: (() => readonly CueRange[]) | undefined = deps.getTargetCues;

  let popupMount: PopupDictionaryMountController | null = null;
  let popupDictWasPlaying = false;
  const wordHighlight = createWordHighlight();
  const sentenceHighlight = createSentenceHighlight();

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
  let cardCreatorMount: CardCreatorMountController | null = null;
  let currentHighlightTarget: HighlightTarget | null = null;
  /** Original highlight target from the trigger (single word). Stored so we
   *  can restore it when switching from a phrase candidate back to a single
   *  word candidate. */
  let originalHighlightTarget: HighlightTarget | null = null;
  let currentPopupTokenId: { term: string; start: string; blockId: string } | null = null;
  let currentRequestId: string | null = null;
  let popupDismissTimer: ReturnType<typeof setTimeout> | null = null;

  function showHighlight(target: HighlightTarget): void {
    wordHighlight.show(target);
  }

  function clearHighlight(): void {
    wordHighlight.clear();
    sentenceHighlight.clear();
  }

  /** Expand or restore the word highlight to match the given term.
   *  - Single word (no spaces): restore the original highlight target (the
   *    single word the user hovered/clicked).
   *  - Phrase (contains spaces): create a new Range covering the full phrase
   *    in the DOM. For web text, search the text node for the phrase starting
   *    from the original word's position. For subtitle tokens, find adjacent
   *    .js-cell-token spans that together form the phrase.
   *  Called after renderLookupResult (winner) and on candidate switch. */
  function expandHighlightForTerm(term: string): void {
    if (!originalHighlightTarget) return;
    const isPhrase = term.includes(' ');
    if (!isPhrase) {
      // Single word — restore original highlight.
      currentHighlightTarget = originalHighlightTarget;
      wordHighlight.show(originalHighlightTarget);
      return;
    }
    // Phrase — try to create a Range covering the full phrase.
    const phraseRange = createPhraseRange(originalHighlightTarget, term);
    if (phraseRange) {
      currentHighlightTarget = phraseRange;
      wordHighlight.show(phraseRange);
    } else {
      // Fallback: keep original single-word highlight.
      currentHighlightTarget = originalHighlightTarget;
      wordHighlight.show(originalHighlightTarget);
    }
  }

  /** Create a DOM Range covering the given phrase term, starting from the
   *  original highlight target (single word). Returns null if the phrase
   *  cannot be found in the DOM near the original word. */
  function createPhraseRange(original: HighlightTarget, phrase: string): Range | null {
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

  /** Subtitle token path: the original target is a .js-cell-token span (one
   *  word). Find adjacent .js-cell-token spans that together form the phrase. */
  function createPhraseRangeFromToken(token: HTMLElement, phrase: string): Range | null {
    const line = token.closest('.subtitle-line');
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

  /** Check if the current lookup target is inside a subtitle-line element.
   *  Media recording (screenshot + sentence audio) is only allowed when the
   *  user looked up a word inside the subtitle overlay, not from web text. */
  function isLookupFromSubtitle(): boolean {
    const target = currentHighlightTarget;
    if (!target) return false;
    const token = getTokenElement(target);
    if (!token) return false;
    return token.closest('.subtitle-line') !== null;
  }

  function getTokenById(id: { term: string; start: string; blockId: string }): HTMLElement | null {
    return document.querySelector(
      `[data-cell-term="${CSS.escape(id.term)}"][data-cell-start="${id.start}"][data-cell-block-id="${id.blockId}"]`,
    );
  }

  function setPopupTokenId(token: HTMLElement): void {
    currentPopupTokenId = {
      term: token.getAttribute('data-cell-term') ?? '',
      start: token.getAttribute('data-cell-start') ?? '',
      blockId: token.getAttribute('data-cell-block-id') ?? '',
    };
    token.classList.add(POPUP_OPEN_CLASS);
  }

  function clearPopupTokenId(): void {
    if (currentPopupTokenId) {
      getTokenById(currentPopupTokenId)?.classList.remove(POPUP_OPEN_CLASS);
      currentPopupTokenId = null;
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

  function onPopupDismiss(): void {
    // User intentionally dismissed (Esc / click outside / close button) —
    // mountPopupDictionary has already unmounted the React tree by the time
    // this callback runs, so we only clear local references.
    cancelPendingDismiss();
    cancelInFlightLookup();
    popupMount = null;
    clearPopupTokenId();
    currentHighlightTarget = null;
    originalHighlightTarget = null;
    wordHighlight.clear();
    sentenceHighlight.clear();
    resumeVideoIfNeeded();
    popupDictWasPlaying = false;
  }

  function closePopup(): void {
    popupMount?.destroy();
    popupMount = null;
    clearPopupTokenId();
    currentHighlightTarget = null;
    originalHighlightTarget = null;
    wordHighlight.clear();
    sentenceHighlight.clear();
    resumeVideoIfNeeded();
    popupDictWasPlaying = false;
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

  function handlePopupStatusChange(term: string, langCode: string, status: WordStatus): void {
    deps.onStatusChange?.(term, langCode, status);
    const token = currentPopupTokenId ? getTokenById(currentPopupTokenId) : null;
    if (token) {
      applyTokenStatus(token, status);
      token.classList.add(POPUP_OPEN_CLASS);
    } else if (currentHighlightTarget) {
      applyTokenStatus(currentHighlightTarget, status);
    }
    const key = cacheKeyFor(term, langCode);
    const cached = lookupCache.get(key);
    if (cached && cached[0].status !== status) {
      lookupCache.set(key, [{ ...cached[0], status }, ...cached.slice(1)]);
    }
  }

  function renderLookupResult(
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
    // Compute line rect from the current highlight target for line-aware
    // popup positioning ("không che chữ cùng hàng").
    const lineRect: PopupLineRect | null = currentHighlightTarget
      ? computeLineRect(currentHighlightTarget)
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

    if (popupMount && !isResponseUpdate) {
      // A fresh lookup (cache hit or new term) should re-anchor at the new
      // target. The React mount is positioned on initial mount, so we destroy
      // the old host and create a new one below.
      popupMount.destroy();
      popupMount = null;
    }

    const perLang = dpSettings.defaultActiveTabPerLang?.[result.langCode];
    const defaultTab = perLang !== undefined ? perLang : dpSettings.defaultActiveTab;

    if (popupMount) {
      // Cache-miss response arriving for the same mounted loading popup:
      // feed the result in without destroying.
      popupMount.setResult(result, additional);
      popupMount.setOptions({
        sourceLang: result.langCode,
        targetLang: nativeLang || 'vi',
      });
    } else {
      const options: MountPopupDictionaryOptions = {
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
        onClose: onPopupDismiss,
        onSizeChange: handlePopupSizeChange,
        onSendToCard: (prefill) => handlePopupCardCreatorAction('edit-card', prefill),
        onQuickAdd: (prefill) => { void handlePopupQuickAdd(prefill); },
        onStatusChange: handlePopupStatusChange,
        onCandidateChange: expandHighlightForTerm,
      };
      popupMount = mountPopupDictionary(options);
    }

    // Apply token status + popup-open pin to the looked-up token.
    const token = currentHighlightTarget ? getTokenElement(currentHighlightTarget) : null;
    if (token) {
      setPopupTokenId(token);
      applyTokenStatus(token, result.status);
    }

    // Expand highlight if the winner is a phrase (e.g. "pick up"). The
    // original highlight covers only the single word the user hovered;
    // this extends it to cover the full matched phrase.
    expandHighlightForTerm(result.term);
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
    // A new lookup is starting — cancel any pending delayed dismiss and any
    // in-flight lookup so the popup doesn't vanish and the background doesn't
    // waste work on a stale request.
    cancelPendingDismiss();
    cancelInFlightLookup();
    currentRequestId = requestId;
    currentHighlightTarget = highlightTarget;
    originalHighlightTarget = highlightTarget;
    wordHighlight.show(highlightTarget);

    // Show the sentence containing the looked-up word. For web text the
    // highlight target is a Range anchored in a Text node. For tokenized page
    // text the range may be anchored in the token's word element, so we find
    // the first Text child. Subtitle element targets have no page DOM sentence
    // to highlight and are skipped.
    let sentenceTextNode: Text | null = null;
    let sentenceTextOffset = 0;
    if (highlightTarget instanceof Range) {
      if (highlightTarget.startContainer instanceof Text) {
        sentenceTextNode = highlightTarget.startContainer;
        sentenceTextOffset = highlightTarget.startOffset;
      } else {
        const child = highlightTarget.startContainer.childNodes[highlightTarget.startOffset];
        if (child?.firstChild instanceof Text) {
          sentenceTextNode = child.firstChild;
          sentenceTextOffset = 0;
        }
      }
    }
    if (sentenceTextNode) {
      const ctx = extractSentenceContext(sentenceTextNode, sentenceTextOffset);
      if (ctx) {
        const sentenceRange = createSentenceRange(sentenceTextNode, sentenceTextOffset, ctx);
        if (sentenceRange) {
          sentenceHighlight.show(sentenceRange);
        } else {
          sentenceHighlight.clear();
        }
      } else {
        sentenceHighlight.clear();
      }
    } else {
      sentenceHighlight.clear();
    }

    const token = getTokenElement(highlightTarget);
    if (token) {
      setPopupTokenId(token);
    }

    // Fast path: if we already looked this term up, show the popup immediately
    // without paying for a background round-trip. Cache stores the full
    // LookupResult[] so candidates survive repeat lookups (ADR-xxx).
    const cached = getCachedResult(request.term, request.langCode);
    if (cached) {
      const finalWinner = applyLocalStatusFallback(cached[0]!, request.term);
      const finalCached = finalWinner === cached[0] ? cached : [finalWinner, ...cached.slice(1)];
      if (finalCached !== cached) setCachedResult(request.term, request.langCode, finalCached);
      renderLookupResult(finalCached[0]!, finalCached.slice(1), anchorRect, request, pointer);
      return;
    }

    // Mount a React loading shell immediately with the term + context so the
    // user gets instant feedback on click/hover. When data arrives,
    // renderLookupResult calls setResult on the same mount.
    const lineRect: PopupLineRect | null = currentHighlightTarget
      ? computeLineRect(currentHighlightTarget)
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

    if (popupMount) {
      popupMount.destroy();
      popupMount = null;
    }

    const perLang = dpSettings.defaultActiveTabPerLang?.[request.langCode];
    const defaultTab = perLang !== undefined ? perLang : dpSettings.defaultActiveTab;
    const options: MountPopupDictionaryOptions = {
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
      onClose: onPopupDismiss,
      onSizeChange: handlePopupSizeChange,
      onSendToCard: (prefill) => handlePopupCardCreatorAction('edit-card', prefill),
      onQuickAdd: (prefill) => { void handlePopupQuickAdd(prefill); },
      onStatusChange: handlePopupStatusChange,
      onCandidateChange: expandHighlightForTerm,
    };
    popupMount = mountPopupDictionary(options);

    const lookupToken = getTokenElement(highlightTarget);
    if (lookupToken) {
      setPopupTokenId(lookupToken);
      const localStatus = deps.getTokenStatus?.(request.term);
      if (localStatus && localStatus !== 'unknown') {
        applyTokenStatus(lookupToken, localStatus);
      }
    }

    void Promise.resolve(sendMessage({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: { requestId, request },
    }))
      .then((response: unknown) => {
        // If the user already moved away and dismissed the popup, ignore stale result.
        if (currentRequestId !== requestId) return;
        const { success, data, error } = response as { success: boolean; data?: LookupResult[]; error?: string };
        if (success && data && data.length > 0) {
          const [winner, ...rest] = data;
          const finalWinner = applyLocalStatusFallback(winner!, request.term);
          const finalData = finalWinner === winner ? data : [finalWinner, ...rest];
          setCachedResult(request.term, request.langCode, finalData);
          renderLookupResult(finalWinner, finalWinner === winner ? rest : finalData.slice(1), anchorRect, request, pointer, true);
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
    if (!currentRequestId) return;
    cancelLookup(currentRequestId);
    currentRequestId = null;
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
      cardCreatorMount = mountCardCreatorDialog(ccSettings, deps.container);
    } else {
      cardCreatorMount.updateSettings(ccSettings);
    }
    cardCreatorMount.open(context, action);
  }

  function sendToCard(
    context: CardCreatorOpenContext,
    action?: 'quick-add' | 'quick-update' | 'edit-card',
  ): void {
    if (!deps.panelController) {
      openCardCreator(context, action);
      return;
    }

    const firstQueueItem = context.queue?.[0];
    const sentence = context.prefill?.sentence ?? context.cue?.targetText ?? '';
    const translation = context.prefill?.sentenceTranslation ?? context.cue?.nativeText ?? '';
    const definitionsText =
      firstQueueItem?.definitions ?? context.prefill?.definitions ?? '';
    const term =
      context.prefill?.targetWord ??
      firstQueueItem?.term ??
      context.cue?.targetText ??
      '';

    const prefill: DictionaryPanelPrefill = {
      term,
      langCode: context.sourceLang,
      reading: '',
      definitions: definitionsText
        ? definitionsText.split('\n').filter((line) => line.trim()).map((text) => ({ text: text.trim() }))
        : [],
      rawDefinitions: definitionsText
        ? definitionsText.split('\n').filter((line) => line.trim())
        : [],
      contextSentence: sentence,
      translation,
      wordAudioUrls: context.prefill?.wordAudioUrls ?? [],
      sentenceAudioUrls: context.prefill?.sentenceAudioUrls ?? [],
      imageUrls: context.prefill?.imageUrls ?? [],
      video: context.video,
      cue: context.cue,
      initialMedia: context.initialMedia,
      queue: context.queue,
      initialAction: action,
    };

    deps.panelController.sendToCard(prefill).catch((err: unknown) => {
      console.warn('[web-text-dict] sendToCard failed:', err);
    });
  }

  function isCardCreatorOpen(): boolean {
    return (cardCreatorMount?.isOpen() ?? false) || (deps.panelController?.isOpen() ?? false);
  }

  async function openStandaloneCardCreator(
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
    fromSubtitle: boolean,
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

    // Open the dialog IMMEDIATELY with whatever data is already available
    // (term, definitions, sentence, translation, media URLs selected in popup).
    // Missing media is fetched in the background and pushed into the open
    // dialog via addMediaFiles / updateTextField — so the user sees the dialog
    // right away instead of waiting for network calls to complete.
    openCardCreator({
      video: video && video.videoWidth > 0 && fromSubtitle ? video : undefined,
      sourceLang,
      targetLang,
      prefill: {
        targetWord: prefill.term,
        definitions: definitionsText,
        sentenceTranslation: prefill.translation,
        sentence: prefill.contextSentence,
        wordAudioUrls: prefill.wordAudioUrls,
        sentenceAudioUrls: prefill.sentenceAudioUrls,
        imageUrls: prefill.imageUrls,
      },
    }, action);

    // --- Background media fetch (non-blocking) ---
    // Screenshot + sentence audio (subtitle case only — requires video).
    if (video && video.videoWidth > 0 && fromSubtitle) {
      void (async () => {
        try {
          await waitForVideoReady(video);
          try {
            const screenshot = await captureScreenshot(video);
            cardCreatorMount?.addMediaFiles('images', [screenshot]);
          } catch { /* non-fatal */ }
          try {
            const cues = getTargetCues?.() ?? [];
            const currentMs = video.currentTime * 1000;
            const matchingCue = cues.find((c) => currentMs >= c.start && currentMs <= c.end);
            if (matchingCue) {
              const audioR = await captureSentenceAudio(video, { start: matchingCue.start, end: matchingCue.end });
              if (audioR.ok) cardCreatorMount?.addMediaFiles('sentenceAudios', [audioR.file]);
            }
          } catch { /* non-fatal */ }
        } catch { /* non-fatal */ }
      })();
    }

    // Auto-fetch missing media (audio, images, translation) from the popup
    // dictionary's data sources. The popup lazily fetches these when the user
    // opens the Audio/Images/Translate tabs. If the user clicks "Send to Card"
    // without opening those tabs, the media is not yet available — fetch it
    // in the background and push into the open dialog.
    const needsAudio = !prefill.wordAudioUrls?.length;
    const needsImages = !prefill.imageUrls?.length;
    const needsSentenceAudio = !prefill.sentenceAudioUrls?.length && !!prefill.contextSentence;
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
   *  panel and standalone dialog paths so neither path forgets the recording. */
  async function collectCardCreatorMedia(
    prefill: PopupCardCreatorPrefill,
    sourceLang: string,
    fromSubtitle: boolean,
    warnings?: string[],
  ): Promise<{
    wordAudioUrls: readonly string[];
    sentenceAudioUrls: readonly string[];
    imageUrls: readonly string[];
    initialMedia: MediaFile[];
    cue?: BilingualCue;
  }> {
    let wordAudioUrls = prefill.wordAudioUrls ?? [];
    let sentenceAudioUrls = prefill.sentenceAudioUrls ?? [];
    let imageUrls = prefill.imageUrls ?? [];

    const needsWordAudio = wordAudioUrls.length === 0;
    const needsImages = imageUrls.length === 0;
    const needsSentenceAudio = sentenceAudioUrls.length === 0 && !!prefill.contextSentence;

    if (needsWordAudio || needsImages || needsSentenceAudio) {
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

      if (needsSentenceAudio) {
        tasks.push((async (): Promise<void> => {
          try {
            const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
              type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
              payload: { tabId: 0, text: prefill.contextSentence!.slice(0, 200), langCode: fromSubtitle ? sourceLang : prefill.langCode },
            });
            if (res?.success && res.data?.url) {
              sentenceAudioUrls = [res.data.url];
            }
          } catch { /* non-fatal */ }
        })());
      }

      await Promise.all(tasks);
    }

    const initialMedia: MediaFile[] = [];
    let cue: BilingualCue | undefined;

    if (video && video.videoWidth > 0 && fromSubtitle) {
      await waitForVideoReady(video);
      try {
        initialMedia.push(await captureScreenshot(video));
      } catch { warnings?.push('screenshot'); }
      try {
        const cues = getTargetCues?.() ?? [];
        const currentMs = video.currentTime * 1000;
        const matchingCue = cues.find((c) => currentMs >= c.start && currentMs <= c.end);
        if (matchingCue) {
          cue = {
            index: matchingCue.index ?? 0,
            start: matchingCue.start,
            end: matchingCue.end,
            targetText: matchingCue.text ?? prefill.contextSentence ?? '',
            nativeText: '',
          };
          const audioR = await captureSentenceAudio(video, { start: matchingCue.start, end: matchingCue.end });
          if (audioR.ok) initialMedia.push(audioR.file);
        }
      } catch { warnings?.push('sentence audio capture'); }
    }

    return { wordAudioUrls, sentenceAudioUrls, imageUrls, initialMedia, cue };
  }

  function handlePopupCardCreatorAction(
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
  ): OnCardCreatorActionResult {
    // Capture subtitle context BEFORE returning — onPopupDismiss clears
    // currentHighlightTarget synchronously after this function returns.
    const fromSubtitle = isLookupFromSubtitle();

    if (deps.panelController) {
      // ADR-065: route to the integrated universal panel and keep the popup open.
      // The popup decision (stayOpen) is returned synchronously, but media is
      // collected asynchronously so the panel opens with screenshot/audio/image.
      void (async (): Promise<void> => {
        try {
          const settings = await loadSettingsOrToast(deps.container);
          if (!settings) return;

          const sourceLang = settings.subtitleOverlayTargetLanguage || prefill.langCode || 'en';
          const targetLang = settings.subtitleOverlayNativeLanguage || nativeLang || 'vi';
          const media = await collectCardCreatorMedia(prefill, sourceLang, fromSubtitle);

          let sentenceTranslation = prefill.translation;
          if (!sentenceTranslation && prefill.contextSentence) {
            try {
              const res = await sendMessage<MessageResponse<{ translated: string[] }>>({
                type: MESSAGE_TYPES.TRANSLATE,
                payload: { tabId: 0, text: prefill.contextSentence, sl: sourceLang, tl: targetLang },
              });
              if (res?.success && res.data?.translated?.length) {
                sentenceTranslation = res.data.translated.join(' ');
              }
            } catch { /* non-fatal */ }
          }

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
          };

          sendToCard(context, action);
        } catch (err: unknown) {
          console.warn('[web-text-dict] sendToCard failed:', err);
        }
      })();
      return { stayOpen: true };
    }

    // Standalone Card Creator dialog fallback — hide the popup immediately
    // and open the dialog in the background.
    closePopup();
    void openStandaloneCardCreator(action, prefill, fromSubtitle);
    return { stayOpen: false };
  }

  async function handlePopupQuickAdd(prefill: PopupCardCreatorPrefill): Promise<void> {
    // Capture subtitle context BEFORE any await / close.
    const fromSubtitle = isLookupFromSubtitle();
    closePopup();
    const settings = await loadSettingsOrToast(deps.container);
    if (!settings) return;
    const freshCcSettings = settings.cardCreator;
    const url = freshCcSettings.ankiConnectUrl;

    const autosaver = new DraftAutosaver();
    const restored = await autosaver.load();
    const deck = restored?.deck ?? freshCcSettings.defaultDeck;
    const noteType = restored?.noteType ?? freshCcSettings.defaultNoteType;
    const fieldMapping = restored?.fieldMapping ?? {};
    const tags = restored?.tags ?? freshCcSettings.defaultTags;

    if (!deck || !noteType) {
      showToast('Quick Add needs a deck + note type. Open Card Creator first to configure.', deps.container, { variant: 'error' });
      return;
    }
    if (Object.keys(fieldMapping).length === 0) {
      showToast('Quick Add needs field mapping. Open Card Creator first to configure.', deps.container, { variant: 'error' });
      return;
    }

    showToast('Quick Add — collecting media…', deps.container, { variant: 'info' });

    const sourceLang = settings.subtitleOverlayTargetLanguage || prefill.langCode || 'en';

    const wordAudios: MediaFile[] = [];
    const sentenceAudios: MediaFile[] = [];
    const images: MediaFile[] = [];
    const warnings: string[] = [];

    // Fetch missing URL media and capture subtitle screenshot/audio in one place.
    const media = await collectCardCreatorMedia(prefill, sourceLang, fromSubtitle, warnings);

    const [wordResults, sentenceResults, imageResults] = await Promise.all([
      Promise.allSettled((media.wordAudioUrls ?? []).map((u) => fetchMediaFile(u, 'audio'))),
      Promise.allSettled((media.sentenceAudioUrls ?? []).map((u) => fetchMediaFile(u, 'audio'))),
      Promise.allSettled((media.imageUrls ?? []).map((u) => fetchMediaFile(u, 'image'))),
    ]);
    wordResults.forEach((r, i) => {
      if (r.status === 'fulfilled') wordAudios.push(r.value);
      else warnings.push(`word audio: ${media.wordAudioUrls[i]}`);
    });
    sentenceResults.forEach((r, i) => {
      if (r.status === 'fulfilled') sentenceAudios.push(r.value);
      else warnings.push(`sentence audio: ${media.sentenceAudioUrls[i]}`);
    });
    imageResults.forEach((r, i) => {
      if (r.status === 'fulfilled') images.push(r.value);
      else warnings.push(`image: ${media.imageUrls[i]}`);
    });

    images.push(...media.initialMedia.filter((f) => f.kind === 'image'));
    sentenceAudios.push(...media.initialMedia.filter((f) => f.kind === 'audio'));

    const definitionsText = formatDefinitions(prefill.definitions);

    const result = await quickAddNote(
      url,
      deck,
      noteType,
      fieldMapping,
      tags,
      {
        targetWord: prefill.term,
        sentence: prefill.contextSentence,
        sentenceTranslation: prefill.translation ?? '',
        definitions: definitionsText,
        note: '',
        moreExample: '',
      },
      { images, sentenceAudios, wordAudios },
      (msg) => warnings.push(msg),
    );

    if (result.ok) {
      if (result.noteId === null) {
        showToast('Card not added — a duplicate may already exist.', deps.container, { variant: 'warning' });
      } else {
        showToast(`Card added to "${deck}" (#${result.noteId}).`, deps.container, { variant: 'success' });
      }
    } else {
      showToast(`Quick Add failed: ${result.error}`, deps.container, { variant: 'error' });
    }
    if (warnings.length > 0) {
      showToast(`Skipped: ${warnings.join(', ')}`, deps.container, { variant: 'warning' });
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
    closePopup();
    cardCreatorMount?.unmount();
    cardCreatorMount = null;
    wordHighlight.destroy();
    sentenceHighlight.destroy();
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
    if (orbitalBadge && sameDimensions) {
      orbitalBadge.setPreset(trigger.position);
    } else {
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
    if (popupMount) {
      popupMount.setOptions({
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
    popupMount?.setStatus(term, status);
  }

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
