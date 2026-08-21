// ocrPipeline — T12. Orchestrates frame → DRM check → luma-diff → crop → OCR → script-run segment.
// spec §AD5: The main video pipeline loop.

import type { ImageSource, OcrResult, OcrResultItem } from '@/features/ocr/engine/types';
import { checkDrmGuard } from './drmGuard';
import { computeSubtitleRegion, cropImage } from './cropRegion';
import { scriptRunSegmenter, type ScriptRun } from '../language/scriptRunSegmenter';

/** OCR pipeline config. */
export interface OcrPipelineConfig {
  /** Subtitle region height as % of video height (default 15). */
  readonly subtitleRegionPct: number;
  /** Luma diff threshold for frame skip (default 3). */
  readonly lumaDiffThreshold: number;
  /** Min OCR confidence score (default 0.5). */
  readonly minScore: number;
  /** Min interval between OCR runs in ms (default 333 = 3fps). T10. */
  readonly minFrameIntervalMs: number;
  /** Max retry attempts on OCR failure (default 3). T22. */
  readonly maxRetries: number;
}

export const DEFAULT_PIPELINE_CONFIG: OcrPipelineConfig = {
  subtitleRegionPct: 15,
  lumaDiffThreshold: 1, // Unused — luma gate removed, kept for config compatibility.
  minScore: 0.3, // Lower threshold — catch low-confidence text like "Hello" in "Hello World".
  minFrameIntervalMs: 200, // 5fps time gate — faster cue detection for short subtitles.
  maxRetries: 3,
};

/** Check if enough time has passed since last OCR run (time gate 3fps). T10. */
export function shouldRunByTimeGate(
  currentTimeMs: number,
  lastOcrTimeMs: number | null,
  minIntervalMs: number,
): boolean {
  if (lastOcrTimeMs === null) return true;
  return currentTimeMs - lastOcrTimeMs >= minIntervalMs;
}

/** Text-level dedup — skip if OCR text identical to previous. T10. */
export function textMatchesPrevious(
  currentText: string,
  previousText: string | null,
): boolean {
  if (previousText === null) return false;
  return currentText === previousText;
}

/**
 * Post-process OCR text to restore spaces lost by PaddleOCR.
 * 1. Insert space between CJK and Latin character boundaries.
 * 2. Insert space between lowercase→uppercase Latin transitions,
 *    but only if the preceding lowercase run is ≥3 chars (excludes "WiFi", "4K").
 */
export function restoreSpaces(text: string): string {
  // 1. CJK ↔ Latin boundaries.
  let result = text
    .replace(/([\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff])([A-Za-z])/g, '$1 $2')
    .replace(/([A-Za-z])([\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff])/g, '$1 $2');

  // 2. Lowercase→Uppercase transition: insert space if preceding run ≥3 lowercase chars.
  //    "TokyoStation" → "Tokyo Station" (Tokyo=4 chars ✓)
  //    "WiFi" → "WiFi" (Wi=2 chars ✗, preserved)
  result = result.replace(/([a-z]{3,})([A-Z])/g, '$1 $2');

  return result;
}

/** OCR pipeline state — tracks previous frame for dedup. */
export class OcrPipelineState {
  private previousLuma: number | null = null;
  private previousHash: string | null = null;
  private previousText: string | null = null;
  private lastOcrTimeMs: number | null = null;
  private drmDetected = false;
  private consecutiveDrmCount = 0;
  private frameCount = 0;

  /** Reset state (e.g. on video change). */
  reset(): void {
    this.previousLuma = null;
    this.previousHash = null;
    this.previousText = null;
    this.lastOcrTimeMs = null;
    this.drmDetected = false;
    this.consecutiveDrmCount = 0;
    this.frameCount = 0;
  }

  /** Mark DRM detected — pipeline should abort. */
  markDrm(): void {
    this.drmDetected = true;
  }

  isDrmDetected(): boolean {
    return this.drmDetected;
  }

  /** Increment frame counter (called each pipeline step). */
  incrementFrameCount(): void {
    this.frameCount++;
  }

  /** Get current frame count. */
  getFrameCount(): number {
    return this.frameCount;
  }

  /** Increment consecutive DRM-dark-frame counter. */
  incrementDrmCount(): void {
    this.consecutiveDrmCount++;
  }

  /** Reset consecutive DRM counter (called when a non-dark frame is seen). */
  resetDrmCount(): void {
    this.consecutiveDrmCount = 0;
  }

  /** Get consecutive DRM-dark-frame count. */
  getConsecutiveDrmCount(): number {
    return this.consecutiveDrmCount;
  }

  getPreviousLuma(): number | null {
    return this.previousLuma;
  }

  setPreviousLuma(luma: number): void {
    this.previousLuma = luma;
  }

  getPreviousHash(): string | null {
    return this.previousHash;
  }

  setPreviousHash(hash: string): void {
    this.previousHash = hash;
  }

  getPreviousText(): string | null {
    return this.previousText;
  }

  setPreviousText(text: string | null): void {
    this.previousText = text;
  }

  getLastOcrTimeMs(): number | null {
    return this.lastOcrTimeMs;
  }

  setLastOcrTimeMs(timeMs: number): void {
    this.lastOcrTimeMs = timeMs;
  }
}

/** Pipeline step result — what happened in this frame. */
export type PipelineStepResult =
  | { readonly status: 'ocr'; readonly results: readonly OcrResultItem[]; readonly scriptRuns: readonly ScriptRun[][] }
  | { readonly status: 'subtitle_gone' }
  | { readonly status: 'skip_text_duplicate' }
  | { readonly status: 'skip_time_gate' }
  | { readonly status: 'drm_detected'; readonly meanLuma: number }
  | { readonly status: 'error'; readonly error: string; readonly attempts: number };

/**
 * Run one pipeline step on a captured frame.
 * 1. Time gate — skip if too soon since last OCR.
 * 2. DRM guard — if black frame, abort.
 * 3. Crop subtitle region → OCR (with retry T22).
 * 4. If empty results → subtitle_gone (clear overlay, reset text state).
 * 5. If same text as previous → skip_text_duplicate.
 * 6. If new text → return OCR results.
 *
 * Luma/pHash gates removed for accuracy: they were too insensitive to detect
 * text changes between cues (white-on-black text has similar luma regardless
 * of content). The processing lock in OcrSession prevents concurrent OCR
 * calls, so every frame that passes the time gate gets OCR'd directly.
 *
 * @param image Full video frame.
 * @param recognizeFn OCR function (from OcrController.recognize).
 * @param state Pipeline state (tracks previous frame).
 * @param config Pipeline config.
 * @param frameTimeMs Current frame time in ms (for time gate).
 */
export async function runPipelineStep(
  image: ImageSource,
  recognizeFn: (image: ImageSource, minScore?: number) => Promise<OcrResult[]>,
  state: OcrPipelineState,
  config: OcrPipelineConfig = DEFAULT_PIPELINE_CONFIG,
  frameTimeMs: number = performance.now(),
): Promise<PipelineStepResult> {
  // 1. Time gate — skip if too soon since last OCR.
  if (!shouldRunByTimeGate(frameTimeMs, state.getLastOcrTimeMs(), config.minFrameIntervalMs)) {
    return { status: 'skip_time_gate' };
  }

  state.incrementFrameCount();

  // 2. DRM guard — check full frame. Require 3 consecutive dark frames
  //    after a 60-frame warmup to avoid false positives from transitional/black
  //    frames at video start. ponytail: ceiling = 10s black intro, upgrade to
  //    content-aware DRM fingerprinting if real DRM content is encountered.
  const drmCheck = checkDrmGuard(image);
  if (drmCheck.isDrm) {
    if (state.getFrameCount() >= 60) {
      state.incrementDrmCount();
      if (state.getConsecutiveDrmCount() >= 3) {
        state.markDrm();
        return { status: 'drm_detected', meanLuma: drmCheck.meanLuma };
      }
    }
  } else {
    state.resetDrmCount();
  }

  // 3. Crop subtitle region.
  const region = computeSubtitleRegion(image.width, image.height, config.subtitleRegionPct);
  const cropped = cropImage(image, region);

  // 4. OCR with retry. T22.
  let ocrResults: OcrResult[] | null = null;
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      ocrResults = await recognizeFn(cropped, config.minScore);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === config.maxRetries) break;
    }
  }
  if (ocrResults === null) {
    return { status: 'error', error: lastError ?? 'unknown', attempts: config.maxRetries };
  }

  // 5. Script-run segment each OCR item's text (with space restoration).
  const allItems: OcrResultItem[] = [];
  const allScriptRuns: ScriptRun[][] = [];
  for (const result of ocrResults) {
    for (const item of result.items) {
      const restoredText = restoreSpaces(item.text);
      allItems.push({ ...item, text: restoredText });
      allScriptRuns.push([...scriptRunSegmenter(restoredText)]);
    }
  }

  // 6. Empty results → subtitle disappeared from frame.
  //    Clear overlay + reset text state so next cue is detected as new.
  const currentText = allItems.map(i => i.text).join(' ');
  if (allItems.length === 0) {
    state.setLastOcrTimeMs(frameTimeMs);
    state.setPreviousText(null);
    return { status: 'subtitle_gone' };
  }

  // 7. Text-level dedup — skip if OCR text identical to previous. T10.
  if (textMatchesPrevious(currentText, state.getPreviousText())) {
    state.setLastOcrTimeMs(frameTimeMs);
    return { status: 'skip_text_duplicate' };
  }

  // 8. New text detected — update state.
  state.setPreviousText(currentText);
  state.setLastOcrTimeMs(frameTimeMs);

  return { status: 'ocr', results: allItems, scriptRuns: allScriptRuns };
}
