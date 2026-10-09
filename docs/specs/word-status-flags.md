# Spec: Word-status flags — 3 base statuses + tracking/learning overlays, redesigned i+1

> Intent: `docs/intent/word-status-flags.md` · ui_surface: yes · Mode: interactive

## Objective

Re-model the word-status semantics so `tracking` and `learning` become flags on `unknown` instead of peer statuses. Base status = mức độ biết (`unknown | known | ignore`); flags = engagement (`tracking`: đang theo dõi; `learning`: đang có thẻ SRS). `learning` is system-managed (SRS card exists) — never user-settable. i+1 keeps its current counting semantics (any not-known branch is a gap) but the gap word surfaces status + frequency pill so the learner can judge "đáng học không". Token surfaces distinguish the three not-known branches via a status-gradient underline.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | status key press, popup pill click, lookup, SRS card delete/create intent | key `1-4`, pill click, hover/select term | token underline gradient, i+1 freq pill, popup badge/pill, SRS view |
| SRS engine (internal) | card created, card matured, card deleted | card state | — (writes flag) |
| Anki sync | poll/sync pass | card existence + scheduledDays | — (writes flag/base) |

System-internal: status resolution, flag lifecycle, gap counting, rendering. The learner never appears inside a system flow.

## Requirements

### Functional

REQ-1: Status model — base + flag
- Actor: learner / sync engines
- Goal: word status expresses knowledge level and engagement separately
- Preconditions: none
- Basic flow:
  1. system stores status per `(langCode, term)` as today (enum row)
  2. system interprets `'tracking'` as `unknown + flag=tracking`, `'learning'` as `unknown + flag=learning` — the flag is semantic, not a new field
  3. system exposes helpers: `baseStatus(status)` → `unknown|known|ignore`, `statusFlag(status)` → `none|tracking|learning`, `isNotKnown(status)` → `status !== 'known' && status !== 'ignore'`
- Alt flow: flag on `known`/`ignore` is impossible — flag clears when base leaves `unknown`
- Exception: none (pure mapping)
- Rules: flags live only on `unknown`; `learning` implies engagement (supersedes `tracking`); storage enum unchanged — no IDB migration; **store-level guard**: `'learning'` is writable only by system writers (`setWordStatusFromSync` + the internal-SRS writer) — public `setWordStatus`/`setWordStatuses`/`setWordStatusPos` calls carrying `'learning'` are rejected (no-op), so no UI path can fabricate the flag
- Write-path inventory (all callers must respect the guard): `statusKeyControls` (keys), `useCandidate` (popup pill), `vocabularySource` (auto-mark + vocabulary list edits), `SrsDeckDetail` (deck UI), background `handlers/wordStatus` (message surface), `ankiStatusSync` + internal-SRS writer (system)
- Postcondition: every consumer reads consistent semantics
- NFR refs: NFR-3

REQ-2: Popup status controls
- Actor: learner
- Goal: change knowledge level without mixing in engagement
- Preconditions: dictionary popup open on a term
- Basic flow:
  1. learner clicks status pill
  2. system cycles base `unknown → known → ignore → unknown`
  3. system renders new base status on pill + token surfaces
- Alt flow: term carries `tracking`/`learning` flag → segmented control renders the flag as the pill's right segment `[base | flag]`; flag segment click toggles tracking (same semantics as key `4`, no-op/read-only on `learning`); base segment still shows/cycles the 3 bases only
- Exception: none
- Rules: pill never displays or cycles into tracking/learning; SRS icon is a state-aware button in `cellHeaderActions` — ghost (no card) → `addToOceanSrs` creates card → flag=learning; learning fill (card exists) → `openSrsStudyPage` → `srs-study` deck detail (view only); disabled when base ≠ `unknown`
- Postcondition: base status updated; flag preserved if base stays `unknown` (see REQ-4 reconcile rule), cleared otherwise
- NFR refs: NFR-1

REQ-3: Status keyboard controls
- Actor: learner
- Goal: set status fast on selected/hovered/popup terms
- Preconditions: tokenized surface active
- Basic flow:
  1. learner presses `1|2|3|4`
  2. system maps `1→unknown, 2→known, 3→ignore, 4→tracking-toggle`
  3. system applies to popup target > selected terms > hovered term (existing priority)
- Alt flow: `4` toggles tracking — `unknown ↔ unknown+tracking`; on `unknown+learning` key `4` is a no-op (learning already implies engagement); key `5` is unbound (no-op)
- Exception: no target → no-op
- Rules: no key writes `learning`; setting `known`/`ignore`/`unknown` clears the stored flag — see REQ-4 reconcile for terms whose card still exists
- Postcondition: target terms' status updated, re-rendered, persisted
- NFR refs: NFR-1

REQ-4: Learning flag lifecycle (SRS-driven)
- Actor: SRS engine, Anki sync
- Goal: `learning` always means "a card exists right now"
- Preconditions: word is in unknown family
- Basic flow:
  1. system observes card creation (`cardCreation.ts` internal / Anki sync card discovery)
  2. system sets flag `learning` on the term (`unknown → unknown+learning`, `+tracking → +learning`)
  3. status renders the learning branch
- Alt flow: card disappears (internal delete / absent from Anki snapshot) → system clears flag only if **no card exists in either source** — internal deletion consults the last Anki-sync snapshot, Anki-clear consults internal `hasSrsCard(term)` — and only when current status is `'learning'` → write `'unknown'`; terms the user moved to `known`/`ignore` are untouched
- Exception: Anki sync lag → stale flag until next pass (accepted); explicit user base-write on `unknown+learning` wins over the flag (user assertion outranks card heuristic) — flag may be re-applied by the next card event or reconcile while the term is still in the unknown family
- Rules: writers never downgrade base status; flag clear is conditional on zero cards across both sources; Anki mature (`scheduledDays >= MATURE_INTERVAL_DAYS`) transitions base to `known` (existing rule preserved); `known`/`ignore` never gain a flag
- Postcondition: flag state mirrors card existence modulo explicit user base-override
- NFR refs: NFR-2

REQ-4b: Learning flag reconcile (internal SRS)
- Actor: SRS engine
- Goal: heal drift between stored flag and card existence
- Preconditions: SRS pool/session resolution runs
- Basic flow:
  1. system iterates live cards
  2. term with card + status in unknown family without `learning` → restore flag
  3. term with `learning` + no card (either source) → `unknown`
- Rules: reconcile only touches unknown-family statuses; `known`/`ignore` never rewritten
- Postcondition: event gaps (e.g. flag cleared while card lived) self-heal
- NFR refs: NFR-2

REQ-5: i+1 gap marking + frequency pill
- Actor: learner (views)
- Goal: see the single not-known word of a fully-comprehensible sentence, with its frequency
- Preconditions: tokenized sentence with statuses resolved
- Basic flow:
  1. system counts not-known tokens per sentence (all three branches count)
  2. exactly one gap → that token renders status capsule + frequency pill background
  3. learner views the pill, judges frequency
- Alt flow: zero or ≥2 gaps → sentence renders without gap marking (existing behavior)
- Exception: sentence boundary undefined → token falls back per existing `sentenceIndex` handling
- Rules: `isNew` semantics unchanged — `unknown|tracking|learning` all count as gap; non-gap tokens render plain; pill content = the term's existing frequency rank (same source as the current pill lane — best `FrequencyEntry.rank` resolved by `tokenListMetadata`, no new data source); comprehension scoring unchanged — `tracking`/`learning` keep `TRACKING_WEIGHT` half-credit
- Postcondition: `iPlus1` flag set only on the gap token
- NFR refs: NFR-1, NFR-4

REQ-6: Token status-gradient underline
- Actor: learner (views)
- Goal: distinguish the three not-known branches at a glance
- Preconditions: token has resolved status
- Basic flow:
  1. system renders status underline: `unknown` = solid unknown color
  2. `+tracking` = smooth gradient tracking→unknown colors
  3. `+learning` = smooth gradient learning→unknown colors
- Alt flow: known/ignore render existing visual (unchanged)
- Exception: host pages with aggressive CSS → existing `!important` layer covers
- Rules: colors from `--cell-token-status-*` tokens only; same visual on subtitle overlay, cue list, web tokenize
- Postcondition: three branches visually distinct
- NFR refs: NFR-1, NFR-4

REQ-7: Auto-tracking on lookup (preserve)
- Actor: learner
- Goal: looked-up/saved words stay watched
- Preconditions: word looked up or queued
- Basic flow: existing `nextMarkedStatus` path marks `tracking` on lookup — unchanged
- Rules: auto-mark never escalates `learning` back to `tracking`
- Postcondition: term = `unknown+tracking` unless already learning/known/ignore
- NFR refs: NFR-2

REQ-8: Status aggregation + consumers (preserve semantics)
- Actor: system
- Goal: POS aggregation, session recap, vocabulary list keep working under new semantics
- Preconditions: per-POS rows exist
- Basic flow:
  1. system aggregates `LEARNED_RANK` order `unknown < tracking < learning < known` (unchanged)
  2. `ignore` wins only when every variant ignored (unchanged)
- Rules: consumers grouping by enum value (`sessionRecap`, vocabulary) map `'tracking'|'learning'` to the "not-known" bucket where a 3-way view is needed
- Postcondition: no consumer regresses
- NFR refs: NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | i18n for every new/changed label (status names, badge tooltip, key hints) en+vi | U | all user-visible text routed via message keys |
| NFR-2 | No IDB migration — stored enum rows reinterpreted in place | R/S | zero data loss, zero schema bump |
| NFR-3 | Status resolution stays O(1) per token — flag/base helpers are pure functions | P | no added cost on tokenize hot path |
| NFR-4 | Gradient readable on light host pages — colors pinned to light palette per existing token pinning | U | contrast vs page bg, no host-color bleed |

## Flows / States

### Status state machine

```
unknown --key 2→ known            unknown --key 3→ ignore
unknown --key 4→ unknown+tracking
unknown --SRS card created→ unknown+learning
unknown+tracking --key 4→ unknown          (toggle off)
unknown+tracking --key 2→ known    unknown+tracking --key 3→ ignore
unknown+tracking --SRS card created→ unknown+learning
unknown+learning --card deleted/lost→ unknown
unknown+learning --key 4→ (no-op)
unknown+learning --Anki mature→ known
known|ignore --key 1→ unknown
any+flag --base leaves unknown→ flag cleared
```

### i+1 activity

```
tokenize → resolve statuses → per sentenceIndex count not-known tokens
  count == 1 → gap token: iPlus1=true → pill + status capsule + gradient underline
  count != 1 → no gap marking
```

## Function ↔ Feature Map

| Function | Features |
|---|---|
| store + resolve word status semantics | `wordStatusStore` reinterpretation helpers (`baseStatus`, `statusFlag`, `isNotKnown`), `STATUS_CYCLE` → 3-state cycle |
| display status on popup | status pill (3-cycle), tracking badge, SRS view icon |
| set status via keyboard | `STATUS_BY_KEY` remap 1-4 |
| keep learning truthful | SRS card-creation hook (`cardCreation.ts`), card-deletion hook, Anki sync mapping |
| mark i+1 gap | `markIPlus1Tokens` (unchanged logic), `iPlus1` flag → pill+capsule render |
| distinguish not-known branches visually | gradient underline in `tokenSpanCss` (overlay + web variants), `CueTokenText` classes |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| WordStatusEntry | `{term, status, updatedAt}` — status enum unchanged (5 values, reinterpreted) | IDB `WORD_STATUS` per lang | until user clears / trash flow |
| Status flag | none — derived from enum value | n/a (semantic layer) | n/a |
| SRS card | existence + `scheduledDays` | SRS store / Anki | card lifetime drives flag |

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 distinguish 3 branches | REQ-1, REQ-6 | AC-1, AC-2 |
| N2 pill 3-cycle + badge | REQ-2 | AC-3 |
| N3 keys remap | REQ-3 | AC-4 |
| N4 learning SRS-only + view | REQ-4, REQ-2 | AC-5, AC-6 |
| N5 card loss → unknown | REQ-4 | AC-7 |
| N6 i+1 + freq pill | REQ-5 | AC-8 |
| N7 gradient visual | REQ-6 | AC-2 |
| N8 auto-tracking preserved | REQ-7 | AC-9 |
| N9 aggregate rank | REQ-8 | AC-10 |
| N10 flag on ignore | REQ-1, REQ-4 | AC-11 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1 gradient distinguishes branches | REQ-6 |
| 2 i+1 word + freq pill | REQ-5 |
| 3 pill 3-cycle, badge, SRS view | REQ-2 |
| 4 keys 1-4, no learning key | REQ-3 |
| 5 card ↔ flag lifecycle | REQ-4 |

## Alternatives considered

| Option | Rejected because |
|---|---|
| Split storage into `{base, flag}` columns + migrate rows | IDB schema bump + migration risk for zero gain — the enum already encodes the full state space; reinterpretation is one pure-function layer |
| Keep 5-value flat status + 5 keys | Reproduces the root problem — engagement masquerades as knowledge, `learning` settable by hand |
| Derive `learning` purely at read time (query card stores per token) | Extra async on the tokenize hot path for every token — stored flag + event-driven writers + reconcile is O(1) and self-healing |
| Badge read-only (no pointer toggle for tracking) | Touch/tablet persona (5–80) has no keys — badge click toggles tracking like key `4` |

## Boundaries

- Always: statuses resolved through helpers — no raw enum comparisons scattered; i18n keys for new text; token colors from `--cell-token-status-*`; `'learning'` writes only via system writers (REQ-1 guard)
- Ask first: IDB schema change (none planned); new dependency (none planned)
- Never: user-settable `learning`; flag on `known`/`ignore`; migrate existing rows

## Success Criteria

- [ ] AC-1 `baseStatus`/`statusFlag`/`isNotKnown` helpers exist and all status consumers route through them; unit tests cover the 5 enum values.
- [ ] AC-2 Token underline renders: `unknown` solid; `+tracking` gradient unknown+tracking; `+learning` gradient unknown+learning — identical across subtitle overlay, cue list, web tokenize (visual diff check).
- [ ] AC-3 Popup status pill cycles `unknown → known → ignore` only; `tracking`/`learning` flags render as separate badge (click toggles tracking, no-op on learning); SRS icon routes to the existing `openSrsStudyPage`/deck surface.
- [ ] AC-4 Keys `1/2/3/4` write `unknown/known/ignore/toggle-tracking`; key `5` unbound; no key path can write `learning`; key `4` on `+learning` is a no-op.
- [ ] AC-4b Public status writers reject `'learning'` — `setWordStatus(lang, t, 'learning')` from a non-system caller is a no-op; only `setWordStatusFromSync`/internal-SRS writer can set it.
- [ ] AC-5 Internal SRS card creation sets `learning` flag on the term; covered by unit test on `cardCreation` path.
- [ ] AC-6 Anki sync maps: card exists + non-mature → `learning` flag (unknown family only); mature → `known`; no card → flag cleared. `known`/`ignore` terms untouched.
- [ ] AC-7 Card deletion (internal or Anki disappearance) → term returns to `unknown` only when no card remains in either source and current status is `'learning'`; a card surviving in the other source keeps the flag.
- [ ] AC-7b Reconcile pass: live card + unknown-family status without `learning` → flag restored; `learning` + zero cards → `unknown`; `known`/`ignore` never rewritten.
- [ ] AC-8 Sentence with exactly one not-known token (any branch) marks that token `iPlus1` → renders status capsule + frequency pill showing the term's resolved `FrequencyEntry.rank`; 0/≥2-gap sentences unmarked. `comprehensionScore.test` updated.
- [ ] AC-9 Lookup/save still auto-marks `tracking`; auto-mark never demotes `learning`.
- [ ] AC-10 `aggregatePosStatus` keeps rank `unknown < tracking < learning < known`; all-ignored → `ignore`.
- [ ] AC-11 Existing stored rows load unchanged — no migration, no data loss (upgrade test: old `tracking`/`learning` rows read as unknown+flag).
- [ ] AC-12 `known`/`ignore` terms never gain a flag from any card event (internal create/delete, Anki sync) — status value unchanged.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (tokens, no hardcoded colors)
- [ ] Browser verify: popup pill cycle, badge, gradient on real page; i+1 pill on a real sentence
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated; i18n en+vi

## Open Questions / Accepted Risks

- Anki sync lag leaves stale `learning` flag until next pass — accepted (self-heals).
- Old `learning` rows without a real card stay flagged until first reconcile pass — accepted (harmless display); optional one-time reconcile can be a follow-up.
