# Spec — tihoka-dict v1: Plugin-Based Combined Dictionary

Status: prototype-validated (`src/entrypoints/mockup-dictionary-popup/`)
Owner feature: `src/features/dictionary/`, `src/features/dictionaryPopup/`

## Objective

Normalize heterogeneous external dictionary data into one stable, source-agnostic
internal representation, then render it in the lookup popup as a single merged
entry. Users tick which senses/variants go into a card — the UI never hides or
pre-selects content on their behalf.

Validated end-state (prototype `take` entry, real extracted data):
~117 checkable senses from 4 providers, 59 phrase links, 52 phrasal links,
word origin variants, word forms, frequency — all from real source markup.

## Invariants

1. **No vendor names in schema or UI.** Providers have structural ids; a parser
   detects shapes, not product identities. (`ImportFormat` already enforces
   this — 6 structural ids.)
2. **Never align senses across sources.** Sense 3 of provider A ≠ sense 3 of
   provider B. Blocks stay separate; each sense carries its own provenance.
3. **Unknown structure → unsplit.** If markup doesn't match a known shape,
   keep it as one opaque `definition` blob. Never guess-split.
4. **`kind` is provider-declared, never inferred.** `take after` (phrasal) and
   `take a dose` (collocation) are structurally identical — the system must
   not heuristic-guess categories.
5. **Content drives layout.** Absent fields render nothing; a `{term, gloss}`
   entry produces a minimal popup with the same renderer.
6. **User selects.** Every selectable unit (sense, word origin variant, …)
   is a checkable row; selection feeds the card prefill.

## Plugin taxonomy — exactly two contracts

```ts
interface DictionaryProvider {
  /** Exact-key lookup. Anything with its own definitions is a dictionary
   *  entry — word, phrasal verb, collocation, idiom, phrase, slang. */
  lookup(term: string): EntryFragment | null;
  /** Reverse index — optional. "What entries of mine relate to this term?"
   *  Provider tags each item's `kind` itself. */
  relatedEntries?(term: string): readonly Related[];
}

interface EnrichmentProvider {
  /** Metadata-only contribution. No senses allowed. */
  enrich(term: string): Partial<CanonicalEntry>;
}
```

A provider that emits senses is a dictionary provider — regardless of what it
calls its content. Word forms, word family, pronunciation, frequency,
etymology are enrichment providers.

## Canonical schema

```ts
interface SenseLine {
  role: 'gloss' | 'example' | 'note';
  text: string;
  translation?: string;   // native-side, revealable
  citation?: string;      // "The Guardian, 2019"
  pattern?: string;       // "[VERB noun]" — grammar pattern after example
}

interface Sense {           // entities/dictionary/types.ts — SenseBlock
  pos?: string;           // per-sense pos (flattened — no PosSection wrapper)
  labels?: string[];      // ['transitive', 'informal', 'move', 'kids', 'slang']
  level?: string;         // 'B1' — renders as plain "[B1]"
  lines: SenseLine[];     // first gloss line renders inline after labels
  subsenses?: { num: string; text: string }[];
  synonyms?: string[];    // per-sense — "Synonyms: grip, grab, seize"
  antonyms?: string[];    // per-sense — "Opposite: let down"
}

// POS sections stay ordered by simply repeating pos on each sense of the
// section; audience variants are plain senses labeled 'kids'/'finance' —
// appended by their provider like any other source block.

interface Related {         // RelatedEntry
  term: string;
  kind: string;           // open vocabulary — see below
  preview?: string;       // inline gloss so the list reads without a fetch
}

interface Entry {           // DictionaryEntry
  term: string;
  reading?: string;
  pronunciation?: string;   // IPA text
  audio?: string;
  senses: Sense[];          // ordered, provenance stays per-source row
  pos?: string;             // entry-level fallback pos
  examples?: string;        // legacy newline-separated examples
  frequencyStars?: number;    // renders "frequency 3"
  level?: string;             // headword-level chip (rare; per-sense preferred)
  inflections?: { type: string; forms: string[] }[];   // "word forms: take, …"
  related?: Related[];
  etymology?: { chain: string; firstKnownUse?: string;
                variants?: { text: string; source?: string }[] };
  wordFamily?: { nouns?: string[]; verbs?: string[];
                 adjectives?: string[]; adverbs?: string[] };
  wordNet?: { synset?: string[]; hypernyms?: string[] };
  derivedTerms?: string[];
  anagrams?: string[];
}
```

### `related.kind` vocabulary

| kind | label | source example |
|---|---|---|
| `phrasal` | phrasal verbs | mtBab `tn_*`, Collins `phrv-ext`, LDOCE `SpokenSect`/`PhrVbEntry` |
| `idiom` | idioms | Collins `idm-ext`, OALD `idm-g`, idiom blocks |
| `collocation` | collocations | Collins `collo`, LDOCE `collocate` |
| `expression` | phrases | Collins `phr-ext` (pos=phrase), MW `dro`, LDOCE `merge_sense` |
| `lemma` | lemmas | surface→lemma redirect |
| `derivative` | derived terms | Wiktionary derived terms, LDOCE `RELATEDWD` |
| `thesaurus` | thesaurus | Macmillan topic pages, OALD `mlt`, LDOCE `Thesref` |
| `see also` | see alsos | LDOCE generic `Crossref` |
| anything else | `${kind}s` | generic pluralized fallback |

Dedupe key: `term.toLowerCase()` minus leading `to `. On kind conflict for the
same term, first-wins by provider priority.

## Import pipeline — normalization happens OUTSIDE the app

**The app never parses vendor formats.** MDX/proprietary markup is not an
`ImportFormat` and never becomes one. The boundary:

```
vendor file (.mdx, proprietary html/json…)        OUTSIDE THE APP
   │
   ▼ scripts/normalize-dictionary.mjs + source adapters
   │   vendor markup → EntryFragment
   │   per-block provenance, kind mapping tables live HERE
   ▼ mergeFragments(fragments, priorityOrder) — deterministic, pure
   ▼ canonical json-entries file (definition + senses + fields)
───────────────────────── boundary ─────────────────────────
vendor-normalized .json                            INSIDE THE APP
   │
   ▼ existing 'json-entries' ImportFormat
   ▼ langDictionaryEntry store
```

`EntryFragment = Partial<Entry> & { source: string }` — every field optional;
`source` = provider id for provenance badges/filtering.

Consequence: the extractors in `tmp/audit-mtbab/` (mtBab TR-ids, Collins
`phr-ext`/`phrv-ext`, LDOCE `signpost`/`synopp`, MW `dro`, UD `D2`) are
**adapter prototypes for the converter**, not app code. The extension's
dependency graph stays free of vendor parsers.

### Merge rules by field kind

| Field kind | Rule |
|---|---|
| `sections` / senses | **never merge** — concatenate blocks; each section carries its provider. Audience variants append as labeled senses (`[kids]`, `[finance]`). |
| singleton (ipa, word forms, level, frequencyStars) | **first-wins** by provider priority — only the highest-priority dictionary that has the component *and hasn't disabled it* supplies it; lower providers fall through |
| scalar (firstKnownUse) | first-wins by provider priority |
| list (related, derivedTerms, wordFamily, wordNet) | union + dedupe by normalized term; provenance per item |
| rich text (etymology) | keep all → `variants[]` with `source` tag; each renders as its own checkable row |

Priority = user's plugin order in settings (drag-to-reorder); merge code holds
no baked-in preference.

### Per-resource component toggles

Each `ResourceInfo` carries `components` (canonical parts detected at import —
or lazily scanned + persisted via `RESOURCE_COMPONENTS` for pre-existing
imports) and `disabledComponents` (user toggles in the resource card detail).
The lookup merge drops disabled parts per-resource: `definitions` skips the
entry's senses, `examples`/`translations`/`synonyms` strip sense content,
`related`/`wordFamily`/`wordNet`/`derivedTerms` skip their union merge, and
the singletons (`pronunciation`, `inflections`, `level`, `frequencyStars`)
fall through to the next dictionary in priority order — e.g. dictionary 2's
word forms show when dictionary 1's word-forms toggle is off. Etymology-only
resources (etymonline) expose just `etymology` + `related`-free content, so
toggling `etymology` off silences them entirely.

## Lookup — multi-candidate

`lookupOrchestratorMulti` returns candidates in order:

```
phrase match  →  surface token  →  origin lemma
[take care of]    [takes]          [take]
```

Each candidate is an independent `Entry` (phrase entries are ordinary entries —
`take care of` has its own defs from the collocations/MW provider). The popup
renders them as a vertical stack inside one frame with a bottom chip bar +
scroll-spy (existing `cellCandidatesChips` in `DictionaryPanelView`).

## Rendering contract (popup)

```
termⁿ                          ✎ ⚡
/teɪk/ 🔊  enPR tāk  rhymes -eɪk
status-pill  frequency 3  [B1]
word forms: take, takes, taking, took, taken
───────────────────────────────
○ [verb] [move] [transitive] to move or go with someone… ˅
  · Barney took us to the airport.
  Synonyms: grip, grab, seize
  Opposite: let down
○ [phrase] [B2] You can say 'I take it' to check…
───────────────────────────────
word origin: …chain… · first known use: before 12th century   ○
word origin: …variant… [etymonline]                            ○
phrasal verbs: take after · take off · take over · …
collocations: take a dose · take a taxi · …
phrases: I take it · take a back seat · take the Fifth · …
```

Rules:

- `[pos] [labels…] [level] gloss` — one line per sense; brackets are literal
  selectable text, no chip styling.
- Examples indent under `·`; `pattern` renders after the example text.
- `translation` hides behind a chevron (`˅` closed / `˄` open), renders
  indented beneath on expand.
- Row click toggles checkbox — **unless** the user is selecting text
  (`getSelection().toString()` non-empty → skip toggle). All `[…]` labels must
  be copyable.
- Related groups render flat inline; items link when the term resolves in the
  entry registry, plain text otherwise.
- Slang = a normal `pos: 'slang'` section.
- Removed-by-design: sense numbers, signpost menus, star ratings, audience
  tabs, entry-level synonym groups, crowdsourced votes, "see also" / "recent
  web examples" / "usage notes" blocks.

## Standalone converter

`scripts/tihoka-convert-dictionary.mjs` — offline converter, the ONLY place
vendor formats are understood. Pipeline: `input → container detection (magic
bytes) → dict-adapters/* → canonical normalizer → .json output`. Accepts
`.json/.json.gz` entry arrays, `.zip` (term-bank, zip-of-json, or
zip-of-mdx/mdd), `.mdx`, `.db/.db.gz` sqlite — detected by magic bytes +
content shape, never vendor names. `--only <csv>` filters to exact keys for
spot checks; `--limit N` bounds a run; `--stats` prints counts without
writing. Output = canonical `json-entries` which the app imports through the
existing `json-entries` path unchanged.

Processing lives in `scripts/dict-adapters/` — one module per container or
markup family:

| module | input shape |
|---|---|
| `jsonEntries.mjs` | entry-object JSON arrays (canonical passthrough) |
| `termBank.mjs` | term-bank zips (`index.json` + `term_bank_*`) |
| `sqlite.mjs` | `langResourceEntry` sqlite |
| `mdx.mjs` | `.mdx` via `js-mdict` (devDep — converter only); dispatches each record to the first matching markup adapter, collects `spawned` sub-entries merged across parents by term (gloss-deduped) and emits them last flagged `spawned` — the writer appends their senses into the real entry when one exists for the term (bổ sung thông tin), else they become standalone entries. Related terms are rewritten to the hyphen↔space variant that exists as a key (`take-in`→`take in`) and deduped by `kind:term`. Regional-variant keys (`uk X`) are skipped when base `X` exists, else emitted under the stripped term |
| `trTableRows.mjs` | `*_T_id` table-row markup: `pa`→pronunciation, `tl`→pos header (red-font forms →`inflections`, stripped from pos text; forms inside descriptive parens/`là …`/`thành …` stay inline, forms-only parens drop), `mn`→gloss, `mh`/`mh_n`→example+translation, `tn_*`→`related {kind:'phrasal'}` + spawned phrase body, `pak`→note, `cvk_t`→`altterm` |
| `cobuild.mjs` | `cb24`/`cobuild` markup: `.hom`→sense (`gramGrp` pos/`cefr`→level/`[labels]`, `.def`→gloss, `.cit .quote`→example, `.tips`→`pattern`, `.thes`→synonyms), `.hom.ext .phr-ext`→`related 'expression'`+spawned, `.phrv-ext`→`related 'phrasal'`+spawned, `.idiom .idms .idm-ext` (`ihw`+`idm-sense`)→`related 'idiom'`+spawned, `.collocation .collo`→`related 'collocation'`+spawned corpus examples (`.credits`→citation), `.form.inflected_forms` `orth[title]`/`a.orth.add[title]`→`inflections` grouped per grammatical type (deduped across repeated `definitions` groups), `.pron`→pronunciation, `xr` "explained at"→`related 'expression'`. Parsing excises each `definitions` block first then sub-entry blocks (`hom ext`/`phrv-ext`/`idm-ext`/`collocation`) per source — Collins interleaves `hom`/`hom ext` inside `definitions` groups so position-based zoning mis-attributes senses (e.g. `bear` noun group after `phrvs`) |
| `macmillan.mjs` | `dict-american`/`dict-british` markup: `.homograph` per-pos blocks → `.part-of-speech-ctx`→pos, `.stars-grp .icon-star` count→`frequencyStars`, `.pron`→pronunciation, `.wordforms` `tr` rows (`inflection-type`+`inflection-entry` pairs)→`inflections`, `.sense`→sense (`syntax-coding`→`[labels]`, `.definition`→gloss, `.examples` `strong` headers→`pattern` + `p.example`→examples, `.thes` links→`synonyms`), `ol.sub-senses`→`subsenses`, `li.pv-xref`→`related 'phrasal'`, `li.phr-xref`→`related 'expression'`, `.relatedentries`→`related 'derivative'`. `gref-group` records (inflected/British variants of a lemma) → 1 gloss sense + `related 'derivative'`. `dict-*-thesaurus` topic pages → `pos:'thesaurus'` senses + `related 'thesaurus'` links with gloss previews (e.g. *to need something* → need, require, cry out for…). Nested-span-safe via `markup.mjs` `blocks()` balanced extractor |
| `oald.mjs` | `oald`/`webtop` markup: `.entry` per headword → `h1.headword`+`span.pos`→pos, `phons_br`/`phons_n_am .phon`→pronunciation, `li.sense` (`cefr` attr→`level`, `.grammar`→labels, `.use`→note line, `.cf`→`pattern`, `.def`→gloss, `ul.examples li` `.cf`+`.labels`+`.x`→examples, `xrefs xt=nsyn` `.xh`→synonyms / `xt=see`→`related 'expression'`), `idm-g`→`related 'idiom'`+spawned, `pvrefs`→`related 'phrasal'`. `.unbox` boxes: `verbforms` `td.verb_form`→`inflections`, `wordorigin`→`etymology`, `synonyms`/`mlt` `li`→`related 'thesaurus'`, `extra_examples` `.x`→example lines on the last sense |
| `ldoce.mjs` | `ldoceEntry` markup: `.Head` `lm5pp_POS`→pos + `PRON`→pronunciation + `●` count→`frequencyStars` + `ORTHVAR`→`altterm`, `.Inflections` `infllab`+form→`inflections`, `span.Sense`→sense (`SIGNPOST`/`ACTIV`/`GRAM`/`GEO`/`FIELD`/`FIELDXX`/`REGISTERLAB`→labels, `LEXUNIT`/`LEXVAR`→leading labels, `LANG`+`ORIGIN`→origin label, `DEF`→gloss, `EXAMPLE .english`→examples, `GramExa PROPFORM`/`PROPFORMPREP`→pattern examples, `OPP`/`SYN`/`BREQUIV`/`AMEQUIV` synopp→antonyms/synonyms (equiv links get `(geo)` qualifier), `EXPL`/`dont_say`→note, `ColloExa`→collo-pattern examples, in-sense `ThesBox`/`corpus`→lines), `REFHWD merge_sense` senses → spawned `pos:'phrase'` entries + `related 'expression'` (`↔` heads derive the phrasal term from the particle after `↔`/LEXUNIT → `pos:'phrasal verb'`), nested `Sense cross_sense`/`Subsense`→`subsenses` (+`LEXUNIT` prefix; container senses with no own lines still emit subsenses), `SpokenSect PhrasalVerb`→`related 'phrasal'`+spawned — `REFHWD` group heads at section level apply to following `Sense` children, `LDOCE5pp_sensefold` wrappers recursed, `↔` heads normalized to `verb particle` terms, `PhrVbEntry` crossrefs→`related 'phrasal'` (href key), `RELATEDWD`→`related 'derivative'`, generic `Crossref`→`related 'see also'`, `.etym` (Head span excised) →`etymology`, `.wordfams` grouped by POS→`wordFamily`, `Thesref`/`BoxPanel` entry links→`related 'thesaurus'`. Tail boxes outside `ldoceEntry` spans (`ThesBox`/`GramBox`/`corpus`/`bussdictEntry`/`PhrVbEntry`) are parsed from record leftover — box content becomes `thesaurus`/`grammar`/`corpus`-labeled pseudo-senses, bussdict senses join main senses. `*-topic` records (`topicpagetitle`) → `pos:'thesaurus'` entries listing topic terms. `cn_txt` bilingual spans stripped from all text, never emitted |
| `etymonline.mjs` | `div.word` etymology-prose markup: `h1.hw`/`p.hw`+`<pos>`→pos label (numeric `<pos>` = homograph index, skipped), each `section.defination` `<p>` paragraph→prose folded into entry-level `etymology` (first `div.word`→`chain`, further homograph blocks→`variants` labeled by pos) — the whole record IS word origin so it merges into the canonical origin block; trailing `div.related` backlink list excised; no senses emitted |

Records with no matching adapter or no parsed senses *and* no etymology are
skipped — unknown structure is never split.

## Verification

Prototype: `src/entrypoints/mockup-dictionary-popup/` (design-time, remove when
the feature ships). Regenerate data:

```
node tmp/audit-mtbab/enrich-take.mjs   # audited HTML → enrich.json
node tmp/audit-mtbab/extract-real.mjs  # mtBab/UD mdx + enrich → data.generated.ts
npm run typecheck && npm run test:unit && npm run build
```

## Open questions

- Source filter chip in header (toggle providers per lookup)?
- Whether `preview` on `Related` should render (tooltip vs inline).
- Conflict display when two providers tag the same term different `kind`s.
- `takes`-style surface candidates: keep as thin redirect entries or merge
  into the lemma candidate?
