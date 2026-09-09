import { describe, expect, it } from '@jest/globals';
import { canGenerateField, canGenerateAnyField, getFieldGenerationOrder, fieldDependencies } from './fieldDependency';
import type { CardCreatorOpenContext } from '../types';
import type { CardFields } from './cardDraft';

const baseFields: CardFields = {
  targetWord: '',
  sentence: '',
  sentenceTranslation: '',
  definitions: '',
  images: [],
  sentenceAudios: [],
  wordAudios: [],
  note: '',
  moreExample: '',
};

const ctx = (prefill?: CardCreatorOpenContext['prefill'], cue?: CardCreatorOpenContext['cue']): CardCreatorOpenContext => ({
  sourceLang: 'en',
  targetLang: 'vi',
  prefill,
  cue,
});

describe('fieldDependency', () => {
  describe('getFieldGenerationOrder', () => {
    it('places target word first and sentence before sentence audio', () => {
      const order = getFieldGenerationOrder();
      expect(order[0]).toBe('targetWord');
      const sentenceIndex = order.indexOf('sentence');
      const sentenceAudioIndex = order.indexOf('sentenceAudios');
      expect(sentenceIndex).toBeGreaterThan(-1);
      expect(sentenceAudioIndex).toBeGreaterThan(sentenceIndex);
    });

    it('contains every field exactly once', () => {
      const order = getFieldGenerationOrder();
      const keys = Object.keys(fieldDependencies) as (keyof CardFields)[];
      expect(order).toHaveLength(keys.length);
      for (const key of keys) {
        expect(order).toContain(key);
      }
    });
  });

  describe('canGenerateField', () => {
    it('allows target word only when prefill has a target', () => {
      expect(canGenerateField('targetWord', ctx(), baseFields).ok).toBe(false);
      expect(canGenerateField('targetWord', ctx({ targetWord: 'book' }), baseFields).ok).toBe(true);
    });

    it('requires target word for sentence generation', () => {
      const cueCtx = ctx(undefined, { targetText: 'This is a sentence.', nativeText: '', index: 0, start: 0, end: 19 });
      expect(canGenerateField('sentence', cueCtx, baseFields).ok).toBe(false);

      const withTarget = { ...baseFields, targetWord: 'book' };
      expect(canGenerateField('sentence', cueCtx, withTarget).ok).toBe(true);
    });

    it('requires target word and a source for sentence translation', () => {
      const withTarget = { ...baseFields, targetWord: 'book' };
      expect(canGenerateField('sentenceTranslation', ctx(), withTarget).ok).toBe(false);

      const cueCtx = ctx(undefined, { targetText: 'This is a sentence.', nativeText: 'Đây là một câu.', index: 0, start: 0, end: 19 });
      expect(canGenerateField('sentenceTranslation', cueCtx, withTarget).ok).toBe(true);
    });

    it('allows sentence translation from a translated sentence when no direct source', () => {
      const withTargetAndSentence = { ...baseFields, targetWord: 'book', sentence: 'This is a sentence.' };
      expect(canGenerateField('sentenceTranslation', ctx(), withTargetAndSentence).ok).toBe(true);
    });

    it('disables sentence audio when sentence is empty even if audio urls exist', () => {
      const prefillCtx = ctx({
        targetWord: 'book',
        sentenceAudioUrls: ['audio.mp3'],
      });
      expect(canGenerateField('sentenceAudios', prefillCtx, baseFields).ok).toBe(false);

      const withSentence = { ...baseFields, targetWord: 'book', sentence: 'This is a sentence.' };
      expect(canGenerateField('sentenceAudios', prefillCtx, withSentence).ok).toBe(true);
    });

    it('requires target word for media fields', () => {
      const imageCtx = ctx({ imageUrls: ['img.png'] });
      expect(canGenerateField('images', imageCtx, baseFields).ok).toBe(false);

      const withTarget = { ...baseFields, targetWord: 'book' };
      expect(canGenerateField('images', imageCtx, withTarget).ok).toBe(true);
    });

    it('considers a user-typed target word as a valid target', () => {
      const withTarget = { ...baseFields, targetWord: 'book' };
      expect(canGenerateField('definitions', ctx({ definitions: 'noun' }), withTarget).ok).toBe(true);
      expect(canGenerateField('note', ctx({ note: 'note' }), withTarget).ok).toBe(true);
    });
  });

  describe('canGenerateAnyField', () => {
    it('returns false when nothing can be generated', () => {
      expect(canGenerateAnyField(ctx(), baseFields).ok).toBe(false);
    });

    it('returns true when at least one field is feasible', () => {
      const withTarget = { ...baseFields, targetWord: 'book' };
      const prefillCtx = ctx({
        definitions: 'noun',
        moreExample: 'Example',
      });
      expect(canGenerateAnyField(prefillCtx, withTarget).ok).toBe(true);
    });

    it('returns false when every field is already filled', () => {
      const filled: CardFields = {
        targetWord: 'book',
        sentence: 'A sentence.',
        sentenceTranslation: 'Bản dịch.',
        definitions: 'noun',
        images: [{ kind: 'image', filename: 'x.png', mimeType: 'image/png', data: new ArrayBuffer(0) }],
        sentenceAudios: [{ kind: 'audio', filename: 'x.mp3', mimeType: 'audio/mpeg', data: new ArrayBuffer(0) }],
        wordAudios: [{ kind: 'audio', filename: 'y.mp3', mimeType: 'audio/mpeg', data: new ArrayBuffer(0) }],
        note: 'note',
        moreExample: 'more',
      };
      expect(canGenerateAnyField(ctx(), filled).ok).toBe(false);
    });
  });
});
