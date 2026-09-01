// Popup Dictionary Zod boundary schemas — spec §9.2, §9.4.
//
// Validate at trust boundaries: worker messages, MV3 message payloads, and
// storage edges. Internal code trusts the types after validation.

import { z } from 'zod';
import type { LookupRequest } from './types';

// === Reusable primitives ===

export const WordStatusSchema = z.enum(['unknown', 'known', 'tracking', 'ignore']);
export const ReadingKindSchema = z.enum(['ipa', 'pinyin', 'none']);
export const MatchSourceSchema = z.enum(['dictionary', 'plugin', 'fallback']);
export const AudioKindSchema = z.enum(['word', 'sentence']);
export const AudioSourceKindSchema = z.enum(['community', 'system-tts', 'cloud-tts', 'local', 'espeak']);
export const AudioStateSchema = z.enum([
  'idle',
  'loading',
  'playing',
  'paused',
  'unavailable',
  'error',
]);

// === LookupRequest (spec §9.2) ===

export const LookupRequestSchema = z.object({
  term: z.string().min(1).max(200),
  langCode: z.string().length(2),
  contextSentence: z.string().max(2000),
  cursorOffset: z.number().int().min(0),
  fallback: z.boolean().optional(),
});

// === DefinitionEntry / AudioItem / ImageItem ===

export const DefinitionEntrySchema = z.object({
  id: z.string(),
  pos: z.string().optional(),
  text: z.string(),
  examples: z.array(z.string()),
  source: z.string(),
  defaultSelected: z.boolean(),
});

export const AudioItemSchema = z.object({
  id: z.string(),
  kind: AudioKindSchema,
  source: AudioSourceKindSchema,
  label: z.string(),
  accentId: z.string().optional(),
  state: AudioStateSchema,
  url: z.string().optional(),
  audioBytes: z.instanceof(Uint8Array).optional(),
  defaultSelected: z.boolean(),
});

export const ImageItemSchema = z.object({
  id: z.string(),
  alt: z.string(),
  src: z.string(),
  defaultSelected: z.boolean(),
});

// === PhraseMatch (ADR-037 — embedded in LookupResult.detectedPhrase) ===

export const PhraseMatchSchema = z.object({
  dictionaryTerm: z.string(),
  surface: z.string(),
  span: z.object({
    start: z.number().int().min(0),
    end: z.number().int().min(0),
  }),
  quality: z.enum(['fixed', 'inflected', 'possessive-template', 'slot-template']),
  sourceResourceId: z.number().int().nonnegative(),
});

// === LookupResult (spec §9.2) ===

export const LookupResultSchema = z.object({
  term: z.string(),
  langCode: z.string().length(2),
  reading: z.string(),
  readingKind: ReadingKindSchema,
  frequency: z
    .object({ rank: z.number().int(), source: z.string() })
    .nullable(),
  status: WordStatusSchema,
  partsOfSpeech: z.array(z.string()),
  definitions: z.array(DefinitionEntrySchema),
  rawDefinitions: z.array(z.string()),
  detectedPhrase: PhraseMatchSchema.nullable(),
  matchSource: MatchSourceSchema,
});

// === QuickAddPayload (spec §9.2) ===

export const QuickAddPayloadSchema = z.object({
  term: z.string(),
  langCode: z.string().length(2),
  definitions: z.array(DefinitionEntrySchema),
  audios: z.array(AudioItemSchema),
  images: z.array(ImageItemSchema),
  translation: z.string(),
  sentence: z.string(),
  status: WordStatusSchema,
  destination: z.enum(['anki']),
});

// === Worker envelope (spec §9.4 A) ===

export const WorkerMessageBaseSchema = z.object({
  type: z.enum([
    'WORKER_READY',
    'HYDRATE_CHUNK',
    'HYDRATE_DONE',
    'PUSH_DEFINITION',
    'LOOKUP',
    'LOOKUP_CANCEL',
    'LOOKUP_RESULT',
  ]),
  requestId: z.string().min(1),
});

export const WorkerLookupMessageSchema = WorkerMessageBaseSchema.extend({
  type: z.literal('LOOKUP'),
  payload: LookupRequestSchema,
});

export const WorkerCancelMessageSchema = WorkerMessageBaseSchema.extend({
  type: z.literal('LOOKUP_CANCEL'),
});

export const WorkerReadyMessageSchema = WorkerMessageBaseSchema.extend({
  type: z.literal('WORKER_READY'),
});

export const WorkerHydrateChunkMessageSchema = WorkerMessageBaseSchema.extend({
  type: z.literal('HYDRATE_CHUNK'),
  resourceId: z.number().int().nonnegative(),
  payload: z.instanceof(ArrayBuffer),
});

export const WorkerHydrateDoneMessageSchema = WorkerMessageBaseSchema.extend({
  type: z.literal('HYDRATE_DONE'),
});

export const WorkerPushDefinitionMessageSchema = WorkerMessageBaseSchema.extend({
  type: z.literal('PUSH_DEFINITION'),
  term: z.string().min(1).max(200),
  entries: z.array(z.object({}).passthrough()),
});

export const WorkerLookupResultMessageSchema = z.object({
  type: z.literal('LOOKUP_RESULT'),
  requestId: z.string().min(1),
  ok: z.boolean(),
  result: LookupResultSchema.optional(),
  error: z.string().optional(),
});

// === Word status (spec §9.4 B — WORD_STATUS_GET / WORD_STATUSES_GET / WORD_STATUS_SET payloads) ===

export const WordStatusGetPayloadSchema = z.object({
  tabId: z.number().int(),
  term: z.string().min(1).max(200),
  langCode: z.string().length(2),
});

export const WordStatusesGetPayloadSchema = z.object({
  tabId: z.number().int(),
  langCode: z.string().length(2),
  terms: z.array(z.string().min(1).max(200)).min(1).max(1000),
});

export const WordStatusSetPayloadSchema = WordStatusGetPayloadSchema.extend({
  status: WordStatusSchema,
});

// === Frequency lookup (spec §9.4 B — FREQUENCY_GET) ===

export const FrequencyEntrySchema = z.object({
  id: z.number().int().optional(),
  resourceId: z.number().int(),
  term: z.string().min(1).max(200),
  reading: z.string().max(200),
  frequency: z.number(),
});

export const FrequencyGetPayloadSchema = z.object({
  tabId: z.number().int(),
  langCode: z.string().length(2),
  terms: z.array(z.string().min(1).max(200)).min(1).max(1000),
});

// === Audio fetch (spec §9.4 B — FETCH_COMMUNITY_AUDIO) ===

export const FetchCommunityAudioPayloadSchema = z.object({
  tabId: z.number().int(),
  term: z.string().min(1).max(200),
  langCode: z.string().length(2),
  kind: AudioKindSchema,
});

export const FetchCommunityAudioResponseSchema = z.object({
  items: z.array(AudioItemSchema),
});

// === Local audio fetch (FETCH_LOCAL_AUDIO) ===

export const FetchLocalAudioPayloadSchema = z.object({
  tabId: z.number().int(),
  term: z.string().min(1).max(200),
  langCode: z.string().length(2),
  kind: AudioKindSchema,
});

export const FetchLocalAudioResponseSchema = z.object({
  items: z.array(AudioItemSchema),
});

// === TTS audio fetch (TTS_FETCH_AUDIO) — returns a data URL for the spoken text ===

export const TtsFetchAudioPayloadSchema = z.object({
  tabId: z.number().int(),
  text: z.string().min(1).max(2000),
  langCode: z.string().length(2),
});

export const TtsFetchAudioResponseSchema = z.object({
  url: z.string().min(1),
});

// === eSpeak offscreen TTS (PRONUNCIATION_ESPEAK_TTS) — returns WAV bytes ===

export const PronunciationEspeakTtsPayloadSchema = z.object({
  text: z.string().min(1).max(2000),
  langCode: z.string().length(2),
});

export const PronunciationEspeakTtsResponseSchema = z.object({
  audioBytes: z.instanceof(Uint8Array),
});

// === Media URL fetch (FETCH_MEDIA_URL) — fetch external URL via background (CSP bypass) ===

export const FetchMediaUrlPayloadSchema = z.object({
  tabId: z.number().int(),
  url: z.string().url(),
  kind: z.enum(['image', 'audio']),
});

export const FetchMediaUrlResponseSchema = z.object({
  url: z.string(),
});

// === Image fetch (spec §9.4 B — FETCH_IMAGES) ===

export const FetchImagesPayloadSchema = z.object({
  tabId: z.number().int(),
  term: z.string().min(1).max(200),
  langCode: z.string().length(2),
  maxResults: z.number().int().min(1).max(20).optional(),
});

export const FetchImagesResponseSchema = z.object({
  items: z.array(ImageItemSchema),
});

// === TTS speak (spec §9.4 B — TTS_SPEAK) ===

export const TtsSpeakPayloadSchema = z.object({
  tabId: z.number().int(),
  text: z.string().min(1).max(2000),
  langCode: z.string().length(2),
  rate: z.number().min(0.1).max(10).optional(),
  pitch: z.number().min(0).max(2).optional(),
  voiceName: z.string().optional(),
});

export const TtsSpeakLocalPayloadSchema = z.object({
  text: z.string().min(1).max(2000),
  langCode: z.string().length(2),
  rate: z.number().min(0.1).max(10).optional(),
  pitch: z.number().min(0).max(2).optional(),
  voiceName: z.string().optional(),
});

export const TtsDownloadVoicePayloadSchema = z.object({
  language: z.string().length(2),
});

export const TtsDownloadProgressPayloadSchema = z.object({
  language: z.string().length(2),
  loaded: z.number().int().min(0),
  total: z.number().int().min(0),
});

// === TTS settings (spec popup-dictionary-4tab-logic) ===

// === Translate (spec §9.4 B — TRANSLATE, ADR-021 D2) ===

export const TranslatePayloadSchema = z.object({
  tabId: z.number().int(),
  text: z.string().min(1).max(2000),
  sl: z.string().optional(),
  tl: z.string().length(2),
});

// === Quick Add (spec §9.4 B — QUICK_ADD) ===

export const QuickAddPayloadMessageSchema = QuickAddPayloadSchema.extend({
  tabId: z.number().int(),
});

export const QuickAddResponseSchema = z.object({
  ok: z.boolean(),
  noteId: z.number().int().optional(),
  error: z.string().optional(),
  fieldErrors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

// === Lookup (MV3 message boundary) ===

export const LookupRequestPayloadSchema = z.object({
  requestId: z.string().min(1),
  request: z.custom<LookupRequest>((val) => typeof val === 'object' && val !== null && !Array.isArray(val)),
});

export const LookupCancelPayloadSchema = z.object({
  requestId: z.string().optional(),
});
