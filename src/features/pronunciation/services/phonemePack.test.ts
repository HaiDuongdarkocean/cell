import { describe, expect, it } from '@jest/globals';
import { normalizeAccent, parsePhonemePack, resolvePhonemeFile } from './phonemePack';

describe('normalizeAccent', () => {
  it('maps american labels to us', () => {
    for (const l of ['AmE', 'US', 'us', 'American', 'GA', 'General American']) {
      expect(normalizeAccent(l)).toBe('us');
    }
  });
  it('maps british labels to br', () => {
    for (const l of ['BrE', 'UK', 'British', 'RP', 'Received Pronunciation']) {
      expect(normalizeAccent(l)).toBe('br');
    }
  });
  it('returns null for unknown or empty labels', () => {
    expect(normalizeAccent(undefined)).toBeNull();
    expect(normalizeAccent('')).toBeNull();
    expect(normalizeAccent('Australian')).toBeNull();
    expect(normalizeAccent('CA')).toBeNull();
  });
});

describe('resolvePhonemeFile', () => {
  const files = {
    p: { d: 'p.opus' },
    'ɪə': { br: 'uk-ear.opus', us: 'us-ear.opus' },
    'ɜː': { d: 'u25c.opus', us: 'us-er.opus' },
  };

  it('returns the shared default when accents match', () => {
    expect(resolvePhonemeFile(files, 'p', 'br')).toBe('p.opus');
    expect(resolvePhonemeFile(files, 'p', 'us')).toBe('p.opus');
    expect(resolvePhonemeFile(files, 'p', null)).toBe('p.opus');
  });
  it('returns accent-specific files where realization differs', () => {
    expect(resolvePhonemeFile(files, 'ɪə', 'br')).toBe('uk-ear.opus');
    expect(resolvePhonemeFile(files, 'ɪə', 'us')).toBe('us-ear.opus');
  });
  it('falls back to the shared file when an accent slot is missing', () => {
    expect(resolvePhonemeFile(files, 'ɜː', 'br')).toBe('u25c.opus');
    expect(resolvePhonemeFile(files, 'ɜː', 'us')).toBe('us-er.opus');
    expect(resolvePhonemeFile(files, 'ɜː', null)).toBe('u25c.opus');
  });
  it('returns null for unknown symbols', () => {
    expect(resolvePhonemeFile(files, 'n̩', 'us')).toBeNull();
    expect(resolvePhonemeFile(files, 'ç', 'br')).toBeNull();
  });
});

describe('parsePhonemePack', () => {
  it('parses a valid pack', () => {
    const pack = parsePhonemePack({
      name: 'My pack',
      license: 'CC0',
      files: { p: { d: 'QUJD' }, 'ɪə': { br: 'QUJD', us: 'QUJD' } },
    });
    expect(pack.name).toBe('My pack');
    expect(Object.keys(pack.files)).toHaveLength(2);
  });
  it('rejects packs without name or files', () => {
    expect(() => parsePhonemePack({ files: { p: { d: 'x' } } })).toThrow(/name/);
    expect(() => parsePhonemePack({ name: 'x', files: {} })).toThrow(/files/);
    expect(() => parsePhonemePack('nope')).toThrow(/object/);
  });
  it('rejects symbols with no slots or bad slot types', () => {
    expect(() => parsePhonemePack({ name: 'x', files: { p: {} } })).toThrow(/"p"/);
    expect(() => parsePhonemePack({ name: 'x', files: { p: { d: 5 } } })).toThrow(/"p\.d"/);
  });
});
