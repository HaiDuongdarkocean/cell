import { describe, expect, it } from '@jest/globals';
import { buildSrsFields, type SrsNotetypeDescriptor } from './srsCardService';
import { createEmptyDraft } from '../state/cardDraft';
import type { MediaFile } from '../media/mediaFile';

const NOTETYPE: SrsNotetypeDescriptor = {
  id: 'default-word-c1',
  name: 'Word (default)',
  targetFieldId: 'target',
  fields: [
    { id: 'target', name: 'Target word', type: 'text' },
    { id: 'ipa', name: 'IPA', type: 'text' },
    { id: 'sentence', name: 'Sentence', type: 'text' },
    { id: 'def', name: 'Definition', type: 'text' },
    { id: 'wordAudio', name: 'Word audio', type: 'audio' },
    { id: 'sentAudio', name: 'Sentence audio', type: 'audio' },
    { id: 'image', name: 'Image', type: 'image' },
    { id: 'examples', name: 'Examples', type: 'list' },
    { id: 'notes', name: 'Notes', type: 'text' },
    { id: 'translation', name: 'Translation', type: 'translation' },
    { id: 'context', name: 'Context', type: 'context' },
  ],
};

function audioFile(sourceUrl?: string): MediaFile {
  return {
    kind: 'audio',
    filename: 'a.mp3',
    mimeType: 'audio/mpeg',
    data: new ArrayBuffer(4),
    sourceUrl,
  };
}

describe('buildSrsFields', () => {
  it('maps card fields to notetype field ids', () => {
    const draft = {
      ...createEmptyDraft('', '').fields,
      targetWord: 'computer program',
      sentence: 'a set of instructions',
      sentenceTranslation: 'chương trình máy tính',
      definitions: 'a thing',
      note: 'my note',
      moreExample: 'ex1\nex2',
    };
    const fields = buildSrsFields(NOTETYPE, draft);
    expect(fields['target']).toEqual({ kind: 'text', value: 'computer program' });
    expect(fields['sentence']).toEqual({ kind: 'text', value: 'a set of instructions' });
    expect(fields['translation']).toEqual({ kind: 'translation', value: 'chương trình máy tính' });
    expect(fields['context']).toEqual({ kind: 'context', value: 'a set of instructions' });
    expect(fields['def']).toEqual({ kind: 'text', value: 'a thing' });
    expect(fields['notes']).toEqual({ kind: 'text', value: 'my note' });
    expect(fields['examples']).toEqual({ kind: 'list', value: ['ex1', 'ex2'] });
  });

  it('keeps remote media URLs and encodes captured bytes as data URLs', () => {
    const draft = {
      ...createEmptyDraft('', '').fields,
      targetWord: 'w',
      wordAudios: [audioFile('https://example.com/w.mp3')],
      sentenceAudios: [audioFile()],
    };
    const fields = buildSrsFields(NOTETYPE, draft);
    expect(fields['wordAudio']).toEqual({
      kind: 'audio',
      value: ['https://example.com/w.mp3'],
      source: 'pronunciation',
    });
    const sent = fields['sentAudio'];
    expect(sent?.kind).toBe('audio');
    if (sent?.kind === 'audio') {
      expect(Array.isArray(sent.value) && sent.value[0]?.startsWith('data:audio/mpeg;base64,')).toBe(true);
      expect(sent.source).toBe('local');
    }
  });

  it('serializes every media item, not just the first', () => {
    const draft = {
      ...createEmptyDraft('', '').fields,
      targetWord: 'w',
      wordAudios: [audioFile('https://a/1.mp3'), audioFile('https://a/2.mp3')],
      images: [
        { kind: 'image', filename: 'a.png', mimeType: 'image/png', data: new ArrayBuffer(2) },
        { kind: 'image', filename: 'b.png', mimeType: 'image/png', data: new ArrayBuffer(2) },
      ] as MediaFile[],
    };
    const fields = buildSrsFields(NOTETYPE, draft);
    expect(fields['wordAudio']).toEqual({
      kind: 'audio',
      value: ['https://a/1.mp3', 'https://a/2.mp3'],
      source: 'pronunciation',
    });
    const image = fields['image'];
    expect(image?.kind).toBe('image');
    if (image?.kind === 'image') expect(image.value).toHaveLength(2);
  });

  it('omits empty fields', () => {
    const fields = buildSrsFields(NOTETYPE, createEmptyDraft('', '').fields);
    expect(fields).toEqual({});
  });
});
