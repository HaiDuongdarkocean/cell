import {
  parsePhraseTemplate,
  type PhraseNode,
} from '@/features/dictionary/logic/phraseTemplateParser';

function literal(value: string, inflectableVerb = false): PhraseNode {
  return { type: 'literal', value, inflectableVerb };
}

function optional(...children: PhraseNode[]): PhraseNode {
  return { type: 'optional', children };
}

function alternative(...branches: PhraseNode[][]): PhraseNode {
  return { type: 'alternative', branches };
}

function slot(kind: 'object' | 'person' | 'possessive', maxTokens = 3): PhraseNode {
  if (kind === 'person' && maxTokens === 3) maxTokens = 2;
  return { type: 'slot', kind, maxTokens };
}

describe('phraseTemplateParser', () => {
  it('normalizes whitespace, case, NFC, and curly apostrophes', () => {
    const result = parsePhraseTemplate('  A bird’s   eye view  ');

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      literal('a'),
      literal("bird's"),
      literal('eye'),
      literal('view'),
    ]);
  });

  it('parses a simple multiword term as literals', () => {
    const result = parsePhraseTemplate('cash flow');

    expect(result).toMatchObject({
      status: 'supported',
      fixedTokenCount: 2,
      minSurfaceTokens: 2,
      maxSurfaceTokens: 2,
    });
    expect(result.nodes).toEqual([literal('cash'), literal('flow')]);
  });

  it('parses optional parenthesized material', () => {
    const result = parsePhraseTemplate('be (right) under your nose', {
      inflectableLiterals: new Set(['be']),
    });

    expect(result.nodes).toEqual([
      literal('be', true),
      optional(literal('right')),
      literal('under'),
      slot('possessive', 2),
      literal('nose'),
    ]);
    expect(result.minSurfaceTokens).toBe(4);
    expect(result.maxSurfaceTokens).toBe(6);
  });

  it('parses slash alternatives without keeping the slash literal', () => {
    const result = parsePhraseTemplate('a close/near thing');

    expect(result.nodes).toEqual([
      literal('a'),
      alternative([literal('close')], [literal('near')]),
      literal('thing'),
    ]);
  });

  it('parses a slash chain of word alternatives', () => {
    const result = parsePhraseTemplate('a banner year/season/month/week');

    expect(result.nodes).toEqual([
      literal('a'),
      literal('banner'),
      alternative(
        [literal('year')],
        [literal('season')],
        [literal('month')],
        [literal('week')],
      ),
    ]);
  });

  it('parses a multiword final alternative and shared suffix', () => {
    expect(parsePhraseTemplate('a bolt from/out of the blue').nodes).toEqual([
      literal('a'),
      literal('bolt'),
      alternative([literal('from')], [literal('out'), literal('of')]),
      literal('the'),
      literal('blue'),
    ]);

    expect(parsePhraseTemplate('a piece/slice/share of the pie').nodes).toEqual([
      literal('a'),
      alternative([literal('piece')], [literal('slice')], [literal('share')]),
      literal('of'),
      literal('the'),
      literal('pie'),
    ]);
  });

  it('parses slash alternatives inside optional parentheses', () => {
    const result = parsePhraseTemplate('a (quick/brisk) trot through sth');

    expect(result.nodes).toEqual([
      literal('a'),
      optional(alternative([literal('quick')], [literal('brisk')])),
      literal('trot'),
      literal('through'),
      slot('object'),
    ]);
  });

  it('parses multiple optional groups in one term', () => {
    const result = parsePhraseTemplate('a nip (here) and a tuck (there)');

    expect(result.nodes).toEqual([
      literal('a'),
      literal('nip'),
      optional(literal('here')),
      literal('and'),
      literal('a'),
      literal('tuck'),
      optional(literal('there')),
    ]);
  });

  it('keeps numeric slash tokens literal', () => {
    const result = parsePhraseTemplate('20/20 vision');

    expect(result.nodes).toEqual([literal('20/20'), literal('vision')]);
  });

  it('maps Cambridge placeholders to typed slots', () => {
    const result = parsePhraseTemplate('carry sb/sth through something');

    expect(result.nodes).toEqual([
      literal('carry'),
      alternative([slot('person')], [slot('object')]),
      literal('through'),
      slot('object', 2),
    ]);
  });

  it('marks ellipsis and etc templates as unsupported open patterns', () => {
    expect(parsePhraseTemplate('...and counting').status).toBe('unsupportedOpen');
    expect(parsePhraseTemplate('a load of crap, nonsense, etc.').status).toBe('unsupportedOpen');
  });

  it('marks unbalanced parentheses as unsupported malformed patterns', () => {
    expect(parsePhraseTemplate('a (quick trot through sth').status).toBe('unsupportedMalformed');
    expect(parsePhraseTemplate('a quick) trot').status).toBe('unsupportedMalformed');
  });

  it('marks a trailing slash with no alternative as unsupported malformed', () => {
    expect(parsePhraseTemplate('the bosom of the family/').status).toBe('unsupportedMalformed');
  });

  it('rejects templates over fixed-token and surface-span limits', () => {
    const tooLong = parsePhraseTemplate('one two three four five six seven', {
      maxFixedTokens: 3,
    });
    const tooWide = parsePhraseTemplate('carry sth through something', {
      maxSurfaceTokens: 3,
    });

    expect(tooLong.status).toBe('unsupportedLimit');
    expect(tooWide.status).toBe('unsupportedLimit');
  });

  it('does not treat lexical possessives or contractions as generic possessive slots', () => {
    expect(parsePhraseTemplate("a bird's eye view").nodes).toEqual([
      literal('a'),
      literal("bird's"),
      literal('eye'),
      literal('view'),
    ]);
    expect(parsePhraseTemplate("the apple doesn't fall").nodes).toEqual([
      literal('the'),
      literal('apple'),
      literal("doesn't"),
      literal('fall'),
    ]);
  });

  it('splits slot-led slash groups into pairwise alternatives', () => {
    const result = parsePhraseTemplate("somebody/something can't compete with somebody/something");

    expect(result.nodes).toEqual([
      alternative([slot('person')], [slot('object', 2)]),
      literal("can't"),
      literal('compete'),
      literal('with'),
      alternative([slot('person')], [slot('object', 2)]),
    ]);
  });

  it('pairs a single-atom final segment with the previous segment\'s last atom', () => {
    const result = parsePhraseTemplate("go/come to sb's rescue/aid");

    expect(result.nodes).toEqual([
      alternative([literal('go')], [literal('come'), literal('to'), slot('possessive', 2)]),
      alternative([literal('rescue')], [literal('aid')]),
    ]);
  });

  it('pairs a trailing single slot with the previous segment\'s last slot atom', () => {
    const result = parsePhraseTemplate('have/be nothing to do with somebody/something');

    expect(result.nodes).toEqual([
      alternative([literal('have')], [literal('be')]),
      literal('nothing'),
      literal('to'),
      literal('do'),
      literal('with'),
      alternative([slot('person')], [slot('object', 2)]),
    ]);
  });

  it('pairs the leading slots of two slash groups as alternatives', () => {
    const result = parsePhraseTemplate('get/put somebody/something out of your mind');

    expect(result.nodes).toEqual([
      alternative([literal('get')], [literal('put')]),
      alternative([slot('person')], [slot('object', 2)]),
      literal('out'),
      literal('of'),
      slot('possessive', 2),
      literal('mind'),
    ]);
  });

  it('treats a possessive-slot segment as an alternative sharing the suffix', () => {
    const result = parsePhraseTemplate('our/your/their differences');

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      alternative([literal('our')], [slot('possessive', 2)], [literal('their')]),
      literal('differences'),
    ]);
  });

  it('marks a bare-slot branch among literal-bearing branches as malformed', () => {
    expect(parsePhraseTemplate('go-to-somebody/something').status).toBe('unsupportedMalformed');
    expect(parsePhraseTemplate('my/your/their').status).toBe('unsupportedMalformed');
  });

  it('keeps a literal/slot alternative when literals still guard it', () => {
    const result = parsePhraseTemplate('be the pride of somewhere/sth');

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      literal('be'),
      literal('the'),
      literal('pride'),
      literal('of'),
      alternative([literal('somewhere')], [slot('object')]),
    ]);
  });

  it('folds a trailing single-atom alternative into the suffix of a slot-led group', () => {
    const result = parsePhraseTemplate('take sth up/on');

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      literal('take'),
      slot('object'),
      alternative([literal('up')], [literal('on')]),
    ]);
  });

  it('parses multi-slash alternatives where the final segment shares a suffix', () => {
    const result = parsePhraseTemplate('be/come/arrive late to the party', {
      inflectableLiterals: new Set(['be', 'come', 'arrive']),
    });

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      alternative(
        [literal('be', true)],
        [literal('come', true)],
        [literal('arrive', true)],
      ),
      literal('late'),
      literal('to'),
      literal('the'),
      literal('party'),
    ]);
  });

  it('parses a slot-led final segment as an alternative sharing the suffix', () => {
    const result = parsePhraseTemplate('i / you / somebody for one', {
      inflectableLiterals: new Set(['i', 'you']),
    });

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      alternative(
        [literal('i', true)],
        [literal('you', true)],
        [slot('person')],
      ),
      literal('for'),
      literal('one'),
    ]);
  });

  it('pairs a slot with a determiner literal at the same position', () => {
    const result = parsePhraseTemplate('make/prove your/a point', {
      inflectableLiterals: new Set(['make', 'prove']),
    });

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      alternative([literal('make', true)], [literal('prove', true)]),
      alternative([slot('possessive', 2)], [literal('a')]),
      literal('point'),
    ]);
  });

  it('keeps a slot then preposition tail as shared suffix, not an alternation', () => {
    const result = parsePhraseTemplate('put/set sth in motion', {
      inflectableLiterals: new Set(['put', 'set']),
    });

    expect(result.status).toBe('supported');
    expect(result.nodes).toEqual([
      alternative([literal('put', true)], [literal('set', true)]),
      slot('object'),
      literal('in'),
      literal('motion'),
    ]);
  });
});
