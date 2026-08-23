// supertonicInference — ONNX Runtime Web inference for Supertone Supertonic v3.
// Ported from the official web example, trimmed to single-language, single-style MVP.
//
// ponytail: all model / style / config I/O is synchronous-ish once cached. For
// long text we keep the chunking from the reference because the vector estimator
// has a hard ceiling on text length.

import { readTtsFile } from './ttsModelStorage';
import { isVoicePackDownloaded } from './ttsDownloadManager';
import type { Tensor, InferenceSession } from 'onnxruntime-web';

interface SupertonicConfig {
  ae: {
    sample_rate: number;
    base_chunk_size: number;
  };
  ttl: {
    chunk_compress_factor: number;
    latent_dim: number;
  };
}

interface SupertonicStyleJson {
  style_ttl: {
    dims: readonly number[];
    data: readonly (number | readonly number[] | readonly (readonly number[])[])[];
  };
  style_dp: {
    dims: readonly number[];
    data: readonly (number | readonly number[] | readonly (readonly number[])[])[];
  };
}

interface ProcessedText {
  textIds: number[][];
  textMask: number[][][];
}

const DEFAULT_TOTAL_STEP = 8;
const DEFAULT_SPEED = 1.05;
const DEFAULT_SILENCE = 0.3;

const ONNX_FILES = [
  'duration_predictor.onnx',
  'text_encoder.onnx',
  'vector_estimator.onnx',
  'vocoder.onnx',
] as const;

const JSON_FILES = {
  config: 'tts.json',
  indexer: 'unicode_indexer.json',
  style: 'M1.json',
} as const;

type SessionMap = {
  dp: InferenceSession;
  textEnc: InferenceSession;
  vectorEst: InferenceSession;
  vocoder: InferenceSession;
};

interface SupertonicCache {
  loaded: boolean;
  sessions?: SessionMap;
  cfgs?: SupertonicConfig;
  textProcessor?: UnicodeProcessor;
  style?: Style;
  error?: Error;
}

let cache: SupertonicCache = { loaded: false };

class UnicodeProcessor {
  private readonly indexer: readonly number[];

  constructor(indexer: readonly number[]) {
    this.indexer = indexer;
  }

  call(textList: readonly string[], langList: readonly string[]): ProcessedText {
    const processedTexts = textList.map((text, i) => this.preprocessText(text, langList[i]));
    const textIdsLengths = processedTexts.map((text) => text.length);
    const maxLen = Math.max(...textIdsLengths);

    const textIds = processedTexts.map((text) => {
      const row = new Array(maxLen).fill(0);
      for (let j = 0; j < text.length; j++) {
        const codePoint = text.codePointAt(j) ?? 0;
        row[j] = codePoint < this.indexer.length ? this.indexer[codePoint] : -1;
      }
      return row;
    });

    const textMask = this.getTextMask(textIdsLengths);
    return { textIds, textMask };
  }

  preprocessText(text: string, lang: string): string {
    text = text.normalize('NFKD');

    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
    text = text.replace(emojiPattern, '');

    const replacements: Record<string, string> = {
      '–': '-',
      '‑': '-',
      '—': '-',
      '_': ' ',
      '\u201C': '"',
      '\u201D': '"',
      '\u2018': "'",
      '\u2019': "'",
      '´': "'",
      '`': "'",
      '[': ' ',
      ']': ' ',
      '|': ' ',
      '/': ' ',
      '#': ' ',
      '→': ' ',
      '←': ' ',
    };
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replaceAll(k, v);
    }

    text = text.replace(/[♥☆♡©\\]/g, ' ');

    const exprReplacements: Record<string, string> = {
      '@': ' at ',
      'e.g.,': 'for example, ',
      'i.e.,': 'that is, ',
    };
    for (const [k, v] of Object.entries(exprReplacements)) {
      text = text.replaceAll(k, v);
    }

    text = text.replace(/ ,/g, ',');
    text = text.replace(/ \./g, '.');
    text = text.replace(/ !/g, '!');
    text = text.replace(/ \?/g, '?');
    text = text.replace(/ ;/g, ';');
    text = text.replace(/ :/g, ':');
    text = text.replace(/ '/g, "'");

    while (text.includes('""')) {
      text = text.replace('""', '"');
    }
    while (text.includes("''")) {
      text = text.replace("''", "'");
    }
    while (text.includes('``')) {
      text = text.replace('``', '`');
    }

    text = text.replace(/\s+/g, ' ').trim();

    if (!/[.!?;:,'\"')\]}…。\」』】〉》›»]$/.test(text)) {
      text += '.';
    }

    if (!isValidLang(lang)) {
      throw new Error(`Invalid language: ${lang}.`);
    }

    text = `<${lang}>${text}</${lang}>`;
    return text;
  }

  getTextMask(textIdsLengths: readonly number[]): number[][][] {
    const maxLen = Math.max(...textIdsLengths);
    return this.lengthToMask(textIdsLengths, maxLen);
  }

  lengthToMask(lengths: readonly number[], maxLen: number | null = null): number[][][] {
    const actualMaxLen = maxLen ?? Math.max(...lengths);
    return lengths.map((len) => {
      const row = new Array(actualMaxLen).fill(0.0);
      for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
        row[j] = 1.0;
      }
      return [row];
    });
  }
}

class Style {
  readonly ttl: Tensor;
  readonly dp: Tensor;

  constructor(ttlTensor: Tensor, dpTensor: Tensor) {
    this.ttl = ttlTensor;
    this.dp = dpTensor;
  }
}

class TextToSpeech {
  private readonly cfgs: SupertonicConfig;
  private readonly textProcessor: UnicodeProcessor;
  private readonly dpOrt: InferenceSession;
  private readonly textEncOrt: InferenceSession;
  private readonly vectorEstOrt: InferenceSession;
  private readonly vocoderOrt: InferenceSession;

  sampleRate: number;

  constructor(
    cfgs: SupertonicConfig,
    textProcessor: UnicodeProcessor,
    dpOrt: InferenceSession,
    textEncOrt: InferenceSession,
    vectorEstOrt: InferenceSession,
    vocoderOrt: InferenceSession,
  ) {
    this.cfgs = cfgs;
    this.textProcessor = textProcessor;
    this.dpOrt = dpOrt;
    this.textEncOrt = textEncOrt;
    this.vectorEstOrt = vectorEstOrt;
    this.vocoderOrt = vocoderOrt;
    this.sampleRate = cfgs.ae.sample_rate;
  }

  async call(
    text: string,
    lang: string,
    style: Style,
    totalStep: number = DEFAULT_TOTAL_STEP,
    speed: number = DEFAULT_SPEED,
    silenceDuration: number = DEFAULT_SILENCE,
    onProgress?: (step: number, total: number) => void,
  ): Promise<{ wav: number[]; duration: number }> {
    if (style.ttl.dims[0] !== 1) {
      throw new Error('Single speaker TTS only supports a single style.');
    }
    const maxLen = lang === 'ko' || lang === 'ja' ? 120 : 300;
    const textList = chunkText(text, maxLen);
    const langList = new Array(textList.length).fill(lang);
    let wavCat: number[] = [];
    let durCat = 0;

    for (let i = 0; i < textList.length; i++) {
      const { wav, duration } = await this._infer(
        [textList[i]],
        [langList[i]],
        style,
        totalStep,
        speed,
        onProgress,
      );

      if (wavCat.length === 0) {
        wavCat = wav;
        durCat = duration[0];
      } else {
        const silenceLen = Math.floor(silenceDuration * this.sampleRate);
        const silence = new Array(silenceLen).fill(0);
        wavCat = [...wavCat, ...silence, ...wav];
        durCat += duration[0] + silenceDuration;
      }
    }

    return { wav: wavCat, duration: durCat };
  }

  private async _infer(
    textList: string[],
    langList: string[],
    style: Style,
    totalStep: number,
    speed: number,
    onProgress?: (step: number, total: number) => void,
  ): Promise<{ wav: number[]; duration: number[] }> {
    const bsz = textList.length;
    const { textIds, textMask } = this.textProcessor.call(textList, langList);

    const textIdsFlat = new BigInt64Array(textIds.flat().map((x) => BigInt(x)));
    const textIdsTensor = new (await getOrt()).Tensor('int64', textIdsFlat, [bsz, textIds[0].length]);

    const textMaskFlat = new Float32Array(textMask.flat(2));
    const textMaskTensor = new (await getOrt()).Tensor('float32', textMaskFlat, [
      bsz,
      1,
      textMask[0][0].length,
    ]);

    const dpOutputs = await this.dpOrt.run({
      text_ids: textIdsTensor,
      style_dp: style.dp,
      text_mask: textMaskTensor,
    });
    const duration = Array.from(dpOutputs.duration.data as Float32Array);
    for (let i = 0; i < duration.length; i++) {
      duration[i] /= speed;
    }

    const textEncOutputs = await this.textEncOrt.run({
      text_ids: textIdsTensor,
      style_ttl: style.ttl,
      text_mask: textMaskTensor,
    });
    const textEmb = textEncOutputs.text_emb;

    let { xt, latentMask } = this.sampleNoisyLatent(
      duration,
      this.sampleRate,
      this.cfgs.ae.base_chunk_size,
      this.cfgs.ttl.chunk_compress_factor,
      this.cfgs.ttl.latent_dim,
    );

    const latentMaskFlat = new Float32Array(latentMask.flat(2));
    const latentMaskTensor = new (await getOrt()).Tensor('float32', latentMaskFlat, [
      bsz,
      1,
      latentMask[0][0].length,
    ]);

    const totalStepArray = new Float32Array(bsz).fill(totalStep);
    const totalStepTensor = new (await getOrt()).Tensor('float32', totalStepArray, [bsz]);

    for (let step = 0; step < totalStep; step++) {
      onProgress?.(step + 1, totalStep);

      const currentStepArray = new Float32Array(bsz).fill(step);
      const currentStepTensor = new (await getOrt()).Tensor('float32', currentStepArray, [bsz]);

      const xtFlat = new Float32Array(xt.flat(2));
      const xtTensor = new (await getOrt()).Tensor('float32', xtFlat, [bsz, xt[0].length, xt[0][0].length]);

      const vectorEstOutputs = await this.vectorEstOrt.run({
        noisy_latent: xtTensor,
        text_emb: textEmb,
        style_ttl: style.ttl,
        latent_mask: latentMaskTensor,
        text_mask: textMaskTensor,
        current_step: currentStepTensor,
        total_step: totalStepTensor,
      });

      const denoised = Array.from(vectorEstOutputs.denoised_latent.data as Float32Array);
      const latentDim = xt[0].length;
      const latentLen = xt[0][0].length;
      xt = [];
      let idx = 0;
      for (let b = 0; b < bsz; b++) {
        const batch: number[][] = [];
        for (let d = 0; d < latentDim; d++) {
          const row: number[] = [];
          for (let t = 0; t < latentLen; t++) {
            row.push(denoised[idx++]);
          }
          batch.push(row);
        }
        xt.push(batch);
      }
    }

    const finalXtFlat = new Float32Array(xt.flat(2));
    const finalXtTensor = new (await getOrt()).Tensor('float32', finalXtFlat, [
      bsz,
      xt[0].length,
      xt[0][0].length,
    ]);

    const vocoderOutputs = await this.vocoderOrt.run({
      latent: finalXtTensor,
    });
    const wav = Array.from(vocoderOutputs.wav_tts.data as Float32Array);

    return { wav, duration };
  }

  private sampleNoisyLatent(
    duration: number[],
    sampleRate: number,
    baseChunkSize: number,
    chunkCompress: number,
    latentDim: number,
  ): { xt: number[][][]; latentMask: number[][][] } {
    const bsz = duration.length;
    const maxDur = Math.max(...duration);
    const wavLenMax = Math.floor(maxDur * sampleRate);
    const wavLengths = duration.map((d) => Math.floor(d * sampleRate));
    const chunkSize = baseChunkSize * chunkCompress;
    const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
    const latentDimVal = latentDim * chunkCompress;

    const xt: number[][][] = [];
    for (let b = 0; b < bsz; b++) {
      const batch: number[][] = [];
      for (let d = 0; d < latentDimVal; d++) {
        const row: number[] = [];
        for (let t = 0; t < latentLen; t++) {
          const u1 = Math.max(0.0001, Math.random());
          const u2 = Math.random();
          const val = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          row.push(val);
        }
        batch.push(row);
      }
      xt.push(batch);
    }

    const latentLengths = wavLengths.map((len) => Math.floor((len + chunkSize - 1) / chunkSize));
    const latentMask = this.lengthToMask(latentLengths, latentLen);

    for (let b = 0; b < bsz; b++) {
      for (let d = 0; d < latentDimVal; d++) {
        for (let t = 0; t < latentLen; t++) {
          xt[b][d][t] *= latentMask[b][0][t];
        }
      }
    }

    return { xt, latentMask };
  }

  private lengthToMask(lengths: readonly number[], maxLen: number | null = null): number[][][] {
    const actualMaxLen = maxLen ?? Math.max(...lengths);
    return lengths.map((len) => {
      const row = new Array(actualMaxLen).fill(0.0);
      for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
        row[j] = 1.0;
      }
      return [row];
    });
  }
}

function isValidLang(lang: string): boolean {
  // MVP: English only. Keeping the same list as the reference for validation.
  return [
    'en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hi', 'hr',
    'hu', 'id', 'it', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi', 'na',
  ].includes(lang);
}

function chunkText(text: string, maxLen = 300): string[] {
  if (typeof text !== 'string') {
    throw new Error(`chunkText expects a string, got ${typeof text}`);
  }

  const paragraphs = text.trim().split(/\n\s*\n+/).filter((p) => p.trim());
  const chunks: string[] = [];

  for (let paragraph of paragraphs) {
    paragraph = paragraph.trim();
    if (!paragraph) continue;

    const sentences = paragraph.split(
      /(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|Ph\.D\.|etc\.|e\.g\.|i\.e\.|vs\.|Inc\.|Ltd\.|Co\.|Corp\.|St\.|Ave\.|Blvd\.)(<!\b[A-Z]\.)(?<=[.!?])\s+/,
    );
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 <= maxLen) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
  }

  return chunks;
}

function flattenNumbers(
  value: readonly (number | readonly number[] | readonly (readonly number[])[])[],
): number[] {
  return (value as readonly unknown[]).flat(Infinity) as number[];
}

async function getOrt() {
  const ort = await import('onnxruntime-web/webgpu');
  return ort;
}

async function loadConfig(): Promise<SupertonicConfig> {
  const file = await readTtsFile(JSON_FILES.config);
  if (!file) throw new Error(`Missing ${JSON_FILES.config}`);
  const text = await file.text();
  return JSON.parse(text) as SupertonicConfig;
}

async function loadIndexer(): Promise<readonly number[]> {
  const file = await readTtsFile(JSON_FILES.indexer);
  if (!file) throw new Error(`Missing ${JSON_FILES.indexer}`);
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`${JSON_FILES.indexer} must be an array`);
  }
  return parsed as number[];
}

async function loadStyle(): Promise<Style> {
  const file = await readTtsFile(JSON_FILES.style);
  if (!file) throw new Error(`Missing ${JSON_FILES.style}`);
  const text = await file.text();
  const data = JSON.parse(text) as SupertonicStyleJson;

  const ttlFlat = new Float32Array(flattenNumbers(data.style_ttl.data));
  const dpFlat = new Float32Array(flattenNumbers(data.style_dp.data));

  const ort = await getOrt();
  const ttlTensor = new ort.Tensor('float32', ttlFlat, data.style_ttl.dims as number[]);
  const dpTensor = new ort.Tensor('float32', dpFlat, data.style_dp.dims as number[]);
  return new Style(ttlTensor, dpTensor);
}

async function loadSessions(): Promise<SessionMap> {
  const ort = await getOrt();
  const options: InferenceSession.SessionOptions = {
    graphOptimizationLevel: 'all',
    executionProviders: ['webgpu'],
  };

  const [dp, textEnc, vectorEst, vocoder] = await Promise.all(
    ONNX_FILES.map(async (name) => {
      const file = await readTtsFile(name);
      if (!file) throw new Error(`Missing ${name}`);
      const buffer = await file.arrayBuffer();
      return ort.InferenceSession.create(buffer, options);
    }),
  );

  return { dp, textEnc, vectorEst, vocoder };
}

async function ensureLoaded(): Promise<TextToSpeech> {
  if (cache.loaded && cache.sessions && cache.cfgs && cache.textProcessor && cache.style) {
    return new TextToSpeech(
      cache.cfgs,
      cache.textProcessor,
      cache.sessions.dp,
      cache.sessions.textEnc,
      cache.sessions.vectorEst,
      cache.sessions.vocoder,
    );
  }

  if (cache.error) {
    throw cache.error;
  }

  const isDownloaded = await isVoicePackDownloaded();
  if (!isDownloaded) {
    throw new Error('Supertonic voice pack is not downloaded.');
  }

  try {
    const [cfgs, indexer, style, sessions] = await Promise.all([
      loadConfig(),
      loadIndexer(),
      loadStyle(),
      loadSessions(),
    ]);

    const textProcessor = new UnicodeProcessor(indexer);
    cache = { loaded: true, cfgs, textProcessor, style, sessions };

    return new TextToSpeech(
      cfgs,
      textProcessor,
      sessions.dp,
      sessions.textEnc,
      sessions.vectorEst,
      sessions.vocoder,
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    cache = { loaded: false, error };
    throw error;
  }
}

export async function synthesizeSupertonic(text: string, lang: string): Promise<ArrayBuffer> {
  const tts = await ensureLoaded();
  const { wav, duration } = await tts.call(text, lang, cache.style as Style);
  return writeWavBuffer(wav, tts.sampleRate, duration);
}

export function writeWavBuffer(audioData: readonly number[], sampleRate: number, duration: number): ArrayBuffer {
  const sampleCount = Math.min(audioData.length, Math.floor(sampleRate * duration));
  const audioSlice = audioData.slice(0, sampleCount);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = audioSlice.length * 2;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const int16Data = new Int16Array(audioSlice.length);
  for (let i = 0; i < audioSlice.length; i++) {
    const clamped = Math.max(-1.0, Math.min(1.0, audioSlice[i]));
    int16Data[i] = Math.floor(clamped * 32767);
  }

  const dataView = new Uint8Array(buffer, 44);
  dataView.set(new Uint8Array(int16Data.buffer));

  return buffer;
}
