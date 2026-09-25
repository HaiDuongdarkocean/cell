import { describe, expect, it } from '@jest/globals';
import { buildSrsFieldsFromPrefill } from './addToOceanSrs';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';

function makePrefill(definitions: PopupCardCreatorPrefill['definitions']): PopupCardCreatorPrefill {
  return {
    term: 'hello',
    langCode: 'en',
    reading: '',
    definitions,
    rawDefinitions: [],
    contextSentence: '',
  };
}

describe('buildSrsFieldsFromPrefill', () => {
  it('keeps all definition texts and appends ticked example sentences', () => {
    const fields = buildSrsFieldsFromPrefill(makePrefill([
      { pos: 'n', text: 'def one', selectedExamples: ['ex a', 'ex b'] },
      { pos: 'v', text: 'def two', selectedExamples: ['ex c'] },
    ]));
    expect(fields['def']).toEqual({ kind: 'text', value: 'def one' });
    expect(fields['examples']).toEqual({
      kind: 'list',
      value: ['def one', 'def two', 'ex a', 'ex b', 'ex c'],
    });
  });

  it('def-only selection ships no example sentences', () => {
    const fields = buildSrsFieldsFromPrefill(makePrefill([
      { text: 'def one', selectedExamples: [] },
    ]));
    expect(fields['examples']).toEqual({ kind: 'list', value: ['def one'] });
  });
});
