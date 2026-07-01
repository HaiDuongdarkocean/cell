import { sendMessage, onMessage, onStorageChanged } from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { injectThemeTokens } from '@/shared/lib/themeTokens';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
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
  createSubtitleDropdown,
  createSubtitleManagerPanel,
  createDebouncedToast,
  formatSubtitleName,
} from '@/features/subtitle';
import type { OverlayConfig, OverlayStyleConfig } from '@/entities/subtitle';
import type { BilingualCue, KeyboardShortcut, SrtCue, DetectedSubtitle } from '@/entities/media';
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

export function init(video: HTMLVideoElement): void {
  // ADR-008 D2: overlay UI neo vào video.parentElement — không cần F0, không cần
  // videoWrapper, không cần docking. Panel đã chuyển sang Chrome Side Panel.
  const container = video.parentElement ?? document.body;

  // ADR-015 T12: inject theme tokens so panel/toast var(--color-*) resolve.
  // Content-script isolated world cannot access popup's theme.css.
  injectThemeTokens(container);

  // ADR-013 D3: load overlay styles from storage (async), then init controller
  let controller: SubtitleOverlayController | null = null;
  loadOverlayStyles().then(({ target, native }) => {
    controller = new SubtitleOverlayController(video, DEFAULT_OVERLAY_CONFIG, target, native);
    controller.init(container);

    // ADR-015 UI v4: create manager panel after controller init so we can reuse
    // the import button created by the controller (single toolbar, no duplicate buttons).
    managerPanel = createSubtitleManagerPanel(container, controller.importButton!, {
      onSelect: (role, index) => { void onPanelSelect(role, index); },
    });

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

    // ADR-013 D3: listen chrome.storage.onChanged → updateStyle realtime
    onStorageChanged((changes, area) => {
      if (area !== 'local' || !controller) return;
      const newSettings = changes.settings?.newValue as
        | { subtitleOverlayTargetStyle?: OverlayStyleConfig; subtitleOverlayNativeStyle?: OverlayStyleConfig }
        | undefined;
      if (!newSettings) return;
      controller.updateStyle(
        newSettings.subtitleOverlayTargetStyle,
        newSettings.subtitleOverlayNativeStyle,
      );
    });
  });

  // === State ===
  let toggleBtn: HTMLButtonElement | null = null;
  let overlayVisible = false; // ponytail: match overlay initial display:none
  let bilingualCues: BilingualCue[] = [];
  let shortcuts: KeyboardShortcut[] = DEFAULT_KEYBOARD_SHORTCUTS;
  // ADR-014 D3: dropdown instances for subtitle selector (target + native)
  // ADR-015 T4: added update() for in-place refresh (bug #5 fix)
  let targetDropdown: { icon: HTMLButtonElement; destroy: () => void; update: (s: DetectedSubtitle[], i: number) => void } | null = null;
  let nativeDropdown: { icon: HTMLButtonElement; destroy: () => void; update: (s: DetectedSubtitle[], i: number) => void } | null = null;
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
  // ADR-015 T10: parsed files side-map (panel items don't carry cues)
  let importedParsedTarget: ParsedFile[] = [];
  let importedParsedNative: ParsedFile[] = [];
  // ADR-015 T7: debounced toast (collapses rapid import/switch messages)
  const debouncedToast = createDebouncedToast(showToast, 500);

  // Load shortcuts from storage
  loadShortcuts().then((s) => { shortcuts = s; });

  // Create toggle button (overlay) — click → open Side Panel
  toggleBtn = createToggleButton(container);

  // Wire toggle button → open Side Panel (ADR-008 D1)
  toggleBtn.addEventListener('click', () => {
    void sendMessage({
      type: MESSAGE_TYPES.OPEN_SIDE_PANEL,
      payload: { tabId: undefined }, // background resolves from sender.tab.id
    });
  });

  // Manager panel is created asynchronously inside loadOverlayStyles().then()
  // so it can reuse the import button created by SubtitleOverlayController.

  // Wire keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const action = handleShortcutKey(e.key.toLowerCase(), shortcuts, e.target);
    if (!action) return;
    e.preventDefault();

    switch (action) {
      case 'prev-cue': {
        const currentMs = video.currentTime * 1000;
        const prevCue = [...bilingualCues].reverse().find((c) => c.end < currentMs);
        if (prevCue) seekToCue(video, prevCue);
        break;
      }
      case 'next-cue': {
        const currentMs = video.currentTime * 1000;
        const nextCue = bilingualCues.find((c) => c.start > currentMs + 100);
        if (nextCue) seekToCue(video, nextCue);
        break;
      }
      case 'replay-cue': {
        const currentMs = video.currentTime * 1000;
        // Half-open [start, end) — at boundary t = cue[i].end = cue[i+1].start,
        // match the NEXT cue, not the previous one (replay-cue "jump back" bug).
        const currentCue = bilingualCues.find((c) => c.start <= currentMs && c.end > currentMs)
          ?? [...bilingualCues].reverse().find((c) => c.start < currentMs);
        if (currentCue) seekToCue(video, currentCue);
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
        video.currentTime = timeMs / 1000;
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
      const currentMs = video.currentTime * 1000;
      switch (action) {
        case 'prev-cue': {
          const prevCue = [...bilingualCues].reverse().find((c) => c.end < currentMs);
          if (prevCue) seekToCue(video, prevCue);
          break;
        }
        case 'next-cue': {
          const nextCue = bilingualCues.find((c) => c.start > currentMs + 100);
          if (nextCue) seekToCue(video, nextCue);
          break;
        }
        case 'replay-cue': {
          // Half-open [start, end) — see in-page keydown handler above.
          const currentCue = bilingualCues.find((c) => c.start <= currentMs && c.end > currentMs)
            ?? [...bilingualCues].reverse().find((c) => c.start < currentMs);
          if (currentCue) seekToCue(video, currentCue);
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
      });
      void handleAutoLoadSubtitles(payload, {
        controller: {
          loadBilingualCues: (t: SrtCue[], n: SrtCue[]) => controller?.loadBilingualCues(t, n),
          loadCues: (c: SrtCue[]) => controller?.loadCues(c),
          clearCues: () => controller?.clearCues(),
        },
        tabUrl: window.location.href,
        onPanelRender: (targetCues: SrtCue[], nativeCues: SrtCue[]) => {
          bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
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
        onToast: (message: string) => showToast(message, container),
        onSubtitleMatches: (targetM, nativeM) => {
          targetMatches = targetM;
          nativeMatches = nativeM;
          // ADR-015 T4: update-in-place (bug #5 fix — no flicker, no stale index)
          // V1 destroyed + re-created dropdown on every push → flicker + stale
          // index when matches reordered. V2 calls update() to refresh list
          // items in-place, preserving icon element identity + activeIndex.
          const targetSubs = targetM.map((m) => ({ id: m.url, url: m.url, format: m.format as any, language: m.language, tabId: 0, detectedAt: 0 }));
          const nativeSubs = nativeM.map((m) => ({ id: m.url, url: m.url, format: m.format as any, language: m.language, tabId: 0, detectedAt: 0 }));

          // ADR-015: legacy dropdown only renders when 2+ matches (select-between UX).
          // The new manager panel (below) renders when 1+ match so user always sees
          // active subtitle state.
          if (targetM.length >= 2) {
            if (targetDropdown) {
              targetDropdown.update(targetSubs, activeTargetIndex);
            } else {
              targetDropdown = createSubtitleDropdown(
                'target',
                container,
                targetSubs,
                targetM[0].language,
                activeTargetIndex,
                (index) => { void onSubtitleSelect('target', index); },
              );
            }
          }
          if (nativeM.length >= 2) {
            if (nativeDropdown) {
              nativeDropdown.update(nativeSubs, activeNativeIndex);
            } else {
              nativeDropdown = createSubtitleDropdown(
                'native',
                container,
                nativeSubs,
                nativeM[0].language,
                activeNativeIndex,
                (index) => { void onSubtitleSelect('native', index); },
              );
            }
          }
          // ADR-015: update manager panel with auto-detected matches (1+ subs).
          // Build panel items from matches so panel shows even with 1 sub.
          const autoTargetItems: SubtitlePanelItem[] = targetM.map((m, i) => ({
            id: `auto-target-${i}`,
            name: formatSubtitleName('auto', m.language, i),
            format: m.format,
            source: 'auto' as const,
            role: 'target' as const,
            index: i,
          }));
          const autoNativeItems: SubtitlePanelItem[] = nativeM.map((m, i) => ({
            id: `auto-native-${i}`,
            name: formatSubtitleName('auto', m.language, i),
            format: m.format,
            source: 'auto' as const,
            role: 'native' as const,
            index: i,
          }));
          // Prefer imported items if exist (import flow updates separately),
          // else fall back to auto-detected items.
          if (importedTargetItems.length === 0) {
            managerPanel?.updateTarget(autoTargetItems, activeTargetIndex);
          }
          if (importedNativeItems.length === 0) {
            managerPanel?.updateNative(autoNativeItems, activeNativeIndex);
          }
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
      debouncedToast('Import failed: no valid subtitle files', _container);
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
    managerPanel?.updateTarget(importedTargetItems, activeImportTargetIndex);
    managerPanel?.updateNative(importedNativeItems, activeImportNativeIndex);

    // Load cues: first target + first native (D1 merge keeps other side)
    const targetCues = assignment.target[0]?.cues ?? [];
    const nativeCues = assignment.native[0]?.cues ?? [];
    if (targetCues.length > 0 || nativeCues.length > 0) {
      controller?.loadBilingualCues(targetCues, nativeCues);
      // ADR-015 T10: merge for Side Panel + keyboard shortcuts
      bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
      void sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: { tabId: undefined, cues: bilingualCues },
      });
    } else if (assignment.target.length === 0 && assignment.native.length === 0) {
      controller?.loadCues(parsed[0].cues); // fallback: single mode
    }

    // Active subtitle names are visible in the manager panel; chip removed.
    // Toast
    const total = assignment.target.length + assignment.native.length;
    const ignoredCount = assignment.ignored.length;
    if (total === 1) {
      debouncedToast(`✓ Imported ${parsed[0].file.name}`, _container);
    } else {
      const parts: string[] = [];
      if (assignment.target.length > 0) parts.push(`Target:${assignment.target.length}`);
      if (assignment.native.length > 0) parts.push(`Native:${assignment.native.length}`);
      const ignoredTxt = ignoredCount > 0 ? ` (${ignoredCount} ignored)` : '';
      debouncedToast(`✓ Imported ${total} files → ${parts.join(' + ')}${ignoredTxt}`, _container);
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
    if (role === 'target') activeImportTargetIndex = index;
    else activeImportNativeIndex = index;

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
    debouncedToast(`Switched to ${parsed.file.name}`, container);
  }

  // ADR-015 T10: side maps moved to state block above (importedParsedTarget/Native)

  /**
   * ADR-014 D4: user selected a different subtitle via dropdown.
   * Re-fetch (cache hit instant) + loadBilingualCues (D1 merge keeps other side)
   * + save preference to chrome.storage.local (origin → lang → index).
   */
  async function onSubtitleSelect(role: 'target' | 'native', index: number): Promise<void> {
    const matches = role === 'target' ? targetMatches : nativeMatches;
    if (index >= matches.length) return;
    const sub = matches[index];
    if (role === 'target') activeTargetIndex = index;
    else activeNativeIndex = index;

    try {
      const result = await fetchAndParseSubtitle(sub.url, formatFromUrl(sub.url), window.location.href);
      if (!result.success || result.cues.length === 0) {
        showToast(`Failed to load sub #${index + 1}: ${result.error ?? 'empty'}`, container);
        return;
      }
      // D1 merge: loadBilingualCues keeps other side when this side is empty.
      // We only update the selected side by passing its cues + empty other side.
      if (role === 'target') {
        controller?.loadBilingualCues(result.cues, []);
      } else {
        controller?.loadBilingualCues([], result.cues);
      }
      showToast(`Switched to sub #${index + 1}`, container);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Switch failed: ${msg}`, container);
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
}
