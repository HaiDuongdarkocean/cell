import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';

jest.mock('@/shared/lib/chrome-apis', () => ({
  sendMessage: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock('@/features/subtitle', () => ({
  cacheSubtitleBody: jest.fn(),
}));

jest.mock('./debugLog', () => ({
  isCellDebug: jest.fn(() => false),
}));

import { installMainWorldBridge } from './subtitleBridges';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { cacheSubtitleBody } from '@/features/subtitle';
import { MESSAGE_TYPES } from '@/shared/config/messages';

const mockSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;
const mockCache = cacheSubtitleBody as jest.MockedFunction<typeof cacheSubtitleBody>;

const REAL_ORIGIN = 'https://host.example';
const FRAME_ORIGIN = 'https://player.example';

function dispatchDiscovery(signal: unknown, origin: string): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: '__CELL_SUBTITLE_DISCOVERY', signal },
      origin,
    }),
  );
}

function validNetworkSignal(): Record<string, unknown> {
  return {
    kind: 'network-response',
    url: 'https://cdn.example/subs/en.vtt?token=abc',
    body: 'WEBVTT\n\n00:00.000 --> 00:01.000\nhello',
    tabId: 0,
    frameId: 0,
    initiator: 'https://forged.example',
    method: 'GET',
    type: 'xmlhttprequest',
  };
}

function lastDiscoveryPayload(): {
  nonce: string;
  origin: string;
  signal: Record<string, unknown>;
} {
  const call = mockSendMessage.mock.calls
    .map((c) => c[0] as { type: string; payload: { nonce: string; origin: string; signal: Record<string, unknown> } })
    .find((m) => m.type === MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL);
  expect(call).toBeDefined();
  return call!.payload;
}

describe('installMainWorldBridge __CELL_SUBTITLE_DISCOVERY', () => {
  beforeAll(() => {
    installMainWorldBridge();
  });

  beforeEach(() => {
    mockSendMessage.mockClear();
    mockCache.mockClear();
  });

  it('accepts a valid network-response signal, re-origins it, caches and forwards with a nonce', () => {
    dispatchDiscovery(validNetworkSignal(), FRAME_ORIGIN);

    expect(mockCache).toHaveBeenCalledWith(
      'https://cdn.example/subs/en.vtt?token=abc',
      'WEBVTT\n\n00:00.000 --> 00:01.000\nhello',
    );

    const payload = lastDiscoveryPayload();
    expect(payload.origin).toBe(FRAME_ORIGIN);
    expect(payload.signal.initiator).toBe(FRAME_ORIGIN);
    expect(typeof payload.nonce).toBe('string');
    expect(payload.nonce.length).toBeGreaterThanOrEqual(16);
  });

  it('overrides a forged player-state origin with event.origin', () => {
    dispatchDiscovery(
      {
        kind: 'player-state',
        origin: 'https://forged.example',
        payload: ['track'],
        tabId: 0,
        frameId: 0,
        initiator: 'https://forged.example',
        playerKey: 'the_subtitles',
      },
      REAL_ORIGIN,
    );

    const payload = lastDiscoveryPayload();
    expect(payload.signal.origin).toBe(REAL_ORIGIN);
    expect(payload.signal.initiator).toBe(REAL_ORIGIN);
    expect(mockCache).not.toHaveBeenCalled();
  });

  it('accepts same-window posts whose origin is location.origin', () => {
    dispatchDiscovery(validNetworkSignal(), window.location.origin);
    expect(mockCache).toHaveBeenCalled();
    expect(lastDiscoveryPayload().origin).toBe(window.location.origin);
  });

  it('drops signals from non-http or opaque origins', () => {
    for (const origin of ['null', 'about:blank', 'javascript:alert(1)', '']) {
      dispatchDiscovery(validNetworkSignal(), origin);
    }
    expect(mockCache).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('drops schema-invalid signals before cache and forward', () => {
    const invalid = [
      { kind: 'bogus-kind', url: 'https://x' },
      { kind: 'network-response', url: '', body: 'x', tabId: 0, frameId: 0 },
      { kind: 'network-response', url: 'https://x', tabId: -1, frameId: 0 },
      'not-an-object',
      null,
      undefined,
    ];
    for (const signal of invalid) {
      dispatchDiscovery(signal, FRAME_ORIGIN);
    }
    expect(mockCache).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('does not cache network-response signals with an empty body but still forwards', () => {
    dispatchDiscovery({ ...validNetworkSignal(), body: '' }, FRAME_ORIGIN);
    expect(mockCache).not.toHaveBeenCalled();
    expect(lastDiscoveryPayload().signal.kind).toBe('network-response');
  });

  it('generates a fresh nonce per forwarded signal', () => {
    dispatchDiscovery(validNetworkSignal(), FRAME_ORIGIN);
    const first = lastDiscoveryPayload().nonce;
    mockSendMessage.mockClear();
    dispatchDiscovery(validNetworkSignal(), FRAME_ORIGIN);
    const second = lastDiscoveryPayload().nonce;
    expect(first).not.toBe(second);
  });
});
