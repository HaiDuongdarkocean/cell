import type { StudyMode, StudyStep } from '@/entities/studyMode';

const SUBTITLE_LABELS: Record<StudyStep['subtitle'], string> = {
  none: 'no sub',
  native: 'native',
  target: 'target',
  both: 'both',
};

const PAUSE_LABELS: Record<StudyStep['pause'], string> = {
  none: 'no pause',
  start: 'pause start',
  end: 'pause end',
};

export function formatStepSummary(step: StudyStep, maxLen = 60): string {
  const speed = `${step.speed}x`;
  const repeat = step.repeat > 1 ? `, ${step.repeat}x` : '';
  const parts = [SUBTITLE_LABELS[step.subtitle], PAUSE_LABELS[step.pause], `${speed}${repeat}`];
  const full = parts.join(', ');
  return full.length <= maxLen ? full : `${full.slice(0, maxLen - 1)}…`;
}

export function formatModeDescription(mode: StudyMode, maxSteps = 3): string {
  const shown = mode.steps.slice(0, maxSteps).map((s) => formatStepSummary(s, 40));
  if (mode.steps.length > maxSteps) {
    shown.push('…');
  }
  return shown.join(' → ');
}
