import { sendMessage, onMessage, onStorageChanged, removeOnMessageListener } from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { isoCodeToLabel } from '@/features/detection/logic/languageDetector';
import { injectThemeTokens } from '@/shared/lib/themeTokens';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS, DEFAULT_SETTINGS } from '@/shared/config/config';
import {
  parseAndDetectFiles,
  assignImportRole,
  createDragHint,
  showToast,
  handleAutoLoadSubtitles,
  fetchAndParseSubtitle,
  resolveFormat,
  mergeCuesForPanel,
  createImportButton,
  createToggleButton,
  seekToCue,
  handleShortcutKey,
  isEditableTarget,
  createSubtitleManagerPanel,
  createDebouncedToast,
  formatSubtitleName,
  seekVideo,
  playVideo,
  pauseVideo,
} from '@/features/subtitle';
import { SubtitleBlockController, type SubtitleBlockControllerUpdate, type CardCreatorAction } from '@/features/subtitle/ui/subtitleBlockController';
import { OffsetController } from '@/features/subtitle/ui/offsetController';
import { BackgroundPrefillController } from '@/features/translate/logic/translatePrefill';
import { mountCardCreatorDialog, buildCardCreatorContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { TranslateResult } from '@/entities/message';
import type { OverlayConfig, OverlayStyleConfig } from '@/entities/subtitle';
import type { BilingualCue, KeyboardShortcut, SrtCue, NavClusterSettings, SubtitleBlockSettings, Settings } from '@/entities/media';
import type { CardCreatorSettings } from '@/entities/settings';
import type { AutoLoadSubtitlesPayload, SubtitleForOverlayResult } from '@/entities/message';
import type { SubtitlePanelItem, SubtitleManagerPanel, ParsedFile } from '@/features/subtitle';

// === Subtitle Overlay Integration ===
// ponytail: minimal config — defaults sufficient for v1, settings wiring is phase 2
const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  targetLanguage: '',
  autoLoadEnabled: false,
  fontSize: 24,
  position: 'bottom',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  textColor: '#ffffff',
  showTimestamps: false,
};

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
        buttonOpacity: settings.navClusterButtonOpacity,
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

/**
 * Find the overlay container for a video — ADR-008 D2.
 *
 * Starts at `video.parentElement` and walks up to the first ancestor whose
 * height is at least 50% of the video's height. This handles sites where
 * `video.parentElement` has zero height (e.g. YouTube's `.html5-video-container`
 * has `height:0` with the `<video>` absolutely positioned inside it, while the
 * real sized container is `#movie_player` — the grandparent). On normal sites
 * the parent already matches the video height, so the walk-up stops immediately.
 * Falls back to `document.body` if no suitable ancestor is found.
 */
function findVideoContainer(video: HTMLVideoElement): HTMLElement {
  const videoHeight = video.getBoundingClientRect().height;
  let el: HTMLElement | null = video.parentElement;
  while (el && el !== document.body) {
    const h = el.getBoundingClientRect().height;
    if (videoHeight > 0 && h >= videoHeight * 0.5) return el;
    el = el.parentElement;
  }
  return video.parentElement ?? document.body;
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

export function init(video: HTMLVideoElement): () => void {
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
  let offsetController: OffsetController | null = null;
  // ADR-026: Card Creator dialog mount controller (lazy-initialized on first open).
  let cardCreatorMount: ReturnType<typeof mountCardCreatorDialog> | null = null;
  let cardCreatorSettings: CardCreatorSettings | null = null;
  // Track the latest target/native cues for the block controller and side panel.
  let latestTargetCues: SrtCue[] = [];
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

  /** Update generate-native button disabled state based on target cues + settings. */
  function updateGenerateNativeEnabled(): void {
    const settings = currentSettings;
    const hasTarget = latestTargetCues.length > 0;
    const sl = settings?.subtitleOverlayTargetLanguage ?? '';
    const tl = settings?.subtitleOverlayNativeLanguage ?? '';
    const validLang = sl.length > 0 && tl.length > 0 && sl !== tl;
    blockController.setGenerateNativeEnabled(hasTarget && validLang && settingsLoaded);
  }

  /** Clear the in-memory translated native slot (used when target changes or SPA nav). */
  function clearTranslatedNativeState(): void {
    translatedNativeSlot = null;
    activeGenerateRunId = -1;
  }

  const blockController = new SubtitleBlockController(
    video,
    container,
    blockSettings,
    targetStyle,
    nativeStyle,
    clusterSettings,
    () => offsetController?.getOffsetMs() ?? 0,
    (partial) => {
      if (!settingsLoaded) return;
      blockSettings = { ...blockSettings, ...partial };
      void saveSettings({ subtitleBlockSettings: blockSettings } as Partial<Settings>);
    },
    // ADR-026: Card Creator entry buttons (quick update + edit) + q/e keyboard.
    (action) => { handleCardCreatorAction(action); },
    // Generate native subtitle button/shortcut.
    () => { void handleGenerateNative(); },
  );

  /** ADR-026: Handle Card Creator action (quick-update or edit-card). */
  /** Wait for the video to reach readyState ≥ 2 (HAVE_CURRENT_DATA) with a
   *  timeout. Used before screenshot capture — the user may have just seeked
   *  or paused, leaving the video in a transient state where drawImage would
   *  throw "Video not ready". */
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
          resolve(); // give up — captureScreenshot will throw a clear error
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  async function handleCardCreatorAction(action: CardCreatorAction): Promise<void> {
    // Load settings fresh (URL/deck/noteType/lang may have changed since init).
    let settings: Settings;
    try {
      settings = await loadSettings();
    } catch {
      showToast('Cannot load settings — storage unavailable.', container, { variant: 'error' });
      return;
    }
    cardCreatorSettings = settings.cardCreator;

    // ADR-026: prefetch AnkiConnect decks + models NOW (on click) so the
    // network round-trip overlaps with media capture (screenshot + sentence
    // audio, 2-5s). When the dialog mounts and loadData runs, it reuses the
    // cached promise — resolving instantly if capture finished first.
    void prefetchAnkiConnectData(cardCreatorSettings.ankiConnectUrl).catch(() => {
      // Prefetch failure is non-fatal — loadData will retry with a fresh
      // promise and surface the error via toast.
    });

    // Lazy-init the dialog mount on first action.
    if (!cardCreatorMount) {
      cardCreatorMount = mountCardCreatorDialog(cardCreatorSettings, container);
    } else {
      cardCreatorMount.updateSettings(cardCreatorSettings);
    }

    // Build context from current subtitle state + actual subtitle languages.
    const sourceLang = settings.subtitleOverlayTargetLanguage || 'en';
    const targetLang = settings.subtitleOverlayNativeLanguage || 'vi';
    const ctx = buildCardCreatorContext(
      video,
      blockController.getTargetCues(),
      blockController.getNativeCues(),
      offsetController?.getOffsetMs() ?? 0,
      sourceLang,
      targetLang,
    );
    if (!ctx) {
      showToast('No active subtitle — play the video and wait for a subtitle line.', container, { variant: 'info' });
      return;
    }

    // ADR-026 / spec §3 + §4: capture screenshot + sentence audio BEFORE
    // opening the dialog. The screenshot must reflect the frame the user saw
    // when they clicked (before any UI changes). Audio capture seeks the video
    // to cue.start and plays until cue.end — doing this before the dialog opens
    // avoids the overlay interfering with playback. Show a brief "capturing"
    // toast so the user knows why there's a short delay.
    showToast('Capturing media…', container, { variant: 'info' });
    // Wait for the video to be ready (readyState ≥ 2) before capturing — the
    // user may have just seeked/paused, leaving the video in a transient state.
    await waitForVideoReady(video);
    const initialMedia: MediaFile[] = [];
    try {
      const screenshot = await captureScreenshot(video);
      initialMedia.push(screenshot);
    } catch {
      // Screenshot failure is non-fatal — the user can re-capture manually.
    }
    try {
      const audioR = await captureSentenceAudio(video, { start: ctx.cue.start, end: ctx.cue.end });
      if (audioR.ok) initialMedia.push(audioR.file);
    } catch {
      // Audio failure is non-fatal — screenshot + text fields still work.
    }

    cardCreatorMount.open({ ...ctx, initialMedia }, action);
  }

  /** Generate native subtitle by translating the active target cues into the
   *  configured native language. Reuses BackgroundPrefillController and creates
   *  a single in-memory translated manager entry (virtual replacement). */
  async function handleGenerateNative(): Promise<void> {
    const runId = nextGenerateRunId++;
    activeGenerateRunId = runId;

    // Cancel any existing prefill (auto-translate or previous generate).
    translatePrefill?.clear();
    translatePrefill = null;

    // Snapshot the active native slot before we create the new virtual slot.
    const baseNativeItems = [...autoNativeItems, ...importedNativeItems];
    let replacedSource: 'auto' | 'imported' | null;
    let replacedIndex: number;
    if (activeNativeSource === 'translated' && translatedNativeSlot) {
      replacedSource = translatedNativeSlot.replacedSource;
      replacedIndex = translatedNativeSlot.replacedIndex;
    } else if (activeNativeSource === 'imported' && importedNativeItems.length > 0) {
      replacedSource = 'imported';
      replacedIndex = autoNativeItems.length + activeImportNativeIndex;
    } else if (autoNativeItems.length > 0) {
      replacedSource = 'auto';
      replacedIndex = activeNativeIndex;
    } else {
      replacedSource = null;
      replacedIndex = 0;
    }
    replacedIndex = Math.min(Math.max(0, replacedIndex), baseNativeItems.length);

    // Snapshot the active target item for format propagation.
    const targetInfo = mergedPanelItems('target');
    const targetItem = targetInfo.items[targetInfo.activeIndex];

    const settings = await loadSettings();
    currentSettings = settings;
    const sl = settings.subtitleOverlayTargetLanguage ?? '';
    const tl = settings.subtitleOverlayNativeLanguage ?? '';

    // Abort if a newer run has superseded this one while loading settings.
    if (activeGenerateRunId !== runId) return;

    if (!sl || !tl || sl === tl) {
      showToast('Target and native languages must differ', container, { variant: 'info' });
      updateGenerateNativeEnabled();
      return;
    }

    if (latestTargetCues.length === 0) {
      showToast('No target subtitle to translate', container, { variant: 'info' });
      updateGenerateNativeEnabled();
      return;
    }

    const targetCues = [...latestTargetCues];
    const targetFormat = targetItem?.format ?? 'srt';
    const targetSize = targetItem?.size;
    const nativeLabel = isoCodeToLabel(tl) ?? tl;
    const translatedItem: SubtitlePanelItem = {
      id: 'translated-native',
      name: `${nativeLabel} (translated)`,
      format: targetFormat,
      size: targetSize,
      source: 'translated',
      role: 'native',
      index: 0,
    };
    translatedNativeSlot = {
      replacedSource,
      replacedIndex,
      item: translatedItem,
      cues: [],
      runId,
    };
    activeNativeSource = 'translated';
    refreshPanel('native');
    showToast('Generating native subtitle…', container, { variant: 'info' });
    blockController.setGenerateNativeEnabled(false);

    translatePrefill = new BackgroundPrefillController({
      translate: async (text: string): Promise<string[]> => {
        const res = await sendMessage<{ success?: boolean; data?: TranslateResult; error?: string }>({
          type: MESSAGE_TYPES.TRANSLATE,
          payload: { text, sl, tl },
        });
        if (!res?.success || !res.data?.translated) {
          throw new Error(res?.error ?? 'translate failed');
        }
        return res.data.translated;
      },
      onChunkTranslated: (translatedCues: SrtCue[]) => {
        if (activeGenerateRunId !== runId || !translatedNativeSlot || translatedNativeSlot.runId !== runId) return;
        translatedNativeSlot.cues = translatedCues;
        blockController?.loadBilingualCues(targetCues, translatedCues);
        showOverlay();
        bilingualCues = mergeCuesForPanel(targetCues, translatedCues);
        void sendMessage({
          type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
          payload: { tabId: undefined, cues: bilingualCues },
        });
        refreshPanel('native');
      },
      onError: (msg: string) => {
        if (activeGenerateRunId !== runId || !translatedNativeSlot || translatedNativeSlot.runId !== runId) return;
        showToast(msg, container, { variant: 'error' });
        updateGenerateNativeEnabled();
      },
      onComplete: () => {
        if (activeGenerateRunId !== runId || !translatedNativeSlot || translatedNativeSlot.runId !== runId) return;
        showToast('Native subtitle generated', container, { variant: 'success' });
        updateGenerateNativeEnabled();
      },
    });
    translatePrefill.start(targetCues, sl, tl);
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

    // ADR-015 UI v4: create import button + manager panel.
    // Legacy target/native dropdowns are removed; the manager panel handles selection
    // for both auto-detected and imported subtitles via a unified onSelect handler.
    const importButton = createImportButton(container, DEFAULT_OVERLAY_CONFIG);
    managerPanel = createSubtitleManagerPanel(container, importButton, {
      onSelect: (role, index) => { void onManagerSelect(role, index); },
    });

    // ADR-019: init offset controller — offset section nested trong manager panel.
    // Load settings snapshot (for persisted offset per-URL).
    let offsetSnapshot: { subtitleOffset?: Record<string, number> } = {};
    try {
      const settings = await loadSettings();
      offsetSnapshot = { subtitleOffset: settings.subtitleOffset ?? {} };
    } catch {
      // ponytail: storage might not be available in test contexts — fallback empty
    }
    offsetController = new OffsetController(
      video,
      container,
      window.location.href,
      offsetSnapshot,
      managerPanel.panel,
    );
    offsetController.init();
    // ADR-025: offset provider already wired in SubtitleBlockController constructor.

    // Wire file picker (import button) → processImportedFiles. Must run AFTER
    // managerPanel creation because the import button is created inside the
    // controller/panel (async). Wiring at top-level would query a non-existent
    // button and silently skip — bug: import button did nothing while drag-drop
    // worked (drag-drop wires on `container` which already exists).
    const importButtonEl = managerPanel.importButton;
    const fileInput = importButtonEl.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files ?? []);
        if (files.length === 0) return;
        await processImportedFiles(files, container);
        fileInput.value = ''; // reset so same file can be re-selected
      });
    }

    // ADR-013 D3 + ADR-025: listen chrome.storage.onChanged → update block controller realtime
    onStorageChanged((changes, area) => {
      if (area !== 'local') return;
      const newSettings = changes.settings?.newValue as Settings | undefined;
      if (!newSettings) return;
      if (newSettings.subtitleOverlayTargetStyle) {
        targetStyle = { ...newSettings.subtitleOverlayTargetStyle, visible: overlayVisible };
      }
      if (newSettings.subtitleOverlayNativeStyle) {
        nativeStyle = { ...newSettings.subtitleOverlayNativeStyle, visible: overlayVisible };
      }
      if (newSettings.subtitleBlockSettings) {
        blockSettings = { ...newSettings.subtitleBlockSettings };
      }
      const clusterPartial: Partial<NavClusterSettings> = {
        ...(newSettings.navClusterEnabled !== undefined && { enabled: newSettings.navClusterEnabled }),
        ...(newSettings.navClusterButtonSize !== undefined && { buttonSize: newSettings.navClusterButtonSize as NavClusterSettings['buttonSize'] }),
        ...(newSettings.navClusterButtonOpacity !== undefined && { buttonOpacity: newSettings.navClusterButtonOpacity }),
      };
      if (Object.keys(clusterPartial).length > 0) {
        clusterSettings = { ...clusterSettings, ...clusterPartial };
      }
      const update: SubtitleBlockControllerUpdate = {
        ...(newSettings.subtitleOverlayTargetStyle && { targetStyle }),
        ...(newSettings.subtitleOverlayNativeStyle && { nativeStyle }),
        ...(newSettings.subtitleBlockSettings && { blockSettings }),
        ...(Object.keys(clusterPartial).length > 0 && { clusterSettings: clusterPartial }),
      };
      if (Object.keys(update).length > 0) blockController.updateSettings(update);
      // Reload keyboard shortcuts so remaps (e.g. 't' → 'y') take effect
      // without a page reload. loadShortcuts reads from the new settings.
      if (newSettings.keyboardShortcuts) {
        loadShortcuts().then((s) => { shortcuts = s; });
      }
    });
  });

  // === State ===
  let toggleBtn: HTMLButtonElement | null = null;
  let overlayVisible = false; // ponytail: match overlay initial display:none

  // ADR-025: auto-show overlay when cues load. Without this, block stays hidden
  // (visible=false) even after auto-load/import — user had to press shortcut.
  function showOverlay(): void {
    if (overlayVisible) return;
    overlayVisible = true;
    targetStyle = { ...targetStyle, visible: true };
    nativeStyle = { ...nativeStyle, visible: true };
    blockController.updateSettings({ targetStyle, nativeStyle });
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
  // > 50ms to detect seek-in-progress (works both directions). 50ms tolerance
  // is small enough to settle quickly, large enough for float jitter.
  // Listener catches ALL seeks (keydown, NavCluster, Side Panel, external).
  let lastSeekTargetMs: number | null = null;
  const SEEK_SETTLE_TOLERANCE_MS = 50;
  const onNfSeek = (e: Event) => {
    lastSeekTargetMs = (e as CustomEvent).detail as number;
  };
  document.addEventListener('__NF_SEEK', onNfSeek);

  /** Effective time for cue lookup: lastSeekTarget if seek in progress, else video.currentTime. */
  const getEffectiveMs = (): number => {
    const offsetMs = offsetController?.getOffsetMs() ?? 0;
    const videoMs = video.currentTime * 1000;
    // Seek in progress if video hasn't reached target (either direction).
    if (lastSeekTargetMs !== null && Math.abs(videoMs - lastSeekTargetMs) > SEEK_SETTLE_TOLERANCE_MS) {
      return lastSeekTargetMs + offsetMs;
    }
    // Reached target → settled → use actual video time
    lastSeekTargetMs = null;
    return videoMs + offsetMs;
  };

  // Track active sub indices + all matches for re-fetch on dropdown select
  let activeTargetIndex = 0;
  let activeNativeIndex = 0;
  let targetMatches: readonly SubtitleForOverlayResult[] = [];
  let nativeMatches: readonly SubtitleForOverlayResult[] = [];
  // ADR-015 T11: unified Subtitle Manager Panel (replaces V1 dropdowns long-term)
  let managerPanel: SubtitleManagerPanel | null = null;
  // ADR-015 T10: imported subtitle items per role (for panel display + select)
  let importedTargetItems: SubtitlePanelItem[] = [];
  let importedNativeItems: SubtitlePanelItem[] = [];
  let activeImportTargetIndex = 0;
  let activeImportNativeIndex = 0;
  // ADR-015: auto-detected subtitle items per role (panel display + refresh after select)
  let autoTargetItems: SubtitlePanelItem[] = [];
  let autoNativeItems: SubtitlePanelItem[] = [];
  // Track which source is currently active per role (so merged panel highlights
  // the correct item when both auto + imported exist).
  let activeTargetSource: 'auto' | 'imported' = 'auto';
  let activeNativeSource: 'auto' | 'imported' | 'translated' = 'auto';
  // Generate-native: virtual replacement slot in the native manager panel.
  // Underlying auto/imported arrays are not mutated; this slot replaces the
  // active native item in the merged panel display and provides translated cues.
  interface TranslatedNativeSlot {
    readonly replacedSource: 'auto' | 'imported' | null;
    readonly replacedIndex: number;
    readonly item: SubtitlePanelItem;
    cues: SrtCue[];
    readonly runId: number;
  }
  let translatedNativeSlot: TranslatedNativeSlot | null = null;

  /**
   * Build merged panel items for a role: auto items first, then imported items.
   * Returns the merged list + the active index in the merged space.
   * ADR-015 T10 fix: previously import REPLACED auto items in the panel (bug:
   * auto-loaded subtitles vanished after import). Now both coexist — user can
   * switch between auto-detected and imported subtitles freely.
   */
  const mergedPanelItems = (role: 'target' | 'native'): { items: SubtitlePanelItem[]; activeIndex: number } => {
    const autoItems = role === 'target' ? autoTargetItems : autoNativeItems;
    const importedItems = role === 'target' ? importedTargetItems : importedNativeItems;
    const autoActive = role === 'target' ? activeTargetIndex : activeNativeIndex;
    const importActive = role === 'target' ? activeImportTargetIndex : activeImportNativeIndex;
    const source = role === 'target' ? activeTargetSource : activeNativeSource;
    const baseItems = [...autoItems, ...importedItems];

    // Generate-native: always include the translated virtual entry in the panel
    // so the user can switch back to it; highlight it when activeNativeSource
    // is 'translated'.
    if (role === 'native' && translatedNativeSlot) {
      const idx = Math.min(Math.max(0, translatedNativeSlot.replacedIndex), baseItems.length);
      const items = [...baseItems.slice(0, idx), translatedNativeSlot.item, ...baseItems.slice(idx + 1)];
      if (source === 'translated') {
        return { items, activeIndex: idx };
      }
      if (source === 'imported' && importedItems.length > 0) {
        const baseIdx = autoItems.length + importActive;
        return { items, activeIndex: baseIdx >= idx ? baseIdx + 1 : baseIdx };
      }
      const baseIdx = autoActive;
      return { items, activeIndex: baseIdx >= idx ? baseIdx + 1 : baseIdx };
    }

    if (source === 'imported' && importedItems.length > 0) {
      return { items: baseItems, activeIndex: autoItems.length + importActive };
    }
    return { items: baseItems, activeIndex: autoActive };
  };

  const refreshPanel = (role: 'target' | 'native'): void => {
    const { items, activeIndex } = mergedPanelItems(role);
    if (role === 'target') managerPanel?.updateTarget(items, activeIndex);
    else managerPanel?.updateNative(items, activeIndex);
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
    void sendMessage({
      type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
      payload: { tabId: undefined, cues: bilingualCues },
    });
  };
  // ADR-015 T10: parsed files side-map (panel items don't carry cues)
  let importedParsedTarget: ParsedFile[] = [];
  let importedParsedNative: ParsedFile[] = [];
  // ADR-015 T7: debounced toast (collapses rapid import/switch messages)
  const debouncedToast = createDebouncedToast(showToast, 500);

  // Load shortcuts from storage
  loadShortcuts().then((s) => { shortcuts = s; });

  // Create toggle button (overlay) — click → open Side Panel
  toggleBtn = createToggleButton(container);

  // Toggle Side Panel open/close (ADR-008 D1). Shared by button click + 't'
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

  toggleBtn.addEventListener('click', toggleSidePanel);

  // Manager panel is created asynchronously inside loadOverlayStyles().then()
  // so it can reuse the import button created by SubtitleOverlayController.

  // Wire keyboard shortcuts. Capture phase (3rd arg = true) so we fire BEFORE
  // YouTube's own keydown listeners (e.g. 't' = theater mode) and can block
  // them via stopImmediatePropagation when the key matches a configured action.
  const onKeydown = (e: KeyboardEvent) => {
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
    if (!isEditableTarget(e.target)) {
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

    const action = handleShortcutKey(e.key.toLowerCase(), shortcuts, e.target, {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    });
    console.log('[DEBUG keydown]', { key: e.key, action, cueCount: bilingualCues.length, currentMs: Math.round(video.currentTime * 1000), shortcutsLen: shortcuts.length });
    if (!action) return;
    // Block YouTube's own shortcuts (e.g. 't' = theater mode) + other
    // same-target listeners so only our action runs.
    e.preventDefault();
    e.stopImmediatePropagation();

    // ADR-032: dedupe cue-nav when Side Panel also fires SHORTCUT_ACTION.
    if ((action === 'prev-cue' || action === 'next-cue' || action === 'replay-cue') && shouldDedupeCueSeek(action)) {
      return;
    }

    switch (action) {
      case 'prev-cue': {
        // ADR-019 sync: find cue via effective time, seek so overlay DISPLAYS it.
        // ADR-033: use getEffectiveMs so rapid press computes from intended pos.
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = getEffectiveMs();
        const prevCue = [...bilingualCues].reverse().find((c) => c.end < effectiveMs);
        if (prevCue) seekToCue(video, prevCue, offsetMs);
        break;
      }
      case 'next-cue': {
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = getEffectiveMs();
        const nextCue = bilingualCues.find((c) => c.start > effectiveMs + 100);
        if (nextCue) seekToCue(video, nextCue, offsetMs);
        break;
      }
      case 'replay-cue': {
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = getEffectiveMs();
        // Half-open [start, end) — at boundary t = cue[i].end = cue[i+1].start,
        // match the NEXT cue, not the previous one (replay-cue "jump back" bug).
        const currentCue = bilingualCues.find((c) => c.start <= effectiveMs && c.end > effectiveMs)
          ?? [...bilingualCues].reverse().find((c) => c.start < effectiveMs);
        if (currentCue) seekToCue(video, currentCue, offsetMs);
        break;
      }
      case 'toggle-overlay': {
        overlayVisible = !overlayVisible;
        targetStyle = { ...targetStyle, visible: overlayVisible };
        nativeStyle = { ...nativeStyle, visible: overlayVisible };
        blockController.updateSettings({ targetStyle, nativeStyle });
        break;
      }
      case 'toggle-panel': {
        // Call toggleSidePanel directly. Per Chrome sidePanel docs, a keyboard
        // shortcut is a valid user gesture for sidePanel.open() — no need to
        // route through a synthetic button click. toggleSidePanel sends
        // OPEN/CLOSE_SIDE_PANEL to background, which calls chrome.sidePanel.
        toggleSidePanel();
        break;
      }
      case 'toggle-translate': {
        // ADR-021 D7: temporary toggle (no setting change). Same logic as
        // SHORTCUT_ACTION handler above — extract to shared helper if grows.
        if (translatePrefill?.isRunning) {
          translatePrefill.clear();
          translatePrefill = null;
          blockController?.loadBilingualCues(latestTargetCues, []);
          bilingualCues = mergeCuesForPanel(latestTargetCues, []);
          // latestNativeCues tracked by blockController — no longer needed here
          // updateCues(latestTargetCues, []);
          showToast('Auto-translate off', container, { variant: 'info' });
        } else if (latestTargetCues.length > 0) {
          void (async () => {
            const s = await loadSettings();
            const sl = s.subtitleOverlayTargetLanguage;
            const tl = s.subtitleOverlayNativeLanguage;
            if (!sl || !tl || sl === tl) return;
            translatePrefill?.clear();
            translatePrefill = new BackgroundPrefillController({
              translate: async (text: string): Promise<string[]> => {
                const res = await sendMessage<{ success?: boolean; data?: TranslateResult; error?: string }>({
                  type: MESSAGE_TYPES.TRANSLATE,
                  payload: { text, sl, tl },
                });
                if (!res?.success || !res.data?.translated) {
                  throw new Error(res?.error ?? 'translate failed');
                }
                return res.data.translated;
              },
              onChunkTranslated: (translatedCues: SrtCue[]) => {
                blockController?.loadBilingualCues(latestTargetCues, translatedCues);
                showOverlay();
                bilingualCues = mergeCuesForPanel(latestTargetCues, translatedCues);
                // updateCues(latestTargetCues, translatedCues);
                void sendMessage({
                  type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
                  payload: { tabId: undefined, cues: bilingualCues },
                });
              },
              onError: (msg: string) => {
                showToast(msg, container, { variant: 'error' });
              },
            });
            translatePrefill.start(latestTargetCues, sl, tl);
            showToast('Auto-translate on', container, { variant: 'success' });
          })();
        }
        break;
      }
      // ADR-026: Card Creator entry shortcuts (q quick-update, e edit-card).
      // Guard: dialog open → let dialog handle keys. auto-repeat → no action.
      case 'quick-update':
      case 'edit-card': {
        if (e.repeat) return;
        if (cardCreatorMount?.isOpen()) return;
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
  document.addEventListener('keydown', onKeydown, true);

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
          case 'prev-cue': {
            const prevCue = [...bilingualCues].reverse().find((c) => c.end < effectiveMs);
            if (prevCue) seekToCue(video, prevCue, offsetMs);
            break;
          }
          case 'next-cue': {
            const nextCue = bilingualCues.find((c) => c.start > effectiveMs + 100);
            if (nextCue) seekToCue(video, nextCue, offsetMs);
            break;
          }
          case 'replay-cue': {
            // Half-open [start, end) — see in-page keydown handler above.
            const currentCue = bilingualCues.find((c) => c.start <= effectiveMs && c.end > effectiveMs)
              ?? [...bilingualCues].reverse().find((c) => c.start < effectiveMs);
            if (currentCue) seekToCue(video, currentCue, offsetMs);
            break;
          }
          case 'toggle-overlay': {
          overlayVisible = !overlayVisible;
          targetStyle = { ...targetStyle, visible: overlayVisible };
          nativeStyle = { ...nativeStyle, visible: overlayVisible };
          blockController.updateSettings({ targetStyle, nativeStyle });
          break;
        }
        case 'toggle-translate': {
          // ADR-021 D7: temporary toggle (no setting change).
          // If prefill running → clear + hide native overlay. If not → restart from latestTargetCues.
          if (translatePrefill?.isRunning) {
            translatePrefill.clear();
            translatePrefill = null;
            // Reload target-only (no native) to hide translated overlay
            blockController?.loadBilingualCues(latestTargetCues, []);
            bilingualCues = mergeCuesForPanel(latestTargetCues, []);
            // latestNativeCues tracked by blockController — no longer needed here
            // updateCues(latestTargetCues, []);
            showToast('Auto-translate off', container, { variant: 'info' });
          } else if (latestTargetCues.length > 0) {
            // Restart prefill — load settings for sl/tl
            void (async () => {
              const s = await loadSettings();
              const sl = s.subtitleOverlayTargetLanguage;
              const tl = s.subtitleOverlayNativeLanguage;
              if (!sl || !tl || sl === tl) return;
              translatePrefill?.clear();
              translatePrefill = new BackgroundPrefillController({
                translate: async (text: string): Promise<string[]> => {
                  const res = await sendMessage<{ success?: boolean; data?: TranslateResult; error?: string }>({
                    type: MESSAGE_TYPES.TRANSLATE,
                    payload: { text, sl, tl },
                  });
                  if (!res?.success || !res.data?.translated) {
                    throw new Error(res?.error ?? 'translate failed');
                  }
                  return res.data.translated;
                },
                onChunkTranslated: (translatedCues: SrtCue[]) => {
                  blockController?.loadBilingualCues(latestTargetCues, translatedCues);
                  bilingualCues = mergeCuesForPanel(latestTargetCues, translatedCues);
                  // updateCues(latestTargetCues, translatedCues);
                  void sendMessage({
                    type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
                    payload: { tabId: undefined, cues: bilingualCues },
                  });
                },
                onError: (msg: string) => {
                  showToast(msg, container, { variant: 'error' });
                },
              });
              translatePrefill.start(latestTargetCues, sl, tl);
              showToast('Auto-translate on', container, { variant: 'success' });
            })();
          }
          break;
        }
        }
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
    dragHint.style.display = 'flex';
  });
  container.addEventListener('dragover', (e) => e.preventDefault());
  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragHint.style.display = 'none';
    }
  });
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragHint.style.display = 'none';
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
      console.log('[content-script] AUTO_LOAD_SUBTITLES received', {
        targetUrl: payload?.target?.url,
        nativeUrl: payload?.native?.url,
        targetLang: payload?.target?.language,
        nativeLang: payload?.native?.language,
        targetMatchesCount: payload?.targetMatches?.length,
        nativeMatchesCount: payload?.nativeMatches?.length,
      });

      // Skip duplicate payloads to avoid re-loading the same subtitle and
      // restarting translate prefill (e.g. when PAGE_SCAN_RESULT or network
      // re-detection re-pushes the same target/native URLs on seek).
      const autoLoadKey = `${payload?.target?.url ?? ''}|${payload?.native?.url ?? ''}`;
      if (autoLoadKey === lastAutoLoadKey && autoLoadKey !== '|') {
        console.log('[content-script] AUTO_LOAD_SUBTITLES duplicate, skipping');
        return;
      }
      lastAutoLoadKey = autoLoadKey;

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
        latestTargetCues = [];
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
        activeNativeSource = 'auto';
        updateGenerateNativeEnabled();
        showToast('No subtitles detected', container, { variant: 'warning' });
      }
      // ADR-021: clear translate prefill on SPA nav (URL changed)
      if (lastAutoLoadUrl !== undefined && lastAutoLoadUrl !== currentUrl) {
        translatePrefill?.clear();
        translatePrefill = null;
        clearTranslatedNativeState();
        activeNativeSource = 'auto';
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
            activeNativeSource = 'auto';
            updateGenerateNativeEnabled();
          },
        },
        tabUrl: window.location.href,
        onPanelRender: (targetCues: SrtCue[], nativeCues: SrtCue[]) => {
          bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
          // ADR-018: keep nav cluster cue source in sync with auto-loaded subtitles
          // (4↔6 nút transition when subtitles become available).
          latestTargetCues = targetCues;
          // Auto-load resets the translated native slot; native active is auto.
          clearTranslatedNativeState();
          activeNativeSource = 'auto';
          updateGenerateNativeEnabled();
          // updateCues(targetCues, nativeCues);
          // ADR-019: notify offset controller that subtitles loaded
          offsetController?.loadCues(true);
          console.log('[content-script] onPanelRender', {
            targetCueCount: targetCues.length,
            nativeCueCount: nativeCues.length,
            bilingualCueCount: bilingualCues.length,
          });
          // Send cues to Side Panel
          void sendMessage({
            type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
            payload: { tabId: undefined, cues: bilingualCues },
          });
        },
        onToast: (message, variant) => showToast(message, container, { variant }),
        autoTranslate: currentSettings.subtitleOverlayAutoTranslate,
        onStartTranslatePrefill: (targetCues: SrtCue[]) => {
          // ADR-021: start background prefill to translate target→native.
          // Translate function sends TRANSLATE message to background SW (CORS bypass).
          const sl = currentSettings.subtitleOverlayTargetLanguage;
          const tl = currentSettings.subtitleOverlayNativeLanguage;
          if (!sl || !tl || sl === tl) return;
          // If a manual generate-native is already active, don't overwrite it with
          // auto-translate. Manual generate is the user's explicit choice.
          if (translatedNativeSlot && activeNativeSource === 'translated') return;
          // Clear any previous prefill (SPA nav or re-trigger)
          translatePrefill?.clear();
          translatePrefill = new BackgroundPrefillController({
            translate: async (text: string): Promise<string[]> => {
              const res = await sendMessage<{ success?: boolean; data?: TranslateResult; error?: string }>({
                type: MESSAGE_TYPES.TRANSLATE,
                payload: { text, sl, tl },
              });
              if (!res?.success || !res.data?.translated) {
                throw new Error(res?.error ?? 'translate failed');
              }
              return res.data.translated;
            },
            onChunkTranslated: (translatedCues: SrtCue[]) => {
              // Feed translated cues to overlay (reuse loadBilingualCues path ADR-013/014)
              blockController?.loadBilingualCues(targetCues, translatedCues);
              showOverlay();
              // Update panel + nav cluster with bilingual cues
              bilingualCues = mergeCuesForPanel(targetCues, translatedCues);
              latestTargetCues = targetCues;
              // updateCues(targetCues, translatedCues);
              void sendMessage({
                type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
                payload: { tabId: undefined, cues: bilingualCues },
              });
            },
            onError: (msg: string) => {
              showToast(msg, container, { variant: 'error' });
            },
          });
          translatePrefill.start(targetCues, sl, tl);
        },
        onSubtitleMatches: (targetM, nativeM) => {
          targetMatches = targetM;
          nativeMatches = nativeM;
          // ADR-015 T4: update-in-place (bug #5 fix — no flicker, no stale index)
          // V1 destroyed + re-created dropdown on every push → flicker + stale
          // index when matches reordered. V2 calls update() to refresh list
          // items in-place, preserving icon element identity + activeIndex.
          // ADR-015: legacy target/native dropdowns removed. The unified manager
          // panel handles selection for both auto-detected and imported subs.
          // ADR-015: update manager panel with auto-detected matches (1+ subs).
          // Build panel items from matches so panel shows even with 1 sub.
          autoTargetItems = targetM.map((m, i) => ({
            id: `auto-target-${i}`,
            name: formatSubtitleName('auto', m.language, i, undefined, m.displayName),
            format: m.format,
            source: 'auto' as const,
            role: 'target' as const,
            index: i,
            isAsr: m.isAsr,
          }));
          autoNativeItems = nativeM.map((m, i) => ({
            id: `auto-native-${i}`,
            name: formatSubtitleName('auto', m.language, i, undefined, m.displayName),
            format: m.format,
            source: 'auto' as const,
            role: 'native' as const,
            index: i,
            isAsr: m.isAsr,
          }));
          // ADR-015 T10 fix: merge auto + imported items in panel (both visible).
          // Previously: imported items replaced auto items → auto subtitles vanished.
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

    // Build panel items
    importedTargetItems = assignment.target.map((f, i) => ({
      id: `imported-target-${i}`,
      name: formatSubtitleName('imported', '', i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'target' as const,
      index: i,
    }));
    importedNativeItems = assignment.native.map((f, i) => ({
      id: `imported-native-${i}`,
      name: formatSubtitleName('imported', '', i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'native' as const,
      index: i,
    }));
    importedParsedTarget = assignment.target;
    importedParsedNative = assignment.native;
    activeImportTargetIndex = 0;
    activeImportNativeIndex = 0;
    // ADR-015 T10 fix: merge auto + imported items in panel (both visible).
    // Mark active source as imported for roles that got imported files.
    if (assignment.target.length > 0) activeTargetSource = 'imported';
    if (assignment.native.length > 0) activeNativeSource = 'imported';
    // Import resets the translated native slot (new target/native sources).
    clearTranslatedNativeState();
    refreshPanel('target');
    refreshPanel('native');

    // Load cues: first target + first native (D1 merge keeps other side)
    const targetCues = assignment.target[0]?.cues ?? [];
    const nativeCues = assignment.native[0]?.cues ?? [];
    if (targetCues.length > 0 || nativeCues.length > 0) {
      blockController?.loadBilingualCues(targetCues, nativeCues);
      showOverlay();
      // ADR-018: update nav cluster cue source (4↔6 nút transition)
      latestTargetCues = targetCues;
      // updateCues(targetCues, nativeCues);
      // ADR-019: load sub mới → reset offset + cancel lazy (R5)
      offsetController?.loadCues(true);
      // ADR-015 T10: merge for Side Panel + keyboard shortcuts
      bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
      void sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: { tabId: undefined, cues: bilingualCues },
      });
    } else if (assignment.target.length === 0 && assignment.native.length === 0) {
      blockController?.loadCues(parsed[0].cues); // fallback: single mode
      showOverlay();
      // ADR-018: update nav cluster with single-mode cues
      latestTargetCues = parsed[0].cues;
      // updateCues(parsed[0].cues, []);
      // ADR-019: load sub mới → reset offset + cancel lazy (R5)
      offsetController?.loadCues(true);
    }
    updateGenerateNativeEnabled();

    // Active subtitle names are visible in the manager panel; chip removed.
    // Toast
    const total = assignment.target.length + assignment.native.length;
    const ignoredCount = assignment.ignored.length;
    if (total === 1) {
      debouncedToast(`Imported ${parsed[0].file.name}`, _container, { variant: 'success' });
    } else {
      const parts: string[] = [];
      if (assignment.target.length > 0) parts.push(`target:${assignment.target.length}`);
      if (assignment.native.length > 0) parts.push(`native:${assignment.native.length}`);
      const ignoredTxt = ignoredCount > 0 ? ` (${ignoredCount} ignored)` : '';
      debouncedToast(`Imported ${total} subtitle files (${parts.join(', ')})${ignoredTxt}`, _container, { variant: 'success' });
    }
  }

  /**
   * ADR-015 T10: Load target/native languages from chrome.storage.local.
   * Falls back to empty strings (assignImportRole handles empty → all ignored
   * → fallback-to-target).
   */
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

  /**
   * ADR-015 T11: User selected an imported subtitle via the manager panel.
   * Loads cues from the stored parsed file + toast.
   */
  async function onPanelSelect(role: 'target' | 'native', index: number): Promise<void> {
    const items = role === 'target' ? importedTargetItems : importedNativeItems;
    if (index >= items.length) return;
    if (role === 'target') { activeImportTargetIndex = index; activeTargetSource = 'imported'; }
    else { activeImportNativeIndex = index; activeNativeSource = 'imported'; }

    // Refresh manager panel active state immediately so the UI reflects the click.
    refreshPanel(role);

    // Retrieve cues from the parsed file (stored in a side map)
    const parsed = role === 'target'
      ? importedParsedTarget[index]
      : importedParsedNative[index];
    if (!parsed) return;

    if (role === 'target') {
      blockController?.loadBilingualCues(parsed.cues, []);
      latestTargetCues = parsed.cues;
      clearTranslatedNativeState();
      activeNativeSource = 'auto';
      activeNativeIndex = 0;
      refreshPanel('native');
      updateGenerateNativeEnabled();
    } else {
      blockController?.loadBilingualCues([], parsed.cues);
    }
    showOverlay();
    syncSidePanelFromBlock();
    debouncedToast(`Switched to ${parsed.file.name}`, container, { variant: 'success' });
  }

  // ADR-015 T10: side maps moved to state block above (importedParsedTarget/Native)

  /**
   * ADR-015: unified manager panel selection handler. The panel shows a merged
   * list (auto items first, then imported items). Route based on which item the
   * user clicked: auto items → onSubtitleSelect (re-fetch by auto index),
   * imported items → onPanelSelect (load parsed cues by imported index).
   */
  async function onManagerSelect(role: 'target' | 'native', index: number): Promise<void> {
    const { items } = mergedPanelItems(role);
    const item = items[index];
    if (!item) return;
    if (item.source === 'imported') {
      await onPanelSelect(role, item.index);
      return;
    }
    if (item.source === 'translated') {
      if (role === 'native' && translatedNativeSlot) {
        activeNativeSource = 'translated';
        refreshPanel('native');
        blockController?.loadBilingualCues([...blockController.getTargetCues()], translatedNativeSlot.cues);
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
    const matches = role === 'target' ? targetMatches : nativeMatches;
    if (index >= matches.length) return;
    const sub = matches[index];
    if (role === 'target') { activeTargetIndex = index; activeTargetSource = 'auto'; }
    else { activeNativeIndex = index; activeNativeSource = 'auto'; }

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
        latestTargetCues = result.cues;
        clearTranslatedNativeState();
        activeNativeSource = 'auto';
        activeNativeIndex = 0;
        refreshPanel('native');
        updateGenerateNativeEnabled();
        // updateCues(latestTargetCues, latestNativeCues);
      } else {
        blockController?.loadBilingualCues([], result.cues);
        // ADR-018: update nav cluster — keep target side, replace native
        // updateCues(latestTargetCues, latestNativeCues);
      }
      showOverlay();
      syncSidePanelFromBlock();
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
      void sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: { tabId: undefined, cues: bilingualCues },
      });
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
    console.log('[content-script] SPA nav detected, clearing overlay', {
      from: lastAutoLoadUrl,
      to: location.href,
    });
    blockController?.clearCues();
    offsetController?.loadCues(false);
    latestTargetCues = [];
    translatePrefill?.clear();
    translatePrefill = null;
    clearTranslatedNativeState();
    activeNativeSource = 'auto';
    updateGenerateNativeEnabled();
    lastAutoLoadKey = undefined;
    lastAutoLoadUrl = undefined;
  };
  window.addEventListener('yt-navigate-finish', onSpaNav);
  window.addEventListener('popstate', onSpaNav);

  // Return cleanup so the caller can tear down before re-init on SPA episode
  // switch (Angular replaces <video> → old overlay UI removed by framework
  // re-render, but document/onMessage listeners would otherwise leak).
  // ponytail: document keydown + onMessage listeners leak — ceiling: memory
  // leak after many episode switches. Upgrade path: track + remove all listeners.
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('yt-navigate-finish', onSpaNav);
    window.removeEventListener('popstate', onSpaNav);
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('__NF_SEEK', onNfSeek);
    removeOnMessageListener(onRuntimeMessage);
    removeOnMessageListener(onRuntimeMessage2);
    toggleBtn?.remove();
    managerPanel?.destroy();
    cardCreatorMount?.unmount();
    offsetController?.destroy();
    blockController?.destroy();
  };
}
