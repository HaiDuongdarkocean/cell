import type { CardFields } from './cardDraft';
import type { CardCreatorOpenContext, CardCreatorPrefill } from '../types';
import { t, type MessageKey } from '@/shared/i18n';

/** A single source that may be used to generate a field. */
export type FieldSource =
  | { type: 'prefill'; key: keyof CardCreatorPrefill }
  | { type: 'cue'; key: 'targetText' | 'nativeText' }
  | { type: 'translation'; of: 'sentence' }
  | { type: 'none' };

/** Static dependency declaration for one card field. */
export interface FieldDependency {
  /** Possible sources for the field, checked in order. */
  readonly source: readonly FieldSource[];
  /** Whether this field needs a target word to be meaningful. */
  readonly requiresTargetWord: boolean;
  /** Other fields that must be filled before this one can be generated. */
  readonly requires: readonly (keyof CardFields)[];
  /** Whether the field stores media (array) instead of text. */
  readonly isMedia: boolean;
}

const fieldLabels: Record<keyof CardFields, MessageKey> = {
  targetWord: 'cardCreator.field.targetWord',
  sentence: 'cardCreator.field.sentence',
  sentenceTranslation: 'cardCreator.field.sentenceTranslation',
  definitions: 'cardCreator.field.definitions',
  images: 'cardCreator.field.image',
  sentenceAudios: 'cardCreator.field.sentenceAudio',
  wordAudios: 'cardCreator.field.wordAudio',
  note: 'cardCreator.field.note',
  moreExample: 'cardCreator.field.moreExample',
};

/** Human-readable label for a field. */
export function getFieldLabel(key: keyof CardFields): string {
  return t(fieldLabels[key]);
}

/** Static dependency graph for every card field. */
export const fieldDependencies: Record<keyof CardFields, FieldDependency> = {
  targetWord: {
    source: [{ type: 'prefill', key: 'targetWord' }],
    requiresTargetWord: false,
    requires: [],
    isMedia: false,
  },
  sentence: {
    source: [
      { type: 'prefill', key: 'sentence' },
      { type: 'cue', key: 'targetText' },
    ],
    requiresTargetWord: true,
    requires: [],
    isMedia: false,
  },
  sentenceTranslation: {
    source: [
      { type: 'prefill', key: 'sentenceTranslation' },
      { type: 'cue', key: 'nativeText' },
      { type: 'translation', of: 'sentence' },
    ],
    requiresTargetWord: true,
    requires: [],
    isMedia: false,
  },
  definitions: {
    source: [{ type: 'prefill', key: 'definitions' }],
    requiresTargetWord: true,
    requires: [],
    isMedia: false,
  },
  note: {
    source: [{ type: 'prefill', key: 'note' }],
    requiresTargetWord: true,
    requires: [],
    isMedia: false,
  },
  moreExample: {
    source: [{ type: 'prefill', key: 'moreExample' }],
    requiresTargetWord: true,
    requires: [],
    isMedia: false,
  },
  images: {
    source: [{ type: 'prefill', key: 'imageUrls' }],
    requiresTargetWord: true,
    requires: [],
    isMedia: true,
  },
  wordAudios: {
    source: [{ type: 'prefill', key: 'wordAudioUrls' }],
    requiresTargetWord: true,
    requires: [],
    isMedia: true,
  },
  sentenceAudios: {
    source: [{ type: 'prefill', key: 'sentenceAudioUrls' }],
    requiresTargetWord: true,
    requires: ['sentence'],
    isMedia: true,
  },
};

const generationPriority: Record<keyof CardFields, number> = {
  targetWord: 0,
  sentence: 1,
  sentenceTranslation: 2,
  definitions: 3,
  note: 4,
  moreExample: 5,
  images: 6,
  wordAudios: 7,
  sentenceAudios: 8,
};

/** Topological generation order (dependency-respecting). */
export function getFieldGenerationOrder(): (keyof CardFields)[] {
  const inDegree = new Map<keyof CardFields, number>();
  for (const key of Object.keys(fieldDependencies) as (keyof CardFields)[]) {
    const dep = fieldDependencies[key];
    inDegree.set(key, dep.requires.length + (dep.requiresTargetWord ? 1 : 0));
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([key]) => key)
    .sort((a, b) => generationPriority[a] - generationPriority[b]);

  const result: (keyof CardFields)[] = [];

  while (queue.length > 0) {
    const key = queue.shift()!;
    result.push(key);

    for (const other of Object.keys(fieldDependencies) as (keyof CardFields)[]) {
      const dep = fieldDependencies[other];
      const dependsOnKey = dep.requires.includes(key) || (key === 'targetWord' && dep.requiresTargetWord);
      if (!dependsOnKey) continue;

      const newDegree = (inDegree.get(other) ?? 0) - 1;
      inDegree.set(other, newDegree);
      if (newDegree === 0) {
        queue.push(other);
        queue.sort((a, b) => generationPriority[a] - generationPriority[b]);
      }
    }
  }

  return result;
}

function getPrefillValue(prefill: CardCreatorPrefill | undefined, key: keyof CardCreatorPrefill): unknown {
  if (!prefill) return undefined;
  const value = prefill[key];
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.length > 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  return value;
}

function getCueValue(ctx: CardCreatorOpenContext | null, key: 'targetText' | 'nativeText'): string | undefined {
  return ctx?.cue?.[key]?.trim() || undefined;
}

function getEffectiveTargetWord(
  currentFields: CardFields,
  ctx: CardCreatorOpenContext | null,
): string | undefined {
  return currentFields.targetWord.trim() || ctx?.prefill?.targetWord?.trim() || undefined;
}

function getEffectiveSentence(
  currentFields: CardFields,
  ctx: CardCreatorOpenContext | null,
): string | undefined {
  return (
    currentFields.sentence.trim() ||
    ctx?.prefill?.sentence?.trim() ||
    ctx?.cue?.targetText?.trim() ||
    undefined
  );
}

function isFilled(key: keyof CardFields, currentFields: CardFields, isMedia: boolean): boolean {
  if (isMedia) {
    return (currentFields[key] as readonly unknown[]).length > 0;
  }
  return (currentFields[key] as string).trim().length > 0;
}

function sourceIsAvailable(
  source: FieldSource,
  ctx: CardCreatorOpenContext | null,
  currentFields: CardFields,
): boolean {
  switch (source.type) {
    case 'prefill': {
      const value = getPrefillValue(ctx?.prefill, source.key);
      if (value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return true;
    }
    case 'cue':
      return getCueValue(ctx, source.key) !== undefined;
    case 'translation':
      return getEffectiveSentence(currentFields, ctx) !== undefined;
    case 'none':
    default:
      return false;
  }
}

/** Whether a field can be generated, and why (or why not). */
export function canGenerateField(
  key: keyof CardFields,
  ctx: CardCreatorOpenContext | null,
  currentFields: CardFields,
): { ok: boolean; reason: string } {
  const dep = fieldDependencies[key];

  if (dep.requiresTargetWord) {
    const target = getEffectiveTargetWord(currentFields, ctx);
    if (!target) {
      return { ok: false, reason: t('cardCreator.toast.generate.noTarget') };
    }
  }

  for (const required of dep.requires) {
    if (!isFilled(required, currentFields, fieldDependencies[required].isMedia)) {
      const label = getFieldLabel(key);
      const requiredLabel = getFieldLabel(required);
      const reason = required === 'sentence'
        ? t('cardCreator.dependency.missingSentence', [label])
        : t('cardCreator.dependency.missingField', [label, requiredLabel]);
      return { ok: false, reason };
    }
  }

  for (const source of dep.source) {
    if (sourceIsAvailable(source, ctx, currentFields)) {
      return { ok: true, reason: t('cardCreator.action.generateFor', [getFieldLabel(key)]) };
    }
  }

  return { ok: false, reason: t('cardCreator.toast.generateField.noSource', [getFieldLabel(key)]) };
}

/** Whether any field can still be generated in the current draft. */
export function canGenerateAnyField(
  ctx: CardCreatorOpenContext | null,
  currentFields: CardFields,
): { ok: boolean; reason: string } {
  const order = getFieldGenerationOrder();
  let allFilled = true;
  let firstReason = '';

  for (const key of order) {
    const dep = fieldDependencies[key];
    if (isFilled(key, currentFields, dep.isMedia)) continue;
    allFilled = false;

    const { ok, reason } = canGenerateField(key, ctx, currentFields);
    if (ok) {
      return { ok: true, reason: t('cardCreator.action.generateAll') };
    }
    if (!firstReason) {
      firstReason = reason;
    }
  }

  if (allFilled) {
    return { ok: false, reason: t('cardCreator.toast.generate.empty') };
  }

  return { ok: false, reason: firstReason || t('cardCreator.toast.generate.noMedia') };
}
