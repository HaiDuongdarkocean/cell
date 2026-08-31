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

  setCues(cues: readonly SrtCue[], offsetMs = this.offsetMs): void {
    this.cues = cues;
    this.offsetMs = offsetMs;
  }

  setMode(mode: StudyMode, advanced: StudyModeAdvancedSettings): void {
    this.mode = mode;
    this.advanced = advanced;
    this.activeCueIndex = -1;
    this.state = { type: 'idle' };
  }

  /** Called when the engine reports a new active cue. */
  enterCue(cue: SrtCue, index: number): PlaybackAction[] {
    this.activeCueIndex = index;
    this.activeCueEnd = cue.end - this.offsetMs;
    this.stepIndex = 0;
    this.loopCount = 0;
    const step = this.currentStep();
    if (!step) return [];
    this.repeatRemaining = step.repeat;
    return this.applyStepEntry(step);
  }

  /** Called on every video time update (time in milliseconds). */
  onTimeUpdate(currentTimeMs: number): PlaybackAction[] {
    if (this.activeCueIndex < 0) {
      return this.handleSilence(currentTimeMs);
    }

    if (this.state.type === 'pausedStart' || this.state.type === 'pausedEnd' || this.state.type === 'waiting') {
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
        return this.advanceStep();
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
    const step = this.currentStep();
    if (!step) return [];

    if (this.repeatRemaining > 1) {
      this.repeatRemaining -= 1;
      return [{ type: 'seek', timeMs: this.cueStartMs() }, ...this.reapplyStep(step)];
    }

    if (step.after === 'loop') {
      if (this.loopCount < MAX_LOOPS) {
        this.loopCount += 1;
        this.stepIndex = 0;
        const firstStep = this.currentStep();
        if (!firstStep) return [];
        this.repeatRemaining = firstStep.repeat;
        return [{ type: 'seek', timeMs: this.cueStartMs() }, ...this.applyStepEntry(firstStep)];
      }
    }

    const isLastStep = this.stepIndex >= this.mode.steps.length - 1;

    if (step.pause === 'end' || step.after === 'wait') {
      this.state = step.pause === 'end'
        ? { type: 'pausedEnd', continueTarget: isLastStep ? 'nextCue' : 'nextStep' }
        : { type: 'waiting', continueTarget: isLastStep ? 'nextCue' : 'nextStep' };
      return [{ type: 'pause' }];
    }

    if (isLastStep) {
      this.activeCueIndex = -1;
      this.state = { type: 'idle' };
      return [];
    }

    return this.advanceStep();
  }

  private advanceStep(): PlaybackAction[] {
    this.stepIndex += 1;
    const step = this.currentStep();
    if (!step) {
      this.activeCueIndex = -1;
      this.state = { type: 'idle' };
      return [];
    }
    this.repeatRemaining = step.repeat;
    return [{ type: 'seek', timeMs: this.cueStartMs() }, ...this.applyStepEntry(step)];
  }

  private reapplyStep(step: StudyStep): PlaybackAction[] {
    return [
      { type: 'setSubtitle', subtitle: step.subtitle },
      { type: 'setSpeed', speed: step.speed },
    ];
  }

  private handleSilence(currentTimeMs: number): PlaybackAction[] {
    if (this.advanced.skipNoDialogue === 'OFF') return [];

    const nextCue = this.nextCueAfter(currentTimeMs);
    if (!nextCue) return [];

    if (this.advanced.skipNoDialogue === 'JUMP') {
      return [{ type: 'seek', timeMs: nextCue.start - this.offsetMs }];
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
    const cue = this.cues[this.activeCueIndex];
    return cue ? cue.start - this.offsetMs : 0;
  }

  private nextCueAfter(currentTimeMs: number): SrtCue | undefined {
    for (const cue of this.cues) {
      const start = cue.start - this.offsetMs;
      if (start > currentTimeMs) return cue;
    }
    return undefined;
  }
}
