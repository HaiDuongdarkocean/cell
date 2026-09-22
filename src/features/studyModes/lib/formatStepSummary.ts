import type { StudyMode, StudyStep } from '@/entities/studyMode';
import type { MessageKey } from '@/shared/i18n';

export type SummaryResolver = (key: MessageKey) => string;

const SUBTITLE_KEYS: Record<StudyStep['subtitle'], MessageKey> = {
  none: 'studyModes.summary.subtitle.none',
  native: 'studyModes.summary.subtitle.native',
  target: 'studyModes.summary.subtitle.target',
  both: 'studyModes.summary.subtitle.both',
  adaptive: 'studyModes.summary.subtitle.adaptive',
};

const PAUSE_KEYS: Record<StudyStep['pause'], MessageKey> = {
  none: 'studyModes.summary.pause.none',
  start: 'studyModes.summary.pause.start',
  end: 'studyModes.summary.pause.end',
};

export function formatStepSummary(step: StudyStep, resolve: SummaryResolver, maxLen = 60): string {
  const speed = `${step.speed}x`;
  const repeat = step.repeat > 1 ? `, ${step.repeat}x` : '';
  const parts = [
    resolve(SUBTITLE_KEYS[step.subtitle]),
    resolve(PAUSE_KEYS[step.pause]),
    `${speed}${repeat}`,
  ];
  if (step.skip !== undefined) parts.push(resolve('studyModes.summary.skipNonI1'));
  const full = parts.join(', ');
  return full.length <= maxLen ? full : `${full.slice(0, maxLen - 1)}…`;
}

export function formatModeDescription(mode: StudyMode, resolve: SummaryResolver, maxSteps = 3): string {
  const shown = mode.steps.slice(0, maxSteps).map((s) => formatStepSummary(s, resolve, 40));
  if (mode.steps.length > maxSteps) {
    shown.push('…');
  }
  return shown.join(' → ');
}
