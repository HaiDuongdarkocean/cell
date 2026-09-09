import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCardCreatorStore } from '@/stores/cardCreatorStore';
import { useCardCreatorState } from './useCardCreatorState';
import type { CardCreatorSettings } from '@/entities/settings';
import type { CardCreatorOpenContext } from '../types';

jest.mock('../service/cardCreatorPrefetch', () => ({
  prefetchAnkiConnectData: jest.fn(async () => ({ decks: ['Default'], models: ['Basic'] })),
  getPrefetchedAnkiConnectData: jest.fn(() => null),
  clearAnkiConnectPrefetch: jest.fn(),
  onAnkiSchemaRefreshed: jest.fn(() => () => {}),
}));

jest.mock('../service/cardCreatorService', () => ({
  listModelFields: jest.fn(async () => ({ ok: true, value: ['Front', 'Back', 'Definitions', 'Image', 'SentenceAudio', 'WordAudio', 'Note', 'MoreExample', 'Tags'] })),
  findRecentNote: jest.fn(async () => ({ ok: true, value: null })),
  getNoteInfo: jest.fn(async () => ({ ok: false, error: 'not found' })),
  addNote: jest.fn(async () => ({ ok: true, value: 1 })),
  updateNote: jest.fn(async () => ({ ok: true, value: undefined })),
  addNoteTags: jest.fn(async () => ({ ok: true, value: undefined })),
}));

jest.mock('../media/mediaFile', () => ({
  fetchMediaFile: jest.fn(async (url: string, kind: 'image' | 'audio') => ({
    kind,
    filename: url.split('/').pop() ?? 'file',
    mimeType: kind === 'image' ? 'image/png' : 'audio/wav',
    data: new ArrayBuffer(0),
    sourceUrl: url,
  })),
}));

jest.mock('../media/translation', () => ({
  translateSentence: jest.fn(async () => 'translated'),
}));

const settings: CardCreatorSettings = {
  ankiConnectUrl: 'http://localhost:8765',
  defaultDeck: 'Default',
  defaultNoteType: 'Basic',
  defaultTags: '',
  mediaUpdateMode: 'overwrite',
};

const openContext: CardCreatorOpenContext = {
  sourceLang: 'en',
  targetLang: 'vi',
  prefill: {
    targetWord: 'book',
    sentence: 'This is a sentence.',
    sentenceTranslation: 'Đây là một câu.',
    definitions: 'noun a written work',
    note: 'A personal note.',
    moreExample: 'Example 1.\nExample 2.',
    imageUrls: [],
    sentenceAudioUrls: [],
    wordAudioUrls: [],
  },
};

const resendContexts = {
  first: {
    sourceLang: 'en',
    targetLang: 'vi',
    prefill: {
      targetWord: 'book',
      sentence: 'This is a sentence.',
      sentenceTranslation: 'Đây là một câu.',
      definitions: 'noun a written work',
      imageUrls: ['1', '2'],
      sentenceAudioUrls: [],
      wordAudioUrls: ['a.mp3'],
    },
  } as CardCreatorOpenContext,
  second: {
    sourceLang: 'en',
    targetLang: 'vi',
    prefill: {
      targetWord: 'book',
      sentence: 'This is another sentence.',
      sentenceTranslation: 'Đây là một câu khác.',
      definitions: 'noun a bound volume',
      imageUrls: ['2', '3', '4'],
      sentenceAudioUrls: [],
      wordAudioUrls: ['b.mp3'],
    },
  } as CardCreatorOpenContext,
};

function mediaSourceUrls(files: readonly { sourceUrl?: string }[]): (string | undefined)[] {
  return files.map((f) => f.sourceUrl);
}

describe('useCardCreatorState generateField', () => {
  beforeEach(() => {
    useCardCreatorStore.getState().reset();
  });

  it('fills an empty text field from prefill', async () => {
    const { result } = renderHook(() => useCardCreatorState(settings, openContext));

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(useCardCreatorStore.getState().draft.fields.moreExample).toBe('Example 1.\nExample 2.');

    act(() => {
      result.current.updateField('moreExample', '');
    });
    await waitFor(() => expect(useCardCreatorStore.getState().draft.fields.moreExample).toBe(''));

    await act(async () => {
      await result.current.generateField('moreExample');
    });

    expect(useCardCreatorStore.getState().draft.fields.moreExample).toBe('Example 1.\nExample 2.');
  });

  it('leaves a filled text field untouched', async () => {
    const { result } = renderHook(() => useCardCreatorState(settings, openContext));

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(useCardCreatorStore.getState().draft.fields.moreExample).toBe('Example 1.\nExample 2.');

    await act(async () => {
      await result.current.generateField('moreExample');
    });

    expect(useCardCreatorStore.getState().draft.fields.moreExample).toBe('Example 1.\nExample 2.');
  });
});

describe('useCardCreatorState resend merge', () => {
  beforeEach(() => {
    useCardCreatorStore.getState().reset();
  });

  it('overwrites image/audio selection and text on a second sendToCard', async () => {
    const { result, rerender } = renderHook(
      ({ context }) => useCardCreatorState(settings, context),
      { initialProps: { context: resendContexts.first } },
    );

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(useCardCreatorStore.getState().draft.fields.images).toHaveLength(2);
    expect(useCardCreatorStore.getState().draft.fields.wordAudios).toHaveLength(1);

    rerender({ context: resendContexts.second });

    await waitFor(() => expect(useCardCreatorStore.getState().draft.fields.images).toHaveLength(3));
    expect(mediaSourceUrls(useCardCreatorStore.getState().draft.fields.images)).toEqual(['2', '3', '4']);
    expect(mediaSourceUrls(useCardCreatorStore.getState().draft.fields.wordAudios)).toEqual(['b.mp3']);
    expect(useCardCreatorStore.getState().draft.fields.sentence).toBe('This is another sentence.');
    expect(useCardCreatorStore.getState().draft.fields.sentenceTranslation).toBe('Đây là một câu khác.');
    expect(useCardCreatorStore.getState().draft.fields.definitions).toBe('noun a bound volume');
  });

  it('appends new media while keeping still-selected media in append mode', async () => {
    const appendSettings: CardCreatorSettings = { ...settings, mediaUpdateMode: 'append' };
    const { result, rerender } = renderHook(
      ({ context }) => useCardCreatorState(appendSettings, context),
      { initialProps: { context: resendContexts.first } },
    );

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    await waitFor(() => expect(useCardCreatorStore.getState().draft.fields.images).toHaveLength(2));

    rerender({ context: resendContexts.second });

    await waitFor(() => expect(useCardCreatorStore.getState().draft.fields.images).toHaveLength(3));
    expect(mediaSourceUrls(useCardCreatorStore.getState().draft.fields.images)).toEqual(['2', '3', '4']);
    expect(mediaSourceUrls(useCardCreatorStore.getState().draft.fields.wordAudios)).toEqual(['b.mp3']);
  });

  it('is idempotent: resending the same selection does not duplicate media', async () => {
    const { result, rerender } = renderHook(
      ({ context }) => useCardCreatorState(settings, context),
      { initialProps: { context: resendContexts.first } },
    );

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    await waitFor(() => expect(useCardCreatorStore.getState().draft.fields.images).toHaveLength(2));

    rerender({ context: { ...resendContexts.first } });

    await waitFor(() => expect(useCardCreatorStore.getState().draft.fields.images).toHaveLength(2));
    expect(mediaSourceUrls(useCardCreatorStore.getState().draft.fields.images)).toEqual(['1', '2']);
    expect(useCardCreatorStore.getState().draft.fields.wordAudios).toHaveLength(1);
  });
});
