// formatDefinitions test — smallest check that fails if definition formatting breaks.
// Verifies: • prefix, pos + text, \n\n between defs, no trailing \n.

import { describe, it, expect } from '@jest/globals';
import { formatDefinitions } from './webTextDictionaryController';

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
});
