import { describe, expect, it } from '@jest/globals';
import { persistNoteFields } from './srsNoteEditorShared';
import type { SrsNote, SrsNotetype } from '@/entities/srs/types';

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
});
