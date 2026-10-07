import { buildPumpSession, PUMP_SESSION_CAP } from './sessionBuilder';
import type { PumpItem } from '../types';

function item(partial: Partial<PumpItem> & { id: string }): PumpItem {
  return {
    source: 'srs',
    refId: partial.id,
    sentence: 'hello world',
    langCode: 'en',
    ...partial,
  };
}

describe('buildPumpSession', () => {
  it('filters items with empty sentences', () => {
    const out = buildPumpSession([
      item({ id: 'a', sentence: 'kept' }),
      item({ id: 'b', sentence: '  ' }),
      item({ id: 'c', sentence: '' }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['a']);
  });

  it('dedupes identical normalized sentences across sources, SRS wins', () => {
    const out = buildPumpSession([
      item({ id: 'q1', source: 'queue', sentence: 'Same  Line.', createdAt: 5 }),
      item({ id: 's1', source: 'srs', sentence: 'same line.', dueAt: '2026-01-01' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('s1');
  });

  it('orders SRS by dueAt asc, then queue items newest-first', () => {
    const out = buildPumpSession([
      item({ id: 'q1', source: 'queue', sentence: 'q one', createdAt: 10 }),
      item({ id: 's2', source: 'srs', sentence: 's two', dueAt: '2026-02-01' }),
      item({ id: 'q2', source: 'queue', sentence: 'q two', createdAt: 20 }),
      item({ id: 's1', source: 'srs', sentence: 's one', dueAt: '2026-01-01' }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['s1', 's2', 'q2', 'q1']);
  });

  it('caps at 200 after dedupe', () => {
    const many = Array.from({ length: 260 }, (_, i) =>
      item({ id: `s${i}`, sentence: `sentence ${i}`, dueAt: `2026-01-${String(i % 28 + 1).padStart(2, '0')}` }),
    );
    const out = buildPumpSession(many);
    expect(out).toHaveLength(PUMP_SESSION_CAP);
    expect(out[0]!.dueAt! <= out[PUMP_SESSION_CAP - 1]!.dueAt!).toBe(true);
  });

  it('builds a 200-item session well under the 1s budget', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      item({ id: `i${i}`, source: i % 3 === 0 ? 'queue' : 'srs', sentence: `s ${i}`, dueAt: '2026-01-01', createdAt: i }),
    );
    const t0 = performance.now();
    const out = buildPumpSession(many);
    const ms = performance.now() - t0;
    expect(out).toHaveLength(PUMP_SESSION_CAP);
    expect(ms).toBeLessThan(100);
  });
});
