import { describe, expect, it } from '@jest/globals';
import { formatDefEntry, formatDefFromLookup, joinDefEntries, parseDefEntries } from '@/features/srs/lib/defEntry';
import type { LookupResult } from '@/entities/dictionary';

const lookup = {
  term: 'resettle',
  reading: '/ˌriːˈsetl/',
  inflections: [
    { type: 'past', forms: ['resettled'] },
    { type: 'progressive', forms: ['resettling'] },
  ],
  frequencyStars: 3,
} as unknown as LookupResult;

describe('defEntry', () => {
  it('formats a normalized entry header with reading and stars', () => {
    const text = formatDefEntry({
      term: 'resettle',
      reading: '/ˌriːˈsetl/',
      frequencyStars: 3,
      otherForms: 'resettled, resettling',
      senses: '• to move to a new place to live\n· They resettled in Canada.',
    });
    expect(text).toBe(
      'Resettle /ˌriːˈsetl/ ★★★\nOther forms: resettled, resettling\n• to move to a new place to live\nThey resettled in Canada.',
    );
  });

  it('formats from a lookup result with selected senses', () => {
    const text = formatDefFromLookup(lookup, '• to move to a new place to live');
    expect(text).toBe('Resettle /ˌriːˈsetl/ ★★★\nOther forms: resettled, resettling\n• to move to a new place to live');
  });

  it('joins multiple entries with --- and parses them back', () => {
    const a = formatDefEntry({ term: 'a', senses: '• sense a' });
    const b = formatDefEntry({ term: 'b', senses: '• sense b' });
    const joined = joinDefEntries([a, b]);
    expect(joined).toBe('A\n• sense a\n---\nB\n• sense b');
    const parsed = parseDefEntries(joined);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].header).toBe('A');
    expect(parsed[1].header).toBe('B');
  });

  it('parses header, other forms and senses separately', () => {
    const [entry] = parseDefEntries(
      'Resettle /ˌriːˈsetl/ ★★★\nOther forms: resettled, resettling\n• sense\nexample',
    );
    expect(entry.header).toBe('Resettle /ˌriːˈsetl/ ★★★');
    expect(entry.otherForms).toBe('Other forms: resettled, resettling');
    expect(entry.senses).toBe('• sense\nexample');
  });
});
