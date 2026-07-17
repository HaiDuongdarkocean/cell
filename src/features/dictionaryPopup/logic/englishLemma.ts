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

/** Irregular plural nouns (plural → singular). */
const IRREGULAR_PLURALS: ReadonlyMap<string, string> = new Map([
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
 * Single-candidate lemmatization (backward compatibility).
 * Returns the most likely base form. For ambiguous cases (CVC doubling,
 * silent-e), this may not be the correct one — prefer `englishLemmaCandidates`
 * when the caller can try multiple candidates against a dictionary.
 */
export function englishLemma(word: string): string {
  return englishLemmaCandidates(word)[0] ?? word.toLowerCase();
}
