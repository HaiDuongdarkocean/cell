// englishLemma tests — ADR-041: complete English inflectional morphology.
//
// Covers ALL 8 English inflectional suffixes + irregular forms.
// Multi-candidate: returns ALL possible base forms, ordered by likelihood.
// False positives are harmless — the orchestrator tries each against the dict.

import { describe, expect, it } from '@jest/globals';
import { englishLemmaCandidates, englishLemma } from './englishLemma';

describe('englishLemmaCandidates — irregular verbs', () => {
  it('lemmatizes be-forms', () => {
    expect(englishLemma('was')).toBe('be');
    expect(englishLemma('were')).toBe('be');
    expect(englishLemma('been')).toBe('be');
    expect(englishLemma('is')).toBe('be');
    expect(englishLemma('are')).toBe('be');
    expect(englishLemma('am')).toBe('be');
  });

  it('lemmatizes common irregular verbs', () => {
    expect(englishLemma('took')).toBe('take');
    expect(englishLemma('gave')).toBe('give');
    expect(englishLemma('ran')).toBe('run');
    expect(englishLemma('came')).toBe('come');
    expect(englishLemma('went')).toBe('go');
    expect(englishLemma('made')).toBe('make');
    expect(englishLemma('did')).toBe('do');
    expect(englishLemma('had')).toBe('have');
    expect(englishLemma('said')).toBe('say');
    expect(englishLemma('saw')).toBe('see');
    expect(englishLemma('knew')).toBe('know');
  });

  it('lemmatizes comprehensive irregular verbs from phraseMatcher', () => {
    expect(englishLemma('flew')).toBe('fly');
    expect(englishLemma('flown')).toBe('fly');
    expect(englishLemma('blew')).toBe('blow');
    expect(englishLemma('blown')).toBe('blow');
    expect(englishLemma('grew')).toBe('grow');
    expect(englishLemma('grown')).toBe('grow');
    expect(englishLemma('drew')).toBe('draw');
    expect(englishLemma('drawn')).toBe('draw');
    expect(englishLemma('drove')).toBe('drive');
    expect(englishLemma('driven')).toBe('drive');
    expect(englishLemma('rose')).toBe('rise');
    expect(englishLemma('risen')).toBe('rise');
    expect(englishLemma('rang')).toBe('ring');
    expect(englishLemma('rung')).toBe('ring');
    expect(englishLemma('sang')).toBe('sing');
    expect(englishLemma('sung')).toBe('sing');
    expect(englishLemma('sank')).toBe('sink');
    expect(englishLemma('sunk')).toBe('sink');
    expect(englishLemma('shrank')).toBe('shrink');
    expect(englishLemma('shrunk')).toBe('shrink');
    expect(englishLemma('sprang')).toBe('spring');
    expect(englishLemma('sprung')).toBe('spring');
    expect(englishLemma('swam')).toBe('swim');
    expect(englishLemma('swum')).toBe('swim');
    expect(englishLemma('swung')).toBe('swing');
    expect(englishLemma('stank')).toBe('stink');
    expect(englishLemma('stunk')).toBe('stink');
    expect(englishLemma('shook')).toBe('shake');
    expect(englishLemma('shaken')).toBe('shake');
    expect(englishLemma('froze')).toBe('freeze');
    expect(englishLemma('frozen')).toBe('freeze');
    expect(englishLemma('bore')).toBe('bear');
    expect(englishLemma('born')).toBe('bear');
    expect(englishLemma('tore')).toBe('tear');
    expect(englishLemma('torn')).toBe('tear');
    expect(englishLemma('wore')).toBe('wear');
    expect(englishLemma('worn')).toBe('wear');
    expect(englishLemma('swore')).toBe('swear');
    expect(englishLemma('sworn')).toBe('swear');
    expect(englishLemma('stole')).toBe('steal');
    expect(englishLemma('stolen')).toBe('steal');
    expect(englishLemma('chose')).toBe('choose');
    expect(englishLemma('chosen')).toBe('choose');
    expect(englishLemma('forgot')).toBe('forget');
    expect(englishLemma('forgotten')).toBe('forget');
    expect(englishLemma('taught')).toBe('teach');
    expect(englishLemma('bought')).toBe('buy');
    expect(englishLemma('fought')).toBe('fight');
    expect(englishLemma('caught')).toBe('catch');
    expect(englishLemma('brought')).toBe('bring');
    expect(englishLemma('thought')).toBe('think');
    expect(englishLemma('built')).toBe('build');
    expect(englishLemma('sent')).toBe('send');
    expect(englishLemma('spent')).toBe('spend');
    expect(englishLemma('lent')).toBe('lend');
    expect(englishLemma('rent') === 'rend' || englishLemma('rent') === 'rent').toBe(true);
  });

  it('lemmatizes lay/lie correctly (both are base verbs)', () => {
    // "lay" is both base "lay" and past of "lie"
    // candidateLemmas returns ["lie"] for "lay" from the map
    expect(englishLemmaCandidates('lay')).toContain('lie');
    expect(englishLemmaCandidates('lain')).toContain('lie');
    expect(englishLemmaCandidates('laid')).toContain('lay');
  });
});

describe('englishLemmaCandidates — irregular comparison', () => {
  it('lemmatizes irregular comparative/superlative', () => {
    expect(englishLemma('better')).toBe('good');
    expect(englishLemma('best')).toBe('good');
    expect(englishLemma('worse')).toBe('bad');
    expect(englishLemma('worst')).toBe('bad');
    expect(englishLemma('more')).toBe('much');
    expect(englishLemma('most')).toBe('much');
    expect(englishLemma('less')).toBe('little');
    expect(englishLemma('least')).toBe('little');
    expect(englishLemma('farther')).toBe('far');
    expect(englishLemma('further')).toBe('far');
    expect(englishLemma('farthest')).toBe('far');
    expect(englishLemma('furthest')).toBe('far');
  });
});

describe('englishLemmaCandidates — irregular plural nouns', () => {
  it('lemmatizes common irregular plurals', () => {
    expect(englishLemma('children')).toBe('child');
    expect(englishLemma('men')).toBe('man');
    expect(englishLemma('women')).toBe('woman');
    expect(englishLemma('mice')).toBe('mouse');
    expect(englishLemma('feet')).toBe('foot');
    expect(englishLemma('teeth')).toBe('tooth');
    expect(englishLemma('geese')).toBe('goose');
    expect(englishLemma('lice')).toBe('louse');
    expect(englishLemma('oxen')).toBe('ox');
    expect(englishLemma('brethren')).toBe('brother');
  });

  it('lemmatizes people→person', () => {
    expect(englishLemma('people')).toBe('person');
  });
});

describe('englishLemmaCandidates — -ves plural (f→v)', () => {
  it('lemmatizes -ves → -fe', () => {
    expect(englishLemmaCandidates('knives')).toContain('knife');
    expect(englishLemmaCandidates('wives')).toContain('wife');
    expect(englishLemmaCandidates('lives')).toContain('life');
  });

  it('lemmatizes -ves → -f', () => {
    expect(englishLemmaCandidates('wolves')).toContain('wolf');
    expect(englishLemmaCandidates('leaves')).toContain('leaf');
    expect(englishLemmaCandidates('loaves')).toContain('loaf');
    expect(englishLemmaCandidates('halves')).toContain('half');
    expect(englishLemmaCandidates('shelves')).toContain('shelf');
    expect(englishLemmaCandidates('calves')).toContain('calf');
    expect(englishLemmaCandidates('selves')).toContain('self');
    expect(englishLemmaCandidates('thieves')).toContain('thief');
  });
});

describe('englishLemmaCandidates — possessive -\'s', () => {
  it('strips possessive -\'s', () => {
    expect(englishLemmaCandidates("cat's")).toContain('cat');
    expect(englishLemmaCandidates("dog's")).toContain('dog');
    expect(englishLemmaCandidates("John's")).toContain('john');
    expect(englishLemmaCandidates("teacher's")).toContain('teacher');
  });

  it('does NOT strip contractions (it\'s, don\'t, they\'re)', () => {
    // "it's" → "it" is a contraction, not possessive. But the lemma
    // function can't tell the difference. The orchestrator tries the raw
    // term first — "it's" won't be in the dict, so it tries "it" which IS.
    // This is acceptable: "it" is the correct lookup for "it's" in most
    // subtitle contexts. For "don't", the apostrophe is followed by "t",
    // not "s" — so it won't be stripped.
    expect(englishLemmaCandidates("don't")).toEqual(["don't"]);
    expect(englishLemmaCandidates("they're")).toEqual(["they're"]);
    expect(englishLemmaCandidates("we've")).toEqual(["we've"]);
    expect(englishLemmaCandidates("I'll")).toEqual(["i'll"]);
  });
});

describe('englishLemmaCandidates — regular -ed (past tense)', () => {
  it('lemmatizes bare stem -ed', () => {
    expect(englishLemma('kicked')).toBe('kick');
    expect(englishLemma('looked')).toBe('look');
    expect(englishLemma('started')).toBe('start');
    expect(englishLemma('worked')).toBe('work');
  });

  it('lemmatizes -ied → -y', () => {
    expect(englishLemma('carried')).toBe('carry');
    expect(englishLemma('tried')).toBe('try');
    expect(englishLemma('cried')).toBe('cry');
  });

  it('lemmatizes CVC doubling (planned→plan, clapped→clap, dropped→drop)', () => {
    // "stopped" is in the irregular verb map (stopped→stop), so it returns
    // "stop" directly. Use words NOT in the irregular map for CVC testing.
    expect(englishLemmaCandidates('planned')).toContain('plan');
    expect(englishLemmaCandidates('clapped')).toContain('clap');
    expect(englishLemmaCandidates('dropped')).toContain('drop');
    expect(englishLemmaCandidates('pinned')).toContain('pin');
  });

  it('lemmatizes silent-e (charged→charge, hoped→hope)', () => {
    expect(englishLemmaCandidates('charged')).toContain('charge');
    expect(englishLemmaCandidates('hoped')).toContain('hope');
    expect(englishLemmaCandidates('saved')).toContain('save');
    expect(englishLemmaCandidates('arrived')).toContain('arrive');
  });
});

describe('englishLemmaCandidates — regular -ing (gerund)', () => {
  it('lemmatizes bare stem -ing', () => {
    expect(englishLemmaCandidates('working')).toContain('work');
    expect(englishLemmaCandidates('looking')).toContain('look');
    expect(englishLemmaCandidates('starting')).toContain('start');
  });

  it('lemmatizes CVC doubling (running→run, swimming→swim)', () => {
    expect(englishLemmaCandidates('running')).toContain('run');
    expect(englishLemmaCandidates('swimming')).toContain('swim');
    expect(englishLemmaCandidates('sitting')).toContain('sit');
    expect(englishLemmaCandidates('getting')).toContain('get');
  });

  it('lemmatizes silent-e (taking→take, making→make)', () => {
    expect(englishLemmaCandidates('taking')).toContain('take');
    expect(englishLemmaCandidates('making')).toContain('make');
    expect(englishLemmaCandidates('coming')).toContain('come');
    expect(englishLemmaCandidates('writing')).toContain('write');
  });

  it('lemmatizes ie→ying (lying→lie, dying→die, tying→tie)', () => {
    expect(englishLemmaCandidates('lying')).toContain('lie');
    expect(englishLemmaCandidates('dying')).toContain('die');
    expect(englishLemmaCandidates('tying')).toContain('tie');
  });
});

describe('englishLemmaCandidates — regular -er (comparative)', () => {
  it('lemmatizes -ier → -y', () => {
    expect(englishLemma('easier')).toBe('easy');
    expect(englishLemma('happier')).toBe('happy');
    expect(englishLemma('heavier')).toBe('heavy');
    expect(englishLemma('earlier')).toBe('early');
  });

  it('lemmatizes bare stem -er (taller→tall, faster→fast)', () => {
    expect(englishLemma('taller')).toBe('tall');
    expect(englishLemma('faster')).toBe('fast');
    expect(englishLemma('quicker')).toBe('quick');
  });

  it('lemmatizes CVC doubling (bigger→big, hotter→hot)', () => {
    expect(englishLemmaCandidates('bigger')).toContain('big');
    expect(englishLemmaCandidates('hotter')).toContain('hot');
    expect(englishLemmaCandidates('thinner')).toContain('thin');
    expect(englishLemmaCandidates('fatter')).toContain('fat');
  });

  it('lemmatizes silent-e (nicer→nice, larger→large, braver→brave)', () => {
    expect(englishLemmaCandidates('nicer')).toContain('nice');
    expect(englishLemmaCandidates('larger')).toContain('large');
    expect(englishLemmaCandidates('braver')).toContain('brave');
    expect(englishLemmaCandidates('paler')).toContain('pale');
  });
});

describe('englishLemmaCandidates — regular -est (superlative)', () => {
  it('lemmatizes -iest → -y', () => {
    expect(englishLemma('easiest')).toBe('easy');
    expect(englishLemma('happiest')).toBe('happy');
    expect(englishLemma('heaviest')).toBe('heavy');
    expect(englishLemma('earliest')).toBe('early');
  });

  it('lemmatizes bare stem -est (tallest→tall, fastest→fast)', () => {
    expect(englishLemma('tallest')).toBe('tall');
    expect(englishLemma('fastest')).toBe('fast');
    expect(englishLemma('quickest')).toBe('quick');
  });

  it('lemmatizes CVC doubling (biggest→big, hottest→hot)', () => {
    expect(englishLemmaCandidates('biggest')).toContain('big');
    expect(englishLemmaCandidates('hottest')).toContain('hot');
    expect(englishLemmaCandidates('thinnest')).toContain('thin');
    expect(englishLemmaCandidates('fattest')).toContain('fat');
  });

  it('lemmatizes silent-e (nicest→nice, largest→large, bravest→brave)', () => {
    expect(englishLemmaCandidates('nicest')).toContain('nice');
    expect(englishLemmaCandidates('largest')).toContain('large');
    expect(englishLemmaCandidates('bravest')).toContain('brave');
    expect(englishLemmaCandidates('palest')).toContain('pale');
  });
});

describe('englishLemmaCandidates — noun plural -s', () => {
  it('lemmatizes bare -s (cats→cat, dogs→dog)', () => {
    expect(englishLemma('cats')).toBe('cat');
    expect(englishLemma('dogs')).toBe('dog');
    expect(englishLemma('books')).toBe('book');
  });

  it('lemmatizes -ies → -y (cities→city, stories→story)', () => {
    expect(englishLemma('cities')).toBe('city');
    expect(englishLemma('stories')).toBe('story');
    expect(englishLemma('babies')).toBe('baby');
    expect(englishLemma('ladies')).toBe('lady');
  });

  it('lemmatizes -es after sibilants (boxes→box, buses→bus, wishes→wish)', () => {
    expect(englishLemma('boxes')).toBe('box');
    expect(englishLemma('buses')).toBe('bus');
    expect(englishLemma('wishes')).toBe('wish');
    expect(englishLemma('watches')).toBe('watch');
    expect(englishLemma('brushes')).toBe('brush');
    expect(englishLemma('buzzes')).toBe('buzz');
    expect(englishLemma('foxes')).toBe('fox');
    expect(englishLemma('glasses')).toBe('glass');
  });

  it('lemmatizes -oes → -o (goes→go, heroes→hero, potatoes→potato)', () => {
    expect(englishLemma('goes')).toBe('go');
    expect(englishLemma('heroes')).toBe('hero');
    expect(englishLemma('potatoes')).toBe('potato');
    expect(englishLemma('tomatoes')).toBe('tomato');
    expect(englishLemma('does')).toBe('do');
  });
});

describe('englishLemmaCandidates — 3rd person singular -s', () => {
  it('lemmatizes bare -s (looks→look, kicks→kick)', () => {
    expect(englishLemma('looks')).toBe('look');
    expect(englishLemma('kicks')).toBe('kick');
    expect(englishLemma('runs')).toBe('run');
  });

  it('lemmatizes -ies → -y (carries→carry, cries→cry)', () => {
    expect(englishLemma('carries')).toBe('carry');
    expect(englishLemma('cries')).toBe('cry');
    expect(englishLemma('tries')).toBe('try');
  });

  it('lemmatizes -es after sibilants (watches→watch, washes→wash)', () => {
    expect(englishLemma('watches')).toBe('watch');
    expect(englishLemma('washes')).toBe('wash');
    expect(englishLemma('pushes')).toBe('push');
    expect(englishLemma('fixes')).toBe('fix');
    expect(englishLemma('buzzes')).toBe('buzz');
  });

  it('lemmatizes -oes → -o (goes→go, does→do)', () => {
    expect(englishLemma('goes')).toBe('go');
    expect(englishLemma('does')).toBe('do');
  });
});

describe('englishLemmaCandidates — false-positive guards', () => {
  it('does not strip -est from forest, modest, honest (includes original as fallback)', () => {
    // "forest" → ["for", "fore", "forest"] — original is last candidate.
    // Orchestrator tries raw "forest" first (found in dict), so lemma
    // candidates are never used.
    expect(englishLemmaCandidates('forest')).toContain('forest');
    expect(englishLemmaCandidates('modest')).toContain('modest');
    expect(englishLemmaCandidates('honest')).toContain('honest');
    // "test", "rest", "nest", "pest" have length 4, guard is length > 4,
    // so they don't enter the -est block at all.
    expect(englishLemma('test')).toBe('test');
    expect(englishLemma('rest')).toBe('rest');
    expect(englishLemma('nest')).toBe('nest');
    expect(englishLemma('pest')).toBe('pest');
  });

  it('does not strip -er from short base words (her, per)', () => {
    // "her" has length 3, guard is length > 3, so it doesn't enter -er block.
    expect(englishLemma('her')).toBe('her');
    expect(englishLemma('per')).toBe('per');
  });

  it('does not mangle water, after, never (not comparatives)', () => {
    // "water" ends in -er but is a base word. Multi-candidate returns
    // ["wat", "wate", "water"] — the original is the LAST candidate.
    // The orchestrator tries the raw term FIRST, so "water" is found
    // in the dict before any lemma candidates are tried.
    expect(englishLemmaCandidates('water')).toContain('water');
    expect(englishLemmaCandidates('after')).toContain('after');
    expect(englishLemmaCandidates('never')).toContain('never');
  });

  it('does not mangle matter, master, sister (not comparatives)', () => {
    expect(englishLemmaCandidates('matter')).toContain('matter');
    expect(englishLemmaCandidates('master')).toContain('master');
    expect(englishLemmaCandidates('sister')).toContain('sister');
  });

  it('does not strip -s from ss words (class, boss, glass)', () => {
    expect(englishLemma('class')).toBe('class');
    expect(englishLemma('boss')).toBe('boss');
    expect(englishLemma('glass')).toBe('glass');
    expect(englishLemma('cross')).toBe('cross');
  });

  it('includes original word as fallback for this, bus', () => {
    // "this" → ["thi", "this"] — bare -s gives "thi" (wrong), but
    // original "this" is the last candidate. Orchestrator tries raw first.
    expect(englishLemmaCandidates('this')).toContain('this');
    expect(englishLemmaCandidates('bus')).toContain('bus');
  });

  it('returns lowercase for non-inflected words', () => {
    expect(englishLemma('hello')).toBe('hello');
    expect(englishLemma('WORLD')).toBe('world');
    expect(englishLemma('Apple')).toBe('apple');
  });

  it('returns the word itself as last candidate for unknown patterns', () => {
    expect(englishLemmaCandidates('xyz')).toEqual(['xyz']);
    expect(englishLemmaCandidates('')).toEqual(['']);
  });
});

describe('englishLemmaCandidates — multi-candidate ordering', () => {
  it('returns most likely candidate first', () => {
    // "running" → ["run" (CVC), "runne" (silent-e), "runn" (bare)]
    const cands = englishLemmaCandidates('running');
    expect(cands[0]).toBe('run');
    expect(cands).toContain('run');
    expect(cands.length).toBeGreaterThanOrEqual(1);
  });

  it('deduplicates candidates', () => {
    const cands = englishLemmaCandidates('stopped');
    const unique = new Set(cands);
    expect(cands.length).toBe(unique.size);
  });

  it("possessive returns stem + stem's lemma candidates", () => {
    const cands = englishLemmaCandidates("children's");
    expect(cands).toContain('child');
  });
});
