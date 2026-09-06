// resourceClient — proxy for dictionary-resource operations.
//
// IndexedDB is origin-isolated: calling the repositories directly from a
// content-script context (in-page universal panel, popup dictionary) would
// read/write the PAGE's IndexedDB, invisible to background lookups. All
// resource operations therefore go through background messages so the
// extension origin stays the single source of truth.
//
// Import ships file bytes as base64 chunks (chrome messages are JSON-only);
// progress arrives via RESOURCE_IMPORT_PROGRESS push messages.

import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { computeSignature } from '../logic/signatureGenerator';
import type { ReadableFile } from '../logic/fileDetector';
import type {
  DictionaryEntry,
  DuplicateDecision,
  FrequencyEntry,
  ImportProgressCallback,
  ImportResult,
  ResourceInfo,
  ResourceType,
} from '@/entities/dictionary';
import type { MessageResponse } from '@/entities/message';

/** Base64 chars per import chunk message. */
const IMPORT_CHUNK_SIZE = 4 * 1024 * 1024;

interface ImportCallbacks {
  readonly langCode: string;
  readonly onProgress?: ImportProgressCallback;
  readonly onResourceCreated?: (resourceId: number) => void;
  readonly onDuplicate?: (existing: ResourceInfo) => DuplicateDecision | Promise<DuplicateDecision>;
}

async function request<T>(type: string, payload: unknown): Promise<T> {
  const res = await sendMessage<MessageResponse<T>>({ type, payload });
  if (!res?.success) {
    throw new Error(res?.error ?? `${type} failed`);
  }
  return res.data as T;
}

export async function listResources(langCode: string): Promise<ResourceInfo[]> {
  // No background listener (showcase / unit-test env) → empty list rather
  // than an error state; a real failure still throws.
  const res = await sendMessage<MessageResponse<{ resources: ResourceInfo[] }>>({
    type: MESSAGE_TYPES.RESOURCE_LIST,
    payload: { langCode },
  });
  if (res === undefined) return [];
  if (!res.success) throw new Error(res.error ?? 'RESOURCE_LIST failed');
  return res.data?.resources ?? [];
}

export async function deleteResource(langCode: string, resourceId: number): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_DELETE, { langCode, resourceId });
}

export async function reorderResources(
  langCode: string,
  resourceType: ResourceType,
  orderedIds: readonly number[],
): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_REORDER, { langCode, resourceType, orderedIds: [...orderedIds] });
}

export async function setResourceEnabled(langCode: string, resourceId: number, enabled: boolean): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_SET_ENABLED, { langCode, resourceId, enabled });
}

export async function setResourceProfiles(
  langCode: string,
  resourceId: number,
  profileIds: readonly string[],
): Promise<void> {
  await request(MESSAGE_TYPES.RESOURCE_SET_PROFILES, { langCode, resourceId, profileIds: [...profileIds] });
}

export async function sampleDictionaryEntries(
  langCode: string,
  resourceId: number,
  limit: number,
): Promise<DictionaryEntry[]> {
  const data = await request<{ entries: DictionaryEntry[] }>(MESSAGE_TYPES.RESOURCE_SAMPLE, {
    langCode, resourceId, resourceType: 'DICTIONARY', limit,
  });
  return data?.entries ?? [];
}

export async function findDictionaryEntry(
  langCode: string,
  resourceId: number,
  term: string,
): Promise<DictionaryEntry | undefined> {
  const data = await request<{ entry: DictionaryEntry | null }>(MESSAGE_TYPES.RESOURCE_FIND, {
    langCode, resourceId, resourceType: 'DICTIONARY', term,
  });
  return data?.entry ?? undefined;
}

export async function sampleFrequencyEntries(
  langCode: string,
  resourceId: number,
  limit: number,
): Promise<FrequencyEntry[]> {
  const data = await request<{ entries: FrequencyEntry[] }>(MESSAGE_TYPES.RESOURCE_SAMPLE, {
    langCode, resourceId, resourceType: 'FREQUENCY', limit,
  });
  return data?.entries ?? [];
}

export async function findFrequencyEntry(
  langCode: string,
  resourceId: number,
  term: string,
): Promise<FrequencyEntry | undefined> {
  const data = await request<{ entry: FrequencyEntry | null }>(MESSAGE_TYPES.RESOURCE_FIND, {
    langCode, resourceId, resourceType: 'FREQUENCY', term,
  });
  return data?.entry ?? undefined;
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
 * Import a resource file via the background (extension-origin IDB).
 *
 * Duplicate detection runs client-side first (signature → RESOURCE_LIST) so
 * the UI's onDuplicate prompt resolves before any bytes are uploaded.
 * 'skip' returns early without transferring; 'replace' rides along as
 * duplicateDecision and the background's importFile cascade-deletes the old
 * resource before importing.
 */
export async function importResourceFile(
  file: ReadableFile,
  resourceType: ResourceType,
  options: ImportCallbacks,
): Promise<ImportResult> {
  const { langCode, onProgress, onResourceCreated, onDuplicate } = options;

  const signature = await computeSignature(file);
  const existing = (await listResources(langCode)).find((r) => r.signature === signature);
  let decision: DuplicateDecision | undefined;
  if (existing) {
    decision = await (onDuplicate?.(existing) ?? 'skip');
    if (decision === 'skip') {
      return {
        resourceId: existing.id ?? 0,
        wordCount: existing.wordCount,
        format: existing.format,
        skippedAsDuplicate: true,
        existingResource: existing,
      };
    }
  }

  // ponytail: uniqueness only needs to disambiguate concurrent in-flight
  // imports on this page — time + random is enough (crypto.randomUUID is
  // unavailable in the jsdom test env).
  const jobId = `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const onProgressMessage = (message: unknown): void => {
    const msg = message as { type?: string; payload?: { jobId?: string; phase?: string; processed?: number; total?: number; resourceId?: number } };
    if (msg?.type !== MESSAGE_TYPES.RESOURCE_IMPORT_PROGRESS || msg.payload?.jobId !== jobId) return;
    if (msg.payload.phase === 'created') onResourceCreated?.(msg.payload.resourceId ?? 0);
    else if (msg.payload.phase === 'progress' && msg.payload.processed !== undefined) {
      onProgress?.(msg.payload.processed, msg.payload.total ?? 0);
    }
  };
  onMessage(onProgressMessage);

  try {
    const dataUrl = await readAsDataUrl(file);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const total = Math.max(1, Math.ceil(base64.length / IMPORT_CHUNK_SIZE));
    let result: ImportResult | undefined;
    for (let seq = 0; seq < total; seq++) {
      const last = seq === total - 1;
      const res = await request<ImportResult | { received: number }>(
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
          duplicateDecision: decision === 'replace' ? 'replace' : undefined,
        },
      );
      if (last) result = res as ImportResult;
    }
    return result!;
  } finally {
    removeOnMessageListener(onProgressMessage);
  }
}
