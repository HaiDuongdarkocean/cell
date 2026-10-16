import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { useAiAsk } from './useAiAsk';

type StreamListener = (msg: unknown, sender?: unknown, respond?: unknown) => void;

const g = globalThis as {
  __TihokaSendMessage?: (m: unknown) => Promise<unknown>;
  __TihokaOnMessageListeners?: Set<StreamListener>;
};

function pushMessage(msg: unknown): void {
  g.__TihokaOnMessageListeners?.forEach((l) => l(msg, {}, () => {}));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  delete g.__TihokaSendMessage;
});

describe('useAiAsk streaming', () => {
  it('renders AI_STREAM partials for the matching askId while loading', async () => {
    let askIdSeen = '';
    let resolveAsk!: (v: unknown) => void;
    g.__TihokaSendMessage = (m) => {
      askIdSeen = (m as { payload: { askId: string } }).payload.askId;
      return new Promise((res) => {
        resolveAsk = res;
      });
    };
    const { result } = renderHook(() => useAiAsk());
    let askPromise!: Promise<unknown>;
    await act(async () => {
      askPromise = result.current.ask('wordExplain', 'prompt text', 'chatgpt');
      await Promise.resolve();
    });
    expect(result.current.state.phase).toBe('loading');
    expect(result.current.state.answer).toBeNull();

    act(() => {
      pushMessage({
        type: MESSAGE_TYPES.AI_STREAM,
        payload: { askId: 'other-ask', provider: 'chatgpt', text: 'ignored' },
      });
      pushMessage({
        type: MESSAGE_TYPES.AI_STREAM,
        payload: { askId: askIdSeen, provider: 'chatgpt', text: 'partial one' },
      });
    });
    expect(result.current.state.phase).toBe('loading');
    expect(result.current.state.answer?.text).toBe('partial one');
    expect(result.current.state.provider).toBe('chatgpt');

    await act(async () => {
      resolveAsk({ success: true, data: { text: 'final text', provider: 'chatgpt' } });
      await askPromise;
    });
    expect(result.current.state.phase).toBe('answered');
    expect(result.current.state.answer?.text).toBe('final text');

    act(() => {
      pushMessage({
        type: MESSAGE_TYPES.AI_STREAM,
        payload: { askId: askIdSeen, provider: 'chatgpt', text: 'late chunk' },
      });
    });
    expect(result.current.state.answer?.text).toBe('final text');
  });
});
