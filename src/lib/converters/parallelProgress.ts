/**
 * Progress phase tracking for parallel conversion.
 *
 * The parallel conversion has distinct phases that should be reported
 * to the user separately from the sequential conversion:
 *
 * 1. planning — policy + safety analysis
 * 2. transmuxing — parallel group transmux (85–95%)
 * 3. merging — part file merge (95–98%)
 * 4. validating — MP4 structure validation (98–99%)
 * 5. done — complete
 *
 * Each phase maps to a percentage range so the UI progress bar moves
 * smoothly even though the actual work distribution is uneven.
 */

export type ParallelConversionPhase =
  | 'planning'
  | 'transmuxing'
  | 'merging'
  | 'validating'
  | 'done';

/** Percentage range for each phase. */
const PHASE_RANGES: Record<ParallelConversionPhase, [number, number]> = {
  planning: [85, 86],
  transmuxing: [86, 95],
  merging: [95, 98],
  validating: [98, 99],
  done: [99, 100],
};

/**
 * Map a phase + intra-phase progress (0–1) to an overall percentage.
 */
export function phaseToPercent(
  phase: ParallelConversionPhase,
  intraPhaseProgress: number = 0,
): number {
  const [start, end] = PHASE_RANGES[phase];
  const clamped = Math.max(0, Math.min(1, intraPhaseProgress));
  return Math.floor(start + (end - start) * clamped);
}

/**
 * Get the phase label for UI display.
 */
export function phaseLabel(phase: ParallelConversionPhase): string {
  const labels: Record<ParallelConversionPhase, string> = {
    planning: 'Planning parallel conversion',
    transmuxing: 'Converting segments in parallel',
    merging: 'Merging converted parts',
    validating: 'Validating output',
    done: 'Done',
  };
  return labels[phase];
}

/**
 * Track progress through parallel conversion phases.
 *
 * Usage:
 * ```ts
 * const tracker = new ParallelProgressTracker(onProgress);
 * tracker.start('transmuxing');
 * tracker.update(0.5); // 50% through transmuxing
 * tracker.start('merging');
 * tracker.done();
 * ```
 */
export class ParallelProgressTracker {
  private currentPhase: ParallelConversionPhase = 'planning';
  private currentProgress: number = 0;

  constructor(
    private readonly onProgress?: (percent: number, phase: ParallelConversionPhase) => void,
  ) {
    this.report();
  }

  /** Move to a new phase. Resets intra-phase progress to 0. */
  start(phase: ParallelConversionPhase): void {
    this.currentPhase = phase;
    this.currentProgress = 0;
    this.report();
  }

  /** Update intra-phase progress (0–1). */
  update(progress: number): void {
    this.currentProgress = progress;
    this.report();
  }

  /** Mark conversion as done (100%). */
  done(): void {
    this.currentPhase = 'done';
    this.currentProgress = 1;
    this.report();
  }

  /** Get the current overall percentage. */
  get percent(): number {
    return phaseToPercent(this.currentPhase, this.currentProgress);
  }

  /** Get the current phase. */
  get phase(): ParallelConversionPhase {
    return this.currentPhase;
  }

  private report(): void {
    this.onProgress?.(this.percent, this.currentPhase);
  }
}
