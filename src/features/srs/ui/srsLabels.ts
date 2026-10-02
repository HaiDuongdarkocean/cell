import { t, type MessageKey } from '@/shared/i18n';
import type { ComponentType, SrsVariant, StimulusType } from '@/entities/srs/types';

const COMPONENT_LABEL_KEYS: Record<ComponentType, MessageKey> = {
  sound: 'srs.component.sound',
  meaning: 'srs.component.meaning',
  spelling: 'srs.component.spelling',
};

const STIMULUS_LABEL_KEYS: Record<StimulusType, MessageKey> = {
  image: 'srs.stimulus.image',
  definition: 'srs.stimulus.definition',
  sentence: 'srs.stimulus.sentence',
  'example-sentence': 'srs.stimulus.exampleSentence',
  'word-audio': 'srs.stimulus.wordAudio',
  'sentence-audio': 'srs.stimulus.sentenceAudio',
  context: 'srs.stimulus.context',
  ipa: 'srs.stimulus.ipa',
};

export function componentLabel(componentType: ComponentType): string {
  return t(COMPONENT_LABEL_KEYS[componentType]);
}

/** Display name of a variant — builtin falls back to its i18n default, custom uses its name. */
export function variantLabel(variant: Pick<SrsVariant, 'id' | 'name' | 'builtin'>): string {
  if (variant.name.trim()) return variant.name;
  const key = variant.builtin ? COMPONENT_LABEL_KEYS[variant.builtin] : undefined;
  return key ? t(key) : variant.id;
}

/** Label for a stored variant id (history rows, confirms) — builtin ids resolve to i18n, custom/orphan ids show raw. */
export function componentLabelById(id: string): string {
  const key = COMPONENT_LABEL_KEYS[id as ComponentType];
  return key ? t(key) : id;
}

export function stimulusLabel(stimulusType: StimulusType): string {
  return t(STIMULUS_LABEL_KEYS[stimulusType]);
}
