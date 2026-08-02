// Unit tests for the SUBTITLE_DISCOVERY_SIGNAL handler.

import { registerSubtitleDiscoveryHandlers } from '@/entrypoints/background/handlers/subtitleDiscovery';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '@/entrypoints/background/context';
import type { MessageRequest } from '@/entities/message';

function makeMockContext(processSignal = jest.fn()): BackgroundContext {
  return {
    on: jest.fn(),
    subtitleDiscoveryService: { processSignal } as unknown as BackgroundContext['subtitleDiscoveryService'],
    // Minimal cast to satisfy type; only on/subtitleDiscoveryService are used.
  } as unknown as BackgroundContext;
}

function getHandler(ctx: BackgroundContext) {
  // The handler is registered by registerSubtitleDiscoveryHandlers. We trigger it directly
  // by calling the function passed to ctx.on for the signal type.
  const on = ctx.on as jest.Mock;
  const call = on.mock.calls.find(([type]) => type === MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL);
  if (!call) throw new Error('SUBTITLE_DISCOVERY_SIGNAL handler not registered');
  return call[1] as (request: MessageRequest) => Promise<unknown>;
}

describe('registerSubtitleDiscoveryHandlers', () => {
  it('validates payload and calls processSignal with the signal and metadata', async () => {
    const processSignal = jest.fn().mockResolvedValue(undefined);
    const ctx = makeMockContext(processSignal);
    registerSubtitleDiscoveryHandlers(ctx);
    const handler = getHandler(ctx);

    const request: MessageRequest = {
      type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
      payload: {
        nonce: 'n1n2n3n4n5n6n7n8',
        origin: 'https://example.com',
        signal: {
          kind: 'network-response',
          url: 'https://example.com/list.json',
          body: '[]',
          tabId: 1,
          frameId: 0,
          initiator: 'https://example.com',
        },
      },
    };

    const response = await handler(request) as { success: boolean; data?: { processed: string } };
    expect(response).toEqual({ success: true, data: { processed: 'network-response' } });
    expect(processSignal).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'network-response' }),
      1,
      0,
      'https://example.com',
    );
  });

  it('rejects invalid payload with a clear error', async () => {
    const processSignal = jest.fn();
    const ctx = makeMockContext(processSignal);
    registerSubtitleDiscoveryHandlers(ctx);
    const handler = getHandler(ctx);

    const response = await handler({ type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL, payload: {} }) as { success: boolean };
    expect(response.success).toBe(false);
    expect(processSignal).not.toHaveBeenCalled();
  });
});
