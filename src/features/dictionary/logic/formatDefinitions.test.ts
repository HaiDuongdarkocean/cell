// formatDefinitions test — smallest check that fails if definition formatting breaks.
// Verifies: • prefix, pos + text, \n\n between defs, no trailing \n.

import { describe, it, expect } from '@jest/globals';
import { formatDefinitions, parseDefinitionsText } from './formatDefinitions';

describe('formatDefinitions', () => {
  it('formats multiple definitions with bullet + pos + \\n\\n', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: 'the way in which two things are connected' },
      { pos: 'noun', text: 'the way in which two or more people feel and behave towards each other' },
    ]);
    expect(result).toBe(
      '• noun the way in which two things are connected\n\n' +
      '• noun the way in which two or more people feel and behave towards each other',
    );
  });

  it('handles definition without pos', () => {
    const result = formatDefinitions([
      { text: 'lasting a very short time' },
    ]);
    expect(result).toBe('• lasting a very short time');
  });

  it('handles empty array', () => {
    expect(formatDefinitions([])).toBe('');
  });

  it('handles single definition', () => {
    const result = formatDefinitions([
      { pos: 'phrasal verb', text: 'to remove something' },
    ]);
    expect(result).toBe('• phrasal verb to remove something');
  });

  it('respects selection — only passed defs are included', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: 'first sense' },
      { pos: 'noun', text: 'third sense' },
    ]);
    expect(result).toBe('• noun first sense\n\n• noun third sense');
  });

  it('strips leading bullets already present in source text', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: '• an important job' },
      { pos: 'noun', text: ' •  another sense' },
      { pos: 'noun', text: '• • (noun) a group of people' },
    ]);
    expect(result).toBe(
      '• noun an important job\n\n' +
      '• noun another sense\n\n' +
      '• noun (noun) a group of people',
    );
  });

  it('emits selected examples inline as `·` lines under their definition', () => {
    const result = formatDefinitions([
      { pos: 'noun', text: 'first sense', selectedExamples: ['ex one', 'ex two'] },
      { pos: 'verb', text: 'second sense' },
      { pos: 'adj', text: 'third sense', selectedExamples: ['ex three'] },
    ]);
    expect(result).toBe(
      '• noun first sense\n' +
      '· ex one\n' +
      '· ex two\n\n' +
      '• verb second sense\n\n' +
      '• adj third sense\n' +
      '· ex three',
    );
  });

  it('explicit empty selectedExamples emits no example lines', () => {
    const result = formatDefinitions([{ text: 'def', selectedExamples: [] }]);
    expect(result).toBe('• def');
  });

  it('does not emit raw dictionary example lists implicitly', () => {
    const defEntry = { pos: 'n', text: 'def', examples: ['leak a', 'leak b'] };
    expect(formatDefinitions([defEntry])).toBe('• n def');
  });

  it('strips existing `·`/`•` markers from example text', () => {
    const result = formatDefinitions([
      { text: 'def', selectedExamples: ['· dotted', ' • bulleted', 'plain'] },
    ]);
    expect(result).toBe('• def\n· dotted\n· bulleted\n· plain');
  });
});

describe('parseDefinitionsText', () => {
  it('parses `•` lines into definition entries', () => {
    const entries = parseDefinitionsText('• noun first\n\n• verb second');
    expect(entries).toEqual([
      { text: '• noun first', selectedExamples: [] },
      { text: '• verb second', selectedExamples: [] },
    ]);
  });

  it('attaches `·` lines to the preceding definition', () => {
    const entries = parseDefinitionsText('• def one\n· ex a\n· ex b\n\n• def two\n· ex c');
    expect(entries).toEqual([
      { text: '• def one', selectedExamples: ['ex a', 'ex b'] },
      { text: '• def two', selectedExamples: ['ex c'] },
    ]);
  });

  it('orphan `·` line degrades to a clean definition entry', () => {
    const entries = parseDefinitionsText('· stray example');
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
