import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { LookupResult, WordStatus } from '../types';
import { useDictionaryPanel } from './useDictionaryPanel';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

const mockSendMessage = jest.mocked(sendMessage);

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

  it('exposes currentResult, candidates and contextSentence after a successful lookup', async () => {
    const winner = makeResult('hello');
    const candidate = makeResult('hell');
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] });

    const { result } = renderHook(() => useDictionaryPanel({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });

    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates[0].term).toBe('hell');
    expect(result.current.contextSentence).toBe('hello');
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

  it('applies getTokenStatus fallback to the initial result', () => {
    const getTokenStatus = (): WordStatus => 'known';
    const { result } = renderHook(() => useDictionaryPanel({
      langCode: 'en',
      sourceLang: 'en',
      targetLang: 'vi',
      initialResult: makeResult('hello', { status: 'unknown' }),
      getTokenStatus,
    }));

    expect(result.current.currentResult?.status).toBe('known');
  });

  it('syncs external status to the current result', async () => {
    const winner = makeResult('hello', { status: 'unknown' });
    const syncStatus = { term: 'hello', status: 'known' as const };
    const { result } = renderHook(() => useDictionaryPanel({
      langCode: 'en',
      sourceLang: 'en',
      targetLang: 'vi',
      initialResult: winner,
      syncStatus,
    }));

    await waitFor(() => expect(result.current.currentResult?.status).toBe('known'));
  });
});
