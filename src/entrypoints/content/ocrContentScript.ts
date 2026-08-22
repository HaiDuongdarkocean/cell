// ocrContentScript — T21-T25. Content-script OCR integration.
// Wires OcrController + OcrPipeline + OcrOverlay + SubtitleTriggerController.
// Activated when OCR is enabled for the current origin.
// T19: Reacts to settings changes (toggle ON/OFF → init/dispose).
// T20: Auto-start on page load + SPA nav handling.

import { OcrController } from './ocrController';
import { OcrOverlay, createHitboxes, wireOcrHitboxesToTrigger } from '@/features/ocr/overlay/ocrOverlay';
import { RegionSelector, defaultBottomRegion, type RegionSelectorMode } from '@/features/ocr/overlay/regionSelector';
import { OcrPipelineState, runPipelineStep, DEFAULT_PIPELINE_CONFIG, type OcrPipelineConfig } from '@/features/ocr/pipeline/ocrPipeline';
import { captureFrame, scheduleNextFrame } from '@/features/ocr/pipeline/frameCapture';
import { computeSubtitleRegion } from '@/features/ocr/pipeline/cropRegion';
import { isOcrEnabledForUrl, loadOcrSettings, saveOcrSettings, setOcrPreference, extractOriginFromUrl } from '@/features/ocr/persistence/ocrStateStore';
import { isVideoReady } from '@/shared/lib/dom/videoReady';
import type { OcrOriginState, CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';
import type { ImageSource } from '@/features/ocr/engine/types';
import type { SubtitleTriggerController } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import { MESSAGE_TYPES } from '@/shared/config/messages';

/** OCR content-script session — manages the full pipeline for one video. */
export class OcrSession {
  private readonly controller: OcrController;
  private readonly overlay: OcrOverlay;
  private readonly pipelineState: OcrPipelineState;
  private readonly regionSelector: RegionSelector;
  private video: HTMLVideoElement | null = null;
  private canvas: OffscreenCanvas | null = null;
  private running = false;
  private processing = false;
  private loopCount = 0;
  private config: OcrPipelineConfig = DEFAULT_PIPELINE_CONFIG;
  private originState: OcrOriginState | null = null;
  private triggerController: SubtitleTriggerController | null = null;
  /** Bound listeners (for removal on stop). */
  private onSeeked: (() => void) | null = null;
  private onEnded: (() => void) | null = null;

  constructor() {
    this.controller = new OcrController();
    this.overlay = new OcrOverlay();
    this.pipelineState = new OcrPipelineState();
    this.regionSelector = new RegionSelector({
      onRegionChange: (region) => { this.pendingRegion = region; },
      onApply: () => { void this.handleRegionApply(); },
      onCancel: () => { void this.handleRegionCancel(); },
    });
  }

  private pendingRegion: CustomRegion | null = null;

  /** Set the SubtitleTriggerController for dictionary lookup wiring (T16). */
  setTriggerController(tc: SubtitleTriggerController): void {
    this.triggerController = tc;
  }

  /** Start OCR session for a video element. */
  async start(video: HTMLVideoElement, originState: OcrOriginState): Promise<void> {
    if (this.running) return;
    this.video = video;
    this.originState = originState;
    this.config = {
      ...DEFAULT_PIPELINE_CONFIG,
      subtitleRegionPct: originState.subtitleRegionPct,
      subtitleRegionWidthPct: originState.subtitleRegionWidthPct,
      customRegion: originState.customRegion,
    };
    this.pipelineState.reset();

    // Init OCR engine in offscreen document.
    try {
      const initResult = await this.controller.init(originState.languageMode, 'webgpu');
      document.body.dataset.ocrInitResult = JSON.stringify(initResult);
    } catch (e) {
      document.body.dataset.ocrInitError = String(e);
      throw e;
    }

    // Attach overlay.
    document.body.dataset.ocrDebugAttach = `video=${video?.tagName},parent=${video?.parentElement?.tagName}`;
    this.overlay.attach(video);
    document.body.dataset.ocrDebugAfterAttach = `container=${(this.overlay as unknown as { container?: HTMLElement }).container?.tagName}`;

    // Attach region selector in view mode (green rectangle showing scan area).
    const initialRegion = originState.customRegion ?? defaultBottomRegion(originState.subtitleRegionPct, originState.subtitleRegionWidthPct);
    this.regionSelector.attach(video, initialRegion, 'view');

    this.running = true;

    // Clear stale hitboxes + reset pipeline on seek (different scene).
    this.onSeeked = () => {
      this.overlay.clear();
      this.pipelineState.reset();
    };
    this.onEnded = () => {
      this.overlay.clear();
    };
    video.addEventListener('seeked', this.onSeeked);
    video.addEventListener('ended', this.onEnded);

    this.loop();
  }

  /** Main rVFC loop — capture → pipeline → overlay. */
  private loop(): void {
    if (!this.running || !this.video) return;
    if (this.video.paused || this.video.ended) {
      scheduleNextFrame(this.video, () => this.loop());
      return;
    }
    // Processing lock — only one OCR in-flight at a time.
    // Without this, multiple processFrame calls race and results arrive
    // out-of-order, causing text from an earlier cue to appear over a later cue.
    if (this.processing) {
      scheduleNextFrame(this.video, () => this.loop());
      return;
    }

    this.loopCount = (this.loopCount ?? 0) + 1;
    document.body.dataset.ocrLoopCount = String(this.loopCount);

    try {
      const frame = captureFrame(this.video, this.canvas ?? undefined);
      if (!this.canvas && typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(frame.width, frame.height);
      }

      // Debug: log crop region coords.
      const region = computeSubtitleRegion(frame.width, frame.height, this.config.subtitleRegionPct);
      document.body.dataset.ocrCropRegion = JSON.stringify(region);

      this.processing = true;
      void this.processFrame(frame).finally(() => {
        this.processing = false;
      });
    } catch (e) {
      document.body.dataset.ocrLoopError = String(e)?.slice(0, 200);
      this.processing = false;
    }

    scheduleNextFrame(this.video, () => this.loop());
  }

  /** Process a single frame through the pipeline. */
  private async processFrame(frame: ImageSource): Promise<void> {
    if (this.pipelineState.isDrmDetected()) return;

    try {
      const result = await runPipelineStep(
        frame,
        (img, minScore) => this.controller.recognize(img, minScore),
        this.pipelineState,
        this.config,
      );

      // Dev debug: log pipeline result status.
      const statuses = (document.body.dataset.ocrPipelineStatuses || '').split(',').filter(Boolean);
      statuses.push(result.status);
      document.body.dataset.ocrPipelineStatuses = statuses.slice(-20).join(',');
      // Also log luma debug from pipeline.
      const lumaDbg = (globalThis as { __ocrLumaDbg?: string[] }).__ocrLumaDbg;
      if (lumaDbg && lumaDbg.length > 0) {
        document.body.dataset.ocrLumaDbg = lumaDbg.join(' | ');
      }
      const captureDbg = (globalThis as { __ocrCaptureDbg?: string }).__ocrCaptureDbg;
      if (captureDbg) {
        document.body.dataset.ocrCaptureDbg = captureDbg;
      }
      if (result.status === 'ocr') {
        document.body.dataset.ocrLastResult = JSON.stringify(result.results.map(r => r.text)).slice(0, 200);
      }
      if (result.status === 'error') {
        document.body.dataset.ocrLastError = (result as { error?: string }).error?.slice(0, 200);
      }

      if (result.status === 'drm_detected') {
        // Stop OCR — DRM-protected content.
        document.body.dataset.ocrDrmDetected = `meanLuma=${result.meanLuma}`;
        this.stop();
        return;
      }

      if (result.status === 'subtitle_gone') {
        // Subtitle disappeared from frame — clear overlay immediately.
        this.overlay.clear();
      }

      if (result.status === 'ocr' && this.video) {
        const hitboxes = createHitboxes(result.results, result.scriptRuns);
        console.log(`[OCR] t=${this.video.currentTime.toFixed(2)}s text=${JSON.stringify(result.results.map(r => r.text))} hitboxes=${hitboxes.length}`);
        this.overlay.updateHitboxes(hitboxes, this.video.videoWidth, this.video.videoHeight);

        // T16: Wire hitbox clicks → SubtitleTriggerController → dictionary popup.
        if (this.triggerController) {
          wireOcrHitboxesToTrigger(this.overlay, this.triggerController);
        }
      }
    } catch (e) {
      // Dev debug: expose errors via DOM dataset (visible from MAIN world).
      const errs = (document.body.dataset.ocrErrors || '').split('\n').filter(Boolean);
      errs.push(String(e));
      document.body.dataset.ocrErrors = errs.slice(-10).join('\n');
    }
  }

  /** Stop OCR session — soft stop keeps engine alive for fast re-init. */
  async stop(): Promise<void> {
    this.running = false;
    // Remove video listeners.
    if (this.video) {
      if (this.onSeeked) this.video.removeEventListener('seeked', this.onSeeked);
      if (this.onEnded) this.video.removeEventListener('ended', this.onEnded);
    }
    this.onSeeked = null;
    this.onEnded = null;
    this.overlay.detach();
    this.regionSelector.detach();
    // Engine stays alive in offscreen document — next start() hits the
    // `engine?.isInitialized()` fast path in ocrRunner (~100ms vs ~15s).
    // Dispose only on explicit shutdown (stopOcrSession / page unload).
    this.video = null;
    this.canvas = null;
    this.pendingRegion = null;
  }

  /** Light update of region config without full restart. Called when slider changes. */
  updateRegionConfig(originState: OcrOriginState): void {
    this.originState = originState;
    this.config = {
      ...this.config,
      subtitleRegionPct: originState.subtitleRegionPct,
      subtitleRegionWidthPct: originState.subtitleRegionWidthPct,
      customRegion: originState.customRegion,
    };
    if (this.video && this.running) {
      const region = originState.customRegion ?? defaultBottomRegion(originState.subtitleRegionPct, originState.subtitleRegionWidthPct);
      this.regionSelector.updateRegion(region);
    }
  }

  /** Enter region-select/edit/view mode. Called from Settings Panel via message. */
  setRegionMode(mode: RegionSelectorMode): void {
    if (!this.video || !this.running) return;
    if (mode === 'view') {
      this.regionSelector.setMode('view');
      return;
    }
    const currentRegion = this.originState?.customRegion ?? defaultBottomRegion(this.config.subtitleRegionPct, this.config.subtitleRegionWidthPct);
    this.regionSelector.attach(this.video, currentRegion, mode);
  }

  /** Reset to default bottom region and clear custom region. */
  resetRegion(): void {
    if (!this.originState) return;
    const defaultRegion = defaultBottomRegion(this.originState.subtitleRegionPct, this.originState.subtitleRegionWidthPct);
    this.regionSelector.updateRegion(defaultRegion);
    this.regionSelector.setMode('view');
  }

  /** Handle Apply from region selector — save region to storage. */
  private async handleRegionApply(): Promise<void> {
    if (!this.originState || !currentOrigin) return;
    const region = this.pendingRegion ?? this.regionSelector.getRegion();
    this.config = { ...this.config, customRegion: region };
    this.regionSelector.setMode('view');
    const settings = await loadOcrSettings();
    const next = setOcrPreference(settings, currentOrigin, { ...this.originState, customRegion: region });
    await saveOcrSettings(next);
    this.originState = { ...this.originState, customRegion: region };
    this.pendingRegion = null;
    void chrome.storage.local.set({ __ocrRegionResult: { applied: true, timestamp: Date.now() } });
  }

  /** Handle Cancel from region selector — revert to saved region. */
  private async handleRegionCancel(): Promise<void> {
    const savedRegion = this.originState?.customRegion ?? defaultBottomRegion(this.config.subtitleRegionPct, this.config.subtitleRegionWidthPct);
    this.regionSelector.updateRegion(savedRegion);
    this.regionSelector.setMode('view');
    this.pendingRegion = null;
    void chrome.storage.local.set({ __ocrRegionResult: { applied: false, timestamp: Date.now() } });
  }

  /** Full shutdown — dispose engine in offscreen document. */
  async shutdown(): Promise<void> {
    await this.stop();
    await this.controller.dispose();
  }

  /** Whether the session is running. */
  isRunning(): boolean {
    return this.running;
  }
}

/** Check if OCR should be enabled for the current URL. */
export async function shouldEnableOcr(url: string): Promise<boolean> {
  const settings = await loadOcrSettings();
  return isOcrEnabledForUrl(settings, url);
}

/** Find the main video element on the page. */
export function findVideoElement(): HTMLVideoElement | null {
  return document.querySelector('video');
}

// --- T19+T20: Content-script init + SPA nav + settings change listener ---

let activeSession: OcrSession | null = null;
let currentOrigin = '';
let getTriggerController: (() => SubtitleTriggerController | null) | null = null;

// SPA video watcher — kisskh (Angular) mounts <video> seconds AFTER the content
// script runs, so initOcrForCurrentUrl finds nothing on page load and OCR never
// auto-starts (region selector missing after reload). The observer waits for a
// READY video (ADR-012 two-phase gate) then retries the init once.
let ocrVideoObserver: MutationObserver | null = null;

function stopOcrVideoObserver(): void {
  ocrVideoObserver?.disconnect();
  ocrVideoObserver = null;
}

function startOcrVideoObserver(url: string): void {
  stopOcrVideoObserver();
  ocrVideoObserver = new MutationObserver(() => {
    const v = findVideoElement();
    if (v && isVideoReady(v)) {
      stopOcrVideoObserver();
      void initOcrForCurrentUrl(url);
    }
  });
  ocrVideoObserver.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}

/** T20: Start OCR if enabled for the current URL. Called on page load + SPA nav. */
export async function initOcrForCurrentUrl(url: string): Promise<void> {
  const newOrigin = extractOriginFromUrl(url);
  if (newOrigin === currentOrigin && activeSession?.isRunning()) {
    stopOcrVideoObserver();
    return;
  }

  // Origin changed — stop existing session.
  if (activeSession?.isRunning()) {
    await activeSession.stop();
    activeSession = null;
  }
  currentOrigin = newOrigin;

  const enabled = await shouldEnableOcr(url);
  if (!enabled) {
    stopOcrVideoObserver();
    return;
  }

  const video = findVideoElement();
  // Not mounted yet (SPA) or still in template phase (src="") — attaching now
  // would be wiped by the framework's continued render (ADR-012).
  if (!video || !isVideoReady(video)) {
    startOcrVideoObserver(url);
    return;
  }
  stopOcrVideoObserver();

  const settings = await loadOcrSettings();
  const originState = settings.origins[newOrigin];
  if (!originState?.ocrEnabled) return;

  activeSession = new OcrSession();
  const tc = getTriggerController?.() ?? null;
  if (tc) activeSession.setTriggerController(tc);
  await activeSession.start(video, originState);
}

/** T19: Stop OCR session (called when toggle OFF or page unload). */
export async function stopOcrSession(): Promise<void> {
  stopOcrVideoObserver();
  if (activeSession?.isRunning()) {
    await activeSession.shutdown();
  }
  activeSession = null;
}

/** T19+T20: Initialize OCR content script — call on content-script load.
 *  Sets up:
 *  - Initial OCR check for current URL
 *  - chrome.storage.onChanged listener (toggle ON/OFF → start/stop)
 *  - SPA nav listener (yt-navigate-finish, popstate → re-check origin) */
export function initOcrContentScript(triggerFactory?: (() => SubtitleTriggerController | null)): void {
  getTriggerController = triggerFactory ?? null;
  document.body.dataset.ocrInitCalled = 'true';

  // T20: Initial check on page load.
  void initOcrForCurrentUrl(window.location.href);

  // T19: React to settings changes (toggle in Manager Panel).
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' && area !== 'sync') return;
      // OCR settings are stored under the 'ocrSettings' key (STORAGE_KEYS.OCR_SETTINGS),
      // NOT the general 'settings' key. Check both for safety.
      if (changes.ocrSettings?.newValue || changes.settings?.newValue) {
        // Light path: if session is running and only region config changed, update without restart.
        if (activeSession?.isRunning() && currentOrigin) {
          void (async () => {
            const settings = await loadOcrSettings();
            const originState = settings.origins[currentOrigin];
            if (originState?.ocrEnabled) {
              activeSession!.updateRegionConfig(originState);
            } else {
              // OCR disabled — full stop.
              await stopOcrSession();
            }
          })();
          return;
        }
        // Full init path: no active session or origin change.
        void initOcrForCurrentUrl(window.location.href);
      }
    });
  }

  // Region-select commands from Settings Panel.
  // Settings Panel sends via chrome.runtime.sendMessage → background → chrome.tabs.sendMessage.
  // Also accept window.postMessage for direct testing.
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type !== MESSAGE_TYPES.OCR_REGION_COMMAND) return;
      const mode = msg.payload?.mode as RegionSelectorMode | 'reset';
      if (!activeSession?.isRunning()) {
        sendResponse({ success: false, error: 'OCR session not running' });
        return;
      }
      if (mode === 'reset') {
        activeSession.resetRegion();
        void (async () => {
          if (!currentOrigin) return;
          const settings = await loadOcrSettings();
          const originState = settings.origins[currentOrigin];
          if (originState) {
            const next = setOcrPreference(settings, currentOrigin, { ...originState, customRegion: null });
            await saveOcrSettings(next);
          }
        })();
      } else {
        activeSession.setRegionMode(mode);
      }
      sendResponse({ success: true });
      return true;
    });
  }

  // Direct window.postMessage handler for region commands (testing + same-frame).
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data as { type?: string; mode?: RegionSelectorMode | 'reset' };
    if (data?.type !== '__CELL_OCR_REGION_COMMAND') return;
    if (!activeSession?.isRunning()) return;
    if (data.mode === 'reset') {
      activeSession.resetRegion();
    } else if (data.mode) {
      activeSession.setRegionMode(data.mode);
    }
  });

  // T20: SPA navigation — re-check origin.
  window.addEventListener('yt-navigate-finish', () => {
    void initOcrForCurrentUrl(window.location.href);
  });
  window.addEventListener('popstate', () => {
    void initOcrForCurrentUrl(window.location.href);
  });

  // Dev debug hook: page can request OCR init via postMessage (used by MCP browser tests).
  // Usage: postMessage({ type: '__CELL_OCR_DEBUG_INIT', origin: '127.0.0.1', languageMode: 'auto' }, '*')
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data as { type?: string; origin?: string; languageMode?: string };
    if (data?.type !== '__CELL_OCR_DEBUG_INIT' || !data.origin) return;
    void (async () => {
      try {
        document.body.dataset.ocrDebugStep = '1-start';
        if (activeSession?.isRunning()) {
          await activeSession.stop();
          activeSession = null;
        }
        currentOrigin = data.origin ?? '';
        const video = findVideoElement();
        document.body.dataset.ocrDebugStep = '2-video-' + (video ? 'found' : 'null');
        if (!video) return;
        const originState = {
          ocrEnabled: true,
          languageMode: (data.languageMode ?? 'auto') as 'auto' | 'zh' | 'en' | 'ja',
          subtitleRegionPct: 15,
          subtitleRegionWidthPct: 100,
          customRegion: null,
        };
        activeSession = new OcrSession();
        const tc = getTriggerController?.() ?? null;
        if (tc) activeSession.setTriggerController(tc);
        document.body.dataset.ocrDebugStep = '3-before-start';
        await activeSession.start(video, originState);
        document.body.dataset.ocrDebugStep = '4-after-start';
      } catch (e) {
        document.body.dataset.ocrDebugException = String(e);
      }
    })();
  });
}
