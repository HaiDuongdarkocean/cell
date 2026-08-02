// Unit tests for MessageBus subtitle-discovery sender injection.

import { MessageBus } from '@/entrypoints/background/messageBus';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageRequest, MessageResponse } from '@/types/message';

describe('MessageBus subtitle discovery injection', () => {
  it('injects tabId and frameId into SUBTITLE_DISCOVERY_SIGNAL from sender', async () => {
    const bus = new MessageBus();
    const handler = jest.fn(async (req: MessageRequest): Promise<MessageResponse> => {
      const signal = (req.payload as { signal: { tabId: number; frameId: number } }).signal;
      return { success: true, data: { tabId: signal.tabId, frameId: signal.frameId } };
    });

    bus.on(MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL, handler);

    const request: MessageRequest = {
      type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
      payload: {
        nonce: 'n1n2n3n4n5n6n7n8',
        origin: 'https://example.com',
        signal: {
          kind: 'player-state',
          origin: 'https://example.com',
          payload: [],
          playerKey: 'the_subtitles',
          tabId: 0,
          frameId: 0,
        },
      },
    };

    const sender = { tab: { id: 42 }, frameId: 5, origin: 'https://example.com' };
    const response = await bus.handleMessage(request, sender as unknown as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const handledPayload = handler.mock.calls[0][0].payload as { signal: { tabId: number; frameId: number } };
    expect(handledPayload.signal.tabId).toBe(42);
    expect(handledPayload.signal.frameId).toBe(5);
  });

  it('preserves existing tabId and frameId if they are non-zero', async () => {
    const bus = new MessageBus();
    const handler = jest.fn(async (req: MessageRequest): Promise<MessageResponse> => {
      const signal = (req.payload as { signal: { tabId: number; frameId: number } }).signal;
      return { success: true, data: { tabId: signal.tabId, frameId: signal.frameId } };
    });

    bus.on(MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL, handler);

    const request: MessageRequest = {
      type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
      payload: {
        nonce: 'n1n2n3n4n5n6n7n8',
        origin: 'https://example.com',
        signal: {
          kind: 'network-response',
          url: 'https://example.com/list',
          body: '[]',
          tabId: 7,
          frameId: 2,
        },
      },
    };

    const sender = { tab: { id: 42 }, frameId: 5 };
    const response = await bus.handleMessage(request, sender as unknown as chrome.runtime.MessageSender);

    expect(response.success).toBe(true);
    const handledPayload = handler.mock.calls[0][0].payload as { signal: { tabId: number; frameId: number } };
    expect(handledPayload.signal.tabId).toBe(7);
    expect(handledPayload.signal.frameId).toBe(2);
  });
});
