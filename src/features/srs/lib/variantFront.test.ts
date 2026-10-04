import type { SrsNote, SrsNotetype, SrsVariant } from '@/entities/srs/types';
import { createDefaultVariants } from '@/features/srs/lib/defaultVariants';
import {
  expectedInputField,
  expectedInputText,
  isVariantServable,
  resolveVariantToggles,
  servableVariantIds,
  visibleVariantFields,
} from './variantFront';

const NOTETYPE: SrsNotetype = {
  id: 'nt1',
  collectionId: 'c1',
  name: 'Test',
  targetFieldId: 'target',
  fields: [
    { id: 'target', name: 'Target', order: 0, type: 'text' },
    { id: 'sentence', name: 'Sentence', order: 1, type: 'text' },
    { id: 'image', name: 'Image', order: 2, type: 'image' },
    { id: 'wordAudio', name: 'Word audio', order: 3, type: 'audio' },
    { id: 'sentAudio', name: 'Sentence audio', order: 4, type: 'audio' },
  ],
  frontTemplates: [],
  backTemplate: { fieldIds: ['target', 'sentence'], showAll: true },
};

const makeNote = (overrides?: Partial<SrsNote>): SrsNote => ({
  id: 'n1',
  notetypeId: 'nt1',
  deckId: 'd1',
  targetWord: 'abandon',
  fields: {
    sentence: { kind: 'text', value: 'They decided to abandon the ship.' },
    image: { kind: 'image', value: ['https://example.com/pic.png'] },
    wordAudio: { kind: 'audio', value: ['https://example.com/w.mp3'], source: 'local' },
    sentAudio: { kind: 'audio', value: ['https://example.com/s.mp3'], source: 'local' },
  },
  createdAt: 1,
  ...overrides,
});

const VARIANTS = createDefaultVariants();
const variantOf = (id: string): SrsVariant => VARIANTS.find((v) => v.id === id)!;

describe('isVariantServable', () => {
  it('serves all builtins on a full note', () => {
    const note = makeNote();
    for (const v of VARIANTS) expect(isVariantServable(v, note, NOTETYPE)).toBe(true);
  });

  it('hides the image-only variant when the note has no image', () => {
    const note = makeNote();
    delete note.fields.image;
    expect(isVariantServable(variantOf('meaning'), note, NOTETYPE)).toBe(false);
    expect(isVariantServable(variantOf('sound'), note, NOTETYPE)).toBe(true);
  });

  it('hides dictation when no audio material exists — no text fallback', () => {
    const note = makeNote();
    delete note.fields.wordAudio;
    delete note.fields.sentAudio;
    expect(isVariantServable(variantOf('spelling'), note, NOTETYPE)).toBe(false);
  });

  it('serves dictation with a single audio source', () => {
    const note = makeNote();
    delete note.fields.sentAudio;
    expect(isVariantServable(variantOf('spelling'), note, NOTETYPE)).toBe(true);
  });

  it('hides a variant with no renderable front fields at all', () => {
    const note = makeNote({ targetWord: '  ' });
    delete note.fields.sentence;
    expect(isVariantServable(variantOf('sound'), note, NOTETYPE)).toBe(false);
  });

  it('input-only variant is not servable without audio', () => {
    const note = makeNote();
    const custom: SrsVariant = { id: 'x', name: 'x', fieldIds: ['input'], newLoops: 1, order: 9 };
    expect(isVariantServable(custom, note, NOTETYPE)).toBe(false);
  });
});

describe('servableVariantIds', () => {
  it('returns only servable ids', () => {
    const note = makeNote();
    delete note.fields.image;
    delete note.fields.wordAudio;
    delete note.fields.sentAudio;
    expect([...servableVariantIds(VARIANTS, note, NOTETYPE)]).toEqual(['sound']);
  });
});

describe('resolveVariantToggles', () => {
  it('offers scope toggle when target+sentence both declared and present', () => {
    const t = resolveVariantToggles(variantOf('sound'), makeNote());
    expect(t.scopeToggle).toBe(true);
    expect(t.scope).toBe('both');
  });

  it('honours a persisted scope pref while the option is offered', () => {
    const t = resolveVariantToggles(variantOf('sound'), makeNote(), { scope: 'word' });
    expect(t.scope).toBe('word');
  });

  it('collapses to word when sentence material is missing', () => {
    const note = makeNote();
    delete note.fields.sentence;
    const t = resolveVariantToggles(variantOf('sound'), note, { scope: 'sentence' });
    expect(t.scopeToggle).toBe(false);
    expect(t.scope).toBe('word');
  });

  it('offers audio toggle only when both audios declared and present', () => {
    const full = resolveVariantToggles(variantOf('spelling'), makeNote());
    expect(full.audioToggle).toBe(true);

    const note = makeNote();
    delete note.fields.sentAudio;
    const single = resolveVariantToggles(variantOf('spelling'), note);
    expect(single.audioToggle).toBe(false);
    expect(single.audio).toBe('word');
  });

  it('degrades a persisted sentence audio pref when sentence audio is missing', () => {
    const note = makeNote();
    delete note.fields.sentAudio;
    const t = resolveVariantToggles(variantOf('spelling'), note, { audio: 'sentence' });
    expect(t.audio).toBe('word');
  });

  it('resolves dictation difficulty with medium default and persisted pref', () => {
    expect(resolveVariantToggles(variantOf('spelling'), makeNote()).difficulty).toBe('medium');
    expect(resolveVariantToggles(variantOf('spelling'), makeNote(), { difficulty: 'hard' }).difficulty).toBe('hard');
  });
});

describe('visibleVariantFields', () => {
  it('drops fields without material and respects the scope toggle', () => {
    const note = makeNote();
    const toggles = resolveVariantToggles(variantOf('sound'), note, { scope: 'sentence' });
    expect(visibleVariantFields(variantOf('sound'), note, toggles)).toEqual(['sentence']);
  });

  it('keeps the input pseudo-field and the selected audio field', () => {
    const note = makeNote();
    const toggles = resolveVariantToggles(variantOf('spelling'), note, { audio: 'sentence' });
    expect(visibleVariantFields(variantOf('spelling'), note, toggles)).toEqual(['sentAudio', 'input']);
  });
});

describe('expectedInputField / expectedInputText', () => {
  it('expects the word when word audio is selected', () => {
    const note = makeNote();
    const toggles = resolveVariantToggles(variantOf('spelling'), note, { audio: 'word' });
    expect(expectedInputField(variantOf('spelling'), note, toggles)).toBe('target');
    expect(expectedInputText(variantOf('spelling'), note, toggles)).toBe('abandon');
  });

  it('expects the sentence when sentence audio is selected', () => {
    const note = makeNote();
    const toggles = resolveVariantToggles(variantOf('spelling'), note, { audio: 'sentence' });
    expect(expectedInputField(variantOf('spelling'), note, toggles)).toBe('sentence');
    expect(expectedInputText(variantOf('spelling'), note, toggles)).toBe('They decided to abandon the ship.');
  });

  it('returns null for variants without an input field or without audio', () => {
    const note = makeNote();
    const t = resolveVariantToggles(variantOf('sound'), note);
    expect(expectedInputField(variantOf('sound'), note, t)).toBeNull();

    const noAudio = makeNote();
    delete noAudio.fields.wordAudio;
    delete noAudio.fields.sentAudio;
    const t2 = resolveVariantToggles(variantOf('spelling'), noAudio);
    expect(expectedInputField(variantOf('spelling'), noAudio, t2)).toBeNull();
  });
});
