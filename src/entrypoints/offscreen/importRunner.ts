/**
 * Offscreen import runner — dictionary parse + IndexedDB inserts off the
 * service-worker thread.
 *
 * Joins `BroadcastChannel('cell-import')` at module load (statically imported
 * by ffmpegRunner, so the channel is live before the offscreen ping listener
 * answers). The SW posts one `import-run` request carrying the assembled
 * File; this runner executes importFile against the same extension-origin
 * IndexedDB and streams accepted/progress/resource/done/failed events back.
 */

import { importFile } from '@/features/dictionary/logic/importOrchestrator';
import {
  isImportRunRequest,
  openImportChannel,
  type ImportChannelPort,
  type ImportRunRequest,
} from '@/features/dictionary/logic/importChannel';

let running = false;

export function startImportRunner(port: ImportChannelPort): void {
  port.listen((message) => {
    if (!isImportRunRequest(message) || running) return;
    running = true;
    void executeImportRun(port, message).finally(() => {
      running = false;
    });
  });
}

async function executeImportRun(
  port: ImportChannelPort,
  request: ImportRunRequest,
): Promise<void> {
  const { jobId } = request;
  port.postMessage({ type: 'import-accepted', jobId });
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
