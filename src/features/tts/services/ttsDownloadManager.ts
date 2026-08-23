// ttsDownloadManager — download Supertonic v3 voice-pack files from Hugging Face.
//
// MVP always downloads the shared ONNX assets under `onnx/`. Language-specific
// packing (speaker / style) is a future layer.

import { writeTtsFile, hasTtsFile, deleteTtsFile } from './ttsModelStorage';

const HF_BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main/onnx';
const HF_VOICE_STYLE_BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main/voice_styles';

const SUPERONIC_FILES = [
  'duration_predictor.onnx',
  'text_encoder.onnx',
  'tts.json',
  'unicode_indexer.json',
  'vector_estimator.onnx',
  'vocoder.onnx',
  'M1.json',
] as const;

export interface TtsDownloadProgress {
  readonly loaded: number;
  readonly total: number;
}

export type DownloadProgressCallback = (progress: TtsDownloadProgress) => void;

function buildFileUrl(name: string): string {
  return name === 'M1.json' ? `${HF_VOICE_STYLE_BASE}/${name}` : `${HF_BASE}/${name}`;
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
  const results = await Promise.all(SUPERONIC_FILES.map((name) => hasTtsFile(name)));
  return results.every(Boolean);
}

export async function deleteVoicePack(_language?: string): Promise<void> {
  // ponytail: language-specific asset cleanup is a future layer; for MVP all
  // Supertonic ONNX assets are shared across languages.
  await Promise.all(SUPERONIC_FILES.map((name) => deleteTtsFile(name)));
}

export async function downloadVoicePack(
  _language: string,
  onProgress?: DownloadProgressCallback,
): Promise<void> {
  const totals = await Promise.all(SUPERONIC_FILES.map((name) => getContentLength(buildFileUrl(name))));
  const total = totals.reduce<number>((sum, t) => sum + (t ?? 0), 0);
  let loaded = 0;

  for (let i = 0; i < SUPERONIC_FILES.length; i++) {
    const name = SUPERONIC_FILES[i];
    await downloadFile(name, (bytes) => {
      loaded += bytes;
      onProgress?.({ loaded, total });
    });
  }

  onProgress?.({ loaded, total });
}
