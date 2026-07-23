export const PRIORITY_VIEWPORT = 0;
export const PRIORITY_PREPARE = 5; // tokenization before bind; must not be gated on idle
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
      cancelAnimationFrameSafe(this.scheduledFrameId);
      cancelIdleCallbackSafe(this.scheduledFrameId);
      clearTimeout(this.scheduledFrameId);
      this.scheduledFrameId = undefined;
    }
  }

  /** Drop all pending tasks without running them. Used during disable to prevent stale binds. */
  clear(): void { this.queue = []; }

  /** Process all pending tasks synchronously until the queue is empty. Test helper. */
  async flush(): Promise<void> {
    this.stop();
    this.running = true;
    await this.runLoop({ timeRemaining: () => Number.MAX_SAFE_INTEGER }, Number.MAX_SAFE_INTEGER);
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
    const frontPriority = this.queue[0]!.priority;
    // Viewport + prepare tasks must run in the next frame, NOT gated on browser
    // idle. requestIdleCallback only fires when the browser is idle, which
    // during fast scrolling can be delayed by seconds — making tokenize feel
    // frozen until the user stops scrolling. Buffer/idle tasks stay on the
    // idle callback so they don't compete with scroll/paint.
    if (frontPriority < PRIORITY_BUFFER) {
      // Use requestAnimationFrame for viewport/prepare work so each chunk is
      // tied to a display frame. This keeps the UI responsive (one frame per
      // ~16ms budget) and avoids starving timers the way a setTimeout(0) loop
      // can on a long queue of synchronous DOM binds.
      this.scheduledFrameId = window.requestAnimationFrame(() => {
        const start = performance.now();
        const fastBudget = 16; // ms per viewport/prepare chunk
        void this.runLoop({ timeRemaining: () => fastBudget - (performance.now() - start) }, PRIORITY_BUFFER);
      });
    } else if (typeof requestIdleCallback === 'function') {
      this.scheduledFrameId = requestIdleCallback((deadline) => {
        void this.runLoop({ timeRemaining: () => deadline.timeRemaining() }, Number.MAX_SAFE_INTEGER);
      });
    } else {
      const start = performance.now();
      const budget = 50; // ms fallback budget per chunk (idle-but-responsive)
      this.scheduledFrameId = window.setTimeout(() => {
        void this.runLoop({ timeRemaining: () => budget - (performance.now() - start) }, Number.MAX_SAFE_INTEGER);
      }, 1);
    }
  }

  private async runLoop(budget: TimeBudget, maxPriority: number): Promise<void> {
    while (this.queue.length > 0 && budget.timeRemaining() > 1) {
      const next = this.queue[0]!;
      if (next.priority >= maxPriority) break; // leave lower-priority tasks for their own frame
      const task = this.queue.shift()!;
      try {
        const result = task.fn();
        if (result instanceof Promise) {
          await result;
          if (budget.timeRemaining() <= 1) break;
        }
      } catch (err) {
        // ponytail: a single failing task must not hang the scheduler. Log and
        // continue so other blocks still bind/unbind (e.g. SPA re-render left a
        // detached source node that replaceChild would throw on).
        console.error('[TokenizeScheduler] task failed:', err);
      }
    }
    if (this.running && this.queue.length > 0) {
      this.scheduleFrame();
    } else {
      this.running = false;
    }
  }
}

function cancelAnimationFrameSafe(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
  }
}

function cancelIdleCallbackSafe(handle: number): void {
  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(handle);
  }
}
