// sendToCreator tests — spec §4.6 P1.2: Send to Creator workspace.

import { describe, expect, it } from '@jest/globals';
import {
  extractPrefill,
  buildDefinitionsText,
} from './sendToCreator';
import type { LookupResult } from '../types';

function makeResult(): LookupResult {
  return {
    term: 'take off',
    langCode: 'en',
    reading: '/teɪk ɒf/',
    readingKind: 'ipa',
    frequency: { rank: 1234, source: 'frequency' },
    status: 'unknown',
    partsOfSpeech: ['verb', 'phrasal verb'],
    definitions: [
      { id: 'def-0', pos: 'verb', text: 'to remove something', examples: ['Take off your shoes.'], source: 'Cambridge', defaultSelected: true },
      { id: 'def-1', pos: 'phrasal verb', text: 'to leave the ground', examples: [], source: 'Cambridge', defaultSelected: true },
    ],
    detectedPhrase: null,
    matchSource: 'dictionary',
  };
}

describe('extractPrefill', () => {
  it('extracts prefill from lookup result with all definitions selected', () => {
    const result = makeResult();
    const selection = new Map([['def-0', true], ['def-1', true]]);
    const prefill = extractPrefill(result, selection, 'The plane took off.', undefined, undefined, undefined);
    expect(prefill.term).toBe('take off');
    expect(prefill.langCode).toBe('en');
    expect(prefill.reading).toBe('/teɪk ɒf/');
    expect(prefill.definitions).toHaveLength(2);
    expect(prefill.definitions[0]!.text).toBe('to remove something');
    expect(prefill.definitions[0]!.pos).toBe('verb');
  });

  it('filters out unselected definitions', () => {
    const result = makeResult();
    const selection = new Map([['def-0', true], ['def-1', false]]);
    const prefill = extractPrefill(result, selection, 'The plane took off.');
    expect(prefill.definitions).toHaveLength(1);
    expect(prefill.definitions[0]!.text).toBe('to remove something');
  });

  it('includes translation when provided', () => {
    const result = makeResult();
    const selection = new Map([['def-0', true], ['def-1', true]]);
    const prefill = extractPrefill(result, selection, 'The plane took off.', 'Cất cánh');
    expect(prefill.translation).toBe('Cất cánh');
  });

  it('includes audio/image URLs when provided', () => {
    const result = makeResult();
    const selection = new Map([['def-0', true], ['def-1', true]]);
    const prefill = extractPrefill(result, selection, 'test', undefined, ['https://example.com/audio.mp3'], ['https://example.com/img.jpg']);
    expect(prefill.audioUrls).toEqual(['https://example.com/audio.mp3']);
    expect(prefill.imageUrls).toEqual(['https://example.com/img.jpg']);
  });
});

describe('buildDefinitionsText', () => {
  it('builds text with pos prefix', () => {
    const text = buildDefinitionsText([
      { pos: 'verb', text: 'to remove' },
      { pos: 'noun', text: 'a departure' },
    ]);
    expect(text).toBe('(verb) to remove\n(noun) a departure');
  });

  it('builds text without pos when missing', () => {
    const text = buildDefinitionsText([
      { text: 'definition 1' },
      { text: 'definition 2' },
    ]);
    expect(text).toBe('definition 1\ndefinition 2');
  });

  it('handles mixed pos/no-pos', () => {
    const text = buildDefinitionsText([
      { pos: 'verb', text: 'to remove' },
      { text: 'no pos' },
    ]);
    expect(text).toBe('(verb) to remove\nno pos');
  });

  it('handles empty list', () => {
    expect(buildDefinitionsText([])).toBe('');
  });
});
