import { playPhoneme } from './phonemeAudioPlayer';
import { espeakStereoToMono } from './espeakPcm';
import type { Phoneme, PronunciationAudio } from '../types';

interface EspeakNgApi {
  set_voice(voice: string): void;
  set_rate(rate: number): void;
  set_pitch(pitch: number): void;
  synthesize(
    text: string,
    callback: (samples: ArrayBuffer | Float32Array | number[] | null, events: unknown[]) => void,
  ): void;
}

let initPromise: Promise<EspeakNgApi> | null = null;

function getEspeakBaseUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL('espeakng/');
  }
  // Fallback for unit-test / design-system-showcase environments.
  return '/espeakng/';
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Cannot load eSpeak script outside a document context'));
      return;
    }
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

async function initializeEspeak(): Promise<EspeakNgApi> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const baseUrl = getEspeakBaseUrl();
    const scriptUrl = `${baseUrl}espeakng.min.js`;
    const workerUrl = `${baseUrl}espeakng-worker-entry.js`;

    await loadScript(scriptUrl);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (globalThis as any).eSpeakNG;
    if (typeof Ctor !== 'function') {
      throw new Error('eSpeakNG global not found after loading script');
    }

    return new Promise<EspeakNgApi>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('eSpeakNG initialization timeout'));
      }, 10000);

      const instance: EspeakNgApi = new Ctor(workerUrl, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        instance.set_voice('en');
        resolve(instance);
      });
    });
  })();

  return initPromise;
}

function samplesToPronunciationAudio(
  samples: ArrayBuffer | Float32Array | number[],
  sampleRate = 22050,
): PronunciationAudio {
  const frames = samples instanceof ArrayBuffer ? new Float32Array(samples) : samples;
  const mono = espeakStereoToMono(frames);

  return {
    samples: mono,
    sampleRate,
    source: 'espeak',
    duration: mono.length / sampleRate,
  };
}

/**
 * Synthesize a whole word or short phrase with eSpeak NG (loaded from the
 * bundled `public/espeakng/` assets). Returns a `PronunciationAudio` buffer
 * that can be used for full-word playback or per-phoneme segmentation.
 */
export async function synthesizeEspeakWord(text: string): Promise<PronunciationAudio> {
  const espeak = await initializeEspeak();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('eSpeak word synthesis timeout'));
    }, 10000);

    const chunks: Float32Array[] = [];

    espeak.synthesize(text, (samples, _events) => {
      if (settled) return;

      if (samples) {
        const frames = samples instanceof ArrayBuffer ? new Float32Array(samples) : samples;
        chunks.push(new Float32Array(frames));
        return;
      }

      settled = true;
      clearTimeout(timeout);

      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      if (!totalLength) {
        reject(new Error('eSpeak returned empty audio'));
        return;
      }

      const frames = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        frames.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(samplesToPronunciationAudio(frames));
    });
  });
}

/**
 * Synthesize and play a whole word directly. Used by the PronunciationAudioPanel play
 * button when the eSpeak item is clicked.
 */
export async function playEspeakWord(text: string): Promise<void> {
  const audio = await synthesizeEspeakWord(text);

  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate);
  buffer.getChannelData(0).set(audio.samples);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  return new Promise((resolve) => {
    source.onended = () => resolve();
    source.start(0);
  });
}

function getAudioContext(): AudioContext {
  const Ctor = globalThis.AudioContext as typeof AudioContext | undefined;
  if (!Ctor) {
    throw new Error('AudioContext is not available in this environment');
  }
  return new Ctor();
}

/**
 * Synthesize a single phoneme as a standalone utterance and play it.
 * Stress marks and separators are silent and only trigger a visual highlight.
 */
export async function playEspeakPhoneme(phoneme: Phoneme): Promise<void> {
  if (phoneme.type === 'stress' || phoneme.type === 'separator') {
    return;
  }

  const audio = await synthesizeEspeakWord(phoneme.ipa);

  // The synthesized audio only contains this one phoneme, so the whole buffer
  // is the segment. Use a dummy phoneme covering the full duration to reuse
  // the existing playback helper.
  const fullPhoneme: Phoneme = {
    ...phoneme,
    startMs: 0,
    endMs: audio.duration * 1000,
  };

  await playPhoneme(audio, fullPhoneme);
}
