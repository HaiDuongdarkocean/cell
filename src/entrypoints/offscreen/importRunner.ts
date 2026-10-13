/**
 * Offscreen import runner — dictionary parse + IndexedDB inserts off the
 * service-worker thread.
 *
 * Joins `BroadcastChannel('Tihoka-import')` at module load (statically imported
 * by ffmpegRunner, so the channel is live before the offscreen ping listener
 * answers). One `import-run` request carries the File — posted by the SW for
 * chunk uploads, or by an extension-page sender directly (RESOURCE_IMPORT_BEGIN
 * handoff); requests queue serially. This runner executes importFile against
 * the same extension-origin IndexedDB and streams
 * accepted/progress/resource/done/failed events back.
 */

import { importFile } from '@/features/dictionary/logic/importOrchestrator';
import {
  isImportRunRequest,
  openImportChannel,
  type ImportChannelPort,
  type ImportRunRequest,
} from '@/features/dictionary/logic/importChannel';

const queue: ImportRunRequest[] = [];
let draining = false;

export function startImportRunner(port: ImportChannelPort): void {
  port.listen((message) => {
    if (!isImportRunRequest(message)) return;
    // Ack on receipt, not on execution start: direct-upload senders post
    // import-run themselves, so requests can arrive while another import
    // runs — queue them serially instead of dropping them into an ack
    // timeout on the SW side.
    port.postMessage({ type: 'import-accepted', jobId: message.jobId });
    queue.push(message);
    void drainQueue(port);
  });
}

async function drainQueue(port: ImportChannelPort): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (let request = queue.shift(); request !== undefined; request = queue.shift()) {
      await executeImportRun(port, request);
    }
  } finally {
    draining = false;
  }
}

async function executeImportRun(
  port: ImportChannelPort,
  request: ImportRunRequest,
): Promise<void> {
  const { jobId } = request;
  try {
    const result = await importFile(request.file, {
      langCode: request.langCode,
      components: request.components,
      signature: request.signature,
      onProgress: (done, total) => {
        port.postMessage({ type: 'import-progress', jobId, done, total });
      },
      onResourceCreated: (resourceId) => {
        port.postMessage({ type: 'import-resource', jobId, resourceId });
      },
      onDuplicate: async () => request.duplicateDecision ?? 'skip',
    });
    port.postMessage({ type: 'import-done', jobId, result });
  } catch (err) {
    port.postMessage({
      type: 'import-failed',
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

let bootstrapped = false;

function bootstrapImportRunner(): void {
  if (bootstrapped) return;
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return;
  if (typeof BroadcastChannel === 'undefined') return;
  if (typeof chrome === 'undefined' || !chrome?.runtime?.id) return;

  bootstrapped = true;
  try {
    startImportRunner(openImportChannel());
  } catch (err) {
    console.error('[offscreen-import] runner start failed:', err);
  }
}

bootstrapImportRunner();
