import { describe, expect, it } from '@jest/globals';
import {
  MAX_SEARCH_HISTORY,
  addSearchHistoryTerm,
  readSearchHistory,
  removeSearchHistoryTerm,
} from './searchHistory';

describe('search history', () => {
  it('adds trimmed terms newest first and deduplicates existing terms', () => {
    expect(addSearchHistoryTerm(['world', 'hello'], ' hello ')).toEqual(['hello', 'world']);
  });

  it('does not add blank terms', () => {
    expect(addSearchHistoryTerm(['hello'], '   ')).toEqual(['hello']);
  });

  it('removes one term and caps history at the configured limit', () => {
    const history = Array.from({ length: MAX_SEARCH_HISTORY }, (_, index) => `term-${index}`);
    expect(addSearchHistoryTerm(history, 'new-term')).toHaveLength(MAX_SEARCH_HISTORY);
    expect(removeSearchHistoryTerm(['hello', 'world', 'hello'], 'hello')).toEqual(['world']);
  });

  it('filters malformed persisted values', () => {
    expect(readSearchHistory(['hello', '', 42, ' world '])).toEqual(['hello', ' world ']);
    expect(readSearchHistory(null)).toEqual([]);
  });
});
