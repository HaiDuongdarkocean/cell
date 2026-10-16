// batchProcessor — accumulate + flush at BATCH_SIZE (ADR-023 D8, spec F7).
//
// Memory bounded: BATCH_SIZE entries in buffer, 1 IDB transaction per flush.
// Streaming parse yields 1 entry at a time → batch → flush → memory ~BATCH_SIZE.
// A filled batch waits for the in-flight write before its own transaction is
// created: IDB serializes same-scope transactions FIFO by creation order, so
// creating the next write tx while the previous one runs would make every
// lookup read tx queue behind BOTH writes instead of interleaving in the gap.

/** Max entries per IDB transaction (spec F7). The effective batch adapts
 *  downward from this based on measured commit time — a 2000-row commit is
 *  ~280ms on desktop and worse on weak devices, which stalls every read tx
 *  on the same database behind the write-batch apply. */
export const BATCH_SIZE = 2000;

/** Commit-time budget per write tx — keeps lookup tail latency ≪300ms. */
const COMMIT_TARGET_MS = 45;
const BATCH_MIN = 64;

/** Pause between the previous write commit and the next write-tx creation.
 *  A read tx only interleaves if it is created before write N+1 — and the
 *  importer creates N+1 within microseconds of N committing, so reads from
 *  the service worker almost never win the race without a deliberate gap.
 *  32ms per batch ≈ +2s on a 45s import; bounds lookup stall to
 *  one gap instead of one ~1s batch commit on slow storage. */
const READ_INTERLEAVE_MS = 32;

/** Flush callback — receives batch, writes to repository. */
export type FlushCallback<T> = (batch: ReadonlyArray<T>) => Promise<void>;

/** Batch processor — accumulate entries, flush at the adaptive batch size or
 *  on demand. */
export class BatchProcessor<T> {
  private buffer: T[] = [];
  private totalProcessed = 0;
  private total = 0;
  private inflight: Promise<void> | null = null;
  private inflightError: unknown = null;
  private batchSize = BATCH_MIN;
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
    while (this.buffer.length >= this.batchSize) {
      const prior = this.inflight;
      if (prior === null) {
        this.startFlush();
        continue;
      }
      await prior;
      if (this.inflightError !== null) throw this.inflightError;
      // Another waiter already drove the next flush — just re-check fill.
      if (this.inflight !== prior) continue;
      if (this.buffer.length < this.batchSize) break;
      await new Promise((r) => setTimeout(r, READ_INTERLEAVE_MS));
      this.startFlush();
    }
  }

  /** Drain the in-flight write + flush remaining buffer (call at end of stream). */
  async flush(): Promise<void> {
    await this.inflight;
    this.inflight = null;
    if (this.inflightError !== null) throw this.inflightError;
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.batchSize);
      await this.writeBatch(batch);
    }
  }

  private startFlush(): void {
    // splice caps the write tx at the adaptive size even when the producer
    // outruns the writer — a giant commit would stall every read on the DB.
    const batch = this.buffer.splice(0, this.batchSize);
    if (batch.length === 0) return;
    const writing = this.writeBatch(batch);
    writing.catch((err: unknown) => {
      this.inflightError = err;
    });
    this.inflight = writing;
  }

  private async writeBatch(batch: ReadonlyArray<T>): Promise<void> {
    const t0 = performance.now();
    await this.flushCallback(batch);
    const ms = performance.now() - t0;
    // Adaptive: aim for COMMIT_TARGET_MS, but grow at most 2× per flush —
    // a lone fast commit must not jump to a multi-hundred-ms batch that a
    // slow patch then turns into a ~1s stall; shrink is unconstrained.
    const predicted = Math.round((batch.length * COMMIT_TARGET_MS) / Math.max(ms, 1));
    this.batchSize = Math.min(
      BATCH_SIZE,
      batch.length * 2,
      Math.max(BATCH_MIN, predicted),
    );
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
