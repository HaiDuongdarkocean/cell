// Payload schemas for dictionary-resource messages (content/popup → background).
// Resource data lives in the extension-origin IndexedDB — all reads/writes are
// proxied to the background service worker.

import { z } from 'zod';

const LangCode = z.string().min(1);
const ResourceId = z.number().int();
const ComponentName = z.enum([
  'definitions', 'examples', 'translations', 'synonyms', 'pronunciation',
  'inflections', 'etymology', 'wordFamily', 'wordNet', 'derivedTerms',
  'related', 'level', 'frequencyStars', 'frequency',
]);
const ComponentSubset = z.array(ComponentName).min(1).optional();

export const ResourceListPayloadSchema = z.object({
  langCode: LangCode,
});

export const ResourceDeletePayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  jobId: z.string().min(1).optional(),
  /** Injected by the message bus for content-script senders. */
  tabId: z.number().int().optional(),
});

export const ResourceReorderPayloadSchema = z.object({
  langCode: LangCode,
  orderedIds: z.array(ResourceId),
});

export const ResourceSetEnabledPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  enabled: z.boolean(),
});

export const ResourceRenamePayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  name: z.string().trim().min(1).max(200),
});

export const ResourceSetProfilesPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  profileIds: z.array(z.string()),
});

export const ResourceSetComponentsPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  disabledComponents: z.array(ComponentName),
});

export const ResourceComponentsPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
});

export const ResourceSamplePayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  limit: z.number().int().positive(),
});

export const ResourceFindPayloadSchema = z.object({
  langCode: LangCode,
  resourceId: ResourceId,
  term: z.string(),
});

/** One file transferred as base64 chunks; the LAST chunk triggers importFile. */
export const ResourceImportChunkPayloadSchema = z.object({
  jobId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  data: z.string(), // base64 slice
  /** Content encoding of the WHOLE assembled payload; absent = raw file bytes.
   *  'gzip' = sender compressed once, then chunked the compressed bytes — the
   *  receiver gunzips after assembly so importFile sees the original file. */
  encoding: z.enum(['gzip']).optional(),
  fileName: z.string().min(1),
  fileMime: z.string(),
  langCode: LangCode,
  /** Component subset the user picked on a multi-component file; absent = all detected. */
  components: ComponentSubset,
  /** Pre-resolved by the caller after its own signature check. */
  duplicateDecision: z.enum(['skip', 'replace']).optional(),
  /** Content signature computed by the caller — drives job dedup. */
  signature: z.string().optional(),
  /** Injected by the message bus for content-script senders. */
  tabId: z.number().int().optional(),
});

/** Direct File handoff — extension-origin senders carry the File themselves
 *  over BroadcastChannel('cell-import'), so begin only registers the job. */
export const ResourceImportBeginPayloadSchema = z.object({
  jobId: z.string().min(1),
  fileName: z.string().min(1),
  langCode: LangCode,
  /** Pre-resolved by the caller after its own signature check. */
  duplicateDecision: z.enum(['skip', 'replace']).optional(),
  /** Content signature computed by the caller — drives job dedup. */
  signature: z.string().optional(),
  /** Injected by the message bus for content-script senders. */
  tabId: z.number().int().optional(),
});
