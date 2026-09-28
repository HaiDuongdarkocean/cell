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
// Import ships file bytes as base64 chunks (chrome messages are JSON-only).

import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { subscribeJobEvents } from '@/features/jobs';
import { isTerminalJob } from '@/entities/job/types';
import { computeSignature } from '../logic/signatureGenerator';
import type { ReadableFile } from '../logic/fileDetector';
import type {
  DictionaryComponent,
  DuplicateDecision,
  ResourceInfo,
  ResourceType,
} from '@/entities/dictionary';
import type { MessageResponse } from '@/entities/message';
import { t } from '@/shared/i18n';

/** Base64 chars per import chunk message. */
const IMPORT_CHUNK_SIZE = 4 * 1024 * 1024;

interface ImportCallbacks {
  readonly langCode: string;
  /** Panel-minted job id — the row tracking this import. Falls back to an internal id. */
  readonly jobId?: string;
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
  resourceType?: ResourceType,
): Promise<{ jobId: string }> {
  const data = await request<{ jobId: string }>(MESSAGE_TYPES.RESOURCE_DELETE, { langCode, resourceId, resourceType });
  notifyResourcesChanged(langCode);
  return data;
}

export async function reorderResources(
  langCode: string,
  resourceType: ResourceType,
  orderedIds: readonly number[],
): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_REORDER, { langCode, resourceType, orderedIds: [...orderedIds] });
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

function readAsDataUrl(file: ReadableFile): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file as File);
  });
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
  resourceType: ResourceType,
  options: ImportCallbacks,
): Promise<{ jobId: string } | { skipped: true; existingResource: ResourceInfo }> {
  const { langCode, jobId: providedJobId, onDuplicate, onUploadProgress } = options;

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

  const dataUrl = await readAsDataUrl(file);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const total = Math.max(1, Math.ceil(base64.length / IMPORT_CHUNK_SIZE));
  for (let seq = 0; seq < total; seq++) {
    const last = seq === total - 1;
    const res = await request<{ received?: number; jobId?: string }>(
      MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
      {
        jobId,
        seq,
        total,
        data: base64.slice(seq * IMPORT_CHUNK_SIZE, (seq + 1) * IMPORT_CHUNK_SIZE),
        fileName: file.name,
        fileMime: (file as File).type ?? '',
        resourceType,
        langCode,
        signature,
        duplicateDecision: decision === 'replace' ? 'replace' : undefined,
      },
    );
    onUploadProgress?.(seq + 1, total);
    if (last) {
      notifyResourcesChanged(langCode);
      return { jobId: res.jobId ?? jobId };
    }
  }
  throw new Error(t('resources.error.uploadEnded'));
}
