import { guessFieldMapping, buildNoteFields, htmlToText, mediaRefsIn } from './fieldMapping';
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

  it('block tags become newlines so entry separators survive', () => {
    expect(htmlToText('<div>a</div><div>b</div>')).toBe('a\nb');
    expect(htmlToText('<p>a</p><p>b</p>')).toBe('a\nb');
    expect(htmlToText('<ul><li>a</li><li>b</li></ul>')).toBe('a\nb');
    expect(htmlToText('<div>x</div><div>---</div><div>y</div>')).toBe('x\n---\ny');
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

  it('sentence-named audio field maps to sentenceAudio', () => {
    const nt: NormalizedAnkiNotetype = {
      id: 'm2', name: 'Mining', isCloze: false,
      fields: [
        { name: 'Word', ord: 0 },
        { name: 'Sentence Audio', ord: 1 },
        { name: 'Word Audio', ord: 2 },
      ],
    };
    const notes: NormalizedAnkiNote[] = [
      { id: 1, modelId: 'm2', tags: [], fields: ['猫', '[sound:s.mp3]', '[sound:w.mp3]'] },
    ];
    const m = guessFieldMapping(nt, notes);
    expect(m['Sentence Audio']).toBe('sentenceAudio');
    expect(m['Word Audio']).toBe('audio');
  });

  it('ord0 named Sentence keeps sentence role; Word field wins target', () => {
    const nt: NormalizedAnkiNotetype = {
      id: 'm3', name: '0.Ocean_Vocab_v4.0.0', isCloze: false,
      fields: [
        { name: 'Sentence', ord: 0 },
        { name: 'Word', ord: 1 },
        { name: 'More Examples', ord: 2 },
        { name: 'Definition', ord: 3 },
        { name: 'Sentence Translation', ord: 4 },
        { name: 'Note', ord: 5 },
        { name: 'Word Audio', ord: 6 },
        { name: 'Sentence Audio', ord: 7 },
        { name: 'Images', ord: 8 },
      ],
    };
    const notes: NormalizedAnkiNote[] = [
      { id: 1, modelId: 'm3', tags: [], fields: ['câu ví dụ.', 'từ', 'thêm ví dụ.', 'nghĩa', 'dịch câu', 'ghi chú', '[sound:w.mp3]', '[sound:s.mp3]', '<img src="i.png">'] },
    ];
    const m = guessFieldMapping(nt, notes);
    expect(m['Word']).toBe('target');
    expect(m['Sentence']).toBe('sentence');
    expect(m['Word Audio']).toBe('audio');
    expect(m['Sentence Audio']).toBe('sentenceAudio');
    expect(m['Images']).toBe('image');
  });

  it('target falls back to lowest-ord unmapped field, never overwrites a named role', () => {
    const nt: NormalizedAnkiNotetype = {
      id: 'm4', name: 'Odd', isCloze: false,
      fields: [
        { name: 'Sentence', ord: 0 },
        { name: 'Body', ord: 1 },
      ],
    };
    const notes: NormalizedAnkiNote[] = [
      { id: 1, modelId: 'm4', tags: [], fields: ['một câu dài đủ ký tự.', 'x'] },
    ];
    const m = guessFieldMapping(nt, notes);
    expect(m['Sentence']).toBe('sentence');
    expect(m['Body']).toBe('target');
  });

  it('mixed text+media field keeps text role', () => {
    const notes = [{ ...NOTES[0]!, fields: ['捨てる', 'to throw away [sound:s.mp3]', '文。', '', '', ''] }];
    const m = guessFieldMapping(NT, notes);
    expect(m['Meaning']).not.toBe('audio');
  });
});

describe('buildNoteFields (system notetype)', () => {
  const mapping = guessFieldMapping(NT, NOTES);

  it('normalizes fields onto system field ids + media requests', () => {
    const { fields, mediaRequests } = buildNoteFields(NOTES[0]!, NT, mapping);
    expect(fields['target']).toEqual({ kind: 'text', value: '捨てる' });
    expect(fields['def']).toEqual({ kind: 'text', value: 'to throw away' });
    expect(fields['sentence']).toEqual({ kind: 'text', value: '要らないものは捨てる。' });
    expect(fields['wordAudio']).toEqual({ kind: 'audio', value: 'w.mp3', source: 'local' });
    expect(fields['image']).toEqual({ kind: 'image', value: 'p.png' });
    expect(mediaRequests).toEqual([
      { fieldId: 'wordAudio', filename: 'w.mp3', kind: 'audio' },
      { fieldId: 'image', filename: 'p.png', kind: 'image' },
    ]);
  });

  it('missing media value → no request, no field', () => {
    const { fields, mediaRequests } = buildNoteFields(NOTES[1]!, NT, mapping);
    expect(fields['image']).toBeUndefined();
    expect(mediaRequests.find((r) => r.fieldId === 'image')).toBeUndefined();
  });

  it('media embedded in a text field routes to the free media field', () => {
    const note: NormalizedAnkiNote = { ...NOTES[0]!, fields: ['猫', 'def <img src="x.png">', 'câu [sound:s.mp3]', '', '', ''] };
    const { fields, mediaRequests } = buildNoteFields(note, NT, mapping);
    expect(fields['def']).toEqual({ kind: 'text', value: 'def' });
    expect(fields['image']).toEqual({ kind: 'image', value: 'x.png' });
    expect(fields['sentAudio']).toEqual({ kind: 'audio', value: 's.mp3', source: 'local' });
    expect(mediaRequests.map((r) => r.fieldId)).toEqual(['image', 'sentAudio']);
  });

  it('two text fields sharing a role merge with a blank line', () => {
    const m = { Expression: 'target', Meaning: 'definition', Extra: 'definition' } as const;
    const note: NormalizedAnkiNote = { ...NOTES[0]!, fields: ['猫', 'a', 's', '', '', 'b'] };
    const { fields } = buildNoteFields(note, NT, m);
    expect(fields['def']).toEqual({ kind: 'text', value: 'a\n\nb' });
  });

  it('second target-mapped field overflows to notes', () => {
    const m = { Expression: 'target', Extra: 'target' } as const;
    const note: NormalizedAnkiNote = { ...NOTES[0]!, fields: ['猫', '', '', '', '', 'alias'] };
    const { fields } = buildNoteFields(note, NT, m);
    expect(fields['target']).toEqual({ kind: 'text', value: '猫' });
    expect(fields['notes']).toEqual({ kind: 'text', value: 'alias' });
  });
});
