/**
 * eSpeak TTS engine for the offscreen document.
 *
 * Loads the vendored eSpeakNG package (`public/espeakng/`, jsDelivr
 * espeakng.js@1.49.0 mirrored into the extension) via extension-URL script
 * and worker. Same-origin loading satisfies `script-src 'self'` on Chrome
 * and is the only option on Firefox — Firefox MV3 CSP cannot allow `blob:`
 * script sources at all, so the previous fetch+Blob approach is impossible
 * there. Vendoring also removes the runtime CDN dependency.
 */

import { encodeSamplesToWav } from './wavEncoder';

const ESPEAK_DIR = 'espeakng/';

interface EspeakNgApi {
  set_voice(voice: string): void;
  set_rate(rate: number): void;
  set_pitch(pitch: number): void;
  synthesize(text: string, callback: (samples: ArrayBuffer | number[] | Float32Array, events: unknown[]) => void): void;
}

interface EspeakNgGlobal {
  new (workerUrl: string, ready: () => void): EspeakNgApi;
}

function extensionAssetUrl(name: string): string {
  return chrome.runtime.getURL(`${ESPEAK_DIR}${name}`);
}

function appendScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Cannot load eSpeak script outside a document context'));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load eSpeak main script: ${src}`));
    document.head.appendChild(script);
  });
}

let initPromise: Promise<EspeakNgApi> | null = null;

async function initializeEspeak(): Promise<EspeakNgApi> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await appendScript(extensionAssetUrl('espeakng.min.js'));

    const Ctor = (globalThis as unknown as { eSpeakNG?: EspeakNgGlobal }).eSpeakNG;
    if (typeof Ctor !== 'function') {
      throw new Error('eSpeakNG global not found after loading script');
    }

    const workerUrl = extensionAssetUrl('espeakng-worker-entry.js');

    return new Promise<EspeakNgApi>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('eSpeakNG initialization timeout'));
      }, 30000);

      const instance: EspeakNgApi = new Ctor(workerUrl, () => {
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

      if (samples) {
        const data = samples instanceof ArrayBuffer ? new Float32Array(samples) : samples;
        for (let i = 0; i < data.length; i++) {
          chunks.push(data[i]!);
        }
        return;
      }

      // Falsy samples = the worker's final done message; non-empty chunks arrive as ArrayBuffers.
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
