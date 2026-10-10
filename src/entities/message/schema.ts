// Background message payload Zod boundary schemas.
//
// Validate at trust boundaries: content-script/background MV3 message payloads.
// Internal code trusts the types after validation.

import { z } from 'zod';
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

export const EmptyPayloadSchema = z.object({}).passthrough().optional();

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

export const bilingualCueSchema = z.object({
  index: z.number(),
  start: z.number(),
  end: z.number(),
  targetText: z.string(),
  nativeText: z.string(),
  rawTargetText: z.string().optional(),
});

export const SubtitleCuesLoadedPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  cues: z.array(bilingualCueSchema),
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
  currentTimeMs: z.number(),
  durationMs: z.number(),
  offsetMs: z.number().optional(),
  isPlaying: z.boolean().optional(),
});

export const VideoPlayStatePayloadSchema = z.object({
  tabId: z.number().int().optional(),
  isPlaying: z.boolean(),
});

export const SeekToPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  timeMs: z.number().int(),
  cueSeq: z.number().int().optional(),
});

export const SetPlaybackRatePayloadSchema = z.object({
  tabId: z.number().int().optional(),
  rate: z.union([z.literal(0.5), z.literal(0.75), z.literal(1), z.literal(1.25), z.literal(1.5)]),
});

export const ShortcutActionPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  action: z.enum(['prev-cue', 'next-cue', 'replay-cue', 'toggle-overlay', 'play-pause']),
  seekTime: z.number().optional(),
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

export const subtitleDownloadKindSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('direct'), url: z.string() }),
  z.object({ kind: z.literal('handshake'), fileId: z.number() }),
]);

export const subtitleSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerLanguage: z.string(),
  isoLanguage: z.string(),
  format: z.enum(['srt', 'vtt', 'ass']),
  download: subtitleDownloadKindSchema,
  source: z.enum(['subdl', 'opensubtitles']),
  rating: z.number().optional(),
  downloads: z.number().optional(),
  sdh: z.boolean().optional(),
  forced: z.boolean().optional(),
  isArchive: z.boolean().optional(),
});

export const ResolveSubtitleDownloadPayloadSchema = z.object({
  result: subtitleSearchResultSchema,
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
  tags: z.array(z.string()).optional(),
});

export const SrsOpenStudyPagePayloadSchema = z.object({
  deckId: z.string().optional(),
  view: z.string().optional(),
  term: z.string().optional(),
});

export const SrsTermCardsPayloadSchema = z.object({
  langCode: z.string().min(1),
  term: z.string().min(1),
});

export const SrsCardsTermsPayloadSchema = z.object({
  langCode: z.string().min(1),
});

export const SrsCardsChangedPayloadSchema = z.object({
  langCode: z.string().min(1),
});

export const SrsGetDecksNotetypesPayloadSchema = z.object({
  collectionId: z.string().min(1).optional(),
});

// === Local Player payloads (spec: local-video-player.md) ===

export const OpenLocalPlayerPayloadSchema = z.object({
  videoId: z.string().min(1).optional(),
}).optional();

export const SaveResumePositionPayloadSchema = z.object({
  videoId: z.string().min(1),
  timeMs: z.number().min(0),
  durationMs: z.number().min(0),
});

export const GetResumePositionPayloadSchema = z.object({
  videoId: z.string().min(1),
});

export const GetHistoryPayloadSchema = z.object({
  limit: z.number().int().min(1).optional(),
}).optional();

export const GetSessionRecapPayloadSchema = z.object({}).optional();

export const SaveHistoryPayloadSchema = z.object({
  videoId: z.string().min(1),
  watchedAt: z.number(),
  durationWatchedMs: z.number().min(0),
});

export const GetLibraryPayloadSchema = z.object({
  sortBy: z.enum(['recent', 'title', 'added']).optional(),
}).optional();

export const LocalPlayerVideoOpenedPayloadSchema = z.object({
  videoId: z.string().min(1),
  filename: z.string().min(1),
  title: z.string().min(1),
  durationMs: z.number().min(0),
});

// === OCR payloads (spec: orca-ocr-layer.md) ===

export const OcrInitPayloadSchema = z.object({
  languageMode: z.string().min(1),
  backend: z.enum(['webgpu', 'wasm']),
  engineKey: z.string().min(1).optional(),
});

export const OcrRecognizePayloadSchema = z.object({
  image: z.object({
    data: z.union([z.string().min(1), z.array(z.number()).min(1)]),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }),
  minScore: z.number().min(0).max(1).optional(),
  engineKey: z.string().min(1).optional(),
});

export const OcrDisposePayloadSchema = z.object({
  engineKey: z.string().min(1).optional(),
}).optional();

export const OcrRegionCommandPayloadSchema = z.object({
  mode: z.enum(['view', 'select', 'edit', 'reset']),
});

// === User-data sync payloads (spec user-data-sync) ===

export const SyncConnectPayloadSchema = z.object({
  providerId: z.string().min(1),
});

export const SyncDisconnectPayloadSchema = z.object({
  connectionId: z.string().min(1),
});

export const SyncSetSystemConnectionPayloadSchema = z.object({
  connectionId: z.string().min(1),
});

export const SyncSetBindingPayloadSchema = z.object({
  scope: z.string().min(1),
  destination: z.string().min(1),
});

export const SyncCancelRebindPayloadSchema = z.object({
  scope: z.string().min(1),
});

export const SyncDeleteOldCopyPayloadSchema = z.object({
  scope: z.string().min(1),
  connectionId: z.string().min(1),
});

export const SyncEngineStatusSchema = z.object({
  state: z.enum([
    'idle',
    'running',
    'backoff',
    'needs-reauth',
    'offline',
    'storage-full',
  ]),
  retryAt: z.number().optional(),
  lastError: z.string().optional(),
  updatedAt: z.number(),
});

export const SyncConnectionStatusSchema = z.object({
  connectionId: z.string().min(1),
  providerId: z.string().min(1),
  displayName: z.string(),
  isSystem: z.boolean(),
  disconnectPending: z.boolean(),
  state: z.enum([
    'connected',
    'backoff',
    'needs-reauth',
    'offline',
    'storage-full',
    'disconnect-pending',
  ]),
  retryAt: z.number().optional(),
  hasToken: z.boolean(),
});

export const SyncBindingStatusSchema = z.object({
  target: z.string(),
  scope: z.string().min(1),
  destination: z.string().min(1),
  frozen: z.boolean(),
  waiting: z.boolean(),
  waitingFor: z.string().nullable(),
  vacatedFrom: z.string().nullable(),
});

export const SyncDataAppliedPayloadSchema = z.object({
  dataClasses: z.array(z.string().min(1)),
  scopes: z.array(z.string().min(1)),
});

export type SyncDataAppliedPayload = z.infer<typeof SyncDataAppliedPayloadSchema>;

export const SyncStatusViewSchema = z.object({
  engine: SyncEngineStatusSchema,
  directory: z.object({
    connections: z.array(SyncConnectionStatusSchema),
    bindings: z.array(SyncBindingStatusSchema),
    systemConnection: z.string().nullable(),
    lastAppliedAt: z.number().nullable(),
  }),
});

// === Detection / media-update broadcasts ===

export const VideoVariantSchema = z.object({
  url: z.string().min(1),
  quality: VideoQualitySchema,
  resolution: z.string().optional(),
  bandwidth: z.number().optional(),
  playlistUrl: z.string().optional(),
  size: z.number().optional(),
});

export const VideoFormatSchema = z.enum(['m3u8', 'mp4', 'ts', 'webm', 'unknown']);

export const DetectedVideoSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  format: VideoFormatSchema,
  title: z.string(),
  tabId: z.number().int(),
  tabUrl: z.string(),
  detectedAt: z.number(),
  variants: z.array(VideoVariantSchema),
  selectedVariantId: z.string().optional(),
});

export const SubtitleFormatSchema = z.enum(['srt', 'vtt', 'ass', 'ssa', 'ttml', 'unknown']);

export const DetectedSubtitleSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  format: SubtitleFormatSchema,
  language: z.string(),
  tabId: z.number().int(),
  detectedAt: z.number(),
  videoId: z.string().optional(),
  size: z.number().optional(),
  isAsr: z.boolean().optional(),
  displayName: z.string().optional(),
  initiator: z.string().optional(),
  frameId: z.number().int().optional(),
});

export const DetectedMediaUpdatePayloadSchema = z.object({
  videos: z.array(DetectedVideoSchema),
  subtitles: z.array(DetectedSubtitleSchema),
  tabId: z.number().int(),
});

// === Download progress broadcast ===

export const DownloadStatusSchema = z.enum([
  'queued',
  'downloading',
  'converting',
  'done',
  'error',
  'cancelled',
  'paused',
]);

export const DownloadProgressSchema = z.object({
  itemId: z.string(),
  status: DownloadStatusSchema,
  progress: z.number(),
  currentSegment: z.number().optional(),
  totalSegments: z.number().optional(),
  error: z.string().optional(),
  fileSize: z.number().optional(),
  downloadedBytes: z.number().optional(),
  processedBytes: z.number().optional(),
  conversionPhase: ConversionPhaseSchema.optional(),
  workerCount: z.number().optional(),
  usedWorkers: z.boolean().optional(),
  downloadProgress: z.number().optional(),
  convertProgress: z.number().optional(),
});

export const DownloadProgressUpdatePayloadSchema = z.object({
  progress: DownloadProgressSchema,
  tabId: z.number().int(),
});

// === Offscreen document messages ===

export const ParallelConversionModeSchema = z.enum(['auto', 'manual', 'off']);

export const ParallelFallbackModeSchema = z.enum([
  'sequential',
  'retry-reduced',
  'save-ts',
  'fail',
]);

export const ConvertTsToMp4V2PayloadSchema = z.object({
  downloadId: z.string().min(1),
  parallelConversion: ParallelConversionModeSchema.optional(),
  manualWorkerCount: z.number().int().min(1).optional(),
  parallelFallback: ParallelFallbackModeSchema.optional(),
});

export const CreateOpfsBlobUrlPayloadSchema = z.object({
  downloadId: z.string().min(1),
  opfsFilename: z.string().min(1),
  mimeType: z.string().min(1),
});

export const RevokeOpfsBlobUrlPayloadSchema = z.object({
  url: z.string().min(1),
});

export const FetchRequestPayloadSchema = z.object({
  url: z.string().min(1),
  options: z
    .object({
      method: z.string().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      credentials: z.enum(['omit', 'same-origin', 'include']).optional(),
      responseType: z.enum(['text', 'arraybuffer']).optional(),
    })
    .optional(),
});

// === Auto-load / page-context subtitle pushes ===

export const SubtitleForOverlayResultSchema = z.object({
  url: z.string().min(1),
  language: z.string(),
  format: z.string(),
  isAsr: z.boolean().optional(),
  displayName: z.string().optional(),
  initiator: z.string().optional(),
});

export const AutoLoadSubtitlesPayloadSchema = z.object({
  tabId: z.number().int(),
  target: SubtitleForOverlayResultSchema.nullable(),
  native: SubtitleForOverlayResultSchema.nullable(),
  pageUrl: z.string().optional(),
  targetMatches: z.array(SubtitleForOverlayResultSchema).optional(),
  nativeMatches: z.array(SubtitleForOverlayResultSchema).optional(),
});

export const FetchSubtitlePageContextPayloadSchema = z.object({
  url: z.string().min(1),
});

// === Study mode payloads ===

export const StudyStepSchema = z.object({
  subtitle: z.enum(['none', 'native', 'target', 'both', 'adaptive']),
  pause: z.enum(['none', 'start', 'end']),
  repeat: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  speed: z.number(),
  after: z.enum(['continue', 'wait', 'loop']),
  seek: z.boolean().optional(),
  skip: z.enum(['non-i1']).optional(),
});

export const StudyModeSchema = z.object({
  id: z.string(),
  type: z.enum(['preset', 'custom']),
  icon: z.string(),
  title: z.string(),
  description: z.string(),
  titleKey: z.string().optional(),
  descriptionKey: z.string().optional(),
  steps: z.array(StudyStepSchema),
});

export const SubtitleCleanupRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  nameKey: z.string().optional(),
  descriptionKey: z.string().optional(),
  pattern: z.string(),
  replacement: z.string().optional(),
  enabled: z.boolean(),
  builtin: z.boolean(),
  repeatUntilStable: z.boolean().optional(),
});

export const CleanupRulesSettingSchema = z.object({
  builtinEnabled: z.record(z.string(), z.boolean()),
  custom: z.array(SubtitleCleanupRuleSchema),
});

export const StudyModeAdvancedSettingsSchema = z.object({
  skipNoDialogue: z.enum(['OFF', '2X', '4X', '6X', '8X', 'JUMP']),
  removeBracketed: z.boolean(),
  pauseOnUnknown: z.enum(['OFF', 'START', 'END']),
  unknownLevel: z.enum(['core', 'common', 'general', 'advanced']),
  popupOnAutoPause: z.boolean(),
  popupCloseOnResume: z.boolean(),
  cleanupRules: CleanupRulesSettingSchema.optional(),
  cueLeadInMs: z.number().optional(),
});

export const ApplyStudyModePayloadSchema = z.object({
  activeMode: StudyModeSchema,
  advanced: StudyModeAdvancedSettingsSchema,
});
