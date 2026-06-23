import type { DownloadItem, DownloadProgress } from '@/types/media';
import {
  DEFAULT_CONCURRENT_DOWNLOADS,
  MAX_CONCURRENT_DOWNLOADS,
  MIN_CONCURRENT_DOWNLOADS,
} from '@/constants/config';

/**
 * Function that processes a single download item. Resolves on success and
 * rejects on failure. The queue calls `updateProgress` to track progress.
 */
export type DownloadExecutor = (item: DownloadItem) => Promise<void>;

type ProgressListener = (progress: DownloadProgress) => void;

/**
 * Manages a queue of concurrent downloads. Limits the number of downloads
 * running in parallel to `maxConcurrent` and notifies subscribers of progress.
 */
export class DownloadQueue {
  private items: Map<string, DownloadItem> = new Map();
  private maxConcurrent: number;
  private activeCount = 0;
  private executor: DownloadExecutor | null = null;
  private listeners: Set<ProgressListener> = new Set();

  constructor(maxConcurrent?: number) {
    this.maxConcurrent = this.clampConcurrent(
      maxConcurrent ?? DEFAULT_CONCURRENT_DOWNLOADS,
    );
  }

  /** Set the executor function that processes each download. */
  setExecutor(executor: DownloadExecutor): void {
    this.executor = executor;
    this.processNext();
  }

  /** Add a single download item to the queue. */
  add(item: DownloadItem): void {
    this.items.set(item.id, { ...item, status: 'queued', progress: 0 });
    this.processNext();
  }

  /** Add multiple download items (e.g. for "Download All"). */
  addAll(items: DownloadItem[]): void {
    for (const item of items) {
      this.items.set(item.id, { ...item, status: 'queued', progress: 0 });
    }
    this.processNext();
  }

  /** Cancel a download by id. */
  cancel(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    if (item.status === 'downloading') {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
    this.items.set(id, { ...item, status: 'cancelled' });
    this.processNext();
  }

  /** Pause a download by id. */
  pause(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    if (item.status === 'downloading') {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
    this.items.set(id, { ...item, status: 'paused' });
  }

  /** Resume a paused download. */
  resume(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    if (item.status !== 'paused') return;

    this.items.set(id, { ...item, status: 'queued' });
    this.processNext();
  }

  /** Get all download items. */
  getAll(): DownloadItem[] {
    return Array.from(this.items.values());
  }

  /** Get a download item by id. */
  getById(id: string): DownloadItem | undefined {
    return this.items.get(id);
  }

  /** Update progress for a download item (called by the executor). */
  updateProgress(progress: DownloadProgress): void {
    const item = this.items.get(progress.itemId);
    if (!item) return;

    this.items.set(progress.itemId, {
      ...item,
      progress: progress.progress,
      status: progress.status,
      error: progress.error,
    });

    for (const listener of this.listeners) {
      listener(progress);
    }
  }

  /** Subscribe to progress updates. Returns an unsubscribe function. */
  onProgress(callback: ProgressListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /** Set the maximum number of concurrent downloads (clamped to min/max). */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = this.clampConcurrent(max);
    this.processNext();
  }

  /** Get the current maximum concurrent downloads. */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Process the next queued items while there is capacity. Extracted as a
   * public method so tests can drive the queue deterministically.
   */
  processNext(): void {
    if (!this.executor) return;

    while (this.activeCount < this.maxConcurrent) {
      const next = this.findNextQueued();
      if (!next) break;

      this.items.set(next.id, { ...next, status: 'downloading', startedAt: Date.now() });
      this.activeCount += 1;

      const itemSnapshot = this.items.get(next.id)!;
      const executor = this.executor;

      executor(itemSnapshot)
        .then(() => {
          const current = this.items.get(next.id);
          if (current && current.status !== 'cancelled') {
            this.items.set(next.id, {
              ...current,
              status: 'done',
              progress: 100,
              completedAt: Date.now(),
            });
          }
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.processNext();
        })
        .catch((err: unknown) => {
          const current = this.items.get(next.id);
          if (current && current.status !== 'cancelled') {
            this.items.set(next.id, {
              ...current,
              status: 'error',
              error: err instanceof Error ? err.message : String(err),
            });
          }
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.processNext();
        });
    }
  }

  /** Find the next item with status "queued" (insertion order preserved). */
  private findNextQueued(): DownloadItem | undefined {
    for (const item of this.items.values()) {
      if (item.status === 'queued') return item;
    }
    return undefined;
  }

  /** Clamp a candidate value to the allowed concurrent range. */
  private clampConcurrent(value: number): number {
    if (Number.isNaN(value)) return DEFAULT_CONCURRENT_DOWNLOADS;
    return Math.min(
      MAX_CONCURRENT_DOWNLOADS,
      Math.max(MIN_CONCURRENT_DOWNLOADS, Math.floor(value)),
    );
  }
}
