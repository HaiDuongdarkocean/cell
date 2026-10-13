// ttsDownloadManager — download Supertonic v3 voice-pack files from Hugging Face.
//
// The pack is two layers:
// - shared ONNX/JSON model files (one download per language, English only today)
// - per-voice style files (`voice_styles/<ID>.json`, ~1 file per voice)

import { writeTtsFile, hasTtsFile, deleteTtsFile } from './ttsModelStorage';

const HF_BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main/onnx';
const HF_VOICE_STYLE_BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main/voice_styles';

export const SUPERTONIC_VOICE_IDS = [
  'F1', 'F2', 'F3', 'F4', 'F5',
  'M1', 'M2', 'M3', 'M4', 'M5',
] as const;

export type SupertonicVoiceId = (typeof SUPERTONIC_VOICE_IDS)[number];

export const SUPERTONIC_MAX_SELECTED_VOICES = 3;

export const DEFAULT_SUPERTONIC_VOICE: SupertonicVoiceId = 'M1';

export function isSupertonicVoiceId(value: unknown): value is SupertonicVoiceId {
  return typeof value === 'string' && (SUPERTONIC_VOICE_IDS as readonly string[]).includes(value);
}

export function voiceStyleFile(voice: string): string {
  return `${voice}.json`;
}

const MODEL_FILES = [
  'duration_predictor.onnx',
  'text_encoder.onnx',
  'tts.json',
  'unicode_indexer.json',
  'vector_estimator.onnx',
  'vocoder.onnx',
] as const;

const PACK_FILES = [...MODEL_FILES, voiceStyleFile(DEFAULT_SUPERTONIC_VOICE)] as const;

export interface TtsDownloadProgress {
  readonly loaded: number;
  readonly total: number;
}

export type DownloadProgressCallback = (progress: TtsDownloadProgress) => void;

function isVoiceStyleFile(name: string): boolean {
  return /^[MF]\d\.json$/.test(name);
}

function buildFileUrl(name: string): string {
  return isVoiceStyleFile(name) ? `${HF_VOICE_STYLE_BASE}/${name}` : `${HF_BASE}/${name}`;
}

async function getContentLength(url: string): Promise<number | undefined> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const length = res.headers.get('Content-Length');
    if (length) return Number(length);
  } catch {
    // HEAD may fail due to CORS or server; proceed without total.
  }
  return undefined;
}

async function downloadFile(
  name: string,
  onChunk: (bytes: number) => void,
): Promise<void> {
  const url = buildFileUrl(name);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed for ${name}: ${res.status} ${res.statusText}`);
  }
  const body = res.body;
  if (!body) {
    throw new Error(`No response body for ${name}`);
  }
  await writeTtsFile(name, body, onChunk);
}

export async function isVoicePackDownloaded(): Promise<boolean> {
  const results = await Promise.all(MODEL_FILES.map((name) => hasTtsFile(name)));
  return results.every(Boolean);
}

export async function isVoiceDownloaded(voice: string): Promise<boolean> {
  return hasTtsFile(voiceStyleFile(voice));
}

export async function deleteVoice(voice: string): Promise<void> {
  await deleteTtsFile(voiceStyleFile(voice));
}

export async function deleteVoicePack(_language?: string): Promise<void> {
  // ponytail: language-specific asset cleanup is a future layer; all Supertonic
  // ONNX assets + every downloaded voice style are shared across languages.
  await Promise.all(
    [...MODEL_FILES, ...SUPERTONIC_VOICE_IDS.map(voiceStyleFile)].map((name) => deleteTtsFile(name)),
  );
}

export async function downloadVoice(
  voice: string,
  onProgress?: DownloadProgressCallback,
): Promise<void> {
  const name = voiceStyleFile(voice);
  const total = (await getContentLength(buildFileUrl(name))) ?? 0;
  let loaded = 0;
  await downloadFile(name, (bytes) => {
    loaded += bytes;
    onProgress?.({ loaded, total });
  });
  onProgress?.({ loaded, total });
}

export async function downloadVoicePack(
  _language: string,
  onProgress?: DownloadProgressCallback,
): Promise<void> {
  const totals = await Promise.all(PACK_FILES.map((name) => getContentLength(buildFileUrl(name))));
  const total = totals.reduce<number>((sum, t) => sum + (t ?? 0), 0);
  let loaded = 0;

  for (let i = 0; i < PACK_FILES.length; i++) {
    const name = PACK_FILES[i];
    await downloadFile(name, (bytes) => {
      loaded += bytes;
      onProgress?.({ loaded, total });
    });
  }

  onProgress?.({ loaded, total });
}
