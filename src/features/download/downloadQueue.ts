import type { DownloadItem, DownloadProgress } from '@/entities/media';
import {
  DEFAULT_CONCURRENT_DOWNLOADS,
  MAX_CONCURRENT_DOWNLOADS,
  MIN_CONCURRENT_DOWNLOADS,
} from '@/shared/config/config';

/**
 * Function that processes a single download item. Resolves on success and
 * rejects on failure. The queue calls `updateProgress` to track progress.
 * The `signal` aborts when the item is cancelled, paused, or removed — the
 * executor should stop in-flight work and reject promptly.
 */
export type DownloadExecutor = (
  item: DownloadItem,
  signal: AbortSignal,
) => Promise<void>;

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
  private controllers: Map<string, AbortController> = new Map();

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

  /**
   * Cancel a download by id. Capacity is released when the executor's promise
   * settles (single decrement in processNext's settle handler) — the abort
   * signal asks the executor to stop in-flight work immediately.
   */
  cancel(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    this.items.set(id, { ...item, status: 'cancelled' });
    this.controllers.get(id)?.abort();
    this.processNext();
  }

  /**
   * Pause a download by id. Like cancel(), the abort signal stops in-flight
   * work, but the settle handler leaves the item 'paused' so resume() can
   * re-queue it.
   */
  pause(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    if (
      item.status !== 'queued' &&
      item.status !== 'downloading' &&
      item.status !== 'converting'
    ) {
      return;
    }

    this.items.set(id, { ...item, status: 'paused' });
    this.controllers.get(id)?.abort();
  }

  /** Resume a paused download. */
  resume(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    if (item.status !== 'paused') return;

    this.items.set(id, { ...item, status: 'queued' });
    this.processNext();
  }

  /**
   * Retry a failed download by resetting its state and re-queuing it.
   * Clears error, resets progress to 0, and sets status back to 'queued'.
   * No-op if the item doesn't exist or isn't in an error/cancelled state.
   */
  retry(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    if (item.status !== 'error' && item.status !== 'cancelled') return;

    this.items.set(id, {
      ...item,
      status: 'queued',
      progress: 0,
      error: undefined,
      downloadProgress: undefined,
      convertProgress: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });
    this.processNext();
  }

  /**
   * Remove a download item from the queue entirely. Used for cleaning up
   * completed or errored downloads from the UI. No-op if the item doesn't
   * exist. An active download is aborted so its in-flight work stops — use
   * `cancel()` first if the item should also be marked 'cancelled'.
   */
  remove(id: string): void {
    this.controllers.get(id)?.abort();
    this.items.delete(id);
  }

  /**
   * Restore a previously-saved download item as-is, preserving its status
   * and progress. Used to restore state from session storage after a
   * service worker restart. Unlike {@link add}, this does NOT reset status
   * to 'queued' or progress to 0. Restored 'queued' items are dispatched
   * normally (no-op when no executor is registered yet — setExecutor calls
   * processNext itself).
   */
  restore(item: DownloadItem): void {
    this.items.set(item.id, item);
    this.processNext();
  }

  /** Get all download items. */
  getAll(): DownloadItem[] {
    return Array.from(this.items.values());
  }

  /** Get all download items for a specific tab. */
  getByTab(tabId: number): DownloadItem[] {
    return Array.from(this.items.values()).filter((item) => item.tabId === tabId);
  }

  /** Get a download item by id. */
  getById(id: string): DownloadItem | undefined {
    return this.items.get(id);
  }

  /**
   * Remove all download items for a specific tab. Active downloads are
   * cancelled first so in-flight work stops. Used when a tab is closed.
   */
  removeByTab(tabId: number): void {
    for (const item of this.items.values()) {
      if (item.tabId !== tabId) continue;
      if (item.status === 'downloading' || item.status === 'converting') {
        this.cancel(item.id);
      }
      this.items.delete(item.id);
    }
  }

  /** Update progress for a download item (called by the executor). */
  updateProgress(progress: DownloadProgress): void {
    const item = this.items.get(progress.itemId);
    if (!item) return;
    if (item.status === 'cancelled' || item.status === 'paused') return;

    this.items.set(progress.itemId, {
      ...item,
      progress: progress.progress,
      status: progress.status,
      ...(progress.error !== undefined ? { error: progress.error } : {}),
      ...(progress.fileSize !== undefined ? { fileSize: progress.fileSize } : {}),
      ...(progress.downloadedBytes !== undefined ? { downloadedBytes: progress.downloadedBytes } : {}),
      ...(progress.processedBytes !== undefined ? { processedBytes: progress.processedBytes } : {}),
      ...(progress.conversionPhase !== undefined ? { conversionPhase: progress.conversionPhase } : {}),
      ...(progress.workerCount !== undefined ? { workerCount: progress.workerCount } : {}),
      ...(progress.usedWorkers !== undefined ? { usedWorkers: progress.usedWorkers } : {}),
      ...(progress.downloadProgress !== undefined ? { downloadProgress: progress.downloadProgress } : {}),
      ...(progress.convertProgress !== undefined ? { convertProgress: progress.convertProgress } : {}),
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
      const controller = new AbortController();
      this.controllers.set(next.id, controller);

      executor(itemSnapshot, controller.signal)
        .then(() => {
          const current = this.items.get(next.id);
          if (
            current &&
            current.status !== 'cancelled' &&
            current.status !== 'paused' &&
            current.status !== 'queued'
          ) {
            this.items.set(next.id, {
              ...current,
              status: 'done',
              progress: 100,
              completedAt: Date.now(),
            });
          }
          this.controllers.delete(next.id);
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.processNext();
        })
        .catch((err: unknown) => {
          const current = this.items.get(next.id);
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (
            current &&
            current.status !== 'cancelled' &&
            current.status !== 'paused' &&
            current.status !== 'queued'
          ) {
            this.items.set(next.id, {
              ...current,
              status: 'error',
              error: errorMsg,
            });
            // Notify listeners so the popup sees the error.
            this.updateProgress({
              itemId: next.id,
              status: 'error',
              progress: current.progress,
              error: errorMsg,
            });
          }
          this.controllers.delete(next.id);
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.processNext();
        });
    }
  }

  /** Find the next item with status "queued" (insertion order preserved). */
  private findNextQueued(): DownloadItem | undefined {
    for (const item of this.items.values()) {
      if (item.status === 'queued' && !this.controllers.has(item.id)) {
        return item;
      }
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
