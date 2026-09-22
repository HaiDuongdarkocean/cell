import { describe, it, expect } from '@jest/globals';
import { formatStepSummary, formatModeDescription } from './formatStepSummary';
import { t } from '@/shared/i18n';
import type { StudyMode, StudyStep } from '@/entities/studyMode';

const step: StudyStep = {
  subtitle: 'target',
  pause: 'none',
  repeat: 2,
  speed: 0.75,
  after: 'continue',
};

describe('formatStepSummary', () => {
  it('shows subtitle, pause, speed and repeat', () => {
    expect(formatStepSummary(step, t)).toBe('target, no pause, 0.75x, 2x');
  });

  it('omits repeat when 1x', () => {
    const s: StudyStep = { ...step, repeat: 1 };
    expect(formatStepSummary(s, t)).toBe('target, no pause, 0.75x');
  });

  it('appends the skip rule when set', () => {
    const s: StudyStep = { ...step, skip: 'non-i1' };
    expect(formatStepSummary(s, t)).toBe('target, no pause, 0.75x, 2x, skip non-i1');
  });
});

describe('formatModeDescription', () => {
  it('joins step summaries with arrows', () => {
    const mode: StudyMode = {
      id: 'x',
      type: 'custom' as const,
      icon: 'play' as const,
      title: 'Test',
      description: '',
      steps: [step, { ...step, repeat: 1, speed: 1 }],
    };
    expect(formatModeDescription(mode, t)).toBe(
      'target, no pause, 0.75x, 2x → target, no pause, 1x',
    );
  });
});
