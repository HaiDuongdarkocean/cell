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
