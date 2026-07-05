import '@testing-library/jest-dom';

// Polyfill structuredClone for jsdom (Node has it, jsdom env doesn't expose).
// Used by fake-indexeddb for cloning values during IDB operations.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (val: unknown): unknown => {
    return JSON.parse(JSON.stringify(val));
  };
}
