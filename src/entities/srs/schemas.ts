/**
 * Ocean Language Acquisition SRS — Zod boundary schemas.
 *
 * Used at persistence and MV3 message trust boundaries.
 */

import { z } from 'zod';

// === Primitive / enum schemas ===

export const SrsLanguageCodeSchema = z.string();

export const ComponentTypeSchema = z.enum(['meaning', 'sound', 'spelling']);

/** VariantId at persistence boundary — plain string so custom variants parse. */
export const VariantIdSchema = z.string();

export const SrsVariantTogglesSchema = z.object({
  scope: z.enum(['both', 'word', 'sentence']).optional(),
  audio: z.enum(['word', 'sentence']).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

export const SrsVariantSchema = z.object({
  id: VariantIdSchema,
  name: z.string(),
  icon: z.string().optional(),
  fieldIds: z.array(z.string()),
  newLoops: z.number().int().min(1).max(3),
  builtin: z.enum(['sound', 'meaning', 'spelling']).optional(),
  order: z.number().int(),
});

export const SrsVariantPresetSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  name: z.string(),
  variants: z.array(SrsVariantSchema),
  isDefault: z.boolean(),
  createdAt: z.number().int(),
});

export const ReviewJudgmentSchema = z.enum(['forget', 'remember']);

export const ReviewModeSchema = z.enum(['explore', 'normal', 'studyAgain']);

export const PoolSchema = z.enum(['explore', 'studyAgain', 'active', 'satisfied', 'maintenance']);

export const StimulusTypeSchema = z.enum([
  'image',
  'definition',
  'sentence',
  'example-sentence',
  'word-audio',
  'sentence-audio',
  'context',
  'ipa',
]);

// === Field / field value schemas ===

export const SrsFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int(),
  type: z.enum(['text', 'audio', 'image', 'list', 'translation', 'context']),
});

const SrsTextFieldValueSchema = z.object({
  kind: z.literal('text'),
  value: z.string(),
});

const SrsTranslationFieldValueSchema = z.object({
  kind: z.literal('translation'),
  value: z.string(),
});

const SrsMediaValueSchema = z.union([z.string(), z.array(z.string())]);

const SrsAudioFieldValueSchema = z.object({
  kind: z.literal('audio'),
  value: SrsMediaValueSchema,
  source: z.enum(['local', 'pronunciation', 'tts']),
});

const SrsImageFieldValueSchema = z.object({
  kind: z.literal('image'),
  value: SrsMediaValueSchema,
});

const SrsListFieldValueSchema = z.object({
  kind: z.literal('list'),
  value: z.array(z.string()),
});

const SrsContextFieldValueSchema = z.object({
  kind: z.literal('context'),
  value: z.string(),
});

export const SrsFieldValueSchema = z.union([
  SrsTextFieldValueSchema,
  SrsTranslationFieldValueSchema,
  SrsAudioFieldValueSchema,
  SrsImageFieldValueSchema,
  SrsListFieldValueSchema,
  SrsContextFieldValueSchema,
]);

// === Notetype / template schemas ===

export const SrsFrontTemplateSchema = z.object({
  id: z.string(),
  componentType: ComponentTypeSchema,
  stimulusType: StimulusTypeSchema,
  fieldIds: z.array(z.string()),
  maskFieldId: z.string().optional(),
  maskTarget: z.boolean().optional(),
  requiresInput: z.boolean(),
  prompt: z.string().optional(),
});

export const SrsBackTemplateSchema = z.object({
  fieldIds: z.array(z.string()),
  showAll: z.boolean(),
});

export const SrsNotetypeSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  name: z.string(),
  targetFieldId: z.string(),
  fields: z.array(SrsFieldSchema),
  frontTemplates: z.array(SrsFrontTemplateSchema),
  backTemplate: SrsBackTemplateSchema,
});

// === Collection / Deck / Study Config schemas ===

export const SrsCollectionSchema = z.object({
  id: z.string(),
  languageProfileId: z.string().nullable(),
  targetLanguage: z.string(),
  name: z.string(),
  defaultStudyConfigId: z.string(),
  defaultDeckId: z.string(),
  defaultNotetypeId: z.string(),
  defaultVariantPresetId: z.string().nullable().optional(),
  createdAt: z.number().int(),
});

export const SrsDeckSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  order: z.number().int(),
  studyConfigId: z.string(),
  variantPresetId: z.string().nullable().optional(),
});

export const SrsProgressConstantsSchema = z.object({
  rememberGainBase: z.number(),
  rememberGainMin: z.number(),
  forgetPenaltyBase: z.number(),
  forgetPenaltyStep: z.number(),
});

export const SrsLearningPathConfigSchema = z.object({
  stages: z.array(ComponentTypeSchema),
  progressionMode: z.enum(['sequential', 'parallel']),
  minExplores: z.number().int(),
});

export const SrsStudyConfigSchema = z.object({
  id: z.string(),
  targetThreshold: z.number().min(0).max(100),
  learningPath: SrsLearningPathConfigSchema,
  progressConstants: SrsProgressConstantsSchema,
});

// === Note / Card / Component schemas ===

export const SrsImportSourceSchema = z.object({
  provider: z.literal('anki'),
  cardId: z.number(),
  noteId: z.number(),
});

export const SrsNoteSchema = z.object({
  id: z.string(),
  notetypeId: z.string(),
  deckId: z.string(),
  targetWord: z.string(),
  fields: z.record(z.string(), SrsFieldValueSchema),
  tags: z.array(z.string()).optional(),
  createdAt: z.number().int(),
  importSource: SrsImportSourceSchema.optional(),
});

export const SrsFsrsSerializedStateSchema = z.object({
  version: z.number().int(),
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int(),
  scheduledDays: z.number().int(),
  reps: z.number().int(),
  lapses: z.number().int(),
  learningSteps: z.number().int(),
  state: z.number().int(),
  lastReview: z.string().optional(),
});

export const SrsMemoryComponentSchema = z.object({
  type: VariantIdSchema,
  progress: z.number().min(0).max(100),
  exploreCount: z.number().int().min(0),
  fsrsState: SrsFsrsSerializedStateSchema,
  reviewCount: z.number().int().min(0),
});

export const SrsCardSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  deckId: z.string(),
  components: z.record(z.string(), SrsMemoryComponentSchema),
  studyAgainDue: z.record(z.string(), z.string().nullable()),
  createdAt: z.number().int(),
  nextDue: z.string(),
  maintenanceMode: z.boolean(),
  importSource: SrsImportSourceSchema.optional(),
});

// === Review / Session / Stimulus schemas ===

export const SrsReviewRecordSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  noteId: z.string(),
  notetypeId: z.string(),
  componentType: VariantIdSchema,
  templateId: z.string(),
  stimulusType: z.string(),
  dictationMode: z.enum(['word', 'sentence']).optional(),
  startedAt: z.number().int(),
  answeredAt: z.number().int(),
  judgment: ReviewJudgmentSchema,
  typedInput: z.string().optional(),
  isSpellingCorrect: z.boolean().optional(),
  wrongAttempts: z.number().int().optional(),
  isStudyAgain: z.boolean(),
  resultingProgress: z.number().min(0).max(100),
  resultingFsrsState: SrsFsrsSerializedStateSchema,
});

export const SrsStimulusSchema = z.object({
  type: z.string(),
  payload: z.record(z.string(), SrsFieldValueSchema),
});

export const SrsReviewSessionSchema = z.object({
  card: SrsCardSchema,
  note: SrsNoteSchema,
  notetype: SrsNotetypeSchema,
  variant: SrsVariantSchema,
  variants: z.array(SrsVariantSchema),
  toggles: z.object({
    scope: z.enum(['both', 'word', 'sentence']),
    audio: z.enum(['word', 'sentence']),
    scopeToggle: z.boolean(),
    audioToggle: z.boolean(),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  }),
  stimulus: SrsStimulusSchema,
  mode: ReviewModeSchema,
  startedAt: z.number().int(),
});

// === Asset schemas ===

export const SrsAudioAssetSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  fieldId: z.string(),
  index: z.number().int().optional(),
  source: z.enum(['local', 'pronunciation', 'tts']),
  mimeType: z.string(),
  bytes: z.instanceof(ArrayBuffer),
  size: z.number().int().min(0),
  lastAccessed: z.number().int(),
  createdAt: z.number().int(),
});

export const SrsImageAssetSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  fieldId: z.string(),
  index: z.number().int().optional(),
  mimeType: z.string(),
  bytes: z.instanceof(ArrayBuffer),
  size: z.number().int().min(0),
  lastAccessed: z.number().int(),
  createdAt: z.number().int(),
});

// === Scheduler helper schemas ===

export const PoolCandidateSchema = z.object({
  card: SrsCardSchema,
  note: SrsNoteSchema,
  notetype: SrsNotetypeSchema,
  componentType: VariantIdSchema,
  effectiveDue: z.string(),
  progress: z.number().min(0).max(100),
  pool: PoolSchema,
});

// === MV3 message payload schemas ===

export const SrsAddNotePayloadSchema = z.object({
  type: z.literal('SRS_ADD_NOTE'),
  payload: z.object({
    targetWord: z.string(),
    targetLanguage: z.string(),
    collectionId: z.string().optional(),
    deckId: z.string().optional(),
    notetypeId: z.string().optional(),
    fields: z.record(z.string(), SrsFieldValueSchema),
  }),
});

export const SrsGetDecksNotetypesPayloadSchema = z.object({
  type: z.literal('SRS_GET_DECKS_NOTETYPES'),
  payload: z.object({
    collectionId: z.string().optional(),
  }),
});

export const SrsGetDecksNotetypesResponseSchema = z.object({
  collectionId: z.string(),
  defaultDeckId: z.string(),
  defaultNotetypeId: z.string(),
  decks: z.array(z.object({ id: z.string(), name: z.string() })),
  notetypes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      targetFieldId: z.string(),
      fields: z.array(
        z.object({ id: z.string(), name: z.string(), type: SrsFieldSchema.shape.type }),
      ),
    }),
  ),
});

export const SrsCreateNoteRequestSchema = z.object({
  type: z.literal('SRS_CREATE_NOTE'),
  payload: z.object({
    targetWord: z.string(),
    sentence: z.string().optional(),
    definition: z.string().optional(),
    audioUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    targetLanguage: z.string(),
  }),
});

export const SrsOpenStudyPageRequestSchema = z.object({
  type: z.literal('SRS_OPEN_STUDY_PAGE'),
});
