import { describe, expect, it } from '@jest/globals';
import { fillExternalDictLinks } from './useDictionaryToolbar';
import type { ExternalDictLinkTemplate } from '@/entities/settings';

function tpl(overrides: Partial<ExternalDictLinkTemplate> = {}): ExternalDictLinkTemplate {
  return {
    id: 'a',
    name: 'X',
    urlTemplate: 'https://x.com/{term}',
    langCodes: [],
    ...overrides,
  };
}

describe('fillExternalDictLinks', () => {
  it('substitutes {term} encoded and {lang} with the lookup language', () => {
    const out = fillExternalDictLinks(
      [tpl({ urlTemplate: 'https://x.com/?q={term}&l={lang}' })],
      'héllo wörld',
      'en',
    );
    expect(out).toEqual([{ id: 'a', name: 'X', url: `https://x.com/?q=${encodeURIComponent('héllo wörld')}&l=en` }]);
  });

  it('filters by langCodes — empty list matches every language', () => {
    const templates = [
      tpl({ id: 'all', langCodes: [] }),
      tpl({ id: 'en', langCodes: ['en', 'vi'] }),
      tpl({ id: 'ja', langCodes: ['ja'] }),
    ];
    const out = fillExternalDictLinks(templates, 'word', 'en');
    expect(out.map((l) => l.id)).toEqual(['all', 'en']);
  });

  it('drops templates that resolve to unsafe or malformed urls', () => {
    const templates = [
      tpl({ id: 'ok' }),
      tpl({ id: 'js', urlTemplate: 'javascript:alert({term})' }),
      tpl({ id: 'data', urlTemplate: 'data:text/html,{term}' }),
      tpl({ id: 'broken', urlTemplate: 'not a url {term}' }),
      tpl({ id: 'ftp', urlTemplate: 'ftp://x.com/{term}' }),
    ];
    const out = fillExternalDictLinks(templates, 'word', 'en');
    expect(out.map((l) => l.id)).toEqual(['ok']);
  });

  it('preserves stored order', () => {
    const templates = [
      tpl({ id: '1', name: 'A' }),
      tpl({ id: '2', name: 'B' }),
      tpl({ id: '3', name: 'C' }),
    ];
    const out = fillExternalDictLinks(templates, 'word', 'en');
    expect(out.map((l) => l.id)).toEqual(['1', '2', '3']);
  });

  it('returns [] for an empty stored list', () => {
    expect(fillExternalDictLinks([], 'word', 'en')).toEqual([]);
  });
});
