/**
 * Tests for cardDraft: serialize/deserialize round-trip, autosave debounce,
 * clear on success, restore on reopen, media stripped on persist.
 */
import {
  serializeDraft,
  deserializeDraft,
  isValidSerializedDraft,
  DraftAutosaver,
  createEmptyDraft,
  DRAFT_STORAGE_KEY,
  mergePrefillIntoDraft,
  mediaUrlsToFetch,
  buildMergedMediaArray,
} from './cardDraft';
import type { CardDraft } from './cardDraft';
import type { MediaFile } from '../media/mediaFile';

// Mock chrome.storage.local
const storage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: jest.fn(async (keys: string | string[]) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        return key in storage ? { [key]: storage[key] } : {};
      }),
      set: jest.fn(async (obj: Record<string, unknown>) => {
        Object.assign(storage, obj);
      }),
      remove: jest.fn(async (keys: string | string[]) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        delete storage[key];
      }),
    },
  },
};
(global as { chrome?: unknown }).chrome = chromeMock;

function makeDraft(): CardDraft {
  return {
    noteType: 'Cell Video Card',
    deck: 'Default',
    fields: {
      targetWord: 'hello',
      sentence: 'Hello world.',
      sentenceTranslation: 'Xin chào.',
      definitions: 'a greeting',
      images: [],
      sentenceAudios: [],
      wordAudios: [],
      note: 'my note',
      moreExample: 'extra',
    },
    fieldMapping: { targetWord: 'TargetWord', sentence: 'Sentence' },
    tags: 'my-tag another',
    mediaUpdateMode: 'overwrite',
  };
}

describe('cardDraft', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    jest.clearAllMocks();
  });

  describe('serialize/deserialize', () => {
    it('round-trips config + tags but NOT field content (cleared on close)', () => {
      const draft = makeDraft();
      const serialized = serializeDraft(draft);
      const restored = deserializeDraft(serialized);
      expect(restored.noteType).toBe('Cell Video Card');
      expect(restored.deck).toBe('Default');
      // Field content is cleared on close — only tags + config persist.
      expect(restored.fields.targetWord).toBe('');
      expect(restored.fields.sentence).toBe('');
      expect(restored.fields.note).toBe('');
      expect(restored.fields.definitions).toBe('');
      expect(restored.fields.moreExample).toBe('');
      expect(restored.fieldMapping).toEqual({ targetWord: 'TargetWord', sentence: 'Sentence' });
      expect(restored.tags).toBe('my-tag another');
      expect(restored.mediaUpdateMode).toBe('overwrite');
    });

    it('strips media ArrayBuffers on serialize (not persistable)', () => {
      const draft: CardDraft = {
        ...makeDraft(),
        fields: {
          ...makeDraft().fields,
          images: [
            { kind: 'image', filename: 'a.png', mimeType: 'image/png', data: new ArrayBuffer(8) },
          ],
        },
      };
      const serialized = serializeDraft(draft);
      // Serialized has no fields key at all (content not persisted).
      expect((serialized as unknown as Record<string, unknown>).fields).toBeUndefined();
      // On restore, images is empty array.
      const restored = deserializeDraft(serialized);
      expect(restored.fields.images).toEqual([]);
    });

    it('includes savedAt timestamp', () => {
      const before = Date.now();
      const serialized = serializeDraft(makeDraft());
      const after = Date.now();
      expect(serialized.savedAt).toBeGreaterThanOrEqual(before);
      expect(serialized.savedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('isValidSerializedDraft', () => {
    it('rejects null/undefined/non-object', () => {
      expect(isValidSerializedDraft(null)).toBe(false);
      expect(isValidSerializedDraft(undefined)).toBe(false);
      expect(isValidSerializedDraft('string')).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(isValidSerializedDraft({ noteType: 'X' })).toBe(false);
    });

    it('rejects invalid mediaUpdateMode', () => {
      const valid = serializeDraft(makeDraft());
      expect(isValidSerializedDraft({ ...valid, mediaUpdateMode: 'invalid' })).toBe(false);
    });

    it('accepts a valid serialized draft', () => {
      expect(isValidSerializedDraft(serializeDraft(makeDraft()))).toBe(true);
    });
  });

  describe('DraftAutosaver', () => {
    it('flush saves immediately', async () => {
      const autosaver = new DraftAutosaver();
      const draft = makeDraft();
      autosaver.schedule(draft);
      await autosaver.flush();
      expect(storage[DRAFT_STORAGE_KEY]).toBeDefined();
      expect((storage[DRAFT_STORAGE_KEY] as { noteType: string }).noteType).toBe('Cell Video Card');
    });

    it('debounce: schedule twice within 500ms → only one save', async () => {
      const autosaver = new DraftAutosaver();
      const draft = makeDraft();
      autosaver.schedule(draft);
      autosaver.schedule({ ...draft, tags: 'updated-tag' });
      // Wait 100ms — should NOT have saved yet (debounced).
      await new Promise((r) => setTimeout(r, 100));
      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
      await autosaver.flush();
      expect((storage[DRAFT_STORAGE_KEY] as { tags: string }).tags).toBe('updated-tag');
    });

    it('cancel prevents pending save', async () => {
      const autosaver = new DraftAutosaver();
      autosaver.schedule(makeDraft());
      autosaver.cancel();
      await new Promise((r) => setTimeout(r, 600));
      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    });

    it('load returns null when no draft saved', async () => {
      const autosaver = new DraftAutosaver();
      expect(await autosaver.load()).toBeNull();
    });

    it('load restores config + tags but clears field content', async () => {
      const autosaver = new DraftAutosaver();
      const draft = makeDraft();
      autosaver.schedule(draft);
      await autosaver.flush();
      const restored = await autosaver.load();
      expect(restored?.noteType).toBe('Cell Video Card');
      expect(restored?.tags).toBe('my-tag another');
      // Field content cleared on restore (closing dialog = clear content).
      expect(restored?.fields.targetWord).toBe('');
    });

    it('load returns null for invalid stored value', async () => {
      storage[DRAFT_STORAGE_KEY] = { garbage: true };
      const autosaver = new DraftAutosaver();
      expect(await autosaver.load()).toBeNull();
    });

    it('clear removes the saved draft', async () => {
      const autosaver = new DraftAutosaver();
      autosaver.schedule(makeDraft());
      await autosaver.flush();
      expect(storage[DRAFT_STORAGE_KEY]).toBeDefined();
      await autosaver.clear();
      expect(storage[DRAFT_STORAGE_KEY]).toBeUndefined();
    });
  });

  describe('createEmptyDraft', () => {
    it('creates draft with empty text fields + empty tags', () => {
      const draft = createEmptyDraft('Basic', 'Default');
      expect(draft.noteType).toBe('Basic');
      expect(draft.deck).toBe('Default');
      expect(draft.fields.targetWord).toBe('');
      expect(draft.fields.sentence).toBe('');
      expect(draft.tags).toBe('');
      expect(draft.mediaUpdateMode).toBe('overwrite');
      expect(draft.fields.images).toEqual([]);
    });
  });

  describe('mergePrefillIntoDraft', () => {
    function media(url: string, kind: 'image' | 'audio' = 'image'): MediaFile {
      return {
        kind,
        filename: url.split('/').pop() ?? 'file',
        mimeType: kind === 'image' ? 'image/png' : 'audio/wav',
        data: new ArrayBuffer(0),
        sourceUrl: url,
      };
    }

    function unmappedMedia(kind: 'image' | 'audio' = 'image'): MediaFile {
      return {
        kind,
        filename: `user-${kind}.file`,
        mimeType: kind === 'image' ? 'image/png' : 'audio/wav',
        data: new ArrayBuffer(0),
      };
    }

    function draftWithImages(images: MediaFile[], mode: CardDraft['mediaUpdateMode'] = 'overwrite'): CardDraft {
      return {
        ...makeDraft(),
        mediaUpdateMode: mode,
        fields: { ...makeDraft().fields, images },
      };
    }

    it('overwrites image selection to exactly the new prefill', () => {
      const draft = draftWithImages([media('1'), media('2')]);
      const prefill = { targetWord: 'hello', imageUrls: ['2', '3', '4'] };
      const { media: plan } = mergePrefillIntoDraft(draft, prefill);

      expect(plan.images.orderedUrls).toEqual(['2', '3', '4']);
      expect(Object.keys(plan.images.keptByUrl).sort()).toEqual(['2']);
      expect(mediaUrlsToFetch(plan.images)).toEqual(['3', '4']);

      const fetched: Record<string, MediaFile> = {
        '3': media('3'),
        '4': media('4'),
      };
      expect(buildMergedMediaArray(plan.images, fetched)).toEqual([
        media('2'),
        media('3'),
        media('4'),
      ]);
    });

    it('diff/merges image selection in append mode', () => {
      const draft = draftWithImages([media('1'), media('2')], 'append');
      const prefill = { targetWord: 'hello', imageUrls: ['2', '3', '4'] };
      const { media: plan } = mergePrefillIntoDraft(draft, prefill);

      expect(plan.images.orderedUrls).toEqual(['2', '3', '4']);
      expect(Object.keys(plan.images.keptByUrl).sort()).toEqual(['2']);
      expect(mediaUrlsToFetch(plan.images)).toEqual(['3', '4']);

      const fetched: Record<string, MediaFile> = {
        '3': media('3'),
        '4': media('4'),
      };
      expect(buildMergedMediaArray(plan.images, fetched)).toEqual([
        media('2'),
        media('3'),
        media('4'),
      ]);
    });

    it('preserves unmapped media in append mode and removes them on overwrite', () => {
      const screenshot = unmappedMedia('image');
      const draftAppend = draftWithImages([media('1'), screenshot], 'append');
      const draftOverwrite = draftWithImages([media('1'), screenshot], 'overwrite');
      const prefill = { targetWord: 'hello', imageUrls: ['2'] };

      const appendResult = mergePrefillIntoDraft(draftAppend, prefill);
      expect(appendResult.media.images.unmapped).toEqual([screenshot]);

      const overwriteResult = mergePrefillIntoDraft(draftOverwrite, prefill);
      expect(overwriteResult.media.images.unmapped).toEqual([]);
    });

    it('keeps existing items that are still selected and removes deselected ones', () => {
      const draft = draftWithImages([media('1'), media('2'), media('3')], 'append');
      const prefill = { targetWord: 'hello', imageUrls: ['3', '1'] };
      const { media: plan } = mergePrefillIntoDraft(draft, prefill);

      expect(plan.images.orderedUrls).toEqual(['3', '1']);
      expect(Object.keys(plan.images.keptByUrl).sort()).toEqual(['1', '3']);
      expect(mediaUrlsToFetch(plan.images)).toEqual([]);
      expect(buildMergedMediaArray(plan.images, {})).toEqual([media('3'), media('1')]);
    });

    it('diff/merges definitions in append mode', () => {
      const draft: CardDraft = {
        ...makeDraft(),
        mediaUpdateMode: 'append',
        fields: {
          ...makeDraft().fields,
          definitions: '• n. a written work\n\n• v. to reserve',
        },
      };
      const prefill = {
        targetWord: 'hello',
        definitions: '• v. to reserve\n\n• n. a building',
      };
      const { draft: merged } = mergePrefillIntoDraft(draft, prefill);
      expect(merged.fields.definitions).toBe('• v. to reserve\n\n• n. a building');
    });

    it('overwrites definitions', () => {
      const draft: CardDraft = {
        ...makeDraft(),
        mediaUpdateMode: 'overwrite',
        fields: {
          ...makeDraft().fields,
          definitions: '• old',
        },
      };
      const prefill = { targetWord: 'hello', definitions: '• new' };
      const { draft: merged } = mergePrefillIntoDraft(draft, prefill);
      expect(merged.fields.definitions).toBe('• new');
    });

    it('only fills empty fields in skip mode', () => {
      const draft: CardDraft = {
        ...makeDraft(),
        mediaUpdateMode: 'skip',
        fields: {
          ...makeDraft().fields,
          sentence: 'existing sentence',
          images: [media('1')],
        },
      };
      const prefill = {
        targetWord: 'hello',
        sentence: 'new sentence',
        imageUrls: ['2'],
        wordAudioUrls: ['a.mp3'],
      };
      const { draft: merged, media: plan } = mergePrefillIntoDraft(draft, prefill);
      expect(merged.fields.sentence).toBe('existing sentence');
      expect(merged.fields.images).toEqual([media('1')]);
      expect(plan.images.orderedUrls).toEqual(['1']);
      expect(plan.wordAudios.orderedUrls).toEqual(['a.mp3']);
    });

    it('diff/merges audio URLs', () => {
      const draft: CardDraft = {
        ...makeDraft(),
        mediaUpdateMode: 'append',
        fields: {
          ...makeDraft().fields,
          wordAudios: [media('a.mp3', 'audio'), media('b.mp3', 'audio')],
          sentenceAudios: [media('s1.mp3', 'audio')],
        },
      };
      const prefill = {
        targetWord: 'hello',
        wordAudioUrls: ['b.mp3', 'c.mp3'],
        sentenceAudioUrls: ['s2.mp3'],
      };
      const { media: plan } = mergePrefillIntoDraft(draft, prefill);
      expect(plan.wordAudios.orderedUrls).toEqual(['b.mp3', 'c.mp3']);
      expect(mediaUrlsToFetch(plan.wordAudios)).toEqual(['c.mp3']);
      expect(plan.sentenceAudios.orderedUrls).toEqual(['s2.mp3']);
      expect(mediaUrlsToFetch(plan.sentenceAudios)).toEqual(['s2.mp3']);
    });

    it('is idempotent for identical inputs', () => {
      const draft = draftWithImages([media('1'), media('2')], 'append');
      const prefill = { targetWord: 'hello', imageUrls: ['2', '3', '4'] };
      const first = mergePrefillIntoDraft(draft, prefill);
      const withFetched = buildMergedMediaArray(first.media.images, { '3': media('3'), '4': media('4') });
      const secondDraft: CardDraft = { ...draft, fields: { ...draft.fields, images: withFetched } };
      const second = mergePrefillIntoDraft(secondDraft, prefill);
      expect(second.media.images.orderedUrls).toEqual(first.media.images.orderedUrls);
      expect(Object.keys(second.media.images.keptByUrl).sort()).toEqual(['2', '3', '4']);
      expect(mediaUrlsToFetch(second.media.images)).toEqual([]);
    });
  });
});
