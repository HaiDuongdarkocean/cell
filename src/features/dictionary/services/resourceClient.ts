// resourceClient — proxy for dictionary-resource operations.
//
// IndexedDB is origin-isolated: calling the repositories directly from a
// content-script context (in-page universal panel, popup dictionary) would
// read/write the PAGE's IndexedDB, invisible to background lookups. All
// resource operations therefore go through background messages so the
// extension origin stays the single source of truth.
//
// Long-running work (import, delete) is owned by the background JobRegistry:
// these calls return a jobId as soon as the background owns the job; progress
// and terminal state are observed via JOB_LIST/JOB_EVENT (see jobClient).
// Import transport: extension-origin senders (popup) hand the File to the
// offscreen runner directly over BroadcastChannel (RESOURCE_IMPORT_BEGIN +
// `import-run` — chrome messages are JSON-only but the channel structured-
// clones blobs); page-origin senders ship bytes as windowed base64 chunks.

import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { subscribeJobEvents } from '@/features/jobs';
import { isTerminalJob } from '@/entities/job/types';
import { emitDictionaryChanged } from './dictionaryEvents';
import { computeSignature } from '../logic/signatureGenerator';
import { openImportChannel } from '../logic/importChannel';
import type { ReadableFile } from '../logic/fileDetector';
import type {
  DictionaryComponent,
  DuplicateDecision,
  ResourceInfo,
} from '@/entities/dictionary';
import type { MessageResponse } from '@/entities/message';
import { t } from '@/shared/i18n';

/** Raw bytes per import chunk — ≤4MiB base64 on the wire per message. */
const IMPORT_CHUNK_BYTES = 3 * 1024 * 1024;

/** In-flight chunk messages per upload — the receiver buffers out-of-order
 *  arrivals, so a small window overlaps encode + round-trip without SW
 *  memory spikes. */
const IMPORT_UPLOAD_WINDOW = 4;

interface ImportCallbacks {
  readonly langCode: string;
  /** Panel-minted job id — the row tracking this import. Falls back to an internal id. */
  readonly jobId?: string;
  /** Component subset the user picked on a multi-component file; absent = all detected. */
  readonly components?: readonly DictionaryComponent[];
  /** Live selection source — called per chunk so toggles mid-upload take
   *  effect; the background keeps the value from the last chunk received. */
  readonly getComponents?: () => readonly DictionaryComponent[] | undefined;
  readonly onDuplicate?: (existing: ResourceInfo) => DuplicateDecision | Promise<DuplicateDecision>;
  /** Called after each base64 chunk is acknowledged by the background. */
  readonly onUploadProgress?: (sent: number, total: number) => void;
}

async function request<T>(type: string, payload: unknown): Promise<T> {
  const res = await sendMessage<MessageResponse<T>>({ type, payload });
  if (!res?.success) {
    throw new Error(res?.error ?? t('resources.error.request', [type]));
  }
  return res.data as T;
}

type ResourceChangeListener = (langCode: string) => void;
const changeListeners = new Set<ResourceChangeListener>();

/** Subscribe to in-context resource mutations (same document). Returns an
 *  unsubscribe fn — surfaces hosting a live lookup re-run it on change. */
export function subscribeResourceChanges(listener: ResourceChangeListener): () => void {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}

function notifyResourcesChanged(langCode: string): void {
  for (const listener of changeListeners) listener(langCode);
  emitDictionaryChanged({ langCode, reason: 'resource-mutation' });
}

// Resource mutations now complete inside background-owned jobs — re-notify
// subscribers when a resource job reaches a terminal state so live lookups
// refresh even when no surface in this context triggered the work.
let jobEventsHooked = false;
function hookJobCompletionEvents(): void {
  if (jobEventsHooked) return;
  jobEventsHooked = true;
  subscribeJobEvents(({ job }) => {
    if (!job || !isTerminalJob(job)) return;
    if (job.kind !== 'resource-delete' && job.kind !== 'resource-import') return;
    const langCode = job.params.langCode;
    if (typeof langCode === 'string') notifyResourcesChanged(langCode);
  });
}

export async function listResources(langCode: string): Promise<ResourceInfo[]> {
  hookJobCompletionEvents();
  // No background listener (showcase / unit-test env) → empty list rather
  // than an error state; a real failure still throws.
  const res = await sendMessage<MessageResponse<{ resources: ResourceInfo[] }>>({
    type: MESSAGE_TYPES.RESOURCE_LIST,
    payload: { langCode },
  });
  if (res === undefined) return [];
  if (!res.success) throw new Error(res.error ?? t('resources.error.list'));
  return res.data?.resources ?? [];
}

/** Queue a background-owned cascade delete. The jobId identifies the
 *  registry row; progress/terminal state arrive via JOB_EVENT. */
export async function deleteResource(
  langCode: string,
  resourceId: number,
): Promise<{ jobId: string }> {
  const data = await request<{ jobId: string }>(MESSAGE_TYPES.RESOURCE_DELETE, { langCode, resourceId });
  notifyResourcesChanged(langCode);
  return data;
}

export async function reorderResources(
  langCode: string,
  orderedIds: readonly number[],
): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_REORDER, { langCode, orderedIds: [...orderedIds] });
  notifyResourcesChanged(langCode);
}

export async function setResourceEnabled(langCode: string, resourceId: number, enabled: boolean): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_SET_ENABLED, { langCode, resourceId, enabled });
  notifyResourcesChanged(langCode);
}

export async function renameResource(langCode: string, resourceId: number, name: string): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_RENAME, { langCode, resourceId, name });
  notifyResourcesChanged(langCode);
}

export async function setResourceProfiles(
  langCode: string,
  resourceId: number,
  profileIds: readonly string[],
): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_SET_PROFILES, { langCode, resourceId, profileIds: [...profileIds] });
  notifyResourcesChanged(langCode);
}

export async function setResourceComponents(
  langCode: string,
  resourceId: number,
  disabledComponents: readonly DictionaryComponent[],
): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_SET_COMPONENTS, {
    langCode, resourceId, disabledComponents: [...disabledComponents],
  });
  notifyResourcesChanged(langCode);
}

/** Components this dictionary contains — persisted on the resource; the
 *  background lazily scans + caches for pre-existing imports. */
export async function getResourceComponents(
  langCode: string,
  resourceId: number,
): Promise<readonly DictionaryComponent[]> {
  const data = await request<{ components: readonly DictionaryComponent[] }>(
    MESSAGE_TYPES.RESOURCE_COMPONENTS, { langCode, resourceId },
  );
  return data?.components ?? [];
}

const nativeToBase64 = (Uint8Array.prototype as { toBase64?: (this: Uint8Array) => string }).toBase64;

function bytesToBase64(bytes: Uint8Array): string {
  if (nativeToBase64 !== undefined) return nativeToBase64.call(bytes);
  // 32KB subarray slices keep spread arg counts safely under engine limits.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32 * 1024) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32 * 1024));
  }
  return btoa(binary);
}

/** Whole-file gzip when the platform can stream+compress; skipped on
 *  already-compressed containers and unstreamable file-likes. */
async function gzipUpload(file: ReadableFile): Promise<Uint8Array | undefined> {
  const streamable = file as Partial<File>;
  if (typeof CompressionStream === 'undefined' || typeof streamable.stream !== 'function') {
    return undefined;
  }
  if (/\.(gz|zip)$/i.test(file.name)) return undefined;
  const compressed = await new Response(
    streamable.stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  return new Uint8Array(compressed);
}

/**
 * Direct File handoff for extension-origin senders (popup): the background
 * registers the job and attaches its channel listener inside
 * RESOURCE_IMPORT_BEGIN, then this side posts `import-run` carrying the
 * File to the offscreen runner over BroadcastChannel('cell-import') —
 * no byte transport, no SW-side buffering. Returns undefined whenever the
 * handoff is unavailable or rejected so the caller can fall back to the
 * chunk path under the same jobId.
 */
async function tryDirectImport(
  file: ReadableFile,
  input: {
    readonly jobId: string;
    readonly langCode: string;
    readonly selection?: readonly DictionaryComponent[];
    readonly signature: string;
    readonly decision?: DuplicateDecision;
    readonly onUploadProgress?: (sent: number, total: number) => void;
  },
): Promise<{ jobId: string } | undefined> {
  if (
    !(file instanceof File) ||
    typeof location === 'undefined' ||
    location.protocol !== 'chrome-extension:' ||
    typeof BroadcastChannel !== 'function'
  ) {
    return undefined;
  }
  const duplicateDecision = input.decision === 'replace' ? ('replace' as const) : undefined;
  try {
    const res = await request<{ direct?: boolean; jobId?: string }>(
      MESSAGE_TYPES.RESOURCE_IMPORT_BEGIN,
      {
        jobId: input.jobId,
        fileName: file.name,
        langCode: input.langCode,
        signature: input.signature,
        duplicateDecision,
      },
    );
    if (res.direct !== true) return undefined;
    const jobId = res.jobId ?? input.jobId;
    const port = openImportChannel();
    try {
      port.postMessage({
        type: 'import-run',
        jobId,
        file,
        langCode: input.langCode,
        components: input.selection,
        signature: input.signature,
        duplicateDecision,
      });
    } finally {
      port.close();
    }
    input.onUploadProgress?.(1, 1);
    return { jobId };
  } catch {
    return undefined;
  }
}

/**
 * Upload a resource file into a background-owned import job.
 *
 * Duplicate detection runs client-side first (signature → RESOURCE_LIST) so
 * the UI's onDuplicate prompt resolves before any bytes are uploaded.
 * 'skip' returns early without transferring; 'replace' rides along as
 * duplicateDecision and the background's importFile cascade-deletes the old
 * resource before importing.
 *
 * Resolves with the registry jobId once all bytes are handed off — parsing
 * continues detached in the background; watch JOB_EVENT for the outcome.
 * Returns {skipped:true} when a duplicate was declined before upload.
 */
export async function importResourceFile(
  file: ReadableFile,
  options: ImportCallbacks,
): Promise<{ jobId: string } | { skipped: true; existingResource: ResourceInfo }> {
  const { langCode, jobId: providedJobId, components, getComponents, onDuplicate, onUploadProgress } = options;

  const signature = await computeSignature(file);
  const existing = (await listResources(langCode)).find((r) => r.signature === signature);
  let decision: DuplicateDecision | undefined;
  if (existing) {
    decision = await (onDuplicate?.(existing) ?? 'skip');
    if (decision === 'skip') {
      return { skipped: true, existingResource: existing };
    }
  }

  // ponytail: uniqueness only needs to disambiguate concurrent in-flight
  // imports on this page — time + random is enough (crypto.randomUUID is
  // unavailable in the jsdom test env).
  const jobId = providedJobId ?? `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const direct = await tryDirectImport(file, {
    jobId,
    langCode,
    selection: getComponents?.() ?? components,
    signature,
    decision,
    onUploadProgress,
  });
  if (direct !== undefined) {
    notifyResourcesChanged(langCode);
    return direct;
  }

  const gzipped = await gzipUpload(file).catch(() => undefined);
  const total = Math.max(1, Math.ceil((gzipped?.length ?? file.size) / IMPORT_CHUNK_BYTES));
  let nextSeq = 0;
  let completed = 0;
  let uploadError: unknown;
  let registryJobId: string | undefined;
  const workers = Array.from({ length: Math.min(IMPORT_UPLOAD_WINDOW, total) }, async () => {
    while (uploadError === undefined) {
      const seq = nextSeq;
      nextSeq += 1;
      if (seq >= total) return;
      const start = seq * IMPORT_CHUNK_BYTES;
      const data = gzipped !== undefined
        ? bytesToBase64(gzipped.subarray(start, start + IMPORT_CHUNK_BYTES))
        : bytesToBase64(new Uint8Array(await file.slice(start, start + IMPORT_CHUNK_BYTES).arrayBuffer()));
      const selection = getComponents?.() ?? components;
      try {
        const res = await request<{ received?: number; jobId?: string }>(
          MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
          {
            jobId,
            seq,
            total,
            data,
            encoding: gzipped !== undefined ? 'gzip' : undefined,
            fileName: file.name,
            fileMime: (file as File).type ?? '',
            langCode,
            components: selection ? [...selection] : undefined,
            signature,
            duplicateDecision: decision === 'replace' ? 'replace' : undefined,
          },
        );
        completed += 1;
        onUploadProgress?.(completed, total);
        if (typeof res.jobId === 'string') registryJobId = res.jobId;
      } catch (err) {
        uploadError ??= err;
      }
    }
  });
  await Promise.all(workers);
  if (uploadError !== undefined) throw uploadError;
  notifyResourcesChanged(langCode);
  return { jobId: registryJobId ?? jobId };
}
