# Spec: Primer tab (Words) UI/UX redesign

> Intent: `docs/intent/primer-tab-redesign.md` · ui_surface: yes · Mode: interactive
> Status: **dropped (2026-09-19)** — user pivoted to removing the Words tab entirely; the FAB already covers the learner-facing design language. Only REQ-5/REQ-6 shipped (`6eda69e6`, `2f2a4e8f`); the redesign below is historical reference.

## Objective

Rebuild the Words (primer) tab's visual layer so each row reads as a learner-facing entry — a circular play affordance on the left, the word on top, and a readable meta sub-line below carrying status + frequency rank + repetition count — instead of developer internals (green rank chip, bare `×N`, dark token text). Header stats collapse into one compact line. Data (`PrimerRow[]`), sort order, and both actions (lookup, seek) are unchanged — this is presentation only.

**Scope addendum (design-gate, user-directed — screenshots `quetta_MvXSdCKCJh.png`, `chrome_9NdxoO4ZBw.png`):** two panel-chrome behaviors on the same surface — REQ-5 hides the tab strip when only one tab exists; REQ-6 lets the cue list desync from playback-follow on manual scroll, with a "Sync to video" pill to re-engage.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | Opens Words tab; taps play; taps word area | Tap target (play vs word), no other input | Compact header summary; row list (term + meta sub-line); seek to first cue; dictionary popup |

System renders the list from an existing `PrimerRow[]` prop; no new data enters or leaves the component.

## Requirements

### Functional

REQ-1: Render compact word rows with play-left anatomy
- Actor: Learner
- Goal: Scan words and understand each row at a glance
- Preconditions: Panel open, Words tab active, `rows` non-empty
- Basic flow:
  1. system renders each row as `play button | (term / meta sub-line)`
  2. system shows term as primary readable text (`--color-text` family, ellipsis on overflow)
  3. system shows meta sub-line under the term containing status word + frequency rank + repeat count as readable text; meta stays one line and ellipsizes at ≥280px
- Alt flow: `rows` empty → EmptyState (unchanged)
- Exception: `rank === null` → meta omits the `freq #N` part only (rank and `band` are independent fields; `band`'s visual role is a DESIGN-stage decision, not silently dropped)
- Rules: no green rank chip, no bare `×N` orphan, no token underline color on the term; whole row remains the lookup hit-target except the play button. The term element keeps `js-Tihoka-token` + `js-Tihoka-token--status-*` classes as lookup/status hooks — their visuals are neutralized by `!important` overrides scoped under the module class only (the shared base rule in `tokenSpanCss.ts` is all-`!important`); `applyTokenStatus` may transiently re-add a status class between renders — accepted, never edit `tokenSpanCss.ts`
- Postcondition: every row exposes term, meta, play affordance
- NFR refs: NFR-1, NFR-2, NFR-3, NFR-4

REQ-2: Grouped single-line header
- Actor: Learner
- Goal: Read the list summary without wrapping fragments
- Preconditions: `rows` non-empty
- Basic flow:
  1. system renders one compact summary line (count + optional unknown/tracking breakdown in one element)
- Alt flow: breakdown only when both statuses present (unchanged rule)
- Exception: narrow widths → single line truncates/ellipsizes, never splits into two blocks
- Rules: fewer text runs than current (2 spans → 1) via a new joined i18n key (e.g. `primer.header` with placeholders) — no hardcoded `·` separators; status word reuses existing `vocabulary.status.*` keys
- Postcondition: header occupies one line at ≥280px width
- NFR refs: NFR-1, NFR-4

REQ-3: Seek via circular play button
- Actor: Learner
- Goal: Jump to the cue where the word first appears
- Preconditions: row visible
- Basic flow:
  1. actor taps the circular play button (left of the word info)
  2. system calls `onSeek(row.firstCueStartMs)` without triggering lookup
- Alt flow: none
- Exception: none — button always enabled
- Rules: icon is `Icon name="navPlay"` (circle-play); button stops click propagation AND keyboard events originating inside it must not reach the row's `onKeyDown` lookup handler (guard via `stopPropagation` on keydown or `event.target === event.currentTarget` in the row handler — today's `handleRowKeyDown` bubbles Enter/Space from the inner button into lookup); `aria-label` keeps `primer.seek` text
- Postcondition: video seeks; row state unchanged
- NFR refs: NFR-3

REQ-4: Lookup via word area
- Actor: Learner
- Goal: Open the dictionary popup for the word
- Preconditions: row visible
- Basic flow:
  1. actor taps the word area (term + meta block, or row outside the play button)
  2. system calls `onTokenClick(term, termEl, contextText)` — term element still carries the full attribute contract the lookup pipeline queries: `js-Tihoka-token`, `data-tihoka-term`, `data-tihoka-start` on the term; `data-cue-start`, `data-cue-end` on the row (feeds `lookupCueRange`/`isLookupFromSubtitle` — asserted by `PrimerTab.test.tsx`)
- Alt flow: keyboard Enter/Space on the row (unchanged)
- Exception: `termEl === null` → no-op (existing guard); `VisuallyHidden` status span may be dropped since the meta line now voices the status — meta text must convey the same info to screen readers (no `aria-label` needed on top of readable text)
- Rules: status (unknown vs tracking) still distinguishable — via the status word in the meta sub-line
- Postcondition: dictionary popup opens anchored to the term element
- NFR refs: NFR-3

REQ-5: Tab strip renders only when ≥2 tabs exist
- Actor: Learner
- Goal: Reclaim the tab strip's vertical space when there is nothing to switch to
- Preconditions: panel open
- Basic flow:
  1. system counts renderable tabs = 1 (Subtitles, always present) + Playlist (when `playlistContent` provided) + Words (when `primerAvailable && primerRows !== null`)
  2. count ≤ 1 → system renders the cue list directly (existing non-tabs path); no `role="tablist"` in DOM
  3. count ≥ 2 → system renders the tab strip as today
- Alt flow: count grows 1→2 after mount (primer resolution completes) → tab strip appears without user action; one-time layout shift accepted
- Exception: `activeTab` naming a tab that became unavailable → existing reset effects keep content on Subtitles
- Rules: presentational only — no prop/state contract changes; `subtitle-panel-tab-*` hooks exist only while the strip renders
- Postcondition: single-tab sessions gain the strip's height for cue content
- NFR refs: NFR-1

REQ-6: Cue list manual scroll desyncs from playback-follow; "Sync to video" pill re-engages
- Actor: Learner
- Goal: Scroll the cue list freely to find a cue without the list snapping back to the playing cue
- Preconditions: cue list rendered non-empty, follow mode on (default)
- Basic flow:
  1. actor scrolls `cue-list-scroll` (wheel, touch, scrollbar drag) while follow is on
  2. system stops auto-scroll-follow; the current-cue highlight keeps advancing with playback — only scrolling stops
  3. system shows a floating "Sync to video" pill anchored bottom-center of the list viewport
  4. actor taps the pill → system center-aligns the current cue (existing align path) and resumes follow; pill hides
- Alt flow: actor taps a cue timestamp (seek) while desynced → seek + resume follow (the found cue becomes the new playback position)
- Exception: no current cue (`currentIndex < 0`) → pill click re-engages follow only; next cue match re-aligns
- Rules:
  - programmatic aligns never count as user scroll — track expected scrollTop after each align; a scroll event diverging >2px from expected is user-initiated (catches scrollbar drags, which produce no wheel/touch events)
  - `filterEpoch` change resets to following (extends the existing scrollTop=0 reset)
  - external scrollTop restore (`scrollPositionPreserve.ts`) registers as desynced state — the restored position now sticks instead of being stomped by the next align
  - pill = real button (`data-tihoka-id="cue-list-sync"`), anchored bottom-center above the scroller (sibling of `cue-list-scroll` inside a new `position:relative` wrapper — it must not scroll with content), `z-overlay-base` ordering so the blur overlay still covers it
  - while the pill shows, the list gets bottom padding so the last cue is not obscured
  - `data-tihoka-id="cue-list-scroll"` remains on the scroll element — e2e/test selectors unchanged
- Postcondition: scroll position stays where the actor left it until explicit resync
- NFR refs: NFR-1, NFR-3, NFR-6

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Layout holds at panel widths ≥280px — no wrapped fragments, no overflow | U | mobile + desktop screenshots |
| NFR-2 | Term/meta contrast readable on dark panel; colors from `--color-text`/`--color-text-secondary` tokens only | U | visual check |
| NFR-3 | i18n: all new meta strings keyed through `t()` in en + vi — expected new keys e.g. `primer.header`, `primer.meta`, `primer.freqRank`, `primer.repeatCount`; status word reuses `vocabulary.status.*`; aria-labels preserved | U | both locales compile |
| NFR-4 | Row block size reduced vs current — padding steps down ≥1 token level (e.g. `--space-1-5` → `--space-1`); the play button hit area still honors `--touch-target` floor; only tokens, no hardcoded px for spacing | U | visual check / computed styles |
| NFR-5 | `data-tihoka-id` hooks preserved: `primer-tab`, `primer-header`, `primer-list`, `primer-row`, `primer-seek`; plus attribute contract — `data-tihoka-term`, `data-tihoka-start` on term, `data-cue-start`, `data-cue-end` on row | S | e2e/test selectors pass |
| NFR-6 | Desync detection is O(1) per scroll event (scrollTop comparison only — no cue scans, no layout reads beyond scrollTop); sync pill is keyboard-reachable with i18n label in en + vi | S | unit test + visual check |

## Flows / States

Words tab: no state machine — static render of a prop list. Interaction: tap play → seek (REQ-3); tap word area → lookup (REQ-4). The two paths are disjoint on both pointer (click `stopPropagation`) and keyboard (events inside the play button never reach the row's keydown lookup handler).

Cue list follow state (REQ-6) — two states:

```
FOLLOWING ──user scroll (scrollTop ≠ expected)──▶ DESYNCED (+pill)
DESYNCED  ──pill click / cue-timestamp seek─────▶ FOLLOWING (re-align)
DESYNCED  ──filterEpoch change──────────────────▶ FOLLOWING (scrollTop=0 reset)
```

While DESYNCED the current-cue highlight (`data-current`) still advances — only scroll-follow pauses.

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Preview unfamiliar words before/during watching | Primer list (existing `buildPrimerList` data), compact row component (play + term + meta) |
| Explain why a word is listed | Meta sub-line (status · freq rank · repeat count as text) |
| Jump to the word's first spoken occurrence | Circular play button → `onSeek` |
| Look the word up | Row word area → `onTokenClick` |
| Summarize the list | Single-line count header |
| Keep panel chrome proportional to choice | Conditional tab strip (rendered iff ≥2 tabs) |
| Browse cues away from playback position | Scroll-desync + "Sync to video" pill |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `PrimerRow` | term, status, count, rank, band, contextText, firstCueStartMs/EndMs, firstTokenOffset | prop from `SubtitlePanel` (built by `buildPrimerList`) | session render only |

No storage changes; `PrimerRow` shape unchanged.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 readable meta | REQ-1 | SC-2, SC-3 |
| N2 sub-line under word | REQ-1 | SC-1, SC-2 |
| N3 circular play left | REQ-3 | SC-1, SC-6 |
| N4 grouped header | REQ-2 | SC-4 |
| N5 readable term color | REQ-1 | SC-5 |
| N6 tighter spacing | NFR-4 | SC-7 |
| N7 actions preserved | REQ-3, REQ-4 | SC-6, SC-8, SC-9, SC-10 |
| N8 hide single-tab strip (addendum) | REQ-5 | SC-11 |
| N9 scroll cue list off-sync (addendum) | REQ-6 | SC-12, SC-13 |

| Journey step | REQ |
|---|---|
| TO-BE 1 header line | REQ-2 |
| TO-BE 2 row anatomy | REQ-1 |
| TO-BE 3 play/lookup | REQ-3, REQ-4 |
| TO-BE 4 compact | REQ-1, NFR-1, NFR-4 |
| TO-BE 5 chrome proportional to tabs | REQ-5 |
| TO-BE 6 scroll-desync + resync pill | REQ-6 |

## Boundaries

- Always: shared/ui atoms + tokens; `t()` for all strings; keep the full attribute contract — `js-Tihoka-token` (+`js-Tihoka-token--status-*`) on the term, `data-tihoka-term`, `data-tihoka-start`, and `data-cue-start`/`data-cue-end` on the row; visual overrides scoped under the module class with `!important` (the shared token base rule is all-`!important`)
- Ask first: changing `PrimerRow`/`buildPrimerList`; touching `tokenSpanCss.ts` or cue-list token CSS
- Never: hardcoded hex/px spacing; editing generated `tokens.css`; dropping `data-tihoka-id` hooks or the cue-range attributes

## Success Criteria

- [ ] SC-1: Row DOM = circular play button (left) + info block (term on top, meta sub-line below)
- [ ] SC-2: Meta sub-line renders status word + `freq #<rank>` (when `rank !== null`) + repeat count as readable i18n text; no standalone chip or bare `×N`; meta is one line, ellipsizes at ≥280px
- [ ] SC-3: `rank === null` rows omit only the `freq #N` segment; `band`'s visual role is decided at DESIGN (not silently dropped)
- [ ] SC-4: Header is a single text run from a joined i18n key; stays one line at 280–360px widths
- [ ] SC-5: Term reads with `--color-text`-family foreground via module-scoped `!important` overrides; `tokenSpanCss.ts` untouched; transient status-class re-add by `applyTokenStatus` accepted
- [ ] SC-6: Play button uses `Icon name="navPlay"`, `shape="circle"`, hit area ≥ `--touch-target`; tap seeks without lookup; Enter/Space pressed while the button is focused does NOT fire lookup
- [ ] SC-7: Row vertical padding drops ≥1 token step vs current (e.g. `--space-1-5` → `--space-1`); more rows visible per 600px viewport; spacing from tokens only
- [ ] SC-8: Word area opens dictionary lookup; all NFR-5 hooks (`primer-tab/header/list/row/seek` + `data-tihoka-term`, `data-tihoka-start`, `data-cue-start`, `data-cue-end`) intact; Enter/Space on the row still opens lookup
- [ ] SC-9: en + vi strings for all new meta text (`primer.header`, `primer.meta`/parts); no hardcoded `·` separators
- [ ] SC-10: Unknown vs tracking distinguishable via the meta status word (`vocabulary.status.*` keys)
- [ ] SC-11: With only the Subtitles tab renderable (no `playlistContent`, primer unavailable or `primerRows === null`), no `role="tablist"`/`subtitle-panel-tab-*` exists in the DOM and the cue list fills the space; when a second tab becomes renderable, the strip appears
- [ ] SC-12: A user-initiated scroll of `cue-list-scroll` pauses auto-follow (highlight still advances via `data-current`) and shows the `cue-list-sync` pill; activating it center-aligns the current cue and resumes follow
- [ ] SC-13: While desynced, a cue-timestamp seek resumes follow; a `filterEpoch` change resets to following

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] `PrimerTab.test.tsx` updated for the new anatomy; decide `FrequencyBadge` fate (sole consumer is PrimerTab — remove usage or keep for reuse); delete dead CSS (`.band`, `.bandDot_*`, `.occurrences`)
- [ ] `SubtitlePanel.test.tsx` covers the <2-tabs case; `CueList.test.tsx` covers desync → pill → resync and seek-resyncs-follow
- [ ] UI passes design-system check (tokens, shared components)
- [ ] Real-browser screenshots at narrow + desktop widths (view states)
- [ ] `docs/2-architechture-system.md` updated if component description changes

## Open Questions / Accepted Risks

- Meta visual treatment is decided at DESIGN: user picks among 3 mockup variants (plain text / CSS-visual / creative). REQ-1 only fixes the *content* (status + rank + count as readable info), not the styling.
- Rejected/deferred alternatives (direction is user-locked): (a) restyle `FrequencyBadge` instead of removing it — rejected, chip was the unreadable part; (b) keep the colored band dot as the sole frequency signal — deferred to DESIGN, `band` still available; (c) keep the underline-token look — rejected, it was the "đen xì" complaint.
- `computeLineRect` uses `target.parentElement` (`lookupTargetDom.ts:26`) — the new info-block wrapper shrinks the popup-avoidance band slightly; judged harmless, verify visually at ship.
- Nested-interactive row (`role="button"` wrapping a real `<button>`) is preserved as-is — known a11y debt, not worsened.
- Transient status-class re-add by `applyTokenStatus` between renders may flash old styling — accepted; verify in screenshots.
- REQ-5 one-time layout shift when the Words tab appears post-resolution (~1–2s in) — accepted; the strip appearing *is* the affordance that a second tab now exists.
- REQ-6 edge cases: a clamp/shrink scroll event (content resizing) can read as a user scroll and desync — rare and recoverable via the pill; accepted over heavier input-source detection. Desync is per-mount state — not persisted (follow is the expected default on reopen).
