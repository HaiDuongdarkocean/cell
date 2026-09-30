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
  it('keeps all definition texts and ticked examples inside the def entry', () => {
    const fields = buildSrsFieldsFromPrefill(makePrefill([
      { pos: 'n', text: 'def one', selectedExamples: ['ex a', 'ex b'] },
      { pos: 'v', text: 'def two', selectedExamples: ['ex c'] },
    ]));
    expect(fields['def']).toEqual({
      kind: 'text',
      value: 'Hello\n• n def one\nex a\nex b\n\n• v def two\nex c',
    });
    expect(fields['examples']).toBeUndefined();
  });

  it('def-only selection ships no example sentences', () => {
    const fields = buildSrsFieldsFromPrefill(makePrefill([
      { text: 'def one', selectedExamples: [] },
    ]));
    expect(fields['def']).toEqual({ kind: 'text', value: 'Hello\n• def one' });
    expect(fields['examples']).toBeUndefined();
  });
});
