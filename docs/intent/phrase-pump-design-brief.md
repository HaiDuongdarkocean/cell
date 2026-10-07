# Design Brief — phrase-pump (all mode)

> Spec: `docs/specs/phrase-pump.md` · Intent: `docs/intent/phrase-pump.md`
> Single justified variant (all mode). The pump is a radio, not a dashboard: one stage, one sentence, transport controls sized for a thumb that isn't looking.

## Design Read

The surface has two moments: **setup** (pick sources and loop knobs — five seconds of decision) and **playing** (long-lived, hands-free, glanced at occasionally). The design gives playing all the visual mass — a single stage pane with the sentence large — and keeps setup a compact card that dims once a session is live. Everything sits inside the existing `srs-study` page frame; the only panel-side artifact is a launcher row in `PlaylistTab` that opens this view.

## Function audit

| Function (spec REQ) | Features | Element affected |
|---|---|---|
| build session (REQ-1) | deck-scope select, mined-queue toggle | setup card controls |
| resolve audio (REQ-2) | invisible — resolved per item, no chrome | skip counter surfaces outcome |
| playback controls (REQ-3) | play/pause, skip prev/next, stop; repeat/gap/shuffle knobs | transport row + setup card |
| now playing (REQ-4) | sentence stage, term chip, i/n, source chip, skipped count, reveal toggle | stage pane |
| entry points (REQ-5) | `SrsHome` pump action; `PlaylistTab` launcher row; `view=pump` deep link | home chrome + one ListItem + App view state |
| empty/end states (REQ-6) | empty state, played/skipped summary + restart | stage pane swap |
| writes-free (REQ-7) | invisible | — |
| i18n + a11y (REQ-8) | labels/aria everywhere | — |

## Journey map

TO-BE 1 (press play) → setup card is the entry state: defaults sane (all decks, queue on, 1× repeat, 1s gap, no shuffle) so play is one tap. TO-BE 2 (hands-free) → stage pane: sentence large, term chip, position. TO-BE 3 (glance) → chips + i/n + skipped; reveal toggle for pure listening. TO-BE 4 (ends) → summary card with played/skipped + restart.

## Dials

DESIGN_VARIANCE 2 (page view reuses srs-study frame conventions; stage is one new composition) · MOTION_INTENSITY 1 (item transitions only — sentence swap is a plain replace; no new animation system) · VISUAL_DENSITY 4 (one thing on stage at a time).

## Inspiration anchor

A **cassette player + lyric sheet** — the transport cluster is the familiar five-button deck (prev / play-pause / next / stop), and the stage is the lyric card you glance at. Non-digital reference: a car radio's single-line display — one sentence, one position readout, no menu depth.

## Primary job

Let the learner answer "what am I hearing, and where am I in the loop?" with a half-second glance — then get out of the way.

## Chosen variant — "Listening Deck"

- **IA mental model:** setup → stage → summary, one axis. No tabs, no list of upcoming items v1 (the list would invite fiddling; the point is to stop looking).
- **Visual archetype:** srs-study page frame (same `styles.page`/`styles.card` chrome as streaks/vocabulary views) containing a setup card and a stage card; transport row inside the stage.
- **Non-digital reference:** car radio single-line display + cassette transport.
- **Material / surface:** `color-surface-popover`-family cards per srs-study convention; stage sentence on `color-surface`; source chip via `component.chip-status.*` recipe (due=primary-subtle, queue=field).
- **Typography:** sentence `static.font.sizes.xl`-class line with generous leading (glanceable at arm's length), term chip `md`, meta `xs` secondary.
- **Motion:** none new — sentence replace on item advance; focus rings; no autoplay surprise (play is always user-initiated).
- **UX flow:** home action or panel launcher → pump view setup → `Start` → stage (item i/n, sentence, term) → controls: prev, pause/play, next, stop; knobs live in setup, also reachable by stopping → summary at end.
- **UI structure:** view = header (back + title) + setup card (deck `Select`, queue `Toggle`, repeat/gap `SegmentedControl`, shuffle `Toggle`, start `Button`) + stage card (meta row: source chip + i/n + skipped + reveal `IconButton`; sentence `Text`; term `Chip`; transport `IconButton` row).
- **Why it fits:** zero new chrome layers — a `view` sibling of streaks/vocabulary in `App.tsx`; every atom ships already; the only new composition is the stage card.
- **Risk:** stage sentence length varies (clamped multi-line, not scrolling); TTS pause semantics = item-restart — surfaced as a small hint under transport when a TTS item is paused.
- **Audit findings:** N1–N8 all mapped; panel scope = one launcher row only (spec REQ-5).

### ASCII sketch — pump view (srs-study page, max content width ~720px)

```
┌──────────────────────────────────────────────────────────┐
│ ←  Phrase pump                                           │
│ ┌─ setup ──────────────────────────────────────────────┐ │
│ │ Deck    [ All decks                          ▾ ]     │ │
│ │ Include mined queue                    [toggle on]   │ │
│ │ Repeat  [ 1× | 2× | 3× ]   Gap  [ off |1s|2s|4s ]    │ │
│ │ Shuffle                                [toggle off]  │ │
│ │ [ ▶  Start listening — 24 items ]                    │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ stage ──────────────────────────────────────────────┐ │
│ │ [due]                          3 / 24   skipped 1  👁 │ │
│ │                                                      │ │
│ │        それは 事実 で ある 。                            │ │
│ │        [ である ]                                     │ │
│ │                                                      │ │
│ │            (◄◄)      ( ❚❚ )      (►►)      ( ■ )      │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### ASCII sketch — summary + launcher

```
end:    ┌─ Done — played 22 · skipped 2 ─ [↺ again] [change sources] ─┐
panel:  Playlist tab →  [𝄞 Phrase pump — listen to due cards ▸]  (pinned row above records)
```

## Component mapping

`docs/intent/phrase-pump-component-mapping.md`.
