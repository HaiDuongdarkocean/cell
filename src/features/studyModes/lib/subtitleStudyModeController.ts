import type { SrtCue } from '@/entities/media';
import type { StudyMode, StudyModeAdvancedSettings } from '@/entities/studyMode';
import { StudyModePlaybackController, type PlaybackAction } from './studyModePlaybackController';

export interface SubtitleStudyModeTimeState {
  /** Currently active target cue index (from the cue engine). */
  targetIndex: number;
  /** Full target cue list (from the cue engine). */
  targetCues: readonly SrtCue[];
  /** Current video time in milliseconds. */
  currentTimeMs: number;
}

const SEEK_LANDING_TOLERANCE_MS = 300;

/** Coordinates study-mode playback for the React subtitle controller.
 *
 *  This class is the seam between the video/overlay side-effects owned by
 *  `ReactSubtitleController` and the pure `StudyModePlaybackController` state
 *  machine. It tracks cue transitions and translates them into
 *  `PlaybackAction`s that the outer controller applies.
 */
export class SubtitleStudyModeController {
  private playback: StudyModePlaybackController | null = null;
  private lastTargetIndex = -1;
  private offsetMs = 0;
  private internalSeekTargetMs: number | null = null;

  get isActive(): boolean {
    return this.playback !== null;
  }

  applyStudyMode(
    activeMode: StudyMode,
    advanced: StudyModeAdvancedSettings,
    targetCues: readonly SrtCue[],
    offsetMs: number,
  ): void {
    // 'normal' is pass-through — creating the state machine for it would emit
    // { subtitle: 'both', speed: 1 } on every cue boundary, stomping manual
    // hide/show and the user's playbackRate.
    this.playback = activeMode.id === 'normal'
      ? null
      : new StudyModePlaybackController(activeMode, advanced, targetCues, offsetMs);
    this.offsetMs = offsetMs;
    this.lastTargetIndex = -1;
    this.internalSeekTargetMs = null;
  }

  setCues(targetCues: readonly SrtCue[], offsetMs: number): void {
    this.offsetMs = offsetMs;
    if (this.playback?.setCues(targetCues, offsetMs)) {
      this.lastTargetIndex = -1;
      this.internalSeekTargetMs = null;
    }
  }

  clearCues(offsetMs: number): void {
    this.offsetMs = offsetMs;
    this.playback?.setCues([], offsetMs);
    this.lastTargetIndex = -1;
    this.internalSeekTargetMs = null;
  }

  /** Called on the video 'seeking' event. Seeks the state machine issued
   *  itself are ignored; any other seek aborts the in-flight cue chain so the
   *  user's navigation wins. */
  onSeeking(currentTimeMs: number): void {
    if (
      this.internalSeekTargetMs !== null &&
      Math.abs(currentTimeMs - this.internalSeekTargetMs) <= SEEK_LANDING_TOLERANCE_MS
    ) {
      this.internalSeekTargetMs = null;
      return;
    }
    this.internalSeekTargetMs = null;
    this.playback?.abort();
    this.lastTargetIndex = -1;
  }

  continue(): readonly PlaybackAction[] {
    if (!this.playback) return [];
    const actions = this.playback.continue();
    this.trackInternalSeek(actions);
    return actions;
  }

  onTimeUpdate({ targetIndex, targetCues, currentTimeMs }: SubtitleStudyModeTimeState): readonly PlaybackAction[] {
    if (!this.playback) return [];

    const actions: PlaybackAction[] = [];

    // A new engine cue index only enters the state machine once the previous
    // cue's step chain has finished (or was aborted by a user seek). Contiguous
    // cues flip the index at the boundary while the machine still owns the
    // ending cue — it will seek back to that cue's start to run the next step.
    if (
      targetIndex !== this.lastTargetIndex &&
      targetIndex >= 0 &&
      targetCues[targetIndex] &&
      !this.playback.hasActiveCue
    ) {
      this.lastTargetIndex = targetIndex;
      actions.push(...this.playback.enterCue(targetCues[targetIndex], targetIndex));
    }

    actions.push(...this.playback.onTimeUpdate(currentTimeMs));
    this.trackInternalSeek(actions);
    return actions;
  }

  destroy(): void {
    this.playback = null;
    this.lastTargetIndex = -1;
    this.internalSeekTargetMs = null;
  }

  private trackInternalSeek(actions: readonly PlaybackAction[]): void {
    for (const action of actions) {
      if (action.type === 'seek') {
        this.internalSeekTargetMs = action.timeMs - this.offsetMs;
      }
    }
  }
}
