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
});
