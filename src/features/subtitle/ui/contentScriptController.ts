import { sendMessage, onMessage, onStorageChanged, removeOnMessageListener, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { findVideoContainer } from '@/features/subtitle/logic/findPlayerContainer';
import type { SubtitleApiKey } from '@/entities/settings';
import { getActiveStudyMode, subscribeToStudyMode } from '@/features/studyModes/content/studyModeController';
import { injectThemeTokens } from '@/features/theme/logic/themeTokens';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS, DEFAULT_CARD_CREATOR_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import {
  showToast,
  createDebouncedToast,
  mergeCuesForPanel,
  toggleOverlayState,
  playVideo,
  pauseVideo,
  loadSettingsOrToast,
  broadcastCues,
} from '@/features/subtitle';
import { ReactSubtitleController } from '@/features/subtitle/ui/reactSubtitleController';
import { SubtitleSyncController } from '@/features/subtitle/ui/subtitleSyncController';
import { type SubtitleCueEngineUpdate, type CardCreatorAction } from '@/features/subtitle/ui/subtitleCueEngine';
import { loadTokenizeSettings, isSubtitleTokenizeEnabledForUrl } from '@/features/tokenize/services/tokenizeSettingsStore';
import type { SubtitleTokenizeController } from '@/features/tokenize/controller/subtitleTokenizeController';
import type { LookupRequest } from '@/entities/dictionary';
import type { TokenizeSettings } from '@/features/tokenize/types';
import type { BackgroundPrefillController } from '@/features/translate/logic/translatePrefill';
import { handleCardCreatorAction as sharedHandleCardCreatorAction } from '@/features/subtitle/actions/cardActions';
import { startGenerateNative } from '@/features/subtitle/actions/generateNativeAction';
import type { SubtitleActionContext } from '@/features/subtitle/actions/subtitleActionContext';
import { loadOverlaySettings, loadShortcuts } from './contentScriptShared';
import type { ContentScriptContext } from './contentScriptContext';
import { createContentScriptKeyboardHandlers } from './contentScriptKeyboard';
import { createContentScriptMessageHandlers } from './contentScriptMessages';
import { createProcessImportedFiles, wireContainerDragImport } from './contentScriptFileImport';
import { createSubtitleSelectionHandlers } from './contentScriptSelection';
import { createContentScriptLifecycleHandlers } from './contentScriptLifecycle';

import type { DictionaryBridge } from '../logic/dictionaryBridge';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { BilingualCue, KeyboardShortcut, SrtCue, NavClusterSettings, SubtitleBlockSettings, Settings } from '@/entities/media';

import type { SubtitlePanelItem } from '@/features/subtitle';
// === Subtitle Overlay Integration ===

export function init(video: HTMLVideoElement, webTextCtrl?: DictionaryBridge): () => void {
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
  let lastFedTargetCues: readonly SrtCue[] = [];
  let lastFedNativeCues: readonly SrtCue[] = [];
  blockController.onCuesUpdated = () => {
    if (!subtitleTokenizeCtrl) return;
    const targetCues = blockController.getTargetCues();
    const nativeCues = blockController.getNativeCues();
    if (targetCues !== lastFedTargetCues || nativeCues !== lastFedNativeCues) {
      lastFedTargetCues = targetCues;
      lastFedNativeCues = nativeCues;
      subtitleTokenizeCtrl.setCues(targetCues, nativeCues);
    }
    const { target, native } = blockController.getActiveIndices();
    let fired = false;
    const fire = (): void => {
      if (fired) return;
      fired = true;
      subtitleTokenizeCtrl?.render(target, native);
    };
    requestAnimationFrame(fire);
    setTimeout(fire, 100);
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
        lastFedTargetCues = targetCues;
        lastFedNativeCues = nativeCues;
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
      // Runtime visibility is owned by the engine (user toggles + study-mode
      // steps); stored style objects only carry appearance — never let a
      // settings write re-assert visibility over either owner.
      if (newSettings?.subtitleOverlayTargetStyle) {
        targetStyle = { ...newSettings.subtitleOverlayTargetStyle, visible: blockController.getTargetStyle().visible };
      }
      if (newSettings?.subtitleOverlayNativeStyle) {
        nativeStyle = { ...newSettings.subtitleOverlayNativeStyle, visible: blockController.getNativeStyle().visible };
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
      if (Object.keys(update).length > 0) {
        blockController.updateSettings(update);
      }
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
    if (blockController.isStudyModeActive()) return;
    targetStyle = { ...targetStyle, visible: true };
    nativeStyle = { ...nativeStyle, visible: true };
    blockController.updateSettings({ targetStyle, nativeStyle });
    blockController.syncHiddenState();
  }

  function toggleOverlay(): void {
    const result = toggleOverlayState(overlayVisible, targetStyle, nativeStyle);
    overlayVisible = result.overlayVisible;
    targetStyle = result.targetStyle;
    nativeStyle = result.nativeStyle;
    blockController.updateSettings({ targetStyle, nativeStyle });
    blockController.syncHiddenState();
  }

  function togglePlay(): void {
    if (video.paused) {
      playVideo(video).catch(() => { /* autoplay may be blocked */ });
    } else {
      pauseVideo(video);
    }
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
  const ctx: ContentScriptContext = {
    video,
    container,
    blockController,
    syncController,
    sharedWebTextCtrl,
    debouncedToast,
    getOffsetController: () => offsetController,
    getShortcuts: () => shortcuts,
    isSidePanelOpen: () => sidePanelOpen,
    setSidePanelOpen: (open) => { sidePanelOpen = open; },
    getEffectiveMs,
    getBilingualCues: () => bilingualCues,
    setBilingualCues: (cues) => { bilingualCues = cues; },
    getTranslatePrefill: () => translatePrefill,
    setTranslatePrefill: (prefill) => { translatePrefill = prefill; },
    getLastAutoLoadUrl: () => lastAutoLoadUrl,
    setLastAutoLoadUrl: (url) => { lastAutoLoadUrl = url; },
    getLastAutoLoadKey: () => lastAutoLoadKey,
    setLastAutoLoadKey: (key) => { lastAutoLoadKey = key; },
    showOverlay,
    toggleOverlay,
    togglePlay,
    refreshPanel,
    syncSidePanelFromBlock,
    clearTranslatedNativeState,
    updateGenerateNativeEnabled,
    handleCardCreatorAction,
    handleGenerateNative,
    handleSubtitleStatusKey: (key) => subtitleTokenizeCtrl?.handleStatusKey(key) ?? false,
    syncSubtitleTokenize,
  };

  const processImportedFiles = createProcessImportedFiles(ctx);
  const { onManagerSelect, handleSearchResultSelect } = createSubtitleSelectionHandlers(ctx);
  const { onKeydown, onKeyup } = createContentScriptKeyboardHandlers(ctx);
  const { onRuntimeMessage, onRuntimeMessage2 } = createContentScriptMessageHandlers(ctx);
  const { onVisibilityChange, onSpaNav, onOcrTracksMessage } = createContentScriptLifecycleHandlers(ctx);

  // ADR-034: listen on window capture (not document capture) so Cell fires
  // BEFORE host keydown listeners (e.g. YouTube space = play/pause). window is
  // the topmost ancestor — capture phase runs window → document → target.
  // stopImmediatePropagation here blocks ALL downstream listeners (document,
  // body, target, bubble) so host's space handler never runs when Cell handles it.
  // ponytail ceiling: if a host listens on window capture AND registers before
  // Cell, it runs first. Upgrade: CDP Input.dispatchKeyEvent interception.
  window.addEventListener('keydown', onKeydown, true);
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

  onMessage(onRuntimeMessage);

  // === File import wiring ===
  // File picker (import button) is wired inside loadOverlayStyles().then()
  // above, because the import button is created asynchronously by the
  // controller/panel. Wiring here at top-level would query a non-existent
  // button. Drag-drop below wires on `container` (already exists) so it can
  // run at top-level.
  wireContainerDragImport(container, (files) => { void processImportedFiles(files, container); });

  onMessage(onRuntimeMessage2);

  // Request a re-push of AUTO_LOAD_SUBTITLES in case background pushed before
  // this content-script was ready (race: SW restart, late injection). Background
  // reads from chrome.storage.session (ADR-007 D2).
  void sendMessage({
    type: MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES,
    payload: { tabId: undefined }, // background resolves from sender.tab.id
  });

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

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('yt-navigate-finish', onSpaNav);
  window.addEventListener('popstate', onSpaNav);
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
