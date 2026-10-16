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
import { getViewportContentWidth } from '../ui/viewportContentSize';
import type { PopupAnchor, PopupSize } from '../ui/usePopupPosition';
import {
  mountPopupDictionary,
  type MountPopupDictionaryOptions,
  type PopupDictionaryMountController,
} from '../ui/mountPopupDictionary';
import { mountPopupDictionaryRemote } from '../bridge/iframePopupBridgeChild';
import { isTopAnchoredTarget } from '@/shared/lib/dom/topAnchoredTarget';
import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import type { WebTriggerPointer } from '@/features/dictionaryPopup/trigger/webTriggerController';
import { createWordHighlight, type HighlightTarget } from '@/features/dictionaryPopup/ui/wordHighlight';
import { emitWordStatusChanged } from '@/features/dictionary';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { markLookup, measureLookup, clearLookupMarks } from '@/shared/lib/perfMarks';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { openSettingsSection, type PanelMountController } from './panelBridge';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import { createPopupLevel, type PopupLevel } from './controllerTypes';
import { getWordStatuses, setWordStatus, toggleTrackingFlag } from '@/features/dictionary';
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
   *  popup pill sync). Falls back to the in-flight lookup term so keys 1-4
   *  pressed while the result is still loading still land. Null when no
   *  level has any term yet. */
  readonly getPopupStatusTarget: () => PopupStatusTarget | null;
  readonly dispose: () => void;
}

export function createPopupLifecycle(deps: PopupLifecycleDeps): PopupLifecycle {
  const listeners = createListenerRegistry();
  // popupStack[0] is the level-1 popup anchored to page/subtitle text. A lookup
  // triggered from inside the popup lands on the next logical level, keeping
  // ancestors in the chain — the whole chain renders inside level 0's single
  // mount at every width and is navigated by the breadcrumb trail.
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

  // Bottom-sheet layout (narrow viewport): the popup stays open across
  // outside taps so the user can chain lookups without it vanishing; wider
  // surfaces dismiss on outside click. Uses the same viewport measure as
  // usePopupPosition so the dismissal policy always matches the layout.
  function isSheetMode(): boolean {
    return getViewportContentWidth() < POPUP_SHEET_BREAKPOINT_PX;
  }

  /** The mount rendering the top logical level's content — always the single
   *  mount owned by level 0, no matter which level the content belongs to. */
  function viewMountOf(): PopupDictionaryMountController | null {
    return popupStack[0]?.mount ?? null;
  }

  function uniqueViewMounts(): PopupDictionaryMountController[] {
    const mount = viewMountOf();
    return mount ? [mount] : [];
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
    } else {
      restoreTopLevelView();
    }
  }

  // The shared mount mirrors the full lookup chain as a breadcrumb strip.
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
      const zIndex = level.abovePanel ? POPUP_Z_INDEX : POPUP_BELOW_PANEL_Z_INDEX;
      if (level.mount.setZIndex) level.mount.setZIndex(zIndex);
      else level.mount.host.style.zIndex = zIndex;
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

  /** Mount the shared popup for `level`, wiring every popup callback to the
   *  TOP logical level — the single mount displays whatever the chain's top
   *  is, so callbacks resolve the displayed level dynamically instead of the
   *  mount owner. */
  function mountPopupLevel(level: PopupLevel, options: MountPopupDictionaryOptions): void {
    const viewLevel = (): PopupLevel =>
      popupStack[popupStack.length - 1] ?? level;
    const mountFn: (o: MountPopupDictionaryOptions) => PopupDictionaryMountController =
      isChildFrame()
        // Cross-origin player iframe: mount the surface on the top document —
        // position:fixed in here is clipped to the iframe's viewport.
        ? (o) => mountPopupDictionaryRemote(
            o,
            deps.getDpSettings().popupSheetHeightVh,
            level.hostAnchored,
            // Host can't render (no CS, shadow-DOM iframe, fullscreen embed):
            // swap in a local mount so the lookup still shows — clipped but
            // functional.
            () => { level.mount = mountPopupDictionary(o); },
          ) ?? mountPopupDictionary(o)
        : mountPopupDictionary;
    level.mount = mountFn({
      ...options,
      trail: popupStack.map((l) => l.lookupTerm ?? ''),
      onTrailNavigate: (index) => closeFromLevel(index + 1),
      onClose: () => closeFromLevel(0),
      onSizeChange: handlePopupSizeChange,
      onSendToCard: (prefill) => deps.onCardCreatorAction(viewLevel(), 'edit-card', prefill),
      onQuickAdd: (prefill) => { void deps.onQuickAdd(viewLevel(), prefill); },
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
    applyLevelZIndex(level);
  }

  function handlePopupSizeChange(
    size: PopupSize,
    sheetHeight: number,
    viewportHeight?: number,
  ): void {
    // Remote (top-frame) mounts report the host's innerHeight — dividing by
    // the child iframe's innerHeight would blow past the 95vh clamp.
    const sheetHeightVh = Math.round((sheetHeight / (viewportHeight ?? window.innerHeight)) * 100);
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
    viewMountOf()?.setStatus(term, status);
    deps.onStatusChange?.(term, langCode, status);
    const token = level.popupTokenEl ?? (level.popupTokenId ? getTokenById(level.popupTokenId) : null);
    if (token) {
      applyTokenStatus(token, status);
      token.classList.add(POPUP_OPEN_CLASS);
    } else if (level.highlightTarget) {
      applyTokenStatus(level.highlightTarget, status);
    }
    deps.lookupCache.invalidate(term, langCode);
  }

  function getPopupStatusTarget(): PopupStatusTarget | null {
    for (let i = popupStack.length - 1; i >= 0; i--) {
      const level = popupStack[i]!;
      const term = level.term ?? level.request?.term ?? level.lookupTerm;
      const langCode = level.termLangCode ?? level.request?.langCode;
      if (!term || !langCode) continue;
      const apply = (status: WordStatus): void => {
        void setWordStatus(langCode, term, status).catch(() => { /* best-effort */ });
        handlePopupStatusChange(level, term, langCode, status);
      };
      return {
        term,
        langCode,
        apply,
        toggleTracking: () => {
          void getWordStatuses(langCode, [term])
            .then((statuses) => {
              const current = statuses.get(term) ?? 'unknown';
              const next = toggleTrackingFlag(current);
              if (next !== current) apply(next);
            })
            .catch(() => { /* best-effort */ });
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

    const viewMount = viewMountOf();
    if (viewMount) {
      // The shared mount already exists (re-lookup or the async response for
      // a loading shell): feed the result in without re-mounting and move the
      // popup to the new anchor.
      viewMount.setResult(result, additional);
      viewMount.setOptions({
        sourceLang: result.langCode,
        targetLang: deps.getNativeLang() || 'vi',
        initialTerm: request.term,
        contextSentence: request.contextSentence,
        cursorOffset: request.cursorOffset,
        defaultActiveTab: defaultTab,
      });
      if (!isResponseUpdate && !(level.highlightTarget && levelIndexForTarget(popupStack, level.highlightTarget) >= 0)) {
        viewMount.setAnchor(anchor, pointerHint, lineRect, level.hostAnchored);
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
    // content inside the popup → the next logical level. Every level shares
    // level 0's mount, so a popup-internal target always chains off the top
    // logical level — the DOM alone can't tell which level is displayed.
    let sourceIdx = levelIndexForTarget(popupStack, highlightTarget);
    const popupInternal = sourceIdx >= 0;
    if (popupInternal) sourceIdx = popupStack.length - 1;
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
    level.hostAnchored = isTopAnchoredTarget(highlightTarget);
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
    // renderLookupResult calls setResult on the same mount. Pushing a logical
    // level repaints the one shared mount.
    const dpSettings = deps.getDpSettings();
    const defaultTab = defaultTabFor(request.langCode);
    const viewMount = viewMountOf();
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
      if (!popupInternal) {
        viewMount.setAnchor(anchor, pointerHint, lineRect, level.hostAnchored);
      }
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

  // Stack-level Escape lives on the shared escape-layer stack (registered on
  // the first level, unregistered when the stack empties or on dispose) so it
  // orders correctly against other pushed layers. One mount serves the whole
  // chain — Escape dismisses it at once.
  let unregisterEscapeLayer: (() => void) | null = null;
  const onStackEscape = (): void => {
    closeFromLevel(0);
  };

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
