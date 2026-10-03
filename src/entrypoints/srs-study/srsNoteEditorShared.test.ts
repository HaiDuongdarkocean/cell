import { describe, expect, it } from '@jest/globals';
import { persistNoteFields, storedMedia } from './srsNoteEditorShared';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import type { SrsAudioAsset, SrsImageAsset, SrsNote, SrsNotetype } from '@/entities/srs/types';

const notetype: SrsNotetype = {
  id: 'nt1',
  collectionId: 'col1',
  name: 'Default',
  targetFieldId: 'target',
  fields: [
    { id: 'target', name: 'Target', order: 0, type: 'text' },
    { id: 'wordAudio', name: 'Word audio', order: 1, type: 'audio' },
    { id: 'image', name: 'Image', order: 2, type: 'image' },
  ],
  frontTemplates: [],
  backTemplate: { fieldIds: ['target'], showAll: true },
};

const note: SrsNote = {
  id: 'n1',
  notetypeId: 'nt1',
  deckId: 'd1',
  targetWord: 'abandon',
  fields: {
    target: { kind: 'text', value: 'abandon' },
    wordAudio: { kind: 'audio', value: 'w.mp3', source: 'pronunciation' },
    image: { kind: 'image', value: 'i.png' },
  },
  createdAt: 1,
};

describe('persistNoteFields', () => {
  it('keeps stored media fields when the editor holds no replacement file', async () => {
    const { fields } = await persistNoteFields(notetype, note, { target: 'abandon' }, {});
    expect(fields.wordAudio).toEqual({ kind: 'audio', value: 'w.mp3', source: 'pronunciation' });
    expect(fields.image).toEqual({ kind: 'image', value: 'i.png' });
  });

  it('drops media only for fields the user removed', async () => {
    const { fields } = await persistNoteFields(
      notetype,
      note,
      { target: 'abandon' },
      {},
      new Set(['image']),
    );
    expect(fields.wordAudio).toEqual({ kind: 'audio', value: 'w.mp3', source: 'pronunciation' });
    expect(fields.image).toBeUndefined();
  });

  it('writes text field edits', async () => {
    const { targetWord, fields } = await persistNoteFields(
      notetype,
      note,
      { target: 'forsake' },
      {},
    );
    expect(targetWord).toBe('forsake');
    expect(fields.target).toEqual({ kind: 'text', value: 'forsake' });
  });

  it('clears targetWord and the target field when the editor text is emptied', async () => {
    const { targetWord, fields } = await persistNoteFields(
      notetype,
      note,
      { target: '' },
      {},
    );
    expect(targetWord).toBe('');
    expect(fields.target).toBeUndefined();
  });
});

describe('storedMedia', () => {
  const audioField = notetype.fields[1]!;
  const imageField = notetype.fields[2]!;
  const asset = (id: string): SrsAudioAsset & SrsImageAsset => ({
    id, noteId: 'n1', fieldId: 'x', source: 'local', mimeType: 'image/png',
    bytes: new ArrayBuffer(1), size: 1, lastAccessed: 0, createdAt: 0,
  });

  it('resolves image by noteId+fieldId when the asset id is not canonical', async () => {
    const note2 = { ...note, fields: { image: { kind: 'image', value: 'i.png' } } } as SrsNote;
    const map = new Map([['anki-media-n1-image', { ...asset('anki-media-n1-image'), fieldId: 'image' }]]);
    const files = await storedMedia(imageField, note2, new Map(), map);
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe('i.png');
  });

  it('resolves image by canonical asset id', async () => {
    const note2 = { ...note, fields: { image: { kind: 'image', value: 'i.png' } } } as SrsNote;
    const id = imageAssetId('n1', 'image');
    const map = new Map([[id, { ...asset(id), fieldId: 'image' }]]);
    const files = await storedMedia(imageField, note2, new Map(), map);
    expect(files).toHaveLength(1);
  });

  it('audio keeps the same fallback path', async () => {
    const note2 = { ...note, fields: { wordAudio: { kind: 'audio', value: 'w.mp3', source: 'local' } } } as SrsNote;
    const map = new Map([[audioAssetId('n1', 'wordAudio', 'local'), { ...asset('x'), fieldId: 'wordAudio' }]]);
    const files = await storedMedia(audioField, note2, map, new Map());
    expect(files).toHaveLength(1);
  });
});
