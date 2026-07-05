import { sendMessage, onMessage, onStorageChanged } from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { injectThemeTokens } from '@/shared/lib/themeTokens';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';
import {
  SubtitleOverlayController,
  parseAndDetectFiles,
  assignImportRole,
  createDragHint,
  showToast,
  handleAutoLoadSubtitles,
  fetchAndParseSubtitle,
  formatFromUrl,
  mergeCuesForPanel,
  createToggleButton,
  seekToCue,
  handleShortcutKey,
  isEditableTarget,
  createSubtitleManagerPanel,
  createDebouncedToast,
  formatSubtitleName,
} from '@/features/subtitle';
import { NavClusterController } from '@/features/subtitle/ui/navClusterController';
import { OffsetController } from '@/features/subtitle/ui/offsetController';
import type { OverlayConfig, OverlayStyleConfig } from '@/entities/subtitle';
import type { BilingualCue, KeyboardShortcut, SrtCue, NavClusterSettings, Settings } from '@/entities/media';
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

/** Load overlay style settings from chrome.storage.local, fallback to defaults. ADR-013 D3. */
async function loadOverlayStyles(): Promise<{ target: OverlayStyleConfig; native: OverlayStyleConfig }> {
  try {
    const settings = await loadSettings();
    return {
      target: settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET,
      native: settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE,
    };
  } catch {
    // ponytail: storage might not be available in test contexts — fallback
    return { target: DEFAULT_OVERLAY_STYLE_TARGET, native: DEFAULT_OVERLAY_STYLE_NATIVE };
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

export function init(video: HTMLVideoElement): () => void {
  // ADR-008 D2: overlay UI neo vào video container — không cần F0, không cần
  // videoWrapper, không cần docking. Panel đã chuyển sang Chrome Side Panel.
  // G8: walk-up để xử lý sites có video.parentElement height=0 (YouTube pattern).
  const container = findVideoContainer(video);

  // ADR-015 T12: inject theme tokens so panel/toast var(--color-*) resolve.
  // Content-script isolated world cannot access popup's theme.css.
  injectThemeTokens(container);

  // ADR-013 D3: load overlay styles from storage (async), then init controller
  let controller: SubtitleOverlayController | null = null;
  // ADR-018: nav cluster controller (subtitle navigation control cluster)
  let navCluster: NavClusterController | null = null;
  // ADR-019: offset controller (subtitle time offset)
  let offsetController: OffsetController | null = null;
  // ADR-018: track latest target/native cues for nav cluster cue source
  let latestTargetCues: SrtCue[] = [];
  let latestNativeCues: SrtCue[] = [];
  // Track the URL the overlay currently shows cues for. On SPA navigation the
  // URL changes but `loadBilingualCues` uses ADR-014 D1 merge semantics (keep
  // old side when new side empty — designed for same-video incremental re-push).
  // Without a clear on URL change, a partial load on the new video (target
  // only, no native or vice versa) leaves the previous video's cues visible.
  let lastAutoLoadUrl: string | undefined;

  loadOverlayStyles().then(async ({ target, native }) => {
    controller = new SubtitleOverlayController(video, DEFAULT_OVERLAY_CONFIG, target, native);
    controller.init(container);

    // ADR-018: init nav cluster — load settings first, then instantiate.
    // Cluster renders immediately (4-nút no-sub state) without waiting for subtitles.
    let navClusterSettings: NavClusterSettings = {
      enabled: DEFAULT_NAV_CLUSTER_SETTINGS.enabled,
      position: DEFAULT_NAV_CLUSTER_SETTINGS.position,
      buttonSize: DEFAULT_NAV_CLUSTER_SETTINGS.buttonSize,
      bgOpacity: DEFAULT_NAV_CLUSTER_SETTINGS.bgOpacity,
      buttonOpacity: DEFAULT_NAV_CLUSTER_SETTINGS.buttonOpacity,
      collapsed: DEFAULT_NAV_CLUSTER_SETTINGS.collapsed,
    };
    try {
      const settings = await loadSettings();
      navClusterSettings = {
        enabled: settings.navClusterEnabled,
        position: settings.navClusterPosition,
        buttonSize: settings.navClusterButtonSize,
        bgOpacity: settings.navClusterBgOpacity,
        buttonOpacity: settings.navClusterButtonOpacity,
        collapsed: settings.navClusterCollapsed,
      };
    } catch {
      // ponytail: storage might not be available in test contexts — fallback to defaults
    }
    navCluster = new NavClusterController(
      video,
      container,
      navClusterSettings,
      { targetCues: latestTargetCues, nativeCues: latestNativeCues },
      // ADR-018 D2: map NavClusterSettings slice → flat settings keys for saveSettings
      (partial) => {
        const flat: Record<string, unknown> = {};
        if (partial.enabled !== undefined) flat.navClusterEnabled = partial.enabled;
        if (partial.position !== undefined) flat.navClusterPosition = partial.position;
        if (partial.buttonSize !== undefined) flat.navClusterButtonSize = partial.buttonSize;
        if (partial.bgOpacity !== undefined) flat.navClusterBgOpacity = partial.bgOpacity;
        if (partial.buttonOpacity !== undefined) flat.navClusterButtonOpacity = partial.buttonOpacity;
        if (partial.collapsed !== undefined) flat.navClusterCollapsed = partial.collapsed;
        void saveSettings(flat as Partial<Settings>);
      },
    );
    navCluster.init();

    // ADR-015 UI v4: create manager panel after controller init so we can reuse
    // the import button created by the controller (single toolbar, no duplicate buttons).
    // Legacy target/native dropdowns are removed; the manager panel handles selection
    // for both auto-detected and imported subtitles via a unified onSelect handler.
    managerPanel = createSubtitleManagerPanel(container, controller.importButton!, {
      onSelect: (role, index) => { void onManagerSelect(role, index); },
    });

    // ADR-019: init offset controller — offset section nested trong manager panel.
    // Load settings snapshot (for persisted offset per-URL).
    // Wire offset provider vào SubtitleOverlayController (lazy read).
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
    // Wire offset provider vào overlay (so findCurrentLine nhận offsetMs)
    controller.setOffsetProvider(() => offsetController?.getOffsetMs() ?? 0);
    // ADR-019 sync: wire same provider vào navCluster so prev/next/repeat
    // jump to the same cue the overlay is showing (was offset=0 → wrong cue).
    if (navCluster) {
      navCluster.setOffsetProvider(() => offsetController?.getOffsetMs() ?? 0);
    }

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

    // ADR-013 D3 + ADR-018: listen chrome.storage.onChanged → updateStyle + navCluster realtime
    onStorageChanged((changes, area) => {
      if (area !== 'local' || !controller) return;
      const newSettings = changes.settings?.newValue as
        | {
            subtitleOverlayTargetStyle?: OverlayStyleConfig;
            subtitleOverlayNativeStyle?: OverlayStyleConfig;
            navClusterEnabled?: boolean;
            navClusterPosition?: { x: number; y: number };
            navClusterButtonSize?: number;
            navClusterBgOpacity?: number;
            navClusterButtonOpacity?: number;
            navClusterCollapsed?: boolean;
          }
        | undefined;
      if (!newSettings) return;
      controller.updateStyle(
        newSettings.subtitleOverlayTargetStyle,
        newSettings.subtitleOverlayNativeStyle,
      );
      // ADR-018: update nav cluster settings realtime
      if (navCluster) {
        const partial: {
          enabled?: boolean;
          position?: { x: number; y: number };
          buttonSize?: NavClusterSettings['buttonSize'];
          bgOpacity?: number;
          buttonOpacity?: number;
          collapsed?: boolean;
        } = {};
        if (newSettings.navClusterEnabled !== undefined) partial.enabled = newSettings.navClusterEnabled;
        if (newSettings.navClusterPosition !== undefined) partial.position = newSettings.navClusterPosition;
        if (newSettings.navClusterButtonSize !== undefined) partial.buttonSize = newSettings.navClusterButtonSize as NavClusterSettings['buttonSize'];
        if (newSettings.navClusterBgOpacity !== undefined) partial.bgOpacity = newSettings.navClusterBgOpacity;
        if (newSettings.navClusterButtonOpacity !== undefined) partial.buttonOpacity = newSettings.navClusterButtonOpacity;
        if (newSettings.navClusterCollapsed !== undefined) partial.collapsed = newSettings.navClusterCollapsed;
        if (Object.keys(partial).length > 0) navCluster.updateSettings(partial);
      }
    });
  });

  // === State ===
  let toggleBtn: HTMLButtonElement | null = null;
  let overlayVisible = false; // ponytail: match overlay initial display:none
  let bilingualCues: BilingualCue[] = [];
  // Track side panel open state for toggle (☰ button).
  // ponytail ceiling: best-effort — if user closes panel via browser UI (X),
  // this stays true and next click sends CLOSE (no-op, panel already closed),
  // then the following click sends OPEN. Upgrade: sidepanel notify background
  // on close via chrome.runtime.connect port disconnect → background tracks
  // state → content-script queries before toggle.
  let sidePanelOpen = false;
  let shortcuts: KeyboardShortcut[] = DEFAULT_KEYBOARD_SHORTCUTS;

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
  let activeNativeSource: 'auto' | 'imported' = 'auto';

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
    if (source === 'imported' && importedItems.length > 0) {
      return { items: [...autoItems, ...importedItems], activeIndex: autoItems.length + importActive };
    }
    return { items: [...autoItems, ...importedItems], activeIndex: autoActive };
  };

  const refreshPanel = (role: 'target' | 'native'): void => {
    const { items, activeIndex } = mergedPanelItems(role);
    if (role === 'target') managerPanel?.updateTarget(items, activeIndex);
    else managerPanel?.updateNative(items, activeIndex);
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

  // Wire toggle button → toggle Side Panel open/close (ADR-008 D1).
  // sidePanelOpen tracks best-effort state (see ceiling note above).
  toggleBtn.addEventListener('click', () => {
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
  });

  // Manager panel is created asynchronously inside loadOverlayStyles().then()
  // so it can reuse the import button created by SubtitleOverlayController.

  // Wire keyboard shortcuts
  document.addEventListener('keydown', (e) => {
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

    const action = handleShortcutKey(e.key.toLowerCase(), shortcuts, e.target);
    if (!action) return;
    e.preventDefault();

    switch (action) {
      case 'prev-cue': {
        // ADR-019 sync: find cue via effective time, seek so overlay DISPLAYS it.
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = video.currentTime * 1000 + offsetMs;
        const prevCue = [...bilingualCues].reverse().find((c) => c.end < effectiveMs);
        if (prevCue) seekToCue(video, prevCue, offsetMs);
        break;
      }
      case 'next-cue': {
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = video.currentTime * 1000 + offsetMs;
        const nextCue = bilingualCues.find((c) => c.start > effectiveMs + 100);
        if (nextCue) seekToCue(video, nextCue, offsetMs);
        break;
      }
      case 'replay-cue': {
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = video.currentTime * 1000 + offsetMs;
        // Half-open [start, end) — at boundary t = cue[i].end = cue[i+1].start,
        // match the NEXT cue, not the previous one (replay-cue "jump back" bug).
        const currentCue = bilingualCues.find((c) => c.start <= effectiveMs && c.end > effectiveMs)
          ?? [...bilingualCues].reverse().find((c) => c.start < effectiveMs);
        if (currentCue) seekToCue(video, currentCue, offsetMs);
        break;
      }
      case 'toggle-overlay': {
        overlayVisible = !overlayVisible;
        // ADR-013: toggle both target + native overlay (2 div độc lập)
        const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLElement | null;
        const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLElement | null;
        if (targetOverlay) {
          targetOverlay.style.display = overlayVisible ? 'block' : 'none';
        }
        if (nativeOverlay) {
          nativeOverlay.style.display = overlayVisible ? 'block' : 'none';
        }
        break;
      }
      case 'toggle-panel': {
        // ADR-008 D1: toggle-panel now opens the Side Panel instead of
        // show/hide inject-DOM panel.
        void sendMessage({
          type: MESSAGE_TYPES.OPEN_SIDE_PANEL,
          payload: { tabId: undefined },
        });
        break;
      }
    }
  });

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
  // msg typed as any to match chrome.runtime.onMessage.addListener's signature
  // (adapter tightens to unknown, but callers need property access)
  onMessage((msg: any, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
    if (msg?.type === MESSAGE_TYPES.SEEK_TO) {
      const timeMs = (msg.payload as { timeMs: number })?.timeMs;
      if (timeMs !== undefined) {
        // ADR-019 sync: side panel clicks cue.start (raw) → seek so overlay
        // DISPLAYS that cue → shift by -offsetMs (mirror seekToCue logic).
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        video.currentTime = (timeMs - offsetMs) / 1000;
      }
    }
    // Receive TOGGLE_PLAY from Side Panel (via background relay) → toggle play/pause
    if (msg?.type === MESSAGE_TYPES.TOGGLE_PLAY) {
      if (video.paused) {
        video.play().catch(() => { /* autoplay may be blocked */ });
      } else {
        video.pause();
      }
    }
    // Receive SHORTCUT_ACTION from Side Panel (via background relay) →
    // cue navigation. Reuses the same logic as the in-page keydown handler.
    if (msg?.type === MESSAGE_TYPES.SHORTCUT_ACTION) {
      const action = (msg.payload as { action: string })?.action;
      // ADR-019 sync: find cue via effective time, seek so overlay DISPLAYS it.
      const offsetMs = offsetController?.getOffsetMs() ?? 0;
      const effectiveMs = video.currentTime * 1000 + offsetMs;
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
          const overlay = document.querySelector('[data-testid="subtitle-overlay"]') as HTMLElement | null;
          if (overlay) {
            overlay.style.display = overlayVisible ? 'block' : 'none';
          }
          break;
        }
      }
    }
    return false; // synchronous listener
  });

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
  // msg typed as any to match chrome.runtime.onMessage.addListener's signature
  // (adapter tightens to unknown, but callers need property access)
  onMessage((msg: any, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
    if (msg?.type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES) {
      const payload = msg.payload as AutoLoadSubtitlesPayload;
      console.log('[content-script] AUTO_LOAD_SUBTITLES received', {
        targetUrl: payload?.target?.url,
        nativeUrl: payload?.native?.url,
        targetLang: payload?.target?.language,
        nativeLang: payload?.native?.language,
        targetMatchesCount: payload?.targetMatches?.length,
        nativeMatchesCount: payload?.nativeMatches?.length,
      });
      // SPA navigation: URL changed → clear the previous video's cues before
      // loading the new one. `loadBilingualCues` uses ADR-014 D1 merge semantics
      // (keep old side when new side empty — for same-video incremental re-push),
      // so without this clear a partial load on the new video (target only, no
      // native or vice versa) leaves the previous video's cues visible. Covers
      // all cases: 0 tracks, partial, full — any URL change clears both sides.
      const currentUrl = location.href;
      if (lastAutoLoadUrl !== undefined && lastAutoLoadUrl !== currentUrl) {
        controller?.clearCues();
        offsetController?.loadCues(false);
        navCluster?.updateCues([], []);
        latestTargetCues = [];
        latestNativeCues = [];
      }
      lastAutoLoadUrl = currentUrl;
      if (!payload?.target && !payload?.native) {
        // New video has no subtitles (SPA nav from a video WITH subtitles to
        // one WITHOUT). Clear the previous video's overlay + nav cluster so
        // stale cues do not persist into the new video.
        controller?.clearCues();
        offsetController?.loadCues(false);
        navCluster?.updateCues([], []);
        showToast('No subtitles detected', container, { variant: 'warning' });
      }
      void handleAutoLoadSubtitles(payload, {
        controller: {
          loadBilingualCues: (t: SrtCue[], n: SrtCue[]) => controller?.loadBilingualCues(t, n),
          loadCues: (c: SrtCue[]) => controller?.loadCues(c),
          clearCues: () => {
            controller?.clearCues();
            // ADR-019: subtitles cleared → reset offset + cancel lazy
            offsetController?.loadCues(false);
          },
        },
        tabUrl: window.location.href,
        onPanelRender: (targetCues: SrtCue[], nativeCues: SrtCue[]) => {
          bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
          // ADR-018: keep nav cluster cue source in sync with auto-loaded subtitles
          // (4↔6 nút transition when subtitles become available).
          latestTargetCues = targetCues;
          latestNativeCues = nativeCues;
          navCluster?.updateCues(targetCues, nativeCues);
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
    }
    return false; // synchronous listener, no async response
  });

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
    refreshPanel('target');
    refreshPanel('native');

    // Load cues: first target + first native (D1 merge keeps other side)
    const targetCues = assignment.target[0]?.cues ?? [];
    const nativeCues = assignment.native[0]?.cues ?? [];
    if (targetCues.length > 0 || nativeCues.length > 0) {
      controller?.loadBilingualCues(targetCues, nativeCues);
      // ADR-018: update nav cluster cue source (4↔6 nút transition)
      latestTargetCues = targetCues;
      latestNativeCues = nativeCues;
      navCluster?.updateCues(targetCues, nativeCues);
      // ADR-019: load sub mới → reset offset + cancel lazy (R5)
      offsetController?.loadCues(true);
      // ADR-015 T10: merge for Side Panel + keyboard shortcuts
      bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
      void sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: { tabId: undefined, cues: bilingualCues },
      });
    } else if (assignment.target.length === 0 && assignment.native.length === 0) {
      controller?.loadCues(parsed[0].cues); // fallback: single mode
      // ADR-018: update nav cluster with single-mode cues
      latestTargetCues = parsed[0].cues;
      latestNativeCues = [];
      navCluster?.updateCues(parsed[0].cues, []);
      // ADR-019: load sub mới → reset offset + cancel lazy (R5)
      offsetController?.loadCues(true);
    }

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
      controller?.loadBilingualCues(parsed.cues, []);
    } else {
      controller?.loadBilingualCues([], parsed.cues);
    }
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
    } else {
      await onSubtitleSelect(role, item.index);
    }
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
      const result = await fetchAndParseSubtitle(sub.url, formatFromUrl(sub.url), window.location.href);
      if (!result.success || result.cues.length === 0) {
        console.error('[onSubtitleSelect] failed', result.error);
        showToast(`Could not load subtitle track ${index + 1}`, container, { variant: 'error' });
        return;
      }
      // D1 merge: loadBilingualCues keeps other side when this side is empty.
      // We only update the selected side by passing its cues + empty other side.
      if (role === 'target') {
        controller?.loadBilingualCues(result.cues, []);
        // ADR-018: update nav cluster — keep native side, replace target
        latestTargetCues = result.cues;
        navCluster?.updateCues(latestTargetCues, latestNativeCues);
      } else {
        controller?.loadBilingualCues([], result.cues);
        // ADR-018: update nav cluster — keep target side, replace native
        latestNativeCues = result.cues;
        navCluster?.updateCues(latestTargetCues, latestNativeCues);
      }
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
    if (document.visibilityState !== 'visible') return;
    if (bilingualCues.length === 0) return;
    void sendMessage({
      type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
      payload: { tabId: undefined, cues: bilingualCues },
    });
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Return cleanup so the caller can tear down before re-init on SPA episode
  // switch (Angular replaces <video> → old overlay UI removed by framework
  // re-render, but document/onMessage listeners would otherwise leak).
  // ponytail: document keydown + onMessage listeners leak — ceiling: memory
  // leak after many episode switches. Upgrade path: track + remove all listeners.
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    toggleBtn?.remove();
    managerPanel?.destroy();
    navCluster?.destroy();
    offsetController?.destroy();
    controller?.destroy();
  };
}
