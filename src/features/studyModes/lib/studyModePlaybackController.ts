import type { SrtCue } from '@/entities/media';
import type { StudyMode, StudyModeAdvancedSettings, StudyStep, SubtitleVisibility } from '@/entities/studyMode';

export type PlaybackAction =
  | { type: 'setSubtitle'; subtitle: SubtitleVisibility }
  | { type: 'setSpeed'; speed: number }
  | { type: 'seek'; timeMs: number }
  | { type: 'pause' }
  | { type: 'play' };

type ContinueTarget = 'nextStep' | 'nextCue';

type PlaybackState =
  | { type: 'idle' }
  | { type: 'pausedStart' }
  | { type: 'playing' }
  | { type: 'pausedEnd'; continueTarget: ContinueTarget }
  | { type: 'waiting'; continueTarget: ContinueTarget };

const MAX_LOOPS = 5;

/**
 * Pure playback state machine for a StudyMode.
 *
 * The video owns the clock; the controller consumes current time and cue
 * boundaries and returns a list of side-effect-free actions (set subtitle
 * visibility, speed, seek, pause, play).  Callers are responsible for applying
 * these to the actual HTMLVideoElement / overlay.
 */
export class StudyModePlaybackController {
  private mode: StudyMode;
  private advanced: StudyModeAdvancedSettings;
  private cues: readonly SrtCue[] = [];
  private offsetMs = 0;

  private activeCueIndex = -1;
  private activeCueEnd = 0;
  private stepIndex = 0;
  private repeatRemaining = 1;
  private loopCount = 0;
  private silenceHandledIndex = -1;
  private state: PlaybackState = { type: 'idle' };

  constructor(
    mode: StudyMode,
    advanced: StudyModeAdvancedSettings,
    cues: readonly SrtCue[] = [],
    offsetMs = 0,
  ) {
    this.mode = mode;
    this.advanced = advanced;
    this.cues = cues;
    this.offsetMs = offsetMs;
  }

  get hasActiveCue(): boolean {
    return this.activeCueIndex >= 0;
  }

  get heldCueIndex(): number {
    return this.state.type === 'pausedEnd' || this.state.type === 'waiting'
      ? this.activeCueIndex
      : -1;
  }

  setCues(cues: readonly SrtCue[], offsetMs = this.offsetMs): boolean {
    const active = this.cues[this.activeCueIndex];
    const next = cues[this.activeCueIndex];
    const boundariesChanged =
      offsetMs !== this.offsetMs ||
      !active ||
      !next ||
      active.start !== next.start ||
      active.end !== next.end;
    this.cues = cues;
    this.offsetMs = offsetMs;
    this.silenceHandledIndex = -1;
    if (boundariesChanged) this.abort();
    return boundariesChanged;
  }

  setMode(mode: StudyMode, advanced: StudyModeAdvancedSettings): void {
    this.mode = mode;
    this.advanced = advanced;
    this.activeCueIndex = -1;
    this.silenceHandledIndex = -1;
    this.state = { type: 'idle' };
  }

  abort(): void {
    this.activeCueIndex = -1;
    this.silenceHandledIndex = -1;
    this.state = { type: 'idle' };
  }

  /** Called when the engine reports a new active cue. */
  enterCue(cue: SrtCue, index: number): PlaybackAction[] {
    this.activeCueIndex = index;
    this.activeCueEnd = cue.end - this.offsetMs;
    this.stepIndex = 0;
    this.loopCount = 0;
    this.silenceHandledIndex = -1;
    const step = this.currentStep();
    if (!step) return [];
    this.repeatRemaining = step.repeat;
    return this.applyStepEntry(step);
  }

  /** Called on every video time update (time in milliseconds). */
  onTimeUpdate(currentTimeMs: number, isPaused = false): PlaybackAction[] {
    if (this.activeCueIndex < 0) {
      return this.handleSilence(currentTimeMs);
    }

    if (this.state.type === 'pausedStart' || this.state.type === 'pausedEnd' || this.state.type === 'waiting') {
      return [];
    }

    // A paused video can't reach a cue end by playing — suppressing step-end
    // while paused keeps repeat/advance state from being consumed on mode
    // switches or timeupdate events that fire without playback (e.g. after
    // a seeked event while paused).
    if (isPaused) {
      return [];
    }

    if (currentTimeMs < this.activeCueEnd) {
      return [];
    }

    // Cue has reached its end — process the current step's finish.
    return this.handleStepEnd();
  }

  /** Called when the user resumes playback after an auto-pause. */
  continue(): PlaybackAction[] {
    if (this.state.type === 'pausedStart') {
      this.state = { type: 'playing' };
      return [{ type: 'play' }];
    }

    if (this.state.type === 'pausedEnd' || this.state.type === 'waiting') {
      const target = this.state.continueTarget;
      if (target === 'nextStep') {
        const actions: PlaybackAction[] = [];
        this.stepIndex += 1;
        const step = this.currentStep();
        if (!step) {
          this.activeCueIndex = -1;
          this.state = { type: 'idle' };
          return [{ type: 'play' }];
        }
        this.repeatRemaining = step.repeat;
        if (step.seek !== false) {
          actions.push({ type: 'seek', timeMs: this.cueStartMs() });
          actions.push(...this.applyStepEntry(step));
          return actions;
        }
        actions.push(...this.applyStepEntry(step));
        while (this.processCurrentStepAtEnd(actions));
        return actions;
      }
      this.activeCueIndex = -1;
      this.state = { type: 'idle' };
      return [{ type: 'play' }];
    }

    return [];
  }

  private currentStep(): StudyStep | undefined {
    return this.mode.steps[this.stepIndex];
  }

  private applyStepEntry(step: StudyStep): PlaybackAction[] {
    const actions: PlaybackAction[] = [];
    actions.push({ type: 'setSubtitle', subtitle: step.subtitle });
    actions.push({ type: 'setSpeed', speed: step.speed });

    if (step.pause === 'start') {
      this.state = { type: 'pausedStart' };
      actions.push({ type: 'pause' });
    } else {
      this.state = { type: 'playing' };
    }

    return actions;
  }

  private handleStepEnd(): PlaybackAction[] {
    const actions: PlaybackAction[] = [];
    while (this.processCurrentStepAtEnd(actions));
    return actions;
  }

  private processCurrentStepAtEnd(actions: PlaybackAction[]): boolean {
    if (this.state.type !== 'playing') return false;
    const step = this.currentStep();
    if (!step) return false;

    if (this.repeatRemaining > 1) {
      this.repeatRemaining -= 1;
      if (step.seek !== false) {
        actions.push({ type: 'seek', timeMs: this.cueStartMs() });
      }
      actions.push(...this.reapplyStep(step));
      return false;
    }

    if (step.after === 'loop' && this.loopCount < MAX_LOOPS) {
      this.loopCount += 1;
      this.stepIndex = 0;
      const firstStep = this.currentStep();
      if (!firstStep) return false;
      this.repeatRemaining = firstStep.repeat;
      if (firstStep.seek !== false) {
        actions.push({ type: 'seek', timeMs: this.cueStartMs() });
      }
      actions.push(...this.applyStepEntry(firstStep));
      return false;
    }

    const isLastStep = this.stepIndex >= this.mode.steps.length - 1;

    if (step.pause === 'end' || step.after === 'wait') {
      this.state = step.pause === 'end'
        ? { type: 'pausedEnd', continueTarget: isLastStep ? 'nextCue' : 'nextStep' }
        : { type: 'waiting', continueTarget: isLastStep ? 'nextCue' : 'nextStep' };
      actions.push({ type: 'pause' });
      return false;
    }

    if (isLastStep) {
      this.activeCueIndex = -1;
      this.state = { type: 'idle' };
      return false;
    }

    this.stepIndex += 1;
    const nextStep = this.currentStep();
    if (!nextStep) {
      this.activeCueIndex = -1;
      this.state = { type: 'idle' };
      return false;
    }
    this.repeatRemaining = nextStep.repeat;
    if (nextStep.seek !== false) {
      actions.push({ type: 'seek', timeMs: this.cueStartMs() });
      actions.push(...this.applyStepEntry(nextStep));
      return false;
    }
    actions.push(...this.applyStepEntry(nextStep));
    return true;
  }

  private reapplyStep(step: StudyStep): PlaybackAction[] {
    return [
      { type: 'setSubtitle', subtitle: step.subtitle },
      { type: 'setSpeed', speed: step.speed },
    ];
  }

  private handleSilence(currentTimeMs: number): PlaybackAction[] {
    if (this.advanced.skipNoDialogue === 'OFF') return [];
    if (this.cueIndexAt(currentTimeMs) >= 0) return [];

    const nextIndex = this.nextCueIndexAfter(currentTimeMs);
    if (nextIndex < 0 || nextIndex === this.silenceHandledIndex) return [];
    this.silenceHandledIndex = nextIndex;

    if (this.advanced.skipNoDialogue === 'JUMP') {
      return [{ type: 'seek', timeMs: this.cues[nextIndex].start }];
    }

    const multiplier = this.parseSkipMultiplier(this.advanced.skipNoDialogue);
    if (multiplier > 0) {
      return [{ type: 'setSpeed', speed: multiplier }];
    }

    return [];
  }

  private parseSkipMultiplier(value: string): number {
    const match = value.match(/^(\d)X$/);
    return match ? Number(match[1]) : 0;
  }

  private cueStartMs(): number {
    return this.cues[this.activeCueIndex]?.start ?? 0;
  }

  private cueIndexAt(currentTimeMs: number): number {
    for (let i = 0; i < this.cues.length; i++) {
      const cue = this.cues[i];
      const start = cue.start - this.offsetMs;
      if (start > currentTimeMs) continue;
      if (currentTimeMs < cue.end - this.offsetMs) return i;
    }
    return -1;
  }

  private nextCueIndexAfter(currentTimeMs: number): number {
    for (let i = 0; i < this.cues.length; i++) {
      if (this.cues[i].start - this.offsetMs > currentTimeMs) return i;
    }
    return -1;
  }
}
