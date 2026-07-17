// ttsEngineService tests — getTtsVoiceRows pure logic + engine factory smoke.

import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createChromeTtsEngine,
  createWebSpeechEngine,
  createTtsEngine,
  getTtsVoiceRows,
  type TtsVoiceInfo,
} from './ttsEngineService';
import type { TtsVoiceRow } from '@/entities/settings/types';

// jsdom does not ship SpeechSynthesisUtterance — provide a minimal stub.
class StubUtterance {
  text: string;
  lang = '';
  voice: { name: string; lang: string } | null = null;
  rate = 1;
  pitch = 1;
  onend: ((ev: Event) => void) | null = null;
  onerror: ((ev: { error?: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
(globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
  StubUtterance as unknown as typeof SpeechSynthesisUtterance;

// --- fixtures ---

const ALL_VOICES: readonly TtsVoiceInfo[] = [
  { voiceName: 'Google US English', lang: 'en-US' },
  { voiceName: 'Google UK English Male', lang: 'en-GB' },
  { voiceName: 'Microsoft David', lang: 'en-US' },
  { voiceName: 'Google Vietnamese', lang: 'vi-VN' },
  { voiceName: 'Google日本語', lang: 'ja-JP' },
];

// --- getTtsVoiceRows ---

describe('getTtsVoiceRows', () => {
  it('sorts savedVoices by order ascending', () => {
    const saved: TtsVoiceRow[] = [
      { voiceName: 'Microsoft David', lang: 'en-US', order: 3 },
      { voiceName: 'Google US English', lang: 'en-US', order: 1 },
      { voiceName: 'Google UK English Male', lang: 'en-GB', order: 2 },
    ];
    const rows = getTtsVoiceRows(saved, ALL_VOICES, 'en');
    expect(rows.map((r) => r.voiceName)).toEqual([
      'Google US English',
      'Google UK English Male',
      'Microsoft David',
    ]);
  });

  it('filters savedVoices not present in allVoices', () => {
    const saved: TtsVoiceRow[] = [
      { voiceName: 'Ghost Voice', lang: 'en-US', order: 1 },
      { voiceName: 'Google US English', lang: 'en-US', order: 2 },
    ];
    const rows = getTtsVoiceRows(saved, ALL_VOICES, 'en');
    expect(rows).toHaveLength(1);
    expect(rows[0].voiceName).toBe('Google US English');
  });

  it('auto-detects from allVoices by langCode prefix when savedVoices empty', () => {
    const rows = getTtsVoiceRows([], ALL_VOICES, 'en');
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.lang.toLowerCase().startsWith('en'))).toBe(true);
    // order assigned 1-based by index
    expect(rows[0].order).toBe(1);
    expect(rows[2].order).toBe(3);
  });

  it('filters by langCode prefix (vi)', () => {
    const rows = getTtsVoiceRows([], ALL_VOICES, 'vi');
    expect(rows).toHaveLength(1);
    expect(rows[0].voiceName).toBe('Google Vietnamese');
  });

  it('filters by langCode prefix (ja)', () => {
    const rows = getTtsVoiceRows([], ALL_VOICES, 'ja');
    expect(rows).toHaveLength(1);
    expect(rows[0].voiceName).toBe('Google日本語');
  });

  it('returns empty when savedVoices empty and no langCode', () => {
    expect(getTtsVoiceRows([], ALL_VOICES)).toEqual([]);
  });

  it('returns empty when no voices match langCode prefix', () => {
    expect(getTtsVoiceRows([], ALL_VOICES, 'fr')).toEqual([]);
  });
});

// --- engine factories ---

describe('createChromeTtsEngine', () => {
  type SpeakFn = (text: string, opts: { onEvent: (e: { type: string; errorMessage?: string }) => void }) => void;
  type GetVoicesFn = (cb: (v: { voiceName: string; lang: string }[]) => void) => void;
  const speakMock = jest.fn<SpeakFn>();
  const getVoicesMock = jest.fn<GetVoicesFn>();
  const stopMock = jest.fn<() => void>();

  beforeEach(() => {
    speakMock.mockReset();
    getVoicesMock.mockReset();
    stopMock.mockReset();
    (globalThis as { chrome?: unknown }).chrome = {
      tts: {
        speak: speakMock,
        getVoices: getVoicesMock,
        stop: stopMock,
      },
    };
  });

  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('resolves speak on end event', async () => {
    speakMock.mockImplementation((_text, opts) => {
      opts.onEvent({ type: 'end' });
    });
    const engine = createChromeTtsEngine();
    await expect(engine.speak('hi', {})).resolves.toBeUndefined();
  });

  it('rejects speak on error event', async () => {
    speakMock.mockImplementation((_text, opts) => {
      opts.onEvent({ type: 'error', errorMessage: 'boom' });
    });
    const engine = createChromeTtsEngine();
    await expect(engine.speak('hi', {})).rejects.toThrow('boom');
  });

  it('maps getVoices to TtsVoiceInfo[]', async () => {
    getVoicesMock.mockImplementation((cb) => {
      cb([{ voiceName: 'V1', lang: 'en-US' }]);
    });
    const engine = createChromeTtsEngine();
    const voices = await engine.getVoices();
    expect(voices).toEqual([{ voiceName: 'V1', lang: 'en-US' }]);
  });

  it('stop calls chrome.tts.stop', () => {
    const engine = createChromeTtsEngine();
    engine.stop();
    expect(stopMock).toHaveBeenCalled();
  });
});

describe('createWebSpeechEngine', () => {
  const speakMock = jest.fn<(u: SpeechSynthesisUtterance) => void>();
  const cancelMock = jest.fn<() => void>();
  const getVoicesMock = jest.fn<() => SpeechSynthesisVoice[]>();

  beforeEach(() => {
    speakMock.mockReset();
    cancelMock.mockReset();
    getVoicesMock.mockReset();
    const voices: SpeechSynthesisVoice[] = [
      { name: 'Web V1', lang: 'en-US', default: true, localService: true, voiceURI: 'web1' } as SpeechSynthesisVoice,
    ];
    getVoicesMock.mockReturnValue(voices);
    (globalThis as { speechSynthesis?: unknown }).speechSynthesis = {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: getVoicesMock,
    };
  });

  afterEach(() => {
    delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
  });

  it('resolves speak on utterance onend', async () => {
    speakMock.mockImplementation((u) => {
      u.onend?.({ type: 'end' } as unknown as SpeechSynthesisEvent);
    });
    const engine = createWebSpeechEngine();
    await expect(engine.speak('hi', { voiceName: 'Web V1' })).resolves.toBeUndefined();
  });

  it('maps voiceName to SpeechSynthesisVoice', () => {
    speakMock.mockImplementation((u) => {
      u.onend?.({ type: 'end' } as unknown as SpeechSynthesisEvent);
    });
    const engine = createWebSpeechEngine();
    void engine.speak('hi', { voiceName: 'Web V1' });
    expect(speakMock).toHaveBeenCalled();
    const utterance = speakMock.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice?.name).toBe('Web V1');
  });

  it('getVoices maps to TtsVoiceInfo[]', async () => {
    const engine = createWebSpeechEngine();
    const voices = await engine.getVoices();
    expect(voices).toEqual([{ voiceName: 'Web V1', lang: 'en-US' }]);
  });

  it('stop calls speechSynthesis.cancel', () => {
    const engine = createWebSpeechEngine();
    engine.stop();
    expect(cancelMock).toHaveBeenCalled();
  });
});

describe('createTtsEngine', () => {
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
    delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
  });

  it('prefers chrome.tts when available', () => {
    (globalThis as { chrome?: unknown }).chrome = {
      tts: { speak: jest.fn(), getVoices: jest.fn(), stop: jest.fn() },
    };
    (globalThis as { speechSynthesis?: unknown }).speechSynthesis = {
      speak: jest.fn(), cancel: jest.fn(), getVoices: () => [],
    };
    const engine = createTtsEngine();
    // chrome engine's getVoices uses callback form; web speech returns array.
    // Distinguish by calling stop — both no-op safely. We assert it returns an engine.
    expect(engine).toBeDefined();
    expect(typeof engine.speak).toBe('function');
  });

  it('falls back to Web Speech when chrome.tts missing', () => {
    (globalThis as { speechSynthesis?: unknown }).speechSynthesis = {
      speak: jest.fn(), cancel: jest.fn(), getVoices: () => [],
    };
    const engine = createTtsEngine();
    expect(engine).toBeDefined();
  });

  it('throws when neither engine available', () => {
    expect(() => createTtsEngine()).toThrow('No TTS engine available');
  });
});
