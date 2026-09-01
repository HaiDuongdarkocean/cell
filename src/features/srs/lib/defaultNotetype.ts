import type { SrsField, SrsNotetype } from '@/entities/srs/types';

const DEFAULT_FIELDS: readonly SrsField[] = [
  { id: 'target', name: 'Target word', order: 0, type: 'text' },
  { id: 'ipa', name: 'IPA', order: 1, type: 'text' },
  { id: 'sentence', name: 'Sentence', order: 2, type: 'text' },
  { id: 'def', name: 'Definition', order: 3, type: 'text' },
  { id: 'wordAudio', name: 'Word audio', order: 4, type: 'audio' },
  { id: 'sentAudio', name: 'Sentence audio', order: 5, type: 'audio' },
  { id: 'image', name: 'Image', order: 6, type: 'image' },
  { id: 'examples', name: 'Examples', order: 7, type: 'list' },
  { id: 'notes', name: 'Notes', order: 8, type: 'text' },
  { id: 'translation', name: 'Translation', order: 9, type: 'translation' },
  { id: 'context', name: 'Context', order: 10, type: 'context' },
];

/** Create the default notetype for a collection (V1: 8 front templates + showAll back). */
export function createDefaultNotetype(collectionId: string): SrsNotetype {
  return {
    id: `default-word-${collectionId}`,
    collectionId,
    name: 'Word (default)',
    targetFieldId: 'target',
    fields: DEFAULT_FIELDS,
    frontTemplates: [
      // Sound — word audio
      { id: `sound-word-audio-${collectionId}`, componentType: 'sound', stimulusType: 'word-audio', fieldIds: ['wordAudio'], requiresInput: false },
      // Sound — sentence audio
      { id: `sound-sentence-audio-${collectionId}`, componentType: 'sound', stimulusType: 'sentence-audio', fieldIds: ['sentAudio'], maskFieldId: 'sentence', maskTarget: true, requiresInput: false },
      // Sound — IPA fallback
      { id: `sound-ipa-${collectionId}`, componentType: 'sound', stimulusType: 'ipa', fieldIds: ['ipa'], requiresInput: false, prompt: 'Pronounce this word' },
      // Meaning — image
      { id: `meaning-image-${collectionId}`, componentType: 'meaning', stimulusType: 'image', fieldIds: ['image'], requiresInput: false },
      // Meaning — definition
      { id: `meaning-definition-${collectionId}`, componentType: 'meaning', stimulusType: 'definition', fieldIds: ['def'], requiresInput: false },
      // Meaning — sentence
      { id: `meaning-sentence-${collectionId}`, componentType: 'meaning', stimulusType: 'sentence', fieldIds: ['sentence'], maskFieldId: 'sentence', maskTarget: true, requiresInput: false },
      // Spelling — image + input
      { id: `spelling-image-${collectionId}`, componentType: 'spelling', stimulusType: 'image', fieldIds: ['image'], requiresInput: true },
      // Spelling — sentence + input
      { id: `spelling-sentence-${collectionId}`, componentType: 'spelling', stimulusType: 'sentence', fieldIds: ['sentence'], maskFieldId: 'sentence', maskTarget: true, requiresInput: true },
    ],
    backTemplate: {
      fieldIds: ['target', 'ipa', 'sentence', 'def', 'wordAudio', 'sentAudio', 'image', 'examples', 'notes', 'translation'],
      showAll: true,
    },
  };
}
