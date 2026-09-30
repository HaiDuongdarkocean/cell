import { mapRevlog } from './revlogMap';
import type { SrsFsrsSerializedState } from '@/entities/srs/types';

const state: SrsFsrsSerializedState = {
  version: 1, due: '2026-09-01T00:00:00.000Z', stability: 10, difficulty: 5,
  elapsedDays: 10, scheduledDays: 10, reps: 3, lapses: 0, learningSteps: 0, state: 2,
};

describe('mapRevlog', () => {
  it('ease 1 → forget; ease 2/3/4 → remember; deterministic id; timestamps preserved', () => {
    const base = { cardId: 7, ivl: 30, time: 4200 };
    const r1 = mapRevlog({ ...base, id: 1000, ease: 1 }, 'c', 'n', 'nt', state, 50);
    const r3 = mapRevlog({ ...base, id: 2000, ease: 3 }, 'c', 'n', 'nt', state, 50);
    expect(r1.judgment).toBe('forget');
    expect(r3.judgment).toBe('remember');
    expect(r1.id).toBe('import-anki-1000');
    expect(r1.startedAt).toBe(1000 - 4200);
    expect(r1.answeredAt).toBe(1000);
    expect(r1.templateId).toBe('imported');
    expect(r1.componentType).toBe('meaning');
  });
});
