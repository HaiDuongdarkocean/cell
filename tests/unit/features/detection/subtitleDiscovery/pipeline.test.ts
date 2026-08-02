// Unit tests for the generic subtitle discovery pipeline.

import { SubtitleDiscoveryPipeline, createDefaultAdapters } from '@/features/detection/subtitleDiscovery';
import type { SubtitleDiscoveryEnvironment, SubtitleInventorySink } from '@/features/detection/subtitleDiscovery';
import type { DetectedSubtitle } from '@/entities/media';

function makeTestContext(overrides?: Partial<import('@/features/detection/subtitleDiscovery').SubtitleDiscoveryContext>) {
  return {
    tabId: 1,
    frameId: 0,
    origin: 'https://example.com',
    tabUrl: 'https://example.com/video',
    initiator: 'https://example.com',
    timestamp: 1700000000000,
    ...overrides,
  };
}

function makeTestEnv(overrides?: {
  fetchText?: SubtitleDiscoveryEnvironment['fetchText'];
}): SubtitleDiscoveryEnvironment {
  return {
    fetchText: overrides?.fetchText ?? (async () => ({ ok: false, status: 404, content: '', finalUrl: '' })),
    resolveUrl: (base, relative) => new URL(relative, base).href,
    now: () => 1700000000000,
  };
}

function makeTestSink(): SubtitleInventorySink & { added: DetectedSubtitle[] } {
  const added: DetectedSubtitle[] = [];
  return {
    add: (subs) => {
      added.push(...subs);
      return subs.length;
    },
    addUnresolved: () => {},
    added,
  };
}

describe('SubtitleDiscoveryPipeline', () => {
  it('validates and processes a network-response signal', async () => {
    const sink = makeTestSink();
    const pipeline = new SubtitleDiscoveryPipeline(sink);
    pipeline.register(createDefaultAdapters()[0]); // cinesrc

    const result = await pipeline.process(
      {
        kind: 'network-response',
        url: 'https://subs.example-cdn.st/search?id=123',
        body: '[]',
        tabId: 1,
        frameId: 0,
      },
      makeTestContext({ origin: 'https://subs.example-cdn.st' }),
      makeTestEnv(),
    );

    expect(result.stats.processed).toBe(0);
    expect(result.ready).toHaveLength(0);
  });

  it('rejects oversized raw signals gracefully', async () => {
    const sink = makeTestSink();
    const pipeline = new SubtitleDiscoveryPipeline(sink);

    const result = await pipeline.process(
      {
        kind: 'network-response',
        url: 'https://example.com/',
        body: 'x'.repeat(2_100_000),
        tabId: 1,
        frameId: 0,
      },
      makeTestContext(),
      makeTestEnv(),
    );

    expect(result.stats.processed).toBe(0);
    expect(sink.added).toHaveLength(0);
  });

  it('deduplicates candidates by identity within a tab', async () => {
    const sink = makeTestSink();
    const pipeline = new SubtitleDiscoveryPipeline(sink);

    // Custom adapter returning the same candidate twice.
    pipeline.register({
      id: 'dup',
      priority: 1,
      match: () => true,
      discover: async () => [
        {
          id: 'id-1',
          label: 'English',
          language: 'en',
          format: 'srt',
          source: 'direct',
          url: 'https://example.com/en.srt',
          status: 'ready',
          identity: 'dup:english:srt:en.srt',
          tabId: 1,
          frameId: 0,
          replayContext: { origin: 'https://example.com' },
        } as import('@/features/detection/subtitleDiscovery').SubtitleCandidate,
        {
          id: 'id-2',
          label: 'English',
          language: 'en',
          format: 'srt',
          source: 'direct',
          url: 'https://example.com/en.srt',
          status: 'ready',
          identity: 'dup:english:srt:en.srt',
          tabId: 1,
          frameId: 0,
          replayContext: { origin: 'https://example.com' },
        } as import('@/features/detection/subtitleDiscovery').SubtitleCandidate,
      ],
    });

    const result = await pipeline.process(
      { kind: 'network-response', url: 'https://example.com/list', body: '[]', tabId: 1, frameId: 0 },
      makeTestContext(),
      makeTestEnv(),
    );

    expect(result.ready).toHaveLength(1);
    expect(sink.added).toHaveLength(1);
    expect(result.stats.duplicate).toBe(1);
  });
});
