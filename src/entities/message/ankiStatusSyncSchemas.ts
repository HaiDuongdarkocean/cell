import { z } from 'zod';

export const AnkiStatusSyncRunPayloadSchema = z.object({
  tabId: z.number().optional(),
});

export const AnkiStatusCardTermsPayloadSchema = z.object({
  langCode: z.string().length(2),
});

export const AnkiStatusSrsReviewedPayloadSchema = z.object({
  noteId: z.string().min(1),
  cardId: z.string().min(1),
});

export const AnkiStatusSrsCardDeletedPayloadSchema = z.object({
  deckId: z.string().min(1),
  targetWord: z.string().min(1),
});

export const AnkiStatusSyncStateViewSchema = z.object({
  lastSyncAt: z.number().nullable(),
  lastTrigger: z.string().nullable(),
  cardsSeen: z.number(),
  changed: z.number(),
  errors: z.number(),
  consecutiveFailures: z.number(),
  addonOnline: z.boolean().nullable(),
  writeBackUnsupportedNotified: z.boolean(),
});

export type AnkiStatusSyncStateView = z.infer<typeof AnkiStatusSyncStateViewSchema>;
