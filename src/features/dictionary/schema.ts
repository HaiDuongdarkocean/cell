// Payload schemas for dictionary-resource messages (content/popup → background).
// Resource data lives in the extension-origin IndexedDB — all reads/writes are
// proxied to the background service worker.

import { z } from 'zod';

const LangCode = z.string().min(1);
const ResourceId = z.number().int();
const ResourceKind = z.enum(['DICTIONARY', 'FREQUENCY']);

export const ResourceListPayloadSchema = z.object({
  langCode: LangCode,
});

export const ResourceDeletePayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
});

export const ResourceReorderPayloadSchema = z.object({
  langCode: LangCode,
  resourceType: ResourceKind,
  orderedIds: z.array(ResourceId),
});

export const ResourceSetEnabledPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  enabled: z.boolean(),
});

export const ResourceSetProfilesPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  profileIds: z.array(z.string()),
});

export const ResourceSamplePayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  resourceType: ResourceKind,
  limit: z.number().int().positive(),
});

export const ResourceFindPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  resourceType: ResourceKind,
  term: z.string(),
});

/** One file transferred as base64 chunks; the LAST chunk triggers importFile. */
export const ResourceImportChunkPayloadSchema = z.object({
  jobId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  data: z.string(), // base64 slice
  fileName: z.string().min(1),
  fileMime: z.string(),
  resourceType: ResourceKind,
  langCode: LangCode,
  /** Pre-resolved by the caller after its own signature check. */
  duplicateDecision: z.enum(['skip', 'replace']).optional(),
  /** Injected by the message bus for content-script senders. */
  tabId: z.number().int().optional(),
});
