import {
  createClozeExercise,
  evaluateCloze,
  evaluateDictation,
  normalizePracticeToken,
  tokenizePracticeText,
} from './subtitlePractice';

describe('normalizePracticeToken', () => {
  it('lowercases and strips surrounding punctuation', () => {
    expect(normalizePracticeToken('  Hello! ')).toBe('hello');
  });

  it('normalizes curly apostrophes to straight', () => {
    expect(normalizePracticeToken('don’t')).toBe("don't");
    expect(normalizePracticeToken('DON’T')).toBe("don't");
  });

  it('normalizes unicode dashes to hyphen', () => {
    expect(normalizePracticeToken('well—known')).toBe('well-known');
  });

  it('keeps diacritics significant', () => {
    expect(normalizePracticeToken('café')).not.toBe('cafe');
    expect(normalizePracticeToken('café')).toBe('café');
  });
});

describe('tokenizePracticeText', () => {
  it('splits on whitespace and drops pure punctuation', () => {
    expect(tokenizePracticeText('Hello,   world... yes!')).toEqual(['hello', 'world', 'yes']);
  });

  it('keeps internal apostrophes and hyphens inside tokens', () => {
    expect(tokenizePracticeText("it's a well-known fact")).toEqual(['it\'s', 'a', 'well-known', 'fact']);
  });

  it('returns empty array for punctuation-only text', () => {
    expect(tokenizePracticeText('♪ ♪ …')).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(tokenizePracticeText('')).toEqual([]);
  });

  it('does not swallow non-dash punctuation adjacent to the U+2010–U+2015 range', () => {
    expect(tokenizePracticeText('a‗b')).toEqual(['a', 'b']);
    expect(tokenizePracticeText('a⁃b')).toEqual(['a', 'b']);
  });

  it('treats U+2010–U+2015 dashes as internal hyphen', () => {
    expect(tokenizePracticeText('well‐known')).toEqual(['well-known']);
    expect(tokenizePracticeText('well—known')).toEqual(['well-known']);
  });
});

describe('evaluateDictation', () => {
  it('marks exact answers correct with score 100', () => {
    const result = evaluateDictation('you were good to me', 'you were good to me');
    expect(result.correct).toBe(true);
    expect(result.score).toBe(100);
    expect(result.correctCount).toBe(5);
    expect(result.totalCount).toBe(5);
    expect(result.feedback.every((f) => f.state === 'correct')).toBe(true);
  });

  it('accepts normalization-equivalent answers (case, punctuation, apostrophes)', () => {
    const result = evaluateDictation("It's you, weren't it?", 'its you werent— it');
    expect(result.correct).toBe(false);
    const normalized = evaluateDictation('YOU WERE GOOD TO ME', 'you were good to me');
    expect(normalized.correct).toBe(true);
    const punct = evaluateDictation('You were good to me!', 'you were good to me');
    expect(punct.correct).toBe(true);
  });

  it('marks wrong tokens incorrect with expected text', () => {
    const result = evaluateDictation('you were good to me', 'you are good to me');
    expect(result.correct).toBe(false);
    expect(result.correctCount).toBe(4);
    const wrong = result.feedback[1];
    expect(wrong.state).toBe('incorrect');
    expect(wrong.expected).toBe('were');
  });

  it('marks trailing expected tokens missing', () => {
    const result = evaluateDictation('you were good to me', 'you were');
    expect(result.correct).toBe(false);
    expect(result.feedback.slice(2).every((f) => f.state === 'missing')).toBe(true);
    expect(result.correctCount).toBe(2);
  });

  it('marks extra actual tokens extra', () => {
    const result = evaluateDictation('you were', 'you were very good');
    expect(result.correct).toBe(false);
    expect(result.feedback[2].state).toBe('extra');
    expect(result.feedback[3].state).toBe('extra');
  });

  it('treats empty expected + empty actual as correct score 100', () => {
    const result = evaluateDictation('', '   ');
    expect(result.correct).toBe(true);
    expect(result.score).toBe(100);
    expect(result.totalCount).toBe(0);
  });

  it('handles long input (>2000 chars) without error', () => {
    const expected = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ');
    const actual = expected.split(' ').slice(0, 399).join(' ') + ' wrong';
    const result = evaluateDictation(expected, actual);
    expect(result.correct).toBe(false);
    expect(result.correctCount).toBe(399);
    expect(result.totalCount).toBe(400);
  });

  it('empty expected with non-empty actual scores 0 and all extra', () => {
    const result = evaluateDictation('!!!', 'something typed');
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback.every((f) => f.state === 'extra')).toBe(true);
  });
});

describe('createClozeExercise', () => {
  const cue = { index: 6, start: 47233, targetText: '♪ YOU WERE GOOD TO ME ♪' };

  it('is deterministic for the same cue identity', () => {
    const a = createClozeExercise(cue);
    const b = createClozeExercise(cue);
    expect(a).toEqual(b);
  });

  it('blanks ~30% of lexical tokens, min 1 max 6', () => {
    const ex = createClozeExercise(cue);
    expect(ex.blanks.length).toBe(2); // 5 tokens * 0.3 = 1.5 → 2
    const big = createClozeExercise({ index: 1, start: 0, targetText: Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ') });
    expect(big.blanks.length).toBe(6);
    const tiny = createClozeExercise({ index: 1, start: 0, targetText: 'hello' });
    expect(tiny.blanks.length).toBe(1);
  });

  it('produces zero blanks for punctuation-only cues', () => {
    const ex = createClozeExercise({ index: 1, start: 2066, targetText: '♪ ♪' });
    expect(ex.blanks.length).toBe(0);
    expect(ex.parts.every((p) => p.type === 'text')).toBe(true);
  });

  it('reconstructs the original text from parts', () => {
    const ex = createClozeExercise(cue);
    const reconstructed = ex.parts.map((p) => (p.type === 'text' ? p.text : p.answer)).join('');
    expect(reconstructed).toBe(cue.targetText);
  });

  it('blank ids are stable and derived from cue identity + token index', () => {
    const a = createClozeExercise(cue);
    const same = createClozeExercise({ ...cue });
    const different = createClozeExercise({ ...cue, index: 7 });
    expect(a.blanks.map((b) => b.id)).toEqual(same.blanks.map((b) => b.id));
    expect(a.blanks.map((b) => b.id)).not.toEqual(different.blanks.map((b) => b.id));
    for (const blank of a.blanks) {
      expect(cue.targetText.slice(blank.start, blank.end)).toBe(blank.answer);
    }
  });

  it('handles repeated words without collision', () => {
    const ex = createClozeExercise({ index: 7, start: 51633, targetText: '♪ YOU WERE GOOD TO ME, YEAH ♪ ♪ YOU WERE GOOD TO ME ♪' });
    const ids = new Set(ex.blanks.map((b) => b.id));
    expect(ids.size).toBe(ex.blanks.length);
  });

  it('handles unicode text', () => {
    const ex = createClozeExercise({ index: 1, start: 0, targetText: 'Café müller trinkt naïve résumé' });
    expect(ex.blanks.length).toBeGreaterThanOrEqual(1);
    const reconstructed = ex.parts.map((p) => (p.type === 'text' ? p.text : p.answer)).join('');
    expect(reconstructed).toBe('Café müller trinkt naïve résumé');
  });
});

describe('evaluateCloze', () => {
  const cue = { index: 6, start: 47233, targetText: '♪ YOU WERE GOOD TO ME ♪' };

  it('marks all-correct answers correct', () => {
    const ex = createClozeExercise(cue);
    const answers: Record<string, string> = {};
    for (const b of ex.blanks) answers[b.id] = b.answer;
    const result = evaluateCloze(ex, answers);
    expect(result.correct).toBe(true);
    expect(result.score).toBe(100);
  });

  it('accepts normalization-equivalent answers', () => {
    const ex = createClozeExercise(cue);
    const answers: Record<string, string> = {};
    for (const b of ex.blanks) answers[b.id] = b.answer.toLowerCase() + '!!';
    const result = evaluateCloze(ex, answers);
    expect(result.correct).toBe(true);
  });

  it('reports wrong and missing blanks', () => {
    const ex = createClozeExercise(cue);
    const answers: Record<string, string> = {};
    answers[ex.blanks[0].id] = 'wrong';
    const result = evaluateCloze(ex, answers);
    expect(result.correct).toBe(false);
    expect(result.feedback[0].state).toBe('incorrect');
    expect(result.feedback[0].expected).toBe(ex.blanks[0].answer);
    expect(result.feedback[1].state).toBe('missing');
  });
});
