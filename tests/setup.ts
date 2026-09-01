import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';

// Use the project's stable `data-cell-id` attribute as the test id selector
// instead of the default `data-testid`.
configure({ testIdAttribute: 'data-cell-id' });

// Polyfill structuredClone for jsdom (Node has it, jsdom env doesn't expose).
// Used by fake-indexeddb for cloning values during IDB operations.
import { deserialize, serialize } from 'node:v8';
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (val: unknown): unknown => {
    return deserialize(serialize(val));
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

// Polyfill document.elementFromPoint for jsdom (not implemented).
// Returns document.body as fallback — production code already handles null
// via `document.elementFromPoint(x, y) ?? document.body`.
if (typeof document !== 'undefined' && typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = (_x: number, _y: number): Element | null => document.body;
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
