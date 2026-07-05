import '@testing-library/jest-dom';

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
