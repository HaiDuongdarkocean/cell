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
});
