/**
 * eSpeak TTS engine for the offscreen document.
 *
 * Loads the eSpeakNG script and worker from the jsDelivr CDN, synthesizes the
 * requested text, and returns the audio as a WAV-encoded byte array.
 *
 * ponytail: This depends on network access to `https://cdn.jsdelivr.net/espeakng.js/`
 * from the offscreen document, which is declared in `manifest.json` CSP.
 */

import { encodeSamplesToWav } from './wavEncoder';

const ESPEAK_BASE_URL = 'https://cdn.jsdelivr.net/espeakng.js/1.49.0';

interface EspeakNgApi {
  set_voice(voice: string): void;
  set_rate(rate: number): void;
  set_pitch(pitch: number): void;
  synthesize(text: string, callback: (samples: number[] | Float32Array, events: unknown[]) => void): void;
}

interface EspeakNgGlobal {
  new (workerUrl: string, ready: () => void): EspeakNgApi;
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Cannot load eSpeak script outside a document context'));
      return;
    }
    const existing = document.querySelector(`script[src="${CSS.escape(url)}"]`);
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

let initPromise: Promise<EspeakNgApi> | null = null;

async function initializeEspeak(): Promise<EspeakNgApi> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const scriptUrl = `${ESPEAK_BASE_URL}/espeakng.min.js`;
    await loadScript(scriptUrl);

    const Ctor = (globalThis as unknown as { eSpeakNG?: EspeakNgGlobal }).eSpeakNG;
    if (typeof Ctor !== 'function') {
      throw new Error('eSpeakNG global not found after loading script');
    }

    return new Promise<EspeakNgApi>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('eSpeakNG initialization timeout'));
      }, 30000);

      const instance: EspeakNgApi = new Ctor(`${ESPEAK_BASE_URL}/espeakng.worker.js`, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(instance);
      });
    });
  })();

  return initPromise;
}

/**
 * Synthesize a word or short phrase with eSpeak and return it as a WAV file.
 */
export async function synthesizeEspeakToWav(text: string, langCode: string): Promise<Uint8Array> {
  const espeak = await initializeEspeak();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('eSpeak synthesis timeout'));
    }, 30000);

    const chunks: number[] = [];

    espeak.set_voice(langCode);
    espeak.set_rate(175);
    espeak.set_pitch(50);

    espeak.synthesize(text, (samples) => {
      if (settled) return;

      if (samples && samples.length > 0) {
        if (Array.isArray(samples)) {
          chunks.push(...samples);
        } else {
          for (let i = 0; i < samples.length; i++) {
            chunks.push((samples as Float32Array)[i]!);
          }
        }
        return;
      }

      // Empty samples indicate end of synthesis in the original eSpeak demo.
      settled = true;
      clearTimeout(timeout);

      if (chunks.length === 0) {
        reject(new Error('eSpeak returned empty audio'));
        return;
      }

      const floatSamples = new Float32Array(chunks);
      // eSpeak 1.49.0 default sample rate is 22050 Hz.
      resolve(encodeSamplesToWav(floatSamples, 22050));
    });
  });
}
