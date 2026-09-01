/**
 * eSpeak TTS engine for the offscreen document.
 *
 * Fetches the eSpeakNG main script, worker and data package from the jsDelivr
 * CDN, then loads them as same-origin blob URLs so they comply with the
 * extension's strict `script-src 'self'` CSP.
 *
 * ponytail: This is the simplest way to run eSpeak in an MV3 offscreen doc
 * without bundling its multi-megabyte worker/data files into the extension.
 * The blob dance is necessary because MV3 CSP forbids remote scripts in
 * `script-src` but allows the same-origin blob URLs created by the offscreen
 * page. connect-src to the CDN is still required for the initial fetch.
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

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
}

function appendScriptBlob(jsText: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Cannot load eSpeak script outside a document context'));
      return;
    }
    const blob = new Blob([jsText], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load eSpeak main script blob'));
    document.head.appendChild(script);
  });
}

function createWorkerBlobUrl(workerText: string, dataBlobUrl: string): string {
  const prefix = `var __ESPEAK_DATA_BLOB_URL = ${JSON.stringify(dataBlobUrl)};
var Module = { locateFile: function() { return __ESPEAK_DATA_BLOB_URL; } };
`;
  const blob = new Blob([prefix, workerText], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

let initPromise: Promise<EspeakNgApi> | null = null;

async function initializeEspeak(): Promise<EspeakNgApi> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [mainJs, workerJs, dataBuffer] = await Promise.all([
      fetchText(`${ESPEAK_BASE_URL}/espeakng.min.js`),
      fetchText(`${ESPEAK_BASE_URL}/espeakng.worker.js`),
      fetchArrayBuffer(`${ESPEAK_BASE_URL}/espeakng.worker.data`),
    ]);

    // Load the small main script as a blob so it runs under script-src 'self'.
    await appendScriptBlob(mainJs);

    const Ctor = (globalThis as unknown as { eSpeakNG?: EspeakNgGlobal }).eSpeakNG;
    if (typeof Ctor !== 'function') {
      throw new Error('eSpeakNG global not found after loading script');
    }

    // Package the data file as a blob and tell the worker to load it directly.
    const dataBlob = new Blob([dataBuffer], { type: 'application/octet-stream' });
    const dataUrl = URL.createObjectURL(dataBlob);
    const workerUrl = createWorkerBlobUrl(workerJs, dataUrl);

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
