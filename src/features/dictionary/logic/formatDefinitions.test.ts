// formatDefinitions test — smallest check that fails if definition formatting breaks.
// Verifies: [pos] head, `-` examples, \n\n between defs, no trailing \n.

import { describe, it, expect } from '@jest/globals';
import { formatDefinitions, parseDefinitionsText } from './formatDefinitions';

describe('formatDefinitions', () => {
  it('formats multiple definitions with [pos] head + \\n\\n', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: 'the way in which two things are connected' },
      { pos: 'noun', text: 'the way in which two or more people feel and behave towards each other' },
    ]);
    expect(result).toBe(
      '[noun] the way in which two things are connected\n\n' +
      '[noun] the way in which two or more people feel and behave towards each other',
    );
  });

  it('handles definition without pos', () => {
    const result = formatDefinitions([
      { text: 'lasting a very short time' },
    ]);
    expect(result).toBe('lasting a very short time');
  });

  it('handles empty array', () => {
    expect(formatDefinitions([])).toBe('');
  });

  it('handles single definition', () => {
    const result = formatDefinitions([
      { pos: 'phrasal verb', text: 'to remove something' },
    ]);
    expect(result).toBe('[phrasal verb] to remove something');
  });

  it('emits labels and level as bracketed tokens after [pos]', () => {
    const result = formatDefinitions([
      { pos: 'verb', labels: ['transitive'], level: 'B1', text: 'to think about something' },
      { labels: ['word origin'], text: '1650s, from take (v.)' },
    ]);
    expect(result).toBe(
      '[verb] [transitive] [B1] to think about something\n\n' +
      '[word origin] 1650s, from take (v.)',
    );
  });

  it('respects selection — only passed defs are included', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: 'first sense' },
      { pos: 'noun', text: 'third sense' },
    ]);
    expect(result).toBe('[noun] first sense\n\n[noun] third sense');
  });

  it('strips leading bullets already present in source text', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: '• an important job' },
      { pos: 'noun', text: ' •  another sense' },
      { pos: 'noun', text: '• • (noun) a group of people' },
    ]);
    expect(result).toBe(
      '[noun] an important job\n\n' +
      '[noun] another sense\n\n' +
      '[noun] (noun) a group of people',
    );
  });

  it('emits selected examples inline as `-` lines under their definition', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: 'first sense', selectedExamples: ['ex one', 'ex two'] },
      { pos: 'verb', text: 'second sense' },
      { pos: 'adj', text: 'third sense', selectedExamples: ['ex three'] },
    ]);
    expect(result).toBe(
      '[noun] first sense\n' +
      '- ex one\n' +
      '- ex two\n\n' +
      '[verb] second sense\n\n' +
      '[adj] third sense\n' +
      '- ex three',
    );
  });

  it('emits relations and subsenses after the gloss with canonical markers', () => {
    const result = formatDefinitions([
      {
        pos: 'verb',
        text: 'to think about something',
        subsenses: [{ num: 'a', text: 'in a particular way' }],
        synonyms: ['associate', 'go by'],
        antonyms: ['bring'],
      },
    ]);
    expect(result).toBe(
      '[verb] to think about something\n' +
      'synonyms and related words: associate, go by\n' +
      'antonyms: bring\n' +
      'a. in a particular way',
    );
  });

  it('emits labeled groups and nested subsense examples/relations', () => {
    const result = formatDefinitions([
      {
        pos: 'adjective',
        text: 'right according to the facts',
        selectedExamples: ['the correct answer'],
        synonymGroups: [{ label: 'Exact and accurate', words: ['nuanced', 'exact'] }],
        subsenses: [
          {
            num: 'b',
            text: 'right according to the established rules',
            selectedExamples: ['a grammatically correct sentence'],
            synonymGroups: [{ label: 'Morally good or correct', words: ['moral', 'right'] }],
          },
        ],
      },
    ]);
    expect(result).toBe(
      '[adjective] right according to the facts\n' +
      '- the correct answer\n' +
      'synonyms and related words: Exact and accurate: nuanced, exact\n' +
      'b. right according to the established rules\n' +
      '- a grammatically correct sentence\n' +
      'synonyms and related words: Morally good or correct: moral, right',
    );
  });

  it('explicit empty selectedExamples emits no example lines', () => {
    const result = formatDefinitions([{ text: 'def', selectedExamples: [] }]);
    expect(result).toBe('def');
  });

  it('does not emit raw dictionary example lists implicitly', () => {
    const defEntry = { pos: 'n', text: 'def', examples: ['leak a', 'leak b'] };
    expect(formatDefinitions([defEntry])).toBe('[n] def');
  });

  it('strips existing `·`/`•`/`-` markers from example text', () => {
    const result = formatDefinitions([
      { text: 'def', selectedExamples: ['· dotted', ' • bulleted', '- dashed', 'plain'] },
    ]);
    expect(result).toBe('def\n- dotted\n- bulleted\n- dashed\n- plain');
  });
});

describe('parseDefinitionsText', () => {
  it('parses [pos]-headed blocks into definition entries', () => {
    const entries = parseDefinitionsText('[noun] first\n\n[verb] second');
    expect(entries).toEqual([
      { text: '[noun] first', selectedExamples: [] },
      { text: '[verb] second', selectedExamples: [] },
    ]);
  });

  it('attaches `-` lines to the preceding definition', () => {
    const entries = parseDefinitionsText('[n] def one\n- ex a\n- ex b\n\n[v] def two\n- ex c');
    expect(entries).toEqual([
      { text: '[n] def one', selectedExamples: ['ex a', 'ex b'] },
      { text: '[v] def two', selectedExamples: ['ex c'] },
    ]);
  });

  it('parses legacy `•`/`·` markers', () => {
    const entries = parseDefinitionsText('• def one\n· ex a\n\n• def two');
    expect(entries).toEqual([
      { text: 'def one', selectedExamples: ['ex a'] },
      { text: 'def two', selectedExamples: [] },
    ]);
  });

  it('continues multi-line glosses inside one entry', () => {
    const entries = parseDefinitionsText('[v] gloss line one\ngloss line two\n- ex');
    expect(entries).toEqual([
      { text: '[v] gloss line one\ngloss line two', selectedExamples: ['ex'] },
    ]);
  });

  it('orphan `-` line degrades to a clean definition entry', () => {
    const entries = parseDefinitionsText('- stray example');
    expect(entries).toEqual([{ text: 'stray example', selectedExamples: [] }]);
  });

  it('round-trips through formatDefinitions', () => {
    const text = formatDefinitions([
      { pos: 'n', text: 'def one', selectedExamples: ['ex a'] },
      { text: 'def two' },
    ]);
    expect(formatDefinitions(parseDefinitionsText(text))).toBe(text);
  });
});
