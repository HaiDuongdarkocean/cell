// quickAddAssembler tests — spec §9.2, D7.

import { describe, expect, it } from '@jest/globals';
import {
  assembleQuickAddPayload,
  buildAnkiNoteFields,
  formatDefinitions,
  isAutoCompleteEnabled,
} from './quickAddAssembler';
import type { LookupResult, DefinitionEntry, WordStatus } from '../types';
import type { CardCreatorSettings } from '@/entities/settings/types';

function makeDef(overrides: Partial<DefinitionEntry> = {}): DefinitionEntry {
  return {
    id: 'd1',
    pos: 'verb',
    text: 'to remove something',
    examples: ['Take off your shoes.'],
    source: 'Cambridge',
    defaultSelected: true,
    ...overrides,
  };
}

function makeResult(overrides: Partial<LookupResult> = {}): LookupResult {
  return {
    term: 'take off',
    langCode: 'en',
    reading: '/teɪk ɒf/',
    readingKind: 'ipa',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: ['verb'],
    definitions: [makeDef()],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<CardCreatorSettings> = {}): CardCreatorSettings {
  return {
    ankiConnectUrl: 'http://localhost:8765',
    defaultDeck: 'Default',
    defaultNoteType: 'Cell Video Card',
    defaultTags: '',
    mediaUpdateMode: 'overwrite',
    autoCompleteToggles: {
      definitions: true,
      wordAudios: true,
      sentenceAudios: true,
      images: true,
      sentenceTranslation: true,
      sentence: true,
    },
    audioFallback: 'community-then-tts',
    ...overrides,
  };
}

describe('formatDefinitions', () => {
  it('formats a single definition with pos + examples', () => {
    const defs = [makeDef()];
    const result = formatDefinitions(defs);
    expect(result).toContain('verb. to remove something');
    expect(result).toContain('• Take off your shoes.');
  });

  it('formats without pos when absent', () => {
    const defs = [makeDef({ pos: undefined })];
    const result = formatDefinitions(defs);
    expect(result).toBe('to remove something\n  • Take off your shoes.');
  });

  it('joins multiple definitions with newline', () => {
    const defs = [makeDef({ id: 'd1' }), makeDef({ id: 'd2', text: 'to leave the ground' })];
    const result = formatDefinitions(defs);
    expect(result).toContain('to remove something');
    expect(result).toContain('to leave the ground');
  });

  it('formats without examples', () => {
    const defs = [makeDef({ examples: [] })];
    const result = formatDefinitions(defs);
    expect(result).toBe('verb. to remove something');
  });
});

describe('assembleQuickAddPayload', () => {
  it('assembles payload with all fields', () => {
    const result = makeResult();
    const selection = {
      definitions: new Map([['d1', true]]),
      audios: new Map<string, boolean>(),
      images: new Map<string, boolean>(),
    };
    const payload = assembleQuickAddPayload(
      result,
      selection,
      'Please take off your shoes.',
      'Vui lòng bỏ giày ra.',
      'tracking' as WordStatus,
      makeSettings(),
    );
    expect(payload.term).toBe('take off');
    expect(payload.langCode).toBe('en');
    expect(payload.definitions).toHaveLength(1);
    expect(payload.sentence).toBe('Please take off your shoes.');
    expect(payload.translation).toBe('Vui lòng bỏ giày ra.');
    expect(payload.status).toBe('tracking');
    expect(payload.destination).toBe('anki');
  });

  it('respects auto-complete OFF for definitions', () => {
    const result = makeResult({
      definitions: [makeDef({ id: 'd1', defaultSelected: true }), makeDef({ id: 'd2', defaultSelected: true })],
    });
    const selection = {
      definitions: new Map([['d1', true], ['d2', false]]),
      audios: new Map<string, boolean>(),
      images: new Map<string, boolean>(),
    };
    // definitions auto-complete OFF → only user-ticked (d1=true, d2=false → only d1)
    const settings = makeSettings({
      autoCompleteToggles: {
        definitions: false,
        wordAudios: true,
        sentenceAudios: true,
        images: true,
        sentenceTranslation: true,
        sentence: true,
      },
    });
    const payload = assembleQuickAddPayload(result, selection, 'sentence', '', 'unknown', settings);
    // d2 was explicitly set to false, so it should be excluded
    expect(payload.definitions).toHaveLength(1);
    expect(payload.definitions[0]!.id).toBe('d1');
  });

  it('auto-complete ON includes defaultSelected items', () => {
    const result = makeResult({
      definitions: [makeDef({ id: 'd1', defaultSelected: true }), makeDef({ id: 'd2', defaultSelected: false })],
    });
    const selection = {
      definitions: new Map<string, boolean>(), // empty → fallback to defaultSelected
      audios: new Map<string, boolean>(),
      images: new Map<string, boolean>(),
    };
    const payload = assembleQuickAddPayload(result, selection, 'sentence', '', 'unknown', makeSettings());
    expect(payload.definitions).toHaveLength(1);
    expect(payload.definitions[0]!.id).toBe('d1');
  });

  it('auto-complete OFF for sentence → empty sentence', () => {
    const result = makeResult();
    const selection = {
      definitions: new Map([['d1', true]]),
      audios: new Map<string, boolean>(),
      images: new Map<string, boolean>(),
    };
    const settings = makeSettings({
      autoCompleteToggles: {
        definitions: true,
        wordAudios: true,
        sentenceAudios: true,
        images: true,
        sentenceTranslation: true,
        sentence: false,
      },
    });
    const payload = assembleQuickAddPayload(result, selection, 'sentence text', '', 'unknown', settings);
    expect(payload.sentence).toBe('');
  });

  it('auto-complete OFF for translation → empty translation', () => {
    const result = makeResult();
    const selection = {
      definitions: new Map([['d1', true]]),
      audios: new Map<string, boolean>(),
      images: new Map<string, boolean>(),
    };
    const settings = makeSettings({
      autoCompleteToggles: {
        definitions: true,
        wordAudios: true,
        sentenceAudios: true,
        images: true,
        sentenceTranslation: false,
        sentence: true,
      },
    });
    const payload = assembleQuickAddPayload(result, selection, 'sentence', 'translation text', 'unknown', settings);
    expect(payload.translation).toBe('');
  });
});

describe('buildAnkiNoteFields', () => {
  it('maps payload fields to Anki note fields', () => {
    const payload = {
      term: 'take off',
      langCode: 'en',
      definitions: [makeDef()],
      audios: [],
      images: [],
      translation: 'bỏ giày',
      sentence: 'Take off your shoes.',
      status: 'tracking' as WordStatus,
      destination: 'anki' as const,
    };
    const mapping = {
      Front: 'term',
      Back: 'definitions',
      Sentence: 'sentence',
      Translation: 'translation',
    };
    const fields = buildAnkiNoteFields(payload, mapping);
    expect(fields['Front']).toBe('take off');
    expect(fields['Back']).toContain('verb. to remove something');
    expect(fields['Sentence']).toBe('Take off your shoes.');
    expect(fields['Translation']).toBe('bỏ giày');
  });

  it('skips None mapping', () => {
    const payload = {
      term: 'test',
      langCode: 'en',
      definitions: [],
      audios: [],
      images: [],
      translation: '',
      sentence: '',
      status: 'unknown' as WordStatus,
      destination: 'anki' as const,
    };
    const mapping = { Front: 'term', Back: 'None' };
    const fields = buildAnkiNoteFields(payload, mapping);
    expect(fields['Front']).toBe('test');
    expect(fields['Back']).toBeUndefined();
  });
});

describe('isAutoCompleteEnabled', () => {
  it('returns true when toggle is true', () => {
    const settings = makeSettings();
    expect(isAutoCompleteEnabled('definitions', settings)).toBe(true);
  });

  it('returns false when toggle is false', () => {
    const settings = makeSettings({
      autoCompleteToggles: {
        definitions: false,
        wordAudios: true,
        sentenceAudios: true,
        images: true,
        sentenceTranslation: true,
        sentence: true,
      },
    });
    expect(isAutoCompleteEnabled('definitions', settings)).toBe(false);
  });

  it('defaults to true when toggles undefined', () => {
    const settings = makeSettings({ autoCompleteToggles: undefined });
    expect(isAutoCompleteEnabled('definitions', settings)).toBe(true);
  });
});
