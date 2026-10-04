import { strToU8, zipSync } from 'fflate';
import {
  collectEntryComponents,
  deriveResourceType,
  resourceOffersComponent,
  sortedComponents,
} from '@/features/dictionary/logic/dictionaryComponents';
import { detectComponents } from '@/features/dictionary/logic/formatDetector';
import type { DictionaryComponent } from '@/entities/dictionary';

describe('detectComponents', () => {
  it('maps a plain .txt to frequency only', async () => {
    await expect(detectComponents('list.txt', strToU8('a\nb\n'))).resolves.toEqual(['frequency']);
  });

  it('maps json-entries to definitions only', async () => {
    const data = strToU8(JSON.stringify([{ term: 'a', definition: 'b' }]));
    await expect(detectComponents('dict.json', data)).resolves.toEqual(['definitions']);
  });

  it('maps a term_bank-only zip to definitions only', async () => {
    const zipped = zipSync({
      'index.json': strToU8('{"title":"t","format":3}'),
      'term_bank_1.json': strToU8('[]'),
    });
    await expect(detectComponents('dict.zip', zipped)).resolves.toEqual(['definitions']);
  });

  it('maps a dual-bank zip to definitions + frequency', async () => {
    const zipped = zipSync({
      'index.json': strToU8('{"title":"t","format":3}'),
      'term_bank_1.json': strToU8('[]'),
      'term_meta_bank_1.json': strToU8('[]'),
    });
    await expect(detectComponents('dual.zip', zipped)).resolves.toEqual(['definitions', 'frequency']);
  });

  it('maps a term_meta_bank-only zip to frequency only', async () => {
    const zipped = zipSync({
      'index.json': strToU8('{"title":"t","format":3}'),
      'term_meta_bank_1.json': strToU8('[]'),
    });
    await expect(detectComponents('freq.zip', zipped)).resolves.toEqual(['frequency']);
  });
});

describe('collectEntryComponents + sortedComponents', () => {
  it('collects definitions from a definition string', () => {
    const set = new Set<DictionaryComponent>();
    collectEntryComponents(set, { definition: 'a word', pronunciation: '', examples: '' });
    expect(sortedComponents(set)).toEqual(['definitions']);
  });

  it('collects examples and translations from sense lines', () => {
    const set = new Set<DictionaryComponent>();
    collectEntryComponents(set, {
      definition: '', pronunciation: '', examples: '',
      senses: [{ lines: [{ role: 'example', text: 'ex' }, { role: 'gloss', text: 'd', translation: 't' }] }],
    });
    const out = sortedComponents(set);
    expect(out).toContain('examples');
    expect(out).toContain('translations');
  });

  it('orders output by the canonical component list', () => {
    const set = new Set<DictionaryComponent>(['frequency', 'definitions', 'examples']);
    expect(sortedComponents(set)).toEqual(['definitions', 'examples', 'frequency']);
  });
});

describe('deriveResourceType', () => {
  it('labels frequency-only resources FREQUENCY', () => {
    expect(deriveResourceType(['frequency'])).toBe('FREQUENCY');
  });

  it('labels mixed and dictionary resources DICTIONARY', () => {
    expect(deriveResourceType(['definitions', 'frequency'])).toBe('DICTIONARY');
    expect(deriveResourceType(['definitions'])).toBe('DICTIONARY');
  });

  it('labels empty or absent components DICTIONARY', () => {
    expect(deriveResourceType([])).toBe('DICTIONARY');
    expect(deriveResourceType(undefined)).toBe('DICTIONARY');
  });
});

describe('resourceOffersComponent', () => {
  it('reads components as the source of truth', () => {
    const r = { components: ['definitions', 'frequency'] as DictionaryComponent[], type: 'DICTIONARY' as const };
    expect(resourceOffersComponent(r, 'frequency')).toBe(true);
    expect(resourceOffersComponent(r, 'definitions')).toBe(true);
    expect(resourceOffersComponent(r, 'examples')).toBe(false);
  });

  it('honours disabledComponents', () => {
    const r = {
      components: ['definitions', 'frequency'] as DictionaryComponent[],
      disabledComponents: ['frequency'] as DictionaryComponent[],
      type: 'DICTIONARY' as const,
    };
    expect(resourceOffersComponent(r, 'frequency')).toBe(false);
    expect(resourceOffersComponent(r, 'definitions')).toBe(true);
  });

  it('falls back to the type label for legacy rows without components', () => {
    const r = { type: 'FREQUENCY' as const };
    expect(resourceOffersComponent(r, 'frequency')).toBe(true);
    expect(resourceOffersComponent(r, 'definitions')).toBe(false);
  });
});
