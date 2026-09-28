import { stepVocabTokenIndex } from '@/features/subtitle/ui/contentScriptShared';

const mastered =
  (...indices: number[]) =>
  (i: number) =>
    indices.includes(i);

describe('stepVocabTokenIndex', () => {
  it('steps forward skipping mastered tokens', () => {
    expect(stepVocabTokenIndex(5, 0, 1, mastered(1))).toBe(2);
  });

  it('steps backward skipping mastered tokens', () => {
    expect(stepVocabTokenIndex(5, 0, -1, mastered(4))).toBe(3);
  });

  it('starts at the first token when none is open', () => {
    expect(stepVocabTokenIndex(3, -1, 1, mastered())).toBe(0);
    expect(stepVocabTokenIndex(3, -1, 1, mastered(0))).toBe(1);
  });

  it('starts at the last token when none is open', () => {
    expect(stepVocabTokenIndex(3, -1, -1, mastered())).toBe(2);
    expect(stepVocabTokenIndex(3, -1, -1, mastered(2))).toBe(1);
  });

  it('advances past a newly mastered open token', () => {
    expect(stepVocabTokenIndex(4, 1, 1, mastered(1, 2))).toBe(3);
  });

  it('wraps around past mastered tokens at the edge', () => {
    expect(stepVocabTokenIndex(4, 3, 1, mastered(0))).toBe(1);
    expect(stepVocabTokenIndex(4, 0, -1, mastered(3))).toBe(2);
  });

  it('returns -1 when every token is mastered', () => {
    expect(stepVocabTokenIndex(3, 0, 1, mastered(0, 1, 2))).toBe(-1);
    expect(stepVocabTokenIndex(3, -1, -1, mastered(0, 1, 2))).toBe(-1);
  });
});
