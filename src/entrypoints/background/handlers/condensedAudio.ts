import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  CondenseAudioChunkPayloadSchema,
  CondenseAudioIdPayloadSchema,
  CondenseAudioReadPayloadSchema,
  CondenseAudioStartPayloadSchema,
} from '@/entities/message/condensedAudioSchemas';
import type {
  CondenseAudioBlobUrlResult,
  CondenseAudioEventPayload,
  CondenseAudioProgressPayload,
  CondenseAudioReadResult,
  CondenseAudioRunResult,
  CondenseAudioStartResult,
} from '@/entities/message';
import type {
  CondensedAudioErrorReason,
  CondensedAudioRecord,
  CueRange,
} from '@/entities/condensedAudio';
import {
  deleteRecord,
  getAllRecords,
  getRecord,
  saveRecord,
  updateRecord,
} from '@/features/condensedAudio/condensedAudioRepository';
import {
  appendPartChunk,
  condensedFileExists,
  deleteCondensedFiles,
  deletePartFile,
  outputNameFor,
  readCondensedFile,
} from '@/features/condensedAudio/condensedAudioStorage';
import { isQuotaExceededError } from '@/shared/lib/storage/opfsStorage';
import { decodeBase64ToArrayBuffer, encodeBase64 } from '@/shared/lib/base64';
import { generateFileName } from '@/shared/utils/fileUtils';
import { sendTabMessage } from '@/shared/lib/chrome-apis/tabs';
import {
  addOnDownloadsChangedListener,
  download as chromeDownload,
  removeOnDownloadsChangedListener,
  searchDownloads,
} from '@/shared/lib/chrome-apis/downloads';
import { getJobRegistry, whenJobsReady } from './jobs';
import { ChromeKeyValueStore } from '@/features/sync/adapters/local/kv/chromeKvStore';
import { readRouting } from '@/features/sync/app/routing';
import { providerFor } from '../syncRuntime';
import { GoogleDriveStorageProvider } from '@/features/sync/adapters/google-drive/googleDriveStorageProvider';
import type { Job } from '@/entities/job/types';
import { isActiveJob } from '@/entities/job/types';

const ERROR_REASONS: ReadonlySet<string> = new Set([
  'no-cues',
  'no-source',
  'capture-blocked',
  'encode-failed',
  'export-failed',
  'drive-failed',
  'cancelled',
  'interrupted',
  'input-missing',
  'io-failed',
]);

const READ_CHUNK_BYTES = 4 * 1024 * 1024;
const DRIVE_FOLDER_NAME = 'Condensed Audio';

function toErrorReason(text: string): CondensedAudioErrorReason {
  if (ERROR_REASONS.has(text)) return text as CondensedAudioErrorReason;
  if (text.startsWith('ffmpeg') || text.includes('encode')) return 'encode-failed';
  if (text.includes('quota')) return 'io-failed';
  return 'io-failed';
}

function extOfMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'opus';
  return 'mp3';
}

function sameSource(a: CondensedAudioRecord['source'], b: CondensedAudioRecord['source']): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'library' && b.kind === 'library') return a.videoId === b.videoId;
  if (a.kind === 'opfs' && b.kind === 'opfs') return a.downloadId === b.downloadId;
  if (a.kind === 'stream' && b.kind === 'stream') return a.pageKey === b.pageKey;
  return false;
}

function isTerminal(status: CondensedAudioRecord['status']): boolean {
  return status === 'ready' || status === 'failed' || status === 'missing';
}

export function registerCondensedAudioHandlers(ctx: BackgroundContext): void {
  const registry = getJobRegistry();

  const broadcastRecord = (record: CondensedAudioRecord): void => {
    const payload: CondenseAudioEventPayload = { record };
    ctx.messageBus.broadcast({ type: MESSAGE_TYPES.CONDENSE_AUDIO_EVENT, payload });
    if (record.source.kind === 'stream' && record.source.tabId !== undefined) {
      void sendTabMessage(record.source.tabId, {
        type: MESSAGE_TYPES.CONDENSE_AUDIO_EVENT,
        payload,
      }).catch(() => undefined);
    }
  };

  const patchRecord = async (
    id: string,
    patch: Partial<CondensedAudioRecord>,
  ): Promise<CondensedAudioRecord | undefined> => {
    const next = await updateRecord(id, patch);
    if (next) broadcastRecord(next);
    return next;
  };

  const failRecord = async (
    id: string,
    reason: CondensedAudioErrorReason,
  ): Promise<void> => {
    await patchRecord(id, { status: 'failed', error: reason });
  };

  const findJobForRecord = (recordId: string, activeOnly = false): Job | undefined => {
    const jobs = registry.list('condense-audio').filter(
      (j) => String(j.params.recordId ?? '') === recordId,
    );
    return activeOnly ? jobs.find(isActiveJob) : jobs[0];
  };

  const failJob = (recordId: string, error: string): void => {
    const job = findJobForRecord(recordId, true);
    if (job) registry.markFailed(job.id, error);
  };

  const completeJob = (recordId: string): void => {
    const job = findJobForRecord(recordId, true);
    if (job) registry.markDone(job.id);
  };

  async function runFileLeg(job: Job, record: CondensedAudioRecord): Promise<void> {
    const ranges = (job.params.ranges ?? []) as CueRange[];
    const settings = await ctx.loadSettings();
    const response = await ctx.offscreenManager.sendToOffscreen<
      MessageResponse<CondenseAudioRunResult> | undefined
    >({
      type: MESSAGE_TYPES.CONDENSE_AUDIO_RUN,
      payload: {
        recordId: record.id,
        mode: 'condense',
        source: record.source,
        ranges,
        padMs: settings.condensedAudio?.padMs ?? 500,
        durationMs: record.durationMs,
      },
    });
    if (!response) throw new Error('offscreen-no-response');
    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'encode-failed');
    }
    const result = response.data;
    const current = await getRecord(record.id);
    if (!current) {
      await deleteCondensedFiles(record.id).catch(() => undefined);
      registry.markDone(job.id);
      return;
    }
    await patchRecord(record.id, {
      status: 'ready',
      sizeBytes: result.sizeBytes,
      mimeType: result.mimeType,
      durationMs: result.durationMs || record.durationMs,
      opfsPath: `condensed/${result.outputName}`,
      error: null,
    });
    registry.markDone(job.id);
  }

  async function runRecordLeg(job: Job, record: CondensedAudioRecord): Promise<void> {
    const source = record.source;
    if (source.kind !== 'stream' || source.tabId === undefined) {
      throw new Error('no-source');
    }
    const ranges = (job.params.ranges ?? []) as CueRange[];
    const response = await sendTabMessage<MessageResponse>(
      source.tabId,
      {
        type: MESSAGE_TYPES.CONDENSE_AUDIO_SESSION_START,
        payload: { recordId: record.id, ranges },
      },
    ).catch((err: unknown) => {
      throw new Error(err instanceof Error ? err.message : 'capture-blocked');
    });
    if (response && response.success === false) {
      throw new Error(response.error ?? 'capture-blocked');
    }
    await patchRecord(record.id, { status: 'recording' });
  }

  registry.registerExecutor('condense-audio', {
    start: async (job) => {
      const recordId = String(job.params.recordId ?? '');
      const record = await getRecord(recordId);
      if (!record) {
        registry.markFailed(job.id, 'record-missing');
        return;
      }
      try {
        if (record.leg === 'record') {
          await runRecordLeg(job, record);
        } else {
          await runFileLeg(job, record);
        }
      } catch (err) {
        const reason = toErrorReason(err instanceof Error ? err.message : String(err));
        await failRecord(recordId, reason);
        registry.markFailed(job.id, reason);
      }
    },
    reconcile: async (job) => {
      const recordId = String(job.params.recordId ?? '');
      const record = await getRecord(recordId);
      if (!record) return 'interrupted';
      if (record.leg === 'file') {
        const done = await condensedFileExists(recordId, extOfMime(record.mimeType)).catch(() => false);
        if (done) {
          await patchRecord(recordId, { status: 'ready', error: null });
          return 'done';
        }
        await failRecord(recordId, 'interrupted');
        return 'interrupted';
      }
      await deleteCondensedFiles(recordId).catch(() => undefined);
      await failRecord(recordId, 'interrupted');
      return 'interrupted';
    },
  });

  ctx.on(
    MESSAGE_TYPES.CONDENSE_AUDIO_START,
    async (request): Promise<MessageResponse<CondenseAudioStartResult>> => {
      await whenJobsReady();
      const parsed = CondenseAudioStartPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid CONDENSE_AUDIO_START payload: ${parsed.error.message}` };
      }
      const input = parsed.data;
      const source =
        input.source.kind === 'stream'
          ? { ...input.source, tabId: input.tabId }
          : input.source;
      try {
        const existing = (await getAllRecords()).find(
          (r) => !isTerminal(r.status) && sameSource(r.source, source),
        );
        if (existing) {
          const job = findJobForRecord(existing.id);
          return {
            success: true,
            data: { recordId: existing.id, jobId: job?.id ?? '' },
          };
        }
        const failed = (await getAllRecords()).find(
          (r) => isTerminal(r.status) && r.status !== 'missing' && sameSource(r.source, source),
        );
        const recordId = failed?.id ?? crypto.randomUUID();
        const record: CondensedAudioRecord = {
          id: recordId,
          title: input.title,
          source,
          leg: input.leg,
          durationMs: input.durationMs,
          sizeBytes: 0,
          mimeType: 'audio/mpeg',
          opfsPath: `condensed/${outputNameFor(recordId, 'mp3')}`,
          exportFilename: null,
          exportState: 'none',
          driveFileId: null,
          driveSyncedAt: null,
          status: 'processing',
          error: null,
          createdAt: failed?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
        await saveRecord(record);
        broadcastRecord(record);
        const job = registry.register({
          id: `condense-${recordId}-${Date.now().toString(36)}`,
          kind: 'condense-audio',
          label: input.title,
          status: 'queued',
          params: { recordId, ranges: input.ranges },
          retryable: true,
        });
        registry.startIfSlotFree(job);
        return { success: true, data: { recordId, jobId: job.id } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isQuotaExceededError(err)) {
          return { success: false, error: 'io-failed: quota' };
        }
        return { success: false, error: msg };
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.CONDENSE_AUDIO_LIST,
    async (): Promise<MessageResponse<CondensedAudioRecord[]>> => {
      try {
        const records = await getAllRecords();
        const missing = await Promise.all(
          records.map(async (record) => {
            if (record.status !== 'ready') return record;
            const exists = await condensedFileExists(record.id, extOfMime(record.mimeType)).catch(
              () => true,
            );
            if (exists) return record;
            return (await patchRecord(record.id, { status: 'missing' })) ?? record;
          }),
        );
        return { success: true, data: missing };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ctx.on(MESSAGE_TYPES.CONDENSE_AUDIO_DELETE, async (request): Promise<MessageResponse> => {
    const parsed = CondenseAudioIdPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return { success: false, error: 'invalid payload' };
    try {
      const { id } = parsed.data;
      const job = findJobForRecord(id, true);
      if (job) {
        const record = await getRecord(id);
        if (record?.leg === 'record' && record.source.kind === 'stream' && record.source.tabId !== undefined) {
          void sendTabMessage(record.source.tabId, {
            type: MESSAGE_TYPES.CONDENSE_AUDIO_SESSION_STOP,
            payload: { recordId: id },
          }).catch(() => undefined);
        }
        void ctx.offscreenManager.sendToOffscreen({
          type: MESSAGE_TYPES.CONDENSE_AUDIO_ABORT,
          payload: { recordId: id },
        }).catch(() => undefined);
        registry.markFailed(job.id, 'cancelled');
      }
      await deleteCondensedFiles(id).catch(() => undefined);
      await deleteRecord(id);
      const payload: CondenseAudioEventPayload = { removedId: id };
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES.CONDENSE_AUDIO_EVENT, payload });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ctx.on(MESSAGE_TYPES.CONDENSE_AUDIO_RETRY, async (request): Promise<MessageResponse<CondenseAudioStartResult>> => {
    const parsed = CondenseAudioIdPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return { success: false, error: 'invalid payload' };
    try {
      const { id } = parsed.data;
      const record = await getRecord(id);
      if (!record) return { success: false, error: 'record-missing' };
      if (findJobForRecord(id, true)) return { success: false, error: 'job-active' };
      await patchRecord(id, { status: 'processing', error: null });
      const oldJob = findJobForRecord(id);
      if (oldJob) {
        const job = registry.retry(oldJob.id);
        return { success: true, data: { recordId: id, jobId: job.id } };
      }
      const job = registry.register({
        id: `condense-${id}-${Date.now().toString(36)}`,
        kind: 'condense-audio',
        label: record.title,
        status: 'queued',
        params: { recordId: id, ranges: [] },
        retryable: true,
      });
      registry.startIfSlotFree(job);
      return { success: true, data: { recordId: id, jobId: job.id } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ctx.on(MESSAGE_TYPES.CONDENSE_AUDIO_CANCEL, async (request): Promise<MessageResponse> => {
    const parsed = CondenseAudioIdPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return { success: false, error: 'invalid payload' };
    try {
      const { id } = parsed.data;
      const record = await getRecord(id);
      const job = findJobForRecord(id, true);
      if (record?.leg === 'record' && record.source.kind === 'stream' && record.source.tabId !== undefined) {
        void sendTabMessage(record.source.tabId, {
          type: MESSAGE_TYPES.CONDENSE_AUDIO_SESSION_STOP,
          payload: { recordId: id },
        }).catch(() => undefined);
      }
      void ctx.offscreenManager.sendToOffscreen({
        type: MESSAGE_TYPES.CONDENSE_AUDIO_ABORT,
        payload: { recordId: id },
      }).catch(() => undefined);
      await deleteCondensedFiles(id).catch(() => undefined);
      await patchRecord(id, { status: 'failed', error: 'cancelled' });
      if (job) registry.markFailed(job.id, 'cancelled');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ctx.on(
    MESSAGE_TYPES.CONDENSE_AUDIO_EXPORT,
    async (request): Promise<MessageResponse> => {
      const parsed = CondenseAudioIdPayloadSchema.safeParse(request.payload);
      if (!parsed.success) return { success: false, error: 'invalid payload' };
      const { id } = parsed.data;
      const record = await getRecord(id);
      if (!record || record.status !== 'ready') {
        return { success: false, error: 'not-ready' };
      }
      const releaseKeepAlive = ctx.offscreenManager.acquireKeepAlive();
      let blobUrl: string | undefined;
      try {
        const blobResponse = await ctx.offscreenManager.sendToOffscreen<
          MessageResponse<CondenseAudioBlobUrlResult> | undefined
        >({
          type: MESSAGE_TYPES.CONDENSE_AUDIO_BLOB_URL,
          payload: { id },
        });
        if (!blobResponse?.success || !blobResponse.data) {
          throw new Error(blobResponse?.error ?? 'blob-url-failed');
        }
        blobUrl = blobResponse.data.url;
        const ext = extOfMime(record.mimeType);
        const filename = `cell-condensed/${generateFileName(record.title, ext)}`;
        const downloadId = await chromeDownload({ url: blobUrl, filename, saveAs: true });
        const terminal = await new Promise<'complete' | 'interrupted'>((resolve) => {
          const onDelta = (delta: chrome.downloads.DownloadDelta): void => {
            if (delta.id !== downloadId) return;
            const state = delta.state?.current;
            if (state === 'complete' || state === 'interrupted') {
              removeOnDownloadsChangedListener(onDelta);
              resolve(state);
            }
          };
          addOnDownloadsChangedListener(onDelta);
          void searchDownloads({ id: downloadId })
            .then((items) => {
              const state = items[0]?.state;
              if (state === 'complete' || state === 'interrupted') {
                removeOnDownloadsChangedListener(onDelta);
                resolve(state);
              }
            })
            .catch(() => undefined);
        });
        if (terminal !== 'complete') {
          throw new Error('export-cancelled');
        }
        await patchRecord(id, { exportState: 'done', exportFilename: filename });
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg !== 'export-cancelled') {
          await patchRecord(id, { exportState: 'failed' }).catch(() => undefined);
        }
        return { success: false, error: msg };
      } finally {
        releaseKeepAlive();
        if (blobUrl) {
          void ctx.offscreenManager.sendToOffscreen({
            type: MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL,
            payload: { url: blobUrl },
          }).catch(() => undefined);
        }
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.CONDENSE_AUDIO_SYNC_DRIVE,
    async (request): Promise<MessageResponse> => {
      const parsed = CondenseAudioIdPayloadSchema.safeParse(request.payload);
      if (!parsed.success) return { success: false, error: 'invalid payload' };
      const { id } = parsed.data;
      const record = await getRecord(id);
      if (!record || record.status !== 'ready') {
        return { success: false, error: 'not-ready' };
      }
      try {
        const kv = new ChromeKeyValueStore();
        const routing = await readRouting(kv);
        const connection = routing.connections.find((c) => c.providerId === 'google-drive');
        if (!connection) {
          return { success: false, error: 'drive-not-connected' };
        }
        const provider = providerFor('google-drive');
        if (!(provider instanceof GoogleDriveStorageProvider)) {
          return { success: false, error: 'drive-failed' };
        }
        const file = await readCondensedFile(id, extOfMime(record.mimeType));
        const blob = file.type === record.mimeType ? file : file.slice(0, file.size, record.mimeType);
        const name = generateFileName(record.title, extOfMime(record.mimeType));
        const uploaded = await provider.uploadUserFile(connection, DRIVE_FOLDER_NAME, name, blob);
        if (!uploaded.id) throw new Error('drive-failed');
        await patchRecord(id, { driveFileId: uploaded.id, driveSyncedAt: Date.now() });
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.CONDENSE_AUDIO_READ,
    async (request): Promise<MessageResponse<CondenseAudioReadResult>> => {
      const parsed = CondenseAudioReadPayloadSchema.safeParse(request.payload);
      if (!parsed.success) return { success: false, error: 'invalid payload' };
      try {
        const { id, offset, length } = parsed.data;
        const record = await getRecord(id);
        if (!record) return { success: false, error: 'record-missing' };
        const file = await readCondensedFile(id, extOfMime(record.mimeType));
        const slice = file.slice(offset, Math.min(offset + Math.min(length, READ_CHUNK_BYTES), file.size));
        const buffer = await slice.arrayBuffer();
        return {
          success: true,
          data: {
            dataBase64: encodeBase64(buffer),
            sizeBytes: file.size,
            done: offset + buffer.byteLength >= file.size,
          },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ctx.on(MESSAGE_TYPES.CONDENSE_AUDIO_CHUNK, async (request): Promise<MessageResponse> => {
    const parsed = CondenseAudioChunkPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return { success: false, error: 'invalid payload' };
    const chunk = parsed.data;
    try {
      const record = await getRecord(chunk.recordId);
      if (!record) return { success: false, error: 'unknown-record' };
      const job = findJobForRecord(chunk.recordId, true);
      if (isTerminal(record.status) && !chunk.error) {
        return { success: true };
      }
      if (chunk.error) {
        await deleteCondensedFiles(chunk.recordId).catch(() => undefined);
        await failRecord(chunk.recordId, toErrorReason(chunk.error));
        if (job) registry.markFailed(job.id, chunk.error);
        return { success: true };
      }
      if (chunk.dataBase64) {
        const bytes = decodeBase64ToArrayBuffer(chunk.dataBase64);
        await appendPartChunk(chunk.recordId, bytes);
      }
      if (job && chunk.elapsedMs !== undefined) {
        registry.setProgress(job.id, {
          done: chunk.elapsedMs,
          total: record.durationMs,
        });
      }
      if (!chunk.last) return { success: true };
      await patchRecord(chunk.recordId, {
        status: 'finalizing',
        durationMs: chunk.elapsedMs ?? record.durationMs,
      });
      const response = await ctx.offscreenManager.sendToOffscreen<
        MessageResponse<CondenseAudioRunResult> | undefined
      >({
        type: MESSAGE_TYPES.CONDENSE_AUDIO_RUN,
        payload: {
          recordId: chunk.recordId,
          mode: 'transcode',
          durationMs: chunk.elapsedMs ?? record.durationMs,
        },
      });
      const current = await getRecord(chunk.recordId);
      if (!current) {
        await deleteCondensedFiles(chunk.recordId).catch(() => undefined);
        completeJob(chunk.recordId);
        return { success: true };
      }
      if (!response?.success || !response.data) {
        throw new Error(response?.error ?? 'encode-failed');
      }
      await patchRecord(chunk.recordId, {
        status: 'ready',
        sizeBytes: response.data.sizeBytes,
        mimeType: response.data.mimeType,
        durationMs: response.data.durationMs || record.durationMs,
        opfsPath: `condensed/${response.data.outputName}`,
        error: null,
      });
      await deletePartFile(chunk.recordId);
      completeJob(chunk.recordId);
      return { success: true };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn('[background] Condensed audio finalize failed:', detail);
      const reason = isQuotaExceededError(err) ? 'io-failed' : toErrorReason(detail);
      await failRecord(chunk.recordId, reason);
      failJob(chunk.recordId, detail);
      return { success: true };
    }
  });

  ctx.on(MESSAGE_TYPES.CONDENSE_AUDIO_PROGRESS, async (request): Promise<MessageResponse> => {
    const payload = request.payload as CondenseAudioProgressPayload | undefined;
    if (!payload) return { success: false, error: 'invalid payload' };
    const job = findJobForRecord(payload.recordId, true);
    if (job) {
      registry.setProgress(job.id, { done: payload.percent, total: 100 });
    }
    return { success: true };
  });
}
