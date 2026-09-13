// ttsEngineService — spec popup-dictionary-4tab-logic: chrome.tts + Web Speech fallback.
//
// Cross-browser TTS abstraction. `createTtsEngine()` tries chrome.tts first
// (extension-only API, higher quality on Chrome desktop), then falls back to
// the Web Speech API (`speechSynthesis`) available in any browser context.
//
// `getTtsVoiceRows()` is pure logic: given user-saved voices + the full voice
// list from the engine, returns the ordered display rows (saved → sort by
// order; empty → auto-detect by langCode prefix).

import type { TtsVoiceRow } from '@/entities/settings/types';

/** Minimal voice descriptor shared by both engines. */
export interface TtsVoiceInfo {
  readonly voiceName: string;
  readonly lang: string;
}

/** Options passed to `TtsEngine.speak`. */
export interface TtsSpeakOptions {
  readonly voiceName?: string;
  readonly langCode?: string;
  readonly rate?: number;
  readonly pitch?: number;
}

/** Engine-agnostic TTS interface (chrome.tts or Web Speech). */
export interface TtsEngine {
  speak(text: string, opts: TtsSpeakOptions): Promise<void>;
  getVoices(): Promise<readonly TtsVoiceInfo[]>;
  stop(): void;
}

// --- chrome.tts engine ---

/** Minimal chrome.tts surface we depend on (avoids coupling to full types). */
interface ChromeTtsApi {
  speak(
    utterance: string,
    options: {
      voiceName?: string;
      lang?: string;
      rate?: number;
      pitch?: number;
      onEvent?: (event: { type: string; errorMessage?: string }) => void;
    },
  ): void;
  getVoices(callback: (voices: ReadonlyArray<{ voiceName: string; lang: string }>) => void): void;
  stop(): void;
}

function getChromeTtsApi(): ChromeTtsApi | undefined {
  if (typeof chrome === 'undefined') return undefined;
  const c = (chrome as { tts?: ChromeTtsApi }).tts;
  return c;
}

/** Speak timeout (ms). chrome.tts may never fire `end` when the engine errors
 *  or no voice matches — without this the promise hangs forever. */
const SPEAK_TIMEOUT_MS = 10000;

/** Create a TtsEngine backed by the chrome.tts extension API. */
export function createChromeTtsEngine(): TtsEngine {
  const api = getChromeTtsApi();
  if (!api) {
    throw new Error('chrome.tts is not available in this context');
  }
  return {
    speak(text, opts) {
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          api.stop();
          reject(new Error('TTS speak timeout'));
        }, SPEAK_TIMEOUT_MS);
        api.speak(text, {
          voiceName: opts.voiceName,
          lang: opts.langCode,
          rate: opts.rate,
          pitch: opts.pitch,
          onEvent(event) {
            if (event.type === 'end') {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              resolve();
            } else if (event.type === 'error') {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              reject(new Error(event.errorMessage ?? 'chrome.tts error'));
            }
          },
        });
      });
    },
    getVoices() {
      return new Promise<readonly TtsVoiceInfo[]>((resolve) => {
        api.getVoices((voices) => {
          resolve(
            voices.map((v) => ({ voiceName: v.voiceName, lang: v.lang })),
          );
        });
      });
    },
    stop() {
      api.stop();
    },
  };
}

// --- Web Speech engine ---

/** Minimal SpeechSynthesis surface we depend on. */
interface WebSpeechApi {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

function getWebSpeechApi(): WebSpeechApi | undefined {
  if (typeof speechSynthesis === 'undefined') return undefined;
  return speechSynthesis as unknown as WebSpeechApi;
}

/** Create a TtsEngine backed by the Web Speech API (speechSynthesis). */
export function createWebSpeechEngine(): TtsEngine {
  const api = getWebSpeechApi();
  if (!api) {
    throw new Error('speechSynthesis is not available in this context');
  }
  return {
    speak(text, opts) {
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          api.cancel();
          reject(new Error('TTS speak timeout'));
        }, SPEAK_TIMEOUT_MS);
        const utterance = new SpeechSynthesisUtterance(text);
        if (opts.voiceName) {
          const voices = api.getVoices();
          const match = voices.find((v) => v.name === opts.voiceName);
          if (match) utterance.voice = match;
        }
        if (opts.langCode) utterance.lang = opts.langCode;
        if (opts.rate !== undefined) utterance.rate = opts.rate;
        if (opts.pitch !== undefined) utterance.pitch = opts.pitch;
        utterance.onend = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        utterance.onerror = (e) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new Error(`speechSynthesis error: ${e.error ?? 'unknown'}`));
        };
        api.speak(utterance);
      });
    },
    getVoices() {
      return Promise.resolve(
        api.getVoices().map(
          (v): TtsVoiceInfo => ({ voiceName: v.name, lang: v.lang }),
        ),
      );
    },
    stop() {
      api.cancel();
    },
  };
}

/**
 * Create the best available TTS engine: chrome.tts first (extension context),
 * Web Speech fallback (any browser). Throws if neither is available.
 */
export function createTtsEngine(): TtsEngine {
  const chromeTts = getChromeTtsApi();
  if (chromeTts) {
    try {
      return createChromeTtsEngine();
    } catch {
      // fall through to Web Speech
    }
  }
  const webSpeech = getWebSpeechApi();
  if (webSpeech) {
    return createWebSpeechEngine();
  }
  throw new Error('No TTS engine available (chrome.tts and speechSynthesis both missing)');
}

// --- pure voice-row logic ---

/**
 * Build the ordered list of voice rows to display in the popup audio tab.
 *
 * - If `savedVoices` is non-empty: filter to voices present in `allVoices`
 *   (by voiceName) and sort by `order` ascending.
 * - If `savedVoices` is empty: auto-detect from `allVoices` by filtering on
 *   the `langCode` prefix (e.g. "en" matches "en-US", "en-GB").
 *
 * Pure function — no side effects, easy to test.
 */
export function getTtsVoiceRows(
  savedVoices: readonly TtsVoiceRow[],
  allVoices: readonly TtsVoiceInfo[],
  langCode?: string,
): TtsVoiceRow[] {
  if (savedVoices.length > 0) {
    const byName = new Map(allVoices.map((v) => [v.voiceName, v]));
    return savedVoices
      .filter((row) => byName.has(row.voiceName))
      .slice()
      .sort((a, b) => a.order - b.order);
  }
  // Auto-detect: filter by langCode prefix when provided.
  if (!langCode) return [];
  const prefix = langCode.toLowerCase();
  return allVoices
    .filter((v) => v.lang.toLowerCase().startsWith(prefix))
    .map((v, i) => ({ voiceName: v.voiceName, lang: v.lang, order: i + 1 }));
}
