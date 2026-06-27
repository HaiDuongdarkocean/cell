import { PageScanner } from './pageScanner';
import { SubtitleOverlayController } from './subtitleOverlay';
import { handleFileDrop } from './subtitleDragDrop';
import { handleFileSelect } from './subtitleImport';
import { createDragHint, showToast } from './subtitleUI';
import { parseBilingualSrt } from './subtitleBilingualParser';
import { handleAutoLoadSubtitles, clearAutoLoadCache } from './subtitleAutoLoad';
import { mergeCuesForPanel } from './subtitleMerge';
import {
  createPanel,
  renderCueListLazy,
  createToggleButton,
  switchPanelPosition,
  highlightCue,
  scrollToCue,
  seekToCue,
} from './subtitlePanel';
import {
  setupDocking,
  showPanelDocked,
  hidePanelDocked,
  movePanelToOuterWrapper,
  setupFullscreenHandlers,
} from './subtitleDocking';
import { handleShortcutKey } from './subtitleShortcuts';
import { MESSAGE_TYPES } from '@/constants/messages';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/constants/config';
import type { OverlayConfig } from '../types/subtitle';
import type { BilingualCue, KeyboardShortcut, SrtCue } from '../types/media';
import type { AutoLoadSubtitlesPayload } from '../types/message';

// ponytail: content script không có chrome.tabs API — gửi message không tabId,
// background tự lấy từ sender.tab.id (xem messageBus.handleMessage)
// Clear auto-load cache on every (re)inject — tab navigate re-injects the
// content-script, so the per-URL cache must not survive across navigations.
clearAutoLoadCache();
const scanner = new PageScanner();

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
  // Simplified docking: find F0 (layout box) and playerContainer (child of F0
  // that holds the video). The video is NOT moved — we only insert the panel
  // as a sibling of playerContainer inside F0, and shrink playerContainer when
  // the panel opens. This preserves the site's player DOM hierarchy (controls
  // stay above the video via their own z-index).
  const { f0, playerContainer } = setupDocking(video);

  const controller = new SubtitleOverlayController(video, DEFAULT_OVERLAY_CONFIG);
  controller.init();

  // === Panel + Shortcuts state ===
  let panel: HTMLDivElement | null = null;
  let toggleBtn: HTMLButtonElement | null = null;
  let panelVisible = false;
  let overlayVisible = false; // ponytail: match overlay initial display:none
  let bilingualCues: BilingualCue[] = [];
  let shortcuts: KeyboardShortcut[] = DEFAULT_KEYBOARD_SHORTCUTS;
  let panelSide: 'left' | 'right' = 'right';

  // Load shortcuts from storage
  loadShortcuts().then((s) => { shortcuts = s; });

  // Create panel + toggle button (hidden initially)
  panel = createPanel(video);
  toggleBtn = createToggleButton(video);

  // Move panel into F0 so it becomes a sibling of playerContainer.
  // Required for flex layout to place the panel beside the video.
  if (panel) {
    movePanelToOuterWrapper(panel, f0);
  }

  // Saved panel state used when the panel is toggled while the player is in
  // fullscreen. The overlay approach needs to remember the original parent and
  // styles so it can restore them on exit.
  let savedPanelStyles: { parent: HTMLElement | null; cssText: string } | null = null;

  // Wire toggle button → show/hide panel (docked layout shrinks video when open)
  toggleBtn.addEventListener('click', () => {
    panelVisible = !panelVisible;
    if (panel && toggleBtn) {
      if (panelVisible) {
        savedPanelStyles = showPanelDocked(f0, playerContainer, panel, savedPanelStyles) ?? savedPanelStyles;
      } else {
        hidePanelDocked(f0, playerContainer, panel, savedPanelStyles);
      }
    }
  });

  // Handle fullscreen change: overlay panel on top of the fullscreen video so
  // the native player's fullscreen button keeps the panel visible.
  if (panel) {
    setupFullscreenHandlers(f0, playerContainer, panel, () => panelVisible);
  }

  // Wire close button in panel header → hide panel
  const closeBtn = panel.querySelector('[data-testid="panel-close"]');
  closeBtn?.addEventListener('click', () => {
    panelVisible = false;
    if (panel && toggleBtn) {
      hidePanelDocked(f0, playerContainer, panel, savedPanelStyles);
    }
  });

  // Wire drag handle → switch position left/right on double-click
  const dragHandle = panel.querySelector('[data-testid="panel-drag-handle"]');
  dragHandle?.addEventListener('dblclick', () => {
    panelSide = panelSide === 'right' ? 'left' : 'right';
    if (panel) switchPanelPosition(panel, panelSide);
  });

  // Wire timestamp clicks → seek to cue
  panel.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute('data-testid') === 'cue-timestamp') {
      const cueIndex = parseInt(target.getAttribute('data-cue-index') ?? '0', 10);
      const cue = bilingualCues.find((c) => c.index === cueIndex);
      if (cue) {
        seekToCue(video, cue);
        if (panel) {
          highlightCue(panel, cueIndex);
          scrollToCue(panel, cueIndex);
        }
      }
    }
  });

  // Wire keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const action = handleShortcutKey(e.key.toLowerCase(), shortcuts, e.target);
    if (!action) return;
    e.preventDefault();

    switch (action) {
      case 'prev-cue': {
        const currentMs = video.currentTime * 1000;
        // Find the last cue whose end is before current time — this skips the
        // currently-playing cue and lands on the previous one. Using `end`
        // instead of `start` avoids matching the current cue when seeking back.
        const prevCue = [...bilingualCues].reverse().find((c) => c.end < currentMs);
        if (prevCue) {
          seekToCue(video, prevCue);
          if (panel) { highlightCue(panel, prevCue.index); scrollToCue(panel, prevCue.index); }
        }
        break;
      }
      case 'next-cue': {
        const currentMs = video.currentTime * 1000;
        const nextCue = bilingualCues.find((c) => c.start > currentMs + 100);
        if (nextCue) {
          seekToCue(video, nextCue);
          if (panel) { highlightCue(panel, nextCue.index); scrollToCue(panel, nextCue.index); }
        }
        break;
      }
      case 'replay-cue': {
        const currentMs = video.currentTime * 1000;
        const currentCue = bilingualCues.find((c) => c.start <= currentMs && c.end >= currentMs)
          ?? [...bilingualCues].reverse().find((c) => c.start < currentMs);
        if (currentCue) {
          seekToCue(video, currentCue);
          if (panel) { highlightCue(panel, currentCue.index); scrollToCue(panel, currentCue.index); }
        }
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
      case 'toggle-panel': {
        panelVisible = !panelVisible;
        if (panel) {
          if (panelVisible) {
            showPanelDocked(f0, playerContainer, panel);
          } else {
            hidePanelDocked(f0, playerContainer, panel);
          }
        }
        break;
      }
    }
  });

  // Wire timeupdate → highlight + scroll current cue in panel
  video.addEventListener('timeupdate', () => {
    if (!panel || !panelVisible || bilingualCues.length === 0) return;
    const currentMs = video.currentTime * 1000;
    const currentCue = bilingualCues.find((c) => c.start <= currentMs && c.end >= currentMs);
    if (currentCue) {
      highlightCue(panel, currentCue.index);
      scrollToCue(panel, currentCue.index);
    }
  });

  // === File import wiring ===
  // Wire import button: <label> wraps <input type=file> (created in subtitleImport.ts).
  const importButton = document.querySelector('[data-testid="subtitle-import-button"]') as HTMLButtonElement | null;
  const fileInput = importButton?.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (importButton && fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const result = await handleFileSelect(file);
      if (result.success && result.cues.length > 0) {
        controller.loadCues(result.cues);
        // Parse bilingual + render panel
        const bilingualResult = parseBilingualSrt(
          await file.text(),
        );
        if (bilingualResult.success) {
          bilingualCues = bilingualResult.cues;
          if (panel) {
            renderCueListLazy(panel, bilingualCues);
            // Auto-show panel after subtitle load (docked layout)
            panelVisible = true;
            showPanelDocked(f0, playerContainer, panel);
          }
        }
        showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, video);
      } else {
        showToast(`Import failed: ${result.error ?? 'unknown error'}`, video);
      }
    });
  }

  // Wire drag-drop on playerContainer → parse → loadCues + drag hover hint.
  // We attach to the player container (which holds the video) so drag events
  // cover the full video area. The drag hint overlay is appended to
  // video.parentElement (the art-player box) by createDragHint.
  const dragHint = createDragHint(video);
  let dragCounter = 0;

  playerContainer.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragHint.style.display = 'flex';
  });
  playerContainer.addEventListener('dragover', (e) => e.preventDefault());
  playerContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragHint.style.display = 'none';
    }
  });
  playerContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragHint.style.display = 'none';
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const result = await handleFileDrop(file);
    if (result.success && result.cues.length > 0) {
      controller.loadCues(result.cues);
      // Parse bilingual + render panel
      const fileText = await file.text();
      const bilingualResult = parseBilingualSrt(fileText);
      if (bilingualResult.success) {
        bilingualCues = bilingualResult.cues;
        if (panel) {
          renderCueListLazy(panel, bilingualCues);
          // Auto-show panel after subtitle load (docked layout)
          panelVisible = true;
          showPanelDocked(f0, playerContainer, panel);
        }
      }
      showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, video);
    } else {
      showToast(`Drag-drop failed: ${result.error ?? 'unknown error'}`, video);
    }
  });

  // === Bilingual auto-load wiring (ADR-007 D1, spec F3/F4/F7) ===
  // Listen for AUTO_LOAD_SUBTITLES pushes from background (triggered on
  // PAGE_SCAN_RESULT + onMediaDetected). Fetch + parse target + native
  // (cache by URL), load bilingual cues into overlay, re-render panel.
  // Re-renders fully each push — no accumulation across pushes (spec F7).
  // Auto-load + drag-drop are independent: whichever arrives last overrides.
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    if (msg?.type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES) {
      const payload = msg.payload as AutoLoadSubtitlesPayload;
      void handleAutoLoadSubtitles(payload, {
        controller,
        tabUrl: window.location.href,
        onPanelRender: (targetCues: SrtCue[], nativeCues: SrtCue[]) => {
          bilingualCues = mergeCuesForPanel(targetCues, nativeCues);
          if (panel) {
            renderCueListLazy(panel, bilingualCues);
            panelVisible = true;
            showPanelDocked(f0, playerContainer, panel);
          }
        },
        onToast: (message: string) => showToast(message, video),
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
}

// Find video element and init overlay (defer until DOM ready, observe SPA late mounts)
function findAndInitOverlay(): void {
  const video = document.querySelector('video');
  if (video) {
    initSubtitleOverlay(video);
    return;
  }

  // SPA: video may be rendered after DOMContentLoaded. Observe body until it appears.
  // ponytail: disconnect as soon as video is found to avoid unnecessary mutation work.
  const observer = new MutationObserver(() => {
    const v = document.querySelector('video');
    if (v) {
      observer.disconnect();
      initSubtitleOverlay(v);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndInitOverlay);
} else {
  findAndInitOverlay();
}
