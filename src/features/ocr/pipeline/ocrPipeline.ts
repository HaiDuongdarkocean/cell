// ocrPipeline — T12. Orchestrates frame → DRM check → luma-diff → crop → OCR → script-run segment.
// spec §AD5: The main video pipeline loop.

import type { ImageSource, OcrResult, OcrResultItem } from '@/features/ocr/engine/types';
import { checkDrmGuard } from './drmGuard';
import { regionMeanLuma, shouldRunOcr, subtitleRegionHash } from './lumaDiff';
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
  lumaDiffThreshold: 3,
  minScore: 0.5,
  minFrameIntervalMs: 333, // 3fps time gate.
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

/** OCR pipeline state — tracks previous frame for dedup. */
export class OcrPipelineState {
  private previousLuma: number | null = null;
  private previousHash: string | null = null;
  private previousText: string | null = null;
  private lastOcrTimeMs: number | null = null;
  private drmDetected = false;

  /** Reset state (e.g. on video change). */
  reset(): void {
    this.previousLuma = null;
    this.previousHash = null;
    this.previousText = null;
    this.lastOcrTimeMs = null;
    this.drmDetected = false;
  }

  /** Mark DRM detected — pipeline should abort. */
  markDrm(): void {
    this.drmDetected = true;
  }

  isDrmDetected(): boolean {
    return this.drmDetected;
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

  setPreviousText(text: string): void {
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
  | { readonly status: 'skip_unchanged' }
  | { readonly status: 'skip_duplicate' }
  | { readonly status: 'skip_text_duplicate' }
  | { readonly status: 'skip_time_gate' }
  | { readonly status: 'drm_detected'; readonly meanLuma: number }
  | { readonly status: 'error'; readonly error: string; readonly attempts: number };

/**
 * Run one pipeline step on a captured frame.
 * 1. Time gate — skip if too soon since last OCR (3fps).
 * 2. DRM guard — if black frame, abort.
 * 3. Compute subtitle region luma — if unchanged, skip.
 * 4. Compute pHash — if duplicate, skip.
 * 5. Crop subtitle region → OCR (with retry T22) → text dedup → script-run segment.
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
  // 1. Time gate — skip if too soon since last OCR (3fps). T10.
  if (!shouldRunByTimeGate(frameTimeMs, state.getLastOcrTimeMs(), config.minFrameIntervalMs)) {
    return { status: 'skip_time_gate' };
  }

  // 2. DRM guard — check full frame.
  const drmCheck = checkDrmGuard(image);
  if (drmCheck.isDrm) {
    state.markDrm();
    return { status: 'drm_detected', meanLuma: drmCheck.meanLuma };
  }

  // 3. Compute subtitle region.
  const region = computeSubtitleRegion(image.width, image.height, config.subtitleRegionPct);
  const currentLuma = regionMeanLuma(image, region);

  // 4. Luma-diff check — skip if subtitle area unchanged.
  if (!shouldRunOcr(currentLuma, state.getPreviousLuma(), config.lumaDiffThreshold)) {
    state.setPreviousLuma(currentLuma);
    return { status: 'skip_unchanged' };
  }

  // 5. pHash dedup — skip if text content identical.
  const currentHash = subtitleRegionHash(image, region);
  if (currentHash === state.getPreviousHash()) {
    state.setPreviousLuma(currentLuma);
    return { status: 'skip_duplicate' };
  }

  // 6. Crop subtitle region.
  const cropped = cropImage(image, region);

  // 7. OCR with retry. T22.
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

  // 8. Script-run segment each OCR item's text.
  const allItems: OcrResultItem[] = [];
  const allScriptRuns: ScriptRun[][] = [];
  for (const result of ocrResults) {
    for (const item of result.items) {
      allItems.push(item);
      allScriptRuns.push([...scriptRunSegmenter(item.text)]);
    }
  }

  // 9. Text-level dedup — skip if OCR text identical to previous. T10.
  const currentText = allItems.map(i => i.text).join(' ');
  if (textMatchesPrevious(currentText, state.getPreviousText())) {
    state.setPreviousLuma(currentLuma);
    state.setLastOcrTimeMs(frameTimeMs);
    return { status: 'skip_text_duplicate' };
  }

  // 10. Update state.
  state.setPreviousLuma(currentLuma);
  state.setPreviousHash(currentHash);
  state.setPreviousText(currentText);
  state.setLastOcrTimeMs(frameTimeMs);

  return { status: 'ocr', results: allItems, scriptRuns: allScriptRuns };
}
