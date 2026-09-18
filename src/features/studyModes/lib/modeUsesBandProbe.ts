import type { StudyMode } from '@/entities/studyMode';

/** Whether the mode needs the cue band probe (easy/i1/dense per cue):
 *  any adaptive-subtitle step, or a skip rule on the first step (skip is
 *  only evaluated at cue entry — a dead-config skip on a later step must
 *  not spin up the resolver). */
export function modeUsesBandProbe(mode: StudyMode | null | undefined): boolean {
  return (
    (mode?.steps.some((step) => step.subtitle === 'adaptive') ?? false) ||
    mode?.steps[0]?.skip !== undefined
  );
}
