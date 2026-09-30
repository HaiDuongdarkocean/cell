import { guessFieldMapping, synthesizeNotetype, buildNoteFields, htmlToText, mediaRefsIn } from './fieldMapping';
import type { NormalizedAnkiNote, NormalizedAnkiNotetype } from '../model/normalized';

const NT: NormalizedAnkiNotetype = {
  id: 'm1', name: 'Basic', isCloze: false,
  fields: [
    { name: 'Expression', ord: 0 },
    { name: 'Meaning', ord: 1 },
    { name: 'Sentence', ord: 2 },
    { name: 'Audio', ord: 3 },
    { name: 'Picture', ord: 4 },
    { name: 'Extra', ord: 5 },
  ],
};

const NOTES: NormalizedAnkiNote[] = [
  { id: 1, modelId: 'm1', tags: [], fields: ['捨てる', 'to throw away', '要らないものは捨てる。', '[sound:w.mp3]', '<img src="p.png">', ''] },
  { id: 2, modelId: 'm1', tags: [], fields: ['瞬間', 'moment', 'その瞬間。', '[sound:w2.mp3]', '', ''] },
];

describe('htmlToText', () => {
  it('strips tags, converts <br>, decodes entities, drops media markup', () => {
    expect(htmlToText('a<br>b &amp; c <b>x</b>')).toBe('a\nb & c x');
    expect(htmlToText('[sound:a.mp3]<img src="i.png">')).toBe('');
  });
});

describe('mediaRefsIn', () => {
  it('extracts sound + img filenames', () => {
    expect(mediaRefsIn('[sound:a.mp3] <img src="b.png">')).toEqual({ sounds: ['a.mp3'], images: ['b.png'] });
  });
});

describe('guessFieldMapping', () => {
  it('maps media fields by markers, ord0 to target, longest text to sentence', () => {
    const m = guessFieldMapping(NT, NOTES);
    expect(m['Expression']).toBe('target');
    expect(m['Audio']).toBe('audio');
    expect(m['Picture']).toBe('image');
    expect(m['Sentence']).toBe('sentence');
    expect(m['Meaning']).toBe('definition');
    expect(m['Extra']).toBe('notes');
  });

  it('mixed text+media field keeps text role', () => {
    const notes = [{ ...NOTES[0]!, fields: ['捨てる', 'to throw away [sound:s.mp3]', '文。', '', '', ''] }];
    const m = guessFieldMapping(NT, notes);
    expect(m['Meaning']).not.toBe('audio');
  });
});

describe('synthesizeNotetype', () => {
  const mapping = guessFieldMapping(NT, NOTES);
  const nt = synthesizeNotetype('col1', NT, mapping, NOTES);

  it('creates fields with role-derived types and a text target', () => {
    expect(nt.targetFieldId).toBe('f0');
    expect(nt.fields.find((f) => f.id === 'f3')?.type).toBe('audio');
    expect(nt.fields.find((f) => f.id === 'f4')?.type).toBe('image');
    expect(nt.fields.find((f) => f.id === 'f5')?.type).toBe('text'); // notes
  });

  it('every component type has ≥1 template and a target-only fallback', () => {
    for (const c of ['meaning', 'sound', 'spelling'] as const) {
      const list = nt.frontTemplates.filter((t) => t.componentType === c);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.at(-1)!.fieldIds).toEqual(['f0']); // guaranteed-renderable fallback
    }
  });

  it('emits __media field for mixed text+media', () => {
    const notes = [{ ...NOTES[0]!, fields: ['w', 'def [sound:x.mp3]', 's', '', '', ''] }];
    const m = guessFieldMapping(NT, notes);
    const mixed = synthesizeNotetype('col1', NT, m, notes);
    const media = mixed.fields.find((f) => f.id === 'f1__media');
    expect(media?.type).toBe('audio');
  });
});

describe('buildNoteFields', () => {
  const mapping = guessFieldMapping(NT, NOTES);
  const nt = synthesizeNotetype('col1', NT, mapping, NOTES);

  it('builds typed values + media requests', () => {
    const { fields, mediaRequests } = buildNoteFields(NOTES[0]!, NT, nt, mapping);
    expect(fields['f0']).toEqual({ kind: 'text', value: '捨てる' });
    expect(fields['f3']).toEqual({ kind: 'audio', value: 'w.mp3', source: 'local' });
    expect(fields['f4']).toEqual({ kind: 'image', value: 'p.png' });
    expect(mediaRequests).toEqual([
      { fieldId: 'f3', filename: 'w.mp3', kind: 'audio' },
      { fieldId: 'f4', filename: 'p.png', kind: 'image' },
    ]);
  });

  it('missing media value → no request, no field', () => {
    const { fields, mediaRequests } = buildNoteFields(NOTES[1]!, NT, nt, mapping);
    expect(fields['f4']).toBeUndefined();
    expect(mediaRequests.find((r) => r.fieldId === 'f4')).toBeUndefined();
  });
});
