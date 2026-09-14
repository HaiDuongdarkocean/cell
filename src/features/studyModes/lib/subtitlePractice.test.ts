import {
  buildClozeProgress,
  buildDictationProgress,
  createClozeExercise,
  evaluateCloze,
  evaluateDictation,
  normalizePracticeToken,
  tokenizePracticeText,
  type ClozeExercise,
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

describe('buildDictationProgress', () => {
  const expected = "Telling myself I won't go there.";

  it('hides every word behind a pending guide before typing', () => {
    const progress = buildDictationProgress(expected, '');
    expect(progress.words).toHaveLength(6);
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].state).toBe('active');
    expect(progress.words[0].visibleChars).toBeNull();
    expect(progress.words[0].hiddenTailLength).toBe(7);
    expect(progress.words.slice(1).every((w) => w.state === 'pending' && w.visibleChars === null)).toBe(true);
  });

  it('shows the correctly typed prefix and hides the rest while typing', () => {
    const progress = buildDictationProgress(expected, 'tell');
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].typed).toBe('tell');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'T', state: 'correct' },
      { char: 'e', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'l', state: 'correct' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(3);
    expect(progress.words.slice(1).every((w) => w.state === 'pending')).toBe(true);
  });

  it('suggests the expected next character in red and hides the rest when wrong', () => {
    const progress = buildDictationProgress('relaxing', 'res');
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'r', state: 'correct' },
      { char: 'e', state: 'correct' },
      { char: 'l', state: 'incorrect' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(5);
  });

  it('reveals each wrong typed character as the expected character in red', () => {
    const progress = buildDictationProgress('relaxing', 'ss');
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'r', state: 'incorrect' },
      { char: 'e', state: 'incorrect' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(6);
  });

  it('keeps revealing expected characters after a wrong position', () => {
    const progress = buildDictationProgress('relaxing', 'rex');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'r', state: 'correct' },
      { char: 'e', state: 'correct' },
      { char: 'l', state: 'incorrect' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(5);
  });

  it('shows the previous suggestion word with a hidden tail when a character is wrong', () => {
    const progress = buildDictationProgress(expected, 'telle');
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'T', state: 'correct' },
      { char: 'e', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'i', state: 'incorrect' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(2);
  });

  it('commits the current word and shows the missing suffix in red on a trailing space', () => {
    const progress = buildDictationProgress(expected, 'tell ');
    expect(progress.currentIndex).toBe(1);
    expect(progress.words[0].state).toBe('completed');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'T', state: 'correct' },
      { char: 'e', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'i', state: 'missing' },
      { char: 'n', state: 'missing' },
      { char: 'g', state: 'missing' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(0);
    expect(progress.words[1].state).toBe('active');
    expect(progress.words[1].visibleChars).toBeNull();
    expect(progress.words[1].hiddenTailLength).toBe(6);
  });

  it('keeps completed words visible while the user types the next word', () => {
    const progress = buildDictationProgress(expected, 'tell myself');
    expect(progress.currentIndex).toBe(1);
    expect(progress.words[0].state).toBe('completed');
    expect(progress.words[1].state).toBe('active');
    expect(progress.words[1].visibleChars).toEqual([
      { char: 'm', state: 'correct' },
      { char: 'y', state: 'correct' },
      { char: 's', state: 'correct' },
      { char: 'e', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'f', state: 'correct' },
    ]);
    expect(progress.words[1].hiddenTailLength).toBe(0);
    expect(progress.words[2].state).toBe('pending');
  });

  it('advances the active index when the final word is complete and a space is typed', () => {
    const progress = buildDictationProgress(expected, 'tell myself I ');
    expect(progress.currentIndex).toBe(3);
    expect(progress.words[0].state).toBe('completed');
    expect(progress.words[1].state).toBe('completed');
    expect(progress.words[2].state).toBe('completed');
    expect(progress.words[3].state).toBe('active');
    expect(progress.words[3].visibleChars).toBeNull();
  });

  it('keeps the active word hidden until the first character is typed', () => {
    const progress = buildDictationProgress(expected, ' ');
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].state).toBe('active');
    expect(progress.words[0].visibleChars).toBeNull();
  });

  it('caps visible chars at the expected word length and ignores extras', () => {
    const progress = buildDictationProgress('relaxing', 'ssssssss');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'r', state: 'incorrect' },
      { char: 'e', state: 'incorrect' },
      { char: 'l', state: 'incorrect' },
      { char: 'a', state: 'incorrect' },
      { char: 'x', state: 'incorrect' },
      { char: 'i', state: 'incorrect' },
      { char: 'n', state: 'incorrect' },
      { char: 'g', state: 'incorrect' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(0);
  });

  it('ignores typed characters beyond the expected word length', () => {
    const progress = buildDictationProgress('Telling', 'tellingx');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'T', state: 'correct' },
      { char: 'e', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'l', state: 'correct' },
      { char: 'i', state: 'correct' },
      { char: 'n', state: 'correct' },
      { char: 'g', state: 'correct' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(0);
  });
});

describe('buildClozeProgress', () => {
  const exercise: ClozeExercise = {
    blanks: [
      { type: 'blank', id: 'b0', answer: 'you', start: 0, end: 0 },
      { type: 'blank', id: 'b1', answer: 'were', start: 0, end: 0 },
      { type: 'blank', id: 'b2', answer: 'good', start: 0, end: 0 },
    ],
    parts: [],
  };

  it('hides every blank before typing', () => {
    const progress = buildClozeProgress(exercise, '');
    expect(progress.words).toHaveLength(3);
    expect(progress.currentIndex).toBe(0);
    expect(progress.correctCount).toBe(0);
    expect(progress.extraCount).toBe(0);
    expect(progress.words[0].state).toBe('active');
    expect(progress.words[0].visibleChars).toBeNull();
    expect(progress.words.slice(1).every((w) => w.state === 'pending' && w.visibleChars === null)).toBe(true);
  });

  it('reveals the typed prefix of the active blank and hides the tail', () => {
    const progress = buildClozeProgress(exercise, 'ye');
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].state).toBe('active');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'y', state: 'correct' },
      { char: 'o', state: 'incorrect' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(1);
    expect(progress.words[1].state).toBe('pending');
    expect(progress.words[2].state).toBe('pending');
  });

  it('commits the current blank and activates the next one on a trailing space', () => {
    const progress = buildClozeProgress(exercise, 'you ');
    expect(progress.currentIndex).toBe(1);
    expect(progress.words[0].state).toBe('completed');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'y', state: 'correct' },
      { char: 'o', state: 'correct' },
      { char: 'u', state: 'correct' },
    ]);
    expect(progress.words[0].hiddenTailLength).toBe(0);
    expect(progress.words[1].state).toBe('active');
    expect(progress.words[1].visibleChars).toBeNull();
    expect(progress.correctCount).toBe(1);
  });

  it('keeps the active blank hidden until the first character is typed', () => {
    const progress = buildClozeProgress(exercise, ' ');
    expect(progress.currentIndex).toBe(0);
    expect(progress.words[0].state).toBe('active');
    expect(progress.words[0].visibleChars).toBeNull();
  });

  it('shows wrong and missing characters when a completed blank does not match', () => {
    const progress = buildClozeProgress(exercise, 'yoo ');
    expect(progress.words[0].state).toBe('completed');
    expect(progress.words[0].visibleChars).toEqual([
      { char: 'y', state: 'correct' },
      { char: 'o', state: 'correct' },
      { char: 'u', state: 'incorrect' },
    ]);
    expect(progress.words[1].state).toBe('active');
  });

  it('counts extra typed words and completes all blanks', () => {
    const progress = buildClozeProgress(exercise, 'you were good extra');
    expect(progress.currentIndex).toBe(3);
    expect(progress.correctCount).toBe(3);
    expect(progress.extraCount).toBe(1);
    expect(progress.words.every((w) => w.state === 'completed')).toBe(true);
  });
});
