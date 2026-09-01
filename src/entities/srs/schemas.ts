/**
 * Ocean Language Acquisition SRS — Zod boundary schemas.
 *
 * Used at persistence and MV3 message trust boundaries.
 */

import { z } from 'zod';

// === Primitive / enum schemas ===

export const SrsLanguageCodeSchema = z.string();

export const ComponentTypeSchema = z.enum(['meaning', 'sound', 'spelling']);

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

const SrsAudioFieldValueSchema = z.object({
  kind: z.literal('audio'),
  value: z.string(),
  source: z.enum(['local', 'pronunciation', 'tts']),
});

const SrsImageFieldValueSchema = z.object({
  kind: z.literal('image'),
  value: z.string(),
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
  createdAt: z.number().int(),
});

export const SrsDeckSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  order: z.number().int(),
  studyConfigId: z.string(),
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

export const SrsNoteSchema = z.object({
  id: z.string(),
  notetypeId: z.string(),
  deckId: z.string(),
  targetWord: z.string(),
  fields: z.record(z.string(), SrsFieldValueSchema),
  createdAt: z.number().int(),
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
  type: ComponentTypeSchema,
  progress: z.number().min(0).max(100),
  exploreCount: z.number().int().min(0),
  fsrsState: SrsFsrsSerializedStateSchema,
  reviewCount: z.number().int().min(0),
});

export const SrsCardSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  deckId: z.string(),
  components: z.object({
    meaning: SrsMemoryComponentSchema,
    sound: SrsMemoryComponentSchema,
    spelling: SrsMemoryComponentSchema,
  }),
  studyAgainDue: z.object({
    meaning: z.string().nullable(),
    sound: z.string().nullable(),
    spelling: z.string().nullable(),
  }),
  createdAt: z.number().int(),
  nextDue: z.string(),
  maintenanceMode: z.boolean(),
});

// === Review / Session / Stimulus schemas ===

export const SrsReviewRecordSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  noteId: z.string(),
  notetypeId: z.string(),
  componentType: ComponentTypeSchema,
  templateId: z.string(),
  stimulusType: StimulusTypeSchema,
  startedAt: z.number().int(),
  answeredAt: z.number().int(),
  judgment: ReviewJudgmentSchema,
  typedInput: z.string().optional(),
  isSpellingCorrect: z.boolean().optional(),
  isStudyAgain: z.boolean(),
  resultingProgress: z.number().min(0).max(100),
  resultingFsrsState: SrsFsrsSerializedStateSchema,
});

export const SrsStimulusSchema = z.object({
  type: StimulusTypeSchema,
  payload: z.record(z.string(), SrsFieldValueSchema),
});

export const SrsReviewSessionSchema = z.object({
  card: SrsCardSchema,
  note: SrsNoteSchema,
  notetype: SrsNotetypeSchema,
  componentType: ComponentTypeSchema,
  template: SrsFrontTemplateSchema,
  stimulus: SrsStimulusSchema,
  mode: ReviewModeSchema,
  startedAt: z.number().int(),
});

// === Asset schemas ===

export const SrsAudioAssetSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  fieldId: z.string(),
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
  componentType: ComponentTypeSchema,
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
    targetLanguage: z.string(),
  }),
});

export const SrsGetDecksNotetypesResponseSchema = z.object({
  collections: z.array(SrsCollectionSchema),
  defaultCollectionId: z.string().optional(),
  defaultDeckId: z.string().optional(),
  defaultNotetypeId: z.string().optional(),
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
