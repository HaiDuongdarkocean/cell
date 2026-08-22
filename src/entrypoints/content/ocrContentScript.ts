// ocrContentScript — T21-T25. Content-script OCR integration.
// Wires OcrController + OcrPipeline + OcrOverlay + SubtitleTriggerController.
// Activated when OCR is enabled for the current origin.
// T19: Reacts to settings changes (toggle ON/OFF → init/dispose).
// T20: Auto-start on page load + SPA nav handling.
// Task 7 (spec ocr-split-dual-stream): split dual-stream — region chia đôi,
// 2 engine keys, detections → cues → window.postMessage('__CELL_OCR_TRACKS').

import { OcrController } from './ocrController';
import { OcrOverlay, createHitboxes, wireOcrHitboxesToTrigger } from '@/features/ocr/overlay/ocrOverlay';
import { RegionSelector, defaultBottomRegion, type RegionSelectorMode } from '@/features/ocr/overlay/regionSelector';
import { OcrPipelineState, runPipelineStep, DEFAULT_PIPELINE_CONFIG, type OcrPipelineConfig } from '@/features/ocr/pipeline/ocrPipeline';
import { captureFrame, scheduleNextFrame } from '@/features/ocr/pipeline/frameCapture';
import { computeSubtitleRegion } from '@/features/ocr/pipeline/cropRegion';
import { computeSplitHalves, type SplitHalf } from '@/features/ocr/pipeline/splitRegion';
import { ocrTextToCues, type OcrDetection } from '@/features/ocr/pipeline/ocrToCues';
import { resolveOcrLang, ENGINE_KEY_FOR_LANG, type ResolvedOcrLang } from '@/features/ocr/engine/paddleOcrLanguages';
import { isOcrEnabledForUrl, loadOcrSettings, saveOcrSettings, setOcrPreference, extractOriginFromUrl } from '@/features/ocr/persistence/ocrStateStore';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { isVideoReady } from '@/shared/lib/dom/videoReady';
import type { OcrOriginState, CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';
import { DEFAULT_OCR_ORIGIN_STATE } from '@/features/ocr/persistence/ocrStateTypes';
import type { ImageSource } from '@/features/ocr/engine/types';
import type { SubtitleTriggerController } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import { MESSAGE_TYPES } from '@/shared/config/messages';

/** Session pipeline config = shared pipeline config + split dual-stream fields. */
interface OcrSessionConfig extends OcrPipelineConfig {
  readonly splitEnabled: boolean;
  readonly splitRatio: number;
  readonly splitTopIsTarget: boolean;
}

const DEFAULT_SESSION_CONFIG: OcrSessionConfig = {
  ...DEFAULT_PIPELINE_CONFIG,
  splitEnabled: false,
  splitRatio: 0.5,
  splitTopIsTarget: true,
};

/** navigator.deviceMemory (GB) — undefined on Firefox → assume 8 (dual-engine capable). */
function deviceMemoryGb(): number {
  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
}

/** Engine plan for split dual-stream (ADR-082): distinct model keys need >= 4GB RAM,
 *  otherwise both streams share the target engine (low-memory mode). */
export interface SplitEnginePlan {
  readonly targetKey: string;
  readonly nativeKey: string;
  readonly dualEngine: boolean;
}

export function planSplitEngines(targetLang: ResolvedOcrLang, nativeLang: ResolvedOcrLang, memoryGb: number): SplitEnginePlan {
  const targetKey = ENGINE_KEY_FOR_LANG(targetLang);
  const nativeKey = ENGINE_KEY_FOR_LANG(nativeLang);
  const dualEngine = targetKey !== nativeKey && memoryGb >= 4;
  return { targetKey, nativeKey: dualEngine ? nativeKey : targetKey, dualEngine };
}

/** Region height % — same regardless of split mode (user controls via slider). */
export function effectiveSplitRegionPct(originState: OcrOriginState): number {
  return originState.subtitleRegionPct;
}

/** Divider labels for the two halves (top may be target or native). */
function splitLabels(topIsTarget: boolean): { topLabel: string; bottomLabel: string } {
  return topIsTarget
    ? { topLabel: 'Target', bottomLabel: 'Native' }
    : { topLabel: 'Native', bottomLabel: 'Target' };
}

/** Persist a divider-drag ratio for an origin, keeping every other field (incl. customRegion) unchanged. */
export async function saveSplitRatioForOrigin(origin: string, ratio: number, fallback?: OcrOriginState): Promise<void> {
  if (!origin) return;
  const settings = await loadOcrSettings();
  const existing = settings.origins[origin] ?? fallback;
  if (!existing) return;
  const clamped = Math.max(0.1, Math.min(0.9, ratio));
  const next = setOcrPreference(settings, origin, { ...existing, splitRatio: clamped });
  await saveOcrSettings(next);
}

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
  private config: OcrSessionConfig = DEFAULT_SESSION_CONFIG;
  private originState: OcrOriginState | null = null;
  private triggerController: SubtitleTriggerController | null = null;
  // ── Split dual-stream (Task 7, spec ocr-split-dual-stream) ──
  private splitPipelineStates: { target: OcrPipelineState; native: OcrPipelineState } | null = null;
  private splitDetections: { target: OcrDetection[]; native: OcrDetection[] } = { target: [], native: [] };
  private splitEngineKeys: { target: string; native: string } | null = null;
  private splitTracksPosted = false;
  private systemLangs: { target: string; native: string } = { target: 'auto', native: 'auto' };
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
      onSplitRatioChange: (ratio) => { void this.handleSplitRatioChange(ratio); },
      onToggleSplit: () => { void this.handleToggleSplit(); },
      onSelectRegion: () => { this.setRegionMode('select'); },
      onResetRegion: () => { void this.handleResetRegion(); },
    });
  }

  private pendingRegion: CustomRegion | null = null;

  /** Set the SubtitleTriggerController for dictionary lookup wiring (T16). */
  setTriggerController(tc: SubtitleTriggerController): void {
    this.triggerController = tc;
  }

  /** Start OCR session for a video element.
   *  systemLangs: system subtitle languages (from general settings) used when
   *  the origin has no target/native override — defaults to 'auto'. */
  async start(
    video: HTMLVideoElement,
    originState: OcrOriginState,
    systemLangs: { target: string; native: string } = { target: 'auto', native: 'auto' },
  ): Promise<void> {
    if (this.running) return;
    this.video = video;
    this.originState = originState;
    this.systemLangs = systemLangs;
    this.config = {
      ...DEFAULT_SESSION_CONFIG,
      subtitleRegionPct: effectiveSplitRegionPct(originState),
      subtitleRegionWidthPct: originState.subtitleRegionWidthPct,
      customRegion: originState.customRegion,
      splitEnabled: originState.splitEnabled,
      splitRatio: originState.splitRatio,
      splitTopIsTarget: originState.splitTopIsTarget,
    };
    this.pipelineState.reset();
    this.splitPipelineStates = originState.splitEnabled
      ? { target: new OcrPipelineState(), native: new OcrPipelineState() }
      : null;
    this.splitDetections = { target: [], native: [] };

    // Init OCR engine in offscreen document.
    try {
      if (originState.splitEnabled) {
        await this.initSplitEngines(originState, systemLangs);
      } else {
        const initResult = await this.controller.init(originState.languageMode, 'webgpu');
        document.body.dataset.ocrInitResult = JSON.stringify(initResult);
      }
    } catch (e) {
      document.body.dataset.ocrInitError = String(e);
      throw e;
    }

    // Attach overlay.
    document.body.dataset.ocrDebugAttach = `video=${video?.tagName},parent=${video?.parentElement?.tagName}`;
    this.overlay.attach(video);
    document.body.dataset.ocrDebugAfterAttach = `container=${(this.overlay as unknown as { container?: HTMLElement }).container?.tagName}`;

    // Attach region selector in view mode (green rectangle showing scan area).
    const initialRegion = originState.customRegion ?? defaultBottomRegion(this.config.subtitleRegionPct, originState.subtitleRegionWidthPct);
    this.regionSelector.attach(video, initialRegion, 'view');
    if (originState.splitEnabled) {
      const { topLabel, bottomLabel } = splitLabels(originState.splitTopIsTarget);
      this.regionSelector.setSplit(true, originState.splitRatio, topLabel, bottomLabel);
    }

    this.running = true;

    // Clear stale hitboxes + reset pipeline on seek (different scene).
    this.onSeeked = () => {
      this.overlay.clear();
      this.pipelineState.reset();
      this.splitPipelineStates?.target.reset();
      this.splitPipelineStates?.native.reset();
      this.splitDetections = { target: [], native: [] };
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

  /** Process a single frame through the pipeline. Split dual-stream runs its
   *  own two-region path; otherwise the single-stream path is unchanged. */
  private async processFrame(frame: ImageSource): Promise<void> {
    if (this.config.splitEnabled && this.splitPipelineStates) {
      await this.processSplitFrame(frame);
      return;
    }
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
        // Close the currently open cue (ocrToCues contract: empty text closes).
        if (this.video) {
          this.splitDetections.target.push({ text: '', timeMs: this.video.currentTime * 1000 });
          this.postOcrTracks();
        }
      }

      if (result.status === 'ocr' && this.video) {
        const hitboxes = createHitboxes(result.results, result.scriptRuns);
        console.log(`[OCR] t=${this.video.currentTime.toFixed(2)}s text=${JSON.stringify(result.results.map(r => r.text))} hitboxes=${hitboxes.length}`);
        this.overlay.updateHitboxes(hitboxes, this.video.videoWidth, this.video.videoHeight);

        // T16: Wire hitbox clicks → SubtitleTriggerController → dictionary popup.
        if (this.triggerController) {
          wireOcrHitboxesToTrigger(this.overlay, this.triggerController);
        }
        // Push detection to subtitle block (same as split mode — single stream
        // is target-only, native stays empty).
        this.splitDetections.target.push({ text: result.results.map(r => r.text).join(' '), timeMs: this.video.currentTime * 1000 });
        this.postOcrTracks();
      }
    } catch (e) {
      // Dev debug: expose errors via DOM dataset (visible from MAIN world).
      const errs = (document.body.dataset.ocrErrors || '').split('\n').filter(Boolean);
      errs.push(String(e));
      document.body.dataset.ocrErrors = errs.slice(-10).join('\n');
    }
  }

  /** Split dual-stream: OCR the top + bottom halves with their own pipeline
   *  states + engines, accumulate detections, and push cue tracks to the
   *  subtitle controller bridge. DRM on either stream stops the session. */
  private async processSplitFrame(frame: ImageSource): Promise<void> {
    const states = this.splitPipelineStates;
    const keys = this.splitEngineKeys;
    if (!states || !keys || !this.video) return; // engines still initializing

    const parent = this.config.customRegion
      ?? defaultBottomRegion(this.config.subtitleRegionPct, this.config.subtitleRegionWidthPct);
    const { top, bottom } = computeSplitHalves(parent, this.config.splitRatio);
    const topIsTarget = this.config.splitTopIsTarget;
    const streams: { half: SplitHalf; state: OcrPipelineState; key: string; track: 'target' | 'native' }[] = [
      { half: top, state: topIsTarget ? states.target : states.native, key: topIsTarget ? keys.target : keys.native, track: topIsTarget ? 'target' : 'native' },
      { half: bottom, state: topIsTarget ? states.native : states.target, key: topIsTarget ? keys.native : keys.target, track: topIsTarget ? 'native' : 'target' },
    ];

    const timeMs = this.video.currentTime * 1000;
    let hasUpdate = false;
    for (const { half, state, key, track } of streams) {
      try {
        const result = await runPipelineStep(
          frame,
          (img, minScore) => this.controller.recognize(img, minScore, key),
          state,
          this.config,
          undefined,
          half,
        );
        const statuses = (document.body.dataset.ocrPipelineStatuses || '').split(',').filter(Boolean);
        statuses.push(result.status);
        document.body.dataset.ocrPipelineStatuses = statuses.slice(-20).join(',');
        if (result.status === 'drm_detected') {
          // Stop OCR — DRM-protected content (either stream).
          document.body.dataset.ocrDrmDetected = `meanLuma=${result.meanLuma}`;
          await this.stop();
          return;
        }
        if (result.status === 'ocr') {
          this.splitDetections[track].push({ text: result.results.map(r => r.text).join(' '), timeMs });
          hasUpdate = true;
        } else if (result.status === 'subtitle_gone') {
          // Empty text closes the currently open cue (ocrToCues contract).
          this.splitDetections[track].push({ text: '', timeMs });
          hasUpdate = true;
        } else if (result.status === 'error') {
          document.body.dataset.ocrLastError = (result as { error?: string }).error?.slice(0, 200);
        }
      } catch (e) {
        const errs = (document.body.dataset.ocrErrors || '').split('\n').filter(Boolean);
        errs.push(String(e));
        document.body.dataset.ocrErrors = errs.slice(-10).join('\n');
      }
    }
    if (hasUpdate) this.postOcrTracks();
  }

  /** Resolve split langs + init engines (Task 7 / ADR-082). Engine 2 failure or
   *  low RAM degrades to both streams sharing the target engine — never crashes
   *  the session (region selector still attaches). */
  private async initSplitEngines(originState: OcrOriginState, systemLangs: { target: string; native: string }): Promise<void> {
    const targetLang = resolveOcrLang(originState.targetLangOverride ?? null, systemLangs.target);
    const nativeLang = resolveOcrLang(originState.nativeLangOverride ?? null, systemLangs.native);
    const plan = planSplitEngines(targetLang, nativeLang, deviceMemoryGb());
    const targetInit = await this.controller.init(targetLang, 'webgpu', plan.targetKey);
    document.body.dataset.ocrInitResult = JSON.stringify(targetInit);
    if (plan.dualEngine) {
      const nativeInit = await this.controller.init(nativeLang, 'webgpu', plan.nativeKey);
      if (nativeInit.status !== 'ready') {
        // Graceful: native stream falls back to the target engine (low-memory behavior).
        document.body.dataset.ocrNativeInitError = nativeInit.error ?? 'unknown';
        this.splitEngineKeys = { target: plan.targetKey, native: plan.targetKey };
        return;
      }
    }
    this.splitEngineKeys = { target: plan.targetKey, native: plan.nativeKey };
  }

  /** Push the current dual-stream cue tracks to the subtitle controller.
   *  ponytail ceiling: recomputes the FULL cue list per update (O(n) with n =
   *  detections so far) and detections grow unboundedly over the video — fine
   *  for ~5 updates/s on typical subtitle volume; upgrade to an incremental
   *  cue builder if long videos show CPU overhead. */
  private postOcrTracks(): void {
    const targetCues = ocrTextToCues(this.splitDetections.target);
    const nativeCues = ocrTextToCues(this.splitDetections.native);
    window.postMessage({ type: '__CELL_OCR_TRACKS', targetCues, nativeCues }, '*');
    this.splitTracksPosted = true;
  }

  /** Tell the subtitle controller the OCR tracks are gone (session stop / split off). */
  private endOcrTracks(): void {
    if (!this.splitTracksPosted) return;
    window.postMessage({ type: '__CELL_OCR_TRACKS_END' }, '*');
    this.splitTracksPosted = false;
  }

  /** Stop OCR session — soft stop keeps engine alive for fast re-init. */
  async stop(): Promise<void> {
    this.running = false;
    this.endOcrTracks();
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
    this.splitPipelineStates = null;
    this.splitEngineKeys = null;
    this.splitDetections = { target: [], native: [] };
  }

  /** Light update of region config without full restart. Called when slider changes. */
  updateRegionConfig(originState: OcrOriginState): void {
    const wasSplit = this.config.splitEnabled;
    this.originState = originState;
    this.config = {
      ...this.config,
      subtitleRegionPct: effectiveSplitRegionPct(originState),
      subtitleRegionWidthPct: originState.subtitleRegionWidthPct,
      customRegion: originState.customRegion,
      splitEnabled: originState.splitEnabled,
      splitRatio: originState.splitRatio,
      splitTopIsTarget: originState.splitTopIsTarget,
    };
    if (this.video && this.running) {
      const region = originState.customRegion ?? defaultBottomRegion(this.config.subtitleRegionPct, originState.subtitleRegionWidthPct);
      this.regionSelector.updateRegion(region);
      if (originState.splitEnabled) {
        if (!this.splitPipelineStates) {
          // Split toggled ON mid-session — create states + init engines async;
          // processSplitFrame skips frames until splitEngineKeys is set.
          this.splitPipelineStates = { target: new OcrPipelineState(), native: new OcrPipelineState() };
          this.splitEngineKeys = null;
          void this.initSplitEngines(originState, this.systemLangs);
        }
        const { topLabel, bottomLabel } = splitLabels(originState.splitTopIsTarget);
        this.regionSelector.setSplit(true, originState.splitRatio, topLabel, bottomLabel);
      } else if (wasSplit) {
        // Split toggled OFF — single-stream path resumes; drop the OCR slots.
        this.splitPipelineStates = null;
        this.splitEngineKeys = null;
        this.splitDetections = { target: [], native: [] };
        this.regionSelector.setSplit(false, 0);
        this.endOcrTracks();
      }
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
    // Re-apply split after attach — attach recreates the container, wiping
    // split nodes. Without this, split halves + divider vanish in edit mode.
    if (this.originState?.splitEnabled) {
      const { topLabel, bottomLabel } = splitLabels(this.originState.splitTopIsTarget);
      this.regionSelector.setSplit(true, this.originState.splitRatio, topLabel, bottomLabel);
    }
  }

  /** Reset to default bottom region and clear custom region. */
  resetRegion(): void {
    if (!this.originState) return;
    const defaultRegion = defaultBottomRegion(this.originState.subtitleRegionPct, this.originState.subtitleRegionWidthPct);
    this.regionSelector.updateRegion(defaultRegion);
    this.regionSelector.setMode('view');
  }

  /** Handle divider drag end (view mode) — persist the new split ratio per-origin.
   *  The storage.onChanged listener then calls updateRegionConfig, which only
   *  re-renders the selector (no storage write) — no feedback loop. */
  private async handleSplitRatioChange(ratio: number): Promise<void> {
    if (!this.originState) return;
    await saveSplitRatioForOrigin(currentOrigin, ratio, this.originState);
    this.originState = { ...this.originState, splitRatio: ratio };
    this.config = { ...this.config, splitRatio: ratio };
  }

  /** Toggle split dual-stream on/off (from action bar). Persists to storage;
   *  storage.onChanged listener calls updateRegionConfig to apply the change. */
  private async handleToggleSplit(): Promise<void> {
    if (!this.originState || !currentOrigin) return;
    const nextSplit = !this.originState.splitEnabled;
    const settings = await loadOcrSettings();
    const next = setOcrPreference(settings, currentOrigin, { ...this.originState, splitEnabled: nextSplit });
    await saveOcrSettings(next);
  }

  /** Reset region to default + clear customRegion from storage (from action bar). */
  private async handleResetRegion(): Promise<void> {
    if (!this.originState || !currentOrigin) return;
    this.resetRegion();
    const settings = await loadOcrSettings();
    const next = setOcrPreference(settings, currentOrigin, { ...this.originState, customRegion: null });
    await saveOcrSettings(next);
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
    postOcrState(false);
  }
  currentOrigin = newOrigin;

  const enabled = await shouldEnableOcr(url);
  if (!enabled) {
    stopOcrVideoObserver();
    postOcrState(false);
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
  // System subtitle languages (target/native) from the general settings store —
  // used by split dual-stream when the origin has no language override.
  const generalSettings = await loadSettings().catch(() => null);
  const systemLangs = {
    target: generalSettings?.subtitleOverlayTargetLanguage ?? 'auto',
    native: generalSettings?.subtitleOverlayNativeLanguage ?? 'auto',
  };
  await activeSession.start(video, originState, systemLangs);
  postOcrState(true);
}

/** T19: Stop OCR session (called when toggle OFF or page unload). */
export async function stopOcrSession(): Promise<void> {
  stopOcrVideoObserver();
  if (activeSession?.isRunning()) {
    await activeSession.shutdown();
  }
  activeSession = null;
  postOcrState(false);
}

/** Post OCR enabled state to other content scripts (subtitle overlay toolbar). */
function postOcrState(enabled: boolean): void {
  window.postMessage({ type: '__CELL_OCR_STATE', enabled }, '*');
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
      void (async () => {
        if (!currentOrigin) return;
        const settings = await loadOcrSettings();
        const originState = settings.origins[currentOrigin];
        if (originState) {
          const next = setOcrPreference(settings, currentOrigin, { ...originState, customRegion: null });
          await saveOcrSettings(next);
        }
      })();
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
  // Usage: postMessage({ type: '__CELL_OCR_DEBUG_INIT', origin: '127.0.0.1', languageMode: 'auto', splitEnabled: true, splitRatio: 0.5, splitTopIsTarget: true, customRegion: {xPct,yPct,widthPct,heightPct} }, '*')
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data as {
      type?: string;
      origin?: string;
      languageMode?: string;
      splitEnabled?: boolean;
      splitRatio?: number;
      splitTopIsTarget?: boolean;
      customRegion?: { xPct: number; yPct: number; widthPct: number; heightPct: number };
    };
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
        const originState: OcrOriginState = {
          ...DEFAULT_OCR_ORIGIN_STATE,
          ocrEnabled: true,
          languageMode: (data.languageMode ?? 'auto') as OcrOriginState['languageMode'],
          splitEnabled: data.splitEnabled ?? false,
          splitRatio: data.splitRatio ?? 0.5,
          splitTopIsTarget: data.splitTopIsTarget ?? true,
          customRegion: data.customRegion ?? null,
        };
        activeSession = new OcrSession();
        const tc = getTriggerController?.() ?? null;
        if (tc) activeSession.setTriggerController(tc);
        document.body.dataset.ocrDebugStep = '3-before-start';
        await activeSession.start(video, originState);
        document.body.dataset.ocrDebugStep = '4-after-start';
        postOcrState(true);
      } catch (e) {
        document.body.dataset.ocrDebugException = String(e);
      }
    })();
  });

  // OCR toggle from subtitle overlay toolbar button.
  // Toggles ocrEnabled for current origin in storage; storage.onChanged listener
  // handles the actual start/stop.
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data as { type?: string };
    if (data?.type !== '__CELL_OCR_TOGGLE') return;
    void (async () => {
      if (!currentOrigin) return;
      const settings = await loadOcrSettings();
      const originState = settings.origins[currentOrigin] ?? DEFAULT_OCR_ORIGIN_STATE;
      const nextEnabled = !originState.ocrEnabled;
      const next = setOcrPreference(settings, currentOrigin, { ...originState, ocrEnabled: nextEnabled });
      await saveOcrSettings(next);
    })();
  });
}
