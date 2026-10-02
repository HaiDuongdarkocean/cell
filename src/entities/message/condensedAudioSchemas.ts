import { z } from 'zod';

export const CueRangeSchema = z.object({
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});

export const CondensedAudioSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('library'), videoId: z.string().min(1) }),
  z.object({ kind: z.literal('opfs'), downloadId: z.string().min(1) }),
  z.object({ kind: z.literal('stream'), tabId: z.number().optional(), pageKey: z.string() }),
]);

export const CondensedAudioStatusSchema = z.enum([
  'processing',
  'recording',
  'finalizing',
  'ready',
  'failed',
  'missing',
]);

export const CondensedAudioExportStateSchema = z.enum(['none', 'done', 'failed']);

export const CondensedAudioErrorReasonSchema = z.enum([
  'no-cues',
  'no-source',
  'capture-blocked',
  'encode-failed',
  'export-failed',
  'drive-failed',
  'cancelled',
  'interrupted',
  'input-missing',
  'io-failed',
]);

export const CondensedAudioRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  source: CondensedAudioSourceSchema,
  leg: z.enum(['file', 'record']),
  durationMs: z.number().nonnegative(),
  sizeBytes: z.number().nonnegative(),
  mimeType: z.string(),
  opfsPath: z.string(),
  exportFilename: z.string().nullable(),
  exportState: CondensedAudioExportStateSchema,
  driveFileId: z.string().nullable(),
  driveSyncedAt: z.number().nullable(),
  status: CondensedAudioStatusSchema,
  error: CondensedAudioErrorReasonSchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CondenseAudioStartPayloadSchema = z.object({
  title: z.string().min(1),
  leg: z.enum(['file', 'record']),
  source: CondensedAudioSourceSchema,
  ranges: z.array(CueRangeSchema).min(1),
  durationMs: z.number().nonnegative(),
  tabId: z.number().int().optional(),
  frameId: z.number().int().optional(),
});

export const CondenseAudioIdPayloadSchema = z.object({
  id: z.string().min(1),
});

export const CondenseAudioSessionStartPayloadSchema = z.object({
  recordId: z.string().min(1),
  ranges: z.array(CueRangeSchema),
  padMs: z.number().nonnegative().optional(),
});

export const CondenseAudioSessionStopPayloadSchema = z.object({
  recordId: z.string().min(1),
  reason: z.enum(['user', 'ended', 'error']).optional(),
});

export const CondenseAudioChunkPayloadSchema = z.object({
  recordId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  dataBase64: z.string(),
  last: z.boolean().optional(),
  mimeType: z.string().optional(),
  elapsedMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

export const CondenseAudioEventPayloadSchema = z.object({
  record: CondensedAudioRecordSchema.optional(),
  removedId: z.string().optional(),
});

export const CondenseAudioRunPayloadSchema = z.object({
  recordId: z.string().min(1),
  mode: z.enum(['condense', 'transcode']),
  source: CondensedAudioSourceSchema.optional(),
  ranges: z.array(CueRangeSchema).optional(),
  padMs: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
});

export const CondenseAudioAbortPayloadSchema = z.object({
  recordId: z.string().min(1),
});

export const CondenseAudioProgressPayloadSchema = z.object({
  recordId: z.string().min(1),
  percent: z.number().min(0).max(100),
});

export const CondenseAudioReadPayloadSchema = z.object({
  id: z.string().min(1),
  offset: z.number().int().nonnegative(),
  length: z.number().int().positive(),
});
