import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { JobEventPayloadSchema } from '@/entities/message/jobSchemas';
import { isTerminalJob, type Job, type JobKind } from '@/entities/job/types';
import type { MessageResponse } from '@/entities/message';

export async function listJobs(kind?: JobKind): Promise<Job[]> {
  const res = await sendMessage<MessageResponse<{ jobs: Job[] }>>({
    type: MESSAGE_TYPES.JOB_LIST,
    payload: kind !== undefined ? { kind } : {},
  });
  if (res === undefined || !res.success) return [];
  return res.data?.jobs ?? [];
}

export async function dismissJob(jobId: string): Promise<boolean> {
  const res = await sendMessage<MessageResponse<boolean>>({
    type: MESSAGE_TYPES.JOB_DISMISS,
    payload: { jobId },
  });
  return res?.success === true && res.data === true;
}

export async function retryJob(jobId: string): Promise<Job | null> {
  const res = await sendMessage<MessageResponse<{ job: Job }>>({
    type: MESSAGE_TYPES.JOB_ACTION,
    payload: { jobId, action: 'retry' },
  });
  if (res === undefined || !res.success) return null;
  return res.data?.job ?? null;
}

export interface JobEvent {
  readonly job?: Job;
  readonly removedId?: string;
}

export type JobEventListener = (event: JobEvent) => void;

export function subscribeJobEvents(listener: JobEventListener): () => void {
  const handler = (message: unknown): boolean => {
    const msg = message as { type?: string; payload?: unknown };
    if (msg.type !== MESSAGE_TYPES.JOB_EVENT) return false;
    const parsed = JobEventPayloadSchema.safeParse(msg.payload);
    if (!parsed.success) return false;
    listener({ job: parsed.data.job as Job | undefined, removedId: parsed.data.removedId });
    return false;
  };
  onMessage(handler);
  return () => removeOnMessageListener(handler);
}

export function waitForJobTerminal(jobId: string, timeoutMs = 15 * 60 * 1000): Promise<Job | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (job: Job | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(job);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const unsub = subscribeJobEvents(({ job, removedId }) => {
      if (removedId === jobId) finish(null);
      else if (job?.id === jobId && isTerminalJob(job)) finish(job);
    });
    void listJobs().then((jobs) => {
      const job = jobs.find((j) => j.id === jobId);
      if (job && isTerminalJob(job)) finish(job);
    });
  });
}
