import { describe, expect, it } from '@jest/globals';
import { buildPrefill } from './buildCandidatePrefill';
import type { AudioItem, ImageItem, LookupResult } from '../types';

function makeResult(overrides?: Partial<LookupResult>): LookupResult {
  return {
    term: 'hello',
    langCode: 'en',
    reading: '/həˈloʊ/',
    readingKind: 'ipa',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: ['exclamation', 'noun'],
    definitions: [
      { id: '1', pos: 'exclamation', text: 'used as a greeting', examples: [], source: 'cambridge', defaultSelected: true },
      { id: '2', pos: 'noun', text: 'an expression of surprise', examples: [], source: 'cambridge', defaultSelected: false },
    ],
    rawDefinitions: ['used as a greeting', 'an expression of surprise'],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

function makeAudio(overrides?: Partial<AudioItem>): AudioItem {
  return {
    id: `audio-${overrides?.kind ?? 'word'}-1`,
    kind: 'word',
    source: 'community',
    label: 'Test audio',
    state: 'idle',
    url: 'https://example.com/audio.mp3',
    defaultSelected: false,
    ...overrides,
  };
}

function makeImage(overrides?: Partial<ImageItem>): ImageItem {
  return {
    id: 'image-1',
    alt: 'Test image',
    src: 'https://example.com/image.jpg',
    defaultSelected: false,
    ...overrides,
  };
}

const contextSentence = 'I said hello to the world.';
const translation = 'xin chào';

describe('buildPrefill', () => {
  it('builds a prefill from a candidate and user selections', () => {
    const result = makeResult();
    const selectedDefinitions = [result.definitions[1]!];

    const prefill = buildPrefill(
      result,
      selectedDefinitions,
      contextSentence,
      translation,
      [makeAudio({ id: 'audio-word-1', kind: 'word', url: 'https://example.com/word.mp3' })],
      new Map([['audio-word-1', true]]),
      [makeImage({ id: 'image-1', src: 'https://example.com/pic.jpg' })],
      new Map([['image-1', true]]),
    );

    expect(prefill.term).toBe('hello');
    expect(prefill.langCode).toBe('en');
    expect(prefill.reading).toBe('/həˈloʊ/');
    expect(prefill.definitions).toEqual([{ pos: 'noun', text: 'an expression of surprise' }]);
    expect(prefill.rawDefinitions).toEqual(result.rawDefinitions);
    expect(prefill.contextSentence).toBe(contextSentence);
    expect(prefill.translation).toBe(translation);
    expect(prefill.wordAudioUrls).toEqual(['https://example.com/word.mp3']);
    expect(prefill.imageUrls).toEqual(['https://example.com/pic.jpg']);
    // Selection snapshot — defaults when the caller does not pass a flag.
    expect(prefill.translationSelected).toBe(false);
  });

  it('falls back to result definitions when none are selected', () => {
    const result = makeResult();

    const prefill = buildPrefill(
      result,
      [],
      contextSentence,
      '',
      [],
      new Map(),
      [],
      new Map(),
    );

    expect(prefill.definitions).toEqual(result.definitions.map((d) => ({ pos: d.pos, text: d.text })));
    expect(prefill.translation).toBeUndefined();
  });

  it('carries over selected audio and images, ignoring unselected items', () => {
    const result = makeResult();
    const audios = [
      makeAudio({ id: 'audio-word-1', kind: 'word', url: 'https://example.com/word-1.mp3' }),
      makeAudio({ id: 'audio-word-2', kind: 'word', url: 'https://example.com/word-2.mp3' }),
      makeAudio({ id: 'audio-sentence-1', kind: 'sentence', url: 'https://example.com/sentence-1.mp3' }),
    ];
    const images = [
      makeImage({ id: 'image-1', src: 'https://example.com/pic-1.jpg' }),
      makeImage({ id: 'image-2', src: 'https://example.com/pic-2.jpg' }),
    ];

    const prefill = buildPrefill(
      result,
      [result.definitions[0]!],
      contextSentence,
      translation,
      audios,
      new Map([['audio-word-2', true], ['audio-sentence-1', true]]),
      images,
      new Map([['image-2', true]]),
    );

    expect(prefill.wordAudioUrls).toEqual(['https://example.com/word-2.mp3']);
    expect(prefill.sentenceAudioUrls).toEqual(['https://example.com/sentence-1.mp3']);
    expect(prefill.imageUrls).toEqual(['https://example.com/pic-2.jpg']);
  });

  it('falls back to the first word audio and first image when nothing is selected', () => {
    const result = makeResult();
    const audios = [
      makeAudio({ id: 'audio-word-1', kind: 'word', url: 'https://example.com/word-1.mp3' }),
      makeAudio({ id: 'audio-word-2', kind: 'word', url: 'https://example.com/word-2.mp3' }),
      makeAudio({ id: 'audio-sentence-1', kind: 'sentence', url: 'https://example.com/sentence-1.mp3' }),
    ];
    const images = [
      makeImage({ id: 'image-1', src: 'https://example.com/pic-1.jpg' }),
      makeImage({ id: 'image-2', src: 'https://example.com/pic-2.jpg' }),
    ];

    const prefill = buildPrefill(
      result,
      [],
      contextSentence,
      '',
      audios,
      new Map(),
      images,
      new Map(),
    );

    expect(prefill.wordAudioUrls).toEqual(['https://example.com/word-1.mp3']);
    expect(prefill.sentenceAudioUrls).toEqual(['https://example.com/sentence-1.mp3']);
    expect(prefill.imageUrls).toEqual(['https://example.com/pic-1.jpg']);
  });

  it('falls back to the first audio of each kind when a selected kind has no matches', () => {
    const result = makeResult();
    const audios = [
      makeAudio({ id: 'audio-word-1', kind: 'word', url: 'https://example.com/word-1.mp3' }),
      makeAudio({ id: 'audio-sentence-1', kind: 'sentence', url: 'https://example.com/sentence-1.mp3' }),
    ];

    const prefill = buildPrefill(
      result,
      [],
      contextSentence,
      '',
      audios,
      new Map([['audio-sentence-1', true]]),
      [],
      new Map(),
    );

    // No selected word audio, so fallback to first word audio.
    expect(prefill.wordAudioUrls).toEqual(['https://example.com/word-1.mp3']);
    // Selected sentence audio is used.
    expect(prefill.sentenceAudioUrls).toEqual(['https://example.com/sentence-1.mp3']);
  });

  it('includes the selection snapshot for the integrated Dictionary clone', () => {
    const result = makeResult();
    const audios = [
      makeAudio({ id: 'audio-word-1', kind: 'word', url: 'https://example.com/word-1.mp3' }),
      makeAudio({ id: 'audio-word-2', kind: 'word', url: 'https://example.com/word-2.mp3' }),
      makeAudio({ id: 'audio-sentence-1', kind: 'sentence', url: 'https://example.com/sentence-1.mp3' }),
    ];
    const images = [
      makeImage({ id: 'image-1', src: 'https://example.com/pic-1.jpg' }),
      makeImage({ id: 'image-2', src: 'https://example.com/pic-2.jpg' }),
    ];

    const prefill = buildPrefill(
      result,
      [result.definitions[1]!],
      contextSentence,
      translation,
      audios,
      new Map([['audio-word-2', true]]),
      images,
      new Map([['image-2', true]]),
      true,
    );

    expect(prefill.selectedDefinitionIds).toEqual(['2']);
    expect(prefill.selectedAudioIds).toEqual(['audio-word-2']);
    expect(prefill.selectedImageIds).toEqual(['image-2']);
    expect(prefill.translationSelected).toBe(true);
  });

  it('snapshots effective audio/image selection but only explicitly picked definitions', () => {
    const result = makeResult();
    const audios = [
      makeAudio({ id: 'audio-word-1', kind: 'word', url: 'https://example.com/word.mp3', defaultSelected: true }),
    ];
    const images = [
      makeImage({ id: 'image-1', src: 'https://example.com/pic.jpg', defaultSelected: true }),
    ];

    const prefill = buildPrefill(
      result,
      [],
      contextSentence,
      '',
      audios,
      new Map(),
      images,
      new Map(),
    );

    // No explicit toggles → audio/image fall back to the item's defaultSelected
    // hint; definitions stay empty because only explicit ticks are mirrored.
    expect(prefill.selectedAudioIds).toEqual(['audio-word-1']);
    expect(prefill.selectedImageIds).toEqual(['image-1']);
    expect(prefill.selectedDefinitionIds).toEqual([]);
    expect(prefill.translationSelected).toBe(false);
  });

  it('carries the original lookup result and loaded media arrays for the integrated Dictionary clone', () => {
    const result = makeResult();
    const audios = [makeAudio({ id: 'audio-word-1', kind: 'word', url: 'https://example.com/word.mp3' })];
    const images = [makeImage({ id: 'image-1', src: 'https://example.com/pic.jpg' })];

    const prefill = buildPrefill(
      result,
      [],
      contextSentence,
      '',
      audios,
      new Map(),
      images,
      new Map(),
    );

    expect(prefill.lookupResult).toBe(result);
    expect(prefill.audioItems).toEqual(audios);
    expect(prefill.imageItems).toEqual(images);
  });
});
