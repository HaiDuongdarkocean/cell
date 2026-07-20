export const PRIORITY_VIEWPORT = 0;
export const PRIORITY_BUFFER = 10;
export const PRIORITY_IDLE = 20;

interface ScheduledTask {
  readonly fn: () => void | Promise<void>;
  readonly priority: number;
  readonly id: number;
}

interface TimeBudget {
  readonly timeRemaining: () => number;
}

/** Idle scheduler for tokenization tasks: viewport > buffer > idle. */
export class TokenizeScheduler {
  private queue: ScheduledTask[] = [];
  private running = false;
  private scheduledFrameId: number | undefined;
  private nextId = 0;

  /** Add a task with a priority. Lower priority runs first. */
  schedule(fn: () => void | Promise<void>, priority: number = PRIORITY_IDLE): () => void {
    const id = this.nextId++;
    const task: ScheduledTask = { fn, priority, id };
    const index = this.queue.findIndex((t) => t.priority > priority || (t.priority === priority && t.id > id));
    if (index === -1) this.queue.push(task);
    else this.queue.splice(index, 0, task);
    this.start();
    return () => {
      this.queue = this.queue.filter((t) => t.id !== id);
    };
  }

  /** Start processing the queue if not already running. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleFrame();
  }

  /** Stop scheduling new frames. Current frame finishes. */
  stop(): void {
    this.running = false;
    if (this.scheduledFrameId !== undefined) {
      cancelIdleCallbackSafe(this.scheduledFrameId);
      clearTimeout(this.scheduledFrameId);
      this.scheduledFrameId = undefined;
    }
  }

  /** Process all pending tasks synchronously until the queue is empty. Test helper. */
  async flush(): Promise<void> {
    this.stop();
    this.running = true;
    await this.runLoop({ timeRemaining: () => Number.MAX_SAFE_INTEGER });
  }

  /** Number of pending tasks. */
  get size(): number {
    return this.queue.length;
  }

  private scheduleFrame(): void {
    if (!this.running) return;
    if (this.queue.length === 0) {
      this.running = false;
      return;
    }
    if (typeof requestIdleCallback === 'function') {
      this.scheduledFrameId = requestIdleCallback((deadline) => {
        void this.runLoop({ timeRemaining: () => deadline.timeRemaining() });
      });
    } else {
      const start = performance.now();
      const budget = 5; // ms fallback budget per chunk
      this.scheduledFrameId = window.setTimeout(() => {
        void this.runLoop({ timeRemaining: () => budget - (performance.now() - start) });
      }, 1);
    }
  }

  private async runLoop(budget: TimeBudget): Promise<void> {
    while (this.queue.length > 0 && budget.timeRemaining() > 1) {
      const task = this.queue.shift();
      if (!task) break;
      const result = task.fn();
      if (result instanceof Promise) {
        await result;
        if (budget.timeRemaining() <= 1) break;
      }
    }
    if (this.running && this.queue.length > 0) {
      this.scheduleFrame();
    } else {
      this.running = false;
    }
  }
}

function cancelIdleCallbackSafe(handle: number): void {
  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(handle);
  }
}
