import { t, type MessageKey } from '@/shared/i18n';
import type { ComponentType, StimulusType } from '@/entities/srs/types';

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

export function stimulusLabel(stimulusType: StimulusType): string {
  return t(STIMULUS_LABEL_KEYS[stimulusType]);
}
