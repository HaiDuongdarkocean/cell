import { batchSendTerms } from './batchSendTerms';

declare global {
  var __TihokaSendMessage: ((m: unknown) => Promise<unknown>) | undefined;
}

type Call = { type: string; payload: Record<string, unknown> };

function mockSender(handler: (msg: Call) => unknown): Call[] {
  const calls: Call[] = [];
  globalThis.__TihokaSendMessage = (m) => {
    const msg = m as Call;
    calls.push(msg);
    return Promise.resolve(handler(msg));
  };
  return calls;
}

afterEach(() => {
  delete globalThis.__TihokaSendMessage;
});

const mergeMap = (acc: Map<string, string>, data: Record<string, string>): void => {
  for (const [k, v] of Object.entries(data)) acc.set(k, v);
};

describe('batchSendTerms', () => {
  it('returns the empty acc for empty terms without messaging', async () => {
    const calls = mockSender(() => ({ success: true, data: {} }));
    const out = await batchSendTerms<Record<string, string>, Map<string, string>>({
      type: 'X',
      terms: [],
      chunkSize: 2,
      makePayload: (chunk) => ({ terms: [...chunk] }),
      empty: () => new Map(),
      merge: mergeMap,
    });
    expect(out).toEqual(new Map());
    expect(calls).toHaveLength(0);
  });

  it('chunks terms and merges successful responses', async () => {
    mockSender((msg) => {
      const terms = msg.payload.terms as string[];
      return { success: true, data: Object.fromEntries(terms.map((t) => [t, t.toUpperCase()])) };
    });
    const out = await batchSendTerms<Record<string, string>, Map<string, string>>({
      type: 'X',
      terms: ['a', 'b', 'c'],
      chunkSize: 2,
      makePayload: (chunk) => ({ terms: [...chunk] }),
      empty: () => new Map(),
      merge: mergeMap,
    });
    expect(out).toEqual(new Map([['a', 'A'], ['b', 'B'], ['c', 'C']]));
  });

  it('skips failed chunks by default and keeps the rest', async () => {
    let n = 0;
    mockSender(() => {
      n += 1;
      return n === 1 ? undefined : { success: true, data: { b: 'B' } };
    });
    const out = await batchSendTerms<Record<string, string>, Map<string, string>>({
      type: 'X',
      terms: ['a', 'b'],
      chunkSize: 1,
      makePayload: (chunk) => ({ terms: [...chunk] }),
      empty: () => new Map(),
      merge: mergeMap,
    });
    expect(out).toEqual(new Map([['b', 'B']]));
  });

  it('returns null on the first failed chunk when abortOnFail', async () => {
    let n = 0;
    mockSender(() => {
      n += 1;
      return n === 2 ? { success: false } : { success: true, data: { x: 'y' } };
    });
    const out = await batchSendTerms<Record<string, string>, Map<string, string>>({
      type: 'X',
      terms: ['a', 'b', 'c'],
      chunkSize: 1,
      makePayload: (chunk) => ({ terms: [...chunk] }),
      empty: () => new Map(),
      merge: mergeMap,
      abortOnFail: true,
    });
    expect(out).toBeNull();
    expect(n).toBe(2);
  });
});
