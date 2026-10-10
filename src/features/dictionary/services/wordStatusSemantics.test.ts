import {
  baseStatus,
  statusFlag,
  isNotKnown,
  nextBaseStatus,
  toggleTrackingFlag,
} from './wordStatusSemantics';
import type { WordStatus } from '@/entities/dictionary';

const ALL: WordStatus[] = ['unknown', 'tracking', 'learning', 'known', 'ignore'];

describe('wordStatusSemantics', () => {
  it('baseStatus collapses flags onto unknown', () => {
    expect(baseStatus('unknown')).toBe('unknown');
    expect(baseStatus('tracking')).toBe('unknown');
    expect(baseStatus('learning')).toBe('unknown');
    expect(baseStatus('known')).toBe('known');
    expect(baseStatus('ignore')).toBe('ignore');
  });

  it('statusFlag extracts the flag', () => {
    expect(statusFlag('unknown')).toBe('none');
    expect(statusFlag('tracking')).toBe('tracking');
    expect(statusFlag('learning')).toBe('learning');
    expect(statusFlag('known')).toBe('none');
    expect(statusFlag('ignore')).toBe('none');
  });

  it('isNotKnown covers the three unknown-family branches', () => {
    expect(isNotKnown('unknown')).toBe(true);
    expect(isNotKnown('tracking')).toBe(true);
    expect(isNotKnown('learning')).toBe(true);
    expect(isNotKnown('known')).toBe(false);
    expect(isNotKnown('ignore')).toBe(false);
  });

  it('nextBaseStatus cycles unknown → known → ignore → unknown', () => {
    expect(nextBaseStatus('unknown')).toBe('known');
    expect(nextBaseStatus('known')).toBe('ignore');
    expect(nextBaseStatus('ignore')).toBe('unknown');
  });

  it('nextBaseStatus cycles from the base of flagged statuses', () => {
    expect(nextBaseStatus('tracking')).toBe('known');
    expect(nextBaseStatus('learning')).toBe('known');
  });

  it('toggleTrackingFlag toggles unknown ↔ tracking', () => {
    expect(toggleTrackingFlag('unknown')).toBe('tracking');
    expect(toggleTrackingFlag('tracking')).toBe('unknown');
  });

  it('toggleTrackingFlag switches known and ignore to tracking', () => {
    for (const s of ['known', 'ignore'] as const) {
      expect(toggleTrackingFlag(s)).toBe('tracking');
    }
  });

  it('toggleTrackingFlag is a no-op on learning', () => {
    expect(toggleTrackingFlag('learning')).toBe('learning');
  });

  it('every enum value maps consistently (base+flag round-trip)', () => {
    for (const s of ALL) {
      const flag = statusFlag(s);
      if (flag === 'none') expect(baseStatus(s)).toBe(s);
      else expect(baseStatus(s)).toBe('unknown');
    }
  });
});
