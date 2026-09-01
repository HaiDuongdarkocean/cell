import {
  COMPONENT_TYPES,
  FUTURE_ISO,
  audioAssetId,
  escapeRegExp,
  generateId,
  imageAssetId,
  isDataUrl,
  mapDictionaryToSrsFields,
  minISO,
  normalizeSpelling,
} from './helpers';

describe('srs helpers', () => {
  describe('normalizeSpelling', () => {
    it('lowercases, trims, and collapses whitespace', () => {
      expect(normalizeSpelling('  Hello   World  ')).toBe('hello world');
    });

    it('strips leading and trailing punctuation/whitespace', () => {
      expect(normalizeSpelling('!!!Hello, World!!!')).toBe('hello, world');
    });

    it('leaves internal punctuation intact', () => {
      expect(normalizeSpelling('"well-being"')).toBe('well-being');
    });

    it('normalizes a simple word with punctuation around it', () => {
      expect(normalizeSpelling('  "hello"...  ')).toBe('hello');
      expect(normalizeSpelling("  don't!  ")).toBe("don't");
    });
  });

  describe('minISO', () => {
    it('returns the earliest ISO string', () => {
      const a = '2026-09-01T00:00:00.000Z';
      const b = '2025-12-31T00:00:00.000Z';
      const c = '2026-01-01T00:00:00.000Z';
      expect(minISO(a, b, c)).toBe(b);
    });

    it('returns the first value when it is earliest', () => {
      const earliest = '2020-01-01T00:00:00.000Z';
      expect(minISO(earliest, '2025-01-01T00:00:00.000Z')).toBe(earliest);
    });

    it('falls back to FUTURE_ISO when given no values', () => {
      expect(minISO()).toBe(FUTURE_ISO);
    });
  });

  describe('escapeRegExp', () => {
    it('escapes all regex metacharacters', () => {
      const input = 'a.b*c+d?e^f$g(h)i[j]k|l\\m';
      const escaped = escapeRegExp(input);
      expect(new RegExp(escaped).test(input)).toBe(true);
    });

    it('does not alter plain text', () => {
      expect(escapeRegExp('hello world')).toBe('hello world');
    });
  });

  describe('isDataUrl', () => {
    it('returns true for data URLs', () => {
      expect(isDataUrl('data:image/png;base64,abc')).toBe(true);
    });

    it('returns false for regular URLs', () => {
      expect(isDataUrl('https://example.com/image.png')).toBe(false);
      expect(isDataUrl('')).toBe(false);
    });
  });

  describe('asset id helpers', () => {
    it('audioAssetId is deterministic and depends on all inputs', () => {
      const a = audioAssetId('note-1', 'wordAudio', 'pronunciation');
      const b = audioAssetId('note-1', 'wordAudio', 'pronunciation');
      const c = audioAssetId('note-1', 'wordAudio', 'tts');
      expect(a).toBe(b);
      expect(a).not.toBe(c);
      expect(typeof a).toBe('string');
      expect(a.length).toBeGreaterThan(0);
    });

    it('imageAssetId is deterministic and depends on note + field', () => {
      const a = imageAssetId('note-1', 'image');
      const b = imageAssetId('note-1', 'image');
      const c = imageAssetId('note-2', 'image');
      expect(a).toBe(b);
      expect(a).not.toBe(c);
    });
  });

  describe('generateId', () => {
    it('returns a non-empty string without whitespace', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(id).not.toMatch(/\s/);
    });

    it('produces distinct ids on successive calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(10);
    });

    it('produces a UUID-shaped or fallback hyphenated string', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9]+-[a-z0-9]+$/i);
    });
  });

  describe('COMPONENT_TYPES', () => {
    it('lists the three component types in default order', () => {
      expect(COMPONENT_TYPES).toEqual(['sound', 'meaning', 'spelling']);
    });
  });

  describe('mapDictionaryToSrsFields', () => {
    it('maps a dictionary result to the default notetype fields', () => {
      const notetype = {
        id: 'nt-1',
        collectionId: 'col-1',
        name: 'Word',
        targetFieldId: 'target',
        fields: [
          { id: 'target', name: 'Target word', order: 0, type: 'text' as const },
          { id: 'sentence', name: 'Sentence', order: 1, type: 'text' as const },
          { id: 'def', name: 'Definition', order: 2, type: 'text' as const },
          { id: 'wordAudio', name: 'Word audio', order: 3, type: 'audio' as const },
          { id: 'translation', name: 'Translation', order: 4, type: 'translation' as const },
        ],
        frontTemplates: [],
        backTemplate: { fieldIds: [], showAll: true },
      };

      const result = {
        term: 'abandon',
        sentence: 'He abandoned the project.',
        definitions: ['to leave behind', 'to give up'],
        audioUrl: 'https://example.com/abandon.mp3',
        translation: 'từ bỏ',
      };

      const fields = mapDictionaryToSrsFields(notetype, result);

      expect(fields.target).toEqual({ kind: 'text', value: 'abandon' });
      expect(fields.sentence).toEqual({ kind: 'text', value: 'He abandoned the project.' });
      expect(fields.def).toEqual({ kind: 'text', value: 'to leave behind' });
      expect(fields.wordAudio).toEqual({
        kind: 'audio',
        value: 'https://example.com/abandon.mp3',
        source: 'pronunciation',
      });
      expect(fields.translation).toEqual({ kind: 'translation', value: 'từ bỏ' });
    });

    it('skips fields that are not present in the notetype', () => {
      const notetype = {
        id: 'nt-1',
        collectionId: 'col-1',
        name: 'Word',
        targetFieldId: 'target',
        fields: [{ id: 'target', name: 'Target word', order: 0, type: 'text' as const }],
        frontTemplates: [],
        backTemplate: { fieldIds: [], showAll: true },
      };

      const fields = mapDictionaryToSrsFields(notetype, { term: 'hello' });
      expect(fields).toEqual({ target: { kind: 'text', value: 'hello' } });
    });
  });
});
