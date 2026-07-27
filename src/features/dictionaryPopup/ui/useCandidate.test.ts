import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { LookupResult, AudioItem, ImageItem } from '../types';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import { useCandidate } from './useCandidate';
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

function makeResult(term: string, overrides?: Partial<LookupResult>): LookupResult {
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

function makeAudio(id: string, kind: AudioItem['kind'], url: string, selected = false): AudioItem {
  return {
    id,
    kind,
    source: 'community',
    label: 'Test · US',
    state: 'idle',
    url,
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

describe('useCandidate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
      const message = msg as { type: string };
      if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
        return { success: true, data: { items: [makeAudio('a1', 'word', 'https://audio/1', true)] } } as T;
      }
      if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
        return { success: true, data: { url: 'https://audio/tts' } } as T;
      }
      if (message.type === MESSAGE_TYPES.FETCH_IMAGES) {
        return { success: true, data: { items: [makeImage('i1'), makeImage('i2')] } } as T;
      }
      return { success: true } as T;
    });
    mockTranslateSentence.mockResolvedValue('xin chào');
  });

  it('initializes state from candidate', () => {
    const candidate = makeResult('hello', {
      status: 'known',
      definitions: [{ id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true }],
    });

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: 'hello world',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    expect(result.current.status).toBe('known');
    expect(result.current.definitionSelection.get('d1')).toBe(true);
    expect(result.current.selectedDefinitionCount).toBe(1);
  });

  it('cycles status and sends WORD_STATUS_SET', () => {
    const candidate = makeResult('hello', { status: 'unknown' });

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.cycleStatus(); });

    expect(result.current.status).toBe('tracking');
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.WORD_STATUS_SET,
      payload: expect.objectContaining({ term: 'hello', langCode: 'en', status: 'tracking' }),
    }));
  });

  it('toggles definitions and updates selected count', () => {
    const candidate = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
        { id: 'd2', pos: 'v', text: 'to greet', examples: [], source: 'test', defaultSelected: false },
      ],
    });

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.toggleDefinition('d1', false); });
    act(() => { result.current.toggleDefinition('d2', true); });

    expect(result.current.definitionSelection.get('d1')).toBe(false);
    expect(result.current.definitionSelection.get('d2')).toBe(true);
    expect(result.current.selectedDefinitionCount).toBe(1);
  });

  it('fetches audio when audio tab is opened and exposes selected count', async () => {
    const candidate = makeResult('hello');

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('audio'); });

    await waitFor(() => expect(result.current.audioLoading).toBe(false));

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
    }));
    expect(result.current.audioItems.length).toBeGreaterThan(0);
    expect(result.current.selectedAudioCount).toBe(1);
  });

  it('fetches images when image tab is opened and exposes selected count', async () => {
    const candidate = makeResult('hello');

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('image'); });

    await waitFor(() => expect(result.current.imageLoading).toBe(false));

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_IMAGES,
    }));
    expect(result.current.imageItems.length).toBe(2);
    expect(result.current.selectedImageCount).toBe(0);
  });

  it('translates and includes translation in prefill', async () => {
    const candidate = makeResult('hello');
    const onSendToCard = jest.fn<(prefill: PopupCardCreatorPrefill) => void>();

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
      onSendToCard,
    }));

    await act(async () => { await result.current.translate(); });

    await waitFor(() => expect(result.current.translation).toBe('xin chào'));

    await act(async () => { await result.current.sendToCard(); });

    expect(onSendToCard).toHaveBeenCalledWith(expect.objectContaining({
      term: 'hello',
      translation: 'xin chào',
    }));
  });

  it('sendToCard auto-fetches audio, image, and translation without opening tabs', async () => {
    const candidate = makeResult('hello');
    const onSendToCard = jest.fn<(prefill: PopupCardCreatorPrefill) => void>();

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: 'hello world',
      sourceLang: 'en',
      targetLang: 'vi',
      onSendToCard,
    }));

    await act(async () => { await result.current.sendToCard(); });

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
    }));
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_IMAGES,
    }));
    expect(mockTranslateSentence).toHaveBeenCalledWith('hello world', 'en', 'vi');

    expect(onSendToCard).toHaveBeenCalledWith(expect.objectContaining({
      term: 'hello',
      contextSentence: 'hello world',
      translation: 'xin chào',
      wordAudioUrls: ['https://audio/1'],
      sentenceAudioUrls: ['https://audio/tts'],
      imageUrls: ['https://example.com/i1.jpg'],
    }));
  });

  it('toggles audio/image selection and updates badge counts', async () => {
    const candidate = makeResult('hello');

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: '',
      sourceLang: 'en',
      targetLang: 'vi',
    }));

    act(() => { result.current.setActiveTab('audio'); });
    await waitFor(() => expect(result.current.audioLoading).toBe(false));

    act(() => { result.current.toggleAudio('a1', false); });

    expect(result.current.selectedAudioCount).toBe(0);

    act(() => { result.current.setActiveTab('image'); });
    await waitFor(() => expect(result.current.imageLoading).toBe(false));

    const imageId = result.current.imageItems[0].id;
    act(() => { result.current.toggleImage(imageId, true); });

    expect(result.current.selectedImageCount).toBe(1);
  });

  it('quickAdd builds prefill with selected definitions', async () => {
    const candidate = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
      ],
    });
    const onQuickAdd = jest.fn<(prefill: PopupCardCreatorPrefill) => void>();

    const { result } = renderHook(() => useCandidate({
      candidate,
      contextSentence: 'hello world',
      sourceLang: 'en',
      targetLang: 'vi',
      onQuickAdd,
    }));

    await act(async () => { await result.current.quickAdd(); });

    expect(onQuickAdd).toHaveBeenCalledWith(expect.objectContaining({
      term: 'hello',
      definitions: [{ pos: 'n', text: 'greeting' }],
      contextSentence: 'hello world',
    }));
  });
});
