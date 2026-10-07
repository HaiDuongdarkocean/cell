// Popup Dictionary Zod boundary schemas — spec §9.2, §9.4.
//
// Validate at trust boundaries: worker messages, MV3 message payloads, and
// storage edges. Internal code trusts the types after validation.

import { z } from 'zod';

// === Reusable primitives ===

export const WordStatusSchema = z.enum(['unknown', 'known', 'tracking', 'learning', 'ignore']);
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

export const SenseLineSchema = z.object({
  role: z.enum(['gloss', 'example', 'note']),
  text: z.string(),
  translation: z.string().optional(),
  citation: z.string().optional(),
  pattern: z.string().optional(),
});

export const RelationGroupSchema = z.object({
  label: z.string().optional(),
  words: z.array(z.string()),
});

export const SubsenseBlockSchema = z.object({
  num: z.string().optional(),
  text: z.string(),
  labels: z.array(z.string()).optional(),
  examples: z.array(SenseLineSchema).optional(),
  synonymGroups: z.array(RelationGroupSchema).optional(),
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
});

export const DefinitionEntrySchema = z.object({
  id: z.string(),
  pos: z.string().optional(),
  labels: z.array(z.string()).optional(),
  level: z.string().optional(),
  text: z.string(),
  lines: z.array(SenseLineSchema).optional(),
  subsenses: z.array(SubsenseBlockSchema).optional(),
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
  synonymGroups: z.array(RelationGroupSchema).optional(),
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
  audioBytes: z.unknown().optional(),
  audioBytesB64: z.string().optional(),
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

export const RelatedEntrySchema = z.object({
  term: z.string(),
  kind: z.string(),
  preview: z.string().optional(),
});

export const EtymologyBlockSchema = z.object({
  chain: z.string(),
  firstKnownUse: z.string().optional(),
  variants: z.array(z.object({ text: z.string(), source: z.string().optional() })).optional(),
});

const PronunciationAccentSchema = z.object({
  accent: z.string(),
  ipa: z.string(),
  audioRef: z.string().optional(),
});

const FrequencyGenresSchema = z.object({
  spoken: z.number().optional(),
  fiction: z.number().optional(),
  magazine: z.number().optional(),
  newspaper: z.number().optional(),
  academic: z.number().optional(),
});

export const PosVariantSchema = z.object({
  pos: z.string(),
  prons: z.array(PronunciationAccentSchema),
  frequencies: z.array(z.object({
    rank: z.number().int(),
    source: z.string(),
    total: z.number().optional(),
    genres: FrequencyGenresSchema.optional(),
  })),
  status: WordStatusSchema,
  definitions: z.array(DefinitionEntrySchema),
  frequencyStars: z.object({ count: z.number().int().min(1).max(3), source: z.string() }).optional(),
  inflections: z.array(z.object({ type: z.string(), forms: z.array(z.string()) })).optional(),
});

export const LookupResultSchema = z.object({
  term: z.string(),
  langCode: z.string().length(2),
  reading: z.string(),
  readingKind: ReadingKindSchema,
  frequencies: z.array(z.object({ rank: z.number().int(), source: z.string() })),
  status: WordStatusSchema,
  partsOfSpeech: z.array(z.string()),
  definitions: z.array(DefinitionEntrySchema),
  rawDefinitions: z.array(z.string()),
  detectedPhrase: PhraseMatchSchema.nullable(),
  variants: z.array(PosVariantSchema).optional(),
  related: z.array(RelatedEntrySchema).optional(),
  inflections: z.array(z.object({ type: z.string(), forms: z.array(z.string()) })).optional(),
  level: z.string().optional(),
  frequencyStars: z.object({ count: z.number().int().min(1).max(3), source: z.string() }).optional(),
  etymology: EtymologyBlockSchema.optional(),
  wordFamily: z.object({
    nouns: z.array(z.string()).optional(),
    verbs: z.array(z.string()).optional(),
    adjectives: z.array(z.string()).optional(),
    adverbs: z.array(z.string()).optional(),
  }).optional(),
  wordNet: z.object({
    synset: z.array(z.string()).optional(),
    hypernyms: z.array(z.string()).optional(),
  }).optional(),
  derivedTerms: z.array(z.string()).optional(),
  matchSource: MatchSourceSchema,
  phraseIndexPending: z.boolean().optional(),
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

export const LookupResultPayloadSchema = WorkerLookupResultMessageSchema.omit({ type: true });

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
  pos: z.string().max(60).optional(),
});

export const WordStatusChangedPayloadSchema = z.object({
  tabId: z.number().int(),
  langCode: z.string().length(2),
  term: z.string().min(1).max(200),
  status: WordStatusSchema,
  pos: z.string().max(60).optional(),
});

export const WordStatusListPayloadSchema = z.object({
  tabId: z.number().int(),
  langCode: z.string().length(2),
});

export const WordStatusCyclePayloadSchema = WordStatusGetPayloadSchema.extend({
  pos: z.string().max(60).optional(),
});

export const WordStatusDeletePayloadSchema = WordStatusGetPayloadSchema;

export const WordStatusDeletedPayloadSchema = z.object({
  tabId: z.number().int(),
  langCode: z.string().length(2),
  term: z.string().min(1).max(200),
});

// === Word trash (spec vocabulary-tab-redesign — 24h soft-delete window) ===

export const WordStatusTrashPayloadSchema = WordStatusGetPayloadSchema;

export const WordStatusTrashListPayloadSchema = WordStatusListPayloadSchema;

export const WordStatusRestorePayloadSchema = WordStatusGetPayloadSchema;

export const WordStatusTrashDeletePayloadSchema = WordStatusGetPayloadSchema;

export const WordStatusManyPayloadSchema = z.object({
  tabId: z.number().int(),
  langCode: z.string().length(2),
  terms: z.array(z.string().min(1).max(200)).min(1).max(10000),
});

export const WordStatusSetManyPayloadSchema = WordStatusManyPayloadSchema.extend({
  status: WordStatusSchema,
});

export const WordStatusTrashManyPayloadSchema = WordStatusManyPayloadSchema;

export const WordStatusRestoreManyPayloadSchema = WordStatusManyPayloadSchema;

export const TrashedWordEntrySchema = z.object({
  term: z.string().min(1).max(200),
  previousStatus: WordStatusSchema,
  trashedAt: z.number(),
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

// === Reading annotations (spec reading-annotation — READINGS_GET) ===

export const ReadingsGetPayloadSchema = z.object({
  tabId: z.number().int(),
  langCode: z.string().length(2),
  terms: z.array(z.string().min(1).max(200)).min(1).max(1000),
});

/** bg→cs broadcast: dictionary corpus changed (import/delete/toggle/reorder) —
 *  consumers re-resolve readings. `reason` is diagnostic only. */
export const DictionaryChangedPayloadSchema = z.object({
  reason: z.string().min(1).max(60),
  langCode: z.string().length(2).optional(),
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

export const LocalAudioBuildIndexPayloadSchema = z.object({
  dslFileHandleId: z.string().min(1),
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
  audioBytes: z.unknown().optional(),
  audioBytesB64: z.string().optional(),
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
  jobId: z.string().optional(),
});

export const TtsDownloadProgressPayloadSchema = z.object({
  language: z.string().length(2),
  loaded: z.number().int().min(0),
  total: z.number().int().min(0),
  jobId: z.string().optional(),
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

// Mirrors `LookupRequest` (entities/dictionary/types.ts) verbatim — the
// stricter LookupRequestSchema above has producer-hostile caps (term ≤200,
// contextSentence ≤2000) that real senders exceed; this boundary schema
// validates shape only.
export const lookupRequestSchema = z.object({
  term: z.string(),
  langCode: z.string(),
  contextSentence: z.string(),
  cursorOffset: z.number(),
  fallback: z.boolean().optional(),
});

export const LookupRequestPayloadSchema = z.object({
  requestId: z.string().min(1),
  request: lookupRequestSchema,
  /** Marks a user-initiated lookup from an immersion surface (token click /
   *  web-text selection). Non-immersive senders (card generator, panel
   *  dictionary tab, prefetch) omit it — session-recap counts only this. */
  origin: z.literal('immersion').optional(),
});

export const LookupCancelPayloadSchema = z.object({
  requestId: z.string().optional(),
});
