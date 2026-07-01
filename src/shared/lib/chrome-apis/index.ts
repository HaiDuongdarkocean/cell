/**
 * chrome.* API adapters (shared infrastructure).
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Features/ + shared/ callers MUST import from this barrel, not use
 * chrome.* directly.
 */
export * from './storage';
export * from './runtime';
export * from './tabs';
export * from './downloads';
export * from './webRequest';
export * from './offscreen';
export * from './sidePanel';
export * from './action';
export * from './windows';
