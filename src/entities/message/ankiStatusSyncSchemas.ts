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

export const AnkiRunEntrySchema = z.object({
  at: z.number(),
  trigger: z.string(),
  cardsSeen: z.number(),
  changed: z.number(),
  errors: z.number(),
  writeBacksFlushed: z.number(),
  addonOnline: z.boolean(),
  langCode: z.string().nullable(),
});

export const WriteBackTaskSchema = z.object({
  cardId: z.number(),
  term: z.string(),
  langCode: z.string(),
  enqueuedAt: z.number(),
  attempts: z.number(),
});

export const WriteBackLogEntrySchema = z.object({
  cardId: z.number(),
  term: z.string(),
  ok: z.boolean(),
  reason: z.string(),
  at: z.number(),
});

export const AnkiStatusSyncViewSchema = z.object({
  lastSyncAt: z.number().nullable(),
  lastTrigger: z.string().nullable(),
  cardsSeen: z.number(),
  changed: z.number(),
  errors: z.number(),
  consecutiveFailures: z.number(),
  addonOnline: z.boolean().nullable(),
  addonCursor: z.number(),
  writeBackUnsupportedNotified: z.boolean(),
  history: z.array(AnkiRunEntrySchema),
  running: z.boolean(),
  linkedCards: z.number(),
  pendingWriteBacks: z.number(),
  writeBackQueue: z.array(WriteBackTaskSchema),
  writeBackLog: z.array(WriteBackLogEntrySchema),
});

export type AnkiStatusSyncViewWire = z.infer<typeof AnkiStatusSyncViewSchema>;
