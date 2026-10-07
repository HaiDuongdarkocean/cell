# Component Mapping — phrase-pump

> Deconstruction of the "Listening Deck" variant (`docs/intent/phrase-pump-design-brief.md`). Every element traces to a spec REQ; the stage card is the only new composition — all atoms exist.

| Element (site) | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Pump view host (srs-study `App` view `pump`) | Box | reuse — same page/card chrome as `SrsStreaksView`/`SrsVocabularyView` (`App.tsx` view union gains `'pump'`) | `color-surface`, `radius-md` | — |
| View header (back + title) | Button + Heading | reuse — `onBack` pattern identical to streaks/vocab views | `static.font.sizes.lg`, `color-text` | Icon: `chevronLeft` |
| Setup card (REQ-1) | Box (card class) | reuse — `.card` convention from srs-study views | `color-surface-popover`, `color-border`, `radius-md` | — |
| Deck scope picker | Select | reuse — all-decks / per-deck options fed by `getAllCollections`+`getDecksByCollection` | `color-field`, `radius-md` | — |
| Queue include toggle | Toggle | reuse | `color-primary`, `component.toggle.*` | — |
| Repeat selector (1×/2×/3×) | SegmentedControl (`raised`) | reuse — `raised` variant keeps `min-height` at the touch floor (chips variant sits below it) | `component.segmented.*`, `radius-pill`, `static.touchTarget.mobile` | — |
| Gap selector (off/1s/2s/4s) | SegmentedControl (`raised`) | reuse — same touch-floor reason | `component.segmented.*`, `radius-pill`, `static.touchTarget.mobile` | — |
| Shuffle toggle | Toggle | reuse — text-labeled (catalog has no shuffle icon; label is persona-clearer anyway) | `component.toggle.*` | — |
| Start button (with item count) | Button (`primary`) | reuse | `component.button.primary.*`, `radius-md` | Icon: `navPlay` |
| Stage card (REQ-4) | css (feature module) | create — stage composition (meta row + sentence + term + transport) is new; NOT a new atom — composes shared atoms feature-scoped | `color-surface-popover`, `color-border`, `radius-md` | — |
| Source chip (due / queue) | Chip | reuse — `component.chip-status.*` recipe family (due=primary-subtle, queue=field) | `color-primary-subtle`, `color-field`, `radius-pill` | — |
| Position `i / n` + skipped counter | Text | reuse | `color-text-secondary`, `static.font.sizes.xs` | — |
| Reveal toggle | IconButton (`ghost`) | reuse — state-icon semantics (`eye` = text visible), aria-label names the action | `color-surface-hover`, `static.touchTarget.mobile` | Icon: `eye` / `eyeOff` |
| Sentence stage text | Text | reuse — `xl`-class size, multi-line wrap, centered; hidden state renders a masked placeholder line | `static.font.sizes.xl`, `color-text` | — |
| Term chip | Chip | reuse | `color-field`, `radius-pill` | — |
| Transport: prev / play-pause / next / stop | IconButton | reuse — `navPlay`/`navPause` circle-transport precedent; center `solid`+`lg` (primary fill = visual hierarchy), flanks `ghost` `lg` (48px ≥ coarse floor) | `component.iconButton.*`, `static.touchTarget.mobile` | Icon: `navPrev` · `navPlay`/`navPause` · `navNext` · `recStop` |
| Pause-semantics hint (TTS item paused) | Text | reuse — one-line hint under transport when pause = item-restart | `color-text-secondary`, `static.font.sizes.xs` | — |
| Building state | Spinner + Text | reuse | `color-text-secondary` | — |
| Empty sources | EmptyState | reuse — hint to mine/study first | `color-text-secondary`, `color-border` | Icon: `audioWave` |
| End summary (REQ-6) | Box card + Button ×2 | reuse — played/skipped counts + "again"/"change sources" | `color-surface-popover`, `component.button.*` | Icon: `repeat` |
| `SrsHome` pump action (REQ-5) | Button (`secondary`) | reuse — sits with existing chrome buttons row | `component.button.secondary.*` | Icon: `audioWave` |
| `PlaylistTab` launcher row (REQ-5) | ListItem | reuse — pinned **above** records conditional (survives EmptyState); trailing chevron affordance | `color-surface-hover`, `color-divider` | Icon: `audioWave` + `chevronRight` |
| Inline error + retry | Text + Button (`secondary`) | reuse | `color-error-subtle`, `color-error` | — |

## Conventions check

- Components resolve to `src/shared/ui/*` atoms (`Box`, `Button`, `Heading`, `Text`, `Select`, `Toggle`, `SegmentedControl`, `Chip`, `IconButton`, `EmptyState`, `Spinner`, `ListItem`); feature pieces (`PumpView` setup/stage/summary) are composition sites, not atoms.
- Icons resolve to `ICON_CATALOG`: `navPlay`, `navPause`, `navPrev`, `navNext`, `recStop`, `repeat`, `eye`, `eyeOff`, `audioWave`, `chevronLeft`, `chevronRight`.
- No new tokens. Values referenced: `static.touchTarget.mobile`, `radius-md`, `radius-pill`, `color-primary-subtle`, `color-field`, `color-surface`, `color-surface-popover`, `color-surface-hover`, `color-border`, `color-divider`, `color-text`, `color-text-secondary`, `color-error-subtle`, `color-error`, `static.font.sizes.*`, `component.chip-status.*`, `component.toggle.*`, `component.segmented.*`, `component.button.*`, `component.iconButton.*`.
- The single `create` (stage card layout) is feature-scoped CSS composing atoms — consistent with `QueueTab`/`PlaylistTab` row modules.
- `App.tsx` view union `'home'|'deck'|'streaks'|'vocabulary'` gains `'pump'`; `location.search` init reads `?view=pump` (new code path per spec REQ-5 — the existing `deckId` param is dead today).
