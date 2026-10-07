// Mining queue message boundary schemas — spec mining-queue.md.
//
// QUEUE_ADD carries a MiningQueueInput; id/dedupeKey/createdAt are assigned
// by the background store so normalization stays in one place.

import { z } from 'zod';

export const MiningQueueInputSchema = z.object({
  kind: z.enum(['term', 'sentence']),
  term: z.string().min(1).max(400).optional(),
  pos: z.string().max(60).optional(),
  langCode: z.string().min(2).max(12),
  sentence: z.string().max(4000),
  translation: z.string().max(4000).optional(),
  sourceLabel: z.string().max(300).optional(),
  videoId: z.string().max(300).optional(),
  cueIndex: z.number().int().min(0).optional(),
  cueStart: z.number().min(0).optional(),
  snapshot: z.object({}).passthrough().optional(),
});

export const QueueAddPayloadSchema = z.object({
  tabId: z.number().int(),
  item: MiningQueueInputSchema,
});

export const QueueListPayloadSchema = z.object({
  tabId: z.number().int(),
});

export const QueueGetPayloadSchema = z.object({
  tabId: z.number().int(),
  id: z.string().min(1).max(100),
});

export const QueueRemovePayloadSchema = QueueGetPayloadSchema;

export const QueueChangedPayloadSchema = z.object({
  tabId: z.number().int(),
});
