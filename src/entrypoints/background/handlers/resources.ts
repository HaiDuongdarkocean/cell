/**
 * Dictionary-resource message handlers — RESOURCE_*.
 *
 * IndexedDB is origin-isolated: resources imported from the in-page universal
 * panel (a content-script context) would land in the PAGE's IndexedDB and be
 * invisible to background lookups. All resource reads/writes are therefore
 * proxied here so the extension origin remains the single source of truth.
 *
 * Long-running work (import, cascade delete) is owned by the JobRegistry:
 * the panel uploads base64 chunks into a background-owned job, the registry
 * detaches execution from the sender, and progress/state are observable via
 * JOB_LIST + JOB_EVENT from any surface.
 */
import type { z } from 'zod';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { JobDuplicateError, type JobRegistry } from '@/features/jobs/logic/jobRegistry';
import { getJobRegistry } from './jobs';
import type { Job } from '@/entities/job/types';
import {
  ResourceListPayloadSchema,
  ResourceDeletePayloadSchema,
  ResourceReorderPayloadSchema,
  ResourceSetEnabledPayloadSchema,
  ResourceRenamePayloadSchema,
  ResourceSetProfilesPayloadSchema,
  ResourceSetComponentsPayloadSchema,
  ResourceComponentsPayloadSchema,
  ResourceSamplePayloadSchema,
  ResourceFindPayloadSchema,
  ResourceImportChunkPayloadSchema,
} from '@/features/dictionary/schema';
import {
  getAllResources,
  getResource,
  reorderResources,
  setResourceEnabled,
  setResourceName,
  setResourceProfiles,
  setResourceDisabledComponents,
  setResourceComponents,
} from '@/features/dictionary/repositories/resourceRepository';
import {
  sampleDictionaryEntries,
  findDictionaryEntry,
  findDictionaryByResource,
} from '@/features/dictionary/repositories/dictionaryRepository';
import { collectEntryComponents, sortedComponents } from '@/features/dictionary/logic/dictionaryComponents';
import type { DictionaryComponent, DuplicateDecision, ResourceType } from '@/entities/dictionary';
import {
  sampleFrequencyEntries,
  findFrequencyEntry,
} from '@/features/dictionary/repositories/frequencyRepository';
import { importFile, deleteResourceCascade, rollbackImport } from '@/features/dictionary/logic/importOrchestrator';
import { clearDictionaryProbeCache } from '@/features/dictionaryPopup/logic/lookupOrchestrator';

const CHUNK_JOB_TTL_MS = 10 * 60 * 1000;
const UPLOAD_STALL_MS = 30 * 1000;

interface ImportChunkMeta {
  readonly fileName: string;
  readonly fileMime: string;
  readonly resourceType: ResourceType;
  readonly langCode: string;
  readonly duplicateDecision?: DuplicateDecision;
}

interface PendingImport {
  readonly chunks: string[];
  received: number;
  createdAt: number;
  stallTimer: ReturnType<typeof setTimeout> | null;
  readonly meta: ImportChunkMeta;
}

interface QueuedImportPayload extends ImportChunkMeta {
  readonly file: File;
}

const pendingImports = new Map<string, PendingImport>();
const importPayloads = new Map<string, QueuedImportPayload>();

function fail<T>(label: string, parsed: { success: false; error: z.ZodError }): MessageResponse<T> {
  return { success: false, error: `Invalid ${label} payload: ${parsed.error.message}` };
}

function ok<T>(data?: T): MessageResponse<T> {
  return { success: true, data };
}

function toError(err: unknown): MessageResponse<never> {
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function clearPending(jobId: string): void {
  const pending = pendingImports.get(jobId);
  if (pending?.stallTimer !== null && pending?.stallTimer !== undefined) {
    clearTimeout(pending.stallTimer);
  }
  pendingImports.delete(jobId);
}

async function runImport(registry: JobRegistry, job: Job): Promise<void> {
  const payload = importPayloads.get(job.id);
  importPayloads.delete(job.id);
  if (!payload) {
    throw new Error('Upload data is no longer available — select the file again');
  }
  const result = await importFile(payload.file, payload.resourceType, {
    langCode: payload.langCode,
    onProgress: (processed, estimatedTotal) => {
      registry.setProgress(job.id, { done: processed, total: estimatedTotal });
    },
    onResourceCreated: (resourceId) => {
      registry.setResourceId(job.id, resourceId);
    },
    onDuplicate: async () => payload.duplicateDecision ?? 'skip',
  });
  clearDictionaryProbeCache();
  registry.markDone(job.id, {
    resourceId: result.resourceId,
    wordCount: result.wordCount,
    format: result.format,
    skippedAsDuplicate: result.skippedAsDuplicate === true,
  });
}

async function runDelete(registry: JobRegistry, job: Job): Promise<void> {
  const langCode = job.params.langCode as string;
  const resourceId = job.params.resourceId as number;
  await deleteResourceCascade(langCode, resourceId, (done, total) => {
    registry.setProgress(job.id, { done, total });
  });
  clearDictionaryProbeCache();
  registry.markDone(job.id, { resourceId });
}

async function reconcileImport(job: Job): Promise<'done' | 'interrupted'> {
  if (job.status !== 'running' || job.resourceId === undefined) return 'interrupted';
  const langCode = job.params.langCode as string;
  const resource = await getResource(langCode, job.resourceId);
  if (!resource) return 'interrupted';
  if (resource.installationFinished) return 'done';
  await rollbackImport(langCode, job.resourceId).catch(() => undefined);
  return 'interrupted';
}

async function reconcileDelete(job: Job): Promise<'done' | 'interrupted'> {
  const langCode = job.params.langCode as string;
  const resourceId = job.params.resourceId as number;
  const resource = await getResource(langCode, resourceId);
  return resource ? 'interrupted' : 'done';
}

/** Register dictionary-resource handlers. */
export function registerResourceHandlers(ctx: BackgroundContext): void {
  const registry = getJobRegistry();

  registry.registerExecutor('resource-import', {
    start: (job) => runImport(registry, job),
    reconcile: reconcileImport,
  });
  registry.registerExecutor('resource-delete', {
    start: (job) => runDelete(registry, job),
    reconcile: reconcileDelete,
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_LIST, async (request): Promise<MessageResponse> => {
    const parsed = ResourceListPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_LIST', parsed);
    try {
      return ok({ resources: await getAllResources(parsed.data.langCode) });
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_DELETE, async (request): Promise<MessageResponse<{ jobId: string }>> => {
    const parsed = ResourceDeletePayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_DELETE', parsed);
    const { langCode, resourceId } = parsed.data;
    try {
      const existing = registry.findActive('resource-delete', { resourceId, langCode });
      if (existing) return ok({ jobId: existing.id });

      const resource = await getResource(langCode, resourceId);
      const jobId = `del-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const job = registry.register({
        id: jobId,
        kind: 'resource-delete',
        label: resource?.name ?? `#${resourceId}`,
        status: 'queued',
        params: { resourceId, langCode, resourceType: resource?.type ?? null },
        retryable: true,
      });
      registry.startIfSlotFree(job);
      return ok({ jobId });
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_REORDER, async (request): Promise<MessageResponse> => {
    const parsed = ResourceReorderPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_REORDER', parsed);
    try {
      await reorderResources(parsed.data.langCode, parsed.data.resourceType, parsed.data.orderedIds);
      clearDictionaryProbeCache();
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
      clearDictionaryProbeCache();
      return ok();
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_RENAME, async (request): Promise<MessageResponse> => {
    const parsed = ResourceRenamePayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_RENAME', parsed);
    try {
      await setResourceName(parsed.data.langCode, parsed.data.resourceId, parsed.data.name);
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

  ctx.on(MESSAGE_TYPES.RESOURCE_SET_COMPONENTS, async (request): Promise<MessageResponse> => {
    const parsed = ResourceSetComponentsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_SET_COMPONENTS', parsed);
    try {
      await setResourceDisabledComponents(parsed.data.langCode, parsed.data.resourceId, parsed.data.disabledComponents);
      return ok();
    } catch (err) {
      return toError(err);
    }
  });

  // Lazy component detection for resources imported before
  // ResourceInfo.components existed — scans the entry store once, then
  // persists the result so later reads are free.
  ctx.on(MESSAGE_TYPES.RESOURCE_COMPONENTS, async (request): Promise<MessageResponse> => {
    const parsed = ResourceComponentsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_COMPONENTS', parsed);
    const { langCode, resourceId } = parsed.data;
    try {
      const resource = await getResource(langCode, resourceId);
      if (!resource) return toError(new Error(`Không tìm thấy resource id ${resourceId}.`));
      if (resource.components) return ok({ components: resource.components });
      const set = new Set<DictionaryComponent>();
      for (const entry of await findDictionaryByResource(langCode, resourceId)) {
        collectEntryComponents(set, entry);
      }
      const components = sortedComponents(set);
      await setResourceComponents(langCode, resourceId, components);
      return ok({ components });
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

  // Import: chunks accumulate into a registry-owned job (status 'uploading').
  // The final chunk hands the assembled file to the executor and returns
  // {jobId} immediately — parsing runs detached from the sender, observable
  // via JOB_LIST/JOB_EVENT. Chunks for unknown or terminal jobs are rejected
  // so a restarted sender cannot resurrect an interrupted job.
  ctx.on(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK, async (request): Promise<MessageResponse<{ received?: number; jobId?: string }>> => {
    const parsed = ResourceImportChunkPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_IMPORT_CHUNK', parsed);
    const p = parsed.data;

    for (const [jobId, pending] of pendingImports) {
      if (Date.now() - pending.createdAt > CHUNK_JOB_TTL_MS) {
        clearPending(jobId);
        registry.markInterrupted(jobId, 'interrupted-upload-ttl');
      }
    }

    let pending = pendingImports.get(p.jobId);
    if (!pending) {
      const existing = registry.get(p.jobId);
      if (existing) {
        return toError(new Error(`Import job ${p.jobId} is ${existing.status} — chunk rejected`));
      }
      try {
        registry.register({
          id: p.jobId,
          kind: 'resource-import',
          label: p.fileName,
          status: 'uploading',
          params: {
            jobId: p.jobId,
            signature: p.signature ?? p.jobId,
            langCode: p.langCode,
            resourceType: p.resourceType,
          },
          retryable: false,
        });
      } catch (err) {
        if (err instanceof JobDuplicateError) {
          return toError(new Error('An import for this file is already in progress'));
        }
        return toError(err);
      }
      pending = {
        chunks: new Array<string>(p.total),
        received: 0,
        createdAt: Date.now(),
        stallTimer: null,
        meta: {
          fileName: p.fileName,
          fileMime: p.fileMime,
          resourceType: p.resourceType,
          langCode: p.langCode,
          duplicateDecision: p.duplicateDecision,
        },
      };
      pendingImports.set(p.jobId, pending);
    }

    if (pending.chunks[p.seq] === undefined) {
      pending.chunks[p.seq] = p.data;
      pending.received++;
      registry.setProgress(p.jobId, { done: pending.received, total: pending.chunks.length, unit: 'items' });
    }
    if (pending.stallTimer !== null) clearTimeout(pending.stallTimer);
    pending.stallTimer = setTimeout(() => {
      clearPending(p.jobId);
      registry.markInterrupted(p.jobId, 'interrupted-upload-stall');
    }, UPLOAD_STALL_MS);

    if (pending.received < pending.chunks.length) {
      return ok({ received: pending.received });
    }

    const meta = pending.meta;
    clearPending(p.jobId);
    try {
      const bytes = base64ToBytes(pending.chunks.join(''));
      importPayloads.set(p.jobId, {
        file: new File([bytes as BlobPart], meta.fileName, { type: meta.fileMime }),
        ...meta,
      });
      const job = registry.update(p.jobId, { status: 'queued' }, { persistNow: true });
      if (job) registry.startIfSlotFree(job);
      return ok({ jobId: p.jobId });
    } catch (err) {
      return toError(err);
    }
  });
}
