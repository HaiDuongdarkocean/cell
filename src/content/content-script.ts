import { PageScanner } from './pageScanner';
import { SubtitleOverlayController } from './subtitleOverlay';
import { handleFileDrop } from './subtitleDragDrop';
import { handleFileSelect } from './subtitleImport';
import { createDragHint, showToast } from './subtitleUI';
import type { OverlayConfig } from '../types/subtitle';

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

function initSubtitleOverlay(video: HTMLVideoElement): void {
  console.log('[VD] initSubtitleOverlay start, video:', video.currentSrc || video.src);
  const controller = new SubtitleOverlayController(video, DEFAULT_OVERLAY_CONFIG);
  controller.init();
  console.log('[VD] controller.init() done');

  // Wire import button: <label> wraps <input type=file> (created in subtitleImport.ts).
  // Click label = native file picker. Wire change handler here.
  const importButton = document.querySelector('[data-testid="subtitle-import-button"]') as HTMLButtonElement | null;
  const fileInput = importButton?.querySelector('input[type="file"]') as HTMLInputElement | null;
  console.log('[VD] importButton found:', !!importButton, '| fileInput found:', !!fileInput);
  if (importButton && fileInput) {
    // Log click on label — verify user gesture reaches here
    importButton.addEventListener('click', () => {
      console.log('[VD] label click event, target:', (event?.target as Element)?.tagName, '| input display:', getComputedStyle(fileInput).display);
    });
    fileInput.addEventListener('click', () => {
      console.log('[VD] input click event (should open picker)');
    });
    fileInput.addEventListener('change', async () => {
      console.log('[VD] input change event fired, files.length:', fileInput.files?.length);
      const file = fileInput.files?.[0];
      if (!file) {
        console.log('[VD] no file selected, return');
        return;
      }
      console.log('[VD] file selected:', file.name, '| size:', file.size, '| type:', file.type);
      const result = await handleFileSelect(file);
      console.log('[VD] parse result:', { success: result.success, cues: result.cues.length, format: result.format, error: result.error });
      if (result.success && result.cues.length > 0) {
        controller.loadCues(result.cues);
        showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, video);
        console.log('[VD] loadCues + showToast done');
      } else {
        showToast(`Import failed: ${result.error ?? 'unknown error'}`, video);
        console.error('[VD] Import failed:', result.error);
      }
    });
  }

  // Wire drag-drop on video → parse → loadCues + drag hover hint
  const dragHint = createDragHint(video);
  let dragCounter = 0; // ponytail: counter avoids flicker from nested dragenter/dragleave

  video.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragHint.style.display = 'flex';
  });
  video.addEventListener('dragover', (e) => e.preventDefault());
  video.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragHint.style.display = 'none';
    }
  });
  video.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragHint.style.display = 'none';
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const result = await handleFileDrop(file);
    if (result.success && result.cues.length > 0) {
      controller.loadCues(result.cues);
      showToast(`Subtitle loaded: ${result.cues.length} cues (${result.format.toUpperCase()})`, video);
    } else {
      showToast(`Drag-drop failed: ${result.error ?? 'unknown error'}`, video);
      console.error('[Video Downloader] Drag-drop failed:', result.error);
    }
  });
}

// Find video element and init overlay (defer until DOM ready)
function findAndInitOverlay(): void {
  const video = document.querySelector('video');
  if (video) {
    initSubtitleOverlay(video);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndInitOverlay);
} else {
  findAndInitOverlay();
}
