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

  it('parses XML chunk blocks (current prompt contract)', () => {
    const text = `<chunk>
<text>the cat</text>
<meaning>con mèo</meaning>
<explanation>Cụm danh từ làm chủ ngữ.</explanation>
</chunk>
<chunk>
<text>sat</text>
<meaning>ngồi xuống</meaning>
<explanation>Động từ thì quá khứ đơn.</explanation>
</chunk>`;
    const chunks = parseBreakdown(text);
    expect(chunks).toEqual([
      { text: 'the cat', meaning: 'con mèo', explanation: 'Cụm danh từ làm chủ ngữ.' },
      { text: 'sat', meaning: 'ngồi xuống', explanation: 'Động từ thì quá khứ đơn.' },
    ]);
  });

  it('parses a trailing open chunk mid-stream', () => {
    const text = `<chunk><text>a</text><meaning>x</meaning><explanation>y</explanation></chunk>
<chunk><text>b</text><meaning>z</meaning><explanation>in progress`;
    const chunks = parseBreakdown(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].explanation).toBe('in progress');
  });

  it('parses bare line-start numbers with inline #2/#3 (Gemini variant)', () => {
    const text = `1 Quick, as an adjective, #2 Nhanh chóng, mau lẹ, #3 Từ đóng vai trò là tính từ.

1 refers to something, #2 chỉ một sự vật nào đó, #3 Cụm động từ chỉ sự quy chiếu.

1 moving with high speed. #2 di chuyển với tốc độ lớn. #3 Cụm phân từ bổ nghĩa cho danh từ.`;
    const chunks = parseBreakdown(text);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({
      text: 'Quick, as an adjective',
      meaning: 'Nhanh chóng, mau lẹ',
      explanation: 'Từ đóng vai trò là tính từ.',
    });
    expect(chunks[2].text).toBe('moving with high speed.');
  });

  it('returns empty for plain prose', () => {
    expect(parseBreakdown('This is just a normal answer without numbers.')).toEqual([]);
    expect(parseBreakdown('#1 only one chunk')).toEqual([]);
    expect(parseBreakdown('')).toEqual([]);
  });
});
