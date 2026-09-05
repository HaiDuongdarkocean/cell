import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDictionaryLookup } from './useDictionaryLookup';

const mockSendMessage = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

function makeResult(term: string, overrides: Partial<import('../types').LookupResult> = {}): import('../types').LookupResult {
  return {
    term,
    langCode: 'en',
    reading: '',
    pos: 'n.',
    status: 'unknown',
    definitions: [],
    candidates: [],
    ...overrides,
  } as import('../types').LookupResult;
}

describe('useDictionaryLookup', () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
  });

  it('is not loading and has no result before any search', () => {
    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.currentResult).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.candidates).toEqual([]);
  });

  it('searches initialTerm on mount', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });
    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi', initialTerm: 'hello' }));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentResult?.term).toBe('hello');
    expect(result.current.latestSearchedTerm).toBe('hello');
  });

  it('exposes currentResult, candidates and status after a successful lookup', async () => {
    const winner = makeResult('hello', { status: 'known' });
    const candidate = makeResult('hello there');
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] });

    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello there'); });
    await waitFor(() => expect(result.current.currentResult?.term).toBe('hello'));

    expect(result.current.candidates.length).toBe(1);
    expect(result.current.candidates[0].term).toBe('hello there');
    expect(result.current.status).toBe('known');
  });

  it('exposes error and stops loading on failed lookup', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, error: 'lookup failed' });

    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('missing'); });
    await waitFor(() => expect(result.current.error).toBe('lookup failed'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.currentResult).toBeNull();
  });

  it('cancels the previous lookup before starting a new search', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('first')] }); // first LOOKUP_REQUEST
    mockSendMessage.mockResolvedValueOnce({}); // LOOKUP_CANCEL
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('second')] }); // second LOOKUP_REQUEST

    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('first'); });
    act(() => { result.current.search('second'); });

    await waitFor(() => expect(result.current.currentResult?.term).toBe('second'));

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOOKUP_CANCEL',
      }),
    );
  });

  it('switches active candidate via setActiveCandidate', async () => {
    const winner = makeResult('hello');
    const candidate = makeResult('hello there');
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] });

    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello there'); });
    await waitFor(() => expect(result.current.candidates.length).toBe(1));

    act(() => { result.current.setActiveCandidate(1); });
    expect(result.current.currentResult?.term).toBe('hello there');
    expect(result.current.activeCandidateIndex).toBe(1);
  });

  it('cycles status and sends WORD_STATUS_SET', async () => {
    const winner = makeResult('hello', { status: 'unknown' });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });
    mockSendMessage.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult).not.toBeNull());

    act(() => { result.current.cycleStatus(); });

    expect(result.current.status).toBe('tracking');
    expect(mockSendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'WORD_STATUS_SET',
        payload: { term: 'hello', langCode: 'en', status: 'tracking' },
      }),
    );
  });

  it('initializes definition selection empty and toggles it', async () => {
    const winner = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n.', text: 'greeting', defaultSelected: true, source: 'test', examples: [] },
        { id: 'd2', pos: 'n.', text: 'salutation', defaultSelected: false, source: 'test', examples: [] },
      ],
    });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });

    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult).not.toBeNull());

    expect(result.current.definitionSelection.get('d1')).toBe(false);
    expect(result.current.definitionSelection.get('d2')).toBe(false);
    expect(result.current.selectedDefinitions).toEqual([]);

    act(() => { result.current.toggleDefinition('d2', true); });
    expect(result.current.selectedDefinitions.map((d) => d.id)).toEqual(['d2']);
  });

  it('resets all state on reset()', async () => {
    const winner = makeResult('hello');
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner] });

    const { result } = renderHook(() => useDictionaryLookup({ langCode: 'en', sourceLang: 'en', targetLang: 'vi' }));

    act(() => { result.current.search('hello'); });
    await waitFor(() => expect(result.current.currentResult).not.toBeNull());

    act(() => { result.current.reset(); });

    expect(result.current.currentResult).toBeNull();
    expect(result.current.candidates).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
