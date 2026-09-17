import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { WordStatus } from '@/entities/dictionary';
import { getWordStatuses } from '@/features/dictionary';
import { createBookScoreTracker } from './bookScore';

jest.mock('@/features/dictionary/services/wordStatusClient', () => ({
  getWordStatuses: jest.fn(),
}));

const mockedGet = getWordStatuses as jest.MockedFunction<typeof getWordStatuses>;

describe('createBookScoreTracker', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockImplementation(async (_l, terms) =>
      new Map(terms.map((t) => [t, t === 'hello' ? 'known' : 'unknown'] as const)),
    );
  });

  it('builds a text tracker across paragraphs', async () => {
    const tracker = await createBookScoreTracker(['hello world', 'hello again'], 'en');
    const s = tracker!.stats('text');
    expect(s.totalTokens).toBe(4);
    expect(s.knownTokens).toBe(2);
    expect(s.coverage).toBe(50);
  });

  it('returns null for zh-family languages', async () => {
    expect(await createBookScoreTracker(['你好世界'], 'zh-hant')).toBeNull();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('returns null when status fetch fails (fail-open)', async () => {
    mockedGet.mockResolvedValue(new Map<string, WordStatus>());
    expect(await createBookScoreTracker(['hello world'], 'en')).toBeNull();
  });

  it('returns null when cancelled mid-tokenize', async () => {
    let calls = 0;
    const isCancelled = () => ++calls > 1;
    const paragraphs = Array.from({ length: 10 }, () => 'hello world');
    expect(await createBookScoreTracker(paragraphs, 'en', isCancelled)).toBeNull();
  });
});
