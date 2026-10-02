import type { SrsMemoryComponent, SrsProgressConstants, SrsStudyConfig, ReviewJudgment, ReviewMode } from '@/entities/srs/types';

/** Acquisition gain for a correct review. */
export function gain(progress: number, constants: SrsProgressConstants): number {
  return Math.max(constants.rememberGainMin, Math.floor(constants.rememberGainBase * (1 - progress / 100)));
}

/** Acquisition penalty for an incorrect review. */
export function penalty(progress: number, constants: SrsProgressConstants): number {
  return Math.max(5, Math.floor(constants.forgetPenaltyBase - (progress * constants.forgetPenaltyStep)));
}

/** Calculate the new acquisition progress for a component after a review. `inputCorrect: undefined` means the variant had no input to grade. */
export function calculateProgress(
  component: SrsMemoryComponent,
  judgment: ReviewJudgment,
  inputCorrect: boolean | undefined,
  config: SrsStudyConfig,
  mode: ReviewMode,
): number {
  if (mode === 'explore') return component.progress;

  if (judgment === 'remember' && inputCorrect !== false) {
    return Math.min(100, component.progress + gain(component.progress, config.progressConstants));
  }

  return Math.max(0, component.progress - penalty(component.progress, config.progressConstants));
}
