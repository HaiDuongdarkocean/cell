import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { LookupResult, PopupTab } from '../types';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import { useDictionaryPanel } from './useDictionaryPanel';
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

describe('useDictionaryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true, data: [] });
  });

  it('searches initialTerm on mount', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });
    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi', initialTerm: 'hello' }));

    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: expect.objectContaining({
        request: expect.objectContaining({ term: 'hello', fallback: true }),
      }),
    }));
  });

  it('exposes currentResult, candidates and status after a successful lookup', async () => {
    const winner = makeResult('hello', { status: 'known' });
    const candidate = makeResult('hell');
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });

    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates[0].term).toBe('hell');
    expect(result.current.status).toBe('known');
  });

  it('exposes error and stops loading on failed lookup', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, error: 'lookup failed' });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });

    await waitFor(() => expect(result.current.error).toBe('lookup failed'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.currentResult).toBeNull();
  });

  it('cancels the previous lookup before starting a new search', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    act(() => { result.current.search('world'); });

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.LOOKUP_CANCEL,
    })));
  });

  it('switches active candidate via setActiveCandidate', async () => {
    const winner = makeResult('hello');
    const candidate = makeResult('hell');
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    act(() => { result.current.setActiveCandidate(1); });
    expect(result.current.currentResult?.term).toBe('hell');
    expect(result.current.activeCandidateIndex).toBe(1);
  });

  it('cycles status and sends WORD_STATUS_SET', async () => {
    const winner = makeResult('hello', { status: 'unknown' });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });
    mockSendMessage.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    act(() => { result.current.cycleStatus(); });

    expect(result.current.status).toBe('tracking');
    expect(result.current.currentResult?.status).toBe('tracking');
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.WORD_STATUS_SET,
      payload: { term: 'hello', langCode: 'en', status: 'tracking' },
    }));
  });

  it('translates search term and includes translation in sendToCard prefill', async () => {
    const winner = makeResult('hello');
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });
    mockTranslateSentence.mockResolvedValueOnce('xin chào');

    const onSendToCard = jest.fn();
    const { result } = renderHook(() => useDictionaryPanel({
      langCode: 'en', sourceLang: 'en', targetLang: 'vi', onSendToCard,
    }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    await act(async () => { result.current.translate(); });

    await waitFor(() => expect(result.current.translation).toBe('xin chào'));
    expect(mockTranslateSentence).toHaveBeenCalledWith('hello', 'en', 'vi');

    act(() => { result.current.sendToCard(); });
    const prefill = onSendToCard.mock.calls[0][0] as PopupCardCreatorPrefill;
    expect(prefill.term).toBe('hello');
    expect(prefill.translation).toBe('xin chào');
  });

  it('toggles active tab', () => {
    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.setActiveTab('translate' as PopupTab); });
    expect(result.current.activeTab).toBe('translate');

    act(() => { result.current.setActiveTab(null); });
    expect(result.current.activeTab).toBeNull();
  });

  it('initializes definition selection from defaultSelected and toggles it', async () => {
    const winner = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
        { id: 'd2', pos: 'v', text: 'to greet', examples: [], source: 'test', defaultSelected: false },
      ],
    });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    expect(result.current.definitionSelection.get('d1')).toBe(true);
    expect(result.current.definitionSelection.get('d2')).toBe(false);
    expect(result.current.selectedDefinitions).toHaveLength(1);
    expect(result.current.selectedDefinitions[0].id).toBe('d1');

    act(() => { result.current.toggleDefinition('d2', true); });
    expect(result.current.definitionSelection.get('d2')).toBe(true);
    expect(result.current.selectedDefinitions).toHaveLength(2);
  });

  it('resets definition selection when switching candidates', async () => {
    const winner = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
      ],
    });
    const candidate = makeResult('hell', {
      definitions: [
        { id: 'c1', pos: 'n', text: 'place', examples: [], source: 'test', defaultSelected: false },
      ],
    });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    act(() => { result.current.setActiveCandidate(1); });
    expect(result.current.currentResult?.term).toBe('hell');
    expect(result.current.definitionSelection.has('d1')).toBe(false);
    expect(result.current.definitionSelection.get('c1')).toBe(false);
    expect(result.current.selectedDefinitions).toHaveLength(0);
  });

  it('uses selected definitions in sendToCard prefill and falls back to all when none selected', async () => {
    const winner = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
        { id: 'd2', pos: 'v', text: 'to greet', examples: [], source: 'test', defaultSelected: false },
      ],
    });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });

    const onSendToCard = jest.fn();
    const { result } = renderHook(() => useDictionaryPanel({
      langCode: 'en', sourceLang: 'en', targetLang: 'vi', onSendToCard,
    }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    act(() => { result.current.sendToCard(); });
    let prefill = onSendToCard.mock.calls[0][0] as PopupCardCreatorPrefill;
    expect(prefill.definitions).toEqual([{ pos: 'n', text: 'greeting' }]);

    act(() => { result.current.toggleDefinition('d1', false); });
    act(() => { result.current.toggleDefinition('d2', true); });
    act(() => { result.current.sendToCard(); });
    prefill = onSendToCard.mock.calls[1][0] as PopupCardCreatorPrefill;
    expect(prefill.definitions).toEqual([{ pos: 'v', text: 'to greet' }]);

    act(() => { result.current.toggleDefinition('d2', false); });
    act(() => { result.current.sendToCard(); });
    prefill = onSendToCard.mock.calls[2][0] as PopupCardCreatorPrefill;
    expect(prefill.definitions).toEqual([
      { pos: 'n', text: 'greeting' },
      { pos: 'v', text: 'to greet' },
    ]);
  });

  it('builds candidate actions from the requested candidate at click time', async () => {
    const winner = makeResult('hello', {
      definitions: [{ id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true }],
    });
    const candidate = makeResult('hi', {
      reading: 'haɪ',
      readingKind: 'ipa',
      definitions: [{ id: 'd2', pos: 'interj', text: 'an informal greeting', examples: [], source: 'test', defaultSelected: true }],
    });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] });

    const onSendToCard = jest.fn();
    const onQuickAdd = jest.fn();
    const { result } = renderHook(() => useDictionaryPanel({
      langCode: 'en', sourceLang: 'en', targetLang: 'vi', onSendToCard, onQuickAdd,
    }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    act(() => { result.current.sendCandidateToCard(1); });
    act(() => { result.current.quickAddCandidate(1); });

    expect((onSendToCard.mock.calls[0][0] as PopupCardCreatorPrefill).term).toBe('hi');
    expect((onSendToCard.mock.calls[0][0] as PopupCardCreatorPrefill).definitions).toEqual([{ pos: 'interj', text: 'an informal greeting' }]);
    expect((onQuickAdd.mock.calls[0][0] as PopupCardCreatorPrefill).term).toBe('hi');
    expect(result.current.currentResult?.term).toBe('hello');
  });

  it('calls onQuickAdd with prefill and is no-op when absent', async () => {
    const winner = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
      ],
    });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });

    const onQuickAdd = jest.fn();
    const { result } = renderHook(() => useDictionaryPanel({
      langCode: 'en', sourceLang: 'en', targetLang: 'vi', onQuickAdd,
    }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    act(() => { result.current.quickAdd(); });
    const prefill = onQuickAdd.mock.calls[0][0] as PopupCardCreatorPrefill;
    expect(prefill.term).toBe('hello');
    expect(prefill.definitions).toEqual([{ pos: 'n', text: 'greeting' }]);

    const { result: noOpResult } = renderHook(() => useDictionaryPanel({
      langCode: 'en', sourceLang: 'en', targetLang: 'vi',
    }));
    expect(() => act(() => { noOpResult.current.quickAdd(); })).not.toThrow();
  });
});
