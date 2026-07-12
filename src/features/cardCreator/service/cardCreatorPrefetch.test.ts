/**
 * Tests for cardCreatorPrefetch: singleton promise cache, URL change drops
 * stale cache, failure clears cache for retry, clear resets.
 */
import {
  prefetchAnkiConnectData,
  getPrefetchedAnkiConnectData,
  clearAnkiConnectPrefetch,
} from './cardCreatorPrefetch';

// Mock cardCreatorService
jest.mock('./cardCreatorService', () => ({
  ensureDefaultModel: jest.fn(async () => ({ ok: true, value: undefined })),
  listDecks: jest.fn(async () => ({ ok: true, value: ['Default', 'MyDeck'] })),
  listModels: jest.fn(async () => ({ ok: true, value: ['Basic', 'Cell Video Card'] })),
}));

describe('cardCreatorPrefetch', () => {
  beforeEach(() => {
    clearAnkiConnectPrefetch();
    jest.clearAllMocks();
  });

  it('returns the same promise for repeated calls with the same URL', async () => {
    const p1 = prefetchAnkiConnectData('http://localhost:8765');
    const p2 = prefetchAnkiConnectData('http://localhost:8765');
    expect(p1).toBe(p2);
    await p1;
  });

  it('resolves with decks + models', async () => {
    const data = await prefetchAnkiConnectData('http://localhost:8765');
    expect(data.decks).toEqual(['Default', 'MyDeck']);
    expect(data.models).toEqual(['Basic', 'Cell Video Card']);
  });

  it('drops stale cache when URL changes', async () => {
    const p1 = prefetchAnkiConnectData('http://a:8765');
    await p1;
    const p2 = prefetchAnkiConnectData('http://b:8765');
    expect(p2).not.toBe(p1);
    await p2;
  });

  it('clears cache on failure so next call retries', async () => {
    const { listDecks } = require('./cardCreatorService');
    listDecks.mockResolvedValueOnce({ ok: false, error: 'connection refused' });
    await expect(prefetchAnkiConnectData('http://localhost:8765')).rejects.toThrow('connection refused');
    // Cache cleared → next call retries (with mock back to ok).
    const data = await prefetchAnkiConnectData('http://localhost:8765');
    expect(data.decks).toEqual(['Default', 'MyDeck']);
  });

  it('getPrefetchedAnkiConnectData returns null when no prefetch started', () => {
    expect(getPrefetchedAnkiConnectData()).toBeNull();
  });

  it('getPrefetchedAnkiConnectData returns in-flight promise after prefetch starts', () => {
    const p = prefetchAnkiConnectData('http://localhost:8765');
    expect(getPrefetchedAnkiConnectData()).toBe(p);
  });

  it('clear resets the cache', async () => {
    const p1 = prefetchAnkiConnectData('http://localhost:8765');
    await p1;
    clearAnkiConnectPrefetch();
    expect(getPrefetchedAnkiConnectData()).toBeNull();
    const p2 = prefetchAnkiConnectData('http://localhost:8765');
    expect(p2).not.toBe(p1);
  });
});
