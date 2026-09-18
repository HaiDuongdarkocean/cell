import { describe, it, expect } from '@jest/globals';
import { modeUsesBandProbe } from './modeUsesBandProbe';
import type { StudyMode, StudyStep } from '@/entities/studyMode';

const baseStep: StudyStep = {
  subtitle: 'both',
  pause: 'none',
  repeat: 1,
  speed: 1,
  after: 'continue',
};

const mode = (steps: StudyStep[]): StudyMode => ({
  id: 'm',
  type: 'custom',
  icon: 'play',
  title: 'M',
  description: '',
  steps,
});

describe('modeUsesBandProbe', () => {
  it('is false for null and for static modes', () => {
    expect(modeUsesBandProbe(null)).toBe(false);
    expect(modeUsesBandProbe(undefined)).toBe(false);
    expect(modeUsesBandProbe(mode([baseStep]))).toBe(false);
  });

  it('is true when any step uses the adaptive subtitle sentinel', () => {
    expect(
      modeUsesBandProbe(mode([baseStep, { ...baseStep, subtitle: 'adaptive' }])),
    ).toBe(true);
  });

  it('is true when the first step carries a skip rule', () => {
    expect(modeUsesBandProbe(mode([{ ...baseStep, skip: 'non-i1' }]))).toBe(true);
  });

  it('ignores a skip rule on a non-first step (dead config)', () => {
    expect(
      modeUsesBandProbe(mode([baseStep, { ...baseStep, skip: 'non-i1' }])),
    ).toBe(false);
  });
});
