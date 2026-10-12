// batchProcessor — accumulate + flush at BATCH_SIZE (ADR-023 D8, spec F7).
//
// Memory bounded: BATCH_SIZE entries in buffer, 1 IDB transaction per flush.
// Streaming parse yields 1 entry at a time → batch → flush → memory ~BATCH_SIZE.
// A filled batch waits for the in-flight write before its own transaction is
// created: IDB serializes same-scope transactions FIFO by creation order, so
// creating the next write tx while the previous one runs would make every
// lookup read tx queue behind BOTH writes instead of interleaving in the gap.

/** Batch size — 2000 entries per IDB transaction (spec F7). */
export const BATCH_SIZE = 2000;

/** Flush callback — receives batch, writes to repository. */
export type FlushCallback<T> = (batch: ReadonlyArray<T>) => Promise<void>;

/** Batch processor — accumulate entries, flush at BATCH_SIZE or on demand. */
export class BatchProcessor<T> {
  private buffer: T[] = [];
  private totalProcessed = 0;
  private total = 0;
  private inflight: Promise<void> | null = null;
  private inflightError: unknown = null;
  private readonly flushCallback: FlushCallback<T>;
  private readonly onProgress?: (processed: number, total: number) => void;

  constructor(flushCallback: FlushCallback<T>, onProgress?: (processed: number, total: number) => void) {
    this.flushCallback = flushCallback;
    this.onProgress = onProgress;
  }

  /** Set the exact attempted-entry total once known (0 = unknown). */
  setTotal(total: number): void {
    this.total = Math.max(0, total);
  }

  /** Add an entry. Auto-flush when buffer reaches BATCH_SIZE: this add awaits
   *  the in-flight flush BEFORE the next write transaction is created — read
   *  transactions queued during write N then interleave in the gap before
   *  write N+1 instead of queueing behind it. The buffer keeps filling while
   *  a flush is in flight; ordering stays strict (flushCallbacks invoke in
   *  batch order, and IDB serializes same-store readwrite transactions). */
  async add(entry: T): Promise<void> {
    if (this.inflightError !== null) throw this.inflightError;
    this.buffer.push(entry);
    if (this.buffer.length < BATCH_SIZE) return;
    await this.inflight;
    this.startFlush();
  }

  /** Drain the in-flight write + flush remaining buffer (call at end of stream). */
  async flush(): Promise<void> {
    await this.inflight;
    this.inflight = null;
    if (this.inflightError !== null) throw this.inflightError;
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    await this.writeBatch(batch);
  }

  private startFlush(): void {
    const batch = this.buffer;
    this.buffer = [];
    if (batch.length === 0) return;
    const writing = this.writeBatch(batch);
    writing.catch((err: unknown) => {
      this.inflightError = err;
    });
    this.inflight = writing;
  }

  private async writeBatch(batch: ReadonlyArray<T>): Promise<void> {
    await this.flushCallback(batch);
    this.totalProcessed += batch.length;
    this.onProgress?.(this.totalProcessed, this.total);
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
