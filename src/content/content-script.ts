import { PageScanner } from './pageScanner';
import { SubtitleOverlayController } from './subtitleOverlay';
import { handleFileDrop } from './subtitleDragDrop';
import { handleFileSelect } from './subtitleImport';
import { createDragHint, showToast } from './subtitleUI';
import { parseBilingualSrt } from './subtitleBilingualParser';
import { handleAutoLoadSubtitles, clearAutoLoadCache, fetchAndParseSubtitle, formatFromUrl } from './subtitleAutoLoad';
import { mergeCuesForPanel } from './subtitleMerge';
import { createToggleButton, seekToCue } from './subtitlePanel';
import { handleShortcutKey } from './subtitleShortcuts';
import { createSubtitleDropdown } from './subtitleSelector';
import { MESSAGE_TYPES } from '@/constants/messages';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/constants/config';
import type { OverlayConfig, OverlayStyleConfig } from '../types/subtitle';
import type { BilingualCue, KeyboardShortcut, SrtCue } from '../types/media';
import type { AutoLoadSubtitlesPayload } from '../types/message';
import type { VideoEpisodeChangedPayload } from '../types/message';

// ponytail: content script không có chrome.tabs API — gửi message không tabId,
// background tự lấy từ sender.tab.id (xem messageBus.handleMessage)
// Clear auto-load cache on every (re)inject — tab navigate re-injects the
// content-script, so the per-URL cache must not survive across navigations.
clearAutoLoadCache();
const scanner = new PageScanner();

// === Main-world fetch interceptor bridge (ADR-011) ===
// The main-world fetchInterceptor.iife.ts patches `window.fetch` and posts
// detected subtitle URLs via `window.postMessage`. This isolated-world
// listener receives them and relays to the background, which adds them to
// the network interceptor's subtitle store. This catches subtitle fetches
// that page Service Workers serve from cache (webRequest does not fire for
// cached responses).
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as { type?: string; url?: string } | null;
  if (data?.type !== '__DETECTED_SUBTITLE_FETCH' || !data.url) return;
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.DETECTED_SUBTITLE_URL,
    payload: { tabId: undefined, url: data.url },
  });
});

// Scan on page load — gửi không tabId, background resolve từ sender
const urls = scanner.scan();
if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
  chrome.runtime.sendMessage({
    type: 'PAGE_SCAN_RESULT',
    payload: {
      tabId: undefined,
      videoUrls: urls.videoUrls,
      subtitleUrls: urls.subtitleUrls
    },
  });
}

// Start observing for dynamically loaded content
scanner.startObserving((newUrls) => {
  chrome.runtime.sendMessage({
    type: 'PAGE_SCAN_RESULT',
    payload: {
      tabId: undefined,
      videoUrls: newUrls.videoUrls,
      subtitleUrls: newUrls.subtitleUrls
    },
  });
});

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
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings as
      | { subtitleOverlayTargetStyle?: OverlayStyleConfig; subtitleOverlayNativeStyle?: OverlayStyleConfig }
      | undefined;
    return {
      target: settings?.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET,
      native: settings?.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE,
    };
  } catch {
    // ponytail: storage might not be available in test contexts — fallback
    return { target: DEFAULT_OVERLAY_STYLE_TARGET, native: DEFAULT_OVERLAY_STYLE_NATIVE };
  }
}

/** Load keyboard shortcuts from chrome.storage.local, fallback to defaults. */
async function loadShortcuts(): Promise<KeyboardShortcut[]> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings as { keyboardShortcuts?: KeyboardShortcut[] } | undefined;
    if (settings?.keyboardShortcuts?.length && settings.keyboardShortcuts.length > 0) {
      return settings.keyboardShortcuts;
    }
  } catch {
    // ponytail: storage might not be available in test contexts — fallback
  }
  return DEFAULT_KEYBOARD_SHORTCUTS;
}

function initSubtitleOverlay(video: HTMLVideoElement): void {
  // ADR-008 D2: overlay UI neo vào video.parentElement — không cần F0, không cần
  // videoWrapper, không cần docking. Panel đã chuyển sang Chrome Side Panel.
  const container = video.parentElement ?? document.body;

  // ADR-013 D3: load overlay styles from storage (async), then init controller
  let controller: SubtitleOverlayController | null = null;
  loadOverlayStyles().then(({ target, native }) => {
    controller = new SubtitleOverlayController(video, DEFAULT_OVERLAY_CONFIG, target, native);
    controller.init(container);

    // ADR-013 D3: listen chrome.storage.onChanged → updateStyle realtime
    chrome.storage.onChanged.addListener((changes, area) => {
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
  let targetDropdown: { icon: HTMLButtonElement; destroy: () => void } | null = null;
  let nativeDropdown: { icon: HTMLButtonElement; destroy: () => void } | null = null;
  // Track active sub indices + all matches for re-fetch on dropdown select
  let activeTargetIndex = 0;
  let activeNativeIndex = 0;
  let targetMatches: readonly import('../types/message').SubtitleForOverlayResult[] = [];
  let nativeMatches: readonly import('../types/message').SubtitleForOverlayResult[] = [];

  // Load shortcuts from storage
  loadShortcuts().then((s) => { shortcuts = s; });

  // Create toggle button (overlay) — click → open Side Panel
  toggleBtn = createToggleButton(container);

  // Wire toggle button → open Side Panel (ADR-008 D1)
  toggleBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OPEN_SIDE_PANEL,
      payload: { tabId: undefined }, // background resolves from sender.tab.id
    });
  });

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
        chrome.runtime.sendMessage({
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
    chrome.runtime.sendMessage({
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
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.VIDEO_PLAY_STATE,
      payload: { tabId: undefined, isPlaying: true },
    });
  });
  video.addEventListener('pause', () => {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.VIDEO_PLAY_STATE,
      payload: { tabId: undefined, isPlaying: false },
    });
  });

  // Receive SEEK_TO from Side Panel (via background relay) → seek video
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
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
  const importButton = document.querySelector('[data-testid="subtitle-import-button"]') as HTMLButtonElement | null;
  const fileInput = importButton?.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (importButton && fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const result = await handleFileSelect(file);
      if (result.success && result.cues.length > 0) {
        controller?.loadCues(result.cues);
        const bilingualResult = parseBilingualSrt(await file.text());
        if (bilingualResult.success) {
          bilingualCues = bilingualResult.cues;
          // Send cues to Side Panel
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
            payload: { tabId: undefined, cues: bilingualCues },
          });
        }
        showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, container);
      } else {
        showToast(`Import failed: ${result.error ?? 'unknown error'}`, container);
      }
    });
  }

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
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const result = await handleFileDrop(file);
    if (result.success && result.cues.length > 0) {
      controller?.loadCues(result.cues);
      const fileText = await file.text();
      const bilingualResult = parseBilingualSrt(fileText);
      if (bilingualResult.success) {
        bilingualCues = bilingualResult.cues;
        // Send cues to Side Panel
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
          payload: { tabId: undefined, cues: bilingualCues },
        });
      }
      showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, container);
    } else {
      showToast(`Drag-drop failed: ${result.error ?? 'unknown error'}`, container);
    }
  });

  // === Bilingual auto-load wiring (ADR-007 D1, spec F3/F4/F7) ===
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
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
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
            payload: { tabId: undefined, cues: bilingualCues },
          });
        },
        onToast: (message: string) => showToast(message, container),
        onSubtitleMatches: (targetM, nativeM) => {
          targetMatches = targetM;
          nativeMatches = nativeM;
          // Destroy old dropdowns before re-creating (fresh active index)
          targetDropdown?.destroy();
          nativeDropdown?.destroy();
          targetDropdown = null;
          nativeDropdown = null;
          if (targetM.length >= 2) {
            targetDropdown = createSubtitleDropdown(
              'target',
              container,
              targetM.map((m) => ({ id: m.url, url: m.url, format: m.format as any, language: m.language, tabId: 0, detectedAt: 0 })),
              targetM[0].language,
              activeTargetIndex,
              (index) => { void onSubtitleSelect('target', index); },
            );
          }
          if (nativeM.length >= 2) {
            nativeDropdown = createSubtitleDropdown(
              'native',
              container,
              nativeM.map((m) => ({ id: m.url, url: m.url, format: m.format as any, language: m.language, tabId: 0, detectedAt: 0 })),
              nativeM[0].language,
              activeNativeIndex,
              (index) => { void onSubtitleSelect('native', index); },
            );
          }
        },
      });
    }
    return false; // synchronous listener, no async response
  });

  // Request a re-push of AUTO_LOAD_SUBTITLES in case background pushed before
  // this content-script was ready (race: SW restart, late injection). Background
  // reads from chrome.storage.session (ADR-007 D2).
  void chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES,
    payload: { tabId: undefined }, // background resolves from sender.tab.id
  });

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
      const result = await chrome.storage.local.get('settings');
      const settings = (result.settings ?? {}) as Partial<import('../types/media').Settings>;
      const pref = { ...(settings.subtitlePreference ?? {}) };
      const sitePref = { ...(pref[origin] ?? {}) };
      sitePref[lang] = index;
      pref[origin] = sitePref;
      await chrome.storage.local.set({ settings: { ...settings, subtitlePreference: pref } });
    } catch {
      // ponytail: storage might not be available in test contexts — ignore
    }
  }
}

// Find video element and init overlay (defer until DOM ready, observe SPA late mounts)
// ADR-012: SPA frameworks (Angular on kisskh.co) render <video> in two phases —
// first mount the element with src="" (template), then assign the real source
// (blob: URL) after fetch. If the content-script init's overlay UI during phase 1,
// the framework's continued render wipes foreign (non-framework) elements appended
// to the video's parent. Waiting until the video has a real source (blob: URL OR
// readyState >= 2 HAVE_CURRENT_DATA) ensures the framework render is done, so
// appended UI persists. Covers both blob-streaming SPAs (kisskh) and direct-MP4
// sites (themoviebox.org — no framework re-render, readyState>=2 is immediate).
function isVideoReady(v: HTMLVideoElement): boolean {
  return (v.src !== '' && v.src.startsWith('blob:')) || v.readyState >= 2;
}

function findAndInitOverlay(): void {
  const video = document.querySelector('video');
  if (video && isVideoReady(video)) {
    initSubtitleOverlay(video);
    return;
  }

  // SPA: video may be rendered after DOMContentLoaded, or may exist but not yet
  // have a real source (Angular two-phase render — see isVideoReady). Observe
  // body until a ready video appears. attributeFilter:['src'] catches the
  // phase-2 src assignment (blob: URL) that childList alone would miss.
  // ponytail: disconnect as soon as a ready video is found to avoid unnecessary
  // mutation work.
  const observer = new MutationObserver(() => {
    const v = document.querySelector('video');
    if (v && isVideoReady(v)) {
      observer.disconnect();
      initSubtitleOverlay(v);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}

// === In-page episode/movie switch detection (ADR-010) ===
// SPA sites (themoviebox.org) switch episodes by REPLACING the `<video>`
// element in-page — no URL change, no pushState, no reload, so
// `chrome.tabs.onUpdated` never fires and the background's navigation clear
// never runs. Media from the previous episode then accumulates into the new
// episode's list.
//
// Detection signal: a NEW `<video>` element appearing in the DOM AFTER the
// first one has already been seen = episode switch (the element was replaced).
// Quality switches keep the SAME `<video>` element (only `src` changes,
// verified 1080p↔480p: element identity preserved), so they do NOT trigger a
// clear and the subtitle list is preserved.
//
// Triggering on element replacement (not on `loadedmetadata` duration-diff) is
// deliberate: the replacement fires BEFORE the new video's network requests,
// so the clear runs before the new episode's media is detected — no race that
// would wipe the newly detected media.
//
// This watcher is module-level and independent of `initSubtitleOverlay`
// because themoviebox replaces the entire `<video>` element on episode switch
// — listeners attached to the previous element do not fire on the new one.
//
// ponytail: element-replacement heuristic. Ceiling: (1) sites that replace the
// `<video>` element on quality switch would spuriously clear; (2) pages with
// multiple `<video>` elements (e.g. ad-supported) may clear on the second
// element's mount. Upgrade path: combine with video-URL path heuristic or an
// explicit episode-click watcher.
let hasSeenFirstVideo = false;

function reportEpisodeChangedIfReplacement(): void {
  if (hasSeenFirstVideo) {
    // A previous <video> was already seen → this new one is a replacement
    // (episode switch). Tell the background to clear the previous episode's
    // media before the new episode's media is detected.
    const payload: VideoEpisodeChangedPayload = {
      tabId: undefined, // background resolves from sender.tab.id
    };
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.VIDEO_EPISODE_CHANGED,
      payload,
    });
  }
  hasSeenFirstVideo = true;
}

function initEpisodeChangeWatcher(): void {
  // If a <video> is already present at inject time, that's the first one —
  // baseline it without firing an episode-changed event.
  if (document.querySelector('video')) {
    hasSeenFirstVideo = true;
  }
  // Persistently observe for new <video> elements. A NEW element appearing
  // after the first one was seen = episode switch (element replacement).
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeName === 'VIDEO') {
          reportEpisodeChangedIfReplacement();
        } else if (node instanceof Element && node.querySelector('video')) {
          reportEpisodeChangedIfReplacement();
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEpisodeChangeWatcher);
} else {
  initEpisodeChangeWatcher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndInitOverlay);
} else {
  findAndInitOverlay();
}
