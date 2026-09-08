// Background message payload Zod boundary schemas.
//
// Validate at trust boundaries: content-script/background MV3 message payloads.
// Internal code trusts the types after validation.

import { z } from 'zod';
import type { Settings } from '@/entities/media';
import { SrsFieldValueSchema } from '@/entities/srs/schemas';

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
  settings: z.custom<Partial<Settings>>((val) => typeof val === 'object' && val !== null && !Array.isArray(val)),
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
  frameId: z.number().int().optional(),
  videoUrls: z.array(z.string()),
  subtitleUrls: z.array(z.string()),
  trackSubtitles: z
    .array(
      z.object({
        url: z.string().min(1),
        label: z.string(),
        language: z.string(),
        isDefault: z.boolean(),
      }),
    )
    .optional(),
  pageUrl: z.string().min(1),
});

export const DetectedSubtitleUrlPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  url: z.string().min(1),
});

// === Subtitle payloads ===

export const UpdateSubtitleLanguagePayloadSchema = z.object({
  subtitleId: z.string().min(1),
  language: z.string().min(1),
});

export const RequestAutoLoadSubtitlesPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  frameId: z.number().int().optional(),
});

export const FetchSubtitleContentPayloadSchema = z.object({
  url: z.string().min(1),
  tabUrl: z.string().optional(),
  initiator: z.string().optional(),
});

export const SubtitleCuesLoadedPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  cues: z.array(z.unknown()),
});

export const RequestSubtitleCuesPayloadSchema = z.object({
  tabId: z.number().int().optional(),
});

// === Download / conversion payloads ===

export const GetDownloadProgressPayloadSchema = z.object({
  tabId: z.number().int().optional(),
}).optional();

export const ConversionPhaseSchema = z.enum([
  'planning',
  'transmuxing',
  'merging',
  'validating',
  'done',
]);

export const ConversionProgressUpdatePayloadSchema = z.object({
  downloadId: z.string().min(1),
  percent: z.number().min(0).max(100),
  phase: ConversionPhaseSchema,
  fileSize: z.number().int().min(0),
  processedBytes: z.number().int().min(0),
  workerCount: z.number().int().min(0),
  usedWorkers: z.boolean(),
});

// === Side panel payloads ===

export const TogglePlayPayloadSchema = z.object({
  tabId: z.number().int().optional(),
});

export const OpenSidePanelPayloadSchema = z.object({
  tabId: z.number().int().optional(),
});

export const CloseSidePanelPayloadSchema = z.object({
  tabId: z.number().int().optional(),
});

export const VideoTimeUpdatePayloadSchema = z.object({
  tabId: z.number().int().optional(),
  currentTimeMs: z.number().int(),
  durationMs: z.number().int(),
  offsetMs: z.number().int().optional(),
});

export const VideoPlayStatePayloadSchema = z.object({
  tabId: z.number().int().optional(),
  isPlaying: z.boolean(),
});

export const SeekToPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  timeMs: z.number().int(),
});

export const ShortcutActionPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  action: z.enum(['prev-cue', 'next-cue', 'replay-cue', 'toggle-overlay', 'play-pause']),
});

export const VideoEpisodeChangedPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  pageUrl: z.string().optional(),
});

// === Detection dispatch payloads ===

export const DetectedSubtitlesPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  tracks: z.array(z.unknown()),
  source: z.enum(['youtube', 'iqiyi', 'netflix']).optional(),
  videoId: z.string().optional(),
  tvid: z.string().optional(),
  origin: z.string().optional(),
  movieId: z.union([z.string(), z.number().int()]).optional(),
});

// === Subtitle Search payloads (spec subtitle-search.md) ===

export const SearchSubtitlesPayloadSchema = z.object({
  query: z.string().min(1),
  languages: z.array(z.string()),
  season: z.number().int().min(0).optional(),
  episode: z.number().int().min(0).optional(),
});

export const ResolveSubtitleDownloadPayloadSchema = z.object({
  result: z.record(z.string(), z.unknown()),
  role: z.enum(['target', 'native']),
});

export const GetKeyQuotaPayloadSchema = z.object({
  provider: z.enum(['subdl', 'opensubtitles']).optional(),
}).optional();

export const OpenReaderPayloadSchema = z.object({
  bookId: z.string().optional(),
}).optional();

// === Ocean SRS payloads (spec ocean-language-acquisition-srs.md) ===

export const SrsAddNotePayloadSchema = z.object({
  targetLanguage: z.string().min(1),
  collectionId: z.string().optional(),
  deckId: z.string().optional(),
  targetWord: z.string().min(1),
  notetypeId: z.string().optional(),
  fields: z.record(z.string(), SrsFieldValueSchema),
});

export const SrsOpenStudyPagePayloadSchema = z.object({
  deckId: z.string().optional(),
});

export const SrsGetDecksNotetypesPayloadSchema = z.object({
  collectionId: z.string().min(1),
});
