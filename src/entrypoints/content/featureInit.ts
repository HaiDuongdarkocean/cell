declare const __CELL_FAST_BUILD__: boolean;

import { onStorageChanged } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, DEFAULT_CARD_CREATOR_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { getActiveProfileSettings } from '@/entities/settings';
import type { TokenizePanelState } from '@/features/tokenize/types';
import { createWebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import type { WebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import { createWebTokenizeController } from '@/features/tokenize/controller/webTokenizeController';
import type { WebTokenizeController } from '@/features/tokenize/controller/webTokenizeController';
import { mountUniversalPanel, type UniversalPanelMountController } from '@/features/universalPanel';
import { loadTokenizeSettings, isSubtitleTokenizeEnabledForUrl, setSubtitleTokenizeEnabledForUrl, saveTokenizeSettings } from '@/features/tokenize/services/tokenizeSettingsStore';
import type { SubtitleTriggerController } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import { modifierMatches, type LookupRequest, type TriggerMode } from '@/entities/dictionary';
import { findAndInitOverlay } from './videoOverlay';
import { startMediaScoreSource } from '@/features/subtitle/logic/mediaScoreSource';
import { startTextScoreSource } from '@/features/tokenize/services/textScoreSource';
import { mountComprehensionPill, type ComprehensionPillMount } from '@/features/tokenize/ui/mountComprehensionPill';
import { comprehensionStore } from '@/features/tokenize/services/comprehensionStore';

// Top-level web-text dictionary controller (independent of video presence).
// Shared with subtitle overlay controller for token lookup + highlight.
let webTextCtrl: WebTextDictionaryController | null = null;
let webTokenizeCtrl: WebTokenizeController | null = null;
let tokenizeLang: string | null = null;
let tokenLookupEnabled = true;
let tokenLookupMode: TriggerMode = 'click';
/** ADR-061: Persistent tokenize panel subscribers — survive webTokenizeCtrl
 *  recreation (profile/language switch destroys + rebuilds it). Each new
 *  controller instance re-subscribes a forwarder that broadcasts to this set. */
const tokenizePanelSubs = new Set<(s: TokenizePanelState) => void>();
let tokenizeCtrlUnsub: (() => void) | null = null;

let universalPanelMount: UniversalPanelMountController | null = null;

// Cached subtitle tokenize enabled state for this URL — read by universal panel.
let cachedSubtitleEnabled = false;

/** Build a TokenizePanelState snapshot from current webTokenizeCtrl + cachedSubtitleEnabled. */
function buildPanelState(): TokenizePanelState {
  const s = webTokenizeCtrl?.getState();
  return {
    enabled: s?.enabled ?? false,
    showStatus: s?.showStatus ?? false,
    showFrequency: s?.showFrequency ?? false,
    subtitleEnabled: cachedSubtitleEnabled,
  };
}

function notifyPanelSubs(): void {
  const snapshot = buildPanelState();
  for (const cb of tokenizePanelSubs) cb(snapshot);
}

function bindTokenizeCtrlSubs(ctrl: WebTokenizeController): void {
  tokenizeCtrlUnsub?.();
  tokenizeCtrlUnsub = ctrl.subscribe((s) => {
    for (const cb of tokenizePanelSubs) {
      cb({ enabled: s.enabled, showStatus: s.showStatus, showFrequency: s.showFrequency, subtitleEnabled: cachedSubtitleEnabled });
    }
  });
}

export function ensureUniversalPanelMount(): UniversalPanelMountController {
  if (!universalPanelMount) {
    // Initialize subtitle tokenize state from storage (async, fires once).
    void loadTokenizeSettings().then((ts) => {
      cachedSubtitleEnabled = isSubtitleTokenizeEnabledForUrl(ts, window.location.href);
      notifyPanelSubs();
    });

    universalPanelMount = mountUniversalPanel({
      panel: {
        getState: () => buildPanelState(),
        onToggle: (key) => {
          if (key === 'enabled') webTokenizeCtrl?.toggleEnabled();
          else if (key === 'showStatus') webTokenizeCtrl?.toggleShowStatus();
          else if (key === 'showFrequency') webTokenizeCtrl?.toggleShowFrequency();
          else if (key === 'subtitleEnabled') void toggleSubtitleTokenize();
        },
        onOpenDictionary: () => {
          void universalPanelMount?.open('dictionary');
        },
        subscribe: (cb) => {
          tokenizePanelSubs.add(cb);
          cb(buildPanelState());
          return () => { tokenizePanelSubs.delete(cb); };
        },
      },
    });
  }
  return universalPanelMount;
}

/** Toggle subtitle tokenize for this URL — persists to storage + notifies panel. */
async function toggleSubtitleTokenize(): Promise<void> {
  const ts = await loadTokenizeSettings();
  const url = window.location.href;
  const next = !isSubtitleTokenizeEnabledForUrl(ts, url);
  const updated = setSubtitleTokenizeEnabledForUrl(ts, url, next);
  await saveTokenizeSettings(updated);
  cachedSubtitleEnabled = next;
  notifyPanelSubs();
}

export function installTokenizeNavListeners(): void {
  const onTokenizeNav = (): void => {
    void loadTokenizeSettings().then((ts) => {
      cachedSubtitleEnabled = isSubtitleTokenizeEnabledForUrl(ts, window.location.href);
      notifyPanelSubs();
    });
  };
  window.addEventListener('yt-navigate-finish', onTokenizeNav);
  window.addEventListener('popstate', onTokenizeNav);
}

export function ensureWebTextCtrl(): WebTextDictionaryController {
  if (!webTextCtrl) {
    webTextCtrl = createWebTextDictionaryController({
      container: document.body ?? document.documentElement,
      dictionaryPopupSettings: DEFAULT_DICTIONARY_POPUP_SETTINGS,
      cardCreatorSettings: DEFAULT_CARD_CREATOR_SETTINGS,
      hasVideo: false,
      // Bridge popup status cycle → tokenize controller so token blocks rebind
      // with the new status instead of reverting from stale cache on rebind.
      // `webTokenizeCtrl` is module-level and may still be null on the first
      // lookup (tokenize init runs in parallel); the closure reads it lazily
      // at click time, by which point both controllers are ready.
      onStatusChange: (term, _langCode, status) => {
        webTokenizeCtrl?.applyStatusForTerm(term, status);
      },
      getTokenStatus: (term) => webTokenizeCtrl?.getStatusForTerm(term) ?? 'unknown',
      // ADR-065: generic universal panel controller toggled by the orbital badge.
      panelController: ensureUniversalPanelMount(),
    });
  }
  return webTextCtrl;
}

export function handleTokenizeStatusKey(key: string): boolean {
  return webTokenizeCtrl?.handleStatusKey?.(key) ?? false;
}

export async function initWebTextDictionary(): Promise<void> {
  try {
    const settings = await loadSettings();
    const dp = settings.dictionaryPopup;
    tokenLookupEnabled = dp?.enabled !== false;
    tokenLookupMode = dp?.triggerMode ?? 'click';
    const ctrl = ensureWebTextCtrl();
    ctrl.updateSettings({
      dictionaryPopup: dp ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
      cardCreator: settings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
      subtitleOverlayNativeLanguage: settings.subtitleOverlayNativeLanguage,
    });
    if (dp?.enabled) {
      findAndInitOverlay();
    }
  } catch (err) {
    // Storage may be unavailable in some test/sandbox contexts — safe fallback.
    console.warn('[content-script] initWebTextDictionary failed', err);
  }
}

export async function initTokenize(): Promise<void> {
  try {
    const settings = await loadSettings();
    const langCode = getActiveProfileSettings(settings)?.resourceLangCode
      ?? (settings.subtitleOverlayTargetLanguage || 'en');
    const showReadings = settings.showReadings ?? false;
    const showGlosses = settings.showWordTranslations ?? false;
    const glossTargetLanguage = settings.subtitleOverlayNativeLanguage ?? '';
    if (webTokenizeCtrl && tokenizeLang === langCode) {
      // Settings change mid-session: push the annotation toggles into the live
      // controller instead of rebuilding it (same path local-player takes).
      webTokenizeCtrl.setShowReadings?.(showReadings);
      webTokenizeCtrl.setShowGlosses?.(showGlosses);
      webTokenizeCtrl.setGlossTargetLanguage?.(glossTargetLanguage);
      return;
    }
    webTokenizeCtrl?.destroy();
    webTokenizeCtrl = null;
    stopTextScoreSource?.();
    stopTextScoreSource = null;
    tokenizeLang = langCode;
    webTokenizeCtrl = await createWebTokenizeController({
      url: window.location.href,
      root: document.body,
      langCode,
      showReadings,
      showGlosses,
      glossTargetLanguage,
      onOpenDictionary: (term, element, contextSentence, event) => {
        const ctrl = ensureWebTextCtrl();
        if (!tokenLookupEnabled || !modifierMatches(tokenLookupMode, event)) return;
        const start = parseInt(element.getAttribute('data-cell-start') ?? '0', 10);
        const wordEl = element.querySelector('.js-cell-token-word');
        const range = document.createRange();
        if (wordEl) {
          range.selectNodeContents(wordEl);
        } else {
          range.selectNodeContents(element);
        }
        ctrl.handleLookup(
          { term, langCode, contextSentence, cursorOffset: start },
          `tokenize-${term}`,
          element.getBoundingClientRect(),
          range,
        );
      },
      onStatusChange: (term, _langCode, status) => {
        ensureWebTextCtrl().syncStatus(term, status);
      },
      onBlocksChanged: () => {
        for (const listener of [...blocksChangedListeners]) listener();
      },
      getPopupStatusTarget: () => webTextCtrl?.getPopupStatusTarget() ?? null,
    });
    stopTextScoreSource = startTextScoreSource({
      controller: webTokenizeCtrl,
      store: comprehensionStore,
      langCode,
      onBlocksChanged: (listener) => {
        blocksChangedListeners.add(listener);
        return () => blocksChangedListeners.delete(listener);
      },
    });
    bindTokenizeCtrlSubs(webTokenizeCtrl);
    notifyPanelSubs();
  } catch (err) {
    // Storage may be unavailable in some test/sandbox contexts — safe fallback.
    console.warn('[content-script] initTokenize failed', err);
  }
}

// Re-init web-text dictionary when settings change (no page reload needed).
export function installSettingsReloader(): void {
  onStorageChanged((changes, area) => {
    if (window.self !== window.top) return;
    if (area === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
      void initWebTextDictionary();
      void initTokenize();
      void initComprehension();
    }
  });
}

// === OCR (Orca) + study mode — lazily loaded at runtime.
// `build:fast` skips these heavy optional features entirely at build time
// via the __CELL_FAST_BUILD__ compile-time flag.
export async function initHeavyFeatures(isTopFrame: boolean): Promise<void> {
  if (__CELL_FAST_BUILD__) return;
  window.addEventListener('vite:preloadError', (e) => e.preventDefault());
  const studyModeInit = import('@/features/studyModes/content/studyModeController')
    .then(({ initializeStudyModeController }) => initializeStudyModeController());
  try {
    const [{ initOcrContentScript }, { SubtitleTriggerController }] = await Promise.all([
      import('./ocrContentScript'),
      import('@/features/dictionaryPopup/trigger/subtitleTriggerController'),
    ]);
    function createOcrTriggerController(): SubtitleTriggerController | null {
      if (!isTopFrame) return null;
      const ctrl = ensureWebTextCtrl();
      return new SubtitleTriggerController({
        triggerMode: 'click',
        onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => {
          const range = document.createRange();
          range.selectNodeContents(highlightTarget);
          ctrl.handleLookup(request, requestId, anchorRect, range);
        },
        onCancel: (requestId: string) => { ctrl.cancelLookup(requestId); },
        onClear: () => { ctrl.dismissLookup(); },
      });
    }
    initOcrContentScript(createOcrTriggerController);
  } catch (err) {
    console.warn(
      '[content-script] initHeavyFeatures failed',
      err,
      err instanceof Error ? err.stack : '',
    );
  }
  await studyModeInit.catch((err) => console.warn('[content-script] study mode init failed', err));
}

let stopMediaScoreSource: (() => void) | null = null;
let mediaScoreLang: string | null = null;
let comprehensionPill: ComprehensionPillMount | null = null;
let stopTextScoreSource: (() => void) | null = null;
const blocksChangedListeners = new Set<() => void>();

export async function initComprehension(): Promise<void> {
  try {
    const settings = await loadSettings();
    const langCode = getActiveProfileSettings(settings)?.resourceLangCode
      ?? (settings.subtitleOverlayTargetLanguage || 'en');
    if (!comprehensionPill) {
      comprehensionPill = mountComprehensionPill({ store: comprehensionStore });
    }
    if (mediaScoreLang !== langCode) {
      stopMediaScoreSource?.();
      mediaScoreLang = langCode;
      stopMediaScoreSource = startMediaScoreSource({ langCode, store: comprehensionStore });
    }
  } catch (err) {
    console.warn('[content-script] initComprehension failed', err);
  }
}

export function cleanupFeatureInit(): void {
  webTextCtrl?.destroy();
  webTextCtrl = null;
  webTokenizeCtrl?.destroy();
  webTokenizeCtrl = null;
  tokenizeLang = null;
  tokenizeCtrlUnsub?.();
  tokenizeCtrlUnsub = null;
  universalPanelMount?.unmount?.();
  universalPanelMount = null;
  tokenizePanelSubs.clear();
  stopMediaScoreSource?.();
  stopMediaScoreSource = null;
  mediaScoreLang = null;
  stopTextScoreSource?.();
  stopTextScoreSource = null;
  blocksChangedListeners.clear();
  comprehensionPill?.destroy();
  comprehensionPill = null;
}
