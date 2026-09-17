import {
  mergePrefillTextFields,
  prefillHasMedia,
  type PrefillDraftAccess,
} from './prefillMerge';
import { createEmptyDraft, type CardDraft } from './cardDraft';

function makeAccess(initial: CardDraft): { access: PrefillDraftAccess; read: () => CardDraft } {
  let draft = initial;
  return {
    access: {
      getDraft: () => draft,
      setDraft: (updater) => {
        draft = updater(draft);
      },
      warn: () => {},
    },
    read: () => draft,
  };
}

describe('prefillHasMedia', () => {
  it('is false for missing or empty prefill', () => {
    expect(prefillHasMedia(undefined)).toBe(false);
    expect(prefillHasMedia({})).toBe(false);
    expect(prefillHasMedia({ imageUrls: [], wordAudioUrls: [] })).toBe(false);
  });

  it('is true when any media source is present', () => {
    expect(prefillHasMedia({ imageUrls: ['i.png'] })).toBe(true);
    expect(prefillHasMedia({ wordAudioUrls: ['a.mp3'] })).toBe(true);
    expect(prefillHasMedia({ sentenceAudioUrls: ['s.mp3'] })).toBe(true);
    expect(prefillHasMedia({ wordAudioItems: [{} as never] })).toBe(true);
    expect(prefillHasMedia({ imageItems: [{} as never] })).toBe(true);
  });
});

describe('mergePrefillTextFields', () => {
  it('overwrites text fields in overwrite mode and keeps media untouched', () => {
    const { access, read } = makeAccess(createEmptyDraft('Basic', 'Default'));
    mergePrefillTextFields(access, {
      targetWord: 'book',
      sentence: 's',
      definitions: 'd',
      imageUrls: ['ignored.png'],
    });
    const fields = read().fields;
    expect(fields.targetWord).toBe('book');
    expect(fields.sentence).toBe('s');
    expect(fields.definitions).toBe('d');
    expect(fields.images).toEqual([]);
  });

  it('preserves untouched fields and non-text draft config', () => {
    const initial = {
      ...createEmptyDraft('Basic', 'Default'),
      noteType: 'Custom',
      tags: 't',
    };
    const { access, read } = makeAccess(initial);
    mergePrefillTextFields(access, { note: 'n' });
    expect(read().noteType).toBe('Custom');
    expect(read().tags).toBe('t');
    expect(read().fields.note).toBe('n');
    expect(read().fields.targetWord).toBe('');
  });
});
