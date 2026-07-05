// batchProcessor — accumulate + flush at 5000 (ADR-023 D8, spec F7).
//
// Memory bounded: 5000 entries in buffer, 1 IDB transaction per flush.
// Streaming parse yields 1 entry at a time → batch → flush → memory ~5000.

/** Batch size — 5000 entries per IDB transaction (spec F7). */
export const BATCH_SIZE = 5000;

/** Flush callback — receives batch, writes to repository. */
export type FlushCallback<T> = (batch: ReadonlyArray<T>) => Promise<void>;

/** Batch processor — accumulate entries, flush at BATCH_SIZE or on demand. */
export class BatchProcessor<T> {
  private buffer: T[] = [];
  private totalProcessed = 0;
  private readonly flushCallback: FlushCallback<T>;
  private readonly onProgress?: (processed: number) => void;

  constructor(flushCallback: FlushCallback<T>, onProgress?: (processed: number) => void) {
    this.flushCallback = flushCallback;
    this.onProgress = onProgress;
  }

  /** Add an entry. Auto-flush when buffer reaches BATCH_SIZE. */
  async add(entry: T): Promise<void> {
    this.buffer.push(entry);
    if (this.buffer.length >= BATCH_SIZE) {
      await this.flush();
    }
  }

  /** Flush remaining buffer (call at end of stream). */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    await this.flushCallback(batch);
    this.totalProcessed += batch.length;
    this.onProgress?.(this.totalProcessed);
  }

  /** Total entries processed (flushed). */
  get count(): number {
    return this.totalProcessed;
  }

  /** Current buffer size (not yet flushed). */
  get pending(): number {
    return this.buffer.length;
  }
}
