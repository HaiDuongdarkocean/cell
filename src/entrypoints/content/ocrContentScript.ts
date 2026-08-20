// ocrContentScript — T21-T25. Content-script OCR integration.
// Wires OcrController + OcrPipeline + OcrOverlay + SubtitleTriggerController.
// Activated when OCR is enabled for the current origin.
// T19: Reacts to settings changes (toggle ON/OFF → init/dispose).
// T20: Auto-start on page load + SPA nav handling.

import { OcrController } from './ocrController';
import { OcrOverlay, createHitboxes, wireOcrHitboxesToTrigger } from '@/features/ocr/overlay/ocrOverlay';
import { OcrPipelineState, runPipelineStep, DEFAULT_PIPELINE_CONFIG, type OcrPipelineConfig } from '@/features/ocr/pipeline/ocrPipeline';
import { captureFrame, scheduleNextFrame } from '@/features/ocr/pipeline/frameCapture';
import { isOcrEnabledForUrl, loadOcrSettings, extractOriginFromUrl } from '@/features/ocr/persistence/ocrStateStore';
import type { OcrOriginState } from '@/features/ocr/persistence/ocrStateTypes';
import type { ImageSource } from '@/features/ocr/engine/types';
import type { SubtitleTriggerController } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';

/** OCR content-script session — manages the full pipeline for one video. */
export class OcrSession {
  private readonly controller: OcrController;
  private readonly overlay: OcrOverlay;
  private readonly pipelineState: OcrPipelineState;
  private video: HTMLVideoElement | null = null;
  private canvas: OffscreenCanvas | null = null;
  private running = false;
  private config: OcrPipelineConfig = DEFAULT_PIPELINE_CONFIG;
  private triggerController: SubtitleTriggerController | null = null;

  constructor() {
    this.controller = new OcrController();
    this.overlay = new OcrOverlay();
    this.pipelineState = new OcrPipelineState();
  }

  /** Set the SubtitleTriggerController for dictionary lookup wiring (T16). */
  setTriggerController(tc: SubtitleTriggerController): void {
    this.triggerController = tc;
  }

  /** Start OCR session for a video element. */
  async start(video: HTMLVideoElement, originState: OcrOriginState): Promise<void> {
    if (this.running) return;
    this.video = video;
    this.config = {
      ...DEFAULT_PIPELINE_CONFIG,
      subtitleRegionPct: originState.subtitleRegionPct,
    };
    this.pipelineState.reset();

    // Init OCR engine in offscreen document.
    await this.controller.init(originState.languageMode, 'webgpu');

    // Attach overlay.
    this.overlay.attach(video);

    this.running = true;
    this.loop();
  }

  /** Main rVFC loop — capture → pipeline → overlay. */
  private loop(): void {
    if (!this.running || !this.video) return;
    if (this.video.paused || this.video.ended) {
      scheduleNextFrame(this.video, () => this.loop());
      return;
    }

    try {
      const frame = captureFrame(this.video, this.canvas ?? undefined);
      if (!this.canvas && typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(frame.width, frame.height);
      }

      void this.processFrame(frame);
    } catch {
      // Frame capture may fail during video load — skip and retry.
    }

    scheduleNextFrame(this.video, () => this.loop());
  }

  /** Process a single frame through the pipeline. */
  private async processFrame(frame: ImageSource): Promise<void> {
    if (this.pipelineState.isDrmDetected()) return;

    const result = await runPipelineStep(
      frame,
      (img, minScore) => this.controller.recognize(img, minScore),
      this.pipelineState,
      this.config,
    );

    if (result.status === 'drm_detected') {
      // Stop OCR — DRM-protected content.
      this.stop();
      return;
    }

    if (result.status === 'ocr' && this.video) {
      // Update overlay with per-script-run hitboxes.
      const hitboxes = createHitboxes(result.results, result.scriptRuns);
      this.overlay.updateHitboxes(hitboxes, this.video.videoWidth, this.video.videoHeight);

      // T16: Wire hitbox clicks → SubtitleTriggerController → dictionary popup.
      if (this.triggerController) {
        wireOcrHitboxesToTrigger(this.overlay, this.triggerController);
      }
    }
  }

  /** Stop OCR session. */
  async stop(): Promise<void> {
    this.running = false;
    this.overlay.detach();
    await this.controller.dispose();
    this.video = null;
    this.canvas = null;
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

/** T20: Start OCR if enabled for the current URL. Called on page load + SPA nav. */
export async function initOcrForCurrentUrl(url: string): Promise<void> {
  const newOrigin = extractOriginFromUrl(url);
  if (newOrigin === currentOrigin && activeSession?.isRunning()) return;

  // Origin changed — stop existing session.
  if (activeSession?.isRunning()) {
    await activeSession.stop();
    activeSession = null;
  }
  currentOrigin = newOrigin;

  const enabled = await shouldEnableOcr(url);
  if (!enabled) return;

  const video = findVideoElement();
  if (!video) return;

  const settings = await loadOcrSettings();
  const originState = settings.origins[newOrigin];
  if (!originState?.ocrEnabled) return;

  activeSession = new OcrSession();
  await activeSession.start(video, originState);
}

/** T19: Stop OCR session (called when toggle OFF or page unload). */
export async function stopOcrSession(): Promise<void> {
  if (activeSession?.isRunning()) {
    await activeSession.stop();
  }
  activeSession = null;
}

/** T19+T20: Initialize OCR content script — call on content-script load.
 *  Sets up:
 *  - Initial OCR check for current URL
 *  - chrome.storage.onChanged listener (toggle ON/OFF → start/stop)
 *  - SPA nav listener (yt-navigate-finish, popstate → re-check origin) */
export function initOcrContentScript(): void {
  // T20: Initial check on page load.
  void initOcrForCurrentUrl(window.location.href);

  // T19: React to settings changes (toggle in Manager Panel).
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' && area !== 'sync') return;
      if (changes.settings?.newValue) {
        void initOcrForCurrentUrl(window.location.href);
      }
    });
  }

  // T20: SPA navigation — re-check origin.
  window.addEventListener('yt-navigate-finish', () => {
    void initOcrForCurrentUrl(window.location.href);
  });
  window.addEventListener('popstate', () => {
    void initOcrForCurrentUrl(window.location.href);
  });
}
