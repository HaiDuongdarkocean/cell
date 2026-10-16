import { beforeEach, describe, expect, it } from '@jest/globals';
import { aiAnswerCacheKey, clearAiAnswerCache, getAiAnswer, setAiAnswer } from './answerCache';

const answer = { feature: 'wordExplain' as const, provider: 'chatgpt' as const, text: 'cached' };

beforeEach(() => clearAiAnswerCache());

describe('aiAnswerCache', () => {
  it('round-trips an answer by feature+provider+prompt key', () => {
    const key = aiAnswerCacheKey('wordExplain', 'chatgpt', 'sys\nusr prompt');
    setAiAnswer(key, answer);
    expect(getAiAnswer(key)).toEqual(answer);
  });

  it('misses on different feature, provider, or prompt', () => {
    setAiAnswer(aiAnswerCacheKey('wordExplain', 'chatgpt', 'p'), answer);
    expect(getAiAnswer(aiAnswerCacheKey('sentenceBreakdown', 'chatgpt', 'p'))).toBeUndefined();
    expect(getAiAnswer(aiAnswerCacheKey('wordExplain', 'gemini', 'p'))).toBeUndefined();
    expect(getAiAnswer(aiAnswerCacheKey('wordExplain', 'chatgpt', 'other'))).toBeUndefined();
  });

  it('evicts the oldest entry beyond the cap', () => {
    for (let i = 0; i < 205; i += 1) {
      setAiAnswer(aiAnswerCacheKey('wordExplain', 'chatgpt', `p${i}`), answer);
    }
    expect(getAiAnswer(aiAnswerCacheKey('wordExplain', 'chatgpt', 'p0'))).toBeUndefined();
    expect(getAiAnswer(aiAnswerCacheKey('wordExplain', 'chatgpt', 'p204'))).toEqual(answer);
  });
});
