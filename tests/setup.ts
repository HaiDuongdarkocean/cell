import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';

// Use the project's stable `data-cell-id` attribute as the test id selector
// instead of the default `data-testid`.
configure({ testIdAttribute: 'data-cell-id' });

// Polyfill structuredClone for jsdom (Node has it, jsdom env doesn't expose).
// Used by fake-indexeddb for cloning values during IDB operations.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (val: unknown): unknown => {
    return JSON.parse(JSON.stringify(val));
  };
}

// Polyfill TextEncoder/TextDecoder for jsdom (used by fflate + signature tests).
if (typeof globalThis.TextEncoder !== 'function') {
  globalThis.TextEncoder = require('util').TextEncoder;
  globalThis.TextDecoder = require('util').TextDecoder;
}

// Mock HTMLMediaElement.prototype.play for jsdom (used by popupDictionaryController
// audio playback tests). jsdom throws "Not implemented" synchronously, which
// clutters test output; the production code already catches play() failures.
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = jest.fn();
}

// Polyfill AudioContext + fetch for PronunciationPanel decodeAudioUrl tests in jsdom.
if (typeof globalThis.AudioContext === 'undefined') {
  globalThis.AudioContext = jest.fn().mockImplementation(() => ({
    decodeAudioData: jest.fn().mockResolvedValue({
      numberOfChannels: 1,
      length: 22050,
      sampleRate: 22050,
      duration: 1,
      getChannelData: jest.fn().mockReturnValue(new Float32Array(22050).fill(0)),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })) as unknown as typeof AudioContext;
}

if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  }) as unknown as typeof fetch;
}

// Polyfill ResizeObserver for jsdom (used by OrbitalBadge to detect scrollbar
// appearance). No-op by default; tests that need to trigger it override this.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })) as unknown as typeof ResizeObserver;
}

// Polyfill crypto.subtle for jsdom (used by signatureGenerator SHA-256).
// jsdom doesn't expose crypto.subtle — use Node's webcrypto.
import nodeCrypto from 'node:crypto';
const existingCrypto = globalThis.crypto as Crypto | undefined;
if (!existingCrypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: nodeCrypto.webcrypto.subtle,
      getRandomValues: (arr: Uint8Array) => nodeCrypto.randomFillSync(arr),
    },
    writable: true,
    configurable: true,
  });
}

// Polyfill URL.createObjectURL/revokeObjectURL for jsdom (used by local audio blob URLs).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
  URL.revokeObjectURL = () => {};
}
