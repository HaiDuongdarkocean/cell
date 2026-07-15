# ADR-037: Deterministic English phrase matching from Cambridge templates

> Date: 2026-07-15
> Status: In progress — parser slice implemented; index, matcher, and device benchmark pending
> Related: `docs/specs/spec-popup-dictionary.md`, ADR-023
> Scope: English idioms, phrasal verbs, and other multiword dictionary entries

## 1. Decision summary

The popup will match a phrase from **one hovered token plus its sentence context** using a deterministic, token-level matcher:

1. Compile Cambridge `term` templates into a small AST during dictionary import.
2. Persist a compact per-resource phrase-index blob in IndexedDB.
3. Load only the phrase index and lightweight metadata into the lookup worker; definitions and media remain in the existing 10k-entry LRU/on-demand path.
4. Retrieve candidates through a rare-anchor inverted index, not by scanning all multiword terms.
5. Validate candidates with bounded dynamic programming over tokens, not regular expressions.
6. Return a phrase only when every required literal and required slot is structurally satisfied and the matched span contains the hovered token.
7. Use a deterministic ranking tuple for ambiguity. Do not expose an invented probabilistic confidence score.

This is a **structural phrase matcher**, not a semantic disambiguator. For example, `take off your shoes` structurally matches `take off`, but dictionary senses still need to be shown because the available data cannot prove whether the intended sense is clothing, flight, or another meaning.

## 2. Why this decision is needed

The current dictionary import stores normalized terms and rich definitions in `langDictionaryEntry`, but has no phrase-pattern index or phrase matcher. The current plugin contract is also too small for reliable context matching: a `target` string alone is ambiguous when the same word occurs more than once in a sentence, and `confidence >= 0.7` has no reproducible formula.

The user experience requires:

- one hovered token at a time;
- phrase detection from the surrounding sentence;
- high precision and no invented phrases;
- lookup trigger-to-popup under 1 second;
- low memory usage on a machine with only about 1 GB available to Chrome;
- offline operation from the imported dictionary;
- graceful fallback to a normal single-word lookup.

## 3. Evidence from the Cambridge fixture

Source file: `tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json`.

The source contains 90,238 records and 90,233 unique normalized terms. After trimming, NFC-normalizing, lowercasing, and deduplicating, `tests/data-test/multiword-terms.txt` contains **34,094 unique terms with at least two whitespace tokens**.

Token-count distribution in the normalized source:

| Fixed source token count | Terms |
|---:|---:|
| 2 | 20,743 |
| 3 | 7,565 |
| 4 | 3,001 |
| 5 | 1,571 |
| 6 | 705 |
| 7 | 286 |
| 8 | 134 |
| 9 | 52 |
| 10 | 21 |
| 11 | 13 |
| 12 | 3 |
| 13 | 4 |
| 14 | 1 |

These pattern counts overlap because a term can contain more than one feature:

| Feature | Count |
|---|---:|
| Parenthesized optional material | 1,140 |
| Slash alternatives | 1,955 |
| Placeholder-like notation (`sth`, `sb`, `something`, `someone`, etc.) | 5,578 |
| Ellipsis (`...`) | 51 |
| `etc.` open-ended notation | 85 |
| Hyphenated terms | 728 |
| Comma-containing terms | 205 |

Representative entries actually present in the fixture:

### Phrasal and multi-particle verbs

- `carry (sth) on`
- `carry sth out`
- `carry out something`
- `look after sb/sth`
- `put sb off`
- `put sth off`
- `put up with sth/sb`
- `give up on sb/sth`
- `come up with something`
- `look forward to sth`
- `run out of steam`
- `pick up the pieces`
- `break down`
- `take off something`
- `turn on sth`
- `call off something`
- `work out something`

### Idioms and fixed expressions

- `be (right) under your nose`
- `(from) under your nose`
- `under your nose`
- `a piece of cake`
- `kick the bucket`
- `spill the beans`
- `hit the nail on the head`
- `a bird in the hand (is worth two in the bush)`
- `(just) in the nick of time`
- `(as) easy as pie/ABC/anything/falling off a log`
- `a bolt from/out of the blue`
- `a man/woman of few words`
- `a close/near thing`
- `from soup to nuts`
- `the apple doesn't fall far from the tree`
- `a blessing in disguise`

The extraction script now canonicalizes terms before writing the list. This avoids the earlier discrepancy caused by leading/trailing whitespace in raw Cambridge terms.

## 4. Socratic diagnosis: questions that determine the algorithm

| Question | Answer reached from the data and UX | Design consequence |
|---|---|---|
| What does “match exactly” mean? | Exact structural coverage of a dictionary template, not perfect semantic-sense selection. | Never claim that a dictionary-only matcher knows the intended sense. |
| Can the hovered word identify a phrase by itself? | No. `put` belongs to many phrases; the same word can occur repeatedly. | Send `contextSentence` plus a character `cursorOffset`; derive the exact token index. |
| Should the matcher scan all 34k terms? | No. That repeats work on every hover and makes common words expensive. | Build an inverted anchor index. |
| What if the hovered word is `the`, `was`, or a placeholder word? | The discriminative word may be elsewhere in the phrase. | Search anchors in a bounded context window, then require the candidate span to contain the target token. |
| Is `was` allowed to match `be`? | Yes only when the template literal is a verb and the plugin lemma agrees. | Lemma matching is restricted to classified verb literals; never lemmatize every noun blindly. |
| Should `was` create `be under your nose` from nothing? | No. The actual Cambridge entry is `be (right) under your nose`; `(right)` is optional and `your` is a possessive slot. | Match the real AST; do not synthesize a new dictionary term. |
| What does `(right)` mean? | An optional group, not literal parentheses. | Compile balanced parentheses to `OPTIONAL` nodes. |
| What does `close/near` mean? | Mutually exclusive alternatives. | Compile to an `ALTERNATIVE` node, never a literal slash and never both words. |
| Is every slash an alternative? | No. `20/20` and similar numeric forms are literal tokens. | Numeric slash forms remain literals; lexical slash runs become alternatives. |
| What does `sth` or `sb` mean? | A grammar slot, not the literal word `sth` or `sb`. | Use bounded slots with a fixed maximum and clause boundaries. |
| Can a slot be unlimited? | No. Unlimited wildcards create false positives and regex backtracking. | `MAX_SLOT_TOKENS = 6`; no cross-sentence matching. |
| Can `carry out something` match `carried the plan out`? | Only if the dictionary also provides the separable order. | Compile explicit template order; do not invent a missing opposite order in MVP. |
| Can every `V P object` be reordered? | No. Prepositional verbs such as `look after` are not interchangeable with arbitrary order. | Never apply a global reorder rule. |
| What about `...` and `etc.`? | They describe open-ended language, not a finite phrase. | Exclude them from automatic strict matching; fall back to single-word lookup. |
| What if two phrases match? | Longer, more specific, better-supported structure should win deterministically. | Rank by a fixed tuple, never an opaque confidence threshold. |
| Can a dictionary-only matcher prove that `sb` is a human? | Not reliably without POS/NER/dependency data. | Treat slots as structural; mark slot matches lower quality and document the semantic ceiling. |
| What happens on overflow or malformed input? | A missed phrase is preferable to a fabricated phrase. | Abort phrase matching for that request and use normal dictionary fallback. |
| Where should definitions live? | The phrase index needs only metadata; definitions are large and are read only for the winner. | Keep definitions out of the phrase blob and use the existing LRU/IndexedDB path. |

### Root cause

The hard problem is not string search. It is the mismatch between **Cambridge notation** and **sentence surface forms**:

- notation contains optional groups and alternatives;
- grammatical slots represent arbitrary noun phrases;
- phrasal verbs can be separable or inseparable;
- sentence tokens can be inflected;
- one hover token must identify a larger span;
- unrestricted wildcard matching destroys precision.

Therefore, the algorithm must be a small finite template engine with explicit limits, not a substring search and not a general-purpose fuzzy matcher.

## 5. Template compiler

### 5.1 Canonicalization

Apply the existing normalization principles and phrase-specific rules:

1. trim, NFC-normalize, and lowercase;
2. normalize curly apostrophes (`’` → `'`) for matching;
3. preserve internal hyphens, ampersands, numeric slashes, and apostrophes;
4. ignore sentence-edge punctuation during tokenization;
5. keep character offsets from the original sentence;
6. reject empty or unbalanced templates.

Raw parentheses and slash markers are grammar notation in the Cambridge source. They are not emitted as sentence tokens.

### 5.2 AST nodes

The compiler validates each template before persistence. It marks a template `unsupportedLimit` when its normalized source token count exceeds `MAX_FIXED_TOKENS` or its bounded maximum surface span exceeds `MAX_SURFACE_SPAN`. Unsupported templates remain visible to diagnostics but never enter the automatic matching postings.

```typescript
type PhraseNode =
  | { readonly type: 'literal'; readonly forms: readonly string[]; readonly inflectableVerb: boolean }
  | { readonly type: 'optional'; readonly children: readonly PhraseNode[] }
  | { readonly type: 'alternative'; readonly branches: readonly (readonly PhraseNode[])[] }
  | { readonly type: 'slot'; readonly kind: 'object' | 'person' | 'possessive' };
```

`forms` normally contains one normalized token. It can contain a small set of equivalent forms when the source explicitly requires it, such as a lexical alternative or a contraction normalization. It must not contain an unbounded morphological expansion.

### 5.3 Placeholder mapping

| Cambridge notation | AST node | Surface rule |
|---|---|---|
| `sth`, `something` | `slot(object)` | 1–6 non-boundary tokens |
| `sb`, `someone`, `somebody` | `slot(person)` | 1–6 non-boundary noun-phrase tokens; no semantic certainty claimed |
| `sb/sth`, `someone/something` | `alternative(person, object)` | Either slot, never both |
| `your`, `one's`, `sb's` when used generically | `slot(possessive)` | A possessive pronoun or possessive noun form |
| Lexical `bird's`, `dog's`, `it's`, `that's` | `literal` | Match as lexical tokens; do not generalize the apostrophe |

A generic possessive is recognized only from the known notation forms. A lexical possessive such as `a bird's eye view` remains fixed; otherwise the matcher would turn every `'s` into an arbitrary possessive slot.

### 5.4 Optional groups

Examples:

- `(from) under your nose` → optional `from` + `under` + possessive + `nose`;
- `a bird in the hand (is worth two in the bush)` → fixed first clause + optional second clause;
- `(as) easy as ...` → optional `as`.

Optional groups are represented in the AST and evaluated as skip/consume branches. They are not expanded into every possible string, so variant count does not multiply memory usage.

### 5.5 Slash alternatives

The parser distinguishes lexical alternatives from literal numeric slash tokens:

- `a close/near thing` → `a` + alternative(`close`, `near`) + `thing`;
- `a banner year/season/month/week` → `a banner` + alternative(`year`, `season`, `month`, `week`);
- `pie/ABC/anything/falling off a log` → one alternative with four branches, the last branch containing multiple words;
- `20/20 vision` → literal token `20/20` + `vision`;
- `a (quick/brisk) trot through sth` → optional(alternative(`quick`, `brisk`)) + ... .

The source-level slash chain is parsed as one alternative slot. It is never emitted as a literal slash unless the whole token is numeric or otherwise classified as a literal symbol token.

### 5.6 Open-ended patterns are not strict matches

Terms containing any of the following are marked `unsupportedOpen` and are not automatically selected:

- `...`;
- `etc.`;
- an unbounded list marker;
- malformed or unbalanced notation.

Examples excluded from strict automatic matching:

- `...and counting`;
- `(as) ... as hell`;
- `a load of crap, nonsense, rubbish, etc.`;
- `how/what about...?`.

This is deliberate. Matching an arbitrary number of words would make both precision and latency unbounded. A later grammar-aware matcher can add these as a separate quality tier without changing the strict matcher.

## 6. Verb and inflection policy

The English plugin supplies a conservative lemma function. The phrase compiler marks a literal as `inflectableVerb` only when the Cambridge entry provides verb evidence (for example, a definition beginning with an infinitival `to` or an explicit verb sense) or the head is in the plugin's conservative verb lexicon.

At runtime:

```text
literal matches if:
  normalized surface === one of literal.forms
  OR
  literal.inflectableVerb && lemma(surface) === literal.baseForm
```

The matcher does not apply lemma equivalence to every token. This prevents a noun or fixed idiom word from silently changing into another lemma.

Examples:

| Sentence | Cambridge template | Result |
|---|---|---|
| `The answer was right under my nose.` | `be (right) under your nose` | Match: `was right under my nose` |
| `She spilled the beans.` | `spill the beans` | Match via verb lemma `spilled → spill` |
| `The car broke down.` | `break down` | Match via `broke → break` |
| `A piece of cake.` | `a piece of cake` | No verb lemma is applied to `piece` or `cake` |

The first example is important: the Cambridge JSON really contains `be (right) under your nose`. The matcher must parse the optional group and possessive slot; it must not invent a different dictionary phrase.

## 7. Indexed data design

### 7.1 New IndexedDB store

The dictionary DB is currently schema version 9. Add a version-10 store:

```text
langPhraseIndex
  keyPath: resourceId
  value: { resourceId, compilerVersion, termCount, blob: ArrayBuffer }
  index: by_resource
```

The blob contains no definitions, examples, audio, or media. It contains:

- interned normalized literal tokens;
- compact AST node arrays;
- template metadata (`resourceId`, canonical term, support tier, fixed-token count, min/max span);
- one primary and up to two secondary rare anchor keys per template;
- contiguous posting lists from anchor keys to template IDs;
- enough metadata to resolve the winning dictionary term later.

A binary/typed-array representation is preferred over 34k JavaScript object graphs. The exact byte layout is an implementation detail, but it must be versioned by `compilerVersion` so a future compiler can rebuild it safely. The worker owns the transferred buffer; the background must release its reference after transfer so the same blob is not counted twice in the resident budget.

### 7.2 Build timing

Build the blob after a dictionary resource is imported successfully, using the same resource ID. Write it atomically with the resource completion flag. If phrase compilation fails, the dictionary import must roll back rather than leave a resource that claims phrase support but has no index.

Deletion removes the resource's phrase blob. Re-importing the same resource rebuilds it from the normalized source entries.

### 7.3 Anchor selection

Every supported template gets a primary anchor and, when available, up to two secondary anchors from required literals or alternative branches. Prefer, in order:

1. a non-stopword required literal;
2. a longer literal token;
3. a literal with the smallest posting count in the imported corpus;
4. a verb lemma only when the literal is marked `inflectableVerb`.

A rough scan of the normalized fixture using a stopword-aware primary-anchor heuristic produced 12,369 distinct anchors, median posting size 1, 95th percentile 9, 99th percentile 16, and maximum 66. The final compiler must measure the real AST-based primary/secondary index and keep the benchmark as a regression guard.

Templates with no discriminative literal use a small fixed-template index. They are never placed into an unbounded common-word bucket.

## 8. Runtime matching algorithm

### 8.1 Input contract

The old `matchPhrase(target, lemma, context)` shape is insufficient. The matcher needs occurrence identity:

```typescript
interface PhraseMatchRequest {
  readonly sentence: string;
  /** UTF-16 character offset of the hovered token in sentence. */
  readonly cursorOffset: number;
}

interface PhraseMatch {
  readonly dictionaryTerm: string;
  readonly surface: string;
  readonly span: { readonly start: number; readonly end: number };
  readonly quality: 'fixed' | 'inflected' | 'possessive-template' | 'slot-template';
  readonly sourceResourceId: number;
}
```

The tokenizer maps `cursorOffset` to exactly one token. The offset is measured in JavaScript UTF-16 code units, matching `String#slice` and DOM text offsets; the scanner itself iterates Unicode code points and combining marks so surrogate pairs and composed/decomposed characters do not shift token boundaries. If the offset is outside a word token, phrase matching returns `null`. This prevents the first occurrence of a repeated word from being selected accidentally.

### 8.2 Constants

```text
MAX_FIXED_TOKENS = 16       // fixture maximum is 14
MAX_SLOT_TOKENS = 6         // deliberate precision/latency ceiling
MAX_SURFACE_SPAN = 32       // fixed tokens + bounded slots
MAX_CANDIDATES = 256        // overflow falls back; never truncate arbitrarily
MAX_RESULTS = 1             // popup header has one detected phrase
```

These are algorithm limits, not user settings. They keep the learner out of configuration work and prevent a pathological dictionary entry from blocking the worker.

### 8.3 Step-by-step flow

```text
1. Tokenize the complete context sentence.
2. Normalize each token while retaining original start/end offsets.
3. Resolve cursorOffset → targetTokenIndex.
4. Create a bounded window of ±MAX_SURFACE_SPAN tokens around target.
5. For each token in the window, compute surface key and (when available) lemma key.
6. Read anchor postings for those keys and collect candidate template IDs.
7. If the candidate set exceeds MAX_CANDIDATES:
     intersect with the rarest second anchor; if still oversized, abort phrase matching.
8. For each candidate:
     - reject unsupportedOpen templates;
     - try only start positions that can contain the anchor and target;
     - run the memoized token matcher over the candidate AST;
     - require all required literals and slots to match;
     - require targetTokenIndex to lie inside the matched span.
9. Rank valid matches with the deterministic tuple below.
10. Resolve definitions for the winner through the existing dictionary LRU/IndexedDB path.
11. If no valid phrase exists, perform normal single-word lookup.
```

### 8.4 Token-level matcher

The matcher is a finite-state traversal with memoization keyed by `(nodeIndex, sentenceTokenIndex)`. It has no regular-expression backtracking and no arbitrary full-sentence wildcard.

```text
matchSequence(nodes, nodeIndex, tokenIndex):
  if nodeIndex == nodes.length: return [tokenIndex]

  memoKey = nodeIndex + ':' + tokenIndex
  if memo contains memoKey: return memo[memoKey]

  node = nodes[nodeIndex]
  next = []

  literal:
    if tokenMatches(node, sentence[tokenIndex]):
      next = matchSequence(nodes, nodeIndex + 1, tokenIndex + 1)

  optional:
    next = union(
      matchSequence(nodes, nodeIndex + 1, tokenIndex),
      matchChildrenThenContinue(node.children, tokenIndex),
    )

  alternative:
    for branch of node.branches:
      next += matchChildrenThenContinue(branch, tokenIndex)

  slot:
    for length from 1 to MAX_SLOT_TOKENS:
      if tokens[length] cross punctuation/sentence boundary: break
      nextTokenIndex = tokenIndex + length
      if next required literal/branch cannot match at nextTokenIndex:
        continue
      if slotTypeAllows(node.kind, tokens[tokenIndex .. nextTokenIndex]):
        next += matchSequence(nodes, nodeIndex + 1, nextTokenIndex)

  memo[memoKey] = deduplicate(next)
  return memo[nodeIndex + ':' + tokenIndex]
```

The implementation may use a more efficient left/right anchor traversal, but the observable contract remains the same: bounded token states, memoization, and no arbitrary regex expansion.

### 8.5 Slot boundaries

A slot may consume determiners, adjectives, nouns, pronouns, and ordinary noun-phrase tokens, but it stops at:

- sentence punctuation (`.`, `!`, `?`, `;`, `:`);
- a hard line/cue boundary;
- `MAX_SLOT_TOKENS`;
- a fixed suffix that can already match at the current position.

The shortest valid slot is preferred. This prevents `carry the plan out carefully` from consuming `carefully` when `out` already closes the phrase.

`sb` is a grammatical notation, not a proof that the captured noun phrase is human. Without a POS/dependency/NER model, the result is marked `slot-template`; it is not presented as semantic certainty. A future semantic layer can improve this without changing the index or fixed-token matcher.

### 8.6 Explicit separable phrasal verbs

The compiler preserves source order. It does not globally swap objects around particles.

During import, group templates by `(verb lemma, particle sequence)` for diagnostics only:

- if the resource contains both `carry sth out` and `carry out something`, both are compiled explicitly;
- MVP does **not** invent a missing opposite order. A separable form is considered corpus-proven only when both orders are explicitly present in the same imported resource with the same verb, particle, and slot signature;
- no derivation is allowed for multi-particle/prepositional sequences such as `look after` or `put up with`;
- when the object is a personal pronoun, prefer/restrict the separated order according to Cambridge grammar;
- the compiler reports missing symmetric forms for later curation instead of silently generating them.

This follows Cambridge's grammar distinction: for many phrasal verbs a non-pronoun object may occur before or after the particle, while a personal pronoun occurs before the particle; a prepositional verb keeps its object immediately after the preposition.

Examples:

| Sentence | Expected source template | Must not be confused with |
|---|---|---|
| `She carried the plan out.` | `carry sth out` | `carry out something` order |
| `She carried out the plan.` | `carry out something` | `carry sth out` order |
| `He put the meeting off.` | `put sth off` | `put off something` if no derived/provided order |
| `She looks after her sister.` | `look after sb/sth` | `look her after` |
| `I cannot put up with this noise.` | `put up with sth/sb` | `put up` alone |

## 9. Deterministic ranking

A candidate is valid only after structural validation. The ranking score is not a probability and is not exposed as user confidence.

For a match that combines transformations, `quality` is the **least precise transformation used**: for example, `was right under my nose` is `possessive-template`, because it uses both verb inflection and a possessive substitution. Sort by this tuple, descending unless stated otherwise:

1. support quality: `fixed` > `inflected` > `possessive-template` > `slot-template`;
2. required fixed-literal count, descending;
3. matched optional-literal count, descending;
4. matched surface span length, descending;
5. wildcard/slot token count, ascending;
6. explicit source template before diagnostic/derived metadata;
7. frequency rank, ascending when available;
8. dictionary resource priority and stable import order.

Examples:

- `He kicked the bucket` selects `kick the bucket` over a shorter `kick` lookup.
- `She picked up the pieces` selects `pick up the pieces` over `pick up`.
- `It was a close thing` selects the `close` branch of `a close/near thing`; it never requires both `close` and `near`.
- `The answer was right under my nose` selects `be (right) under your nose`, not a fabricated `be under your nose` entry.

## 10. Edge-case test matrix

These are golden tests derived from the Cambridge terms plus deliberately adversarial negative cases. `hover` identifies the token occurrence, not merely its text.

### 10.1 Positive tests

| ID | Sentence | Hover | Expected term / behavior |
|---|---|---|---|
| P01 | `The answer was right under my nose.` | `was` | `be (right) under your nose`; `was → be`, optional `right`, possessive `my` |
| P02 | `The answer was right under my nose, and it was right under my nose.` | second `nose` | Same phrase on the second occurrence; repeated-token offset is honored |
| P03 | `The theft happened under her nose.` | `under` | `(from) under your nose` or `under your nose`, with optional `from` omitted |
| P04 | `She spilled the beans.` | `spilled` | `spill the beans`; verb inflection only on verb literal |
| P05 | `The car broke down.` | `broke` | `break down` |
| P06 | `The old man kicked the bucket.` | `kicked` | `kick the bucket` |
| P07 | `He hit the nail on the head.` | `nail` | `hit the nail on the head`; middle-token hover works |
| P08 | `The test was a piece of cake.` | `piece` | `a piece of cake`; article remains required |
| P09 | `It was easy as ABC.` | `easy` | `(as) easy as pie/ABC/anything/falling off a log`; `ABC` branch |
| P10 | `It was as easy as falling off a log.` | `falling` | Same term; multi-token alternative branch |
| P11 | `She arrived just in the nick of time.` | `nick` | `(just) in the nick of time`; optional `just` consumed |
| P12 | `She arrived in the nick of time.` | `nick` | Same term; optional `just` skipped |
| P13 | `It was a near thing.` | `near` | `a close/near thing`; `near` branch only |
| P14 | `It was a bolt out of the blue.` | `bolt` | `a bolt from/out of the blue`; `out of` branch |
| P15 | `He carried the plan out carefully.` | `carried` | `carry sth out`; bounded object slot between verb and particle |
| P16 | `She carried out the plan.` | `carried` | `carry out something`; object after particle |
| P17 | `She looks after her sister.` | `looks` | `look after sb/sth`; verb inflection + slot |
| P18 | `I cannot put up with this noise.` | `put` | `put up with sth/sb`; multi-particle sequence |
| P19 | `They gave up on him.` | `gave` | `give up on sb/sth`; inflection + pronoun slot |
| P20 | `She came up with a better plan.` | `came` | `come up with something`; multi-particle + slot |
| P21 | `The project ran out of steam.` | `ran` | `run out of steam`; irregular verb |
| P22 | `They picked up the pieces.` | `picked` | `pick up the pieces`; inflection and longest phrase |
| P23 | `We got the ball rolling.` | `got` | `get/start the ball rolling`; alternative verb branch |
| P24 | `A bird in the hand is worth two in the bush.` | `bird` | Full `a bird in the hand (is worth two in the bush)` |
| P25 | `A bird in the hand is enough.` | `bird` | Short required part of the same term; optional tail skipped |
| P26 | `The apple doesn't fall far from the tree.` | `doesn't` | Fixed contraction and long idiom |
| P27 | `They have a man of few words on the team.` | `man` | `a man/woman of few words`; `man` branch |
| P28 | `They have a woman of few words on the team.` | `woman` | Same term; `woman` branch |
| P29 | `Cash flow improved this quarter.` | `cash` | `cash flow`; contiguous compound |
| P30 | `She took off her coat.` | `took` | `take off something`; inflection + object |
| P31 | `The plane took off.` | `took` | `take off`; no object required for the intransitive entry |
| P32 | `The answer was, right under my nose.` | `under` | No strict phrase if an unlisted comma breaks the fixed span; do not silently ignore internal clause punctuation |
| P33 | `The answer was under my nose.` | `under` | Regression: optional `right` is skipped; match `be (right) under your nose` |

### 10.2 Negative and regression tests

| ID | Sentence | Expected rejection or rule |
|---|---|---|
| N01 | `The answer was right beside my nose.` | No `under your nose` match; preposition differs |
| N02 | `Cashflow improved.` | No `cash flow`; do not split a single token into two words |
| N03 | `She carried the plan.` | No `carry sth out`; particle is missing |
| N04 | `She carried out.` | No `carry out something`; required object slot is empty |
| N05 | `She put up the sign.` | No `put up with sth/sb`; `with` is required |
| N06 | `She looked her after.` | No `look after`; prepositional order is invalid |
| N07 | `It was a close near thing.` | No `a close/near thing`; alternatives are mutually exclusive |
| N08 | `He said “café” and left.` | Tokenizer preserves UTF-16 offsets, combining marks, and quote boundaries; no unrelated phrase is returned |
| N09 | `A 20/20 vision test.` | `20/20` remains a literal numeric token, not an alternative branch |
| N10 | `There are ten and counting.` | Excluded open-ended `...and counting` is not auto-selected |
| N11 | `He has a full, good, thick, etc. head of hair.` | Excluded `etc.` template; fallback only |
| N12 | `She looked after.` | No `look after sb/sth`; required slot missing |
| N13 | `He put the meeting off, but she put it off too.` | Hover each occurrence returns the correct local span; no stale first match |
| N14 | `The answer was right under my nose. The cat ran away.` | No slot or phrase may cross the sentence boundary |
| N15 | `The sky was as clear as mud.` | Match `as clear as mud`, not `as clear as day` |
| N16 | `The sky was as clear as daydream.` | No `as clear as day`; word boundaries are required |
| N17 | `John's bird's eye view` | Do not convert lexical `bird's` into a generic possessive slot |
| N18 | `She called it off.` | Accept only if an explicit `call sth off` (or equivalent explicit source entry) is present; reject an implementation that blindly swaps every particle |
| N19 | `The manager discussed the plan.` | No `ask sb out` or other `sb` phrase without the fixed verb/particle structure |
| N20 | malformed template with unbalanced `(` | Mark unsupported at compile time; never crash lookup |

### 10.3 Exhaustive fixture test generation

Unit tests should not rely only on hand-written examples:

1. For every strict template in the 34,094-term fixture, generate a minimal surface form by choosing one branch and omitting optional groups.
2. Generate a sentence with one neutral prefix/suffix and hover every emitted token.
3. Assert that the template is found for every token inside its span.
4. For each fixed literal (never slot content), mutate one token and assert the original template is rejected; slot-content mutations should still match when they satisfy the slot rule.
5. For every alternative group, generate each branch and assert that the other branches are not required.
6. For every slot template, generate `the plan`, `it`, and a short proper name; assert the slot is bounded.
7. Exclude and separately count `unsupportedOpen` terms; do not silently mark them as passing.

## 11. Performance and memory contract

The following are measurable acceptance budgets, not unverified promises. The blob and its transferred worker representation are one resident allocation, not two:

| Metric | Target |
|---|---:|
| Phrase candidate generation p95 | < 10 ms |
| Phrase AST validation p95 | < 25 ms |
| Full worker lookup p95 (warm index) | < 100 ms |
| Full lookup p99 including IndexedDB definition miss | < 500 ms |
| Hard timeout safety net | 1,000 ms; must not be the normal path |
| Phrase index blob and resident worker representation | ≤ 8 MB on fixture |
| Transient per-lookup matcher state | ≤ 512 KB on fixture |
| Live rich dictionary entries | exactly capped at 10,000 by existing LRU decision |

Benchmark on the lowest practical target device, not only a desktop development machine. Record cold index load separately from warm lookup. A benchmark that cannot run on a 4GB machine is a design failure, even if a fast desktop passes.

The algorithm avoids the two largest avoidable costs:

- no full Cambridge JSON or definitions in the worker phrase index;
- no one-regex-per-term and no unbounded regex wildcard/backtracking.

### 11.1 Cross-browser determinism

The matching result must not depend on IndexedDB cursor order or browser scheduling. Candidate IDs are sorted by explicit resource priority, canonical term, and stable compiler ID before ranking. The implementation uses standard IndexedDB key ranges, `ArrayBuffer` transfer, Web Worker messages, and JavaScript Unicode handling only. Golden tests run in Node and worker contexts; smoke verification covers Chrome and Edge for P0 and Firefox/Brave in the cross-browser follow-up. Browser differences may affect latency, so the same p95/p99 budgets are measured per browser rather than assumed.

## 12. Alternatives considered

### A. Scan all multiword terms on every hover — rejected

Simple, but `O(34k × sentence/template length)` per event. It wastes work on every hover and becomes unpredictable as resources grow.

### B. One precompiled regular expression per term — rejected

It consumes avoidable heap, has difficult escaping/variant handling, and broad placeholder regexes can backtrack or match across unrelated clause material. Regex is also a poor representation of typed slots and optional nested AST nodes.

### C. Build a new dynamic regex for each candidate — rejected

It reduces persistent memory but moves complexity and backtracking to the latency-critical path. A bounded token DP has explicit state limits and is easier to test exhaustively.

### D. Fuzzy edit-distance matching — rejected for phrase detection

It would turn typos, adjacent words, and unrelated phrases into false positives. Fuzzy search may be useful for a separate user-initiated search box, not hover detection.

### E. General NLP/LLM parser — deferred

It could improve POS, dependency, semantic sense, and `sb` classification, but increases bundle size, RAM, cold start, and non-determinism. The dictionary-driven matcher is the correct MVP boundary; a semantic layer can consume its candidate spans later.

### F. Full dictionary in the worker — rejected

It conflicts with the 4GB/RAM constraint and duplicates data already available in IndexedDB. The worker receives the compact phrase index and uses the existing 10k LRU for rich entries.

## 13. Consequences and known ceilings

### Positive

- Exact dictionary terms are the source of truth; the matcher never invents a phrase.
- Optional groups, alternatives, possessives, inflections, and explicit phrasal-verb orders are testable.
- Candidate work is bounded by the anchor index and local token window.
- Definitions/media remain lazy, so phrase detection does not hydrate 90k rich entries.
- The result is deterministic and reproducible across browsers.

### Negative / accepted ceilings

- `...` and `etc.` expressions are not automatically detected in this phase.
- Generic `sb`/`sth` slots cannot provide full semantic certainty without a parser.
- A phrase with a slot longer than six tokens may fall back to a single-word result.
- A resource with malformed Cambridge notation is reported as unsupported instead of guessed.
- Structural matching cannot choose a dictionary sense for polysemous phrases such as `take off`.
- A phrase index rebuild is required after changing the compiler version.

## 14. Implementation order

1. ✅ Add pure tokenizer, template lexer/parser, AST validator, and golden tests (`phraseTemplateParser.ts`).
2. ✅ Add fixture-wide generation test; 34,094 normalized terms compile without malformed-parser failures.
3. ✅ Add phrase index compiler + compact binary blob + serialize/deserialize round-trip (`phraseIndexCompiler.ts`); fixture: ≤8MB, median posting 1–2, p95 ≤25.
4. ✅ Add DB schema v10 `langPhraseIndex` store + `phraseIndexRepository` (put/get/delete/has) + atomic cascade in `importOrchestrator` rollback + `deleteResourceCascade`.
5. Add compact blob loader and worker anchor index.
6. ✅ Add bounded DP matcher + deterministic ranking (`phraseMatcher.ts`); 26 tests covering P01-P33 positive, N01-N12 negative, ranking, edge cases.
7. ✅ Replace the old `confidence >= 0.7` contract with `quality` + structural validity (`phraseMatchService.ts`): `PhraseMatchResult` with `type: 'phrase' | 'word'` and `quality` enum. No confidence score exposed.
8. ✅ Add normal dictionary fallback and request cancellation handling. `matchPhraseRequest` falls back to single-word `findDictionaryByTerm` when no phrase matches. `AbortSignal` support throughout.
9. ✅ Run fixture benchmark (`phraseMatchBenchmark.test.ts`): compile 34k terms 80ms, blob <8MB, deserialize <200ms, match 1-2ms, tokenize 50 words 0.04ms.

## 15. Official references

- Cambridge Grammar — phrasal verbs and multi-word verbs: https://dictionary.cambridge.org/grammar/british-grammar/phrasal-verbs
  - The documented distinction is that many phrasal-verb objects may occur before or after the particle when they are not personal pronouns; personal pronouns follow a stricter separated order, while prepositional-verb objects remain after the preposition.
- Cambridge Dictionary — idiom definition: https://dictionary.cambridge.org/dictionary/english/idiom
  - An idiom is described as a group of words in a fixed order with a particular meaning; this supports treating idiom literals as ordered tokens rather than fuzzy bags of words.
- MDN — Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
  - IndexedDB supports bounded key ranges and cursors; cursor-based iteration avoids creating every value at once when only keys/metadata are needed.
- MDN — Using Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
  - Workers run off the UI thread and communicate with `postMessage`; data is copied unless a transferable buffer is used.

## 16. Decision gate

This ADR is ready for implementation only when these checks pass:

- the parser can compile every supported pattern in the fixture without throwing;
- open-ended terms are counted and explicitly excluded;
- P01–P33 and N01–N20 pass;
- fixture-generated strict tests pass;
- phrase index and worker heap budgets pass on the target low-memory device;
- no claim of semantic sense disambiguation is added to the UI contract.
