import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  JobActionPayloadSchema,
  JobDismissPayloadSchema,
  JobListPayloadSchema,
  JobSchema,
} from '@/entities/message/jobSchemas';
import {
  getSessionStorage,
  removeSessionStorage,
  setSessionStorage,
} from '@/shared/lib/chrome-apis/storage';
import {
  JobRegistry,
  type JobRegistryDeps,
} from '@/features/jobs/logic/jobRegistry';
import type { Job } from '@/entities/job/types';

const JOB_KEY_PREFIX = 'cellJob:';
const KEEP_ALIVE_INTERVAL_MS = 20_000;

let registry: JobRegistry | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

export function getJobRegistry(): JobRegistry {
  if (!registry) {
    throw new Error('Job registry not initialised — registerJobHandlers must run first');
  }
  return registry;
}

function jobStorageKey(id: string): string {
  return `${JOB_KEY_PREFIX}${id}`;
}

function pinKeepAlive(activeCount: number): void {
  if (activeCount > 0 && keepAliveTimer === null) {
    keepAliveTimer = setInterval(() => {
      void chrome.runtime.getPlatformInfo().catch(() => undefined);
    }, KEEP_ALIVE_INTERVAL_MS);
  } else if (activeCount === 0 && keepAliveTimer !== null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function persistedToJob(value: unknown): Job | null {
  const parsed = JobSchema.safeParse(value);
  if (!parsed.success) return null;
  const p = parsed.data;
  return {
    id: p.id,
    kind: p.kind,
    label: p.label,
    status: p.status,
    progress: { done: p.progress.done, total: p.progress.total ?? 0, unit: p.progress.unit },
    params: p.params,
    retryable: p.retryable,
    pendingEffect: p.pendingEffect,
    resourceId: p.resourceId,
    error: p.error,
    result: p.result as Job['result'],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function makeDeps(ctx: BackgroundContext): JobRegistryDeps {
  return {
    persist: async (job) => {
      await setSessionStorage({ [jobStorageKey(job.id)]: job });
    },
    unpersist: async (id) => {
      await removeSessionStorage(jobStorageKey(id));
    },
    loadPersisted: async () => {
      const all = await getSessionStorage<Record<string, unknown>>();
      const jobs: Job[] = [];
      for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(JOB_KEY_PREFIX)) continue;
        const job = persistedToJob(value);
        if (job) jobs.push(job);
      }
      return jobs;
    },
    broadcast: (job) => {
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES.JOB_EVENT, payload: { job } });
    },
    broadcastRemoved: (id) => {
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES.JOB_EVENT, payload: { removedId: id } });
    },
    onActiveCountChange: pinKeepAlive,
    now: () => Date.now(),
  };
}

function ensureRegistry(ctx: BackgroundContext): JobRegistry {
  if (!registry) {
    registry = new JobRegistry(makeDeps(ctx), {
      maxRunning: {
        'resource-import': 2,
        'resource-delete': 2,
        'voice-download': 1,
        'local-audio-index': 1,
      },
    });
  }
  return registry;
}

export async function initJobRegistry(): Promise<void> {
  if (!registry) return;
  await registry.restore();
  await registry.sweep();
}

export function registerJobHandlers(ctx: BackgroundContext): void {
  const r = ensureRegistry(ctx);

  ctx.on(MESSAGE_TYPES.JOB_LIST, async (request): Promise<MessageResponse<{ jobs: Job[] }>> => {
    const parsed = JobListPayloadSchema.safeParse(request.payload ?? {});
    if (!parsed.success) {
      return { success: false, error: `Invalid JOB_LIST payload: ${parsed.error.message}` };
    }
    return { success: true, data: { jobs: r.list(parsed.data.kind) } };
  });

  ctx.on(MESSAGE_TYPES.JOB_DISMISS, async (request): Promise<MessageResponse<boolean>> => {
    const parsed = JobDismissPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid JOB_DISMISS payload: ${parsed.error.message}` };
    }
    try {
      const removed = await r.dismiss(parsed.data.jobId);
      return { success: true, data: removed };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ctx.on(MESSAGE_TYPES.JOB_ACTION, async (request): Promise<MessageResponse<{ job: Job }>> => {
    const parsed = JobActionPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid JOB_ACTION payload: ${parsed.error.message}` };
    }
    try {
      const job = r.retry(parsed.data.jobId);
      return { success: true, data: { job } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
