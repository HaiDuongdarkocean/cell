/**
 * Lightweight conversion phase timing instrumentation.
 *
 * Records duration of each conversion phase (download, write, convert, save,
 * cleanup) so sequential vs future parallel performance can be compared.
 *
 * Usage:
 *   const timer = new ConversionTimer(downloadId);
 *   timer.start('convert');
 *   ... do conversion ...
 *   timer.end('convert');
 *   timer.logSummary();
 */

/** Phases tracked during an M3U8 download + conversion lifecycle. */
export type ConversionPhase =
  | 'download'
  | 'write-input'
  | 'convert'
  | 'save'
  | 'cleanup'
  | 'fallback';

interface PhaseRecord {
  startedAt: number;
  durationMs?: number;
}

export class ConversionTimer {
  private readonly downloadId: string;
  private readonly phases = new Map<ConversionPhase, PhaseRecord>();
  private readonly createdAt = performance.now();

  constructor(downloadId: string) {
    this.downloadId = downloadId;
  }

  /** Mark the start of a phase. */
  start(phase: ConversionPhase): void {
    this.phases.set(phase, { startedAt: performance.now() });
  }

  /** Mark the end of a phase and record its duration. */
  end(phase: ConversionPhase): void {
    const record = this.phases.get(phase);
    if (record && record.durationMs === undefined) {
      record.durationMs = Math.round(performance.now() - record.startedAt);
    }
  }

  /** Get the duration of a phase, or undefined if not recorded. */
  getDuration(phase: ConversionPhase): number | undefined {
    return this.phases.get(phase)?.durationMs;
  }

  /** Log a summary of all recorded phases to the console. */
  logSummary(): void {
    const parts: string[] = [];
    for (const [phase, record] of this.phases) {
      if (record.durationMs !== undefined) {
        parts.push(`${phase}=${record.durationMs}ms`);
      }
    }
    const totalMs = Math.round(performance.now() - this.createdAt);
    console.log(
      `[conversion-timer] ${this.downloadId}: ${parts.join(', ')} | total=${totalMs}ms`,
    );
  }
}

