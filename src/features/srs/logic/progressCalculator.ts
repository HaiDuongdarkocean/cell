import type { SrsMemoryComponent, SrsProgressConstants, SrsStudyConfig, ReviewJudgment, ReviewMode } from '@/entities/srs/types';

/** Acquisition gain for a correct review. */
export function gain(progress: number, constants: SrsProgressConstants): number {
  return Math.max(constants.rememberGainMin, Math.floor(constants.rememberGainBase * (1 - progress / 100)));
}

/** Acquisition penalty for an incorrect review. */
export function penalty(progress: number, constants: SrsProgressConstants): number {
  return Math.max(5, Math.floor(constants.forgetPenaltyBase - (progress * constants.forgetPenaltyStep)));
}

/** Calculate the new acquisition progress for a component after a review. */
export function calculateProgress(
  component: SrsMemoryComponent,
  judgment: ReviewJudgment,
  isSpellingCorrect: boolean,
  config: SrsStudyConfig,
  mode: ReviewMode,
): number {
  if (mode === 'explore') return component.progress;

  if (judgment === 'remember' && (component.type !== 'spelling' || isSpellingCorrect)) {
    return Math.min(100, component.progress + gain(component.progress, config.progressConstants));
  }

  return Math.max(0, component.progress - penalty(component.progress, config.progressConstants));
}
