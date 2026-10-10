import {
  baseStatus,
  statusFlag,
  isNotKnown,
  nextBaseStatus,
  normalizeStoredStatus,
  toggleTrackingFlag,
} from './wordStatusSemantics';
import type { WordStatus } from '@/entities/dictionary';

const ALL: WordStatus[] = ['unknown', 'tracking', 'known', 'ignore'];

describe('wordStatusSemantics', () => {
  it('baseStatus collapses the tracking flag onto unknown', () => {
    expect(baseStatus('unknown')).toBe('unknown');
    expect(baseStatus('tracking')).toBe('unknown');
    expect(baseStatus('known')).toBe('known');
    expect(baseStatus('ignore')).toBe('ignore');
  });

  it('statusFlag extracts the flag', () => {
    expect(statusFlag('unknown')).toBe('none');
    expect(statusFlag('tracking')).toBe('tracking');
    expect(statusFlag('known')).toBe('none');
    expect(statusFlag('ignore')).toBe('none');
  });

  it('isNotKnown covers the unknown-family branches', () => {
    expect(isNotKnown('unknown')).toBe(true);
    expect(isNotKnown('tracking')).toBe(true);
    expect(isNotKnown('known')).toBe(false);
    expect(isNotKnown('ignore')).toBe(false);
  });

  it('normalizeStoredStatus coalesces the legacy learning value', () => {
    expect(normalizeStoredStatus('learning')).toBe('tracking');
    for (const s of ALL) expect(normalizeStoredStatus(s)).toBe(s);
  });

  it('nextBaseStatus cycles unknown → known → ignore → unknown', () => {
    expect(nextBaseStatus('unknown')).toBe('known');
    expect(nextBaseStatus('known')).toBe('ignore');
    expect(nextBaseStatus('ignore')).toBe('unknown');
  });

  it('nextBaseStatus cycles from the base of a flagged status', () => {
    expect(nextBaseStatus('tracking')).toBe('known');
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

  it('toggleTrackingFlag toggles every status', () => {
    for (const s of ALL) {
      const next = toggleTrackingFlag(s);
      expect(next === 'tracking' || next === 'unknown').toBe(true);
    }
  });

  it('every enum value maps consistently (base+flag round-trip)', () => {
    for (const s of ALL) {
      const flag = statusFlag(s);
      if (flag === 'none') expect(baseStatus(s)).toBe(s);
      else expect(baseStatus(s)).toBe('unknown');
    }
  });
});
