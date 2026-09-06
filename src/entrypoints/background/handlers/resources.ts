/**
 * Dictionary-resource message handlers — RESOURCE_*.
 *
 * IndexedDB is origin-isolated: resources imported from the in-page universal
 * panel (a content-script context) would land in the PAGE's IndexedDB and be
 * invisible to background lookups. All resource reads/writes are therefore
 * proxied here so the extension origin remains the single source of truth.
 *
 * Files arrive as base64 chunks (chrome messages are JSON-only — File /
 * ArrayBuffer do not survive). The last chunk of a job triggers importFile;
 * progress is pushed back via RESOURCE_IMPORT_PROGRESS.
 */
import { z } from 'zod';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage, sendTabMessage } from '@/shared/lib/chrome-apis';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  ResourceListPayloadSchema,
  ResourceDeletePayloadSchema,
  ResourceReorderPayloadSchema,
  ResourceSetEnabledPayloadSchema,
  ResourceSetProfilesPayloadSchema,
  ResourceSamplePayloadSchema,
  ResourceFindPayloadSchema,
  ResourceImportChunkPayloadSchema,
} from '@/features/dictionary/schema';
import {
  getAllResources,
  reorderResources,
  setResourceEnabled,
  setResourceProfiles,
} from '@/features/dictionary/repositories/resourceRepository';
import {
  sampleDictionaryEntries,
  findDictionaryEntry,
} from '@/features/dictionary/repositories/dictionaryRepository';
import {
  sampleFrequencyEntries,
  findFrequencyEntry,
} from '@/features/dictionary/repositories/frequencyRepository';
import { importFile, deleteResourceCascade } from '@/features/dictionary/logic/importOrchestrator';
import type { ImportResult } from '@/entities/dictionary';

const CHUNK_JOB_TTL_MS = 10 * 60 * 1000;

interface PendingImport {
  readonly chunks: string[];
  received: number;
  createdAt: number;
}

const pendingImports = new Map<string, PendingImport>();

function fail<T>(label: string, parsed: { success: false; error: z.ZodError }): MessageResponse<T> {
  return { success: false, error: `Invalid ${label} payload: ${parsed.error.message}` };
}

function ok<T>(data?: T): MessageResponse<T> {
  return { success: true, data };
}

function toError(err: unknown): MessageResponse<never> {
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}

/** Push import progress back to the sender (content-script tab or extension page). */
function notifyProgress(tabId: number | undefined, jobId: string, payload: Record<string, unknown>): void {
  const message = { type: MESSAGE_TYPES.RESOURCE_IMPORT_PROGRESS, payload: { jobId, ...payload } };
  if (tabId !== undefined) {
    sendTabMessage(tabId, message).catch(() => { /* sender tab may be gone */ });
  } else {
    sendMessage(message).catch(() => { /* no listeners */ });
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Register dictionary-resource handlers. */
export function registerResourceHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.RESOURCE_LIST, async (request): Promise<MessageResponse> => {
    const parsed = ResourceListPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_LIST', parsed);
    try {
      return ok({ resources: await getAllResources(parsed.data.langCode) });
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_DELETE, async (request): Promise<MessageResponse> => {
    const parsed = ResourceDeletePayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_DELETE', parsed);
    try {
      await deleteResourceCascade(parsed.data.langCode, parsed.data.resourceId);
      return ok();
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_REORDER, async (request): Promise<MessageResponse> => {
    const parsed = ResourceReorderPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_REORDER', parsed);
    try {
      await reorderResources(parsed.data.langCode, parsed.data.resourceType, parsed.data.orderedIds);
      return ok();
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_SET_ENABLED, async (request): Promise<MessageResponse> => {
    const parsed = ResourceSetEnabledPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_SET_ENABLED', parsed);
    try {
      await setResourceEnabled(parsed.data.langCode, parsed.data.resourceId, parsed.data.enabled);
      return ok();
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_SET_PROFILES, async (request): Promise<MessageResponse> => {
    const parsed = ResourceSetProfilesPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_SET_PROFILES', parsed);
    try {
      await setResourceProfiles(parsed.data.langCode, parsed.data.resourceId, parsed.data.profileIds);
      return ok();
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_SAMPLE, async (request): Promise<MessageResponse> => {
    const parsed = ResourceSamplePayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_SAMPLE', parsed);
    const { langCode, resourceId, resourceType, limit } = parsed.data;
    try {
      const entries = resourceType === 'DICTIONARY'
        ? await sampleDictionaryEntries(langCode, resourceId, limit)
        : await sampleFrequencyEntries(langCode, resourceId, limit);
      return ok({ entries });
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_FIND, async (request): Promise<MessageResponse> => {
    const parsed = ResourceFindPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_FIND', parsed);
    const { langCode, resourceId, resourceType, term } = parsed.data;
    try {
      const entry = resourceType === 'DICTIONARY'
        ? await findDictionaryEntry(langCode, resourceId, term)
        : await findFrequencyEntry(langCode, resourceId, term);
      return ok({ entry: entry ?? null });
    } catch (err) {
      return toError(err);
    }
  });

  // Import: accumulate base64 chunks per jobId; the final chunk runs
  // importFile and its response carries the ImportResult.
  ctx.on(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK, async (request): Promise<MessageResponse<ImportResult | { received: number }>> => {
    const parsed = ResourceImportChunkPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_IMPORT_CHUNK', parsed);
    const p = parsed.data;

    // Reap stale jobs so an abandoned upload can't leak memory.
    for (const [jobId, job] of pendingImports) {
      if (Date.now() - job.createdAt > CHUNK_JOB_TTL_MS) pendingImports.delete(jobId);
    }

    let job = pendingImports.get(p.jobId);
    if (!job) {
      job = { chunks: new Array<string>(p.total), received: 0, createdAt: Date.now() };
      pendingImports.set(p.jobId, job);
    }
    if (job.chunks[p.seq] === undefined) {
      job.chunks[p.seq] = p.data;
      job.received++;
    }
    if (job.received < job.chunks.length) {
      return ok({ received: job.received });
    }
    pendingImports.delete(p.jobId);

    try {
      const bytes = base64ToBytes(job.chunks.join(''));
      const file = new File([bytes as BlobPart], p.fileName, { type: p.fileMime });
      const result = await importFile(file, p.resourceType, {
        langCode: p.langCode,
        onProgress: (processed, estimatedTotal) => notifyProgress(p.tabId, p.jobId, { phase: 'progress', processed, total: estimatedTotal }),
        onResourceCreated: (resourceId) => notifyProgress(p.tabId, p.jobId, { phase: 'created', resourceId }),
        onDuplicate: async () => p.duplicateDecision ?? 'skip',
      });
      notifyProgress(p.tabId, p.jobId, { phase: 'done' });
      return ok(result);
    } catch (err) {
      return toError(err);
    }
  });
}
