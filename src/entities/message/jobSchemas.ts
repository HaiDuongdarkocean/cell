import { z } from 'zod';

export const JobKindSchema = z.enum([
  'resource-import',
  'resource-delete',
  'voice-download',
  'local-audio-index',
]);

export const JobStatusSchema = z.enum([
  'queued',
  'uploading',
  'running',
  'done',
  'failed',
  'interrupted',
]);

export const JobProgressSchema = z.object({
  done: z.number(),
  total: z.number().optional(),
  unit: z.enum(['bytes', 'items']).optional(),
});

export const JobSchema = z.object({
  id: z.string().min(1),
  kind: JobKindSchema,
  label: z.string(),
  status: JobStatusSchema,
  progress: JobProgressSchema,
  params: z.record(z.string(), z.unknown()),
  retryable: z.boolean(),
  pendingEffect: z.boolean().optional(),
  resourceId: z.number().optional(),
  error: z.string().optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const JobListPayloadSchema = z.object({
  kind: JobKindSchema.optional(),
});

export const JobEventPayloadSchema = z.object({
  job: JobSchema.optional(),
  removedId: z.string().optional(),
});

export const JobDismissPayloadSchema = z.object({
  jobId: z.string().min(1),
});

export const JobActionPayloadSchema = z.object({
  jobId: z.string().min(1),
  action: z.literal('retry'),
});
