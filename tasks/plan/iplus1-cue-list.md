# Plan: i+1 marking parity for the cue list (SSOT unification)

## Problem

The cue list (`CueList.tsx`, `CueTokenText` React renderer at L144-225) stamps
`js-cell-token--status-*` and `js-cell-token--frequency-*` on every word but
never `js-cell-token--i1-off`. The i+1 gate only exists on the imperative DOM
bind path (`markIPlus1Runs` → `applyRunMark`, `tokenSpanRenderer.ts:112-127`).
Result: every cue token renders its full status/frequency capsule — a "wall of
pills" the i+1 gate was built to prevent.

Secondary drift (same root): the React path also omits the
`data-cell-block-id` / `data-cell-sentence` attributes the marking machinery
keys on (`tokenSpanRenderer.ts:38,45`).

## Decisions (resolved — do not re-litigate)

1. **Per-cue scoping is PARITY, not a limitation.** The overlay binds each cue
   line as its own `TokenBlock` (`subtitleTokenizeController.ts:223-249`), so
   `markIPlus1Runs` already marks per cue line. Grouping the cue list's tokens
   per cue + per `sentenceIndex` reproduces the overlay exactly. Cross-cue
   sentence joining would make the list DISAGREE with the overlay and would
   require re-tokenizing concatenated text — rejected.
2. **`PreviewBlock.tsx` (card creator) is OUT OF SCOPE.** It stamps the same
   class set minus `i1-off` (`PreviewBlock.tsx:108-125`), but the preview is a
   mining surface, not a reading surface: the mined word must keep its
   capsule, and i+1 hiding would fight the `<strong>` target-phrase emphasis.
   It also stamps no `data-cell-block-id`, so `refreshIPlus1Marking` stays
   inert there (see hidden-writer note) — leave untouched. Mockups excluded.
3. **No `--status-off`/`--frequency-off` work.** The old Step 4 ships nothing:
   the subtitle tokenize store always runs `showStatus=showFrequency=true`
   (defaults `tokenizeStateStore.ts:44-45`; the only `setShowStatus`/
   `setShowFrequency` callers drive `webTokenizeCtrl` for page text —
   `featureInit.ts:77-79` — never `subtitleTokenizeCtrl`). The cue list's
   unconditional status/frequency classes already match. Follow-up logged
   below.
4. **Stamping the attrs arms a hidden writer — deliberately.** Today
   `refreshIPlus1Marking` is a no-op on cue-list spans (no `data-cell-block-id`
   → `readSegments` finds nothing). Once stamped, popup status writes
   (`applyTokenStatus` → `lookupTargetDom.ts:108-116`, called from
   `popupLifecycle.ts:325,447`) re-mark the cue's spans via the DOM rule. The
   container resolves to the cue's own text div: `closest(CONTAINER_SELECTOR)`
   finds no `p/li/...` ancestor inside the shadow panel (CueCard is all divs),
   so `span.parentElement` = `.targetText` holding exactly one cue's spans —
   same scope as the React rule. The two writers converge IFF (a) both share
   one marking rule and (b) separator `data-cell-sentence` follows the binder
   convention. The parity test below is LOAD-BEARING — it is the only guard
   against drift between React marks and DOM re-marks.
5. **Known remaining divergence — documented, out of scope:**
   `bindTokenBlock` renders `isSeparator` tokens (zh punctuation) as
   `--word` spans (`tokenSpanRenderer.ts:339-345` has no isSeparator skip), so
   `applyRunMark` counts them as scorable/new words on overlay/web DOM. The
   React path never renders them. The shared rule therefore takes its
   candidate set from the caller: the DOM path passes all rendered non-gap
   spans (behavior preserved); the token-array path passes only
   `isScorableToken` tokens. On cue-list DOM the two agree exactly (punct
   spans don't exist there). Fixing overlay punct counting is a separate
   behavior change — NOT in this plan.

## Design — one shared rule, two renderers

Two span factories must exist (React can't `replaceChild` host text nodes; the
DOM binder can't live inside a React tree). What converges is the *rule*:
which words keep color.

### Step 1 — NEW `src/features/tokenize/logic/iPlus1Marking.ts` (pure)

```ts
export const IPLUS1_OFF_CLASS = 'js-cell-token--i1-off';
export const IPLUS1_MIN_SCORABLE = 3;
const NUMERIC_RE = /^\p{N}+$/u;

export interface IPlus1Word { term: string; isNew: boolean; }

/** Candidates are caller-supplied (see decision 5). Returns the input index
 *  of the marked word, or null. Marked iff scorable>=3 && new==1. */
export function pickIPlus1Index(words: readonly IPlus1Word[]): number | null;

/** Indexes into the FULL `tokens` array (separators included in indexing).
 *  Groups word tokens by sentenceIndex; per group, candidates =
 *  `isScorableToken` (excludes isSeparator + numeric), "new" =
 *  `isNotKnown(token.status ?? 'unknown')`. One cue, one block. */
export function markedTokenIndexes(tokens: readonly Token[]): ReadonlySet<number>;
```

- Reuse `isScorableToken` (`comprehensionScore.ts:28-30`, exported via
  `@/features/tokenize`) and `isNotKnown` (`wordStatusSemantics.ts:23`,
  via `@/features/dictionary`). Do NOT add an `isNewStatus` helper — call
  `isNotKnown` inline. NUMERIC_RE already lives in `comprehensionScore.ts:7`;
  this module's copy REPLACES the renderer's (`tokenSpanRenderer.ts:100`) —
  net count stays two, no third copy.

### Step 2 — refactor `tokenSpanRenderer.ts` (no behavior change)

- Delete local `IPLUS1_OFF_CLASS` (L43), `NUMERIC_RE` (L100),
  `IPLUS1_MIN_SCORABLE` (L103); import `IPLUS1_OFF_CLASS` +
  `pickIPlus1Index` from the new module. No re-export needed — no external
  importer exists.
- `applyRunMark` (L112-127): keep collecting `words` = all
  non-`SEPARATOR_CLASS` spans in the run (punct token spans included —
  behavior preserved, decision 5). Build descriptors
  `{ term: span.getAttribute('data-cell-term') ?? '', isNew: isNewWordSpan(span) }`,
  call `pickIPlus1Index`, map the result index back to the span, then keep the
  existing `classList.toggle(IPLUS1_OFF_CLASS, span !== marked)` loop.
  `isNewWordSpan` (L105-110) stays — it is the DOM-class equivalent of
  `isNotKnown` and cannot be replaced without a class→status parse.

### Step 3 — wire `CueTokenText` (`CueList.tsx`)

- Add prop `blockId: string`; the only call site (L793-803) passes
  `blockId={`cue-${cue.index}`}`. `cue.index` is unique within a render
  (it is the React `key` at L756); it may repeat across reordering, which is
  harmless — each cue is its own scan container anyway.
- `const marked = markedTokenIndexes(tokens)` once per render, before the
  token loop. Tokens already carry `sentenceIndex` (consumed today by
  `sentenceContextForIndex` at L205). O(tokens) — fine.
- Word spans: add `IPLUS1_OFF_CLASS` to the className when the token's index
  in the full `tokens` array is not in `marked`; stamp
  `data-cell-sentence={token.sentenceIndex}` and `data-cell-block-id={blockId}`.
- Gap/separator spans (leading/mid/tail): stamp `data-cell-block-id` and
  `data-cell-sentence` replicating the binder convention
  (`tokenSpanRenderer.ts:329-351`): a gap inherits the PRECEDING token's
  `sentenceIndex`; the leading gap gets
  `max(0, first.sentenceIndex - (hasSentenceEnd(text.slice(0, first.start)) ? 1 : 0))`;
  the tail gap gets the last token's `sentenceIndex`. Track `lastSentence`
  across the loop exactly as the binder does. Import `hasSentenceEnd` from
  `@/shared/lib/sentencePunct`. (The attr does not affect `markIPlus1Runs` —
  it skips separators — but it keeps `readSegments`/`collectSentenceRun`
  honest and matches the wash contract.)
- `isSeparator` tokens stay unrendered (current `continue` at L168) — that is
  what makes cue-list DOM scans agree with `markedTokenIndexes`.
- Marks are computed every render including while `resolving` — harmless
  (`--resolving` already suppresses visuals) and matches the DOM path.

## Files

- NEW `src/features/tokenize/logic/iPlus1Marking.ts`
- NEW `src/features/tokenize/logic/iPlus1Marking.test.ts` (colocated convention)
- `src/features/tokenize/ui/tokenSpanRenderer.ts` — shared rule, no behavior change
- `src/features/subtitle/ui/CueList.tsx` — `CueTokenText` marking + attrs + `blockId` prop; call site L793
- `src/features/subtitle/ui/CueList.test.tsx` — extend existing tokenize render tests

## Tests

- `pickIPlus1Index`: 0 new / 1 new / ≥2 new / <3 scorable / numeric terms
  excluded from scorable count / `isNew` only counted on scorable entries.
- `markedTokenIndexes`: multi-sentence token array marks per sentence
  (per-sentence isolation); indexes returned are into the full array;
  `status === undefined` and `'tracking'` count as new (verify via
  `isNotKnown` semantics); a numeric token gets `i1-off` but is not scorable.
- **Parity test (load-bearing):** for identical fixtures, build the DOM the
  way `CueTokenText` renders it (word spans only for non-separator tokens,
  gap spans, `data-cell-block-id`/`data-cell-sentence`/`data-cell-term`/
  status classes stamped), run `markIPlus1Runs` on the container, and assert
  the DOM-marked set equals `markedTokenIndexes(tokens)`. Include a
  status-change fixture (flip one word known→unknown) simulating the
  `applyTokenStatus` async re-mark path — the two writers must agree after
  the flip too.
- `CueTokenText` render (jsdom, in `CueList.test.tsx`): cue with 1 unknown →
  only that token lacks `i1-off`; cue with 2 unknowns → all `i1-off`;
  known-heavy cue → all `i1-off`; gap spans carry
  `data-cell-sentence`/`data-cell-block-id`.
- Existing `tokenSpanRenderer.test.ts` unchanged — must pass as-is
  (behavior preserved).

## Gates

`npm run typecheck && npm run test:unit && npm run build`.
Live verify: kisskh player-mode cue list before/after screenshot (expect
near-plain text, single pill where a cue is truly i+1) AND overlay regression
on the same video (i+1 still marks one word per sentence — `bindTokenBlock`
path unchanged). Subtitle split-view change → re-verify AC at
`docs/specs/subtitle-split-view-ac.md`.

## Out of scope / follow-ups

- Cross-cue sentence runs — parity by decision 1.
- Merging the two span factories — physically impossible, by design.
- Overlay/web punct-token counting (decision 5) — separate behavior change.
- `PreviewBlock.tsx` — decision 2.
- If `showStatus`/`showFrequency` ever become settable for subtitle tokenize:
  thread through `SubtitleCueEngineTokenizeOptions` (subtitleCueEngine.ts:48)
  → `CueListTokenize` (CueList.tsx:97) → `CueTokenText`, mirroring the
  `showReadings`/`showGlosses` hops at `reactSubtitleController.ts:806-815`.
- Pre-existing, newly more visible: `js-cell-token--popup-open` is a DOM-set
  class on React-managed spans (`lookupTargetDom.ts:96`) — any React
  re-render wipes it (status underline vanishes mid-lookup). With `i1-off`,
  more tokens rely on `:hover`/`.popup-open` to reveal status. Log a
  follow-up; do not fix here.
- Optional while both files are open: extract a shared `tokenClassesFor`
  builder to close residual class-list drift between `CueTokenText` and
  `applyTokenClasses` — cheap, but only if it stays a pure function.
