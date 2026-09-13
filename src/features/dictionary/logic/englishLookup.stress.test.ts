// englishLookup stress test — TDD benchmark for English lookup matching.
//
// This file is the accuracy gate for vocabulary lookup improvements.
// Each test case checks that a surface word (often a contraction or inflected
// form) resolves to the correct dictionary base form via englishLookupCandidates.
//
// Loop focus: English surface-form → dictionary base-form matching.
// Each describe block is a loop iteration target.

import { describe, expect, it } from '@jest/globals';
import { englishLookupCandidates } from './englishLemma';

describe("englishLookup stress — loop 1: negative contractions (n't)", () => {
  const cases: Array<[string, string]> = [
    ["don't", 'do'],
    ["doesn't", 'do'],
    ["didn't", 'do'],
    ["can't", 'can'],
    ["couldn't", 'could'],
    ["won't", 'will'],
    ["wouldn't", 'would'],
    ["shouldn't", 'should'],
    ["shan't", 'shall'],
    ["mustn't", 'must'],
    ["mightn't", 'might'],
    ["needn't", 'need'],
    ["isn't", 'be'],
    ["aren't", 'be'],
    ["wasn't", 'be'],
    ["weren't", 'be'],
    ["haven't", 'have'],
    ["hasn't", 'have'],
    ["hadn't", 'have'],
    ["oughtn't", 'ought'],
  ];

  for (const [surface, expected] of cases) {
    it(`expands "${surface}" to include "${expected}"`, () => {
      const candidates = englishLookupCandidates(surface);
      expect(candidates).toContain(expected);
    });
  }

  it('preserves original contraction as fallback', () => {
    expect(englishLookupCandidates("don't")).toContain("don't");
  });

  it("handles curly apostrophe in don't", () => {
    expect(englishLookupCandidates('don\u2019t')).toContain('do');
  });
});

describe("englishLookup stress — loop 2: subject-auxiliary clitics", () => {
  const cases: Array<[string, string]> = [
    ["I'm", 'be'],
    ["you're", 'be'],
    ["we're", 'be'],
    ["they're", 'be'],
    ["he's", 'be'],
    ["she's", 'be'],
    ["it's", 'be'],
    ["I've", 'have'],
    ["you've", 'have'],
    ["we've", 'have'],
    ["they've", 'have'],
    ["I'll", 'will'],
    ["you'll", 'will'],
    ["he'll", 'will'],
    ["we'll", 'will'],
    ["they'll", 'will'],
    ["I'd", 'would'],
    ["you'd", 'would'],
    ["he'd", 'would'],
    ["we'd", 'would'],
    ["they'd", 'would'],
  ];

  for (const [surface, expected] of cases) {
    it(`expands "${surface}" to include "${expected}"`, () => {
      expect(englishLookupCandidates(surface)).toContain(expected);
    });
  }
});

describe('englishLookup stress — loop 4: possessives', () => {
  const cases: Array<[string, string]> = [
    ["cat's", 'cat'],
    ["dogs'", 'dog'],
    ["children's", 'child'],
    ["men's", 'man'],
    ["women's", 'woman'],
    ["John's", 'john'],
  ];

  for (const [surface, expected] of cases) {
    it(`normalizes "${surface}" to include "${expected}"`, () => {
      expect(englishLookupCandidates(surface)).toContain(expected);
    });
  }
});

describe('englishLookup stress — loop 6: Latin/Greek irregular plurals', () => {
  const cases: Array<[string, string]> = [
    ['data', 'datum'],
    ['bacteria', 'bacterium'],
    ['fungi', 'fungus'],
    ['cacti', 'cactus'],
    ['stimuli', 'stimulus'],
    ['alumni', 'alumnus'],
    ['radii', 'radius'],
    ['nuclei', 'nucleus'],
    ['indices', 'index'],
    ['appendices', 'appendix'],
    ['matrices', 'matrix'],
    ['vertices', 'vertex'],
    ['analyses', 'analysis'],
    ['axes', 'axis'],
    ['crises', 'crisis'],
    ['theses', 'thesis'],
    ['diagnoses', 'diagnosis'],
    ['oases', 'oasis'],
    ['criteria', 'criterion'],
    ['phenomena', 'phenomenon'],
    ['strata', 'stratum'],
    ['media', 'medium'],
    ['curricula', 'curriculum'],
    ['larvae', 'larva'],
    ['vertebrae', 'vertebra'],
    ['antennae', 'antenna'],
    ['formulae', 'formula'],
  ];

  for (const [surface, expected] of cases) {
    it(`lemmatizes "${surface}" to "${expected}"`, () => {
      expect(englishLookupCandidates(surface)).toContain(expected);
    });
  }
});

describe('englishLookup stress — loop 7: derivational suffixes', () => {
  const cases: Array<[string, string]> = [
    ['happiness', 'happy'],
    ['sadness', 'sad'],
    ['kindness', 'kind'],
    ['employment', 'employ'],
    ['development', 'develop'],
    ['movement', 'move'],
    ['decision', 'decide'],
    ['action', 'act'],
    ['ability', 'able'],
    ['reality', 'real'],
    ['cruelty', 'cruel'],
    ['safety', 'safe'],
    ['beautiful', 'beauty'],
    ['helpful', 'help'],
    ['homeless', 'home'],
    ['careless', 'care'],
    ['quickly', 'quick'],
    ['happily', 'happy'],
    ['carefully', 'careful'],
    ['teacher', 'teach'],
    ['actor', 'act'],
    ['worker', 'work'],
    ['artist', 'art'],
    ['scientist', 'science'],
  ];

  for (const [surface, expected] of cases) {
    it(`derives "${surface}" to include "${expected}"`, () => {
      expect(englishLookupCandidates(surface)).toContain(expected);
    });
  }
});

describe('englishLookup stress — loop 8: hyphenated compounds', () => {
  const cases: Array<[string, string[]]> = [
    ['well-known', ['well-known', 'well', 'known']],
    ['mother-in-law', ['mother-in-law', 'mother', 'law']],
    ['good-looking', ['good-looking', 'good', 'looking']],
    ['co-operate', ['co-operate', 'co', 'operate']],
    ['twenty-first', ['twenty-first', 'twenty', 'first']],
  ];

  for (const [surface, expectedList] of cases) {
    it(`splits "${surface}" into base parts`, () => {
      const candidates = englishLookupCandidates(surface);
      for (const expected of expectedList) {
        expect(candidates).toContain(expected);
      }
    });
  }
});

describe('englishLookup stress — loop 10: combined real-world edge cases', () => {
  const cases: Array<[string, string]> = [
    ['don\u2019t', 'do'],
    ["can't", 'can'],
    ["won't", 'will'],
    ['well-known', 'known'],
    ['good-looking', 'good'],
    ['happiness', 'happy'],
    ['quickly', 'quick'],
    ['children', 'child'],
    ['children\u2019s', 'child'],
    ['bacteria', 'bacterium'],
    ['analyses', 'analysis'],
    ["I'm", 'be'],
    ["it's", 'be'],
  ];

  for (const [surface, expected] of cases) {
    it(`resolves "${surface}" to "${expected}"`, () => {
      expect(englishLookupCandidates(surface)).toContain(expected);
    });
  }
});

describe('englishLookup stress — loop 3: informal / spoken contractions', () => {
  const cases: Array<[string, string]> = [
    ["let's", 'let'],
    ['gonna', 'go'],
    ['wanna', 'want'],
    ['gotta', 'get'],
    ['kinda', 'kind'],
    ['sorta', 'sort'],
    ["'em", 'them'],
    ["'cause", 'because'],
    ["o'", 'of'],
    ["ain't", 'be'],
    ['yall', 'you'],
    ["y'all", 'you'],
  ];

  for (const [surface, expected] of cases) {
    it(`expands "${surface}" to include "${expected}"`, () => {
      expect(englishLookupCandidates(surface)).toContain(expected);
    });
  }
});
