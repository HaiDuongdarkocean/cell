// Background message payload Zod boundary schemas.
//
// Validate at trust boundaries: content-script/background MV3 message payloads.
// Internal code trusts the types after validation.

import { z } from 'zod';

// === Reusable primitives ===

export const VideoQualitySchema = z.enum([
  'highest',
  '1080p',
  '720p',
  '480p',
  '360p',
  'lowest',
  'auto',
]);

// === Download payloads ===

export const DownloadVideoPayloadSchema = z.object({
  videoId: z.string().min(1),
  variantId: z.string().optional(),
  quality: VideoQualitySchema.optional(),
});

export const DownloadSubtitlePayloadSchema = z.object({
  subtitleId: z.string().min(1),
});

export const DownloadAllPayloadSchema = z.object({
  tabId: z.number().int().optional(),
});

export const CancelDownloadPayloadSchema = z.object({
  downloadId: z.string().min(1),
});

// === Settings payloads ===

export const UpdateSettingsPayloadSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
});

// === YouTube detection payloads ===

export const InnertubeFallbackPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  videoId: z.string().min(1),
  apiKey: z.string().min(1),
  visitorData: z.string().optional(),
});

// === Card Creator payloads ===

export const CardCreatorRequestPayloadSchema = z.object({
  url: z.string().min(1),
  action: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  timeoutMs: z.number().int().min(1).optional(),
});

// === Media detection payloads ===

export const GetDetectedMediaPayloadSchema = z.object({
  tabId: z.number().int().optional(),
}).optional();

export const PageScanResultPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  videoUrls: z.array(z.string()),
  subtitleUrls: z.array(z.string()),
  pageUrl: z.string().min(1),
});

export const DetectedSubtitleUrlPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  url: z.string().min(1),
});
