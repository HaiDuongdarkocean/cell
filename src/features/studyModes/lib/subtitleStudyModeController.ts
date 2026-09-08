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
    this.lastTargetIndex = -1;
  }

  setCues(targetCues: readonly SrtCue[], offsetMs: number): void {
    this.playback?.setCues(targetCues, offsetMs);
  }

  clearCues(offsetMs: number): void {
    this.playback?.setCues([], offsetMs);
    this.lastTargetIndex = -1;
  }

  continue(): readonly PlaybackAction[] {
    if (!this.playback) return [];
    return this.playback.continue();
  }

  onTimeUpdate({ targetIndex, targetCues, currentTimeMs }: SubtitleStudyModeTimeState): readonly PlaybackAction[] {
    if (!this.playback) return [];

    const actions: PlaybackAction[] = [];

    if (targetIndex !== this.lastTargetIndex && targetIndex >= 0 && targetCues[targetIndex]) {
      this.lastTargetIndex = targetIndex;
      actions.push(...this.playback.enterCue(targetCues[targetIndex], targetIndex));
    }

    actions.push(...this.playback.onTimeUpdate(currentTimeMs));
    return actions;
  }

  destroy(): void {
    this.playback = null;
    this.lastTargetIndex = -1;
  }
}
