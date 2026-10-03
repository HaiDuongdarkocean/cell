import { describe, expect, it } from '@jest/globals';
import { formatDefEntry, formatDefFromLookup, joinDefEntries, parseDefEntries } from '@/features/srs/lib/defEntry';
import type { LookupResult } from '@/entities/dictionary';

const lookup = {
  term: 'resettle',
  reading: '/ˌriːˈsetl/',
  frequencies: [{ rank: 75, source: 'standard' }],
  inflections: [
    { type: 'past', forms: ['resettled'] },
    { type: 'progressive', forms: ['resettling'] },
  ],
  frequencyStars: 3,
  wordFamily: { nouns: ['resettlement'], verbs: ['resettle'] },
  related: [
    { term: 'settle down', kind: 'phrasal' },
    { term: 'settle in', kind: 'phrasal' },
    { term: 'new home', kind: 'collocation' },
  ],
} as unknown as LookupResult;

describe('defEntry', () => {
  it('formats a normalized entry header with reading, stars and [source:rank]', () => {
    const text = formatDefEntry({
      term: 'resettle',
      reading: '/ˌriːˈsetl/',
      frequencyStars: 3,
      frequencies: [{ rank: 75, source: 'standard' }],
      inflections: [{ type: '', forms: ['resettled', 'resettling'] }],
      senses: '[v] to move to a new place to live\n- They resettled in Canada.',
    });
    expect(text).toBe(
      'Resettle /ˌriːˈsetl/ ★★★ [standard:75]\n' +
      'Other forms: resettled, resettling\n\n' +
      '[v] to move to a new place to live\n' +
      '- They resettled in Canada.',
    );
  });

  it('formats from a lookup result with senses and meta sections', () => {
    const text = formatDefFromLookup(lookup, '[v] to move to a new place to live');
    expect(text).toBe(
      'Resettle /ˌriːˈsetl/ ★★★ [standard:75]\n' +
      'Other forms: past resettled | progressive resettling\n\n' +
      '[v] to move to a new place to live\n\n' +
      'word family: noun resettlement | verb resettle\n' +
      'phrasal verbs: settle down, settle in\n' +
      'collocations: new home',
    );
  });

  it('joins multiple entries with --- and parses them back', () => {
    const a = formatDefEntry({ term: 'a', senses: '[n] sense a' });
    const b = formatDefEntry({ term: 'b', senses: '[n] sense b' });
    const joined = joinDefEntries([a, b]);
    expect(joined).toBe('A\n\n[n] sense a\n---\nB\n\n[n] sense b');
    const parsed = parseDefEntries(joined);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].header).toBe('A');
    expect(parsed[1].header).toBe('B');
  });

  it('parses header, other forms, senses and meta separately', () => {
    const [entry] = parseDefEntries(
      'Resettle /ˌriːˈsetl/ ★★★\nOther forms: resettled, resettling\n\n[v] sense\n- example\n\nword family: noun resettlement',
    );
    expect(entry.header).toBe('Resettle /ˌriːˈsetl/ ★★★');
    expect(entry.otherForms).toBe('Other forms: resettled, resettling');
    expect(entry.senses).toBe('[v] sense\n- example');
    expect(entry.meta).toBe('word family: noun resettlement');
  });

  it('parses legacy • entries', () => {
    const [entry] = parseDefEntries('Resettle ★★★\n• sense\nexample');
    expect(entry.header).toBe('Resettle ★★★');
    expect(entry.senses).toBe('• sense\nexample');
  });

  it('dedupes senses lines identical to emitted meta lines', () => {
    const text = formatDefEntry({
      term: 'x',
      senses: '[n] a sense\nword family: noun resettlement | verb resettle',
      wordFamily: { nouns: ['resettlement'], verbs: ['resettle'] },
    });
    expect(text).toBe('X\n\n[n] a sense\n\nword family: noun resettlement | verb resettle');
  });
});
