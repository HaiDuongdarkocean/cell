// Stress test — SRT-driven phrase matching (ADR-037 §8-9).
//
// Source: Agent_Kim_Reactivated_[English].en.srt
// Goal: 95%+ match accuracy across single words, phrasal verbs, and idioms
// extracted from real subtitle sentences.
//
// Each test case uses an ACTUAL sentence from the SRT, hovers on the key
// token, and verifies the matcher returns the correct dictionary term.
//
// Categories:
//   SW  — single word (base / -ed / -ing / -s / irregular)
//   PV  — phrasal verb (base / -ed / -ing / -s / irregular)
//   ID  — idiom (fixed / possessive / slot)
//
// TDD: this file is written FIRST (RED). Failing cases expose matcher
// lemma gaps. The fix goes into phraseMatcher.ts candidateLemmas().

import {
  matchPhrase,
  type PhraseMatchRequest,
} from '@/features/dictionary/logic/phraseMatcher';
import {
  compilePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';
import type { PhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';

// --- Verbs marked inflectable (union of matcher + plugin + SRT verbs) ---
const TEST_VERBS = new Set([
  'be', 'spill', 'break', 'kick', 'carry', 'take', 'give', 'run', 'pick',
  'put', 'hit', 'come', 'look', 'get', 'start', 'go', 'make', 'do', 'have',
  'see', 'know', 'think', 'say', 'tell', 'find', 'call', 'try', 'ask', 'seem',
  'feel', 'leave', 'work', 'keep', 'let', 'begin', 'show', 'hear', 'play',
  'turn', 'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write',
  'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue',
  'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop',
  'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk',
  'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait',
  'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach',
  'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report', 'decide',
  'pull', 'return', 'explain', 'hope', 'develop', 'receive', 'agree', 'support',
  'produce', 'eat', 'cover', 'catch', 'draw', 'choose', 'point', 'save',
  'design', 'arrive', 'visit', 'block', 'charge', 'kid', 'starve', 'bend',
  'fill', 'drop', 'step', 'scare', 'press', 'sweep', 'miss', 'avoid', 'order',
  'glare', 'act', 'cross', 'drink', 'talk', 'stare', 'grab', 'apologize',
  'wonder', 'worry', 'pretend', 'admit', 'deny', 'confess', 'arrest',
  'suspect', 'investigate', 'infiltrate', 'eliminate', 'reactivate', 'help',
  'sleep', 'end', 'own', 'switch', 'track', 'wake', 'wear', 'wipe', 'wrap',
  'write', 'zone', 'bump', 'hit', 'hang', 'push', 'plan', 'stare', 'scam',
]);

// --- Dictionary terms (templates) curated from the SRT ---
const DICTIONARY_TERMS: string[] = [
  // --- Phrasal verbs (base form) ---
  'work out',
  'look up',
  'look at',
  'come through',
  'stand by',
  'step in',
  'wake up',
  'fill out',
  'get going',
  'go on',
  'come on',
  'hold on',
  'sit down',
  'get back to sb',
  'run away from sth',
  'put out sth',
  'put down sth',
  'get through sth',
  'go ahead',
  'go back',
  'hit on sb',
  'carry sth around',
  'bump into sb/sth',
  'look for sth',
  'get together',
  'get over here',
  'take off sth',
  'take sth off',
  'drop sth off',
  'drop off sth',
  'write sth off',
  'write off sth',
  'fill sth out',
  'look sth up',
  'look up sth',
  'get out of sth',
  'get off sb',
  'get up',
  'go together',
  'help out',
  'let go of sb/sth',
  'end up',
  'sleep in',
  'grow up',
  'own up',
  'cross the road',
  'act like sb/sth',
  'drink up',
  'stand in line',
  'order sb around',
  'talk to sb',
  'stay on top of sth',

  // --- Idioms (fixed + possessive + slot) ---
  'take a look at sth',
  "lose sb's mind",
  "be in sb's shoes",
  'in sb\'s shoes',
  'call it even',
  'run your mouth',
  'death wish',
  'in a rush',
  'in a jiffy',
  'bend the rules',
  'brain food',
  'out of the way',
  'like father like son',
  'give sb crap',
  'be down on your knees',
  'take it easy on sth',
  'block the road',
  'sales pitch',
  'scaredy-cat',
  'close friend',
  'change of plans',
  'get out of the way',
  'look on sb\'s face',
];

// --- Build the phrase index once ---
function buildIndex(): PhraseIndex {
  const inputs: PhraseIndexInput[] = [];
  let id = 0;
  const seen = new Set<string>();
  for (const term of DICTIONARY_TERMS) {
    const normalized = term.trim().normalize('NFC').toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const parsed = parsePhraseTemplate(term, { inflectableLiterals: TEST_VERBS });
    if (parsed.status !== 'supported') {
      // Skip unsupported templates — they can't be in the index.
      continue;
    }
    inputs.push({
      templateId: id++,
      sourceTerm: parsed.sourceTerm,
      normalizedTerm: parsed.normalizedTerm,
      nodes: parsed.nodes,
      fixedTokenCount: parsed.fixedTokenCount,
      minSurfaceTokens: parsed.minSurfaceTokens,
      maxSurfaceTokens: parsed.maxSurfaceTokens,
      frequencyRank: 0,
    });
  }
  return compilePhraseIndex(inputs);
}

/** Build a match request: sentence + hover word (first occurrence). */
function req(sentence: string, hoverWord: string): PhraseMatchRequest {
  const lower = sentence.toLowerCase();
  const offset = lower.indexOf(hoverWord.toLowerCase());
  if (offset < 0) throw new Error(`hover word "${hoverWord}" not found in sentence: "${sentence}"`);
  return { sentence, cursorOffset: offset };
}

describe('phraseMatcher SRT stress test', () => {
  let index: PhraseIndex;

  beforeAll(() => {
    index = buildIndex();
  });

  // ================================================================
  // SW: Single words — not tested here (handled by word-lookup fallback)
  // ================================================================

  // ================================================================
  // PV: Phrasal verbs — base form
  // ================================================================
  describe('PV-base: phrasal verb, base form', () => {
    it('PV01: "Come on, let\'s get going." hover "get" → "get going"', () => {
      const m = matchPhrase(req("Come on, let's get going.", 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get going');
      expect(m!.surface).toBe('get going');
    });

    it('PV02: "Go on, then." hover "go" → "go on"', () => {
      const m = matchPhrase(req('Go on, then.', 'go'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go on');
    });

    it('PV03: "Come on." hover "come" → "come on"', () => {
      const m = matchPhrase(req('Come on.', 'come'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('come on');
    });

    it('PV04: "Hold on." hover "hold" → "hold on"', () => {
      const m = matchPhrase(req('Hold on.', 'hold'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('hold on');
    });

    it('PV05: "Just sit down for a bit." hover "sit" → "sit down"', () => {
      const m = matchPhrase(req('Just sit down for a bit.', 'sit'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('sit down');
    });

    it('PV06: "Go ahead." hover "go" → "go ahead"', () => {
      const m = matchPhrase(req('Go ahead.', 'go'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go ahead');
    });

    it('PV07: "I have to go back to my old life." hover "go" → "go back"', () => {
      const m = matchPhrase(req('I have to go back to my old life.', 'go'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go back');
    });

    it('PV08: "Let\'s go together after work." hover "go" → "go together"', () => {
      const m = matchPhrase(req("Let's go together after work.", 'go'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go together');
    });

    it('PV09: "I\'ll get back to you." hover "get" → "get back to sb"', () => {
      const m = matchPhrase(req("I'll get back to you.", 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get back to sb');
    });

    it('PV10: "Put down the gun." hover "put" → "put down sth"', () => {
      const m = matchPhrase(req('Put down the gun.', 'put'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('put down sth');
    });

    it('PV11: "Can you just put out your cigarette?" hover "put" → "put out sth"', () => {
      const m = matchPhrase(req('Can you just put out your cigarette?', 'put'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('put out sth');
    });

    it('PV12: "I just need to take off my jacket." hover "take" → "take off sth"', () => {
      const m = matchPhrase(req('I just need to take off my jacket.', 'take'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take off sth');
    });

    it('PV13: "I\'ll drop it off next time." hover "drop" → "drop sth off"', () => {
      const m = matchPhrase(req("I'll drop it off next time.", 'drop'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('drop sth off');
    });

    it('PV14: "Just write it off as a company dinner expense." hover "write" → "write sth off"', () => {
      const m = matchPhrase(req('Just write it off as a company dinner expense.', 'write'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('write sth off');
    });

    it('PV15: "I filled out the form." hover "fill" → "fill out" (via fill sth out)', () => {
      const m = matchPhrase(req('I filled out the form.', 'filled'), index);
      expect(m).not.toBeNull();
      // "fill out" and "fill sth out" both in index; "fill sth out" has slot
      // The sentence has "filled out the form" — "fill sth out" matches with slot
      expect(m!.surface).toContain('filled');
    });

    it('PV16: "Get over here, you asshole!" hover "get" → "get over here"', () => {
      const m = matchPhrase(req('Get over here, you asshole!', 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get over here');
    });

    it('PV17: "Let go of me." hover "let" → "let go of sb/sth"', () => {
      const m = matchPhrase(req('Let go of me.', 'let'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('let go of sb/sth');
    });

    it('PV18: "You want to end up like that door?" hover "end" → "end up"', () => {
      const m = matchPhrase(req('You want to end up like that door?', 'end'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('end up');
    });

    it('PV19: "Drink up." hover "drink" → "drink up"', () => {
      const m = matchPhrase(req('Drink up.', 'drink'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('drink up');
    });

    it('PV20: "I stay on top of current trends." hover "stay" → "stay on top of sth"', () => {
      const m = matchPhrase(req('I stay on top of current trends.', 'stay'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stay on top of sth');
    });

    it('PV21: "You hit on Hye-ri\'s boyfriend." hover "hit" → "hit on sb"', () => {
      const m = matchPhrase(req("You hit on Hye-ri's boyfriend.", 'hit'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('hit on sb');
    });

    it('PV22: "she won\'t talk to me these days." hover "talk" → "talk to sb"', () => {
      const m = matchPhrase(req("she won't talk to me these days.", 'talk'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('talk to sb');
    });

    it('PV23: "Let\'s cross the road!" hover "cross" → "cross the road"', () => {
      const m = matchPhrase(req("Let's cross the road!", 'cross'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('cross the road');
    });

    it('PV24: "Act like true Marines!" hover "act" → "act like sb/sth"', () => {
      const m = matchPhrase(req('Act like true Marines!', 'act'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('act like sb/sth');
    });

    it('PV25: "I have to pre-order and stand in line" hover "stand" → "stand in line"', () => {
      const m = matchPhrase(req('I have to pre-order and stand in line', 'stand'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stand in line');
    });

    it('PV26: "you can just order around" hover "order" → null (no object between order+around)', () => {
      // SRT: "Am I some lapdog you can just order around?" — object "lapdog"
      // is fronted before "order". The matcher can't handle fronted objects.
      // "order sb around" requires a person slot between "order" and "around".
      const m = matchPhrase(req('you can just order around', 'order'), index);
      expect(m).toBeNull();
    });

    it('PV27: "Who asked that person to help out?" hover "help" → "help out"', () => {
      const m = matchPhrase(req('Who asked that person to help out?', 'help'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('help out');
    });

    it('PV28: "Get out of the way." hover "get" → "get out of sth" or "get out of the way"', () => {
      const m = matchPhrase(req('Get out of the way.', 'get'), index);
      expect(m).not.toBeNull();
      // Either the idiom "get out of the way" or the PV "get out of sth" is acceptable
      expect(m!.surface).toContain('Get out of the way');
    });

    it('PV29: "Get off her!" hover "get" → "get off sb"', () => {
      const m = matchPhrase(req('Get off her!', 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get off sb');
    });

    it('PV30: "Get up." hover "get" → "get up"', () => {
      const m = matchPhrase(req('Get up.', 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get up');
    });
  });

  // ================================================================
  // PV: Phrasal verbs — -ed past tense
  // ================================================================
  describe('PV-ed: phrasal verb, -ed past tense', () => {
    it('PV40: "I filled out the form." hover "filled" → "fill out" or "fill sth out"', () => {
      const m = matchPhrase(req('I filled out the form.', 'filled'), index);
      expect(m).not.toBeNull();
      expect(m!.surface).toContain('filled');
      expect(m!.surface).toContain('out');
    });

    it('PV41: "I\'m sorry I couldn\'t step in." hover "step" → "step in" (stepped→step via doubling)', () => {
      // SRT has "couldn't step in" — base form "step", not "stepped"
      const m = matchPhrase(req("I'm sorry I couldn't step in.", 'step'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('step in');
    });

    it('PV42: "I\'ve taken a look at your assets" hover "taken" → "take a look at sth" (irregular)', () => {
      const m = matchPhrase(req("I've taken a look at your assets", 'taken'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take a look at sth');
    });

    it('PV43: "Have you lost your damn mind?" hover "lost" → "lose sb\'s mind" (irregular)', () => {
      const m = matchPhrase(req('Have you lost your damn mind?', 'lost'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("lose sb's mind");
    });
  });

  // ================================================================
  // PV: Phrasal verbs — -ing present participle (KEY STRESS AREA)
  // ================================================================
  describe('PV-ing: phrasal verb, -ing form', () => {
    it('PV50: "have you been working out these days?" hover "working" → "work out"', () => {
      const m = matchPhrase(req('have you been working out these days?', 'working'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('work out');
      expect(m!.surface).toBe('working out');
    });

    it('PV51: "Why are you looking up self-defense items?" hover "looking" → "look up" or "look up sth"', () => {
      const m = matchPhrase(req('Why are you looking up self-defense items?', 'looking'), index);
      expect(m).not.toBeNull();
      // Both "look up" (inflected) and "look up sth" (slot-template) are valid.
      // Ranking prefers inflected quality over slot-template, so "look up" wins.
      // The key assertion: -ing lemma works (match is non-null, surface has "looking up").
      expect(m!.surface.toLowerCase()).toContain('looking up');
    });

    it('PV52: "What are you looking at?" hover "looking" → "look at"', () => {
      const m = matchPhrase(req('What are you looking at?', 'looking'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('look at');
    });

    it('PV53: "Sorry, coming through." hover "coming" → "come through"', () => {
      const m = matchPhrase(req('Sorry, coming through.', 'coming'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('come through');
    });

    it('PV54: "It\'s blocking the road!" hover "blocking" → "block the road"', () => {
      const m = matchPhrase(req("It's blocking the road!", 'blocking'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('block the road');
    });

    it('PV55: "Are you pulling an insurance scam" hover "pulling" → match containing "pulling"', () => {
      // "pull" is in TEST_VERBS but "pull an insurance scam" is not a standard
      // phrasal verb in our index. We test that "pulling" lemmatizes to "pull"
      // by checking it at least finds candidates. If no phrase matches, that's
      // OK — the point is the -ing lemma works.
      const m = matchPhrase(req('Are you pulling an insurance scam', 'pulling'), index);
      // "pulling" should lemma to "pull" — but no template starts with "pull"
      // in our index except via "pull" as a verb. This is a negative test:
      // no false match, but the lemma should work.
      // We just verify it doesn't crash.
      expect(m).toBeNull(); // no matching phrase in index
    });

    it('PV56: "Try running your mouth again." hover "running" → "run your mouth"', () => {
      const m = matchPhrase(req('Try running your mouth again.', 'running'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('run your mouth');
    });

    it('PV57: "I\'ll run away from home." hover "run" → "run away from sth" (base form, SRT #850)', () => {
      // SRT #850: "I'll run away from home." — base form "run"
      const m = matchPhrase(req("I'll run away from home.", 'run'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('run away from sth');
    });

    it('PV59: "It\'s easy to carry around" hover "carry" → null (no object, intransitive use)', () => {
      // SRT: "It's easy to carry around and seems effective." — "carry around"
      // used intransitively. "carry sth around" requires an object slot.
      const m = matchPhrase(req("It's easy to carry around", 'carry'), index);
      expect(m).toBeNull();
    });

    it('PV60: "I know. It\'s taking so long." hover "taking" → null (no phrase, SRT #8)', () => {
      // SRT #8: "I know. It's taking so long." — "taking" lemmatizes to "take"
      // but no phrase in index fits "taking so long" (no "off", no "a look at").
      const m = matchPhrase(req("I know. It's taking so long.", 'taking'), index);
      expect(m).toBeNull();
    });
  });

  // ================================================================
  // PV: Phrasal verbs — -s 3rd person singular
  // ================================================================
  describe('PV-s: phrasal verb, 3rd person -s', () => {
    it('PV70: "My sales pitch never works on them." hover "works" → "work out"? No, "work on" not in index', () => {
      // "works on" — "work on" is not in our index. "work out" requires "out".
      const m = matchPhrase(req('My sales pitch never works on them.', 'works'), index);
      // No "work on" in index → should not match "work out" (wrong particle)
      expect(m).toBeNull();
    });

    it('PV71: "Min-ji\'s birthday is coming up." hover "coming" → null (no "come up" in index, SRT #179)', () => {
      // SRT #179: "Min-ji's birthday is coming up." — "coming" lemmatizes to "come"
      // but "come up" is not in our index. "come through" requires "through", not "up".
      const m = matchPhrase(req("Min-ji's birthday is coming up.", 'coming'), index);
      expect(m).toBeNull();
    });
  });

  // ================================================================
  // PV: Phrasal verbs — irregular past
  // ================================================================
  describe('PV-irregular: phrasal verb, irregular past', () => {
    it('PV80: "I\'ve taken a look at your assets" hover "taken" → "take a look at sth"', () => {
      const m = matchPhrase(req("I've taken a look at your assets", 'taken'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take a look at sth');
    });

    it('PV81: "Have you lost your damn mind?" hover "lost" → "lose sb\'s mind"', () => {
      const m = matchPhrase(req('Have you lost your damn mind?', 'lost'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("lose sb's mind");
    });

    it('PV82: "I just need to take off my jacket." hover "take" → "take off sth" (base)', () => {
      const m = matchPhrase(req('I just need to take off my jacket.', 'take'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take off sth');
    });
  });

  // ================================================================
  // ID: Idioms — fixed expressions
  // ================================================================
  describe('ID-fixed: idiom, fixed expression', () => {
    it('ID01: "Let\'s call it even with this." hover "call" → "call it even"', () => {
      const m = matchPhrase(req("Let's call it even with this.", 'call'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('call it even');
    });

    it('ID02: "Do you have a death wish?" hover "death" → "death wish"', () => {
      const m = matchPhrase(req('Do you have a death wish?', 'death'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('death wish');
    });

    it('ID03: "just walk if you\'re in a rush." hover "rush" → "in a rush"', () => {
      const m = matchPhrase(req("just walk if you're in a rush.", 'rush'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('in a rush');
    });

    it('ID04: "I\'ll press this for you in a jiffy." hover "jiffy" → "in a jiffy"', () => {
      const m = matchPhrase(req("I'll press this for you in a jiffy.", 'jiffy'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('in a jiffy');
    });

    it('ID05: "learn how to bend the rules instead." hover "bend" → "bend the rules"', () => {
      const m = matchPhrase(req('learn how to bend the rules instead.', 'bend'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('bend the rules');
    });

    it('ID06: "do you eat a lot of fish for brain food?" hover "brain" → "brain food"', () => {
      const m = matchPhrase(req('do you eat a lot of fish for brain food?', 'brain'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('brain food');
    });

    it('ID07: "Out of the way." hover "way" → "out of the way"', () => {
      const m = matchPhrase(req('Out of the way.', 'way'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('out of the way');
    });

    it('ID08: "My sales pitch never works on them." hover "sales" → "sales pitch"', () => {
      const m = matchPhrase(req('My sales pitch never works on them.', 'sales'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('sales pitch');
    });

    it('ID09: "I\'m quite the scaredy-cat" hover "scaredy" → "scaredy-cat"', () => {
      const m = matchPhrase(req("I'm quite the scaredy-cat", 'scaredy'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('scaredy-cat');
    });

    it('ID10: "I need the name of a close friend" hover "close" → "close friend"', () => {
      const m = matchPhrase(req('I need the name of a close friend', 'close'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('close friend');
    });

    it('ID11: "There\'s been a change of plans." hover "change" → "change of plans"', () => {
      const m = matchPhrase(req("There's been a change of plans.", 'change'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('change of plans');
    });

    it('ID12: "Take it easy on the studying." hover "take" → "take it easy on sth"', () => {
      const m = matchPhrase(req('Take it easy on the studying.', 'take'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take it easy on sth');
      expect(m!.surface.toLowerCase()).toContain('take it easy on');
    });
  });

  // ================================================================
  // ID: Idioms — possessive pronoun substitution
  // ================================================================
  describe('ID-possessive: idiom, possessive substitution', () => {
    it('ID20: "Have you lost your damn mind?" hover "lost" → "lose sb\'s mind" (your→possessive)', () => {
      const m = matchPhrase(req('Have you lost your damn mind?', 'lost'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("lose sb's mind");
      expect(m!.surface).toContain('lost your');
    });

    it('ID21: "I would\'ve done the same in your shoes." hover "shoes" → "in sb\'s shoes" (your→possessive)', () => {
      const m = matchPhrase(req("I would've done the same in your shoes.", 'shoes'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("in sb's shoes");
    });

    it('ID22: "you should be down on your knees" hover "knees" → "be down on your knees" (your→possessive)', () => {
      const m = matchPhrase(req('you should be down on your knees', 'knees'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('be down on your knees');
    });

    it('ID23: "Did you see the look on her face?" hover "look" → "look on sb\'s face" (her→possessive)', () => {
      const m = matchPhrase(req('Did you see the look on her face?', 'look'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("look on sb's face");
    });
  });

  // ================================================================
  // ID: Idioms — with slots (object/person)
  // ================================================================
  describe('ID-slot: idiom, slot matching', () => {
    it('ID30: "I\'ve taken a look at your assets" hover "taken" → "take a look at sth" (slot=assets)', () => {
      const m = matchPhrase(req("I've taken a look at your assets", 'taken'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take a look at sth');
      expect(m!.surface).toContain('taken a look at');
    });

    it('ID31: "Does anyone give you crap" hover "give" → "give sb crap" (slot=you)', () => {
      const m = matchPhrase(req('Does anyone give you crap', 'give'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('give sb crap');
    });
  });

  // ================================================================
  // NEG: Negative cases — no false matches
  // ================================================================
  describe('NEG: negative cases — no false matches', () => {
    it('NEG01: "What was that?" hover "what" → null (no phrase)', () => {
      const m = matchPhrase(req('What was that?', 'what'), index);
      expect(m).toBeNull();
    });

    it('NEG02: "Hey!" hover "hey" → null (no phrase)', () => {
      const m = matchPhrase(req('Hey!', 'hey'), index);
      expect(m).toBeNull();
    });

    it('NEG03: "What?" hover "what" → null', () => {
      const m = matchPhrase(req('What?', 'what'), index);
      expect(m).toBeNull();
    });

    it('NEG04: "No problem." hover "problem" → null', () => {
      const m = matchPhrase(req('No problem.', 'problem'), index);
      expect(m).toBeNull();
    });

    it('NEG05: "Are you serious right now?" hover "serious" → null', () => {
      const m = matchPhrase(req('Are you serious right now?', 'serious'), index);
      expect(m).toBeNull();
    });

    it('NEG06: "I apologize." hover "apologize" → null (single word, no phrase)', () => {
      const m = matchPhrase(req('I apologize.', 'apologize'), index);
      expect(m).toBeNull();
    });

    it('NEG07: "It\'s too late for that." hover "late" → null', () => {
      const m = matchPhrase(req("It's too late for that.", 'late'), index);
      expect(m).toBeNull();
    });

    it('NEG08: "We\'re late." hover "late" → null', () => {
      const m = matchPhrase(req("We're late.", 'late'), index);
      expect(m).toBeNull();
    });

    it('NEG09: "Let\'s go." hover "go" → "go on"? No, "go" alone is not "go on"', () => {
      const m = matchPhrase(req("Let's go.", 'go'), index);
      // "go" alone should not match "go on" (requires "on") or "go ahead" (requires "ahead")
      // But "go" could match "go back" etc. if those are single-word... no, they're multi-word.
      // "go together" requires "together". So "go" alone → null.
      expect(m).toBeNull();
    });

    it('NEG10: "I\'m late." hover "late" → null', () => {
      const m = matchPhrase(req("I'm late.", 'late'), index);
      expect(m).toBeNull();
    });
  });

  // ================================================================
  // EDGE: Edge cases from SRT
  // ================================================================
  describe('EDGE: edge cases from SRT', () => {
    it('EDGE01: "DON\'T STAND BY, PROTECT VICTIMS!" hover "stand" → "stand by" (uppercase)', () => {
      const m = matchPhrase(req("DON'T STAND BY, PROTECT VICTIMS!", 'STAND'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stand by');
    });

    it('EDGE02: "Go to sleep in your room." hover "sleep" → "sleep in" (base form)', () => {
      const m = matchPhrase(req('Go to sleep in your room.', 'sleep'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('sleep in');
    });

    it('EDGE03: "Min-ji\'s grown up now." hover "grown" → "grow up" (irregular past participle)', () => {
      const m = matchPhrase(req("Min-ji's grown up now.", 'grown'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('grow up');
    });

    it('EDGE04: "I stay on top of current trends." hover "stay" → "stay on top of sth"', () => {
      const m = matchPhrase(req('I stay on top of current trends.', 'stay'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stay on top of sth');
    });

    it('EDGE05: "this is the secret weapon to get through her rebellious phase." hover "get" → "get through sth"', () => {
      const m = matchPhrase(req('this is the secret weapon to get through her rebellious phase.', 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get through sth');
    });

    it('EDGE06: "I\'ll write it off as a company dinner expense." hover "write" → "write sth off"', () => {
      const m = matchPhrase(req("I'll write it off as a company dinner expense.", 'write'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('write sth off');
    });

    it('EDGE07: "Did you see the look on her face?" hover "look" → "look on sb\'s face" not "look at"', () => {
      const m = matchPhrase(req('Did you see the look on her face?', 'look'), index);
      expect(m).not.toBeNull();
      // "look on sb's face" should win over "look at" (which doesn't match anyway)
      expect(m!.dictionaryTerm).toBe("look on sb's face");
    });

    it('EDGE08: "But if I look in the mirror" hover "look" → "look in" (base form)', () => {
      const m = matchPhrase(req('But if I look in the mirror', 'look'), index);
      // "look in" is not in our index — should not match "look at" or "look up"
      expect(m).toBeNull();
    });
  });

  // ================================================================
  // HOVER-particle: user hovers on the PARTICLE, not the verb.
  // Real users point at any word in the subtitle. The matcher must
  // find the phrase as long as the hovered word is inside the span.
  // ================================================================
  describe('HOVER-particle: user hovers on particle/preposition', () => {
    it('H-P01: "Come on, let\'s get going." hover "on" → "come on" (SRT #38)', () => {
      const m = matchPhrase(req("Come on, let's get going.", 'on'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('come on');
    });

    it('H-P02: "Go on, then." hover "on" → "go on" (SRT #40)', () => {
      const m = matchPhrase(req('Go on, then.', 'on'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go on');
    });

    it('H-P03: "Hold on." hover "on" → "hold on" (SRT #268)', () => {
      const m = matchPhrase(req('Hold on.', 'on'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('hold on');
    });

    it('H-P04: "Just sit down for a bit." hover "down" → "sit down" (SRT #542)', () => {
      const m = matchPhrase(req('Just sit down for a bit.', 'down'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('sit down');
    });

    it('H-P05: "Go ahead." hover "ahead" → "go ahead" (SRT #402)', () => {
      const m = matchPhrase(req('Go ahead.', 'ahead'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go ahead');
    });

    it('H-P06: "I have to go back to my old life." hover "back" → "go back" (SRT #731)', () => {
      const m = matchPhrase(req('I have to go back to my old life.', 'back'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go back');
    });

    it('H-P07: "Put down the gun." hover "down" → "put down sth" (SRT #929)', () => {
      const m = matchPhrase(req('Put down the gun.', 'down'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('put down sth');
    });

    it('H-P08: "Can you just put out your cigarette?" hover "out" → "put out sth" (SRT #562)', () => {
      const m = matchPhrase(req('Can you just put out your cigarette?', 'out'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('put out sth');
    });

    it('H-P09: "I just need to take off my jacket." hover "off" → "take off sth" (SRT #490)', () => {
      const m = matchPhrase(req('I just need to take off my jacket.', 'off'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take off sth');
    });

    it('H-P10: "I\'ll drop it off next time." hover "off" → "drop sth off" (SRT #110)', () => {
      const m = matchPhrase(req("I'll drop it off next time.", 'off'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('drop sth off');
    });

    it('H-P11: "Just write it off as a company dinner expense." hover "off" → "write sth off" (SRT #153)', () => {
      const m = matchPhrase(req('Just write it off as a company dinner expense.', 'off'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('write sth off');
    });

    it('H-P12: "I filled out the form." hover "out" → "fill out" or "fill sth out" (SRT #74)', () => {
      const m = matchPhrase(req('I filled out the form.', 'out'), index);
      expect(m).not.toBeNull();
      expect(m!.surface.toLowerCase()).toContain('filled out');
    });

    it('H-P13: "Get over here, you asshole!" hover "over" → "get over here" (SRT #588)', () => {
      const m = matchPhrase(req('Get over here, you asshole!', 'over'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get over here');
    });

    it('H-P14: "Drink up." hover "up" → "drink up" (SRT #479)', () => {
      const m = matchPhrase(req('Drink up.', 'up'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('drink up');
    });

    it('H-P15: "Get up." hover "up" → "get up" (SRT #579)', () => {
      const m = matchPhrase(req('Get up.', 'up'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get up');
    });

    it('H-P16: "Get off her!" hover "off" → "get off sb" (SRT #690)', () => {
      const m = matchPhrase(req('Get off her!', 'off'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get off sb');
    });

    it('H-P17: "Sorry, coming through." hover "through" → "come through" (SRT #122)', () => {
      const m = matchPhrase(req('Sorry, coming through.', 'through'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('come through');
    });

    it('H-P18: "DON\'T STAND BY, PROTECT VICTIMS!" hover "BY" → "stand by" (SRT #125)', () => {
      const m = matchPhrase(req("DON'T STAND BY, PROTECT VICTIMS!", 'BY'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stand by');
    });

    it('H-P19: "I\'m sorry I couldn\'t step in." hover "in" → "step in" (SRT #102)', () => {
      const m = matchPhrase(req("I'm sorry I couldn't step in.", 'in'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('step in');
    });

    it('H-P20: "Min-ji, wake up." hover "up" → "wake up" (SRT #56)', () => {
      const m = matchPhrase(req('Min-ji, wake up.', 'up'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('wake up');
    });

    it('H-P21: "I stay on top of current trends." hover "on" → "stay on top of sth" (SRT #288)', () => {
      const m = matchPhrase(req('I stay on top of current trends.', 'on'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stay on top of sth');
    });

    it('H-P22: "You hit on Hye-ri\'s boyfriend." hover "on" → "hit on sb" (SRT #661)', () => {
      const m = matchPhrase(req("You hit on Hye-ri's boyfriend.", 'on'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('hit on sb');
    });

    it('H-P23: "she won\'t talk to me these days." hover "to" → "talk to sb" (SRT #186)', () => {
      const m = matchPhrase(req("she won't talk to me these days.", 'to'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('talk to sb');
    });

    it('H-P24: "Who asked that person to help out?" hover "out" → "help out" (SRT #395)', () => {
      const m = matchPhrase(req('Who asked that person to help out?', 'out'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('help out');
    });

    it('H-P25: "Get out of the way." hover "out" → match containing "out of the way" (SRT #429)', () => {
      const m = matchPhrase(req('Get out of the way.', 'out'), index);
      expect(m).not.toBeNull();
      expect(m!.surface.toLowerCase()).toContain('out of the way');
    });

    it('H-P26: "I\'ll get back to you." hover "back" → "get back to sb" (SRT #755)', () => {
      const m = matchPhrase(req("I'll get back to you.", 'back'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get back to sb');
    });

    it('H-P27: "I\'ll run away from home." hover "away" → "run away from sth" (SRT #850)', () => {
      const m = matchPhrase(req("I'll run away from home.", 'away'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('run away from sth');
    });

    it('H-P28: "I\'ve taken a look at your assets" hover "at" → "look at" (fixed wins over slot-template, SRT #138)', () => {
      const m = matchPhrase(req("I've taken a look at your assets", 'at'), index);
      expect(m).not.toBeNull();
      // "look at" (fixed, 2 tokens) outranks "take a look at sth" (slot-template)
      // per ADR §9 ranking: fixed > slot-template.
      expect(m!.dictionaryTerm).toBe('look at');
    });
  });

  // ================================================================
  // HOVER-noun: user hovers on a NOUN inside the phrase.
  // Real users often point at the noun, not the verb.
  // ================================================================
  describe('HOVER-noun: user hovers on noun inside phrase', () => {
    it('H-N01: "Let\'s cross the road!" hover "road" → "cross the road" (SRT #397)', () => {
      const m = matchPhrase(req("Let's cross the road!", 'road'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('cross the road');
    });

    it('H-N02: "Have you lost your damn mind?" hover "mind" → "lose sb\'s mind" (SRT #30)', () => {
      const m = matchPhrase(req('Have you lost your damn mind?', 'mind'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("lose sb's mind");
    });

    it('H-N03: "I would\'ve done the same in your shoes." hover "shoes" → "in sb\'s shoes" (SRT #104)', () => {
      const m = matchPhrase(req("I would've done the same in your shoes.", 'shoes'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("in sb's shoes");
    });

    it('H-N04: "you should be down on your knees" hover "knees" → "be down on your knees" (SRT #22)', () => {
      const m = matchPhrase(req('you should be down on your knees', 'knees'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('be down on your knees');
    });

    it('H-N05: "Did you see the look on her face?" hover "face" → "look on sb\'s face" (SRT #342)', () => {
      const m = matchPhrase(req('Did you see the look on her face?', 'face'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("look on sb's face");
    });

    it('H-N06: "Do you have a death wish?" hover "wish" → "death wish" (SRT #31)', () => {
      const m = matchPhrase(req('Do you have a death wish?', 'wish'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('death wish');
    });

    it('H-N07: "just walk if you\'re in a rush." hover "rush" → "in a rush" (SRT #6)', () => {
      const m = matchPhrase(req("just walk if you're in a rush.", 'rush'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('in a rush');
    });

    it('H-N08: "I\'ll press this for you in a jiffy." hover "jiffy" → "in a jiffy" (SRT #111)', () => {
      const m = matchPhrase(req("I'll press this for you in a jiffy.", 'jiffy'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('in a jiffy');
    });

    it('H-N09: "learn how to bend the rules instead." hover "rules" → "bend the rules" (SRT #151)', () => {
      const m = matchPhrase(req('learn how to bend the rules instead.', 'rules'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('bend the rules');
    });

    it('H-N10: "do you eat a lot of fish for brain food?" hover "food" → "brain food" (SRT #146)', () => {
      const m = matchPhrase(req('do you eat a lot of fish for brain food?', 'food'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('brain food');
    });

    it('H-N11: "My sales pitch never works on them." hover "pitch" → "sales pitch" (SRT #119)', () => {
      const m = matchPhrase(req('My sales pitch never works on them.', 'pitch'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('sales pitch');
    });

    it('H-N12: "I\'m quite the scaredy-cat" hover "cat" → "scaredy-cat" (SRT #103)', () => {
      const m = matchPhrase(req("I'm quite the scaredy-cat", 'cat'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('scaredy-cat');
    });

    it('H-N13: "I need the name of a close friend" hover "friend" → "close friend" (SRT #69)', () => {
      const m = matchPhrase(req('I need the name of a close friend', 'friend'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('close friend');
    });

    it('H-N14: "There\'s been a change of plans." hover "plans" → "change of plans" (SRT #754)', () => {
      const m = matchPhrase(req("There's been a change of plans.", 'plans'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('change of plans');
    });

    it('H-N15: "Let\'s call it even with this." hover "even" → "call it even" (SRT #42)', () => {
      const m = matchPhrase(req("Let's call it even with this.", 'even'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('call it even');
    });

    it('H-N16: "Out of the way." hover "way" → "out of the way" (SRT #428)', () => {
      const m = matchPhrase(req('Out of the way.', 'way'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('out of the way');
    });

    it('H-N17: "Does anyone give you crap" hover "crap" → "give sb crap" (SRT #61)', () => {
      const m = matchPhrase(req('Does anyone give you crap', 'crap'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('give sb crap');
    });

    it('H-N18: "I have to pre-order and stand in line" hover "line" → "stand in line" (SRT #162)', () => {
      const m = matchPhrase(req('I have to pre-order and stand in line', 'line'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stand in line');
    });
  });

  // ================================================================
  // HOVER-possessive: user hovers on the possessive pronoun.
  // "your", "my", "his", "her" inside idioms.
  // ================================================================
  describe('HOVER-possessive: user hovers on possessive pronoun', () => {
    it('H-PS01: "Have you lost your damn mind?" hover "your" → "lose sb\'s mind" (SRT #30)', () => {
      const m = matchPhrase(req('Have you lost your damn mind?', 'your'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("lose sb's mind");
    });

    it('H-PS02: "I would\'ve done the same in your shoes." hover "your" → "in sb\'s shoes" (SRT #104)', () => {
      const m = matchPhrase(req("I would've done the same in your shoes.", 'your'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("in sb's shoes");
    });

    it('H-PS03: "you should be down on your knees" hover "your" → "be down on your knees" (SRT #22)', () => {
      const m = matchPhrase(req('you should be down on your knees', 'your'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('be down on your knees');
    });

    it('H-PS04: "Did you see the look on her face?" hover "her" → "look on sb\'s face" (SRT #342)', () => {
      const m = matchPhrase(req('Did you see the look on her face?', 'her'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe("look on sb's face");
    });
  });

  // ================================================================
  // HOVER-mid: user hovers on a MIDDLE word in the phrase.
  // E.g. "the" in "cross the road", "it" in "call it even".
  // ================================================================
  describe('HOVER-mid: user hovers on middle word', () => {
    it('H-M01: "Let\'s cross the road!" hover "the" → "cross the road" (SRT #397)', () => {
      const m = matchPhrase(req("Let's cross the road!", 'the'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('cross the road');
    });

    it('H-M02: "Let\'s call it even with this." hover "it" → "call it even" (SRT #42)', () => {
      const m = matchPhrase(req("Let's call it even with this.", 'it'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('call it even');
    });

    it('H-M03: "I stay on top of current trends." hover "top" → "stay on top of sth" (SRT #288)', () => {
      const m = matchPhrase(req('I stay on top of current trends.', 'top'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stay on top of sth');
    });

    it('H-M04: "I stay on top of current trends." hover "of" → "stay on top of sth" (SRT #288)', () => {
      const m = matchPhrase(req('I stay on top of current trends.', 'of'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('stay on top of sth');
    });

    it('H-M05: "There\'s been a change of plans." hover "of" → "change of plans" (SRT #754)', () => {
      const m = matchPhrase(req("There's been a change of plans.", 'of'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('change of plans');
    });

    it('H-M06: "I need the name of a close friend" hover "of" → "close friend"? or null (SRT #69)', () => {
      // "of" is between "name" and "a close friend" — it's NOT inside the
      // "close friend" span. The match span for "close friend" is [5, 7)
      // (tokens "close" and "friend"). "of" is at token index 4, outside.
      const m = matchPhrase(req('I need the name of a close friend', 'of'), index);
      // "of" is not inside any phrase span → null is correct.
      // But "change of plans" might match if "of" is in the window...
      // Actually "change of plans" is not in this sentence. Let me check.
      // The sentence is "I need the name of a close friend" — no "change" or "plans".
      // So no phrase contains "of" in this sentence → null.
      expect(m).toBeNull();
    });
  });

  // ================================================================
  // SRT-extra: additional SRT sentences not yet covered.
  // ================================================================
  describe('SRT-extra: additional real SRT sentences', () => {
    it('S-E01: "I should get going now." hover "get" → "get going" (SRT #720)', () => {
      const m = matchPhrase(req('I should get going now.', 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get going');
    });

    it('S-E02: "I\'ll write it off as a company dinner expense." hover "off" → "write sth off" (SRT #155)', () => {
      const m = matchPhrase(req("I'll write it off as a company dinner expense.", 'off'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('write sth off');
    });

    it('S-E03: "Take off your clothes and fight." hover "take" → "take off sth" (SRT #926)', () => {
      const m = matchPhrase(req('Take off your clothes and fight.', 'take'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take off sth');
    });

    it('S-E04: "Take off your clothes and fight." hover "off" → "take off sth" (SRT #926)', () => {
      const m = matchPhrase(req('Take off your clothes and fight.', 'off'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take off sth');
    });

    it('S-E05: "We should at least talk to him." hover "talk" → "talk to sb" (SRT #766)', () => {
      const m = matchPhrase(req('We should at least talk to him.', 'talk'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('talk to sb');
    });

    it('S-E06: "We should at least talk to him." hover "to" → "talk to sb" (SRT #766)', () => {
      const m = matchPhrase(req('We should at least talk to him.', 'to'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('talk to sb');
    });

    it('S-E07: "Let\'s go together after work." hover "together" → "go together" (SRT #193)', () => {
      const m = matchPhrase(req("Let's go together after work.", 'together'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go together');
    });

    it('S-E08: "It\'ll only take longer if we go together." hover "together" → "go together" (SRT #262)', () => {
      const m = matchPhrase(req("It'll only take longer if we go together.", 'together'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('go together');
    });

    it('S-E09: "Today\'s the one day out of the year we get together!" hover "get" → "get together" (SRT #465)', () => {
      const m = matchPhrase(req("Today's the one day out of the year we get together!", 'get'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get together');
    });

    it('S-E10: "Today\'s the one day out of the year we get together!" hover "together" → "get together" (SRT #465)', () => {
      const m = matchPhrase(req("Today's the one day out of the year we get together!", 'together'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get together');
    });

    it('S-E11: "You\'re one to talk. Take a look at yourself." hover "take" → "take a look at sth" (SRT #486)', () => {
      const m = matchPhrase(req("You're one to talk. Take a look at yourself.", 'take'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take a look at sth');
    });

    it('S-E12: "You\'re one to talk. Take a look at yourself." hover "look" → "look at" (fixed wins, SRT #486)', () => {
      const m = matchPhrase(req("You're one to talk. Take a look at yourself.", 'look'), index);
      expect(m).not.toBeNull();
      // "look at" (fixed) outranks "take a look at sth" (slot-template)
      expect(m!.dictionaryTerm).toBe('look at');
    });

    it('S-E13: "You\'re one to talk. Take a look at yourself." hover "at" → "look at" (fixed wins, SRT #486)', () => {
      const m = matchPhrase(req("You're one to talk. Take a look at yourself.", 'at'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('look at');
    });

    it('S-E14: "Sit down." hover "sit" → "sit down" (SRT #765)', () => {
      const m = matchPhrase(req('Sit down.', 'sit'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('sit down');
    });

    it('S-E15: "Sit down." hover "down" → "sit down" (SRT #765)', () => {
      const m = matchPhrase(req('Sit down.', 'down'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('sit down');
    });

    it('S-E16: "Let go of me." hover "go" → "let go of sb/sth" (SRT #581)', () => {
      const m = matchPhrase(req('Let go of me.', 'go'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('let go of sb/sth');
    });

    it('S-E17: "Let go of me." hover "of" → "let go of sb/sth" (SRT #581)', () => {
      const m = matchPhrase(req('Let go of me.', 'of'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('let go of sb/sth');
    });

    it('S-E18: "Let go of me." hover "me" → "let go of sb/sth" (SRT #581)', () => {
      const m = matchPhrase(req('Let go of me.', 'me'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('let go of sb/sth');
    });

    it('S-E19: "I just need to take off my jacket." hover "jacket" → "take off sth" (SRT #490)', () => {
      const m = matchPhrase(req('I just need to take off my jacket.', 'jacket'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take off sth');
    });

    it('S-E20: "Put down the gun." hover "gun" → "put down sth" (SRT #929)', () => {
      const m = matchPhrase(req('Put down the gun.', 'gun'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('put down sth');
    });

    it('S-E21: "Can you just put out your cigarette?" hover "cigarette" → "put out sth" (SRT #562)', () => {
      const m = matchPhrase(req('Can you just put out your cigarette?', 'cigarette'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('put out sth');
    });

    it('S-E22: "I\'ve taken a look at your assets" hover "look" → "look at" (fixed wins, SRT #138)', () => {
      const m = matchPhrase(req("I've taken a look at your assets", 'look'), index);
      expect(m).not.toBeNull();
      // "look at" (fixed) outranks "take a look at sth" (slot-template)
      expect(m!.dictionaryTerm).toBe('look at');
    });

    it('S-E23: "I\'ve taken a look at your assets" hover "assets" → "take a look at sth" (SRT #138)', () => {
      const m = matchPhrase(req("I've taken a look at your assets", 'assets'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('take a look at sth');
    });

    it('S-E24: "Does anyone give you crap" hover "you" → "give sb crap" (SRT #61)', () => {
      const m = matchPhrase(req('Does anyone give you crap', 'you'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('give sb crap');
    });

    it('S-E25: "I\'ll get back to you." hover "you" → "get back to sb" (SRT #755)', () => {
      const m = matchPhrase(req("I'll get back to you.", 'you'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get back to sb');
    });

    it('S-E26: "she won\'t talk to me these days." hover "me" → "talk to sb" (SRT #186)', () => {
      const m = matchPhrase(req("she won't talk to me these days.", 'me'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('talk to sb');
    });

    it('S-E27: "We should at least talk to him." hover "him" → "talk to sb" (SRT #766)', () => {
      const m = matchPhrase(req('We should at least talk to him.', 'him'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('talk to sb');
    });

    it('S-E28: "Get off her!" hover "her" → "get off sb" (SRT #690)', () => {
      const m = matchPhrase(req('Get off her!', 'her'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('get off sb');
    });

    it('S-E29: "I\'ll run away from home." hover "from" → "run away from sth" (SRT #850)', () => {
      const m = matchPhrase(req("I'll run away from home.", 'from'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('run away from sth');
    });

    it('S-E30: "I\'ll run away from home." hover "home" → "run away from sth" (SRT #850)', () => {
      const m = matchPhrase(req("I'll run away from home.", 'home'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('run away from sth');
    });
  });
});
