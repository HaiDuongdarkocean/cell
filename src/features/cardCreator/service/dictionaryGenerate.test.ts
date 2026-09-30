/**
 * dictionaryGenerate — verifies the generate flow talks to the same dictionary
 * pipeline as the popup: LOOKUP_REQUEST for definitions, the pronunciation
 * orchestrator for word audio, TTS for sentence audio, FETCH_IMAGES for images.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation';
import type { AudioItem, ImageItem, LookupResult } from '@/entities/dictionary';
import { lookupDictionaryResources } from './dictionaryGenerate';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(async () => ({})),
  saveSettings: jest.fn(async () => undefined),
}));

const resolveMock = jest.fn<(term: string, langCode: string) => Promise<readonly AudioItem[]>>();

jest.mock('@/features/pronunciation', () => ({
  PronunciationAudioOrchestrator: jest.fn().mockImplementation(() => ({
    resolve: resolveMock,
  })),
}));

const mockedSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;

const winner: LookupResult = {
  term: 'hello',
  langCode: 'en',
  reading: 'həˈləʊ',
  readingKind: 'ipa',
  frequencies: [],
  status: 'unknown',
  partsOfSpeech: ['int.'],
  definitions: [
    { id: 'd1', pos: 'int.', text: 'a greeting', examples: [], source: 'Cambridge', defaultSelected: true },
    { id: 'd2', pos: 'n.', text: 'a call for attention', examples: [], source: 'Cambridge', defaultSelected: true },
  ],
  rawDefinitions: [],
  detectedPhrase: null,
  matchSource: 'dictionary',
};

const wordAudio: AudioItem[] = [
  { id: 'a1', kind: 'word', source: 'community', label: 'Forvo · US', state: 'idle', url: 'us.mp3', defaultSelected: true },
  { id: 'a2', kind: 'word', source: 'community', label: 'Forvo · UK', state: 'idle', url: 'uk.mp3', defaultSelected: false },
];

const imageItems: ImageItem[] = [
  { id: 'i1', alt: 'hello', src: 'one.png', defaultSelected: true },
  { id: 'i2', alt: 'hello', src: 'two.png', defaultSelected: false },
];

function mockMessages(overrides: Partial<Record<string, unknown>> = {}): void {
  mockedSendMessage.mockImplementation(async (message) => {
    const type = (message as { type: string }).type;
    if (type === MESSAGE_TYPES.LOOKUP_REQUEST) {
      return (overrides.lookup ?? { success: true, data: [winner] }) as never;
    }
    if (type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
      return (overrides.tts ?? { success: true, data: { url: 'sentence.mp3' } }) as never;
    }
    if (type === MESSAGE_TYPES.FETCH_IMAGES) {
      return (overrides.images ?? { success: true, data: { items: imageItems } }) as never;
    }
    return { success: true, data: {} } as never;
  });
}

describe('lookupDictionaryResources', () => {
  beforeEach(() => {
    mockedSendMessage.mockReset();
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(wordAudio);
    mockMessages();
  });

  it('returns formatted definitions and media URLs for a dictionary hit', async () => {
    const result = await lookupDictionaryResources('hello', 'en', 'Say hello.');

    expect(result).not.toBeNull();
    expect(result!.targetWord).toBe('hello');
    expect(result!.definitions).toBe('Hello həˈləʊ\n• int. a greeting\n\n• n. a call for attention');
    expect(result!.wordAudioUrls).toEqual(['us.mp3']);
    expect(result!.sentenceAudioUrls).toEqual(['sentence.mp3']);
    expect(result!.imageUrls).toEqual(['one.png']);
    expect(PronunciationAudioOrchestrator).toHaveBeenCalled();
    expect(resolveMock).toHaveBeenCalledWith('hello', 'en');
  });

  it('sends the typed term verbatim with the sentence as lookup context', async () => {
    await lookupDictionaryResources('  hello  ', 'en', 'Say hello.');

    const lookupCall = mockedSendMessage.mock.calls.find(
      (call) => (call[0] as { type: string }).type === MESSAGE_TYPES.LOOKUP_REQUEST,
    );
    const payload = (lookupCall![0] as { payload: { request: { term: string; contextSentence: string; fallback?: boolean } } }).payload;
    expect(payload.request.term).toBe('hello');
    expect(payload.request.contextSentence).toBe('Say hello.');
    expect(payload.request.fallback).toBe(true);
  });

  it('skips the sentence-audio fetch when there is no sentence', async () => {
    const result = await lookupDictionaryResources('hello', 'en', '');

    expect(result!.sentenceAudioUrls).toEqual([]);
    const ttsCalls = mockedSendMessage.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === MESSAGE_TYPES.TTS_FETCH_AUDIO,
    );
    expect(ttsCalls).toHaveLength(0);
  });

  it('falls back to the first available audio/image when none is default-selected', async () => {
    resolveMock.mockResolvedValue(wordAudio.map((item) => ({ ...item, defaultSelected: false })));
    mockMessages({ images: { success: true, data: { items: imageItems.map((i) => ({ ...i, defaultSelected: false })) } } });

    const result = await lookupDictionaryResources('hello', 'en', '');

    expect(result!.wordAudioUrls).toEqual(['us.mp3']);
    expect(result!.imageUrls).toEqual(['one.png']);
  });

  it('returns null when the lookup finds no entry', async () => {
    mockMessages({ lookup: { success: true, data: [] } });
    expect(await lookupDictionaryResources('zzzzz', 'en', '')).toBeNull();
  });

  it('returns null when the lookup fails', async () => {
    mockMessages({ lookup: { success: false, error: 'no dictionaries' } });
    expect(await lookupDictionaryResources('hello', 'en', '')).toBeNull();
  });

  it('returns null when sendMessage throws', async () => {
    mockedSendMessage.mockRejectedValue(new Error('no runtime'));
    expect(await lookupDictionaryResources('hello', 'en', '')).toBeNull();
  });

  it('still returns definitions when all media sources fail', async () => {
    resolveMock.mockResolvedValue([]);
    mockMessages({ tts: { success: false }, images: { success: false } });

    const result = await lookupDictionaryResources('hello', 'en', 'Say hello.');

    expect(result!.definitions).toContain('a greeting');
    expect(result!.wordAudioUrls).toEqual([]);
    expect(result!.sentenceAudioUrls).toEqual([]);
    expect(result!.imageUrls).toEqual([]);
  });
});
