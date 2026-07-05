/**
 * Background prefill controller — sequential translation queue + cache + guards (ADR-021).
 *
 * Lifecycle:
 *  1. start(targetCues, sl, tl) on video 'play' event + autoTranslate ON + no native track
 *  2. Chunks cues by 1500 chars, translates sequentially with 1.5s gap
 *  3. Caches each cue (Map<cueIndex, string>), feeds loadBilingualCues on each chunk
 *  4. Guards: pause on tab hidden, resume on visible; clear on SPA nav
 *  5. Seek → cache hit instant / miss → chunk [seekIdx, +1500 chars], resume sequential
 *  6. Backoff 1s→2s→4s on 429/empty, give up + toast after MAX_RETRIES
 */

import type { SrtCue } from '@/entities/media';
import { chunkCuesByCharBudget, buildSequentialIndices } from './translateChunker';
import { joinCueTexts, alignTranslatedSegments } from '../service/translateService';

/** Hardcode params (ADR-021 D3 — 0 setting, kim chỉ nam "user vào và học thôi"). */
export const CHAR_BUDGET = 1500;
export const MIN_REQUEST_GAP_MS = 1500;
export const MAX_RETRIES = 3;
export const BACKOFF_BASE_MS = 1000; // 1s → 2s → 4s

/** Translate function — injectable for testing (real impl sends TRANSLATE message to background). */
export type TranslateFn = (text: string, sl: string, tl: string) => Promise<string[]>;

/** Callback when a chunk completes — feeds loadBilingualCues with updated translated cues. */
export type OnChunkTranslated = (translatedCues: SrtCue[]) => void;

/** Callback when translation fails permanently (after MAX_RETRIES). */
export type OnError = (message: string) => void;

/** Controller shape for feeding translated cues back to overlay. */
export interface PrefillController {
  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void;
}

export interface PrefillOptions {
  readonly translate: TranslateFn;
  readonly onChunkTranslated: OnChunkTranslated;
  readonly onError?: OnError;
  readonly charBudget?: number;
  readonly requestGapMs?: number;
  readonly maxRetries?: number;
  readonly backoffBaseMs?: number;
}

/**
 * Background sequential prefill controller (ADR-021 D1).
 *
 * Stateful: manages queue, cache, guards. One instance per video session.
 * Clear on SPA nav (caller invokes clear()).
 */
export class BackgroundPrefillController {
  private readonly cache = new Map<number, string>();
  private targetCues: SrtCue[] = [];
  private sl = '';
  private tl = '';
  private queue: number[][] = [];
  private queueIdx = 0;
  private running = false;
  private paused = false;
  private cancelled = false;
  private readonly opts: Required<PrefillOptions>;

  constructor(opts: PrefillOptions) {
    this.opts = {
      translate: opts.translate,
      onChunkTranslated: opts.onChunkTranslated,
      onError: opts.onError ?? (() => {}),
      charBudget: opts.charBudget ?? CHAR_BUDGET,
      requestGapMs: opts.requestGapMs ?? MIN_REQUEST_GAP_MS,
      maxRetries: opts.maxRetries ?? MAX_RETRIES,
      backoffBaseMs: opts.backoffBaseMs ?? BACKOFF_BASE_MS,
    };
  }

  /** Start prefill from cue 0 (or from seekIdx if provided). Idempotent — no-op if already running. */
  start(targetCues: SrtCue[], sl: string, tl: string, seekIdx: number = 0): void {
    if (this.running) return;
    this.targetCues = targetCues;
    this.sl = sl;
    this.tl = tl;
    this.cancelled = false;
    this.paused = false;
    this.queue = chunkCuesByCharBudget(targetCues, buildSequentialIndices(targetCues.length, seekIdx), this.opts.charBudget);
    this.queueIdx = 0;
    this.running = true;
    void this.run();
  }

  /** Seek — if cache has seekIdx, instant. Otherwise restart prefill from seekIdx. */
  seek(seekIdx: number): boolean {
    if (this.cache.has(seekIdx)) return true; // instant
    if (!this.running) return false;
    // Restart from seekIdx — cancel current queue, rebuild from seekIdx
    this.cancelled = true;
    this.running = false;
    this.start(this.targetCues, this.sl, this.tl, seekIdx);
    return false;
  }

  /** Pause queue (tab hidden). Resumable. */
  pause(): void {
    this.paused = true;
  }

  /** Resume queue (tab visible). */
  resume(): void {
    this.paused = false;
  }

  /** Clear cache + cancel queue (SPA nav). */
  clear(): void {
    this.cancelled = true;
    this.running = false;
    this.paused = false;
    this.cache.clear();
    this.queue = [];
    this.queueIdx = 0;
    this.targetCues = [];
  }

  /** Check if a cue index is cached (instant seek). */
  has(index: number): boolean {
    return this.cache.has(index);
  }

  /** Get cached translation for a cue (or undefined). */
  get(index: number): string | undefined {
    return this.cache.get(index);
  }

  /** Build translated cues array (cache hits → text, misses → empty text). */
  getTranslatedCues(): SrtCue[] {
    return this.targetCues.map((c, i) => ({
      ...c,
      text: this.cache.get(i) ?? '',
    }));
  }

  /** Is prefill currently running? */
  get isRunning(): boolean {
    return this.running;
  }

  /** Number of cached cues (for testing/diagnostics). */
  get cacheSize(): number {
    return this.cache.size;
  }

  /** Main loop — process chunks sequentially with gap + backoff. */
  private async run(): Promise<void> {
    while (this.queueIdx < this.queue.length && !this.cancelled) {
      // Wait while paused (tab hidden)
      while (this.paused && !this.cancelled) {
        await sleep(200);
      }
      if (this.cancelled) break;

      const chunk = this.queue[this.queueIdx];
      if (!chunk) break;

      const texts = chunk.map((i) => this.targetCues[i]?.text ?? '');
      const joined = joinCueTexts(texts);

      let success = false;
      for (let attempt = 0; attempt < this.opts.maxRetries; attempt++) {
        if (this.cancelled) return;
        try {
          const translated = await this.opts.translate(joined, this.sl, this.tl);
          const aligned = alignTranslatedSegments(translated, chunk.length);
          chunk.forEach((cueIdx, j) => {
            this.cache.set(cueIdx, aligned[j] ?? '');
          });
          success = true;
          break;
        } catch {
          // Backoff: 1s → 2s → 4s (configurable for tests)
          const backoff = this.opts.backoffBaseMs * Math.pow(2, attempt);
          await sleep(backoff);
        }
      }

      if (!success) {
        this.opts.onError('Translation temporarily unavailable (Google rate-limit).');
        this.running = false;
        return;
      }

      // Feed updated translated cues to overlay
      this.opts.onChunkTranslated(this.getTranslatedCues());

      this.queueIdx++;
      // Gap between requests (except after last chunk)
      if (this.queueIdx < this.queue.length && !this.cancelled) {
        await sleep(this.opts.requestGapMs);
      }
    }
    this.running = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
