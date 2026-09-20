import { describe, it, expect } from '@jest/globals';
import {
  applyCleanupRules,
  BUILTIN_CLEANUP_RULES,
  cleanupRulesFingerprint,
  DEFAULT_CLEANUP_RULES_SETTING,
  resolveCleanupRules,
  validateCleanupPattern,
} from './cleanupRules';
import type { SubtitleCleanupRule } from './types';

const clean = (text: string) =>
  applyCleanupRules(text, resolveCleanupRules(DEFAULT_CLEANUP_RULES_SETTING));

describe('applyCleanupRules (built-in catalog)', () => {
  it('strips speaker labels and stage directions from the motivating cue', () => {
    expect(clean('-OWNER: Let the man breathe! -(CHUCKLES)')).toBe('Let the man breathe!');
  });

  it('removes bracketed annotations of all three kinds', () => {
    expect(clean('Wait (GASPS) [LOUD] {APPLAUSE} now')).toBe('Wait now');
  });

  it('handles nested and repeated brackets', () => {
    expect(clean('a ([b (c)] d) e')).toBe('a e');
    expect(clean('x ((y)) z')).toBe('x z');
  });

  it('removes orphan opening brackets but leaves closers to post-pass', () => {
    expect(clean('a (b c')).toBe('a b c');
    expect(clean('a (b) (c')).toBe('a c');
  });

  it('strips speaker labels at line starts', () => {
    expect(clean('-OWNER: Let the man breathe')).toBe('Let the man breathe');
    expect(clean('MAN 1: Move!')).toBe('Move!');
    expect(clean('WOMAN: Hello\nMAN: Hi')).toBe('Hello\nHi');
  });

  it('does not strip short or lowercase labels', () => {
    expect(clean('A: single letter')).toBe('A: single letter');
    expect(clean('Bob: lowercase stays')).toBe('Bob: lowercase stays');
    expect(clean('12:00 noon')).toBe('12:00 noon');
  });

  it('removes dialogue dashes and orphan trailing dashes', () => {
    expect(clean('- Hello there')).toBe('Hello there');
    expect(clean('– En dash start')).toBe('En dash start');
    expect(clean('— Em dash start')).toBe('Em dash start');
    expect(clean('trailing dash -')).toBe('trailing dash');
    expect(clean('mid - sentence')).toBe('mid - sentence');
  });

  it('removes chevron speaker markers', () => {
    expect(clean('>> hello there')).toBe('hello there');
    expect(clean('>>> Wait a minute')).toBe('Wait a minute');
  });

  it('removes music glyphs and fully wrapped music lines', () => {
    expect(clean('♪ Theme song ♪')).toBe('');
    expect(clean('♪♪')).toBe('');
    expect(clean('hello ♪ world ♫')).toBe('hello world');
    expect(clean('🎵 singing 🎶')).toBe('');
  });

  it('drops emptied lines but keeps remaining spoken lines', () => {
    expect(clean('♪ Theme ♪\nHello there')).toBe('Hello there');
  });

  it('strips orphan leading and trailing separators', () => {
    expect(clean('(LAUGHS) , wait for it')).toBe('wait for it');
    expect(clean('hold on ;')).toBe('hold on');
    expect(clean(': ;')).toBe('');
  });

  it('normalizes collapsed whitespace', () => {
    expect(clean('keep (note)   going')).toBe('keep going');
  });

  it('returns empty string when nothing learnable remains', () => {
    expect(clean('(CHUCKLES)')).toBe('');
    expect(clean('[MUSIC PLAYING]')).toBe('');
  });
});

describe('resolveCleanupRules', () => {
  it('returns all built-ins enabled by default, in catalog order', () => {
    const rules = resolveCleanupRules(undefined);
    expect(rules.map((r) => r.id)).toEqual(BUILTIN_CLEANUP_RULES.map((r) => r.id));
    expect(rules.every((r) => r.enabled)).toBe(true);
  });

  it('honors per-rule builtinEnabled overrides', () => {
    const rules = resolveCleanupRules({
      builtinEnabled: { 'speaker-label': false },
      custom: [],
    });
    expect(rules.find((r) => r.id === 'speaker-label')?.enabled).toBe(false);
    expect(rules.find((r) => r.id === 'brackets')?.enabled).toBe(true);
  });

  it('appends custom rules after built-ins in creation order', () => {
    const custom: SubtitleCleanupRule[] = [
      { id: 'c1', name: 'one', description: '', pattern: 'x', enabled: true, builtin: false },
      { id: 'c2', name: 'two', description: '', pattern: 'y', enabled: false, builtin: false },
    ];
    const rules = resolveCleanupRules({ builtinEnabled: {}, custom });
    expect(rules.slice(-2).map((r) => r.id)).toEqual(['c1', 'c2']);
  });
});

describe('applyCleanupRules with custom rules', () => {
  it('applies an enabled custom rule after built-ins', () => {
    const rules = resolveCleanupRules({
      builtinEnabled: {},
      custom: [{ id: 'c1', name: 'strip names', description: '', pattern: '\\bJohn\\b', enabled: true, builtin: false }],
    });
    expect(applyCleanupRules('John said hi', rules)).toBe('said hi');
  });

  it('skips disabled custom rules', () => {
    const rules = resolveCleanupRules({
      builtinEnabled: {},
      custom: [{ id: 'c1', name: 'strip', description: '', pattern: 'said', enabled: false, builtin: false }],
    });
    expect(applyCleanupRules('John said hi', rules)).toBe('John said hi');
  });

  it('skips a stored invalid pattern without breaking other rules', () => {
    const rules = resolveCleanupRules({
      builtinEnabled: {},
      custom: [
        { id: 'bad', name: 'bad', description: '', pattern: '(unclosed', enabled: true, builtin: false },
        { id: 'ok', name: 'ok', description: '', pattern: 'tail$', enabled: true, builtin: false },
      ],
    });
    expect(applyCleanupRules('keep (note) tail', rules)).toBe('keep');
  });
});

describe('cleanupRulesFingerprint', () => {
  it('changes when a built-in is toggled or a custom rule mutates', () => {
    const base = cleanupRulesFingerprint({ builtinEnabled: {}, custom: [] });
    expect(cleanupRulesFingerprint({ builtinEnabled: { brackets: false }, custom: [] })).not.toBe(base);
    const withCustom = { builtinEnabled: {}, custom: [{ id: 'c', name: 'n', description: '', pattern: 'x', enabled: true, builtin: false }] };
    expect(cleanupRulesFingerprint(withCustom)).not.toBe(base);
    const toggled = { builtinEnabled: {}, custom: [{ ...withCustom.custom[0], enabled: false }] };
    expect(cleanupRulesFingerprint(toggled)).not.toBe(cleanupRulesFingerprint(withCustom));
  });
});

describe('validateCleanupPattern', () => {
  it('rejects empty, overlong, and uncompilable patterns', () => {
    expect(validateCleanupPattern('')).toBeTruthy();
    expect(validateCleanupPattern('   ')).toBeTruthy();
    expect(validateCleanupPattern('x'.repeat(501))).toBeTruthy();
    expect(validateCleanupPattern('(unclosed')).toBeTruthy();
  });

  it('accepts a valid pattern', () => {
    expect(validateCleanupPattern('\\(.*?\\)')).toBeNull();
    expect(validateCleanupPattern('x'.repeat(500))).toBeNull();
  });
});
