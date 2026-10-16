import { describe, expect, it } from '@jest/globals';
import { parseBreakdown } from './breakdown';

describe('parseBreakdown', () => {
  it('groups numbered triplets into chunks', () => {
    const text =
      '#1 The quick brown fox #2 A fast, reddish-brown wild animal ' +
      '#3 The is a definite article identifying a specific fox. ' +
      '#4 jumps over #5 leaps across #6 present-tense verb describing the action.';
    const chunks = parseBreakdown(text);
    expect(chunks).toEqual([
      {
        text: 'The quick brown fox',
        meaning: 'A fast, reddish-brown wild animal',
        explanation: 'The is a definite article identifying a specific fox.',
      },
      {
        text: 'jumps over',
        meaning: 'leaps across',
        explanation: 'present-tense verb describing the action.',
      },
    ]);
  });

  it('parses multiline output', () => {
    const text = `#1 Execute the program
#2 Start or perform the software
#3 "Execute" is a command to begin running a program.
#4 Run the code
#5 Execute the set of written instructions
#6 "Run" means to start or operate software.`;
    const chunks = parseBreakdown(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('Execute the program');
    expect(chunks[1].explanation).toBe('"Run" means to start or operate software.');
  });

  it('strips leaked labels', () => {
    const text = '#1 Chunk: hello #2 Meaning: greeting #3 Explanation: a salutation';
    // Only one chunk — unparseable (< 2 chunks) so labels path also covers fallback.
    expect(parseBreakdown(text)).toEqual([]);
    const two = '#1 Chunk: hello #2 Meaning: greeting #3 Explanation: a salutation #4 bye #5 farewell #6 a goodbye';
    expect(parseBreakdown(two)[0]).toEqual({
      text: 'hello',
      meaning: 'greeting',
      explanation: 'a salutation',
    });
  });

  it('tolerates a missing trailing explanation', () => {
    const text = '#1 foo bar #2 something #3 note here #4 baz qux #5 other thing';
    const chunks = parseBreakdown(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toEqual({ text: 'baz qux', meaning: 'other thing', explanation: undefined });
  });

  it('returns empty for plain prose', () => {
    expect(parseBreakdown('This is just a normal answer without numbers.')).toEqual([]);
    expect(parseBreakdown('#1 only one chunk')).toEqual([]);
    expect(parseBreakdown('')).toEqual([]);
  });
});
