import { describe, expect, it } from '@jest/globals';
import { normalizePos } from './posNormalize';

describe('normalizePos', () => {
  it('maps COCA single-letter codes', () => {
    expect(normalizePos('j')).toBe('adjective');
    expect(normalizePos('n')).toBe('noun');
    expect(normalizePos('v')).toBe('verb');
    expect(normalizePos('r')).toBe('adverb');
  });

  it('maps full provider labels', () => {
    expect(normalizePos('adjective')).toBe('adjective');
    expect(normalizePos('Noun')).toBe('noun');
    expect(normalizePos('VERB')).toBe('verb');
    expect(normalizePos('phrasal verb')).toBe('phrasal verb');
  });

  it('handles case and whitespace', () => {
    expect(normalizePos('  Adj ')).toBe('adjective');
    expect(normalizePos('PREP')).toBe('preposition');
  });

  it('strips trailing dots from dictionary abbreviations', () => {
    expect(normalizePos('adj.')).toBe('adjective');
    expect(normalizePos('n.')).toBe('noun');
    expect(normalizePos('v.')).toBe('verb');
    expect(normalizePos('adv.')).toBe('adverb');
    expect(normalizePos('v.t.')).toBe('verb');
  });

  it('passes unknown labels through lowercased', () => {
    expect(normalizePos('X')).toBe('x');
    expect(normalizePos('modal verb')).toBe('modal verb');
  });

  it('keeps empty as empty bucket', () => {
    expect(normalizePos('')).toBe('');
    expect(normalizePos('   ')).toBe('');
  });
});
