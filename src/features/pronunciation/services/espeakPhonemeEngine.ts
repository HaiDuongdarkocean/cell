import { createESpeak } from '@jocelyn-stericker/espeak-phonemes';
import type { IPAPhonemeOptions } from '@jocelyn-stericker/espeak-phonemes';
import initWasm from '@jocelyn-stericker/espeak-phonemes/espeak-phonemes.js';
import wasmUrl from '@jocelyn-stericker/espeak-phonemes/espeak-phonemes.wasm?url';
import dataUrl from '@jocelyn-stericker/espeak-phonemes/espeak-ng-data.tar?url';

/**
 * Minimal eSpeak phoneme engine surface used by the pronunciation engine.
 * Abstracts over the underlying WASM initialization.
 */
export interface EspeakPhonemeEngine {
  /** Convert text to an IPA string. */
  readonly toIpa: (text: string, opts?: IPAPhonemeOptions) => Promise<string>;
}

/**
 * Injectable factory for the low-level eSpeak phoneme engine.
 * Used in tests to avoid loading real WASM in jsdom/Jest.
 */
export interface EspeakEngineInitializer {
  (): Promise<{
    readonly textToIPA: (text: string, opts?: IPAPhonemeOptions) => string;
  }>;
}

function resolveExtensionUrl(relativeUrl: string): string {
  // Vite's ?url import returns a root-relative path (e.g. /assets/...wasm).
  // In an extension content script, fetch() resolves it against the host page
  // and gets a 404. Use chrome.runtime.getURL() to get the chrome-extension
  // absolute URL when available.
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relativeUrl.replace(/^\//, ''));
  }
  return relativeUrl;
}

async function defaultInit(): Promise<ReturnType<EspeakEngineInitializer> extends Promise<infer T> ? T : never> {
  const dataResp = await fetch(resolveExtensionUrl(dataUrl));
  const archive = await dataResp.arrayBuffer();
  const engine = await createESpeak({
    moduleFactory: initWasm,
    moduleOverrides: { locateFile: () => resolveExtensionUrl(wasmUrl) },
    data: { archive },
  });
  return engine;
}

/**
 * Create the English IPA/phoneme engine backed by @jocelyn-stericker/espeak-phonemes.
 *
 * The engine is lazily initialized on first `toIpa` call and reused afterward.
 */
export function createEspeakPhonemeEngine(
  init: EspeakEngineInitializer = defaultInit,
): EspeakPhonemeEngine {
  let engine: { textToIPA: (text: string, opts?: IPAPhonemeOptions) => string } | null = null;

  return {
    async toIpa(text, opts) {
      if (!engine) {
        engine = await init();
      }
      return engine.textToIPA(text, opts);
    },
  };
}
