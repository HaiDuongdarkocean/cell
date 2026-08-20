// ocrCache — T11. LRU cache cho OCR results by (videoId, timestampBucket).
// spec §AD5: Avoid re-OCR same frame. LRU eviction max 100 entries.

import type { OcrResultItem } from '@/features/ocr/engine/types';
import type { ScriptRun } from '../language/scriptRunSegmenter';

/** Cache entry — OCR results + script runs for one timestamp bucket. */
export interface OcrCacheEntry {
  readonly items: readonly OcrResultItem[];
  readonly scriptRuns: readonly ScriptRun[][];
  readonly timestamp: number;
}

/** Bucket a timestamp (ms) into buckets of bucketMs size. */
export function bucketTimestamp(timeMs: number, bucketMs = 1000): number {
  return Math.floor(timeMs / bucketMs) * bucketMs;
}

/** Build cache key from videoId + timestampBucket. */
export function buildCacheKey(videoId: string, timestampBucket: number): string {
  return `${videoId}:${timestampBucket}`;
}

/** Compute videoId from video.src + duration (hash 16 chars).
 *  YouTube: extract videoId from URL. Otherwise: hash(src + duration). */
export function computeVideoId(video: { src: string; duration: number }): string {
  // YouTube URL patterns: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = video.src.match(/[?&]v=([^&]+)/) ?? video.src.match(/youtu\.be\/([^?&]+)/);
  if (ytMatch && ytMatch[1]) return ytMatch[1];

  // Hash src + duration → 16 chars (FNV-1a 32-bit, hex).
  const input = `${video.src}:${video.duration}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + ((Math.imul(hash, 0x85ebca6b) >>> 0).toString(16).padStart(8, '0'));
}

/** LRU cache for OCR results. Max 100 entries. */
export class OcrCache {
  private cache = new Map<string, OcrCacheEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  /** Get cached entry. Returns undefined if miss. Moves to end (LRU). */
  get(videoId: string, timestampBucket: number): OcrCacheEntry | undefined {
    const key = buildCacheKey(videoId, timestampBucket);
    const entry = this.cache.get(key);
    if (entry) {
      // LRU: delete + re-insert to move to end (most recently used).
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
    return entry;
  }

  /** Set cache entry. Evicts oldest if over max. */
  set(videoId: string, timestampBucket: number, entry: OcrCacheEntry): void {
    const key = buildCacheKey(videoId, timestampBucket);
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first entry in Map = least recently used).
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, entry);
  }

  /** Clear all entries for a videoId. */
  clear(videoId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${videoId}:`)) this.cache.delete(key);
    }
  }

  /** Clear all entries. */
  clearAll(): void {
    this.cache.clear();
  }

  /** Current cache size. */
  get size(): number {
    return this.cache.size;
  }
}
