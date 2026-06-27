import { PageScanner } from './pageScanner';
import { SubtitleOverlayController } from './subtitleOverlay';
import { handleFileDrop } from './subtitleDragDrop';
import { handleFileSelect } from './subtitleImport';
import { createDragHint, showToast } from './subtitleUI';
import { parseBilingualSrt } from './subtitleBilingualParser';
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
  createDockingWrapper,
  showPanelDocked,
  hidePanelDocked,
  movePanelToOuterWrapper,
} from './subtitleDocking';
import { handleShortcutKey } from './subtitleShortcuts';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/constants/config';
import type { OverlayConfig } from '../types/subtitle';
import type { BilingualCue, KeyboardShortcut } from '../types/media';

// ponytail: content script không có chrome.tabs API — gửi message không tabId,
// background tự lấy từ sender.tab.id (xem messageBus.handleMessage)
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
  // Direction C: wrap video in a two-layer docking container so the panel can be a
  // sibling of the video box. outerWrapper is the flex container; videoWrapper holds
  // the video + overlay + toggle + import + drag hint.
  // ponytail: create wrappers before controller init so overlay/import/toggle append
  // into the videoWrapper automatically.
  const { outerWrapper, videoWrapper } = createDockingWrapper(video);

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

  // Move panel from videoWrapper to outerWrapper so it becomes a sibling of the video box.
  // This is required for flex layout to place the panel beside the video.
  if (panel) {
    movePanelToOuterWrapper(panel, outerWrapper);
  }

  // Wire toggle button → show/hide panel (docked layout shrinks video when open)
  toggleBtn.addEventListener('click', () => {
    panelVisible = !panelVisible;
    if (panel && toggleBtn) {
      if (panelVisible) {
        showPanelDocked(outerWrapper, videoWrapper, video, panel);
      } else {
        hidePanelDocked(outerWrapper, videoWrapper, panel);
      }
    }
  });

  // Wire close button in panel header → hide panel
  const closeBtn = panel.querySelector('[data-testid="panel-close"]');
  closeBtn?.addEventListener('click', () => {
    panelVisible = false;
    if (panel && toggleBtn) {
      hidePanelDocked(outerWrapper, videoWrapper, panel);
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
            showPanelDocked(outerWrapper, videoWrapper, video, panel);
          } else {
            hidePanelDocked(outerWrapper, videoWrapper, panel);
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
            showPanelDocked(outerWrapper, videoWrapper, video, panel);
          }
        }
        showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, video);
      } else {
        showToast(`Import failed: ${result.error ?? 'unknown error'}`, video);
      }
    });
  }

  // Wire drag-drop on videoWrapper → parse → loadCues + drag hover hint.
  // We attach to the wrapper instead of the video because the video has
  // pointer-events: none so clicks pass through to art-player controls.
  // The wrapper covers the same area and still receives drag events.
  const dragHint = createDragHint(video);
  let dragCounter = 0;

  videoWrapper.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragHint.style.display = 'flex';
  });
  videoWrapper.addEventListener('dragover', (e) => e.preventDefault());
  videoWrapper.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragHint.style.display = 'none';
    }
  });
  videoWrapper.addEventListener('drop', async (e) => {
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
          showPanelDocked(outerWrapper, videoWrapper, video, panel);
        }
      }
      showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, video);
    } else {
      showToast(`Drag-drop failed: ${result.error ?? 'unknown error'}`, video);
    }
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
