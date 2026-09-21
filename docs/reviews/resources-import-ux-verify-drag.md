# Verify Review — resources-import-ux drag rework

VERDICT: PASS-WITH-NOTES

The core design is sound: `beginDrag` reads geometry while the slot is still in
flow, `setDrag` is a discrete-event state update so React commits
`position:absolute` before the passive effect attaches the window listeners, and
every `pointermove`/`scroll`/rAF read therefore sees post-collapse `offsetTop`
values (which are layout values, unaffected by the siblings' translateY). The
collapsed-index `toIndex` matches `applyReorder`'s `splice(from,1); splice(to,0)`
semantics exactly, and `finish` correctly treats `toIndex === fromIndex` as a
no-op since re-inserting at `fromIndex` in the collapsed list restores the
original order. Ghost land position (`slotTop - fromTop`), placeholder position
(`rest[toIndex].offsetTop`), and sibling shift (`cardHeight + gap`) are mutually
consistent, including the `toIndex === rest.length` tail case
(`last.offsetTop + last.offsetHeight + gap`).

## Findings

- (severity: minor) `useSectionDrag.ts:121` — `beginDrag` never checks `e.button`
  or `e.isPrimary`. A right/middle-button pointerdown on the grip starts a full
  drag session (`preventDefault` on pointerdown does not suppress the later
  `contextmenu`), and a second finger on another grip overwrites
  `sessionRef.current` mid-session: the old effect's `tick` keeps rescheduling
  itself into the *new* session's `rafId` (an extra rAF loop that lives until
  the session ends), and the first session's listeners track the wrong element.
- (severity: minor) `useSectionDrag.ts:118,121-157` — `beginDrag` doesn't guard
  `sessionRef.current`/`settleTimerRef.current`. Re-grabbing a card inside the
  260 ms settle window overwrites the session while the orphaned settle timer
  still fires `finish(commit)` → `setDrag(null)`, silently killing the live
  second drag (and potentially committing `onDrop` with the *new* session's
  `toIndex` if the user already moved). One-line fix: bail early or clear the
  pending timer in `beginDrag`.
- (severity: minor) `useSectionDrag.ts:42-52,95-102,187` — window/document-level
  scrolling is unhandled. `findScrollParent` only detects `overflow-y:
  auto|scroll` ancestors that currently overflow (`scrollHeight > clientHeight`);
  if the panel scrolls with the window (e.g. a full-page options surface), edge
  auto-scroll does nothing and a manual window scroll mid-drag desyncs
  `pointerListY`/`toIndex` until the next `pointermove` (no `scroll` listener on
  window). Inside the settings dialog this path presumably has a real scroll
  parent — verified OK there — but the fallback is absent.
- (severity: minor) `useSectionDrag.ts:118` + `ResourcesPanel.tsx:143-146` — the
  settle `setTimeout` captures `finish` (hence `onDrop`) from the render at
  `endDrag` time. A `resources` change landing inside the 260 ms window resolves
  `from` via `findIndex` and computes `toIndex` against the stale list. The
  stale pair is self-consistent (same render) and `refresh(true)` restores
  persisted truth, so impact is cosmetic, but the wiring is one render behind
  the live DOM the drag actually measured.
- (severity: note) `useSectionDrag.ts:34` vs `tokens.json` `--duration-normal:
  200ms` — `SETTLE_MS = 260` leaves a ~60 ms dead window where the ghost has
  visually landed but the placeholder/ghost haven't committed. Works, but the
  constant is hand-matched to the wrong token; consider `getComputedStyle` of
  the duration or a comment pinning 260 to the token.
- (severity: note) `useSectionDrag.ts:121` — no movement threshold: a plain
  click/tap on the grip flashes the dashed placeholder and ghost for up to one
  settle cycle before `finish` no-ops (`toIndex === fromIndex`). Cosmetic
  papercut; a 3–4 px activation threshold would fix it.
- (severity: note) `useSectionDrag.ts:159-198` — the listener effect depends on
  `drag` (a new object every `pointermove`) and on `endDrag` (recreated every
  ResourceSection render because `onDrop` is an inline closure), so all five
  listeners plus the rAF loop are torn down and re-attached on every pointer
  move. Correct — old listeners stay live until the deferred cleanup so no
  events are dropped — but wasteful; gating on a `dragActive` boolean instead of
  the `drag` object would make it O(1) per session.
- (severity: note) `useSectionDrag.ts:81-91` — `pointerListY` (from
  `getBoundingClientRect().top`, border box) is compared against `offsetTop`
  (padding box). Equal only because `.resourceList`
  (`ResourcesPanel.module.css:103-108`) has no border/padding — an implicit
  invariant worth a comment.
- (severity: note) `useSectionDrag.ts:106-119,163-171` — a second `endDrag`
  squeezed between the first `endDrag` and effect cleanup (e.g. Escape right
  after `pointerup`) schedules a second settle timer; the orphaned first timer
  still fires `finish(commit)`, so Escape during the first ~1 frame of settle
  cannot veto the commit. Narrow window, acceptable UX, but undocumented.
- (severity: note) `useSectionDrag.ts:169-171` — Escape cancel doesn't
  `stopPropagation`/`preventDefault`, so a containing dialog that closes on
  Escape will close alongside the cancel. Likely acceptable (both are "cancel")
  but unverified against the settings dialog's own Escape handling.
- (severity: note) `ResourceCard.module.css:140-144` — the
  `prefers-reduced-motion` block only neutralizes `.skeleton`'s pulse;
  `.cardDragging`'s `box-shadow` transition survives reduced motion (the
  rotate/scale transform is applied non-animated, so impact is minimal).
  `ResourcesPanel.module.css:143-149` correctly covers `.slot`, `.slotSettling`,
  `.dropPlaceholder` — and `.slotDragging` needs nothing since it's already
  `transition: none`.
- (severity: note) `ResourcesPanel.test.tsx:388-394` — `mockReducedMotion`
  permanently replaces `window.matchMedia` (no restore in `afterEach`) for the
  rest of the file. Harmless today (nothing else consumes it), but it also means
  the non-reduced-motion settle path — `settling: true`, `offsetY =
  slotTop - fromTop`, the `settleTimerRef` branch of `endDrag` — has zero unit
  coverage; a regression there would only be caught by the Chromium verifier.
- (severity: note) `useSectionDrag.ts` / `ResourcesPanel.tsx:591-593` — a
  completed pointer reorder produces no `announcement` via the existing
  aria-live region (the ArrowUp/Down keyboard fallback also stays silent). Not a
  correctness bug; flagging as an a11y polish gap.

## Coverage check

- useSectionDrag.ts full read — stale closures in listeners/rAF: covered (no real bug; listeners close over `sessionRef`/`s` correctly, stale-`onDrop` window noted).
- Index drift when `resources` prop changes mid-drag: covered (defensible — `toIndex` tracks live DOM, `from` re-resolved by id in `ResourcesPanel.tsx:144`; stale-settle edge noted).
- Midpoint math on variable-height cards: covered (live `offsetTop`/`offsetHeight` reads handle expanded cards correctly).
- Collapse-geometry assumption: covered (verified — `beginDrag` reads pre-collapse, all `updateDrag` reads happen after React commits `position:absolute`; `offsetTop` ignores transforms).
- Pointer-capture / touch-action: covered (`setPointerCapture?.()` + window bubbling + `touch-action: none` on `.grip`; `draggable={false}` correctly overrides `DragHandle`'s default `draggable` at `DragHandle.tsx:43-47`).
- Cleanup on unmount / settle-timer leaks: covered (unmount effect clears both; `finish` clears the timer ref; orphan-timer edge cases noted).
- Escape / scroll-edge / reduced-motion paths: covered (all correct; Escape-during-settle and window-scroll gaps noted).
- ResourcesPanel + ResourceCard wiring: covered (ghost `pointer-events: none`; placeholder math matches CSS; `beginDrag` uses the render-current `i`; `canReorder` suppresses grip in edit mode; `onMove` ArrowUp/Down bounds-checked through `applyReorder`).
- CSS ghost elevation/placeholder/transitions/reduced-motion: covered (`.slotSettling` declared after `.slotDragging` intentionally wins `transition` at equal specificity; z-index 3 over placeholder; `.cardDragging` shadow gap noted).
- Tests pin behavior / stub geometry consistent with hook: covered (stubbed post-collapse `offsetTop`/`offsetHeight` values match exactly what the hook reads live; assertions on ghost attr, placeholder top/height, per-slot translateY, commit args `[2,3,1]`, and cancel/Escape non-commit are real, falsifiable checks — not tautologies; settle path uncovered).

## Residual notes

No blocker or major findings — the geometry/session model holds up under
adversarial reading, and the jsdom stubs are honest post-collapse values rather
than self-fulfilling mocks. The three minors worth fixing in a follow-up are
the `e.button`/`isPrimary` + session-guard omissions in `beginDrag`
(single-site fix), the missing window-scroll fallback, and the stale-`onDrop`
settle window. Everything else is cosmetic or an implicit-invariant
documentation gap. Recommend `PASS-WITH-NOTES` — ship, then fold the minors
into a small hardening patch.
