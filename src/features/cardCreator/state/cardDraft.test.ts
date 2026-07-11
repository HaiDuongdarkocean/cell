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
} from './cardDraft';
import type { CardDraft } from './cardDraft';

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
    it('round-trips text fields + mapping + tags + mode', () => {
      const draft = makeDraft();
      const serialized = serializeDraft(draft);
      const restored = deserializeDraft(serialized);
      expect(restored.noteType).toBe('Cell Video Card');
      expect(restored.deck).toBe('Default');
      expect(restored.fields.targetWord).toBe('hello');
      expect(restored.fields.sentence).toBe('Hello world.');
      expect(restored.fields.note).toBe('my note');
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
      // Serialized fields have no images key.
      expect((serialized.fields as Record<string, unknown>).images).toBeUndefined();
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
      autosaver.schedule({ ...draft, fields: { ...draft.fields, targetWord: 'world' } });
      // Wait 100ms — should NOT have saved yet (debounced).
      await new Promise((r) => setTimeout(r, 100));
      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
      await autosaver.flush();
      expect((storage[DRAFT_STORAGE_KEY] as { fields: { targetWord: string } }).fields.targetWord).toBe('world');
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

    it('load restores a saved draft', async () => {
      const autosaver = new DraftAutosaver();
      const draft = makeDraft();
      autosaver.schedule(draft);
      await autosaver.flush();
      const restored = await autosaver.load();
      expect(restored?.noteType).toBe('Cell Video Card');
      expect(restored?.fields.targetWord).toBe('hello');
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
});
