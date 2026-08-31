import { sendMessage, onMessage, onStorageChanged, removeOnMessageListener, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { findVideoContainer } from '@/features/subtitle/logic/findPlayerContainer';
import type { SubtitleApiKey } from '@/entities/settings';
import type { ApplyStudyModePayload } from '@/entities/message';
import { getActiveStudyMode, subscribeToStudyMode } from '@/features/studyModes/content/studyModeController';
import { isoCodeToLabel } from '@/features/detection/logic/languageDetector';
import { useCuesStore } from '@/stores/cuesStore';
import { injectThemeTokens } from '@/shared/lib/themeTokens';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS, DEFAULT_SETTINGS, DEFAULT_CARD_CREATOR_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS, USE_LEGACY_SUBTITLE } from '@/shared/config/config';
import {
  parseAndDetectFiles,
  assignImportRole,
  createDragHint,
  showToast,
  createDebouncedToast,
  handleAutoLoadSubtitles,
  fetchAndParseSubtitle,
  resolveFormat,
  mergeCuesForPanel,
  handleShortcutKey,
  isEditableTarget,
  isEditableEvent,
  isInsideCellUi,
  formatSubtitleName,
  seekVideo,
  playVideo,
  pauseVideo,
  createTranslateFunction,
  broadcastCues,
  loadSettingsOrToast,
  navigateCue,
  toggleOverlayState,
  parseSubtitle,
} from '@/features/subtitle';
import { ReactSubtitleController } from '@/features/subtitle/ui/reactSubtitleController';
import { SubtitleSyncController } from '@/features/subtitle/ui/subtitleSyncController';
import { type SubtitleCueEngineUpdate, type CardCreatorAction } from '@/features/subtitle/ui/subtitleCueEngine';
import { loadTokenizeSettings, isSubtitleTokenizeEnabledForUrl } from '@/features/tokenize/services/tokenizeSettingsStore';
import type { SubtitleTokenizeController } from '@/features/tokenize/controller/subtitleTokenizeController';
import type { LookupRequest } from '@/features/dictionaryPopup/types';
import type { TokenizeSettings } from '@/features/tokenize/types';
import { BackgroundPrefillController } from '@/features/translate/logic/translatePrefill';
import { handleCardCreatorAction as sharedHandleCardCreatorAction } from '@/features/subtitle/actions/cardActions';
import { startGenerateNative } from '@/features/subtitle/actions/generateNativeAction';
import type { SubtitleActionContext } from '@/features/subtitle/actions/subtitleActionContext';

import type { WebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { BilingualCue, KeyboardShortcut, SrtCue, NavClusterSettings, SubtitleBlockSettings, Settings } from '@/entities/media';

import type { AutoLoadSubtitlesPayload, ResolveSubtitleDownloadResult } from '@/entities/message';
import type { SubtitlePanelItem, ParsedFile } from '@/features/subtitle';
import type { SubtitleSearchResult } from '@/features/subtitle/logic/subtitleSearchTypes';
// === Subtitle Overlay Integration ===

/** Load overlay style + block + cluster settings from chrome.storage.local, fallback to defaults. ADR-013, ADR-025. */
async function loadOverlaySettings(): Promise<{
  target: OverlayStyleConfig;
  native: OverlayStyleConfig;
  block: SubtitleBlockSettings;
  cluster: NavClusterSettings;
  settings: Settings;
}> {
  try {
    const settings = await loadSettings();
    return {
      target: settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET,
      native: settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE,
      block: settings.subtitleBlockSettings ?? DEFAULT_SUBTITLE_BLOCK_SETTINGS,
      cluster: {
        enabled: settings.navClusterEnabled,
        buttonSize: settings.navClusterButtonSize,
        textOpacity: settings.navClusterTextOpacity,
        bgOpacity: settings.navClusterButtonBgOpacity,
      },
      settings,
    };
  } catch {
    // ponytail: storage might not be available in test contexts — fallback
    return {
      target: DEFAULT_OVERLAY_STYLE_TARGET,
      native: DEFAULT_OVERLAY_STYLE_NATIVE,
      block: DEFAULT_SUBTITLE_BLOCK_SETTINGS,
      cluster: DEFAULT_NAV_CLUSTER_SETTINGS,
      settings: DEFAULT_SETTINGS,
    };
  }
}

/** Load keyboard shortcuts from chrome.storage.local, fallback to defaults. */
async function loadShortcuts(): Promise<KeyboardShortcut[]> {
  try {
    const settings = await loadSettings();
    if (settings.keyboardShortcuts?.length && settings.keyboardShortcuts.length > 0) {
      return settings.keyboardShortcuts;
    }
  } catch {
    // ponytail: storage might not be available in test contexts — fallback
  }
  return DEFAULT_KEYBOARD_SHORTCUTS;
}

// ADR-032 cue-seek dedupe — module-level so multiple init() instances
// (Netflix SPA re-init leaks onMessage listeners, see cleanup ponytail)
// share the same dedupe state. Without this, each instance has its own
// closure state → both seek → "khó sang cue" + "khựng".
let lastCueSeekAction: string | null = null;
let lastCueSeekTs = 0;
const CUE_SEEK_DEDUPE_MS = 300;
const shouldDedupeCueSeek = (action: string): boolean => {
  const now = Date.now();
  if (action === lastCueSeekAction && now - lastCueSeekTs < CUE_SEEK_DEDUPE_MS) {
    return true;
  }
  lastCueSeekAction = action;
  lastCueSeekTs = now;
  return false;
};

/** Load target/native language codes from settings.
 *  Used by import file role assignment + panel selection. */
async function loadTargetNativeLangs(): Promise<{ targetLang: string; nativeLang: string }> {
  try {
    const settings = await loadSettings();
    return {
      targetLang: settings.subtitleOverlayTargetLanguage ?? '',
      nativeLang: settings.subtitleOverlayNativeLanguage ?? '',
    };
  } catch {
    return { targetLang: '', nativeLang: '' };
  }
}

export function init(video: HTMLVideoElement, webTextCtrl?: WebTextDictionaryController): () => void {
  // T046: legacy vanilla subtitle overlay was removed; the React shadow-root UI is the only path.
  if (USE_LEGACY_SUBTITLE) {
    console.warn('[contentScriptController] USE_LEGACY_SUBTITLE=true but the legacy subtitle overlay has been removed; falling back to no overlay.');
    return () => {};
  }

  // ADR-008 D2: overlay UI neo vào video container — không cần F0, không cần
  // videoWrapper, không cần docking. Panel đã chuyển sang Chrome Side Panel.
  // G8: walk-up để xử lý sites có video.parentElement height=0 (YouTube pattern).
  const container = findVideoContainer(video);

  // ADR-015 T12: inject theme tokens so panel/toast var(--color-*) resolve.
  // Content-script isolated world cannot access popup's theme.css.
  injectThemeTokens(container);

  // ADR-025: live style/overlay settings. The block controller is created
  // synchronously so cue messages can be handled before storage finishes loading.
  let targetStyle: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_TARGET, visible: false };
  let nativeStyle: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_NATIVE, visible: false };
  let blockSettings: SubtitleBlockSettings = DEFAULT_SUBTITLE_BLOCK_SETTINGS;
  let clusterSettings: NavClusterSettings = DEFAULT_NAV_CLUSTER_SETTINGS;
  let settingsLoaded = false;
  let currentSettings: Settings | null = null;
  // ADR-019: offset controller (subtitle time offset)
  let offsetController: ReactSubtitleController | null = null;
  // Shared web-text dictionary controller (owned by top-level content-script).
  const sharedWebTextCtrl = webTextCtrl;
  // Subtitle sync state (source/cue/panel) is owned by SubtitleSyncController.
  // Track the URL the overlay currently shows cues for. On SPA navigation the
  // URL changes but `loadBilingualCues` uses ADR-014 D1 merge semantics (keep
  // old side when new side empty — designed for same-video incremental re-push).
  // Without a clear on URL change, a partial load on the new video (target
  // only, no native or vice versa) leaves the previous video's cues visible.
  let lastAutoLoadUrl: string | undefined;
  // Track last auto-load subtitle URLs to avoid duplicate re-runs when the
  // background re-pushes the same AUTO_LOAD_SUBTITLES payload (e.g. from
  // repeated PAGE_SCAN_RESULT or network re-detection on seek).
  let lastAutoLoadKey: string | undefined;
  // ADR-021: background prefill controller for target→native translation.
  // One instance per video session. Cleared on SPA nav. Paused on tab hidden.
  let translatePrefill: BackgroundPrefillController | null = null;
  // Generate-native run identity. Incremented per trigger; used to ignore stale
  // callbacks from a run that has been superseded while loading settings.
  let nextGenerateRunId = 0;
  let activeGenerateRunId = -1;
  let onStorageChangedCallback: ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void) | null = null;

  /** Update generate-native button disabled state based on target cues + settings. */
  function updateGenerateNativeEnabled(): void {
    const settings = currentSettings;
    const hasTarget = syncController.latestTargetCues.length > 0;
    const sl = settings?.subtitleOverlayTargetLanguage ?? '';
    const tl = settings?.subtitleOverlayNativeLanguage ?? '';
    const validLang = sl.length > 0 && tl.length > 0 && sl !== tl;
    blockController.setGenerateNativeEnabled(hasTarget && validLang && settingsLoaded);
  }

  const blockController = new ReactSubtitleController(
    video,
    container,
    blockSettings,
    targetStyle,
    nativeStyle,
    clusterSettings,
    (action) => { void handleCardCreatorAction(action); },
    () => { void handleGenerateNative(); },
  );

  // Subtitle sync controller owns active source, panel items, cue snapshots,
  // and virtual replacement slots. contentScriptController remains the
  // side-effect boundary: it fetches, parses, translates, and loads.
  const syncController = new SubtitleSyncController({
    getBlockController: () => blockController,
    showOverlay: () => { showOverlay(); },
    syncSidePanelFromBlock: () => { syncSidePanelFromBlock(); },
    getContainer: () => container,
    getCurrentSettings: () => currentSettings,
  });

  /** Clear the in-memory translated native slot (used when target changes or SPA nav). */
  function clearTranslatedNativeState(): void {
    syncController.clearTranslatedNativeState();
    activeGenerateRunId = -1;
  }

  // Apply the active study mode to the current video, and keep it in sync
  // when the user changes it from the panel. P1: subtitle visibility + speed.
  // Pause/repeat/after/loop state machine is a known ceiling (ponytail).
  const initialStudyMode = getActiveStudyMode();
  if (initialStudyMode) {
    blockController.applyStudyMode(initialStudyMode.activeMode, initialStudyMode.advanced);
  }
  const unsubscribeStudyMode = subscribeToStudyMode((next) => {
    if (next) blockController.applyStudyMode(next.activeMode, next.advanced);
  });

  /** Build SubtitleActionContext from current controller state — shared action
   *  functions (cardActions.ts) use this to access video, cues, settings, etc.
   *  Built lazily on each call so it always reflects current state. */
  function buildActionContext(): SubtitleActionContext {
    return {
      video,
      container,
      webTextCtrl: sharedWebTextCtrl,
      getTargetCues: () => blockController.getTargetCues(),
      getNativeCues: () => blockController.getNativeCues(),
      getCurrentTargetText: () => blockController.getCurrentTargetText(),
      getCurrentNativeText: () => blockController.getCurrentNativeText(),
      getOffsetMs: () => offsetController?.getOffsetMs() ?? 0,
      showToast: (message, options) => { showToast(message, container, options); },
      loadSettingsOrToast: (c) => loadSettingsOrToast(c),
    };
  }

  // Subtitle tokenize controller — injects token spans into subtitle line elements.
  // Independent from web tokenize: toggled via `subtitleUrls` in TokenizeSettings.
  let subtitleTokenizeCtrl: SubtitleTokenizeController | null = null;

  // Hook cue updates → re-render subtitle token spans when active index changes.
  // Deferred via requestAnimationFrame: React re-renders SubtitleBlock on cue
  // change (useCuesStore update), which overwrites token spans with plain text.
  // Waiting one frame ensures the controller injects AFTER React commits.
  blockController.onCuesUpdated = () => {
    if (!subtitleTokenizeCtrl) return;
    const { target, native } = blockController.getActiveIndices();
    requestAnimationFrame(() => {
      subtitleTokenizeCtrl?.render(target, native);
    });
  };

  /** Enable/disable subtitle tokenize based on current settings and tokenize settings. */
  async function syncSubtitleTokenize(tokenizeSettings?: TokenizeSettings): Promise<void> {
    const settings = currentSettings;
    if (!settings?.subtitleOverlayTargetLanguage) {
      subtitleTokenizeCtrl?.disable();
      blockController.disableTokenize();
      return;
    }
    try {
      const ts = tokenizeSettings ?? (await loadTokenizeSettings());
      const url = window.location.href;
      const enabled = isSubtitleTokenizeEnabledForUrl(ts, url);
      if (enabled) {
        // Create controller lazily — needs blockController ready for getLineElements.
        // Dynamic import breaks subtitle→tokenize→dictionaryPopup→subtitle cycle (TDZ).
        if (!subtitleTokenizeCtrl) {
          const { createSubtitleTokenizeController } = await import('@/features/tokenize/controller/subtitleTokenizeController');
          subtitleTokenizeCtrl = createSubtitleTokenizeController({
            langCode: settings.subtitleOverlayTargetLanguage,
            getLineElements: () => blockController.getLineElements(),
            onOpenDictionary: (term, element, contextSentence) => {
              if (!sharedWebTextCtrl) return;
              const request: LookupRequest = {
                term,
                langCode: settings.subtitleOverlayTargetLanguage,
                contextSentence,
                cursorOffset: Number(element.getAttribute('data-cell-start') ?? 0),
              };
              const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              sharedWebTextCtrl.handleLookup(request, requestId, element.getBoundingClientRect(), element);
            },
          });
        }
        subtitleTokenizeCtrl.enable();
        // Feed current cues + render active line.
        const targetCues = blockController.getTargetCues();
        const nativeCues = blockController.getNativeCues();
        subtitleTokenizeCtrl.setCues(targetCues, nativeCues);
        const { target: activeTarget, native: activeNative } = blockController.getActiveIndices();
        subtitleTokenizeCtrl.render(activeTarget, activeNative);
        blockController.enableTokenize({
          langCode: settings.subtitleOverlayTargetLanguage,
          onOpenDictionary: (term, element, contextSentence) => {
            if (!sharedWebTextCtrl) return;
            const request: LookupRequest = {
              term,
              langCode: settings.subtitleOverlayTargetLanguage,
              contextSentence,
              cursorOffset: Number(element.getAttribute('data-cell-start') ?? 0),
            };
            const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            sharedWebTextCtrl.handleLookup(request, requestId, element.getBoundingClientRect(), element);
          },
        });
      } else {
        subtitleTokenizeCtrl?.disable();
        blockController.disableTokenize();
      }
    } catch {
      // ponytail: tokenize settings not available — keep subtitle plain
    }
  }

  /** ADR-026: Handle Card Creator action — delegates to shared cardActions module. */
  async function handleCardCreatorAction(action: CardCreatorAction): Promise<void> {
    await sharedHandleCardCreatorAction(buildActionContext(), action);
  }

  /** Generate native subtitle by translating the active target cues into the
   *  configured native language. Reuses shared startGenerateNative core + creates
   *  a single in-memory translated manager entry (virtual replacement). */
  async function handleGenerateNative(): Promise<void> {
    const runId = nextGenerateRunId++;
    activeGenerateRunId = runId;

    // Cancel any existing prefill (auto-translate or previous generate).
    translatePrefill?.clear();
    translatePrefill = null;

    // Snapshot current state before the async generate-native gap.
    const snapshot = syncController.getGenerateNativeSnapshot();

    // Create the translated manager entry upfront (shown as "translating…").
    // The actual cues arrive via onChunkTranslated callback.
    const result = await startGenerateNative(snapshot.targetCues, {
      onChunkTranslated: (translatedCues: SrtCue[]) => {
        if (activeGenerateRunId !== runId || !syncController.translatedNativeSlot || syncController.translatedNativeSlot.runId !== runId) return;
        syncController.translatedNativeSlot.cues = translatedCues;
        blockController?.loadBilingualCues(snapshot.targetCues, translatedCues);
        showOverlay();
        bilingualCues = mergeCuesForPanel(snapshot.targetCues, translatedCues);
        broadcastCues(bilingualCues);
        refreshPanel('native');
      },
      onError: (msg: string) => {
        if (activeGenerateRunId !== runId || !syncController.translatedNativeSlot || syncController.translatedNativeSlot.runId !== runId) return;
        showToast(msg, container, { variant: 'error' });
        updateGenerateNativeEnabled();
      },
      onComplete: () => {
        if (activeGenerateRunId !== runId || !syncController.translatedNativeSlot || syncController.translatedNativeSlot.runId !== runId) return;
        showToast('Native subtitle generated', container, { variant: 'success' });
        updateGenerateNativeEnabled();
      },
    });

    // Abort if a newer run has superseded this one while loading settings.
    if (activeGenerateRunId !== runId) return;

    if (!result) {
      // Validation failed — show error + re-enable button.
      const settings = await loadSettings();
      currentSettings = settings;
      const sl = settings.subtitleOverlayTargetLanguage ?? '';
      const tl = settings.subtitleOverlayNativeLanguage ?? '';
      const error = !sl || !tl || sl === tl
        ? 'Target and native languages must differ'
        : 'No target subtitle to translate';
      showToast(error, container, { variant: 'info' });
      updateGenerateNativeEnabled();
      return;
    }

    // Create the translated manager entry now that validation passed.
    const translatedItem: SubtitlePanelItem = {
      id: 'translated-native',
      name: `${result.nativeLabel} (translated)`,
      format: snapshot.targetFormat,
      size: snapshot.targetSize,
      source: 'translated',
      role: 'native',
      index: 0,
    };
    syncController.translatedNativeSlot = {
      replacedSource: snapshot.replacedSource,
      replacedIndex: snapshot.replacedIndex,
      item: translatedItem,
      cues: [],
      runId,
    };
    syncController.activeNativeSource = 'translated';
    refreshPanel('native');
    showToast('Generating native subtitle…', container, { variant: 'info' });
    blockController.setGenerateNativeEnabled(false);

    // Store the prefill controller (already started by startGenerateNative).
    translatePrefill = result.prefill;
    currentSettings = await loadSettings();
  }

  loadOverlaySettings().then(async ({ target, native, block, cluster, settings }) => {
    currentSettings = settings;
    blockSettings = block;
    clusterSettings = cluster;
    targetStyle = { ...target, visible: overlayVisible };
    nativeStyle = { ...native, visible: overlayVisible };
    settingsLoaded = true;
    blockController.updateSettings({
      blockSettings,
      targetStyle,
      nativeStyle,
      clusterSettings,
    });
    updateGenerateNativeEnabled();

    // Popup dictionary: wire shared web-text controller for subtitle tokens.
    const dpSettings = settings.dictionaryPopup;
    if (sharedWebTextCtrl) {
      sharedWebTextCtrl.updateSettings({
        dictionaryPopup: dpSettings ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
        cardCreator: settings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
        subtitleOverlayNativeLanguage: settings.subtitleOverlayNativeLanguage,
      });
      // Always configure video reference — the popup can be triggered via
      // tokenize controller (which bypasses dp.enabled), and Quick Add needs
      // the video for screenshot + sentence audio recording. Without this,
      // dp.enabled=false → configureVideo skipped → video null → no pause,
      // no screenshot, no recording (even though popup still opens via tokenize).
      sharedWebTextCtrl.configureVideo({
        hasVideo: true,
        video,
        getTargetCues: () => blockController.getTargetCues(),
      });
      if (dpSettings?.enabled) {
        blockController.enableDictionaryPopup(
          dpSettings.triggerMode,
          (request, requestId, anchorRect, tokenSpan) => {
            sharedWebTextCtrl?.handleLookup(request, requestId, anchorRect, tokenSpan);
          },
          (requestId) => { sharedWebTextCtrl?.cancelLookup(requestId); },
          // Auto-dismiss on hover-leave removed: popup only closes on explicit
          // user action (click outside / Esc / close button).
        );
      } else {
        blockController.disableDictionaryPopup();
      }
    }

    // Tokenize on media: enable if configured for this URL (T14/T15).
    await syncSubtitleTokenize();

    // ADR-015 UI v4 / ADR-027: manager/offset live inside the React SubtitlePanels.
    // Wire manager select, file import, and side-panel toggle callbacks.
    offsetController = blockController;
    offsetController.init();
    blockController.onManagerSelect = (role, index) => { void onManagerSelect(role, index); };
    blockController.onImportFiles = (_role, files) => { void processImportedFiles(Array.from(files), container); };
    blockController.onToggleSidePanel = toggleSidePanel;
    // OCR toggle: post message to OCR content script (same page) to toggle
    // ocrEnabled for current origin. OCR content script handles storage save.
    blockController.onToggleOcr = () => {
      window.postMessage({ type: '__CELL_OCR_TOGGLE' }, '*');
    };
    blockController.onSearchResultSelect = (result, role) => { void handleSearchResultSelect(result, role); };
    blockController.setHasSearchKeys(hasSearchKeys());
    blockController.setSearchApiKeys(currentSettings?.subtitleApiKeys ?? []);
    blockController.onApiKeysChange((keys) => { void handleApiKeysChange(keys); });
    // Force re-render with the new callbacks.
    blockController.refreshManagerState();
    // ADR-025: offset provider already wired in ReactSubtitleController constructor.

    // Listen for OCR state changes from ocrContentScript → update toolbar button.
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const d = e.data as { type?: string; enabled?: boolean };
      if (d?.type === '__CELL_OCR_STATE' && typeof d.enabled === 'boolean') {
        blockController?.setOcrEnabled(d.enabled);
      }
    });

    // ADR-013 D3 + ADR-025: listen chrome.storage.onChanged → update block controller realtime
    onStorageChangedCallback = (changes, area) => {
      if (area !== 'local') return;
      const newSettings = changes.settings?.newValue as Settings | undefined;
      if (newSettings) {
        currentSettings = newSettings;
        // Live-update search keys state when settings change externally.
        const keys = newSettings.subtitleApiKeys ?? [];
        blockController?.setHasSearchKeys(keys.length > 0);
        blockController?.setSearchApiKeys(keys);
      }
      if (newSettings?.subtitleOverlayTargetStyle) {
        targetStyle = { ...newSettings.subtitleOverlayTargetStyle, visible: overlayVisible };
      }
      if (newSettings?.subtitleOverlayNativeStyle) {
        nativeStyle = { ...newSettings.subtitleOverlayNativeStyle, visible: overlayVisible };
      }
      if (newSettings?.subtitleBlockSettings) {
        blockSettings = { ...newSettings.subtitleBlockSettings };
      }
      const clusterPartial: Partial<NavClusterSettings> = {
        ...(newSettings?.navClusterEnabled !== undefined && { enabled: newSettings.navClusterEnabled }),
        ...(newSettings?.navClusterButtonSize !== undefined && { buttonSize: newSettings.navClusterButtonSize as NavClusterSettings['buttonSize'] }),
        ...(newSettings?.navClusterTextOpacity !== undefined && { textOpacity: newSettings.navClusterTextOpacity }),
        ...(newSettings?.navClusterButtonBgOpacity !== undefined && { bgOpacity: newSettings.navClusterButtonBgOpacity }),
      };
      if (Object.keys(clusterPartial).length > 0) {
        clusterSettings = { ...clusterSettings, ...clusterPartial };
      }
      const update: SubtitleCueEngineUpdate = {
        ...(newSettings?.subtitleOverlayTargetStyle && { targetStyle }),
        ...(newSettings?.subtitleOverlayNativeStyle && { nativeStyle }),
        ...(newSettings?.subtitleBlockSettings && { blockSettings }),
        ...(Object.keys(clusterPartial).length > 0 && { clusterSettings: clusterPartial }),
      };
      if (Object.keys(update).length > 0) blockController.updateSettings(update);
      // Reload keyboard shortcuts so remaps (e.g. 't' → 'y') take effect
      // without a page reload. loadShortcuts reads from the new settings.
      if (newSettings?.keyboardShortcuts) {
        loadShortcuts().then((s) => { shortcuts = s; }).catch((err) => console.warn('[content-script] Failed to reload shortcuts:', err));
      }
      // Tokenize on media: react to per-URL tokenize setting changes in real time.
      const tokenizeSettings = changes.tokenizeSettings?.newValue as TokenizeSettings | undefined;
      if (tokenizeSettings) {
        void syncSubtitleTokenize(tokenizeSettings);
      } else if (newSettings?.subtitleOverlayTargetLanguage) {
        // Target language changed — re-evaluate with current tokenize settings.
        void syncSubtitleTokenize();
      }

      // Live-update dictionary popup settings (defaultActiveTab, triggerMode, etc.)
      // without requiring a page reload.
      if (newSettings?.dictionaryPopup && sharedWebTextCtrl) {
        sharedWebTextCtrl.updateSettings({
          dictionaryPopup: newSettings.dictionaryPopup,
          cardCreator: newSettings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
          subtitleOverlayNativeLanguage: newSettings.subtitleOverlayNativeLanguage,
        });
        // Always configure video reference — popup can be triggered via tokenize
        // even when dp.enabled=false. See init() block above for full rationale.
        sharedWebTextCtrl.configureVideo({
          hasVideo: true,
          video,
          getTargetCues: () => blockController.getTargetCues(),
        });
        if (newSettings.dictionaryPopup.enabled) {
          blockController.enableDictionaryPopup(
            newSettings.dictionaryPopup.triggerMode,
            (request, requestId, anchorRect, tokenSpan) => {
              sharedWebTextCtrl?.handleLookup(request, requestId, anchorRect, tokenSpan);
            },
            (requestId) => { sharedWebTextCtrl?.cancelLookup(requestId); },
            // Auto-dismiss on hover-leave removed: popup only closes on explicit
            // user action (click outside / Esc / close button).
          );
        } else {
          blockController.disableDictionaryPopup();
        }
      }
    };
    onStorageChanged(onStorageChangedCallback);
  }).catch((err) => {
    console.error('[content-script] Failed to load overlay settings:', err);
  });

  // === State ===
  let overlayVisible = false; // ponytail: match overlay initial display:none

  // ADR-025: auto-show overlay when cues load. Without this, block stays hidden
  // (visible=false) even after auto-load/import — user had to press shortcut.
  function showOverlay(): void {
    if (overlayVisible) return;
    overlayVisible = true;
    targetStyle = { ...targetStyle, visible: true };
    nativeStyle = { ...nativeStyle, visible: true };
    blockController.updateSettings({ targetStyle, nativeStyle });
    blockController.syncHiddenState();
  }
  let bilingualCues: BilingualCue[] = [];
  // Track side panel open state for toggle (☰ button).
  // ponytail ceiling: best-effort — if user closes panel via browser UI (X),
  // this stays true and next click sends CLOSE (no-op, panel already closed),
  // then the following click sends OPEN. Upgrade: sidepanel notify background
  // on close via chrome.runtime.connect port disconnect → background tracks
  // state → content-script queries before toggle.
  let sidePanelOpen = false;
  let shortcuts: KeyboardShortcut[] = DEFAULT_KEYBOARD_SHORTCUTS;

  // ADR-033: track last seek target so rapid cue-nav (A/S/D pressed before
  // Netflix player.seek() settles) computes next/prev from the INTENDED
  // position, not stale video.currentTime. Netflix seek behavior:
  //   - Forward seek: currentTime advances gradually (fast-play) toward target
  //   - Backward seek: currentTime sticks at old pos, then jumps to target
  // video.seeking unreliable (only true ~2ms). Use |videoMs - lastSeekTarget|
  // > 50ms AND seek < 1s ago to detect in-progress. Time guard clears stale
  // lastSeekTarget after video has advanced past target via normal playback.
  // Listener catches ALL seeks (keydown, NavCluster, Side Panel, external).
  let lastSeekTargetMs: number | null = null;
  let lastSeekTime = 0;
  const SEEK_SETTLE_TOLERANCE_MS = 50;
  const SEEK_STALE_MS = 1000;
  const onNfSeek = (e: Event) => {
    lastSeekTargetMs = (e as CustomEvent).detail as number;
    lastSeekTime = Date.now();
  };
  document.addEventListener('__NF_SEEK', onNfSeek);

  /** Effective time for cue lookup: lastSeekTarget if seek in progress, else video.currentTime. */
  const getEffectiveMs = (): number => {
    const offsetMs = offsetController?.getOffsetMs() ?? 0;
    const videoMs = video.currentTime * 1000;
    // Seek in progress: video hasn't reached target AND seek was recent.
    if (
      lastSeekTargetMs !== null &&
      Math.abs(videoMs - lastSeekTargetMs) > SEEK_SETTLE_TOLERANCE_MS &&
      Date.now() - lastSeekTime < SEEK_STALE_MS
    ) {
      return lastSeekTargetMs + offsetMs;
    }
    // Settled or stale → use actual video time
    lastSeekTargetMs = null;
    return videoMs + offsetMs;
  };

  /**
   * Build merged panel items for a role and push them into the React manager.
   * SubtitleSyncController owns the source/panel state; this thin wrapper
   * applies the side effect to the block controller.
   */
  const refreshPanel = (role: 'target' | 'native'): void => {
    const { items, activeIndex } = syncController.getPanelState(role);
    blockController.updateManagerItems(role, items, activeIndex);
  };

  /** ADR-015: after a manager selection changes the overlay cues, recompute the
   *  side-panel bilingual cues from the block controller's merged state and
   *  broadcast SUBTITLE_CUES_LOADED so the Side Panel syncs to the selection.
   *  loadBilingualCues uses D1 merge (keeps the other side when one is empty),
   *  so reading getTargetCues/getNativeCues after it yields the correct pair. */
  const syncSidePanelFromBlock = (): void => {
    bilingualCues = mergeCuesForPanel(
      blockController.getTargetCues() as SrtCue[],
      blockController.getNativeCues() as SrtCue[],
    );
    broadcastCues(bilingualCues);
  };
  // ADR-015 T7: debounced toast (collapses rapid import/switch messages)
  const debouncedToast = createDebouncedToast(showToast, 500);

  // Load shortcuts from storage
  loadShortcuts().then((s) => { shortcuts = s; }).catch((err) => console.warn('[content-script] Failed to load shortcuts:', err));

  // Toggle Side Panel open/close (ADR-008 D1). Shared by React tools button + 't'
  // keyboard shortcut. sidePanelOpen tracks best-effort state (see ceiling
  // note above).
  function toggleSidePanel(): void {
    if (sidePanelOpen) {
      sidePanelOpen = false;
      void sendMessage({
        type: MESSAGE_TYPES.CLOSE_SIDE_PANEL,
        payload: { tabId: undefined }, // background resolves from sender.tab.id
      });
    } else {
      sidePanelOpen = true;
      void sendMessage({
        type: MESSAGE_TYPES.OPEN_SIDE_PANEL,
        payload: { tabId: undefined }, // background resolves from sender.tab.id
      });
    }
  }

  // Manager panel is created asynchronously inside loadOverlayStyles().then()
  // so it can reuse the import button created by SubtitleOverlayController.

  // Wire keyboard shortcuts. window capture phase (3rd arg = true) so we fire
  // BEFORE host keydown listeners (e.g. YouTube 't' = theater mode, space =
  // play/pause) and can block them via stopImmediatePropagation when the key
  // matches a configured action. See ADR-034 (listener on window, not document).
  const onKeydown = (e: KeyboardEvent) => {
    // Rule: when focus is inside Cell UI (shadow DOM), block ALL host shortcuts
    // so the host page doesn't react to keys the user intends for Cell UI.
    // Cell's own shortcuts are processed below before this guard returns.
    // Escape is always allowed through so panels can close.
    const insideCellUi = isInsideCellUi(e);

    // Chrome hides the side panel when a tab enters fullscreen (Chromium
    // commit 6c6eb90, bug 1249462). sidePanel.open() in fullscreenchange
    // fails (no user gesture). But the 'f' keydown that triggers fullscreen
    // IS a user gesture — so re-open the panel synchronously here, before
    // YouTube's fullscreen handler runs. Chrome will hide the panel when
    // fullscreen completes, but the re-open keeps it visible.
    // ponytail ceiling: only covers 'f' key, not UI fullscreen button click.
    // Upgrade: if Chrome exposes a "keep visible in fullscreen" flag, drop this.
    if (!isEditableTarget(e.target) && e.key.toLowerCase() === 'f' && sidePanelOpen) {
      void sendMessage({
        type: MESSAGE_TYPES.OPEN_SIDE_PANEL,
        payload: { tabId: undefined },
      });
    }
    // ADR-019: fixed parallel offset shortcuts `[` `]` `{` `}` `\` (ponytail: not in
    // ShortcutAction union — avoid config UI bloat, like NavCluster fixed shortcuts).
    // Guard: skip when focus in editable (input/textarea/contenteditable) — avoid YouTube search conflict.
    // Guard: skip when focus inside Cell UI — user is interacting with panel, not video.
    if (!isEditableTarget(e.target) && !insideCellUi) {
      const key = e.key.toLowerCase();
      if (key === '[' || key === ']' || key === '{' || key === '}' || key === '\\') {
        if (offsetController) {
          e.preventDefault();
          switch (key) {
            case '[': // -0.5s (accumulate)
              offsetController.stepBy(-500);
              break;
            case ']': // +0.5s
              offsetController.stepBy(500);
              break;
            case '{': // -2s
              offsetController.stepBy(-2000);
              break;
            case '}': // +2s
              offsetController.stepBy(2000);
              break;
            case '\\': // reset
              offsetController.reset();
              break;
          }
        }
      }
    }

    // Skip configured shortcuts when focus is inside Cell UI — user is
    // interacting with a panel (manager, settings, etc.), not the video.
    const action = insideCellUi ? null : handleShortcutKey(e.key.toLowerCase(), shortcuts, e.target, {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    });
    if (!action) {
      // Player Mode: block ALL host keyboard shortcuts (host page is covered by
      // backdrop, no host interaction should work). Let Escape through so the
      // overlay's window listener can exit Player Mode / close CueList.
      if (blockController.isPlayerModeActive && e.key !== 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      // Cell UI: block ALL host shortcuts when focus is inside Cell UI panels
      // (manager, settings, card creator, etc.). Let Escape through so panels
      // can close via their own React keydown handlers.
      // Exception: when focus is in an editable element (input/textarea/select/
      // contenteditable) inside the shadow DOM, don't preventDefault — that
      // blocks character insertion. `e.target` is retargeted to the shadow host,
      // so use `isEditableEvent` which checks `composedPath()[0]`.
      if (insideCellUi && e.key !== 'Escape' && !isEditableEvent(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }

    // Context-aware T: in Player Mode, let PlayerModeOverlay's keydown handle
    // 't' (toggles CueList). Don't preventDefault/stopImmediatePropagation —
    // the overlay's window listener needs to receive the event.
    if (action === 'toggle-panel' && blockController.isPlayerModeActive) return;

    // Block YouTube's own shortcuts (e.g. 't' = theater mode) + other
    // same-target listeners so only our action runs.
    e.preventDefault();
    e.stopImmediatePropagation();

    // ADR-032: dedupe cue-nav when Side Panel also fires SHORTCUT_ACTION.
    if ((action === 'prev-cue' || action === 'next-cue' || action === 'replay-cue') && shouldDedupeCueSeek(action)) {
      return;
    }

    switch (action) {
      case 'prev-cue':
      case 'next-cue':
      case 'replay-cue': {
        // ADR-019 sync: find cue via effective time, seek so overlay DISPLAYS it.
        // ADR-033: use getEffectiveMs so rapid press computes from intended pos.
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = getEffectiveMs();
        navigateCue(action, video, bilingualCues, effectiveMs, offsetMs);
        break;
      }
      case 'toggle-overlay': {
        const result = toggleOverlayState(overlayVisible, targetStyle, nativeStyle);
        overlayVisible = result.overlayVisible;
        targetStyle = result.targetStyle;
        nativeStyle = result.nativeStyle;
        blockController.updateSettings({ targetStyle, nativeStyle });
        blockController.syncHiddenState();
        break;
      }
      case 'toggle-panel': {
        // Page thường: toggle Split View (CueList beside video container).
        // Player Mode: already returned early above (PlayerModeOverlay handles 't').
        blockController.toggleSplitView();
        break;
      }
      case 'toggle-player-mode': {
        blockController.togglePlayerMode();
        break;
      }
      case 'toggle-translate': {
        // ADR-021 D7: temporary toggle (no setting change). Same logic as
        // SHORTCUT_ACTION handler above — extract to shared helper if grows.
        if (translatePrefill?.isRunning) {
          translatePrefill.clear();
          translatePrefill = null;
          blockController?.loadBilingualCues(syncController.latestTargetCues, []);
          bilingualCues = mergeCuesForPanel(syncController.latestTargetCues, []);
          // latestNativeCues tracked by blockController — no longer needed here
          // updateCues(syncController.latestTargetCues, []);
          showToast('Auto-translate off', container, { variant: 'info' });
        } else if (syncController.latestTargetCues.length > 0) {
          void (async () => {
            const s = await loadSettings();
            const sl = s.subtitleOverlayTargetLanguage;
            const tl = s.subtitleOverlayNativeLanguage;
            if (!sl || !tl || sl === tl) return;
            translatePrefill?.clear();
            translatePrefill = new BackgroundPrefillController({
              translate: createTranslateFunction(sl, tl),
              onChunkTranslated: (translatedCues: SrtCue[]) => {
                blockController?.loadBilingualCues(syncController.latestTargetCues, translatedCues);
                showOverlay();
                bilingualCues = mergeCuesForPanel(syncController.latestTargetCues, translatedCues);
                // updateCues(syncController.latestTargetCues, translatedCues);
                broadcastCues(bilingualCues);
              },
              onError: (msg: string) => {
                showToast(msg, container, { variant: 'error' });
              },
            });
            translatePrefill.start(syncController.latestTargetCues, sl, tl);
            showToast('Auto-translate on', container, { variant: 'success' });
          })();
        }
        break;
      }
      case 'play-pause': {
        // ADR-030: route through playVideo/pauseVideo to avoid Netflix M7375.
        if (video.paused) {
          playVideo(video).catch(() => { /* autoplay may be blocked */ });
        } else {
          pauseVideo(video);
        }
        break;
      }
      // ADR-026: Card Creator entry shortcuts (q quick-update, e edit-card).
      // Guard: dialog open → let dialog handle keys. auto-repeat → no action.
      case 'quick-update':
      case 'edit-card': {
        if (e.repeat) return;
        if (sharedWebTextCtrl?.isCardCreatorOpen()) return;
        void handleCardCreatorAction(action);
        break;
      }
      // Generate native subtitle manually (button or shortcut).
      case 'generate-native': {
        void handleGenerateNative();
        break;
      }
    }
  };
  // ADR-034: listen on window capture (not document capture) so Cell fires
  // BEFORE host keydown listeners (e.g. YouTube space = play/pause). window is
  // the topmost ancestor — capture phase runs window → document → target.
  // stopImmediatePropagation here blocks ALL downstream listeners (document,
  // body, target, bubble) so host's space handler never runs when Cell handles it.
  // ponytail ceiling: if a host listens on window capture AND registers before
  // Cell, it runs first. Upgrade: CDP Input.dispatchKeyEvent interception.
  window.addEventListener('keydown', onKeydown, true);

  // ADR-034 D2: also block keyup for configured actions. YouTube handles
  // space on keyup (not keydown) — if Cell pauses on keydown but lets keyup
  // through, YouTube's keyup handler plays the video again (double-toggle).
  // Same guard as keydown: skip editable targets, only block configured keys.
  const onKeyup = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;
    // Block host keyup when focus is inside Cell UI (mirrors keydown guard).
    // Skip editable elements inside shadow DOM (composedPath check) so typing
    // in inputs/textareas isn't blocked.
    if (isInsideCellUi(e) && !isEditableEvent(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const action = handleShortcutKey(e.key.toLowerCase(), shortcuts, e.target, {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    });
    if (action) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('keyup', onKeyup, true);

  // Wire timeupdate → send VIDEO_TIME_UPDATE to Side Panel (via background)
  // ponytail: throttle to ~4fps to avoid message flooding (timeupdate fires ~60fps)
  let lastTimeUpdateSent = 0;
  video.addEventListener('timeupdate', () => {
    const now = performance.now();
    if (now - lastTimeUpdateSent < 250) return; // 4fps throttle
    lastTimeUpdateSent = now;
    void sendMessage({
      type: MESSAGE_TYPES.VIDEO_TIME_UPDATE,
      payload: {
        tabId: undefined,
        currentTimeMs: video.currentTime * 1000,
        durationMs: video.duration * 1000 || 0,
        // ADR-019 sync: send offset so side panel highlights the cue the
        // overlay displays (effective = currentTimeMs + offsetMs), not the
        // raw-time cue. Lazy read — offset may change between updates.
        offsetMs: offsetController?.getOffsetMs() ?? 0,
      },
    });
  });

  // Wire play/pause → send VIDEO_PLAY_STATE to Side Panel
  video.addEventListener('play', () => {
    void sendMessage({
      type: MESSAGE_TYPES.VIDEO_PLAY_STATE,
      payload: { tabId: undefined, isPlaying: true },
    });
  });
  video.addEventListener('pause', () => {
    void sendMessage({
      type: MESSAGE_TYPES.VIDEO_PLAY_STATE,
      payload: { tabId: undefined, isPlaying: false },
    });
  });

  // Receive SEEK_TO from Side Panel (via background relay) → seek video
  // msg is `unknown` per onMessage signature; narrow to { type?, payload? }
  // for property access. Safe because chrome.runtime messages are plain objects.
  const onRuntimeMessage = (msg: unknown, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
    const m = msg as { type?: string; payload?: unknown };
    // Background relays CLOSE_SIDE_PANEL back to this content script via
    // tabs.sendMessage after closing the panel. Reset our toggle state so the
    // next 'p' on the page opens instead of sending a stale CLOSE no-op.
    // (X-button close remains a known ceiling — background doesn't see it.)
    if (m?.type === MESSAGE_TYPES.CLOSE_SIDE_PANEL) {
      sidePanelOpen = false;
    }
    if (m?.type === MESSAGE_TYPES.SEEK_TO) {
      const timeMs = (m.payload as { timeMs: number })?.timeMs;
      if (timeMs !== undefined) {
        // ADR-019 sync: side panel clicks cue.start (raw) → seek so overlay
        // DISPLAYS that cue → shift by -offsetMs (mirror seekToCue logic).
        // ADR-030: route through seekVideo to avoid Netflix M7375.
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        seekVideo(video, (timeMs - offsetMs) / 1000);
      }
    }
    // Receive TOGGLE_PLAY from Side Panel (via background relay) → toggle play/pause
    if (m?.type === MESSAGE_TYPES.TOGGLE_PLAY) {
      // ADR-030: route through playVideo/pauseVideo to avoid Netflix M7375.
      if (video.paused) {
        playVideo(video).catch(() => { /* autoplay may be blocked */ });
      } else {
        pauseVideo(video);
      }
    }
    // Receive SHORTCUT_ACTION from Side Panel (via background relay) →
    // cue navigation. ADR-021 D8: if seekTime provided (from sidepanel's local
    // calculation), seek directly — avoids stale video.currentTime at arrival.
    // Fallback: calculate from video.currentTime (for in-page keydown handler).
    if (m?.type === MESSAGE_TYPES.SHORTCUT_ACTION) {
      const payload = m.payload as { action: string; seekTime?: number };
      const action = payload?.action;
      // ADR-032: dedupe cue-nav — in-page keydown handler already seeked.
      if ((action === 'prev-cue' || action === 'next-cue' || action === 'replay-cue') && shouldDedupeCueSeek(action)) {
        return;
      }
      const offsetMs = offsetController?.getOffsetMs() ?? 0;
      // ADR-021 D8: sidepanel sends seekTime (calculated at keypress time).
      // Seek directly — no need to find cue from stale video.currentTime.
      if (payload?.seekTime !== undefined && (action === 'prev-cue' || action === 'next-cue' || action === 'replay-cue')) {
        // ADR-030: route through seekVideo to avoid Netflix M7375.
        seekVideo(video, (payload.seekTime - offsetMs) / 1000);
      } else {
        // Fallback: calculate from video.currentTime (in-page keydown path)
        // ADR-033: use getEffectiveMs so rapid press computes from intended pos.
        const effectiveMs = getEffectiveMs();
        switch (action) {
          case 'prev-cue':
          case 'next-cue':
          case 'replay-cue': {
            navigateCue(action as 'prev-cue' | 'next-cue' | 'replay-cue', video, bilingualCues, effectiveMs, offsetMs);
            break;
          }
          case 'toggle-overlay': {
            const result = toggleOverlayState(overlayVisible, targetStyle, nativeStyle);
            overlayVisible = result.overlayVisible;
            targetStyle = result.targetStyle;
            nativeStyle = result.nativeStyle;
            blockController.updateSettings({ targetStyle, nativeStyle });
            blockController.syncHiddenState();
            break;
          }
          case 'play-pause': {
            // ADR-030: route through playVideo/pauseVideo to avoid Netflix M7375.
            if (video.paused) {
              playVideo(video).catch(() => { /* autoplay may be blocked */ });
            } else {
              pauseVideo(video);
            }
            break;
          }
        case 'toggle-translate': {
          // ADR-021 D7: temporary toggle (no setting change).
          // If prefill running → clear + hide native overlay. If not → restart from syncController.latestTargetCues.
          if (translatePrefill?.isRunning) {
            translatePrefill.clear();
            translatePrefill = null;
            // Reload target-only (no native) to hide translated overlay
            blockController?.loadBilingualCues(syncController.latestTargetCues, []);
            bilingualCues = mergeCuesForPanel(syncController.latestTargetCues, []);
            // latestNativeCues tracked by blockController — no longer needed here
            // updateCues(syncController.latestTargetCues, []);
            showToast('Auto-translate off', container, { variant: 'info' });
          } else if (syncController.latestTargetCues.length > 0) {
            // Restart prefill — load settings for sl/tl
            void (async () => {
              const s = await loadSettings();
              const sl = s.subtitleOverlayTargetLanguage;
              const tl = s.subtitleOverlayNativeLanguage;
              if (!sl || !tl || sl === tl) return;
              translatePrefill?.clear();
              translatePrefill = new BackgroundPrefillController({
                translate: createTranslateFunction(sl, tl),
                onChunkTranslated: (translatedCues: SrtCue[]) => {
                  blockController?.loadBilingualCues(syncController.latestTargetCues, translatedCues);
                  bilingualCues = mergeCuesForPanel(syncController.latestTargetCues, translatedCues);
                  // updateCues(syncController.latestTargetCues, translatedCues);
                  broadcastCues(bilingualCues);
                },
                onError: (msg: string) => {
                  showToast(msg, container, { variant: 'error' });
                },
              });
              translatePrefill.start(syncController.latestTargetCues, sl, tl);
              showToast('Auto-translate on', container, { variant: 'success' });
            })();
          }
          break;
        }
        }
      }
    }
    if (m?.type === MESSAGE_TYPES.APPLY_STUDY_MODE) {
      const payload = m.payload as ApplyStudyModePayload | undefined;
      if (payload?.activeMode) {
        blockController?.applyStudyMode(payload.activeMode, payload.advanced);
      }
    }
    return false; // synchronous listener
  };
  onMessage(onRuntimeMessage);

  // === File import wiring ===
  // File picker (import button) is wired inside loadOverlayStyles().then()
  // above, because the import button is created asynchronously by the
  // controller/panel. Wiring here at top-level would query a non-existent
  // button. Drag-drop below wires on `container` (already exists) so it can
  // run at top-level.

  // Wire drag-drop on container → parse → loadCues + drag hover hint.
  const dragHint = createDragHint(container);
  let dragCounter = 0;

  container.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragHint.classList.add('subtitle-drag-hint--visible');
  });
  container.addEventListener('dragover', (e) => e.preventDefault());
  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragHint.classList.remove('subtitle-drag-hint--visible');
    }
  });
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragHint.classList.remove('subtitle-drag-hint--visible');
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    await processImportedFiles(files, container);
  });

  // === Bilingual auto-load wiring (ADR-007 D1, spec F3/F4/F7) ===
  // msg is `unknown` per onMessage signature; narrow to { type?, payload? }
  // for property access. Safe because chrome.runtime messages are plain objects.
  const onRuntimeMessage2 = (msg: unknown, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
    const m = msg as { type?: string; payload?: unknown };
    if (m?.type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES) {
      const payload = m.payload as AutoLoadSubtitlesPayload;
      try { const a = JSON.parse(document.documentElement.getAttribute('data-cell-debug-autoload-arr') ?? '[]'); a.push({ step: 'msg-received', hasTarget: !!payload?.target, hasNative: !!payload?.native, targetUrl: payload?.target?.url?.slice(0, 60), nativeUrl: payload?.native?.url?.slice(0, 60), t: Date.now() }); document.documentElement.setAttribute('data-cell-debug-autoload-arr', JSON.stringify(a.slice(-20))); } catch { /* ignore */ }

      // Skip duplicate payloads to avoid re-loading the same subtitle and
      // restarting translate prefill (e.g. when PAGE_SCAN_RESULT or network
      // re-detection re-pushes the same target/native URLs on seek).
      const autoLoadKey = `${payload?.target?.url ?? ''}|${payload?.native?.url ?? ''}`;
      if (autoLoadKey === lastAutoLoadKey && autoLoadKey !== '|') {
        return;
      }
      lastAutoLoadKey = autoLoadKey;

      // Debug: notify the top frame that this iframe's controller received the
      // auto-load message. Helps verify broadcast-to-all-frames on moviepire.
      try {
        window.parent.postMessage({
          type: '__CELL_AUTOLOAD_HANDLED',
          href: location.href,
          target: payload?.target?.url,
          native: payload?.native?.url,
        }, '*');
      } catch {
        // cross-origin parent may be unavailable in some embed contexts.
      }

      // SPA navigation: URL changed → clear the previous video's cues before
      // loading the new one. `loadBilingualCues` uses ADR-014 D1 merge semantics
      // (keep old side when new side empty — for same-video incremental re-push),
      // so without this clear a partial load on the new video (target only, no
      // native or vice versa) leaves the previous video's cues visible. Covers
      // all cases: 0 tracks, partial, full — any URL change clears both sides.
      const currentUrl = location.href;
      if (lastAutoLoadUrl !== undefined && lastAutoLoadUrl !== currentUrl) {
        blockController?.clearCues();
        offsetController?.loadCues(false);
        // updateCues([], []);
        syncController.latestTargetCues = [];
        // Reset inline load status so stale messages from the previous video
        // don't persist into the new one (auto-load will set 'loading' or 'none').
        useCuesStore.getState().setLoadStatus('target', { state: 'idle' });
        useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
      }
      lastAutoLoadUrl = currentUrl;
      if (!payload?.target && !payload?.native) {
        // New video has no subtitles (SPA nav from a video WITH subtitles to
        // one WITHOUT). Clear the previous video's overlay + nav cluster so
        // stale cues do not persist into the new video.
        blockController?.clearCues();
        offsetController?.loadCues(false);
        // updateCues([], []);
        // ADR-021: clear translate prefill on SPA nav to video with no subtitles
        translatePrefill?.clear();
        translatePrefill = null;
        clearTranslatedNativeState();
        syncController.activeNativeSource = 'auto';
        updateGenerateNativeEnabled();
        useCuesStore.getState().setLoadStatus('target', { state: 'none' });
        useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
        // Clear auto-detected track list + manager panel so stale tracks from
        // the previous video don't persist in the panel UI. onSpaNav may have
        // already cleared these (proactive clear on yt-navigate-finish), but
        // if onSpaNav didn't fire (lastAutoLoadUrl was undefined) this is the
        // only clear path.
        syncController.autoTargetItems = [];
        syncController.autoNativeItems = [];
        syncController.targetMatches = [];
        syncController.nativeMatches = [];
        syncController.activeTargetIndex = 0;
        syncController.activeNativeIndex = 0;
        refreshPanel('target');
        refreshPanel('native');
      }
      // ADR-021: clear translate prefill on SPA nav (URL changed)
      if (lastAutoLoadUrl !== undefined && lastAutoLoadUrl !== currentUrl) {
        translatePrefill?.clear();
        translatePrefill = null;
        clearTranslatedNativeState();
        syncController.activeNativeSource = 'auto';
        updateGenerateNativeEnabled();
      }
      void (async () => {
        const currentSettings = await loadSettings();
        await handleAutoLoadSubtitles(payload, {
        controller: {
          loadBilingualCues: (t: SrtCue[], n: SrtCue[]) => { blockController?.loadBilingualCues(t, n); showOverlay(); },
          loadCues: (c: SrtCue[]) => { blockController?.loadCues(c); showOverlay(); },
          clearCues: () => {
            blockController?.clearCues();
            // ADR-019: subtitles cleared → reset offset + cancel lazy
            offsetController?.loadCues(false);
            clearTranslatedNativeState();
            syncController.activeNativeSource = 'auto';
            updateGenerateNativeEnabled();
          },
        },
        tabUrl: window.location.href,
        onPanelRender: (targetCues: SrtCue[], nativeCues: SrtCue[]) => {
          bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
          // ADR-018: keep nav cluster cue source in sync with auto-loaded subtitles
          // (4↔6 nút transition when subtitles become available).
          syncController.latestTargetCues = targetCues;
          // Auto-load resets the translated native slot; native active is auto.
          clearTranslatedNativeState();
          syncController.activeNativeSource = 'auto';
          updateGenerateNativeEnabled();
          // updateCues(targetCues, nativeCues);
          // ADR-019: notify offset controller that subtitles loaded
          offsetController?.loadCues(true);
          // Send cues to Side Panel
          broadcastCues(bilingualCues);
        },
        onLoadStatus: (role, status) => useCuesStore.getState().setLoadStatus(role, status),
        autoTranslate: currentSettings.subtitleOverlayAutoTranslate,
        onStartTranslatePrefill: (targetCues: SrtCue[]) => {
          // ADR-021: start background prefill to translate target→native.
          // Translate function sends TRANSLATE message to background SW (CORS bypass).
          const sl = currentSettings.subtitleOverlayTargetLanguage;
          const tl = currentSettings.subtitleOverlayNativeLanguage;
          if (!sl || !tl || sl === tl) return;
          // If a manual generate-native is already active, don't overwrite it with
          // auto-translate. Manual generate is the user's explicit choice.
          if (syncController.translatedNativeSlot && syncController.activeNativeSource === 'translated') return;
          // Inline load status: native language label for the translating state.
          const nativeLabel = isoCodeToLabel(tl);
          const label = nativeLabel ? nativeLabel.charAt(0).toUpperCase() + nativeLabel.slice(1) : tl;
          // Clear any previous prefill (SPA nav or re-trigger)
          translatePrefill?.clear();
          translatePrefill = new BackgroundPrefillController({
            translate: createTranslateFunction(sl, tl),
            onChunkTranslated: (translatedCues: SrtCue[]) => {
              // Feed translated cues to overlay (reuse loadBilingualCues path ADR-013/014)
              blockController?.loadBilingualCues(targetCues, translatedCues);
              showOverlay();
              // Update panel + nav cluster with bilingual cues
              bilingualCues = mergeCuesForPanel(targetCues, translatedCues);
              syncController.latestTargetCues = targetCues;
              // updateCues(targetCues, translatedCues);
              broadcastCues(bilingualCues);
              useCuesStore.getState().setLoadStatus('native', { state: 'translating', languageLabel: label, source: 'translated', progress: { current: translatePrefill?.cacheSize ?? 0, total: targetCues.length } });
            },
            onError: (msg: string) => {
              console.error('[onStartTranslatePrefill] translation error', msg);
              useCuesStore.getState().setLoadStatus('native', { state: 'error', languageLabel: label, source: 'translated', errorType: 'unknown' });
            },
            onComplete: () => {
              useCuesStore.getState().setLoadStatus('native', { state: 'loaded', languageLabel: label, source: 'translated' });
            },
          });
          useCuesStore.getState().setLoadStatus('native', { state: 'translating', languageLabel: label, source: 'translated', progress: { current: 0, total: targetCues.length } });
          translatePrefill.start(targetCues, sl, tl);
        },
        onSubtitleMatches: (targetM, nativeM) => {
          // ADR-015 T4/T10: build auto panel items from matches in-place.
          syncController.setAutoMatches([...targetM], [...nativeM]);
          refreshPanel('target');
          refreshPanel('native');
        },
      });
      })();
    }
    return false; // synchronous listener, no async response
  };
  onMessage(onRuntimeMessage2);

  // Request a re-push of AUTO_LOAD_SUBTITLES in case background pushed before
  // this content-script was ready (race: SW restart, late injection). Background
  // reads from chrome.storage.session (ADR-007 D2).
  void sendMessage({
    type: MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES,
    payload: { tabId: undefined }, // background resolves from sender.tab.id
  });

  /**
   * ADR-015 T10: Process imported files (multi-file) → panel + cues + toast.
   * Flow: parseAndDetectFiles → assignImportRole → panel.updateTarget/Native
   * → loadBilingualCues (first target + first native) → toast.
   */
  async function processImportedFiles(files: File[], _container: HTMLElement): Promise<void> {
    if (files.length === 0) return;
    const { targetLang, nativeLang } = await loadTargetNativeLangs();
    const parsed = await parseAndDetectFiles(files);
    if (parsed.length === 0) {
      debouncedToast('No valid subtitle files', _container, { variant: 'error' });
      return;
    }
    const assignment = assignImportRole(parsed, targetLang, nativeLang);

    // Dedup guard: skip files that match an existing imported item by
    // name + format + size. Prevents duplicate imports and gives the user
    // a clear toast listing which files were skipped.
    const isDuplicate = (file: File, format: string, existing: ParsedFile[]): boolean =>
      existing.some(p => p.file.name === file.name && p.format === format && p.file.size === file.size);

    const dupTarget = assignment.target.filter(f => isDuplicate(f.file, f.format, syncController.importedParsedTarget));
    const dupNative = assignment.native.filter(f => isDuplicate(f.file, f.format, syncController.importedParsedNative));
    const newTarget = assignment.target.filter(f => !isDuplicate(f.file, f.format, syncController.importedParsedTarget));
    const newNative = assignment.native.filter(f => !isDuplicate(f.file, f.format, syncController.importedParsedNative));
    const totalDups = dupTarget.length + dupNative.length;

    if (newTarget.length === 0 && newNative.length === 0) {
      const names = [...dupTarget, ...dupNative].map(f => f.file.name);
      const label = names.length === 1 ? names[0] : `${names.length} files`;
      debouncedToast(`Already imported: ${label}`, _container, { variant: 'warning' });
      return;
    }

    // Build panel items — APPEND to existing imported items (not overwrite).
    const existingTargetCount = syncController.importedParsedTarget.length;
    const existingNativeCount = syncController.importedParsedNative.length;
    const newTargetItems = newTarget.map((f, i) => ({
      id: `imported-target-${existingTargetCount + i}`,
      name: formatSubtitleName('imported', '', existingTargetCount + i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'target' as const,
      index: existingTargetCount + i,
    }));
    const newNativeItems = newNative.map((f, i) => ({
      id: `imported-native-${existingNativeCount + i}`,
      name: formatSubtitleName('imported', '', existingNativeCount + i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'native' as const,
      index: existingNativeCount + i,
    }));
    syncController.importedTargetItems = [...syncController.importedTargetItems, ...newTargetItems];
    syncController.importedNativeItems = [...syncController.importedNativeItems, ...newNativeItems];
    syncController.importedParsedTarget = [...syncController.importedParsedTarget, ...newTarget];
    syncController.importedParsedNative = [...syncController.importedParsedNative, ...newNative];
    syncController.activeImportTargetIndex = existingTargetCount;
    syncController.activeImportNativeIndex = existingNativeCount;
    // ADR-015 T10 fix: merge auto + imported items in panel (both visible).
    // Mark active source as imported for roles that got new (non-duplicate) files.
    if (newTarget.length > 0) { syncController.activeTargetSource = 'imported'; useCuesStore.getState().setLoadStatus('target', { state: 'loaded', source: 'imported' }); }
    if (newNative.length > 0) { syncController.activeNativeSource = 'imported'; useCuesStore.getState().setLoadStatus('native', { state: 'loaded', source: 'imported' }); }
    // Import resets the translated native slot (new target/native sources).
    clearTranslatedNativeState();
    refreshPanel('target');
    refreshPanel('native');

    // Load cues: first new target + first new native (D1 merge keeps other side)
    const targetCues = newTarget[0]?.cues ?? [];
    const nativeCues = newNative[0]?.cues ?? [];
    if (targetCues.length > 0 || nativeCues.length > 0) {
      blockController?.loadBilingualCues(targetCues, nativeCues);
      showOverlay();
      syncController.latestTargetCues = targetCues;
      offsetController?.loadCues(true);
      bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
      broadcastCues(bilingualCues);
    } else if (newTarget.length === 0 && newNative.length === 0) {
      blockController?.loadCues(parsed[0].cues); // fallback: single mode
      showOverlay();
      syncController.latestTargetCues = parsed[0].cues;
      offsetController?.loadCues(true);
    }
    updateGenerateNativeEnabled();

    // Toast — include duplicate count if any were skipped
    const total = newTarget.length + newNative.length;
    const ignoredCount = assignment.ignored.length;
    const dupTxt = totalDups > 0 ? `, ${totalDups} duplicate${totalDups > 1 ? 's' : ''} skipped` : '';
    if (total === 1) {
      const importedName = newTarget[0]?.file.name ?? newNative[0]?.file.name ?? '';
      debouncedToast(`Imported ${importedName}${dupTxt}`, _container, { variant: 'success' });
    } else {
      const parts: string[] = [];
      if (newTarget.length > 0) parts.push(`target:${newTarget.length}`);
      if (newNative.length > 0) parts.push(`native:${newNative.length}`);
      const ignoredTxt = ignoredCount > 0 ? ` (${ignoredCount} ignored)` : '';
      debouncedToast(`Imported ${total} subtitle files (${parts.join(', ')})${ignoredTxt}${dupTxt}`, _container, { variant: 'success' });
    }
  }

  /**
   * ADR-015 T11: User selected an imported subtitle via the manager panel.
   * Loads cues from the stored parsed file + toast.
   */
  async function onPanelSelect(role: 'target' | 'native', index: number): Promise<void> {
    const items = role === 'target' ? syncController.importedTargetItems : syncController.importedNativeItems;
    if (index >= items.length) return;
    if (role === 'target') { syncController.activeImportTargetIndex = index; syncController.activeTargetSource = 'imported'; }
    else { syncController.activeImportNativeIndex = index; syncController.activeNativeSource = 'imported'; }

    // Refresh manager panel active state immediately so the UI reflects the click.
    refreshPanel(role);

    // Retrieve cues from the parsed file (stored in a side map)
    const parsed = role === 'target'
      ? syncController.importedParsedTarget[index]
      : syncController.importedParsedNative[index];
    if (!parsed) return;

    if (role === 'target') {
      blockController?.loadBilingualCues(parsed.cues, []);
      syncController.latestTargetCues = parsed.cues;
      clearTranslatedNativeState();
      syncController.activeNativeSource = 'auto';
      syncController.activeNativeIndex = 0;
      refreshPanel('native');
      updateGenerateNativeEnabled();
    } else {
      blockController?.loadBilingualCues([], parsed.cues);
    }
    showOverlay();
    syncSidePanelFromBlock();
    useCuesStore.getState().setLoadStatus(role, { state: 'loaded', source: 'imported' });
    debouncedToast(`Switched to ${parsed.file.name}`, container, { variant: 'success' });
  }

  // ADR-015 T10: side maps moved to state block above (syncController.importedParsedTarget/Native)

  /**
   * ADR-015: unified manager panel selection handler. The panel shows a merged
   * list (auto items first, then imported items). Route based on which item the
   * user clicked: auto items → onSubtitleSelect (re-fetch by auto index),
   * imported items → onPanelSelect (load parsed cues by imported index).
   */
  async function onManagerSelect(role: 'target' | 'native', index: number): Promise<void> {
    // Off option (index -1): clear cues for this role, mark as Off
    if (index === -1) {
      if (role === 'target') {
        syncController.activeTargetSource = 'auto';
        syncController.activeTargetIndex = -1;
        syncController.latestTargetCues = [];
        clearTranslatedNativeState();
      } else {
        syncController.activeNativeSource = 'auto';
        syncController.activeNativeIndex = -1;
      }
      blockController?.loadBilingualCues(
        role === 'target' ? [] : (blockController.getTargetCues() as SrtCue[]),
        role === 'native' ? [] : (blockController.getNativeCues() as SrtCue[]),
      );
      refreshPanel(role);
      if (role === 'target') { refreshPanel('native'); updateGenerateNativeEnabled(); }
      syncSidePanelFromBlock();
      return;
    }
    const { items } = syncController.mergedPanelItems(role);
    const item = items[index];
    if (!item) return;
    if (item.source === 'imported') {
      await onPanelSelect(role, item.index);
      return;
    }
    if (item.source === 'searched') {
      await onSearchedSelect(role, item.index);
      return;
    }
    if (item.source === 'ocr') {
      // OCR dual-stream: re-activate the live OCR track for this role.
      const slot = role === 'target' ? syncController.ocrTargetSlot : syncController.ocrNativeSlot;
      if (slot) {
        if (role === 'target') syncController.activeTargetSource = 'ocr';
        else syncController.activeNativeSource = 'ocr';
        refreshPanel(role);
        // D1 merge: empty other side keeps the existing side (onSubtitleSelect pattern).
        blockController?.loadBilingualCues(role === 'target' ? slot.cues : [], role === 'native' ? slot.cues : []);
        showOverlay();
        syncSidePanelFromBlock();
      }
      return;
    }
    if (item.source === 'translated') {
      if (role === 'native' && syncController.translatedNativeSlot) {
        syncController.activeNativeSource = 'translated';
        refreshPanel('native');
        blockController?.loadBilingualCues([...blockController.getTargetCues()], syncController.translatedNativeSlot.cues);
        showOverlay();
        syncSidePanelFromBlock();
      }
      return;
    }
    await onSubtitleSelect(role, item.index);
  }

  /**
   * ADR-014 D4: user selected a different subtitle via dropdown.
   * Re-fetch (cache hit instant) + loadBilingualCues (D1 merge keeps other side)
   * + save preference to chrome.storage.local (origin → lang → index).
   */
  async function onSubtitleSelect(role: 'target' | 'native', index: number): Promise<void> {
    const matches = role === 'target' ? syncController.targetMatches : syncController.nativeMatches;
    if (index >= matches.length) return;
    const sub = matches[index];
    if (role === 'target') { syncController.activeTargetIndex = index; syncController.activeTargetSource = 'auto'; }
    else { syncController.activeNativeIndex = index; syncController.activeNativeSource = 'auto'; }

    // Refresh manager panel active state immediately so the UI reflects the click
    // before the async fetch. The fetch can fail (CORS/offline), but the selected
    // index should still be visible as the user's choice.
    refreshPanel(role);

    try {
      const result = await fetchAndParseSubtitle(sub.url, resolveFormat(sub.format, sub.url), window.location.href, sub.initiator);
      if (!result.success || result.cues.length === 0) {
        console.error('[onSubtitleSelect] failed', result.error);
        showToast(`Could not load subtitle track ${index + 1}`, container, { variant: 'error' });
        return;
      }
      // D1 merge: loadBilingualCues keeps other side when this side is empty.
      // We only update the selected side by passing its cues + empty other side.
      if (role === 'target') {
        blockController?.loadBilingualCues(result.cues, []);
        // ADR-018: update nav cluster — keep native side, replace target
        syncController.latestTargetCues = result.cues;
        clearTranslatedNativeState();
        syncController.activeNativeSource = 'auto';
        syncController.activeNativeIndex = 0;
        refreshPanel('native');
        updateGenerateNativeEnabled();
        // updateCues(syncController.latestTargetCues, latestNativeCues);
      } else {
        blockController?.loadBilingualCues([], result.cues);
        // ADR-018: update nav cluster — keep target side, replace native
        // updateCues(syncController.latestTargetCues, latestNativeCues);
      }
      showOverlay();
      syncSidePanelFromBlock();
      useCuesStore.getState().setLoadStatus(role, { state: 'loaded', languageLabel: formatSubtitleName('auto', sub.language, index, undefined, sub.displayName), source: 'auto' });
      showToast(`Switched to subtitle track ${index + 1}`, container, { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[onSubtitleSelect] error', msg);
      showToast('Could not switch subtitle', container, { variant: 'error' });
    }

    // Save preference: origin → lang → index
    try {
      const origin = new URL(window.location.href).hostname;
      const lang = sub.language;
      const settings = await loadSettings();
      const pref = { ...(settings.subtitlePreference ?? {}) };
      const sitePref = { ...(pref[origin] ?? {}) };
      sitePref[lang] = index;
      pref[origin] = sitePref;
      await saveSettings({ ...settings, subtitlePreference: pref });
    } catch {
      // ponytail: storage might not be available in test contexts — ignore
    }
  }

  /**
   * Subtitle search: user selected a search result from SubtitleSearchPanel.
   * Sends RESOLVE_SUBTITLE_DOWNLOAD to background → parses content → caches
   * cues by result.id → creates a 'searched' panel item → loads bilingual cues.
   * Re-selecting the same result uses the syncController.parsedSearchCache (no re-fetch).
   */
  async function handleSearchResultSelect(result: SubtitleSearchResult, role: 'target' | 'native'): Promise<void> {
    // Cache hit: reuse parsed cues (user re-selected a previously loaded result).
    const cachedCues = syncController.parsedSearchCache.get(result.id);
    let cues: SrtCue[];
    if (cachedCues) {
      cues = cachedCues;
    } else {
      // Ask background to resolve the download (fetch + decode archive).
      const response = await sendMessage<{ success?: boolean; data?: ResolveSubtitleDownloadResult; error?: string }>({
        type: MESSAGE_TYPES.RESOLVE_SUBTITLE_DOWNLOAD,
        payload: { result, role },
      });
      if (!response?.success || !response.data?.content) {
        const msg = response?.error ?? response?.data?.error?.type ?? 'download failed';
        showToast(`Could not load subtitle: ${msg}`, container, { variant: 'error' });
        return;
      }
      const parsed = parseSubtitle(response.data.content, response.data.format ?? result.format);
      if (!parsed.success || parsed.cues.length === 0) {
        showToast(`Could not parse subtitle: ${parsed.error ?? 'no cues'}`, container, { variant: 'error' });
        return;
      }
      cues = parsed.cues;
      syncController.parsedSearchCache.set(result.id, cues);
    }

    // Build panel item + append to the searched items array for this role.
    const items = role === 'target' ? syncController.searchedTargetItems : syncController.searchedNativeItems;
    const existingIdx = items.findIndex((it) => it.id === `searched-${role}-${result.id}`);
    if (existingIdx >= 0) {
      // Already in the panel — just select it.
      await onSearchedSelect(role, existingIdx);
      return;
    }
    const item: SubtitlePanelItem = {
      id: `searched-${role}-${result.id}`,
      name: result.name,
      format: result.format,
      source: 'searched',
      role,
      index: items.length,
    };
    if (role === 'target') {
      syncController.searchedTargetItems = [...syncController.searchedTargetItems, item];
      syncController.activeSearchedTargetIndex = item.index;
      syncController.activeTargetSource = 'searched';
    } else {
      syncController.searchedNativeItems = [...syncController.searchedNativeItems, item];
      syncController.activeSearchedNativeIndex = item.index;
      syncController.activeNativeSource = 'searched';
    }
    // Search selection resets the translated native slot (new native source).
    if (role === 'native') clearTranslatedNativeState();
    refreshPanel(role);
    if (role === 'target') { refreshPanel('native'); updateGenerateNativeEnabled(); }

    // Load cues (D1 merge keeps the other side).
    if (role === 'target') {
      blockController?.loadBilingualCues(cues, []);
      syncController.latestTargetCues = cues;
    } else {
      blockController?.loadBilingualCues([], cues);
    }
    showOverlay();
    syncSidePanelFromBlock();
    const searchLabel = (() => { const l = isoCodeToLabel(result.isoLanguage); return l ? l.charAt(0).toUpperCase() + l.slice(1) : result.isoLanguage; })();
    useCuesStore.getState().setLoadStatus(role, { state: 'loaded', languageLabel: searchLabel, source: 'search' });
    debouncedToast(`Loaded ${result.name}`, container, { variant: 'success' });
  }

  /**
   * User selected an already-loaded searched subtitle via the manager panel.
   * Loads cues from syncController.parsedSearchCache by the searched item index.
   */
  async function onSearchedSelect(role: 'target' | 'native', index: number): Promise<void> {
    const items = role === 'target' ? syncController.searchedTargetItems : syncController.searchedNativeItems;
    if (index >= items.length) return;
    const item = items[index];
    if (role === 'target') { syncController.activeSearchedTargetIndex = index; syncController.activeTargetSource = 'searched'; }
    else { syncController.activeSearchedNativeIndex = index; syncController.activeNativeSource = 'searched'; }
    refreshPanel(role);

    // Retrieve cues from cache by result.id (encoded in item.id).
    const resultId = item.id.replace(`searched-${role}-`, '');
    const cues = syncController.parsedSearchCache.get(resultId);
    if (!cues) return;

    if (role === 'target') {
      blockController?.loadBilingualCues(cues, []);
      syncController.latestTargetCues = cues;
      clearTranslatedNativeState();
      syncController.activeNativeSource = 'auto';
      syncController.activeNativeIndex = 0;
      refreshPanel('native');
      updateGenerateNativeEnabled();
    } else {
      blockController?.loadBilingualCues([], cues);
    }
    showOverlay();
    syncSidePanelFromBlock();
    useCuesStore.getState().setLoadStatus(role, { state: 'loaded', source: 'search' });
    debouncedToast(`Switched to ${item.name}`, container, { variant: 'success' });
  }

  /** Check if the user has configured any subtitle search API keys. */
  function hasSearchKeys(): boolean {
    return (currentSettings?.subtitleApiKeys?.length ?? 0) > 0;
  }

  /** Persist API key changes to settings storage + update controller state. */
  async function handleApiKeysChange(keys: SubtitleApiKey[]): Promise<void> {
    await saveSettings({ subtitleApiKeys: keys });
    currentSettings = { ...currentSettings, subtitleApiKeys: keys } as typeof currentSettings;
    blockController?.setHasSearchKeys(keys.length > 0);
    blockController?.setSearchApiKeys(keys);
  }

  // Re-send SUBTITLE_CUES_LOADED when tab becomes visible again.
  // Bug: switching to another tab and back left sidepanel showing "No subtitles
  // loaded" because the background's per-tab cue cache was cleared (SW restart or
  // onTabUpdated loading), and the content-script only sends cues once on auto-load.
  // On re-visibility, re-broadcast cached bilingualCues so the background can
  // re-cache + relay to the sidepanel. ponytail: visibilitychange is the native
  // signal for "tab became active again" — no polling, no chrome.tabs API needed
  // (content-script cannot access chrome.tabs).
  const onVisibilityChange = (): void => {
    // ADR-021 D6: pause translate prefill when tab hidden, resume when visible
    if (document.visibilityState === 'hidden') {
      translatePrefill?.pause();
    } else if (document.visibilityState === 'visible') {
      translatePrefill?.resume();
      if (bilingualCues.length === 0) return;
      broadcastCues(bilingualCues);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // ponytail: proactive SPA-nav clear. YouTube keep <video> on SPA nav →
  // overlay not re-init → stale cues from previous video persist when the
  // background round-trip (MAIN-world detect → DETECTED_SUBTITLES →
  // AUTO_LOAD_SUBTITLES null) is delayed/lost (poll timeout 2s, InnerTube
  // error, SW restart). Native yt-navigate-finish + popstate fire reliably
  // on YouTube SPA nav → clear ngay, không đợi background.
  // Ceiling: nav without URL change (rare on YouTube) → not caught. Upgrade:
  // MutationObserver on <video> src.
  const onSpaNav = (): void => {
    if (lastAutoLoadUrl === undefined || lastAutoLoadUrl === location.href) return;
    blockController?.clearCues();
    offsetController?.loadCues(false);
    syncController.latestTargetCues = [];
    translatePrefill?.clear();
    translatePrefill = null;
    clearTranslatedNativeState();
    syncController.activeNativeSource = 'auto';
    updateGenerateNativeEnabled();
    lastAutoLoadKey = undefined;
    lastAutoLoadUrl = undefined;
    // Clear auto-detected track list + manager panel so stale tracks from the
    // previous video don't persist. Without this, the SubtitleManagerPanel
    // keeps showing the old video's tracks after SPA nav to a video with no
    // subtitles (onSpaNav cleared overlay cues but not the panel items).
    syncController.autoTargetItems = [];
    syncController.autoNativeItems = [];
    syncController.targetMatches = [];
    syncController.nativeMatches = [];
    syncController.activeTargetIndex = 0;
    syncController.activeNativeIndex = 0;
    refreshPanel('target');
    refreshPanel('native');
    useCuesStore.getState().setLoadStatus('target', { state: 'none' });
    useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
  };
  window.addEventListener('yt-navigate-finish', onSpaNav);
  window.addEventListener('popstate', onSpaNav);

  // OCR dual-stream bridge (spec ocr-split-dual-stream): the OCR content script
  // (same isolated world) posts '__CELL_OCR_TRACKS' with growing target/native cue
  // lists and '__CELL_OCR_TRACKS_END' when the split session stops or split turns
  // off. First message snapshots the active sources (restored on END), creates the
  // two virtual slots and auto-switches both roles to the OCR source.
  const onOcrTracksMessage = (e: MessageEvent): void => {
    if (e.source !== window) return;
    const d = e.data as { type?: string; targetCues?: SrtCue[]; nativeCues?: SrtCue[] };
    if (d?.type === '__CELL_OCR_TRACKS' && d.targetCues && d.nativeCues) {
      if (!syncController.ocrTargetSlot || !syncController.ocrNativeSlot) {
        syncController.preOcrSources = { target: syncController.activeTargetSource, native: syncController.activeNativeSource };
        syncController.ocrTargetSlot = { item: syncController.makeOcrPanelItem('ocr-target', 'OCR Target (live)', 'target'), cues: [] };
        syncController.ocrNativeSlot = { item: syncController.makeOcrPanelItem('ocr-native', 'OCR Native (live)', 'native'), cues: [] };
      }
      syncController.ocrTargetSlot.cues = d.targetCues;
      syncController.ocrNativeSlot.cues = d.nativeCues;
      syncController.activeTargetSource = 'ocr';
      syncController.activeNativeSource = 'ocr';
      blockController?.loadBilingualCues(d.targetCues, d.nativeCues);
      showOverlay();
      syncController.latestTargetCues = d.targetCues;
      offsetController?.loadCues(true);
      bilingualCues = mergeCuesForPanel(d.targetCues, d.nativeCues);
      broadcastCues(bilingualCues);
      refreshPanel('target');
      refreshPanel('native');
      return;
    }
    if (d?.type === '__CELL_OCR_TRACKS_END') {
      syncController.ocrTargetSlot = null;
      syncController.ocrNativeSlot = null;
      if (syncController.preOcrSources) {
        syncController.activeTargetSource = syncController.preOcrSources.target;
        syncController.activeNativeSource = syncController.preOcrSources.native;
        syncController.preOcrSources = null;
      }
      refreshPanel('target');
      refreshPanel('native');
    }
  };
  window.addEventListener('message', onOcrTracksMessage);

  // Return cleanup so the caller can tear down before re-init on SPA episode
  // switch (Angular replaces <video> → old overlay UI removed by framework
  // re-render, but document/onMessage listeners would otherwise leak).
  // ponytail: document keydown + onMessage listeners leak — ceiling: memory
  // leak after many episode switches. Upgrade path: track + remove all listeners.
  return () => {
    window.removeEventListener('message', onOcrTracksMessage);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('yt-navigate-finish', onSpaNav);
    window.removeEventListener('popstate', onSpaNav);
    window.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('keyup', onKeyup, true);
    document.removeEventListener('__NF_SEEK', onNfSeek);
    removeOnMessageListener(onRuntimeMessage);
    removeOnMessageListener(onRuntimeMessage2);
    if (onStorageChangedCallback) removeOnStorageChangedListener(onStorageChangedCallback);
    // ADR-027: React UI is unmounted in ReactSubtitleController.destroy().
    subtitleTokenizeCtrl?.destroy();
    blockController?.destroy();
    unsubscribeStudyMode();
  };
}

