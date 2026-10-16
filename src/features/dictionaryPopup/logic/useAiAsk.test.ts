import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useAiAsk } from './useAiAsk';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { clearAiAnswerCache } from '@/features/aiBridge';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({ sendMessage: jest.fn() }));
const mockSend = jest.mocked(sendMessage);

const okResponse = (text: string, provider = 'chatgpt') => ({
  success: true,
  data: { text, provider },
});

beforeEach(() => {
  jest.clearAllMocks();
  clearAiAnswerCache();
});

describe('useAiAsk — tab-session cache', () => {
  it('serves the second ask from cache without messaging the background', async () => {
    mockSend.mockResolvedValue(okResponse('first answer') as never);
    const first = renderHook(() => useAiAsk());
    await act(async () => {
      await first.result.current.ask('wordExplain', 'p1', 'chatgpt');
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    first.unmount();

    // A fresh hook instance = popup reopened — same request hits the cache.
    const second = renderHook(() => useAiAsk());
    const cached = await act(async () => second.result.current.ask('wordExplain', 'p1', 'chatgpt'));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(cached?.text).toBe('first answer');
    expect(second.result.current.state.phase).toBe('answered');
    expect(second.result.current.answers.map((a) => a.text)).toContain('first answer');
  });

  it('misses on a different provider pick or prompt', async () => {
    mockSend.mockResolvedValue(okResponse('a') as never);
    const { result } = renderHook(() => useAiAsk());
    await act(async () => {
      await result.current.ask('wordExplain', 'p1', 'chatgpt');
    });
    await act(async () => {
      await result.current.ask('wordExplain', 'p1', 'gemini');
      await result.current.ask('wordExplain', 'p2', 'chatgpt');
    });
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('fresh=true regenerates and overwrites the cached answer', async () => {
    mockSend
      .mockResolvedValueOnce(okResponse('v1') as never)
      .mockResolvedValueOnce(okResponse('v2') as never);
    const { result } = renderHook(() => useAiAsk());
    await act(async () => {
      await result.current.ask('wordExplain', 'p1', 'chatgpt');
    });
    const next = await act(async () => result.current.ask('wordExplain', 'p1', 'chatgpt', true));
    expect(next?.text).toBe('v2');
    expect(mockSend).toHaveBeenCalledTimes(2);

    const third = renderHook(() => useAiAsk());
    const cached = await act(async () => third.result.current.ask('wordExplain', 'p1', 'chatgpt'));
    expect(cached?.text).toBe('v2');
  });

  it('sends AI_ASK with feature, prompt and provider payload', async () => {
    mockSend.mockResolvedValue(okResponse('x') as never);
    const { result } = renderHook(() => useAiAsk());
    await act(async () => {
      await result.current.ask('sentenceBreakdown', 'p', 'deepseek');
    });
    expect(mockSend).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.AI_ASK,
      payload: { prompt: 'p', provider: 'deepseek', feature: 'sentenceBreakdown' },
    });
  });
});
