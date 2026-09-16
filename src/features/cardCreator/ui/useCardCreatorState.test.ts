import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCardCreatorStore } from '@/stores/cardCreatorStore';
import { useCardCreatorState } from './useCardCreatorState';
import { prefetchAnkiConnectData } from '../service/cardCreatorPrefetch';
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
  mediaFromAudioItem: jest.fn(async (item: { id: string; audioBytes?: Uint8Array; url?: string }) =>
    item.audioBytes
      ? {
          kind: 'audio',
          filename: 'cell-audio.wav',
          mimeType: 'audio/wav',
          data: item.audioBytes.buffer,
          sourceUrl: `audio-bytes://${item.id}`,
        }
      : null,
  ),
  mediaFromImageItem: jest.fn(async (item: { src: string }) =>
    item.src
      ? {
          kind: 'image',
          filename: 'cell-image.png',
          mimeType: 'image/png',
          data: new ArrayBuffer(0),
          sourceUrl: item.src,
        }
      : null,
  ),
}));

jest.mock('../media/translation', () => ({
  translateSentence: jest.fn(async () => 'translated'),
}));

jest.mock('../service/dictionaryGenerate', () => ({
  lookupDictionaryResources: jest.fn(async () => null),
}));

import { lookupDictionaryResources } from '../service/dictionaryGenerate';

const lookupMock = jest.mocked(lookupDictionaryResources);

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

describe('useCardCreatorState dictionary generate', () => {
  const noPrefillContext: CardCreatorOpenContext = {
    sourceLang: 'en',
    targetLang: 'vi',
  };

  const lookupSource = {
    targetWord: 'hello',
    definitions: '• int. a greeting',
    wordAudioUrls: ['w.mp3'],
    sentenceAudioUrls: [],
    imageUrls: ['i.png'],
  };

  beforeEach(() => {
    useCardCreatorStore.getState().reset();
    lookupMock.mockReset();
    lookupMock.mockResolvedValue(null);
  });

  it('generateAll looks up the typed target word and fills definitions + media', async () => {
    lookupMock.mockResolvedValue(lookupSource);
    const { result } = renderHook(() => useCardCreatorState(settings, noPrefillContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    act(() => {
      result.current.updateField('targetWord', 'hello');
    });
    await act(async () => {
      await result.current.generateAll();
    });

    expect(lookupMock).toHaveBeenCalledWith('hello', 'en', '');
    const fields = useCardCreatorStore.getState().draft.fields;
    expect(fields.definitions).toBe('• int. a greeting');
    expect(mediaSourceUrls(fields.wordAudios)).toEqual(['w.mp3']);
    expect(mediaSourceUrls(fields.images)).toEqual(['i.png']);
    expect(fields.sentenceAudios).toHaveLength(0);
  });

  it('generateField fills definitions from a live lookup when no prefill exists', async () => {
    lookupMock.mockResolvedValue(lookupSource);
    const { result } = renderHook(() => useCardCreatorState(settings, noPrefillContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    act(() => {
      result.current.updateField('targetWord', 'hello');
    });
    await act(async () => {
      await result.current.generateField('definitions');
    });

    expect(lookupMock).toHaveBeenCalledWith('hello', 'en', '');
    expect(useCardCreatorStore.getState().draft.fields.definitions).toBe('• int. a greeting');
  });

  it('ignores a stale prefill when the target word was changed', async () => {
    lookupMock.mockResolvedValue(lookupSource);
    const { result } = renderHook(() => useCardCreatorState(settings, openContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    // Prefill belongs to 'book'; user retypes 'hello' → must not reuse 'book' media.
    act(() => {
      result.current.updateField('targetWord', 'hello');
    });
    await act(async () => {
      await result.current.generateField('wordAudios');
    });

    expect(lookupMock).toHaveBeenCalledWith('hello', 'en', 'This is a sentence.');
    expect(mediaSourceUrls(useCardCreatorStore.getState().draft.fields.wordAudios)).toEqual(['w.mp3']);
  });

  it('caches the lookup per term across generate calls', async () => {
    lookupMock.mockResolvedValue(lookupSource);
    const { result } = renderHook(() => useCardCreatorState(settings, noPrefillContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    act(() => {
      result.current.updateField('targetWord', 'hello');
    });
    await act(async () => {
      await result.current.generateField('definitions');
      await result.current.generateField('wordAudios');
    });

    expect(lookupMock).toHaveBeenCalledTimes(1);
    expect(useCardCreatorStore.getState().draft.fields.definitions).toBe('• int. a greeting');
    expect(mediaSourceUrls(useCardCreatorStore.getState().draft.fields.wordAudios)).toEqual(['w.mp3']);
  });

  it('warns and fills nothing when the dictionary has no entry', async () => {
    const { result } = renderHook(() => useCardCreatorState(settings, noPrefillContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    act(() => {
      result.current.updateField('targetWord', 'zzzzz');
    });
    await act(async () => {
      await result.current.generateAll();
    });

    const fields = useCardCreatorStore.getState().draft.fields;
    expect(fields.definitions).toBe('');
    expect(fields.wordAudios).toHaveLength(0);
    const toasts = useCardCreatorStore.getState().toasts;
    expect(toasts.some((toast) => toast.kind === 'warning' && toast.message.includes('zzzzz'))).toBe(true);
  });

  it('does not overwrite already-filled fields on generateAll', async () => {
    lookupMock.mockResolvedValue(lookupSource);
    const { result } = renderHook(() => useCardCreatorState(settings, noPrefillContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    act(() => {
      result.current.updateField('targetWord', 'hello');
      result.current.updateField('definitions', 'user edited');
    });
    await act(async () => {
      await result.current.generateAll();
    });

    expect(useCardCreatorStore.getState().draft.fields.definitions).toBe('user edited');
  });
});

describe('useCardCreatorState queue select', () => {
  const queueContext: CardCreatorOpenContext = {
    sourceLang: 'en',
    targetLang: 'vi',
    queue: [
      { term: 'apple', definitions: 'def apple', status: 'unknown' },
      { term: 'car', definitions: '', status: 'tracking' },
    ],
  };

  beforeEach(() => {
    useCardCreatorStore.getState().reset();
    lookupMock.mockReset();
    lookupMock.mockResolvedValue(null);
  });

  it('selecting a queue item updates the active item and notifies the parent', async () => {
    const onQueueTermSelect = jest.fn();
    const { result } = renderHook(() => useCardCreatorState(settings, queueContext, undefined, {
      onQueueTermSelect,
    }));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(useCardCreatorStore.getState().draft.fields.targetWord).toBe('apple');

    act(() => {
      result.current.selectQueueItem(1);
    });

    expect(useCardCreatorStore.getState().queueActiveIndex).toBe(1);
    expect(useCardCreatorStore.getState().draft.fields.targetWord).toBe('car');
    expect(useCardCreatorStore.getState().draft.fields.definitions).toBe('');
    expect(onQueueTermSelect).toHaveBeenCalledWith('car');
    await waitFor(() => expect(lookupMock).toHaveBeenCalledWith('car', 'en', ''));
  });

  it('keeps shared cue media when switching queue items', async () => {
    const captured: CardCreatorOpenContext = {
      ...queueContext,
      initialMedia: [
        { kind: 'audio', filename: 'sentence.mp3', mimeType: 'audio/mpeg', data: new ArrayBuffer(1) },
        { kind: 'image', filename: 'shot.png', mimeType: 'image/png', data: new ArrayBuffer(1) },
      ],
    };
    const { result } = renderHook(() => useCardCreatorState(settings, captured));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    act(() => {
      result.current.selectQueueItem(1);
    });

    const fields = useCardCreatorStore.getState().draft.fields;
    expect(fields.targetWord).toBe('car');
    // Captured sentence audio + screenshot are shared cue media — preserved.
    expect(fields.sentenceAudios).toHaveLength(1);
    expect(fields.images).toHaveLength(1);
  });

  it('a superseded select only reports the newest term', async () => {
    const onQueueTermSelect = jest.fn();
    const { result } = renderHook(() => useCardCreatorState(settings, queueContext, undefined, {
      onQueueTermSelect,
    }));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    act(() => {
      result.current.selectQueueItem(1); // 'car'
      result.current.selectQueueItem(0); // 'apple' supersedes
    });

    expect(useCardCreatorStore.getState().queueActiveIndex).toBe(0);
    expect(onQueueTermSelect).toHaveBeenLastCalledWith('apple');
    await waitFor(() => expect(lookupMock).toHaveBeenLastCalledWith('apple', 'en', ''));
  });

  it('submit does not auto-advance; queue stays on the active term for manual pick', async () => {
    const onQueueTermSelect = jest.fn();
    const { result } = renderHook(() => useCardCreatorState(settings, queueContext, undefined, {
      onQueueTermSelect,
    }));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    await act(async () => {
      await result.current.submit('add');
    });

    expect(useCardCreatorStore.getState().queueActiveIndex).toBe(0);
    expect(onQueueTermSelect).not.toHaveBeenCalledWith('car');
  });

  it('prefills a single queue item from a popup/subtitle single-word lookup', async () => {
    const singleWordCtx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      queue: [{ term: 'stanford', definitions: '', status: 'unknown' }],
      prefill: {
        targetWord: 'stanford',
        definitions: '',
        sentence: 'This is stanford.',
        sentenceTranslation: 'Đây là stanford.',
        wordAudioUrls: ['https://audio/stanford.mp3'],
        imageUrls: ['https://img/stanford.png'],
      },
    };
    const { result } = renderHook(() => useCardCreatorState(settings, singleWordCtx));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    const fields = useCardCreatorStore.getState().draft.fields;
    expect(fields.targetWord).toBe('stanford');
    expect(fields.sentence).toBe('This is stanford.');
    expect(fields.sentenceTranslation).toBe('Đây là stanford.');
    expect(mediaSourceUrls(fields.wordAudios)).toEqual(['https://audio/stanford.mp3']);
    expect(mediaSourceUrls(fields.images)).toEqual(['https://img/stanford.png']);
  });

  it('converts AudioItem and ImageItem objects into MediaFile entries', async () => {
    const singleWordCtx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      queue: [{ term: 'stanford', definitions: '', status: 'unknown' }],
      prefill: {
        targetWord: 'stanford',
        definitions: '',
        sentence: 'This is stanford.',
        sentenceTranslation: 'Đây là stanford.',
        wordAudioUrls: ['audio-bytes://a-stanford'],
        imageUrls: ['https://img/stanford.png'],
        wordAudioItems: [{
          id: 'a-stanford',
          kind: 'word',
          source: 'community',
          label: 'Forvo',
          state: 'idle',
          audioBytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
          defaultSelected: true,
        }],
        imageItems: [{
          id: 'i-stanford',
          alt: 'stanford',
          src: 'https://img/stanford.png',
          defaultSelected: true,
        }],
      },
    };
    const { result } = renderHook(() => useCardCreatorState(settings, singleWordCtx));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    const fields = useCardCreatorStore.getState().draft.fields;
    await waitFor(() => expect(mediaSourceUrls(fields.wordAudios)).toEqual(['audio-bytes://a-stanford']));
    await waitFor(() => expect(mediaSourceUrls(fields.images)).toEqual(['https://img/stanford.png']));
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

describe('useCardCreatorState settings reload', () => {
  const prefetchMock = jest.mocked(prefetchAnkiConnectData);

  beforeEach(() => {
    useCardCreatorStore.getState().reset();
    prefetchMock.mockReset();
  });

  it('recovers from a failed initial load when settings change while open', async () => {
    prefetchMock.mockRejectedValueOnce(new Error('AnkiConnect unreachable'));
    const { result, rerender } = renderHook(
      ({ s }) => useCardCreatorState(s, openContext),
      { initialProps: { s: settings } },
    );
    await waitFor(() => expect(result.current.loadStatus).toBe('error'));

    prefetchMock.mockResolvedValue({ decks: ['JP'], models: ['Basic'] });
    rerender({ s: { ...settings, ankiConnectUrl: 'http://192.168.1.10:8765' } });

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(prefetchMock).toHaveBeenLastCalledWith('http://192.168.1.10:8765');
    expect(useCardCreatorStore.getState().decks).toEqual(['JP']);
    expect(useCardCreatorStore.getState().draft.fields.targetWord).toBe('book');
  });

  it('re-resolves deck while preserving user-edited field content', async () => {
    prefetchMock.mockResolvedValue({ decks: ['Default'], models: ['Basic'] });
    const { result, rerender } = renderHook(
      ({ s }) => useCardCreatorState(s, openContext),
      { initialProps: { s: settings } },
    );
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    act(() => {
      result.current.updateField('note', 'user typed');
    });

    prefetchMock.mockResolvedValue({ decks: ['JP Deck'], models: ['Basic'] });
    rerender({ s: { ...settings, defaultDeck: 'JP Deck' } });

    await waitFor(() => expect(useCardCreatorStore.getState().draft.deck).toBe('JP Deck'));
    expect(useCardCreatorStore.getState().draft.fields.note).toBe('user typed');
  });

  it('does not reload when settings content is unchanged', async () => {
    prefetchMock.mockResolvedValue({ decks: ['Default'], models: ['Basic'] });
    const { result, rerender } = renderHook(
      ({ s }) => useCardCreatorState(s, openContext),
      { initialProps: { s: settings } },
    );
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    const callsBefore = prefetchMock.mock.calls.length;

    rerender({ s: { ...settings } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    expect(prefetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('reload() retries a failed load even when settings are unchanged', async () => {
    prefetchMock.mockRejectedValueOnce(new Error('AnkiConnect unreachable'));
    const { result } = renderHook(() => useCardCreatorState(settings, openContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('error'));

    prefetchMock.mockResolvedValue({ decks: ['Default'], models: ['Basic'] });
    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(useCardCreatorStore.getState().decks).toEqual(['Default']);
  });

  it('reload() is a no-op after a successful unchanged load', async () => {
    prefetchMock.mockResolvedValue({ decks: ['Default'], models: ['Basic'] });
    const { result } = renderHook(() => useCardCreatorState(settings, openContext));
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    const callsBefore = prefetchMock.mock.calls.length;

    act(() => {
      result.current.reload();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(prefetchMock.mock.calls.length).toBe(callsBefore);
  });
});
