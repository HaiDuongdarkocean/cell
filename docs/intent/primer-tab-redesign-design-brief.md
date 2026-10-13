# Design brief — primer-tab-redesign

- **Slug:** primer-tab-redesign
- **Stage:** design
- **Spec:** docs/specs/primer-tab-redesign.md
- **Mockup:** src/entrypoints/mockup-primer-tab-redesign/index.html (dev server)
- **Status:** REQ-5 + REQ-6 approved by Anh → this item delivers those two only.
  REQ-1..4 + meta variant A/B/C are owned by another agent's in-flight work — out of scope
  here; do not touch `PrimerTab.*`/`FrequencyBadge`.

## Problem being solved

The Words tab speaks "developer language": a green chip containing a raw frequency rank
(users can't tell what the number means), a bare `×N` with no label, low-contrast term on
the dark panel, header stats split into two clusters that wrap badly at narrow widths, and
a square-ish play button on the right that doesn't match the system's circular icon language.

## Locked row anatomy (from spec REQ-1, user-confirmed)

```
[ ○ circular play ]  word
                     status · freq #rank · ×count
```

- Play button: `Button` variant=transparent shape=circle + `Icon name="navPlay"`, left column, ≥ `touchTarget-desktop` floor.
- Term: primary text (`sizes-sm`, `weights-semibold`, `color-text-primary`), ellipsis.
- Meta: one line under the term (`sizes-xs`, `color-text-tertiary`), ellipsis at ≥280px, segments joined by `·`.
- Header: single compact line — `N new words · X unknown · Y learning` (joined i18n key).
- Spacing: tightened by ≥1 token step vs current (`spacing-3` padding → `spacing-1` row padding; `spacing-4` gap → `spacing-1`).

## The three divergent meta treatments

All variants share the locked anatomy; they differ **only** in how the meta line carries
status + frequency rank + repeat count.

### Concept A — Plain text

`new · freq #2 · ×53` — one muted text run, zero decoration.

- Everything reads as words; nothing to decode.
- Cheapest to implement and translate (one joined i18n string).
- Trade-off: no scannability affordances — status, rank, count all look identical weight.

### Concept B — CSS-visual

Status word tinted by status color (`color-token-status-unknown` / `color-token-status-tracking`),
rank as a small bordered `#tag`, repeat count paired with the `repeat` icon.

- Information type is carried by affordance: color = status, tag = rank, icon = repetition.
- Still one compact line; icons/tags are token-driven so light/dark both work.
- Trade-off: slightly busier line; needs a `repeat` icon import (already in catalog).

### Concept C — Signal meter

Status word tinted (as B), rank shown as a mini frequency meter — 5-segment bar whose fill
maps from the `band` tier (core=5 … rare=1) — plus the raw `#rank`, repeat count plain `×N`.

- Turns rank into an intuitive signal (more bars = more common word) while keeping the number.
- Most distinctive; gives `band` a visual role per spec ("band's visual role decided at Design").
- Trade-off: the meter is decoration on top of the number — more elements to lay out, and
  users still need the number to know the actual rank.

## Panel-chrome additions (REQ-5, REQ-6 — user-directed at design gate)

Demoed in the mockup's "Panel chrome" stage (mock shell + real `CueList` internals).

### REQ-5 — Tab strip only when ≥2 tabs

The strip (`Tabs.List` + triggers) renders **iff** more than one tab can render:
`1 (Subtitles) + Playlist? + Words?` where Words counts only when
`primerAvailable && primerRows !== null`. One renderable tab → the cue list mounts
directly (existing no-tabs path), saving the strip's full height.

- Covers the permanent-single-tab case (no playlist + primer unavailable: zh-suppressed,
  practice mode, blurred panel) and the transient case (primer resolving ~1–2s).
- When Words resolves, the strip appears — the one-time shift doubles as the "a new tab
  exists" signal. Accepted in spec.
- `activeTab` semantics unchanged; reset effects still force Subtitles when a tab
  disappears.

### REQ-6 — Scroll-desync + "Sync to video" pill

Today every cue change re-centers the list — the user can never browse away from the
playing cue. New follow state machine (spec §Flows):

```
FOLLOWING ──user scroll (scrollTop ≠ expected)──▶ DESYNCED (+pill)
DESYNCED  ──pill click / cue-timestamp seek / filterEpoch change──▶ FOLLOWING
```

- **Detection:** after each programmatic align the list's `scrollTop` is recorded as
  `expected`; a scroll event landing >2px off `expected` is user-initiated (wheel,
  touch, scrollbar drag — drags emit no input events, so position-divergence is the
  robust signal). O(1) per event, no layout reads beyond `scrollTop`.
- **While desynced:** `data-current` highlight keeps advancing; only scroll-follow
  pauses. The pill floats bottom-center above the scroller (sibling, not inside it).
- **Resync paths:** pill click → re-align + follow; cue-timestamp seek → follow (the
  user found their cue — track from it); `filterEpoch` change → follow + scrollTop=0.
- **Side benefit:** `scrollPositionPreserve` restores now register as desync instead of
  being stomped by the next align — restored positions finally stick.
- **Pill:** `Button` `variant="overlay"` `shape="pill"` `size="sm"` `elevation="med"`,
  `leadingIcon` = `Icon name="crosshair"`, label `t('cueList.syncToVideo')`
  (en "Sync to video" / vi "Đồng bộ với video"), `data-tihoka-id="cue-list-sync"`,
  z `static.zIndex.overlay-base` (under the blur overlay), list gains bottom padding while shown.

## Verified states

Mockup screenshots (tmp/primer-mockup-shots/): all three variants at mobile (~340px) and
desktop (~520px) widths, light + dark themes, plus the real tab baseline. Meta line stays on
one line at 340px for all variants; the longest mock term
(`benevolent-dictatorship-for-life`) ellipsizes correctly.

## Data mapping (unchanged)

| Meta segment | Source | Fallback |
|---|---|---|
| status word | `row.status` → `vocabulary.status.unknown`/`tracking` (shared keys) | — |
| `freq #N` | `row.rank` | omitted when `rank === null` |
| `×N` | `row.count` | — |
| meter fill (C only) | `row.band` | `none` → 0 segments |

## Accessibility

- Meta line carries status as literal text (screen-reader parity with tinted tokens).
- Play button has `aria-label` (`Play <term>`); row remains a `role="button"` with
  Enter/Space → lookup, play click/Enter/Space → seek only (disjoint paths per spec).
- Meta meter (C) is `aria-hidden`; the `#rank` text remains accessible.

## Preserved contracts

All `data-tihoka-id` attributes (`primer-tab`, `primer-header`, `primer-list`, `primer-row`,
`primer-seek`), token hooks (`js-Tihoka-token` + its `status-*` modifiers, `data-tihoka-term`,
`data-tihoka-start`) and cue-range attributes (`data-cue-start`, `data-cue-end`) unchanged.
`data-tihoka-id="cue-list-scroll"` stays on the scroller; new hooks: `cue-list-sync` (pill).
`subtitle-panel-tab-*` hooks exist only while the strip renders (REQ-5).

## Decision record

- **REQ-5 + REQ-6:** approved by Anh (2026-09-19) — implement as designed.
- **REQ-1..4 + meta variant A/B/C:** owned by another agent's in-flight work in the main
  tree; the A/B/C pick is theirs to finalize. This item must not edit
  `PrimerTab.tsx`, `PrimerTab.module.css`, or `FrequencyBadge`.
- Deliver scope: `SubtitlePanel.tsx` (REQ-5), `CueList.tsx` + `CueList.module.css`
  (REQ-6), `cueList.syncToVideo` i18n, `crosshair` icon, unit tests.
- Worktree flow per Anh: implement on a branch in a separate worktree, merge back to
  main, delete branch + worktree.
