// englishLemma — ADR-041: Complete English inflectional morphology lemma.
//
// Multi-candidate lemmatization: returns ALL possible base forms for a word,
// ordered by likelihood. False positives are harmless — the caller (orchestrator
// or phrase matcher) tries each against the dictionary and keeps the ones that
// match. The original word is always included as the last candidate so the
// caller can fall back to it.
//
// Covers ALL 8 English inflectional suffixes (closed class):
//   1. -s  (3rd person singular verb): looks→look, goes→go, watches→watch
//   2. -ed (past tense / past participle): kicked→kick, stopped→step, charged→charge
//   3. -ing (gerund / present participle): running→run, taking→take, lying→lie
//   4. -er (comparative): taller→tall, easier→easy, bigger→big, nicer→nice
//   5. -est (superlative): tallest→tall, easiest→easy, biggest→big, nicest→nice
//   6. -s  (plural noun): cats→cat, cities→city, boxes→box, knives→knife
//   7. -'s (possessive singular): cat's→cat, dog's→dog
//   8. -s  (possessive plural — rare, handled same as #6)
//
// Plus irregular forms (closed classes):
//   - Irregular verbs (~250 entries, merged from phraseMatcher + englishPlugin)
//   - Irregular comparison (better→good, worse→bad, etc.)
//   - Irregular plural nouns (children→child, men→man, mice→mouse, etc.)
//
// ponytail: no lexicon lookup — this is a pure function with no I/O. The
// multi-candidate approach handles ambiguity (CVC doubling, silent-e) by
// returning all possibilities. The orchestrator tries raw term FIRST, then
// iterates candidates. False lemmas that aren't in the dict are discarded.
// O(1) per token, bounded to ≤6 candidates.

/** Irregular verb forms → base verb. Merged from phraseMatcher + englishPlugin.
 * ponytail: forms that are ALSO base verbs (lay, found, saw, bore, etc.) are
 * safe — the orchestrator tries the raw term first, so "lay" matches both
 * "lay" (exact dict entry) and "lie" (lemma candidate). */
const IRREGULAR_VERBS: ReadonlyMap<string, string> = new Map([
  ['was', 'be'], ['were', 'be'], ['been', 'be'], ['being', 'be'], ['is', 'be'], ['are', 'be'], ['am', 'be'],
  ['spilled', 'spill'], ['spilt', 'spill'],
  ['broke', 'break'], ['broken', 'break'],
  ['kicked', 'kick'],
  ['carried', 'carry'],
  ['took', 'take'], ['taken', 'take'],
  ['gave', 'give'], ['given', 'give'],
  ['ran', 'run'],
  ['picked', 'pick'],
  ['put', 'put'],
  ['hit', 'hit'],
  ['came', 'come'],
  ['looked', 'look'],
  ['got', 'get'], ['gotten', 'get'],
  ['started', 'start'],
  ['went', 'go'], ['gone', 'go'],
  ['made', 'make'],
  ['did', 'do'], ['done', 'do'],
  ['had', 'have'], ['has', 'have'],
  ['said', 'say'],
  ['saw', 'see'], ['seen', 'see'],
  ['knew', 'know'], ['known', 'know'],
  ['found', 'find'],
  ['told', 'tell'],
  ['called', 'call'],
  ['tried', 'try'],
  ['asked', 'ask'],
  ['felt', 'feel'],
  ['left', 'leave'],
  ['worked', 'work'],
  ['kept', 'keep'],
  ['began', 'begin'], ['begun', 'begin'],
  ['showed', 'show'], ['shown', 'show'],
  ['heard', 'hear'],
  ['played', 'play'],
  ['turned', 'turn'],
  ['moved', 'move'],
  ['lived', 'live'],
  ['held', 'hold'],
  ['brought', 'bring'],
  ['happened', 'happen'],
  ['wrote', 'write'], ['written', 'write'],
  ['sat', 'sit'],
  ['stood', 'stand'],
  ['lost', 'lose'],
  ['paid', 'pay'],
  ['met', 'meet'],
  ['set', 'set'],
  ['led', 'lead'],
  ['stopped', 'stop'],
  ['spoke', 'speak'], ['spoken', 'speak'],
  ['read', 'read'],
  ['spent', 'spend'],
  ['grew', 'grow'], ['grown', 'grow'],
  ['won', 'win'],
  ['bought', 'buy'],
  ['sent', 'send'],
  ['built', 'build'],
  ['fell', 'fall'], ['fallen', 'fall'],
  ['cut', 'cut'],
  ['reached', 'reach'],
  ['passed', 'pass'],
  ['sold', 'sell'],
  ['decided', 'decide'],
  ['pulled', 'pull'],
  ['hoped', 'hope'],
  ['received', 'receive'],
  ['produced', 'produce'],
  ['ate', 'eat'], ['eaten', 'eat'],
  ['caught', 'catch'],
  ['drew', 'draw'], ['drawn', 'draw'],
  ['chose', 'choose'], ['chosen', 'choose'],
  ['saved', 'save'],
  ['arrived', 'arrive'],
  ['visited', 'visit'],
  // Comprehensive irregular verb forms (from phraseMatcher ADR-037).
  ['awoke', 'awake'], ['awaked', 'awake'], ['awoken', 'awake'],
  ['bore', 'bear'], ['born', 'bear'], ['borne', 'bear'],
  ['beaten', 'beat'],
  ['became', 'become'],
  ['bent', 'bend'],
  ['betted', 'bet'],
  ['bade', 'bid'], ['bidden', 'bid'],
  ['bound', 'bind'],
  ['bit', 'bite'], ['bitten', 'bite'],
  ['bled', 'bleed'],
  ['blest', 'bless'], ['blessed', 'bless'],
  ['blew', 'blow'], ['blown', 'blow'],
  ['burnt', 'burn'], ['burned', 'burn'],
  ['clung', 'cling'],
  ['crept', 'creep'],
  ['dealt', 'deal'],
  ['dug', 'dig'],
  ['dove', 'dive'], ['dived', 'dive'],
  ['dreamt', 'dream'], ['dreamed', 'dream'],
  ['drank', 'drink'], ['drunk', 'drink'],
  ['drove', 'drive'], ['driven', 'drive'],
  ['fed', 'feed'],
  ['fought', 'fight'],
  ['flung', 'fling'],
  ['flew', 'fly'], ['flown', 'fly'],
  ['forgot', 'forget'], ['forgotten', 'forget'],
  ['froze', 'freeze'], ['frozen', 'freeze'],
  ['ground', 'grind'],
  ['hung', 'hang'], ['hanged', 'hang'],
  ['hid', 'hide'], ['hidden', 'hide'],
  ['laid', 'lay'],
  ['leant', 'lean'], ['leaned', 'lean'],
  ['leapt', 'leap'], ['leaped', 'leap'],
  ['learnt', 'learn'], ['learned', 'learn'],
  ['lent', 'lend'],
  ['lay', 'lie'], ['lain', 'lie'],
  ['lit', 'light'], ['lighted', 'light'],
  ['meant', 'mean'],
  ['mistook', 'mistake'], ['mistaken', 'mistake'],
  ['mowed', 'mow'], ['mown', 'mow'],
  ['quitted', 'quit'],
  ['rode', 'ride'], ['ridden', 'ride'],
  ['rang', 'ring'], ['rung', 'ring'],
  ['rose', 'rise'], ['risen', 'rise'],
  ['sawed', 'saw'], ['sawn', 'saw'],
  ['sought', 'seek'],
  ['sewed', 'sew'], ['sewn', 'sew'],
  ['shook', 'shake'], ['shaken', 'shake'],
  ['sheared', 'shear'], ['shorn', 'shear'],
  ['shone', 'shine'], ['shined', 'shine'],
  ['shot', 'shoot'],
  ['shrank', 'shrink'], ['shrunk', 'shrink'],
  ['sang', 'sing'], ['sung', 'sing'],
  ['sank', 'sink'], ['sunk', 'sink'],
  ['slept', 'sleep'],
  ['slid', 'slide'], ['slidden', 'slide'],
  ['smelt', 'smell'], ['smelled', 'smell'],
  ['sowed', 'sow'], ['sown', 'sow'],
  ['sped', 'speed'], ['speeded', 'speed'],
  ['spelt', 'spell'], ['spelled', 'spell'],
  ['spun', 'spin'],
  ['spat', 'spit'],
  ['spoilt', 'spoil'], ['spoiled', 'spoil'],
  ['sprang', 'spring'], ['sprung', 'spring'],
  ['stole', 'steal'], ['stolen', 'steal'],
  ['stuck', 'stick'],
  ['stank', 'stink'], ['stunk', 'stink'],
  ['strode', 'stride'], ['stridden', 'stride'],
  ['struck', 'strike'], ['stricken', 'strike'],
  ['swore', 'swear'], ['sworn', 'swear'],
  ['swept', 'sweep'],
  ['swam', 'swim'], ['swum', 'swim'],
  ['swung', 'swing'],
  ['taught', 'teach'],
  ['tore', 'tear'], ['torn', 'tear'],
  ['thought', 'think'],
  ['threw', 'throw'], ['thrown', 'throw'],
  ['trod', 'tread'], ['trodden', 'tread'],
  ['woke', 'wake'], ['waked', 'wake'], ['woken', 'wake'],
  ['wore', 'wear'], ['worn', 'wear'],
  ['wound', 'wind'],
  ['wrung', 'wring'],
]);

/** Irregular comparison forms (comparative/superlative → base adjective/adverb). */
const IRREGULAR_COMPARISON: ReadonlyMap<string, string> = new Map([
  ['better', 'good'], ['best', 'good'],
  ['worse', 'bad'], ['worst', 'bad'],
  ['more', 'much'], ['most', 'much'],
  ['less', 'little'], ['least', 'little'],
  ['farther', 'far'], ['further', 'far'],
  ['farthest', 'far'], ['furthest', 'far'],
  ['elder', 'old'], ['eldest', 'old'],
]);

/** Irregular plural nouns (plural → singular). Includes native English,
 * Latin, and Greek borrowings that retain foreign plural endings.
 */
const IRREGULAR_PLURALS: ReadonlyMap<string, string> = new Map([
  // Native English
  ['children', 'child'],
  ['men', 'man'],
  ['women', 'woman'],
  ['mice', 'mouse'],
  ['feet', 'foot'],
  ['teeth', 'tooth'],
  ['geese', 'goose'],
  ['lice', 'louse'],
  ['oxen', 'ox'],
  ['brethren', 'brother'],
  ['people', 'person'],
  // Latin / Greek -a plural → -um
  ['data', 'datum'],
  ['bacteria', 'bacterium'],
  ['media', 'medium'],
  ['curricula', 'curriculum'],
  ['strata', 'stratum'],
  ['memoranda', 'memorandum'],
  ['millennia', 'millennium'],
  ['symposia', 'symposium'],
  ['phenomena', 'phenomenon'],
  ['criteria', 'criterion'],
  // Latin -i plural → -us
  ['fungi', 'fungus'],
  ['cacti', 'cactus'],
  ['stimuli', 'stimulus'],
  ['nuclei', 'nucleus'],
  ['radii', 'radius'],
  ['alumni', 'alumnus'],
  ['syllabi', 'syllabus'],
  ['octopi', 'octopus'],
  ['termini', 'terminus'],
  ['genii', 'genius'],
  ['bacilli', 'bacillus'],
  // Latin -ae plural → -a
  ['larvae', 'larva'],
  ['vertebrae', 'vertebra'],
  ['antennae', 'antenna'],
  ['formulae', 'formula'],
  ['alumnae', 'alumna'],
  ['vertebrae', 'vertebra'],
  ['minutiae', 'minutia'],
  // Latin/Greek -ices / -es plural → -ex / -ix / -is
  ['indices', 'index'],
  ['appendices', 'appendix'],
  ['matrices', 'matrix'],
  ['vertices', 'vertex'],
  ['vortices', 'vortex'],
  ['cervices', 'cervix'],
  ['crises', 'crisis'],
  ['analyses', 'analysis'],
  ['theses', 'thesis'],
  ['diagnoses', 'diagnosis'],
  ['oases', 'oasis'],
  ['hypotheses', 'hypothesis'],
  ['neuroses', 'neurosis'],
  ['prognoses', 'prognosis'],
  ['psychoses', 'psychosis'],
  ['syntheses', 'synthesis'],
  ['axes', 'axis'],
  ['bases', 'basis'],
]);

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Check if a character is a consonant. */
function isConsonant(ch: string): boolean {
  return !!ch && !VOWELS.has(ch);
}

/** Check if stem ends in two identical consonants (CVC doubling pattern). */
function endsInDoubleConsonant(stem: string): boolean {
  if (stem.length < 2) return false;
  const last = stem[stem.length - 1]!;
  const secondLast = stem[stem.length - 2]!;
  return last === secondLast && isConsonant(last);
}

/** Deduplicate an array, preserving order. */
function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

/**
 * Return all possible lemmas for a word (ADR-041).
 * Multi-candidate: irregular maps + regular inflection stripping with
 * y-replacement, CVC doubling reversal, silent-e restoration, sibilant -es,
 * -ves plural, possessive -'s, and ie→ying for gerunds.
 *
 * The first candidate is the most likely lemma; others are fallbacks the
 * caller tries if the first doesn't match. The original word is always
 * included as the last candidate so the caller can fall back to it.
 * False positives (e.g. "wat" from "water") are harmless — they won't be
 * in the dictionary, and the orchestrator tries the raw term first anyway.
 *
 * @returns Array of candidate base forms, ordered by likelihood.
 */
export function englishLemmaCandidates(word: string): string[] {
  const lower = word.toLowerCase();
  if (!lower) return [''];

  // 1. Irregular verbs — highest priority, unambiguous.
  const irregVerb = IRREGULAR_VERBS.get(lower);
  if (irregVerb) return [irregVerb];

  // 2. Irregular comparison — unambiguous.
  const irregComp = IRREGULAR_COMPARISON.get(lower);
  if (irregComp) return [irregComp];

  // 3. Irregular plural nouns — unambiguous.
  const irregPlural = IRREGULAR_PLURALS.get(lower);
  if (irregPlural) return [irregPlural];

  // 4. Possessive -'s: strip "'s" and recurse for the stem's lemma.
  //    Only strip when apostrophe is followed by exactly "s" — NOT "t",
  //    "ll", "re", "ve" (contractions like don't, they're, we've).
  if (lower.endsWith("'s") && lower.length > 3) {
    const stem = lower.slice(0, -2);
    const stemCandidates = englishLemmaCandidates(stem);
    // Stem first, then stem's lemma candidates (e.g. "children's" → "child").
    return dedupe([stem, ...stemCandidates]);
  }

  // 4b. Possessive plural ending in bare apostrophe: dogs' → dog, friends' → friend.
  if (lower.endsWith("'") && lower.length > 2) {
    const stem = lower.slice(0, -1);
    const stemCandidates = englishLemmaCandidates(stem);
    return dedupe([stem, ...stemCandidates]);
  }

  const candidates: string[] = [];

  // 5. Superlative -est: easiest→easy, tallest→tall, biggest→big, nicest→nice.
  if (lower.length > 4 && lower.endsWith('est')) {
    // -iest → -y: easiest→easy, happiest→happy. Unambiguous.
    if (lower.endsWith('iest')) {
      const stem = lower.slice(0, -4); // remove "iest"
      if (stem.length >= 2) return dedupe([stem + 'y', lower]);
    }
    const stem = lower.slice(0, -3); // remove "est"
    if (stem.length >= 2) {
      // For -er/-est: bare stem first (tall, fast), then CVC (big), then silent-e (nice).
      // Most adjectives ending in double consonants ARE base forms (tall, small, full).
      candidates.push(stem);                    // bare: tallest→tall
      if (endsInDoubleConsonant(stem)) candidates.push(stem.slice(0, -1)); // CVC: biggest→big
      candidates.push(stem + 'e');              // silent-e: nicest→nice
    }
    candidates.push(lower); // original as fallback
    return dedupe(candidates);
  }

  // 6. Comparative -er: easier→easy, taller→tall, bigger→big, nicer→nice.
  if (lower.length > 3 && lower.endsWith('er')) {
    // -ier → -y: easier→easy, happier→happy. Unambiguous.
    if (lower.endsWith('ier')) {
      const stem = lower.slice(0, -3); // remove "ier"
      if (stem.length >= 2) return dedupe([stem + 'y', lower]);
    }
    const stem = lower.slice(0, -2); // remove "er"
    if (stem.length >= 2) {
      // For -er/-est: bare stem first (tall, fast), then CVC (big), then silent-e (nice).
      candidates.push(stem);                    // bare: taller→tall
      if (endsInDoubleConsonant(stem)) candidates.push(stem.slice(0, -1)); // CVC: bigger→big
      candidates.push(stem + 'e');              // silent-e: nicer→nice
    }
    candidates.push(lower); // original as fallback
    return dedupe(candidates);
  }

  // 7. Regular past: -ed. kicked→kick, stopped→step, charged→charge, carried→carry.
  //    For -ed/-ing: CVC first (matching phraseMatcher), because CVC doubling
  //    is common for short verbs (stop→stopped, run→running).
  if (lower.length > 3 && lower.endsWith('ed')) {
    const stem = lower.slice(0, -2); // remove "ed"
    // y-replacement: tried→tri→try, carried→carri→carry.
    if (stem.endsWith('i')) candidates.push(stem.slice(0, -1) + 'y');
    // CVC doubling: stepped→stepp→step, planned→plann→plan.
    if (endsInDoubleConsonant(stem)) candidates.push(stem.slice(0, -1));
    // silent-e: charged→charg→charge, hoped→hop→hope.
    candidates.push(stem + 'e');
    // bare stem: kicked→kick, filled→fill.
    candidates.push(stem);
    candidates.push(lower); // original as fallback
    return dedupe(candidates);
  }

  // 8. Gerund/present participle: -ing. running→run, taking→take, lying→lie.
  if (lower.length > 4 && lower.endsWith('ing')) {
    const stem = lower.slice(0, -3); // remove "ing"
    if (stem.length >= 2) {
      // ie→ying: lying→ly→lie, dying→dy→die, tying→ty→tie.
      if (stem.endsWith('y')) candidates.push(stem.slice(0, -1) + 'ie');
      // CVC doubling: running→runn→run, swimming→swimm→swim.
      if (endsInDoubleConsonant(stem)) candidates.push(stem.slice(0, -1));
      // silent-e: taking→tak→take, making→mak→make.
      candidates.push(stem + 'e');
      // bare stem: working→work, looking→look.
      candidates.push(stem);
    }
    candidates.push(lower); // original as fallback
    return dedupe(candidates);
  }

  // 9. Plural noun / 3rd person verb: -s (not -ss).
  //    cats→cat, cities→city, boxes→box, knives→knife, goes→go, watches→watch.
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) {
    // -ves plural (f→v): knives→knife, wolves→wolf, leaves→leaf.
    if (lower.endsWith('ves')) {
      const stem = lower.slice(0, -3); // remove "ves"
      if (stem.length >= 2) {
        candidates.push(stem + 'fe'); // knives→knife, wives→wife
        candidates.push(stem + 'f');  // wolves→wolf, leaves→leaf
      }
    }
    // -ies → -y: cities→city, carries→carry, babies→baby.
    if (lower.endsWith('ies')) {
      const stem = lower.slice(0, -3); // remove "ies"
      if (stem.length >= 2) candidates.push(stem + 'y');
    }
    // -oes → -o: goes→go, does→do, heroes→hero, potatoes→potato.
    if (lower.endsWith('oes')) {
      const stem = lower.slice(0, -2); // remove "es"
      if (stem.length >= 2) candidates.push(stem);
    }
    // -es after sibilants: boxes→box, buses→bus, watches→watch, brushes→brush.
    if (lower.endsWith('es')) {
      const stem = lower.slice(0, -2); // remove "es"
      if (stem.endsWith('s') || stem.endsWith('x') || stem.endsWith('z') ||
          stem.endsWith('ch') || stem.endsWith('sh')) {
        candidates.push(stem);
      }
    }
    // bare -s: cats→cat, dogs→dog, looks→look, runs→run.
    const stem = lower.slice(0, -1); // remove "s"
    if (stem.length >= 3) candidates.push(stem);
    candidates.push(lower); // original as fallback
    if (candidates.length > 1) return dedupe(candidates);
  }

  // No inflection pattern matched — return the word itself.
  return [lower];
}

/**
 * Expand common English contractions into their base-word candidates.
 *
 * Subtitles and informal text are full of contractions (don't, can't, won't,
 * it's, I've, etc.). The inflectional lemmatizer treats these as opaque tokens,
 * so a lookup of "can't" misses the dictionary entry for "can". This helper
 * returns the base auxiliary/modal/verb for a contraction, keeping the lookup
 * accurate without introducing false-positive phrase matches (phrase matching
 * continues to use `englishLemmaCandidates`, which does NOT expand contractions).
 *
 * Sources:
 * - Cambridge Dictionary: contractions (n't, 'm, 're, 's, 've, 'll, 'd).
 * - Wikipedia: Contraction (grammar).
 */
function normalizeApostrophe(word: string): string {
  return word.replaceAll('’', "'").normalize('NFC').toLowerCase();
}

/** Contraction -> base form(s), ordered by likelihood. */
const CONTRACTION_BASES: ReadonlyMap<string, string[]> = new Map([
  // Negative contractions (verb/modal + not)
  ["aren't", ['are', 'be']],
  ["can't", ['can']],
  ["couldn't", ['could']],
  ["didn't", ['did', 'do']],
  ["doesn't", ['does', 'do']],
  ["don't", ['do']],
  ["hadn't", ['had', 'have']],
  ["hasn't", ['has', 'have']],
  ["haven't", ['have']],
  ["isn't", ['is', 'be']],
  ["mightn't", ['might']],
  ["mustn't", ['must']],
  ["needn't", ['need']],
  ["oughtn't", ['ought']],
  ["shan't", ['shall']],
  ["shouldn't", ['should']],
  ["wasn't", ['was', 'be']],
  ["weren't", ['were', 'be']],
  ["won't", ['will']],
  ["wouldn't", ['would']],
]);

function expandContractions(word: string): string[] {
  const lower = normalizeApostrophe(word);
  const bases = CONTRACTION_BASES.get(lower);
  if (bases) return [...bases];

  // Subject/auxiliary clitics: he'd, he'll, he's, I'd, I'm, I've, they'd, etc.
  // The clitic attaches after a pronoun/noun; we extract the base auxiliary.
  if (lower.endsWith("'d")) {
    return ['would', 'had'];
  }
  if (lower.endsWith("'ll")) {
    return ['will', 'shall'];
  }
  if (lower.endsWith("'re")) {
    return ['are', 'be'];
  }
  if (lower.endsWith("'ve")) {
    return ['have'];
  }
  if (lower.endsWith("'m")) {
    return ['am', 'be'];
  }
  if (lower.endsWith("'s")) {
    // 's is ambiguous: is/has/does (and possessive, handled by englishLemmaCandidates).
    return ['is', 'has', 'does', 'be', 'have'];
  }

  // Informal spoken/written contractions.
  if (lower === 'gonna') return ['go'];
  if (lower === 'wanna') return ['want'];
  if (lower === 'gotta') return ['get'];
  if (lower === 'kinda') return ['kind'];
  if (lower === 'sorta') return ['sort'];
  if (lower === "'em" || lower === 'em') return ['them'];
  if (lower === "'cause" || lower === 'cause') return ['because'];
  if (lower === "o'") return ['of'];
  if (lower === "'tis") return ['is', 'be'];
  if (lower === "'twas") return ['was', 'be'];
  if (lower === "ain't") return ['be', 'have', 'do'];
  if (lower === "let's") return ['let'];
  if (lower === 'yall' || lower === "y'all") return ['you'];

  return [];
}

/**
 * Derivation-aware candidates.
 *
 * Inflectional lemmatization intentionally stops at inflections (ADR-041), but
 * dictionary lookup also fails on derived forms: "happiness" is not the same
 * grammatical category as "happy", yet a learner hovering "happiness" will
 * benefit from seeing the base adjective. These rules are intentionally
 * separate from `englishLemmaCandidates` so phrase matching (which runs on
 * inflections only) does not false-match "happy birthday" from the token
 * "happiness".
 */
function derivationalCandidates(word: string): string[] {
  const lower = normalizeApostrophe(word);
  if (lower.length < 4) return [];

  // Irregular forms already have a canonical base from englishLemmaCandidates.
  // Applying suffix heuristics to them produces noise (e.g. "better" -> "bett").
  if (IRREGULAR_VERBS.has(lower) || IRREGULAR_COMPARISON.has(lower) || IRREGULAR_PLURALS.has(lower)) {
    return [];
  }

  const candidates: string[] = [];

  // -ness: happiness -> happy, kindness -> kind, sadness -> sad
  if (lower.endsWith('ness') && lower.length > 5) {
    const stem = lower.slice(0, -4);
    if (stem.endsWith('i')) {
      candidates.push(stem.slice(0, -1) + 'y');
    }
    candidates.push(stem);
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -ment: employment -> employ, development -> develop, movement -> move
  if (lower.endsWith('ment') && lower.length > 5) {
    const stem = lower.slice(0, -4);
    candidates.push(stem);
    candidates.push(stem + 'e');
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -ful / -less: helpful -> help, homeless -> home, careful -> care,
  // beautiful -> beauty
  if (lower.endsWith('ful') && lower.length > 4) {
    const stem = lower.slice(0, -3);
    if (stem.endsWith('i')) {
      candidates.push(stem.slice(0, -1) + 'y');
    }
    candidates.push(stem);
    candidates.push(stem + 'e');
    candidates.push(...englishLemmaCandidates(stem));
  }
  if (lower.endsWith('less') && lower.length > 5) {
    const stem = lower.slice(0, -4);
    candidates.push(stem);
    candidates.push(stem + 'e');
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -ly adverbs: quickly -> quick, happily -> happy, carefully -> careful
  if (lower.endsWith('ly') && lower.length > 3) {
    const stem = lower.slice(0, -2);
    if (lower.endsWith('ily')) {
      // happily -> happy, easily -> easy
      candidates.push(stem.slice(0, -1) + 'y');
    }
    candidates.push(stem);
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -ion / -ation / -ution / -sion: action -> act, decision -> decide,
  // creation -> create, contribution -> contribute, nation -> nation
  if (lower.endsWith('ation') && lower.length > 6) {
    const stem = lower.slice(0, -5);
    candidates.push(stem);              // presentation -> present
    candidates.push(stem + 'e');        // imagination -> imagine
    candidates.push(stem + 'te');       // creation -> create
    candidates.push(stem + 'ate');      // education -> educate
    candidates.push(...englishLemmaCandidates(stem));
  } else if (lower.endsWith('ution') && lower.length > 6) {
    const stem = lower.slice(0, -5);
    candidates.push(stem + 'ute');      // contribution -> contribute
    candidates.push(...englishLemmaCandidates(stem));
  } else if (lower.endsWith('sion') && lower.length > 5) {
    const stem = lower.slice(0, -4);
    candidates.push(stem + 'de');       // decision -> decide
    candidates.push(stem + 'se');       // confusion -> confuse
    candidates.push(...englishLemmaCandidates(stem));
  } else if (lower.endsWith('ion') && lower.length > 4) {
    // action -> act, connection -> connect, relation -> relate
    const stem = lower.slice(0, -3);
    candidates.push(stem);
    candidates.push(stem + 'e');
    candidates.push(stem + 'te');
    candidates.push(stem + 'ate');
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -ity: reality -> real, ability -> able, capability -> capable
  if (lower.endsWith('ity') && lower.length > 5) {
    const stem = lower.slice(0, -3);
    if (lower.endsWith('ility')) {
      // capability -> capable (capabil -> capable), ability -> able
      candidates.push(stem.slice(0, -2) + 'le');
    } else {
      candidates.push(stem);            // reality -> real
      candidates.push(stem + 'e');
    }
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -ty: cruelty -> cruel, safety -> safe, loyalty -> loyal
  if (lower.endsWith('ty') && !lower.endsWith('ity') && lower.length > 4) {
    const stem = lower.slice(0, -2);
    candidates.push(stem);
    candidates.push(stem + 'e');
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -er / -or agent nouns: teacher -> teach, actor -> act, worker -> work
  if ((lower.endsWith('er') || lower.endsWith('or')) && lower.length > 4) {
    const stem = lower.slice(0, -2);
    candidates.push(stem);
    candidates.push(stem + 'e');
    candidates.push(...englishLemmaCandidates(stem));
  }

  // -ist: artist -> art, scientist -> science, pianist -> piano,
  // patient -> patience (ent -> ence)
  if (lower.endsWith('ist') && lower.length > 5) {
    const stem = lower.slice(0, -3);
    candidates.push(stem);              // artist -> art
    candidates.push(stem + 'e');        // scientist -> science
    candidates.push(stem + 'o');        // pianist -> piano (best-effort)
    if (stem.endsWith('ent')) {
      candidates.push(stem.slice(0, -3) + 'ence'); // scientist -> science
    }
    candidates.push(...englishLemmaCandidates(stem));
  }

  return dedupe(candidates.filter((c) => c.length > 1));
}

/**
 * Lookup-oriented multi-candidate lemmatization.
 *
 * Combines inflectional morphology (`englishLemmaCandidates`) with contraction
 * expansion and derivational awareness, so that lookups of "can't", "won't",
 * "it's", "I've", "happiness", "quickly", etc. resolve to a dictionary entry.
 * The original word is always included as a fallback.
 *
 * This function is intentionally separate from `englishLemmaCandidates` because
 * phrase matching must NOT expand contractions or derivational forms — doing so
 * would let "do sth" match "I don't do it" or "happy birthday" match "happiness".
 */
export function englishLookupCandidates(word: string): string[] {
  const lower = normalizeApostrophe(word);
  const expanded = expandContractions(word);
  const deriv = derivationalCandidates(word);

  // Hyphenated compounds: well-known -> well, known, well-known, well known.
  if (lower.includes('-')) {
    const parts = lower.split('-').filter((p) => p.length > 0);
    const partCandidates = parts.flatMap((p) => englishLemmaCandidates(p));
    const joined = parts.join(' ');
    return dedupe([lower, joined, ...parts, ...partCandidates, ...deriv]);
  }

  if (expanded.length > 0) {
    // For clitic contractions, also lemmatize the stem (e.g. "he's" -> "he").
    const stem = lower.includes("'") ? lower.split("'")[0] : lower;
    const stemCandidates = stem && stem !== lower ? englishLemmaCandidates(stem) : [];
    return dedupe([...expanded, ...stemCandidates, ...deriv, lower]);
  }
  return dedupe([...englishLemmaCandidates(word), ...deriv]);
}

/**
 * Single-candidate lemmatization (backward compatibility).
 * Returns the most likely base form. For ambiguous cases (CVC doubling,
 * silent-e), this may not be the correct one — prefer `englishLemmaCandidates`
 * when the caller can try multiple candidates against a dictionary.
 */
export function englishLemma(word: string): string {
  return englishLookupCandidates(word)[0] ?? word.toLowerCase();
}
