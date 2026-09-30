import type {
  LookupRequest,
  LookupResult,
  WordStatus,
  PopupCardCreatorAction,
  PopupCardCreatorPrefill,
  OnCardCreatorActionResult,
} from '@/entities/dictionary';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import type { PopupLineRect } from '../ui/popupGeometry';
import { POPUP_BELOW_PANEL_Z_INDEX, POPUP_SHEET_BREAKPOINT_PX, POPUP_Z_INDEX } from '../ui/popupGeometry';
import type { PopupAnchor, PopupSize } from '../ui/usePopupPosition';
import {
  mountPopupDictionary,
  type MountPopupDictionaryOptions,
} from '../ui/mountPopupDictionary';
import type { WebTriggerPointer } from '@/features/dictionaryPopup/trigger/webTriggerController';
import { createWordHighlight, type HighlightTarget } from '@/features/dictionaryPopup/ui/wordHighlight';
import { emitWordStatusChanged } from '@/features/dictionary';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { openSettingsSection, type PanelMountController } from './panelBridge';
import { createPopupLevel, type PopupLevel } from './controllerTypes';
import { setWordStatus } from '@/features/dictionary';
import type { PopupStatusTarget } from '@/features/tokenize';
import {
  applyTokenStatus,
  clearPopupTokenId,
  computeLineRect,
  getTokenById,
  getTokenElement,
  isInsideStackHostEvent,
  isLookupFromUniversalPanel,
  isReanchorPointerDown,
  levelIndexForTarget,
  setPopupTokenId,
  POPUP_OPEN_CLASS,
} from './lookupTargetDom';
import { computeTextOffset, expandHighlightForTerm } from './phraseHighlight';
import { prefetchAdjacentTerms, type LookupCache } from './lookupCache';
import { createListenerRegistry } from './listenerRegistry';

/** Delay before actually hiding the popup when {@link dismissLookup} is called
 *  explicitly. If a new lookup arrives within this window, the dismiss is
 *  canceled and the popup repositions seamlessly.
 *  NOTE: auto-dismiss on hover-leave (onClear) was removed — the popup now
 *  only closes on explicit user action (click outside / Esc / close button).
 *  dismissLookup remains as a public API for explicit/programmatic dismiss. */
const POPUP_DISMISS_DELAY_MS = 500;

export interface PopupLifecycleDeps {
  readonly getDpSettings: () => DictionaryPopupSettings;
  readonly setDpSettings: (settings: DictionaryPopupSettings) => void;
  readonly getNativeLang: () => string;
  readonly getTokenStatus?: (term: string) => WordStatus;
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  readonly panelController?: PanelMountController;
  readonly lookupCache: LookupCache;
  readonly pauseVideo: () => void;
  readonly resumeVideo: () => void;
  readonly resetVideoPlaying: () => void;
  readonly sendLookupCancel: (requestId: string) => void;
  readonly onCardCreatorAction: (
    level: PopupLevel,
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
  ) => OnCardCreatorActionResult;
  readonly onQuickAdd: (level: PopupLevel, prefill: PopupCardCreatorPrefill) => void;
}

export interface PopupLifecycle {
  readonly handleLookup: (
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    highlightTarget: HighlightTarget,
    pointer?: WebTriggerPointer,
  ) => void;
  readonly dismissLookup: () => void;
  readonly cancelPendingDismiss: () => void;
  readonly cancelInFlightLookup: () => void;
  readonly closePopup: () => void;
  readonly hasOpenPopup: () => boolean;
  readonly showHighlight: (target: HighlightTarget) => void;
  readonly clearHighlight: () => void;
  readonly syncStatus: (term: string, status: WordStatus) => void;
  readonly syncMountSettings: (nativeLang: string, settings: DictionaryPopupSettings) => void;
  /** The term the deepest open popup is showing + an apply() that routes a
   *  status change through the popup path (persist + token repaint + cache +
   *  popup pill sync). Null when no popup has a result yet — lets the 1-4
   *  status keys target the looked-up word. */
  readonly getPopupStatusTarget: () => PopupStatusTarget | null;
  readonly dispose: () => void;
}

export function createPopupLifecycle(deps: PopupLifecycleDeps): PopupLifecycle {
  const listeners = createListenerRegistry();
  // popupStack[0] is the level-1 popup anchored to page/subtitle text. A lookup
  // triggered from inside level N lands on level N+1, keeping ancestors open.
  const popupStack: PopupLevel[] = [];
  // Backing highlight for the public showHighlight/clearHighlight API when no
  // popup level exists yet.
  const apiHighlight = createWordHighlight();
  let popupDismissTimer: ReturnType<typeof setTimeout> | null = null;

  function showHighlight(target: HighlightTarget): void {
    (popupStack[popupStack.length - 1]?.highlight ?? apiHighlight).show(target);
  }

  function clearHighlight(): void {
    apiHighlight.clear();
    for (const level of popupStack) level.highlight.clear();
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

  // Sheet mode (mobile/narrow viewport): the popup is a bottom sheet that
  // stays open across lookups so the user can chain word lookups without the
  // sheet vanishing on each outside tap. Desktop popup dismisses on outside
  // click as before.
  function isSheetMode(): boolean {
    return window.innerWidth < POPUP_SHEET_BREAKPOINT_PX;
  }

  function destroyLevel(level: PopupLevel): void {
    if (level.requestId) {
      deps.sendLookupCancel(level.requestId);
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
      deps.resumeVideo();
      deps.resetVideoPlaying();
    } else {
      popupStack[popupStack.length - 1]?.mount?.focus();
    }
  }

  function closePopup(): void {
    cancelPendingDismiss();
    closeFromLevel(0);
  }

  function applyLevelZIndex(level: PopupLevel): void {
    if (level.mount) {
      level.mount.host.style.zIndex = level.abovePanel ? POPUP_Z_INDEX : POPUP_BELOW_PANEL_Z_INDEX;
    }
  }

  // Re-evaluate abovePanel for the whole stack when the panel opens/closes.
  // A level-1 popup anchored to page text must drop below the panel; only a
  // chain rooted inside the panel stays above it.
  function syncPanelZIndex(): void {
    const open = deps.panelController?.isOpen() ?? false;
    let inherited = true;
    popupStack.forEach((level, index) => {
      inherited = index === 0
        ? !open || (level.highlightTarget !== null && isLookupFromUniversalPanel(level.highlightTarget))
        : inherited;
      level.abovePanel = inherited;
      applyLevelZIndex(level);
    });
  }

  const unsubscribePanelOpenChange = deps.panelController?.onOpenChange?.(syncPanelZIndex);

  /** Mount a popup for `level`, wiring every popup callback back to that
   *  level so nested lookups / status changes / card actions stay scoped. */
  function mountPopupLevel(level: PopupLevel, options: MountPopupDictionaryOptions): void {
    level.mount = mountPopupDictionary({
      ...options,
      onClose: () => closeFromLevel(popupStack.indexOf(level)),
      onSizeChange: handlePopupSizeChange,
      onSendToCard: (prefill) => deps.onCardCreatorAction(level, 'edit-card', prefill),
      onQuickAdd: (prefill) => { void deps.onQuickAdd(level, prefill); },
      onStatusChange: (term, langCode, status) => handlePopupStatusChange(level, term, langCode, status),
      onCandidateChange: (term) => expandHighlightForTerm(level, term),
      onOpenSettings: deps.panelController
        ? () => { closePopup(); void openSettingsSection(deps.panelController!, 'resources'); }
        : undefined,
      dismissOnOutsideClick: !isSheetMode(),
      isInsideOtherHost: isInsideStackHostEvent,
      isReanchorPointerDown,
      onOutsidePointerDown: closePopup,
    });
    applyLevelZIndex(level);
  }

  function handlePopupSizeChange(size: PopupSize, sheetHeight: number): void {
    const sheetHeightVh = Math.round((sheetHeight / window.innerHeight) * 100);
    deps.setDpSettings({
      ...deps.getDpSettings(),
      popupWidthPx: size.width,
      popupMaxHeightPx: size.maxHeight,
      popupSheetHeightVh: Math.max(20, Math.min(95, sheetHeightVh)),
    });
    void sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: {
        settings: {
          dictionaryPopup: deps.getDpSettings(),
        },
      },
    });
  }

  function handlePopupStatusChange(level: PopupLevel, term: string, langCode: string, status: WordStatus): void {
    emitWordStatusChanged({ term, langCode, status });
    level.mount?.setStatus(term, status);
    deps.onStatusChange?.(term, langCode, status);
    const token = level.popupTokenEl ?? (level.popupTokenId ? getTokenById(level.popupTokenId) : null);
    if (token) {
      applyTokenStatus(token, status);
      token.classList.add(POPUP_OPEN_CLASS);
    } else if (level.highlightTarget) {
      applyTokenStatus(level.highlightTarget, status);
    }
    deps.lookupCache.updateStatus(term, langCode, status);
  }

  function getPopupStatusTarget(): PopupStatusTarget | null {
    for (let i = popupStack.length - 1; i >= 0; i--) {
      const level = popupStack[i]!;
      if (!level.mount || !level.term || !level.termLangCode) continue;
      const term = level.term;
      const langCode = level.termLangCode;
      return {
        term,
        langCode,
        apply: (status) => {
          void setWordStatus(langCode, term, status).catch(() => { /* best-effort */ });
          handlePopupStatusChange(level, term, langCode, status);
        },
      };
    }
    return null;
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

    const dpSettings = deps.getDpSettings();
    const perLang = dpSettings.defaultActiveTabPerLang?.[result.langCode];
    const defaultTab = perLang !== undefined ? perLang : dpSettings.defaultActiveTab;

    if (level.mount) {
      // Reused level (same-level re-lookup, sheet chain, or the async
      // response for a loading shell): feed the result in without
      // re-mounting and move the popup to the new anchor.
      level.mount.setResult(result, additional);
      level.mount.setOptions({
        sourceLang: result.langCode,
        targetLang: deps.getNativeLang() || 'vi',
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
        targetLang: deps.getNativeLang() || 'vi',
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

    level.term = result.term;
    level.termLangCode = result.langCode;

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
    prefetchAdjacentTerms(deps.lookupCache, request);
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
    if (getTokenElement(highlightTarget)) deps.pauseVideo();

    // Route the lookup to its level: page/subtitle text → level 1 (index 0),
    // content inside popup level N → level N+1. Deeper levels are pruned; the
    // target level is reused when it exists.
    const sourceIdx = levelIndexForTarget(popupStack, highlightTarget);
    const targetIdx = isSheetMode() ? 0 : sourceIdx + 1;
    const sourceAbovePanel = sourceIdx >= 0 ? popupStack[sourceIdx]?.abovePanel : undefined;
    if (popupStack.length > targetIdx + 1) closeFromLevel(targetIdx + 1);

    let level = popupStack[targetIdx];
    if (level) {
      if (level.requestId) {
        deps.sendLookupCancel(level.requestId);
        level.requestId = null;
      }
      clearPopupTokenId(level);
      level.highlight.clear();
    } else {
      level = createPopupLevel();
      popupStack.push(level);
    }

    level.abovePanel = sourceAbovePanel
      ?? (!(deps.panelController?.isOpen() ?? false) || isLookupFromUniversalPanel(highlightTarget));
    applyLevelZIndex(level);

    level.highlightTarget = highlightTarget;
    level.originalHighlightTarget = highlightTarget;
    // A new lookup is taking over this level — drop the previous term so 1-4
    // keys can't hit the stale word while the new result is loading.
    level.term = null;
    level.termLangCode = null;
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
    const cached = deps.lookupCache.get(request.term, request.langCode, request);
    if (cached) {
      const finalWinner = applyLocalStatusFallback(cached[0]!, request.term);
      const finalCached = finalWinner === cached[0] ? cached : [finalWinner, ...cached.slice(1)];
      if (finalCached !== cached) deps.lookupCache.set(request.term, request.langCode, finalCached, request);
      renderLookupResult(level, finalCached[0]!, finalCached.slice(1), anchorRect, request, pointer);
      return;
    }

    // Mount a React loading shell immediately with the term + context so the
    // user gets instant feedback on click/hover. When data arrives,
    // renderLookupResult calls setResult on the same mount.
    const dpSettings = deps.getDpSettings();
    if (level.mount) {
      const perLang = dpSettings.defaultActiveTabPerLang?.[request.langCode];
      const defaultTab = perLang !== undefined ? perLang : dpSettings.defaultActiveTab;
      level.mount.setLoading(true);
      level.mount.setOptions({
        sourceLang: request.langCode,
        targetLang: deps.getNativeLang() || 'vi',
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
        targetLang: deps.getNativeLang() || 'vi',
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
          if (!finalWinner.phraseIndexPending) {
            deps.lookupCache.set(request.term, request.langCode, finalData, request);
          }
          renderLookupResult(owner, finalWinner, finalWinner === winner ? rest : finalData.slice(1), anchorRect, request, pointer, true);
        } else {
          console.warn('[web-text-dict] lookup failed', error);
        }
      })
      .catch((err) => {
        console.warn('[web-text-dict] lookup error', err);
      });
  }

  function cancelInFlightLookup(): void {
    for (const level of popupStack) {
      if (level.requestId) {
        deps.sendLookupCancel(level.requestId);
        level.requestId = null;
      }
    }
  }

  function syncStatus(term: string, status: WordStatus): void {
    for (const level of popupStack) {
      level.mount?.setStatus(term, status);
    }
  }

  function syncMountSettings(nativeLang: string, settings: DictionaryPopupSettings): void {
    for (const level of popupStack) {
      level.mount?.setOptions({
        targetLang: nativeLang,
        initialSize: { width: settings.popupWidthPx, maxHeight: settings.popupMaxHeightPx },
        initialSheetHeight: Math.round(window.innerHeight * ((settings.popupSheetHeightVh ?? 72) / 100)),
      });
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

  listeners.add(document, 'keydown', onStackKeydown as EventListener);
  listeners.add(document, 'pointerdown', onStackPointerDown as EventListener, true);

  function dispose(): void {
    cancelPendingDismiss();
    unsubscribePanelOpenChange?.();
    listeners.removeAll();
    for (const level of popupStack) level.highlight.destroy();
    closePopup();
    apiHighlight.destroy();
  }

  return {
    handleLookup,
    dismissLookup,
    cancelPendingDismiss,
    cancelInFlightLookup,
    closePopup,
    hasOpenPopup: () => popupStack.length > 0,
    showHighlight,
    clearHighlight,
    syncStatus,
    syncMountSettings,
    getPopupStatusTarget,
    dispose,
  };
}
