import 'fake-indexeddb/auto';
import type { SrsNote, SrsNotetype, SrsAudioAsset, SrsImageAsset } from '@/entities/srs/types';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import { maskSentence, buildStimulus, resolveReviewSurface } from './resolveReviewSurface';

describe('maskSentence', () => {
  it('masks all case-insensitive occurrences of the target word', () => {
    expect(maskSentence('They Abandon the ship.', 'abandon')).toBe('They ░░░░░░░ the ship.');
    expect(maskSentence('abandon Abandon abandon', 'abandon')).toBe('░░░░░░░ ░░░░░░░ ░░░░░░░');
  });
});

describe('buildStimulus', () => {
  const note: SrsNote = {
    id: 'n1',
    notetypeId: 'nt1',
    deckId: 'd1',
    targetWord: 'abandon',
    fields: {
      target: { kind: 'text', value: 'abandon' },
      sentence: { kind: 'text', value: 'They decided to abandon the ship.' },
    },
    createdAt: 1,
  };

  const notetype: SrsNotetype = {
    id: 'nt1',
    collectionId: 'c1',
    name: 'Test',
    targetFieldId: 'target',
    fields: [],
    frontTemplates: [
      { id: 't1', componentType: 'meaning', stimulusType: 'sentence', fieldIds: ['sentence'], maskFieldId: 'sentence', maskTarget: true, requiresInput: false },
    ],
    backTemplate: { fieldIds: ['target', 'sentence'], showAll: true },
  };

  it('masks the target word when maskTarget is set', () => {
    const template = notetype.frontTemplates[0];
    const result = buildStimulus(note, template, new Map(), new Map());
    expect(result).not.toBeNull();
    expect(result!.payload.sentence).toEqual({ kind: 'text', value: 'They decided to ░░░░░░░ the ship.' });
  });

  it('returns null when a required field is missing', () => {
    const template = { ...notetype.frontTemplates[0], fieldIds: ['missing'] as const };
    const result = buildStimulus(note, template, new Map(), new Map());
    expect(result).toBeNull();
  });

  it('resolves audio from cache and falls back on data URL', () => {
    const audioNote: SrsNote = {
      ...note,
      fields: {
        ...note.fields,
        wordAudio: { kind: 'audio', value: 'placeholder', source: 'tts' },
      },
    };
    const template = { id: 't2', componentType: 'sound' as const, stimulusType: 'word-audio' as const, fieldIds: ['wordAudio' as const], requiresInput: false };

    const cached: SrsAudioAsset = { id: audioAssetId('n1', 'wordAudio', 'tts'), noteId: 'n1', fieldId: 'wordAudio', source: 'tts', mimeType: 'audio/mpeg', bytes: new ArrayBuffer(8), size: 8, lastAccessed: 1, createdAt: 1 };
    const result = buildStimulus(audioNote, template, new Map([[audioAssetId('n1', 'wordAudio', 'tts'), cached]]), new Map());
    expect(result).not.toBeNull();
    expect(result!.payload.wordAudio.kind).toBe('audio');
  });

  it('resolves image from cache', () => {
    const imageNote: SrsNote = {
      ...note,
      fields: {
        ...note.fields,
        picture: { kind: 'image', value: 'placeholder' },
      },
    };
    const template = { id: 't3', componentType: 'meaning' as const, stimulusType: 'image' as const, fieldIds: ['picture' as const], requiresInput: false };

    const cached: SrsImageAsset = { id: imageAssetId('n1', 'picture'), noteId: 'n1', fieldId: 'picture', mimeType: 'image/png', bytes: new ArrayBuffer(8), size: 8, lastAccessed: 1, createdAt: 1 };
    const result = buildStimulus(imageNote, template, new Map(), new Map([[imageAssetId('n1', 'picture'), cached]]));
    expect(result).not.toBeNull();
    expect(result!.payload.picture.kind).toBe('image');
  });
});

describe('resolveReviewSurface', () => {
  const note: SrsNote = {
    id: 'n2',
    notetypeId: 'nt2',
    deckId: 'd1',
    targetWord: 'run',
    fields: {
      target: { kind: 'text', value: 'run' },
      def: { kind: 'text', value: 'move quickly' },
    },
    createdAt: 1,
  };

  const notetype: SrsNotetype = {
    id: 'nt2',
    collectionId: 'c1',
    name: 'Test',
    targetFieldId: 'target',
    fields: [],
    frontTemplates: [
      { id: 't-missing', componentType: 'meaning', stimulusType: 'image', fieldIds: ['missing'], requiresInput: false },
      { id: 't-ok', componentType: 'meaning', stimulusType: 'definition', fieldIds: ['def'], requiresInput: false },
    ],
    backTemplate: { fieldIds: ['target', 'def'], showAll: true },
  };

  it('skips unusable templates and returns the first usable one', () => {
    const surface = resolveReviewSurface(note, notetype, 'meaning', new Map(), new Map());
    expect(surface).not.toBeNull();
    expect(surface!.template.id).toBe('t-ok');
    expect(surface!.stimulus.type).toBe('definition');
  });
});
