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
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { JobDuplicateError, type JobRegistry } from '@/features/jobs/logic/jobRegistry';
import { getJobRegistry, whenJobsReady } from './jobs';
import { broadcastDictionaryChanged } from './dictionaryBroadcast';
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
  sampleFrequencyEntries,
  findDictionaryEntry,
  findFrequencyEntry,
  findDictionaryByResource,
  findFrequencyByResource,
} from '@/features/dictionary/repositories/resourceEntryRepository';
import { collectEntryComponents, sortedComponents } from '@/features/dictionary/logic/dictionaryComponents';
import type { DictionaryComponent, DuplicateDecision } from '@/entities/dictionary';
import { importFile, deleteResourceCascade, rollbackImport } from '@/features/dictionary/logic/importOrchestrator';
import { clearDictionaryProbeCache } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import { decodeBase64ToBytes } from '@/shared/lib/base64';

const UPLOAD_STALL_MS = 30 * 1000;

interface ImportChunkMeta {
  readonly fileName: string;
  readonly fileMime: string;
  readonly langCode: string;
  readonly components?: readonly DictionaryComponent[];
  readonly duplicateDecision?: DuplicateDecision;
}

interface PendingImport {
  /** Decoded bytes per chunk — decoding on arrival avoids holding the whole
   *  base64 payload plus a joined string plus one giant atob output (peak was
   *  ~3.6× file size in the service worker; now ~2×). */
  readonly chunks: Uint8Array[];
  received: number;
  createdAt: number;
  stallTimer: ReturnType<typeof setTimeout> | null;
  readonly meta: ImportChunkMeta;
  /** Latest component selection — refreshed per chunk so toggles made
   *  mid-upload land in the payload handed to the import executor. */
  components?: readonly DictionaryComponent[];
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

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
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
    throw new Error(t('jobs.interrupted.reimport'));
  }
  const result = await importFile(payload.file, {
    langCode: payload.langCode,
    components: payload.components,
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
    await whenJobsReady();
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
        params: { resourceId, langCode, signature: resource?.signature },
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
      await reorderResources(parsed.data.langCode, parsed.data.orderedIds);
      clearDictionaryProbeCache();
      broadcastDictionaryChanged(ctx, parsed.data.langCode, 'resource-reorder');
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
      broadcastDictionaryChanged(ctx, parsed.data.langCode, 'resource-enabled');
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
      clearDictionaryProbeCache();
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
      clearDictionaryProbeCache();
      broadcastDictionaryChanged(ctx, parsed.data.langCode, 'resource-components');
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
      if (!resource) return toError(new Error(t('resources.error.notFound')));
      if (resource.installationFinished === false) return ok({ components: resource.components ?? [] });
      if (resource.components && resource.components.length > 0) return ok({ components: resource.components });
      const set = new Set<DictionaryComponent>();
      for (const entry of await findDictionaryByResource(langCode, resourceId)) {
        collectEntryComponents(set, entry);
      }
      if ((await findFrequencyByResource(langCode, resourceId)).length > 0) {
        set.add('frequency');
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
    const { langCode, resourceId, limit } = parsed.data;
    try {
      const dict = await sampleDictionaryEntries(langCode, resourceId, limit);
      const entries = dict.length > 0 ? dict : await sampleFrequencyEntries(langCode, resourceId, limit);
      return ok({ entries });
    } catch (err) {
      return toError(err);
    }
  });

  ctx.on(MESSAGE_TYPES.RESOURCE_FIND, async (request): Promise<MessageResponse> => {
    const parsed = ResourceFindPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_FIND', parsed);
    const { langCode, resourceId, term } = parsed.data;
    try {
      const entry =
        (await findDictionaryEntry(langCode, resourceId, term)) ??
        (await findFrequencyEntry(langCode, resourceId, term));
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
    await whenJobsReady();
    const parsed = ResourceImportChunkPayloadSchema.safeParse(request.payload);
    if (!parsed.success) return fail('RESOURCE_IMPORT_CHUNK', parsed);
    const p = parsed.data;

    let pending = pendingImports.get(p.jobId);
    if (!pending) {
      const existing = registry.get(p.jobId);
      if (existing) {
        return toError(new Error(t('resources.error.uploadRejected')));
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
            fileName: p.fileName,
            duplicateDecision: p.duplicateDecision ?? null,
          },
          retryable: false,
        });
      } catch (err) {
        if (err instanceof JobDuplicateError) {
          return toError(new Error(t('resources.error.importInProgress')));
        }
        return toError(err);
      }
      pending = {
        chunks: new Array<Uint8Array>(p.total),
        received: 0,
        createdAt: Date.now(),
        stallTimer: null,
        meta: {
          fileName: p.fileName,
          fileMime: p.fileMime,
          langCode: p.langCode,
          duplicateDecision: p.duplicateDecision,
        },
        components: p.components,
      };
      pendingImports.set(p.jobId, pending);
    } else {
      pending.components = p.components;
    }

    if (p.seq < 0 || p.seq >= pending.chunks.length) {
      return toError(new Error(t('resources.error.uploadRejected')));
    }
    if (pending.chunks[p.seq] === undefined) {
      pending.chunks[p.seq] = decodeBase64ToBytes(p.data);
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
    const components = pending.components;
    clearPending(p.jobId);
    try {
      const bytes = concatChunks(pending.chunks);
      importPayloads.set(p.jobId, {
        file: new File([bytes as BlobPart], meta.fileName, { type: meta.fileMime }),
        ...meta,
        components,
      });
      const job = registry.update(p.jobId, { status: 'queued' }, { persistNow: true });
      if (job) registry.startIfSlotFree(job);
      return ok({ jobId: p.jobId });
    } catch (err) {
      return toError(err);
    }
  });
}
