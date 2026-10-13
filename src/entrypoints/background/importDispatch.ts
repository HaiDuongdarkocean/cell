/**
 * Resource-import executor dispatch — runs importFile in the offscreen
 * document so parse + IndexedDB insert bursts leave the SW responsive.
 *
 * SW → offscreen: one `import-run` message on BroadcastChannel('Tihoka-import')
 * (structured clone carries the File; runtime messages are JSON-only).
 * Offscreen → SW: accepted/progress/resource/done/failed events on the same
 * channel — mapped back onto the JobRegistry so progress and terminal state
 * look identical to the in-SW path.
 *
 * Liveness: `ensureOffscreenReady` proves the listener before posting; the
 * runner's `import-accepted` ack confirms it took the job (interrupted after
 * IMPORT_ACK_TIMEOUT_MS otherwise); a 25s OFFSCREEN_PING heartbeat via
 * sendToOffscreen keeps the document off the idle-close path and interrupts
 * the job the moment the document is gone. A dead runner leaves a
 * half-installed resource behind — the SW rolls it back itself, mirroring
 * boot-time reconcileImport.
 *
 * Firefox has no chrome.offscreen → isOffscreenSupported() false → the same
 * importFile call runs on the event page, exactly as before. If the document
 * can't be created on Chrome, that in-SW path is also the fallback.
 */

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { isOffscreenSupported } from '@/shared/lib/chrome-apis';
import { JOB_ERROR_INTERRUPTED_OFFSCREEN, type Job } from '@/entities/job/types';
import type { JobRegistry } from '@/features/jobs/logic/jobRegistry';
import { importFile, rollbackImport } from '@/features/dictionary/logic/importOrchestrator';
import {
  isImportRunEvent,
  openImportChannel,
  type ImportChannelPort,
  type ImportRunRequest,
} from '@/features/dictionary/logic/importChannel';
import type {
  DictionaryComponent,
  DuplicateDecision,
  ImportResult,
} from '@/entities/dictionary';
import type { OffscreenManager } from './offscreenManager';

const IMPORT_ACK_TIMEOUT_MS = 10_000;
const OFFSCREEN_HEARTBEAT_MS = 25_000;

export interface ImportJobPayload {
  readonly file: File;
  readonly langCode: string;
  readonly components?: readonly DictionaryComponent[];
  readonly duplicateDecision?: DuplicateDecision;
}

export async function executeResourceImport(
  offscreen: OffscreenManager,
  registry: JobRegistry,
  job: Job,
  payload: ImportJobPayload,
): Promise<ImportResult> {
  if (!isOffscreenSupported() || typeof BroadcastChannel !== 'function') {
    return runImportInProcess(registry, job, payload);
  }
  try {
    await offscreen.ensureOffscreenReady();
  } catch (err) {
    console.warn('[import] offscreen unavailable — importing on the SW thread:', err);
    return runImportInProcess(registry, job, payload);
  }
  return dispatchImportToOffscreen(offscreen, registry, job, payload, openImportChannel());
}

export async function dispatchImportToOffscreen(
  offscreen: OffscreenManager,
  registry: JobRegistry,
  job: Job,
  payload: ImportJobPayload,
  port: ImportChannelPort,
): Promise<ImportResult> {
  let resourceId: number | undefined;
  let runnerFailed = false;
  let interrupt = (): void => {};
  const heartbeat = setInterval(() => {
    void offscreen.sendToOffscreen({ type: MESSAGE_TYPES.OFFSCREEN_PING }).catch(() => {
      interrupt();
    });
  }, OFFSCREEN_HEARTBEAT_MS);

  try {
    return await new Promise<ImportResult>((resolve, reject) => {
      let settled = false;
      const succeed = (value: ImportResult): void => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const fail = (err: Error): void => {
        if (settled) return;
        settled = true;
        reject(err);
      };
      interrupt = (): void => {
        if (settled) return;
        registry.markInterrupted(job.id, JOB_ERROR_INTERRUPTED_OFFSCREEN);
        fail(new Error(JOB_ERROR_INTERRUPTED_OFFSCREEN));
      };
      const ackTimer = setTimeout(interrupt, IMPORT_ACK_TIMEOUT_MS);

      port.listen((message) => {
        if (!isImportRunEvent(message) || message.jobId !== job.id) return;
        switch (message.type) {
          case 'import-accepted':
            clearTimeout(ackTimer);
            break;
          case 'import-progress':
            registry.setProgress(job.id, { done: message.done, total: message.total });
            break;
          case 'import-resource':
            resourceId = message.resourceId;
            registry.setResourceId(job.id, message.resourceId);
            break;
          case 'import-done':
            succeed(message.result);
            break;
          case 'import-failed':
            runnerFailed = true;
            fail(new Error(message.error));
            break;
        }
      });

      const request: ImportRunRequest = {
        type: 'import-run',
        jobId: job.id,
        file: payload.file,
        langCode: payload.langCode,
        components: payload.components,
        signature: signatureOf(job),
        duplicateDecision: payload.duplicateDecision,
      };
      port.postMessage(request);
    });
  } catch (err) {
    // The runner rolls back its own failures; only a dead transport needs the
    // SW to clean up a half-installed resource itself.
    if (!runnerFailed && resourceId !== undefined) {
      await rollbackImport(payload.langCode, resourceId).catch(() => undefined);
    }
    throw err;
  } finally {
    clearInterval(heartbeat);
    port.close();
  }
}

function runImportInProcess(
  registry: JobRegistry,
  job: Job,
  payload: ImportJobPayload,
): Promise<ImportResult> {
  return importFile(payload.file, {
    langCode: payload.langCode,
    components: payload.components,
    signature: signatureOf(job),
    onProgress: (done, total) => {
      registry.setProgress(job.id, { done, total });
    },
    onResourceCreated: (resourceId) => {
      registry.setResourceId(job.id, resourceId);
    },
    onDuplicate: async () => payload.duplicateDecision ?? 'skip',
  });
}

function signatureOf(job: Job): string | undefined {
  return typeof job.params.signature === 'string' ? job.params.signature : undefined;
}
