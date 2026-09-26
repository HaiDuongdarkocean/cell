import { describe, expect, it } from '@jest/globals';
import {
  isSafeDictUrl,
  makeDictLink,
  validateDictLink,
  DICT_LINK_NAME_MAX,
  DICT_LINK_TEMPLATE_MAX,
} from './dictLinkTemplate';

describe('isSafeDictUrl', () => {
  it('accepts http and https', () => {
    expect(isSafeDictUrl('https://example.com/x')).toBe(true);
    expect(isSafeDictUrl('http://localhost:8080/x')).toBe(true);
  });

  it('rejects non-http schemes and malformed urls', () => {
    expect(isSafeDictUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeDictUrl('data:text/html,x')).toBe(false);
    expect(isSafeDictUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeDictUrl('ftp://example.com')).toBe(false);
    expect(isSafeDictUrl('not a url')).toBe(false);
    expect(isSafeDictUrl('')).toBe(false);
  });
});

describe('validateDictLink', () => {
  it('accepts a valid name + template with {term}', () => {
    expect(validateDictLink('Cambridge', 'https://dictionary.cambridge.org/{term}')).toBe(true);
    expect(validateDictLink('Wiktionary', 'https://en.wiktionary.org/wiki/{term}')).toBe(true);
  });

  it('accepts {lang} placeholder alongside {term}', () => {
    expect(validateDictLink('Google', 'https://translate.google.com/?sl={lang}&text={term}')).toBe(true);
  });

  it('rejects empty/whitespace names', () => {
    expect(validateDictLink('', 'https://x.com/{term}')).toBe(false);
    expect(validateDictLink('   ', 'https://x.com/{term}')).toBe(false);
  });

  it('rejects names over the 64-char cap', () => {
    expect(validateDictLink('a'.repeat(DICT_LINK_NAME_MAX), 'https://x.com/{term}')).toBe(true);
    expect(validateDictLink('a'.repeat(DICT_LINK_NAME_MAX + 1), 'https://x.com/{term}')).toBe(false);
  });

  it('rejects empty templates and templates missing {term}', () => {
    expect(validateDictLink('X', '')).toBe(false);
    expect(validateDictLink('X', 'https://x.com/search')).toBe(false);
    expect(validateDictLink('X', 'https://x.com/{lang}')).toBe(false);
  });

  it('rejects templates over the 2048-char cap', () => {
    const ok = `https://x.com/${'a'.repeat(DICT_LINK_TEMPLATE_MAX - 24)}{term}`;
    const tooLong = `https://x.com/${'a'.repeat(DICT_LINK_TEMPLATE_MAX)}{term}`;
    expect(validateDictLink('X', ok)).toBe(true);
    expect(validateDictLink('X', tooLong)).toBe(false);
  });

  it('rejects templates resolving to unsafe urls', () => {
    expect(validateDictLink('X', 'javascript:alert({term})')).toBe(false);
    expect(validateDictLink('X', 'data:text/html,{term}')).toBe(false);
    expect(validateDictLink('X', 'ftp://x.com/{term}')).toBe(false);
    expect(validateDictLink('X', 'not-a-url {term}')).toBe(false);
  });
});

describe('makeDictLink', () => {
  it('trims fields, assigns an id, and defaults langCodes to []', () => {
    const link = makeDictLink('  Cambridge  ', ' https://x.com/{term} ');
    expect(link.id).toBeTruthy();
    expect(link.name).toBe('Cambridge');
    expect(link.urlTemplate).toBe('https://x.com/{term}');
    expect(link.langCodes).toEqual([]);
  });

  it('generates unique ids', () => {
    expect(makeDictLink('a', 'https://x.com/{term}').id).not.toBe(
      makeDictLink('a', 'https://x.com/{term}').id,
    );
  });
});
