import type { SrsField, SrsNote, SrsNotetype } from '@/entities/srs/types';
import { detectPumpFields, pumpFieldText } from './pumpFields';

function field(id: string, type: SrsField['type']): SrsField {
  return { id, name: id, order: 0, type };
}

function notetype(fields: readonly SrsField[], frontTemplates: SrsNotetype['frontTemplates'] = []): SrsNotetype {
  return {
    id: 'nt',
    collectionId: 'c1',
    name: 'nt',
    targetFieldId: 'target',
    fields,
    frontTemplates,
    backTemplate: { fieldIds: [], showAll: true },
  };
}

function note(fields: SrsNote['fields']): SrsNote {
  return { id: 'n1', notetypeId: 'nt', deckId: 'd1', targetWord: '', fields, createdAt: 0 };
}

describe('detectPumpFields', () => {
  it('prefers canonical ids', () => {
    const nt = notetype([
      field('sentence', 'text'),
      field('sentAudio', 'audio'),
      field('target', 'text'),
      field('other', 'text'),
    ]);
    expect(detectPumpFields(nt)).toEqual({
      sentenceFieldId: 'sentence',
      audioFieldId: 'sentAudio',
      termFieldId: 'target',
    });
  });

  it('falls back to context field for sentences', () => {
    const nt = notetype([field('context', 'context'), field('target', 'text')]);
    expect(detectPumpFields(nt).sentenceFieldId).toBe('context');
  });

  it('resolves sentence via frontTemplates stimulusType when canonical ids absent', () => {
    const nt = notetype(
      [field('customText', 'text'), field('customAudio', 'audio')],
      [
        {
          id: 'tpl',
          componentType: 'text' as never,
          stimulusType: 'sentence' as never,
          fieldIds: ['customText'],
          requiresInput: false,
        },
      ],
    );
    const out = detectPumpFields(nt);
    expect(out.sentenceFieldId).toBe('customText');
    expect(out.audioFieldId).toBeNull();
  });

  it('returns null sentenceFieldId when nothing matches', () => {
    const nt = notetype([field('notes', 'text')]);
    expect(detectPumpFields(nt).sentenceFieldId).toBeNull();
  });

  it('ignores canonical ids with wrong field type', () => {
    const nt = notetype([field('sentence', 'image'), field('sentAudio', 'text')]);
    const out = detectPumpFields(nt);
    expect(out.sentenceFieldId).toBeNull();
    expect(out.audioFieldId).toBeNull();
  });
});

describe('pumpFieldText', () => {
  it('reads raw text values and trims', () => {
    const n = note({ sentence: { kind: 'text', value: '  xin chào  ' } });
    expect(pumpFieldText(n, 'sentence')).toBe('xin chào');
  });

  it('returns null for missing/empty/non-text kinds', () => {
    const n = note({
      empty: { kind: 'text', value: '   ' },
      audio: { kind: 'audio', value: 'x.mp3', source: 'local' },
      img: { kind: 'image', value: 'x.png' },
      list: { kind: 'list', value: ['a'] },
    });
    expect(pumpFieldText(n, 'missing')).toBeNull();
    expect(pumpFieldText(n, 'empty')).toBeNull();
    expect(pumpFieldText(n, 'audio')).toBeNull();
    expect(pumpFieldText(n, 'img')).toBeNull();
    expect(pumpFieldText(n, 'list')).toBeNull();
    expect(pumpFieldText(n, null)).toBeNull();
  });

  it('accepts translation and context kinds', () => {
    const n = note({
      t: { kind: 'translation', value: 'hello' },
      c: { kind: 'context', value: 'the sentence' },
    });
    expect(pumpFieldText(n, 't')).toBe('hello');
    expect(pumpFieldText(n, 'c')).toBe('the sentence');
  });
});
