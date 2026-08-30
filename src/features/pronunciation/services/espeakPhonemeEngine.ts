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

async function defaultInit(): Promise<ReturnType<EspeakEngineInitializer> extends Promise<infer T> ? T : never> {
  const dataResp = await fetch(dataUrl);
  const archive = await dataResp.arrayBuffer();
  const engine = await createESpeak({
    moduleFactory: initWasm,
    moduleOverrides: { locateFile: () => wasmUrl },
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
