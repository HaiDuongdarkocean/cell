// canonical test — smallest check that fails if canonical normalization breaks.
// Verifies: list/numbered-markup shapes serialize to `<br><br>N.` form with
// structured senses (pos, role-classified lines, ` — ` translation pairs),
// unrecognized input stays a single def (fail-safe, never invented splits).

import { describe, it, expect } from '@jest/globals';
import { toCanonicalDefinition } from './canonical';

/** Count senses the way the popup splitter sees them: `N.` at start or after `<br><br>`. */
function canonicalSenseCount(definition: string): number {
  const matches = definition.match(/(?:^|<br><br>)\d+\./g);
  return matches ? matches.length : 1;
}

describe('toCanonicalDefinition', () => {
  it('numbered line markup → canonical senses (single-<br> source)', () => {
    const raw = {
      term: 'investigate',
      definition:
        '1.động từ<br>khám phá và kiểm tra<br>· The police were baffled<br>' +
        '2.động từ<br>nghiên cứu tỉ mỉ<br>· To investigate the market<br>' +
        '3.động từ<br>kiểm tra nhanh',
    };
    const out = toCanonicalDefinition(raw);
    expect(canonicalSenseCount(out.definition)).toBe(3);
    expect(out.definition).toContain('<br><br>2.động từ');
    expect(out.definition.startsWith('1.động từ')).toBe(true);
    expect(out.definition).toContain('· The police were baffled');
  });

  it('numbered markup → structured senses: pos label, gloss, example lines', () => {
    const raw = {
      term: 'no',
      definition:
        '1.tính từ<br>không chút nào; không một ai<br>' +
        '· no words can express my grief — không lời nào diễn tả hết nỗi đau lòng của tôi<br>' +
        '2.tính từ<br>(dùng để chỉ rõ điều gì đó là không được phép)<br>' +
        '· no smoking — không được hút thuốc',
    };
    const out = toCanonicalDefinition(raw);
    expect(out.senses).toHaveLength(2);
    expect(out.senses[0]).toEqual({
      pos: 'tính từ',
      lines: [
        { role: 'gloss', text: 'không chút nào; không một ai' },
        {
          role: 'example',
          text: 'no words can express my grief',
          translation: 'không lời nào diễn tả hết nỗi đau lòng của tôi',
        },
      ],
    });
    expect(out.senses[1]).toEqual({
      pos: 'tính từ',
      lines: [
        { role: 'note', text: '(dùng để chỉ rõ điều gì đó là không được phép)' },
        { role: 'example', text: 'no smoking', translation: 'không được hút thuốc' },
      ],
    });
    // Serialization round-trips the same canonical string.
    expect(out.definition).toBe(
      '1.tính từ<br>không chút nào; không một ai<br>' +
      '· no words can express my grief — không lời nào diễn tả hết nỗi đau lòng của tôi<br><br>' +
      '2.tính từ<br>(dùng để chỉ rõ điều gì đó là không được phép)<br>' +
      '· no smoking — không được hút thuốc',
    );
  });

  it('single-line marker senses keep the first line as gloss, not pos', () => {
    const raw = {
      term: 'take off',
      definition: '1.leaves the ground<br><br>2.to suddenly become popular',
    };
    const out = toCanonicalDefinition(raw);
    expect(out.definition).toBe('1.leaves the ground<br><br>2.to suddenly become popular');
    expect(canonicalSenseCount(out.definition)).toBe(2);
    expect(out.senses[0]?.pos).toBeUndefined();
    expect(out.senses[0]?.lines).toEqual([{ role: 'gloss', text: 'leaves the ground' }]);
  });

  it('list-shaped definitions → one sense per element', () => {
    const raw = {
      term: 'take',
      definitions: [
        'to carry or move something from one place to another',
        'to go with somebody from one place to another',
        'to need or require a particular amount of time',
      ],
    };
    const out = toCanonicalDefinition(raw);
    expect(out.definition).toBe(
      '1.to carry or move something from one place to another<br><br>' +
      '2.to go with somebody from one place to another<br><br>' +
      '3.to need or require a particular amount of time',
    );
    expect(canonicalSenseCount(out.definition)).toBe(3);
    expect(out.senses).toHaveLength(3);
  });

  it('headword-redirect list → single "→ headword" note with tags as pos', () => {
    const raw = {
      term: 'cholos',
      definitions: [['cholo', ['plural']]],
    };
    const out = toCanonicalDefinition(raw);
    expect(out.definition).toBe('→ cholo');
    expect(out.pos).toBe('plural');
    expect(canonicalSenseCount(out.definition)).toBe(1);
    expect(out.senses[0]?.lines).toEqual([{ role: 'note', text: '→ cholo' }]);
  });

  it('mixed list keeps gloss senses and redirects as lines', () => {
    const raw = {
      term: 'x',
      definitions: ['a gloss', ['other', ['variant']]],
    };
    const out = toCanonicalDefinition(raw);
    expect(out.definition).toBe('1.a gloss<br><br>2.→ other');
  });

  it('pre-normalized senses pass through verbatim (idempotent import)', () => {
    const senses = [
      {
        pos: 'tính từ',
        lines: [
          { role: 'gloss' as const, text: 'không chút nào' },
          { role: 'example' as const, text: 'no smoking', translation: 'không được hút thuốc' },
        ],
      },
    ];
    const raw = { term: 'no', definition: 'ignored', senses };
    const out = toCanonicalDefinition(raw);
    expect(out.senses).toBe(senses);
    expect(out.definition).toBe(
      'tính từ<br>không chút nào<br>· no smoking — không được hút thuốc',
    );
  });

  it('rich senses serialize labels/level/synonyms/opposites/pattern/citation', () => {
    const senses = [
      {
        pos: 'verb',
        labels: ['transitive', 'move'],
        level: 'B1',
        lines: [
          { role: 'gloss' as const, text: 'to move or go with someone', translation: 'đưa ai đi' },
          { role: 'example' as const, text: 'Barney took us to the airport', pattern: '[VERB noun]', citation: 'LDOCE' },
        ],
        subsenses: [{ num: 'a', text: 'to carry something' }],
        synonyms: ['bring', 'carry'],
        antonyms: ['leave'],
      },
    ];
    const raw = { term: 'take', definition: '', senses };
    const out = toCanonicalDefinition(raw);
    expect(out.senses).toBe(senses);
    expect(out.definition).toBe(
      'verb [transitive] [move] [B1]<br>' +
      'to move or go with someone — đưa ai đi<br>' +
      '· Barney took us to the airport [VERB noun] (LDOCE)<br>' +
      'synonyms and related words: bring, carry<br>' +
      'antonyms: leave<br>' +
      'a. to carry something',
    );
  });

  it('labels without pos still emit bracketed head', () => {
    const senses = [{ labels: ['kids'], lines: [{ role: 'gloss' as const, text: 'to grasp' }] }];
    const out = toCanonicalDefinition({ term: 'take', definition: '', senses });
    expect(out.definition).toBe('[kids]<br>to grasp');
  });

  it('fail-safe: decimals are not sense markers → stays single def', () => {
    const raw = {
      term: 'x',
      definition: 'weighs 1.5 kg<br>and 2.2 m long',
    };
    const out = toCanonicalDefinition(raw);
    expect(canonicalSenseCount(out.definition)).toBe(1);
    expect(out.definition).not.toContain('<br><br>');
    expect(out.senses).toHaveLength(1);
  });

  it('fail-safe: lone marker does not split', () => {
    const raw = { term: 'x', definition: 'note<br>1.the only point<br>trailing' };
    const out = toCanonicalDefinition(raw);
    expect(canonicalSenseCount(out.definition)).toBe(1);
    expect(out.senses).toHaveLength(1);
  });

  it('verbatim still classifies lines for rendering (no translation split lost)', () => {
    const raw = {
      term: 'x',
      definition: 'a gloss<br>· an example — a translation',
    };
    const out = toCanonicalDefinition(raw);
    expect(out.senses).toHaveLength(1);
    expect(out.senses[0]?.lines).toEqual([
      { role: 'gloss', text: 'a gloss' },
      { role: 'example', text: 'an example', translation: 'a translation' },
    ]);
  });

  it('real newlines normalize to <br>', () => {
    const raw = { term: 'x', definition: 'line one\nline two' };
    const out = toCanonicalDefinition(raw);
    expect(out.definition).toBe('line one<br>line two');
  });

  it('em-dash without spaces is not a translation separator', () => {
    const raw = { term: 'x', definition: 'a dash—separated gloss' };
    const out = toCanonicalDefinition(raw);
    expect(out.senses[0]?.lines).toEqual([{ role: 'gloss', text: 'a dash—separated gloss' }]);
  });

  it('pos falls back to raw.pos; examples preserved', () => {
    const raw = {
      term: 'x',
      definition: 'a gloss',
      pos: 'noun',
      examples: 'ex1\nex2',
    };
    const out = toCanonicalDefinition(raw);
    expect(out.pos).toBe('noun');
    expect(out.examples).toBe('ex1\nex2');
  });
});
