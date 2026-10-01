import { MESSAGE_TYPES } from '@/shared/config/messages';
import { logger } from '@/shared/lib/logger';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { messagePayload } from '@/entities/message/payload';
import { ensureDownloadSubdir, readFile as opfsReadFile } from '@/shared/lib/storage/opfsStorage';
import { getVideo } from '@/features/local-player/services/mediaLibraryRepository';
import {
  ensureCondensedDir,
  outputNameFor,
  partNameFor,
  readPartFile,
  writeOutputFile,
} from '@/features/condensedAudio/condensedAudioStorage';
import {
  buildCondenseFilter,
  chunkRanges,
  normalizeCueRanges,
  rangesTotalMs,
} from '@/features/condensedAudio/lib/cueRanges';
import type { CueRange, CondensedAudioSource } from '@/entities/condensedAudio';
import type {
  CondenseAudioAbortPayload,
  CondenseAudioBlobUrlResult,
  CondenseAudioIdPayload,
  CondenseAudioProgressPayload,
  CondenseAudioRunPayload,
  CondenseAudioRunResult,
  MessageRequest,
  MessageResponse,
  RevokeOpfsBlobUrlPayload,
} from '@/entities/message';

interface FFmpegProgressEvent {
  readonly progress: number;
  readonly time: number;
}

interface FFmpegInstance {
  readonly loaded: boolean;
  load(options: { coreURL: string; wasmURL: string }): Promise<boolean>;
  exec(args: string[], timeoutMs?: number): Promise<number>;
  mount(fsType: string, options: { files: File[] }, mountPoint: string): Promise<boolean>;
  unmount(mountPoint: string): Promise<boolean>;
  createDir(path: string): Promise<boolean>;
  readFile(path: string, encoding?: 'binary'): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array | string): Promise<boolean>;
  on(event: 'progress', cb: (event: FFmpegProgressEvent) => void): void;
  terminate(): void;
}

interface FFmpegWasmGlobal {
  readonly FFmpeg: new () => FFmpegInstance;
  readonly FFFSType: { readonly WORKERFS: string };
}

export class CondenseAbortedError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CondenseAbortedError';
  }
}

const ENCODERS = [
  { codec: 'libmp3lame', ext: 'mp3', mimeType: 'audio/mpeg', args: ['-q:a', '4'] },
  { codec: 'aac', ext: 'm4a', mimeType: 'audio/mp4', args: ['-b:a', '96k', '-movflags', '+faststart'] },
  { codec: 'libopus', ext: 'opus', mimeType: 'audio/ogg', args: ['-b:a', '96k'] },
] as const;

const activeRuns = new Map<string, FFmpegInstance>();
const blobUrls = new Map<string, true>();

function ffmpegGlobal(): FFmpegWasmGlobal | undefined {
  return (globalThis as { FFmpegWASM?: FFmpegWasmGlobal }).FFmpegWASM;
}

async function ensureFfmpegScript(): Promise<FFmpegWasmGlobal> {
  const existing = ffmpegGlobal();
  if (existing) return existing;
  if (typeof document === 'undefined' || typeof chrome?.runtime?.getURL !== 'function') {
    throw new Error('ffmpeg-unavailable');
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('ffmpeg/ffmpeg.js');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('ffmpeg-script-load-failed'));
    document.head.appendChild(script);
  });
  const loaded = ffmpegGlobal();
  if (!loaded) throw new Error('ffmpeg-unavailable');
  return loaded;
}

function reportProgress(recordId: string, percent: number): void {
  const payload: CondenseAudioProgressPayload = { recordId, percent };
  void sendMessage({ type: MESSAGE_TYPES.CONDENSE_AUDIO_PROGRESS, payload }).catch(() => undefined);
}

function baseNameOf(file: File): string {
  return (file.name || 'input').replace(/[^\w.-]/g, '_');
}

function isAbort(recordId: string, ffmpeg: FFmpegInstance): boolean {
  return activeRuns.get(recordId) !== ffmpeg;
}

async function resolveSourceFile(source: CondensedAudioSource): Promise<File> {
  if (source.kind === 'library') {
    const video = await getVideo(source.videoId);
    const handle = video?.fileHandle;
    if (!handle) throw new Error('input-missing');
    const permission = await handle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') throw new Error('input-missing');
    return handle.getFile();
  }
  if (source.kind === 'opfs') {
    const dir = await ensureDownloadSubdir(source.downloadId);
    return opfsReadFile(dir, 'output.mp4');
  }
  throw new Error('no-source');
}

async function newRun(
  recordId: string,
  totalUnits: number,
): Promise<{ wasm: FFmpegWasmGlobal; ffmpeg: FFmpegInstance; advanceUnit: () => void }> {
  const wasm = await ensureFfmpegScript();
  const ffmpeg = new wasm.FFmpeg();
  let completedUnits = 0;
  ffmpeg.on('progress', (event) => {
    const inUnit = Math.max(0, Math.min(1, event.progress || 0));
    reportProgress(recordId, Math.round(((completedUnits + inUnit) / totalUnits) * 100));
  });
  await ffmpeg.load({
    coreURL: chrome.runtime.getURL('ffmpeg/ffmpeg-core.js'),
    wasmURL: chrome.runtime.getURL('ffmpeg/ffmpeg-core.wasm'),
  });
  activeRuns.set(recordId, ffmpeg);
  return {
    wasm,
    ffmpeg,
    advanceUnit: () => {
      completedUnits += 1;
      reportProgress(recordId, Math.round((completedUnits / totalUnits) * 100));
    },
  };
}

async function encodeRanges(
  recordId: string,
  ffmpeg: FFmpegInstance,
  inputPath: string,
  ranges: readonly CueRange[],
  advanceUnit: () => void,
): Promise<{ ext: string; mimeType: string; bytes: Uint8Array }> {
  const chunks = chunkRanges(ranges);
  let lastError: unknown = null;
  for (const encoder of ENCODERS) {
    try {
      const partNames: string[] = [];
      for (let i = 0; i < chunks.length; i += 1) {
        const partName = `part_${i}.${encoder.ext}`;
        const code = await ffmpeg.exec([
          '-y',
          '-i', inputPath,
          '-filter_complex', buildCondenseFilter(chunks[i]!),
          '-map', '[out]',
          '-vn',
          '-c:a', encoder.codec,
          ...encoder.args,
          partName,
        ]);
        if (code !== 0) throw new Error(`ffmpeg-exec-${code}`);
        partNames.push(partName);
        advanceUnit();
      }
      if (partNames.length === 1) {
        return { ext: encoder.ext, mimeType: encoder.mimeType, bytes: await ffmpeg.readFile(partNames[0]!) };
      }
      await ffmpeg.writeFile('concat-list.txt', partNames.map((n) => `file '${n}'`).join('\n'));
      const code = await ffmpeg.exec([
        '-y', '-f', 'concat', '-safe', '0', '-i', 'concat-list.txt', '-c', 'copy', `out.${encoder.ext}`,
      ]);
      if (code !== 0) throw new Error(`ffmpeg-concat-${code}`);
      return { ext: encoder.ext, mimeType: encoder.mimeType, bytes: await ffmpeg.readFile(`out.${encoder.ext}`) };
    } catch (err) {
      if (isAbort(recordId, ffmpeg)) throw new CondenseAbortedError();
      lastError = err;
      logger.warn('[condense] encoder failed, trying next', { error: String(err) });
    }
  }
  throw lastError instanceof Error ? lastError : new Error('encode-failed');
}

async function runCondense(payload: CondenseAudioRunPayload): Promise<CondenseAudioRunResult> {
  const { recordId } = payload;
  if (!payload.source) throw new Error('no-source');
  const merged = normalizeCueRanges(payload.ranges ?? [], payload.padMs ?? 500, payload.durationMs ?? 0);
  if (merged.length === 0) throw new Error('no-cues');

  const { wasm, ffmpeg, advanceUnit } = await newRun(recordId, Math.max(1, chunkRanges(merged).length));
  try {
    const file = await resolveSourceFile(payload.source);
    await ffmpeg.createDir('/work');
    await ffmpeg.mount(wasm.FFFSType.WORKERFS, { files: [file] }, '/work');
    const encoded = await encodeRanges(recordId, ffmpeg, `/work/${baseNameOf(file)}`, merged, advanceUnit);
    await writeOutputFile(recordId, encoded.ext, encoded.bytes);
    await ffmpeg.unmount('/work').catch(() => undefined);
    return {
      recordId,
      outputName: outputNameFor(recordId, encoded.ext),
      mimeType: encoded.mimeType,
      sizeBytes: encoded.bytes.byteLength,
      durationMs: rangesTotalMs(merged),
    };
  } finally {
    activeRuns.delete(recordId);
    ffmpeg.terminate();
  }
}

async function runTranscode(payload: CondenseAudioRunPayload): Promise<CondenseAudioRunResult> {
  const { recordId } = payload;
  const part = await readPartFile(recordId).catch((err: unknown) => {
    throw new Error(`transcode:readPart ${err instanceof Error ? err.message : String(err)}`);
  });
  const { wasm, ffmpeg, advanceUnit } = await newRun(recordId, 1).catch((err: unknown) => {
    throw new Error(`transcode:load ${err instanceof Error ? err.message : String(err)}`);
  });
  try {
    await ffmpeg.createDir('/work');
    await ffmpeg.mount(wasm.FFFSType.WORKERFS, { files: [part] }, '/work').catch((err: unknown) => {
      throw new Error(`transcode:mount ${err instanceof Error ? err.message : String(err)}`);
    });
    const inputPath = `/work/${partNameFor(recordId)}`;
    let lastError: unknown = null;
    for (const encoder of ENCODERS) {
      try {
        const outName = `out.${encoder.ext}`;
        const code = await ffmpeg.exec([
          '-y', '-i', inputPath, '-vn', '-c:a', encoder.codec, ...encoder.args, outName,
        ]);
        if (code !== 0) throw new Error(`ffmpeg-exec-${code}`);
        const data = await ffmpeg.readFile(outName);
        advanceUnit();
        await writeOutputFile(recordId, encoder.ext, data);
        return {
          recordId,
          outputName: outputNameFor(recordId, encoder.ext),
          mimeType: encoder.mimeType,
          sizeBytes: data.byteLength,
          durationMs: payload.durationMs ?? 0,
        };
      } catch (err) {
        if (isAbort(recordId, ffmpeg)) throw new CondenseAbortedError();
        lastError = err;
        logger.warn('[condense] transcode encoder failed, trying next', { error: String(err) });
      }
    }
    throw lastError instanceof Error
      ? new Error(`transcode:encode ${lastError.message}`)
      : new Error('encode-failed');
  } finally {
    activeRuns.delete(recordId);
    ffmpeg.terminate();
  }
}

function abortRun(recordId: string): boolean {
  const ffmpeg = activeRuns.get(recordId);
  if (!ffmpeg) return false;
  activeRuns.delete(recordId);
  ffmpeg.terminate();
  return true;
}

async function createBlobUrl(recordId: string): Promise<CondenseAudioBlobUrlResult> {
  const dir = await ensureCondensedDir();
  for (const ext of ['mp3', 'm4a', 'opus']) {
    try {
      const file = await opfsReadFile(dir, outputNameFor(recordId, ext));
      const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : 'audio/ogg';
      const blob = file.type === mimeType ? file : file.slice(0, file.size, mimeType);
      const url = URL.createObjectURL(blob);
      blobUrls.set(url, true);
      return { url };
    } catch {
      // try next extension
    }
  }
  throw new Error('missing-output');
}

export function condensedAudioMessageListener(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | undefined {
  const request = message as MessageRequest;
  const type = request.type as string;

  if (type === MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL) {
    const payload = messagePayload<RevokeOpfsBlobUrlPayload>(request, MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL);
    if (payload && blobUrls.has(payload.url)) {
      URL.revokeObjectURL(payload.url);
      blobUrls.delete(payload.url);
    }
    return undefined;
  }

  if (type === MESSAGE_TYPES.CONDENSE_AUDIO_RUN) {
    const payload = messagePayload<CondenseAudioRunPayload>(request, MESSAGE_TYPES.CONDENSE_AUDIO_RUN);
    if (!payload) {
      sendResponse({ success: false, error: 'invalid payload' });
      return true;
    }
    const run = payload.mode === 'transcode' ? runTranscode(payload) : runCondense(payload);
    run
      .then((result) => sendResponse({ success: true, data: result } satisfies MessageResponse<CondenseAudioRunResult>))
      .catch((err: unknown) => {
        const text = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: text } satisfies MessageResponse);
      });
    return true;
  }

  if (type === MESSAGE_TYPES.CONDENSE_AUDIO_ABORT) {
    const payload = messagePayload<CondenseAudioAbortPayload>(request, MESSAGE_TYPES.CONDENSE_AUDIO_ABORT);
    const aborted = payload ? abortRun(payload.recordId) : false;
    sendResponse({ success: true, data: { aborted } });
    return true;
  }

  if (type === MESSAGE_TYPES.CONDENSE_AUDIO_BLOB_URL) {
    const payload = messagePayload<CondenseAudioIdPayload>(request, MESSAGE_TYPES.CONDENSE_AUDIO_BLOB_URL);
    if (!payload) {
      sendResponse({ success: false, error: 'invalid payload' });
      return true;
    }
    createBlobUrl(payload.id)
      .then((result) => sendResponse({ success: true, data: result } satisfies MessageResponse<CondenseAudioBlobUrlResult>))
      .catch((err: unknown) => {
        sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
      });
    return true;
  }

  return undefined;
}
