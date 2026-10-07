import { describe, expect, it } from '@jest/globals';
import {
  queueDedupeKey,
  stripSnapshot,
  queueItemFromPrefill,
  queueItemFromCue,
  evictOverflow,
  toQueueRow,
  buildQueueItem,
} from './queueLogic';
import type { MiningQueueInput } from '@/entities/miningQueue';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';
import type { BilingualCue } from '@/entities/media';

const TERM_INPUT: MiningQueueInput = {
  kind: 'term',
  term: 'Contender',
  langCode: 'en',
  sentence: 'I could have been a contender.',
};

const SENTENCE_INPUT: MiningQueueInput = {
  kind: 'sentence',
  langCode: 'en',
  sentence: 'Then again, maybe not.',
  videoId: 'v1',
};

describe('queueDedupeKey', () => {
  it('normalizes case and whitespace', () => {
    const a = queueDedupeKey(TERM_INPUT);
    const b = queueDedupeKey({ ...TERM_INPUT, term: '  contender ', sentence: 'I could  have been\na contender.' });
    expect(a).toBe(b);
  });

  it('differs term vs sentence kind on same text', () => {
    const t = queueDedupeKey(TERM_INPUT);
    const s = queueDedupeKey({ kind: 'sentence', langCode: 'en', sentence: TERM_INPUT.sentence });
    expect(t).not.toBe(s);
  });

  it('sentence items include videoId in identity', () => {
    const a = queueDedupeKey(SENTENCE_INPUT);
    const b = queueDedupeKey({ ...SENTENCE_INPUT, videoId: 'v2' });
    expect(a).not.toBe(b);
  });

  it('term items ignore videoId', () => {
    const a = queueDedupeKey(TERM_INPUT);
    const b = queueDedupeKey({ ...TERM_INPUT, videoId: 'v2' });
    expect(a).toBe(b);
  });
});

describe('stripSnapshot', () => {
  const PREFILL: PopupCardCreatorPrefill = {
    term: 'contender',
    langCode: 'en',
    reading: 'kənˈtendər',
    definitions: [{ text: 'a competitor' }],
    rawDefinitions: ['a competitor'],
    contextSentence: 'I could have been a contender.',
    wordAudioUrls: ['https://a/b.mp3'],
    audioItems: [
      { id: 'a1', kind: 'word', title: 'w', url: 'https://a/b.mp3', audioBytes: new Uint8Array([1, 2]), audioBytesB64: 'AQI=' } as never,
    ],
  };

  it('drops audio bytes but keeps urls and metadata', () => {
    const stripped = stripSnapshot(PREFILL);
    expect(stripped.wordAudioUrls).toEqual(['https://a/b.mp3']);
    const item = stripped.audioItems![0]! as unknown as Record<string, unknown>;
    expect(item.audioBytes).toBeUndefined();
    expect(item.audioBytesB64).toBeUndefined();
    expect(item.url).toBe('https://a/b.mp3');
    expect(item.id).toBe('a1');
  });

  it('does not mutate the source prefill', () => {
    stripSnapshot(PREFILL);
    const item = PREFILL.audioItems![0]! as unknown as Record<string, unknown>;
    expect(item.audioBytes).toBeDefined();
  });
});

describe('queueItemFromPrefill / queueItemFromCue', () => {
  it('term item carries prefill snapshot', () => {
    const input = queueItemFromPrefill(
      { term: 'x', langCode: 'en', reading: '', definitions: [], rawDefinitions: [], contextSentence: 'see x now' },
      'YouTube',
    );
    expect(input.kind).toBe('term');
    expect(input.term).toBe('x');
    expect(input.sentence).toBe('see x now');
    expect(input.sourceLabel).toBe('YouTube');
    expect(input.snapshot).toBeDefined();
  });

  it('cue item carries source refs', () => {
    const cue: BilingualCue = { index: 7, start: 4200, end: 5000, targetText: 'line', nativeText: 'trans' };
    const input = queueItemFromCue(cue, 'en', { sourceLabel: 'movie.mkv', videoId: 'vid-9' });
    expect(input.kind).toBe('sentence');
    expect(input.cueIndex).toBe(7);
    expect(input.cueStart).toBe(4200);
    expect(input.videoId).toBe('vid-9');
    expect(input.term).toBeUndefined();
  });
});

describe('evictOverflow', () => {
  const row = (id: string, createdAt: number) => ({ id, createdAt });

  it('returns empty under cap', () => {
    expect(evictOverflow([row('a', 1), row('b', 2)], 500)).toEqual([]);
  });

  it('evicts oldest first beyond cap', () => {
    const rows = [row('a', 1), row('b', 3), row('c', 2)];
    expect(evictOverflow(rows, 2)).toEqual(['a']);
  });

  it('breaks createdAt ties deterministically by id', () => {
    const rows = [row('b', 1), row('a', 1)];
    expect(evictOverflow(rows, 1)).toEqual(['a']);
  });
});

describe('buildQueueItem / toQueueRow', () => {
  it('builds item with dedupeKey + createdAt; row strips snapshot', () => {
    const item = buildQueueItem(TERM_INPUT, 'id-1', 1000);
    expect(item.id).toBe('id-1');
    expect(item.dedupeKey).toBe(queueDedupeKey(TERM_INPUT));
    const row = toQueueRow(item);
    expect(row).toEqual({
      id: 'id-1',
      kind: 'term',
      term: 'Contender',
      pos: undefined,
      sentence: 'I could have been a contender.',
      sourceLabel: undefined,
      cueStart: undefined,
      createdAt: 1000,
    });
    expect('snapshot' in row).toBe(false);
  });
});
