import { describe, it, expect } from '@jest/globals';
import type { LookupResult, DefinitionEntry } from '@/entities/dictionary';
import {
  initExampleSelection,
  getSelectedExamples,
  toSelectedExampleIds,
} from './definitionSelection';

function makeDef(id: string, examples: readonly string[]): DefinitionEntry {
  return { id, text: `def ${id}`, examples, source: 'test', defaultSelected: true };
}

function makeResult(defs: DefinitionEntry[]): LookupResult {
  return {
    term: 'w',
    langCode: 'en',
    reading: '',
    readingKind: 'ipa',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: [],
    definitions: defs,
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
  };
}

describe('initExampleSelection', () => {
  const result = makeResult([
    makeDef('def-0', ['ex a', 'ex b', 'ex c']),
    makeDef('def-1', ['ex d']),
    makeDef('def-2', []),
  ]);

  it('applies defId:index ids verbatim', () => {
    const sel = initExampleSelection(result, ['def-0:2', 'def-0:0', 'def-1:0']);
    expect(sel.get('def-0')).toEqual(new Set([0, 2]));
    expect(sel.get('def-1')).toEqual(new Set([0]));
  });

  it('undefined snapshot → empty selection', () => {
    expect(initExampleSelection(result).size).toBe(0);
  });

  it('explicit empty array → empty selection (zero examples, not defaults)', () => {
    expect(initExampleSelection(result, []).size).toBe(0);
  });

  it('drops orphans: unknown def, out-of-range index, malformed id', () => {
    const sel = initExampleSelection(result, [
      'def-9:0', 'def-0:3', 'def-0:-1', 'def-0:x', 'noidx', ':1',
      'def-2:0', 'def-0:1',
    ]);
    expect(sel.size).toBe(1);
    expect(sel.get('def-0')).toEqual(new Set([1]));
  });
});

describe('getSelectedExamples', () => {
  const def = makeDef('def-0', ['a', 'b', 'c']);

  it('returns selected texts in source order regardless of set insertion order', () => {
    const sel = new Map([['def-0', new Set([2, 0])]]);
    expect(getSelectedExamples(def, sel)).toEqual(['a', 'c']);
  });

  it('empty/missing selection → []', () => {
    expect(getSelectedExamples(def, new Map())).toEqual([]);
    expect(getSelectedExamples(def, new Map([['def-0', new Set<number>()]]))).toEqual([]);
  });
});

describe('toSelectedExampleIds', () => {
  const defs = [
    makeDef('def-0', ['a', 'b']),
    makeDef('def-1', ['c', 'd', 'e']),
  ];

  it('emits composite ids in def order then index order', () => {
    const sel = new Map([
      ['def-1', new Set([2, 0])],
      ['def-0', new Set([1])],
    ]);
    expect(toSelectedExampleIds(defs, sel)).toEqual(['def-0:1', 'def-1:0', 'def-1:2']);
  });

  it('selection for a def not in defs is not emitted', () => {
    const sel = new Map([['def-9', new Set([0])]]);
    expect(toSelectedExampleIds(defs, sel)).toEqual([]);
  });
});
