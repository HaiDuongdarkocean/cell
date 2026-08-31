import { describe, it, expect } from '@jest/globals';
import { removeBracketedText } from './removeBracketed';

describe('removeBracketedText', () => {
  it('removes round brackets and their contents', () => {
    expect(removeBracketedText('Hello (world)')).toBe('Hello ');
  });

  it('removes square and curly brackets', () => {
    expect(removeBracketedText('[note] {hint}')).toBe(' ');
  });

  it('removes nested brackets', () => {
    expect(removeBracketedText('a ([b (c)] d) e')).toBe('a  e');
  });

  it('keeps text without brackets', () => {
    expect(removeBracketedText('plain text')).toBe('plain text');
  });

  it('removes unclosed opening bracket', () => {
    expect(removeBracketedText('start (end')).toBe('start end');
  });
});
