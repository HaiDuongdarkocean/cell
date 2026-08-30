import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { LookupResult, AudioItem, ImageItem } from '../types';
import { useDictionaryToolbar } from './useDictionaryToolbar';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { MESSAGE_TYPES } from '@/shared/config/messages';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/features/cardCreator/media/translation', () => ({
  translateSentence: jest.fn(),
}));

const mockSendMessage = jest.mocked(sendMessage);
const mockTranslateSentence = jest.mocked(translateSentence);

function makeResult(term: string, overrides: Partial<LookupResult> = {}): LookupResult {
  return {
    term,
    langCode: 'en',
    reading: '',
    readingKind: 'none',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: [],
    definitions: [],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

function makeAudio(id: string, selected = false, source: AudioItem['source'] = 'community'): AudioItem {
  return {
    id,
    kind: 'word',
    source,
    label: 'Test audio',
    state: 'idle',
    url: `https://example.com/${id}.mp3`,
    defaultSelected: selected,
  };
}

function makeImage(id: string, selected = false): ImageItem {
  return {
    id,
    alt: `image ${id}`,
    src: `https://example.com/${id}.jpg`,
    defaultSelected: selected,
  };
}

describe('useDictionaryToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockReset();
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_LOCAL_AUDIO) {
        return { success: true, data: { items: [] } } as T;
      }
      if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
        return { success: true, data: { items: [] } } as T;
      }
      if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
        return { success: true, data: {} } as T;
      }
      if (message.type === MESSAGE_TYPES.FETCH_IMAGES) {
        return { success: true, data: { items: [] } } as T;
      }
      return { success: true } as T;
    });
    mockTranslateSentence.mockReset();
    mockTranslateSentence.mockResolvedValue('');
  });

  it('starts with no active tab and empty media', () => {
    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    expect(result.current.activeTab).toBeNull();
    expect(result.current.audioItems).toHaveLength(0);
    expect(result.current.imageItems).toHaveLength(0);
    expect(result.current.translation).toBe('');
    expect(result.current.links.length).toBeGreaterThan(0);
  });

  it('computes external links from result and settings', () => {
    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    expect(result.current.links.length).toBeGreaterThan(0);
    expect(result.current.selectedLinkCount).toBe(result.current.links.length);
    expect(result.current.links[0].url).toContain('hello');
  });

  it('fetches audio when the audio tab is opened', async () => {
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
        return { success: true, data: { items: [makeAudio('a1', true)] } } as T;
      }
      if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
        return { success: false, error: 'tts failed' } as T;
      }
      return { success: true } as T;
    });

    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('audio'); });

    await waitFor(() => expect(result.current.audioItems.length).toBe(1));
    expect(result.current.audioItems[0].id).toBe('a1');
    expect(result.current.selectedAudioCount).toBe(1);
  });

  it('includes local audio items when FETCH_LOCAL_AUDIO returns them', async () => {
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_LOCAL_AUDIO) {
        return { success: true, data: { items: [makeAudio('local-1', false, 'local'), makeAudio('local-2', false, 'local')] } } as T;
      }
      if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
        return { success: true, data: { items: [] } } as T;
      }
      if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
        return { success: false, error: 'tts failed' } as T;
      }
      return { success: true } as T;
    });

    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('audio'); });

    await waitFor(() => expect(result.current.audioItems.length).toBe(2));
    expect(result.current.audioItems[0].id).toBe('local-1');
  });

  it('fetches TTS of the sentence (not the term) for the sentence audio item', async () => {
    const ttsCalls: { text: string }[] = [];
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string; payload?: { text?: string } };
      if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
        return { success: true, data: { items: [] } } as T;
      }
      if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
        if (message.payload?.text) ttsCalls.push({ text: message.payload.text });
        return { success: true, data: { url: 'data:audio/wav;base64,AAA' } } as T;
      }
      return { success: true } as T;
    });

    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: 'hello world this is a sentence',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('audio'); });

    await waitFor(() => expect(result.current.audioItems.length).toBe(1));
    expect(ttsCalls.some((c) => c.text === 'hello world this is a sentence')).toBe(true);
    expect(ttsCalls.some((c) => c.text === 'hello')).toBe(false);
    const sentenceItem = result.current.audioItems.find((i) => i.kind === 'sentence');
    expect(sentenceItem?.url).toBe('data:audio/wav;base64,AAA');
  });

  it('fetches images when the image tab is opened', async () => {
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_IMAGES) {
        return { success: true, data: { items: [makeImage('i1'), makeImage('i2', true)] } } as T;
      }
      return { success: true } as T;
    });

    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('image'); });

    await waitFor(() => expect(result.current.imageItems.length).toBe(2));
    expect(result.current.imageItems[0].id).toBe('i1');
    expect(result.current.selectedImageCount).toBe(1);
  });

  it('translates on request and toggles selection', async () => {
    mockTranslateSentence.mockResolvedValue('xin chào');

    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: 'hello world',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('translate'); });
    act(() => { void result.current.translate(); });

    await waitFor(() => expect(result.current.translation).toBe('xin chào'));
    expect(result.current.selectedTranslationCount).toBe(0);

    act(() => { result.current.toggleTranslation(); });
    expect(result.current.selectedTranslationCount).toBe(1);
  });

  it('resets media state when result changes', async () => {
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
        return { success: true, data: { items: [makeAudio('a1', true)] } } as T;
      }
      if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
        return { success: false, error: 'tts failed' } as T;
      }
      return { success: true } as T;
    });

    const { result, rerender } = renderHook(
      ({ result: r }) => useDictionaryToolbar({ result: r, contextSentence: '', sourceLang: 'en', targetLang: 'vi' }),
      { initialProps: { result: makeResult('hello') } },
    );

    act(() => { result.current.setActiveTab('audio'); });
    await waitFor(() => expect(result.current.audioItems.length).toBe(1));

    rerender({ result: makeResult('world') });

    await waitFor(() => expect(result.current.activeTab).toBeNull());
    expect(result.current.audioItems).toHaveLength(0);
    expect(result.current.selectedAudioCount).toBe(0);
  });

  it('toggles audio and image selection and updates counts', async () => {
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
        return { success: true, data: { items: [makeAudio('a1', true)] } } as T;
      }
      if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
        return { success: false, error: 'tts failed' } as T;
      }
      if (message.type === MESSAGE_TYPES.FETCH_IMAGES) {
        return { success: true, data: { items: [makeImage('i1')] } } as T;
      }
      return { success: true } as T;
    });

    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('audio'); });
    await waitFor(() => expect(result.current.audioItems.length).toBe(1));

    act(() => { result.current.toggleAudio('a1', false); });
    expect(result.current.selectedAudioCount).toBe(0);

    act(() => { result.current.setActiveTab('image'); });
    await waitFor(() => expect(result.current.imageItems.length).toBe(1));

    act(() => { result.current.toggleImage('i1', true); });
    expect(result.current.selectedImageCount).toBe(1);
  });

  it('removes a broken image item', async () => {
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_IMAGES) {
        return { success: true, data: { items: [makeImage('i1', true)] } } as T;
      }
      return { success: true } as T;
    });

    const { result } = renderHook(() => useDictionaryToolbar({
      result: makeResult('hello'),
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('image'); });
    await waitFor(() => expect(result.current.imageItems.length).toBe(1));

    act(() => { result.current.removeImageItem('i1'); });
    expect(result.current.imageItems).toHaveLength(0);
    expect(result.current.selectedImageCount).toBe(0);
  });
});
