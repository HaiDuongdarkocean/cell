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
  type PopupDictionaryMountController,
} from '../ui/mountPopupDictionary';
import type { WebTriggerPointer } from '@/features/dictionaryPopup/trigger/webTriggerController';
import { createWordHighlight, type HighlightTarget } from '@/features/dictionaryPopup/ui/wordHighlight';
import { emitWordStatusChanged } from '@/features/dictionary';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { markLookup, measureLookup, clearLookupMarks } from '@/shared/lib/perfMarks';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { openSettingsSection, type PanelMountController } from './panelBridge';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
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
  /** One-action capture into the mining queue (spec mining-queue). */
  readonly onSaveToQueue?: (prefill: PopupCardCreatorPrefill) => void;
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

  // Which representation the stack currently renders as. Sheet mode keeps a
  // single physical mount — on level 0 — whose content always mirrors the
  // top logical level; desktop mode keeps one mount per level. A resize
  // across the breakpoint re-materializes the stack without losing the
  // lookup chain. Null until the first mount establishes the representation.
  let viewIsSheet: boolean | null = null;

  /** The mount that renders `level`'s content. In sheet mode that is always
   *  the shared mount owned by level 0, no matter which logical level the
   *  content belongs to. */
  function viewMountOf(level: PopupLevel): PopupDictionaryMountController | null {
    return isSheetMode() ? popupStack[0]?.mount ?? null : level.mount;
  }

  function uniqueViewMounts(): PopupDictionaryMountController[] {
    const mounts = new Set<PopupDictionaryMountController>();
    for (const level of popupStack) {
      const mount = viewMountOf(level);
      if (mount) mounts.add(mount);
    }
    return [...mounts];
  }

  function defaultTabFor(langCode: string) {
    const dp = deps.getDpSettings();
    const perLang = dp.defaultActiveTabPerLang?.[langCode];
    return perLang !== undefined ? perLang : dp.defaultActiveTab;
  }

  /** Repaint the shared sheet mount with the top level's cached lookup data —
   *  breadcrumb navigation prunes deeper levels, then this restores the
   *  surfaced level without another dictionary round-trip. */
  function restoreTopLevelView(): void {
    const top = popupStack[popupStack.length - 1];
    const view = popupStack[0]?.mount;
    if (!top || !view) return;
    const langCode = top.request?.langCode ?? top.termLangCode ?? '';
    view.setOptions({
      sourceLang: langCode,
      targetLang: deps.getNativeLang() || 'vi',
      initialTerm: top.request?.term ?? top.lookupTerm ?? '',
      contextSentence: top.request?.contextSentence,
      cursorOffset: top.request?.cursorOffset,
      defaultActiveTab: defaultTabFor(langCode),
    });
    if (top.result) view.setResult(top.result, top.candidates);
    else view.setLoading(true);
    view.focus();
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
   *  the whole stack is gone; otherwise focus lands on the exposed level —
   *  which in sheet mode means repainting the shared mount with that level's
   *  cached result. */
  function closeFromLevel(index: number): void {
    if (index < 0 || index >= popupStack.length) return;
    while (popupStack.length > index) {
      destroyLevel(popupStack.pop()!);
    }
    syncTrail();
    if (popupStack.length === 0) {
      unregisterEscapeLayer?.();
      unregisterEscapeLayer = null;
      deps.resumeVideo();
      deps.resetVideoPlaying();
    } else if (isSheetMode()) {
      restoreTopLevelView();
    } else {
      popupStack[popupStack.length - 1]?.mount?.focus();
    }
  }

  // Every mounted level mirrors the full lookup chain (sheet mode renders it
  // as a breadcrumb strip on the single shared mount).
  function syncTrail(): void {
    const trail = popupStack.map((level) => level.lookupTerm ?? '');
    for (const mount of uniqueViewMounts()) mount.setOptions({ trail });
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
   *  level so nested lookups / status changes / card actions stay scoped. In
   *  sheet mode the single mount on level 0 displays the TOP level, so the
   *  callbacks resolve the displayed level dynamically instead of the mount
   *  owner. */
  function mountPopupLevel(level: PopupLevel, options: MountPopupDictionaryOptions): void {
    const viewLevel = (): PopupLevel =>
      (isSheetMode() ? popupStack[popupStack.length - 1] : level) ?? level;
    level.mount = mountPopupDictionary({
      ...options,
      trail: popupStack.map((l) => l.lookupTerm ?? ''),
      onTrailNavigate: (index) => closeFromLevel(index + 1),
      // Sheet mode's one close affordance dismisses the whole chain at once;
      // a desktop popup closes itself and every deeper level.
      onClose: () => closeFromLevel(isSheetMode() ? 0 : popupStack.indexOf(level)),
      onSizeChange: handlePopupSizeChange,
      onSendToCard: (prefill) => deps.onCardCreatorAction(viewLevel(), 'edit-card', prefill),
      onQuickAdd: (prefill) => { void deps.onQuickAdd(viewLevel(), prefill); },
      onSaveToQueue: deps.onSaveToQueue,
      onStatusChange: (term, langCode, status) => handlePopupStatusChange(viewLevel(), term, langCode, status),
      onCandidateChange: (term) => expandHighlightForTerm(viewLevel(), term),
      onOpenSettings: deps.panelController
        ? () => { closePopup(); void openSettingsSection(deps.panelController!, 'resources'); }
        : undefined,
      dismissOnOutsideClick: !isSheetMode(),
      isInsideOtherHost: isInsideStackHostEvent,
      isReanchorPointerDown,
      onOutsidePointerDown: closePopup,
    });
    viewIsSheet = isSheetMode();
    applyLevelZIndex(level);
  }

  function handlePopupSizeChange(size: PopupSize, sheetHeight: number): void {
    const sheetHeightVh = Math.round((sheetHeight / window.innerHeight) * 100);
    const current = deps.getDpSettings();
    deps.setDpSettings({
      ...current,
      // Sheet resizes report {width:0, maxHeight:0} — they carry no popup
      // geometry, so keep the previous popup size instead of persisting 0.
      popupWidthPx: size.width > 0 ? size.width : current.popupWidthPx,
      popupMaxHeightPx: size.maxHeight > 0 ? size.maxHeight : current.popupMaxHeightPx,
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
    viewMountOf(level)?.setStatus(term, status);
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
      if (!level.term || !level.termLangCode) continue;
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
    const defaultTab = defaultTabFor(result.langCode);

    // Cache the outcome on the level so breadcrumb restore / breakpoint
    // re-materialization can repaint without another lookup.
    level.request = request;
    level.result = result;
    level.candidates = additional;
    level.anchor = anchor;

    const viewMount = viewMountOf(level);
    if (viewMount) {
      // Reused mount (same-level re-lookup, the shared sheet view, or the
      // async response for a loading shell): feed the result in without
      // re-mounting and move the popup to the new anchor.
      viewMount.setResult(result, additional);
      viewMount.setOptions({
        sourceLang: result.langCode,
        targetLang: deps.getNativeLang() || 'vi',
        initialTerm: request.term,
        contextSentence: request.contextSentence,
        cursorOffset: request.cursorOffset,
        defaultActiveTab: defaultTab,
      });
      if (!isResponseUpdate) {
        viewMount.setAnchor(anchor, pointerHint, lineRect);
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
    deps.pauseVideo();

    // Route the lookup to its level: page/subtitle text → level 1 (index 0),
    // content inside popup level N → level N+1. Deeper levels are pruned; the
    // target level is reused when it exists. Sheet mode renders every level
    // inside level 0's single mount — a target there always chains off the
    // top logical level, which the DOM alone can't distinguish.
    let sourceIdx = levelIndexForTarget(popupStack, highlightTarget);
    if (isSheetMode() && sourceIdx >= 0) sourceIdx = popupStack.length - 1;
    const targetIdx = sourceIdx + 1;
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
      if (popupStack.length === 1) {
        unregisterEscapeLayer = pushEscapeLayer(onStackEscape);
      }
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
    level.lookupTerm = request.term;
    level.request = request;
    level.result = null;
    level.candidates = [];
    syncTrail();
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
    level.anchor = anchor;
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
    // renderLookupResult calls setResult on the same mount. Sheet mode has
    // exactly one physical mount — pushing a logical level repaints it.
    const dpSettings = deps.getDpSettings();
    const defaultTab = defaultTabFor(request.langCode);
    const viewMount = viewMountOf(level);
    if (viewMount) {
      viewMount.setLoading(true);
      viewMount.setOptions({
        sourceLang: request.langCode,
        targetLang: deps.getNativeLang() || 'vi',
        initialTerm: request.term,
        contextSentence: request.contextSentence,
        cursorOffset: request.cursorOffset,
        defaultActiveTab: defaultTab,
      });
      viewMount.setAnchor(anchor, pointerHint, lineRect);
    } else {
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
    markLookup('dispatch', requestId);

    void Promise.resolve(sendMessage({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: { requestId, request, origin: 'immersion' },
    }))
      .then((response: unknown) => {
        // Stale guard: the level was pruned or already re-used for a newer
        // lookup → drop this response entirely.
        const owner = popupStack.find((l) => l.requestId === requestId);
        if (!owner) return;
        owner.requestId = null;
        markLookup('response', requestId);
        measureLookup('dispatch', 'response', requestId);
        const { success, data, error } = response as { success: boolean; data?: LookupResult[]; error?: string };
        if (success && data && data.length > 0) {
          const [winner, ...rest] = data;
          const finalWinner = applyLocalStatusFallback(winner!, request.term);
          const finalData = finalWinner === winner ? data : [finalWinner, ...rest];
          if (!finalWinner.phraseIndexPending) {
            deps.lookupCache.set(request.term, request.langCode, finalData, request);
          }
          renderLookupResult(owner, finalWinner, finalWinner === winner ? rest : finalData.slice(1), anchorRect, request, pointer, true);
          requestAnimationFrame(() => {
            markLookup('render', requestId);
            measureLookup('dispatch', 'render', requestId);
            clearLookupMarks(requestId);
          });
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
    for (const mount of uniqueViewMounts()) {
      mount.setStatus(term, status);
    }
  }

  function syncMountSettings(nativeLang: string, settings: DictionaryPopupSettings): void {
    for (const mount of uniqueViewMounts()) {
      mount.setOptions({
        targetLang: nativeLang,
        initialSize: { width: settings.popupWidthPx, maxHeight: settings.popupMaxHeightPx },
        initialSheetHeight: Math.round(window.innerHeight * ((settings.popupSheetHeightVh ?? 72) / 100)),
      });
    }
  }

  function anchorFromRect(rect: DOMRect): PopupAnchor {
    return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom + 4 };
  }

  /** First whole-word occurrence of `term` inside a mounted popup's lookup
   *  region — used to re-anchor materialized nested popups after the parent's
   *  DOM was rebuilt across a breakpoint crossing. */
  function findTermRange(host: HTMLElement, term: string | null): Range | null {
    if (!term) return null;
    const root = host.shadowRoot;
    const region = root?.querySelector('[data-allow-lookup]') ?? root;
    if (!region) return null;
    const needle = term.toLowerCase();
    const boundary = /[0-9A-Za-zÀ-ɏ'-]/;
    const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const text = node.textContent ?? '';
      const idx = text.toLowerCase().indexOf(needle);
      if (idx >= 0) {
        const before = text[idx - 1];
        const after = text[idx + needle.length];
        if (!(before && boundary.test(before)) && !(after && boundary.test(after))) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + needle.length);
          return range;
        }
      }
      node = walker.nextNode() as Text | null;
    }
    return null;
  }

  /** Where a materialized desktop popup should sit after a mobile → desktop
   *  crossing. Level 0 anchors to live page text (still valid). Deeper levels
   *  anchored to tokens inside their parent's popup content — after a sheet
   *  phase that DOM is stale, so re-find the term inside the freshly mounted
   *  parent and re-apply the highlight there. Falls back to the level's last
   *  known anchor rect. */
  function resolveMaterializedAnchor(
    level: PopupLevel,
    index: number,
  ): { anchor: PopupAnchor; lineRect: PopupLineRect | null } {
    if (index > 0) {
      const parentHost = popupStack[index - 1]?.mount?.host;
      const range = parentHost ? findTermRange(parentHost, level.lookupTerm) : null;
      const rect = range && typeof range.getBoundingClientRect === 'function'
        ? range.getBoundingClientRect()
        : null;
      if (range && rect && (rect.width > 0 || rect.height > 0)) {
        level.highlight.clear();
        level.highlight.show(range);
        level.highlightTarget = range;
        return { anchor: anchorFromRect(rect), lineRect: computeLineRect(range) };
      }
    } else if (level.highlightTarget && typeof level.highlightTarget.getBoundingClientRect === 'function') {
      const rect = level.highlightTarget.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        return { anchor: anchorFromRect(rect), lineRect: computeLineRect(level.highlightTarget) };
      }
    }
    const anchor = level.anchor ?? {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2 - 160,
      right: window.innerWidth / 2 + 160,
      bottom: window.innerHeight / 2,
    };
    return { anchor, lineRect: null };
  }

  const nextFrame = (): Promise<void> =>
    new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });

  /** Desktop → mobile crossing: every level stays in the logical stack, but
   *  only level 0 keeps its mount — repainted with the top level's content.
   *  The mount itself flips Surface → Sheet via usePopupPosition's own
   *  resize listener. */
  function collapseToSheetView(): void {
    for (let i = popupStack.length - 1; i >= 1; i--) {
      const level = popupStack[i]!;
      level.mount?.destroy();
      level.mount = null;
      clearPopupTokenId(level);
      level.highlight.clear();
    }
    const view = popupStack[0]?.mount;
    if (!view) return;
    view.setOptions({ dismissOnOutsideClick: false });
    restoreTopLevelView();
    syncTrail();
  }

  /** Mobile → desktop crossing: materialize one popup per logical level.
   *  Level 0's existing mount self-flips Sheet → Surface; deeper levels get
   *  fresh mounts anchored to term occurrences inside their parent's
   *  content. A frame between mounts lets React commit so the term search
   *  sees rendered text. */
  async function materializeDesktopStack(): Promise<void> {
    const dpSettings = deps.getDpSettings();
    for (let i = 0; i < popupStack.length; i++) {
      if (isSheetMode()) return; // crossed back mid-transition — collapse owns it
      const level = popupStack[i]!;
      const { anchor, lineRect } = resolveMaterializedAnchor(level, i);
      const langCode = level.request?.langCode ?? level.termLangCode ?? '';
      const shared = {
        sourceLang: langCode,
        targetLang: deps.getNativeLang() || 'vi',
        initialTerm: level.request?.term ?? level.lookupTerm ?? '',
        contextSentence: level.request?.contextSentence,
        cursorOffset: level.request?.cursorOffset,
        defaultActiveTab: defaultTabFor(langCode),
        dismissOnOutsideClick: true,
      };
      if (level.mount) {
        level.mount.setOptions(shared);
        if (level.result) level.mount.setResult(level.result, level.candidates);
        else level.mount.setLoading(true);
        level.mount.setAnchor(anchor, undefined, lineRect);
      } else {
        mountPopupLevel(level, {
          anchor,
          lineRect,
          langCode,
          ...shared,
          initialResult: level.result ?? undefined,
          initialCandidates: level.candidates,
          getTokenStatus: deps.getTokenStatus,
          isLoading: !level.result,
          initialSize: { width: dpSettings.popupWidthPx, maxHeight: dpSettings.popupMaxHeightPx },
          initialSheetHeight: Math.round(window.innerHeight * ((dpSettings.popupSheetHeightVh ?? 72) / 100)),
        });
      }
      await nextFrame();
    }
    syncTrail();
  }

  const onViewportResize = (): void => {
    if (popupStack.length === 0) return;
    const sheet = isSheetMode();
    if (viewIsSheet === null || sheet === viewIsSheet) return;
    viewIsSheet = sheet;
    if (sheet) collapseToSheetView();
    else void materializeDesktopStack();
  };

  listeners.add(window, 'resize', onViewportResize);

  // Stack-level Escape lives on the shared escape-layer stack (registered on
  // the first level, unregistered when the stack empties or on dispose) so it
  // orders correctly against other pushed layers. The handler resolves the
  // level owning the event's composed path — focused level + descendants, or
  // the top level when focus is outside every host. Sheet mode dismisses the
  // whole chain at once.
  let unregisterEscapeLayer: (() => void) | null = null;
  const onStackEscape = (e: KeyboardEvent): void => {
    const path = e.composedPath();
    const idx = popupStack.findIndex(
      (level) => level.mount !== null && path.includes(level.mount.host),
    );
    closeFromLevel(isSheetMode() ? 0 : idx >= 0 ? idx : popupStack.length - 1);
  };

  // A pointerdown inside an ancestor level's host closes every deeper level
  // and lands focus on that ancestor; the surviving level stays interactive.
  // Sheet mode has no per-level hosts to disambiguate — taps inside the one
  // shared sheet must never prune.
  const onStackPointerDown = (e: PointerEvent): void => {
    if (isSheetMode() || popupStack.length < 2) return;
    const path = e.composedPath();
    const idx = popupStack.findIndex(
      (level) => level.mount !== null && path.includes(level.mount.host),
    );
    if (idx < 0 || idx >= popupStack.length - 1) return;
    closeFromLevel(idx + 1);
  };

  listeners.add(document, 'pointerdown', onStackPointerDown as EventListener, true);

  function dispose(): void {
    cancelPendingDismiss();
    unsubscribePanelOpenChange?.();
    unregisterEscapeLayer?.();
    unregisterEscapeLayer = null;
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
