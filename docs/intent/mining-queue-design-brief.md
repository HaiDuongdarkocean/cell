# Design Brief — mining-queue (all mode)

> Spec: `docs/specs/mining-queue.md` · Intent: `docs/intent/mining-queue.md`
> Single justified variant (all mode). Capture is invisible; the queue is an inbox tray — review is the only screen with shape.

## Design Read

The feature splits into two moments with opposite visual weights: **capture** must be nearly invisible (one icon, transient confirm — the persona keeps watching) and **review** is a workbench list (read context, decide per row). The design therefore puts all visual mass in one list surface inside the universal panel and keeps capture affordances to icon-level actions that already exist as patterns (cue-row action buttons, popup toolbar buttons).

## Function audit

| Function (spec REQ) | Features | Element affected |
|---|---|---|
| persist capture (REQ-1/2) | save action on lookup candidate; save action on cue row | icon button in candidate toolbar; icon button in CueList `actions` slot |
| review queue (REQ-3) | Queue tab in universal panel | `PANEL_TABS` entry `queue` (`mobileNav:'tools'`), `QueueTab` list |
| cardify (REQ-4) | per-row cardify → card creator | row action button → existing dialog |
| quick-add (REQ-5) | per-row quick-add → configured sink | row action button (term items only) |
| discard (REQ-6) | per-row discard | row action button |
| queue state visible (N7) | count in tab header row | `SectionHeader`-level row inside tab |
| empty/loading/error (REQ-3) | EmptyState / Spinner / inline error | tab body states |
| i18n + a11y (REQ-9) | labels/aria on every affordance | — |

## Journey map

TO-BE steps 1–3 (capture while watching) → affordances only: cue-row save icon + candidate-toolbar save icon; confirmation is the transient toast pattern already used for card sends. TO-BE 4–6 (review session) → the Queue tab: list → per-item cardify/quick-add/discard. The panel itself is the review venue — no new chrome, no new overlay layer.

## Dials

DESIGN_VARIANCE 2 (rows + tab reuse panel conventions; one new row composition) · MOTION_INTENSITY 1 (toast only) · VISUAL_DENSITY 5 (list rows, comfortable meta).

## Inspiration anchor

An **inbox tray** — mail queue, not a dashboard: items arrive passively, the user clears the tray top-down with per-row decisions. Non-digital reference: a physical "to-file" tray on a desk — items stacked, label up, processed in order.

## Primary job

Let the learner answer "which of these saved lines deserve cards?" in one sitting — each row must read: what I saved (term or sentence), where it came from, how old; then one-tap dispatch.

## Chosen variant — "Inbox Tray"

- **IA mental model:** a queue tab = inbox; capture points are push-doors (one icon), review is the only structured surface.
- **Visual archetype:** compact list rows on `surface-elevated` — same anatomy vocabulary already used by vocabulary rows and playlist rows: leading kind chip, text block, meta line, trailing action cluster.
- **Non-digital reference:** paper inbox tray.
- **Material / surface:** `.tabPane` host + `.scrollport` (up-tab-layout-contract); rows via `ListItem`-convention card-less list with divider hairlines; EmptyState for empty; Chip `status`-style kind chip reuses the `component.chip-status.*` recipe for term vs sentence kind tint (term=primary-subtle, sentence=field).
- **Typography:** sentence body `static.font.sizes.sm` 2-line clamp; meta `color-text-secondary` xs; term `static.font.sizes.md` medium.
- **Motion:** none new — row hover `surface-hover`, action focus rings, toast on save/fail.
- **UX flow:** open Queue tab → rows newest-first → row actions: `pencil` cardify (opens existing card creator), `zap` quick-add (term rows only), `trash2` discard → row exits; header shows `N items`.
- **UI structure:** header row (title + count) → scrollport list → row = kind chip + content + meta + actions.
- **Why it fits:** zero invention — every piece is an existing panel idiom; the only new visual object is the row's kind chip, which reuses the shipped status-chip recipe family.
- **Risk:** `mobileNav:'tools'` hides the tab behind the Tools sheet on mobile — accepted risk recorded in spec; badge/count lives inside the tab header, not on chrome.
- **Audit findings:** N1–N8 + S5 all mapped; nothing deferred.

### ASCII sketch — Queue tab (desktop sidebar width ~360px, mobile full-bleed)

```
┌ Queue                                              12 items ┐
├─────────────────────────────────────────────────────────────┤
│ [term] である                                               │
│   それは事実である — youTube · 12:04 · 2h ago   [✎] [⚡] [🗑] │
├─────────────────────────────────────────────────────────────┤
│ [line]                                                      │
│   "I could have been a contender" — Netflix · 1:02:33 · 3h  │
│                                                        [✎] [🗑] │
├─────────────────────────────────────────────────────────────┤
│ …                                                           │
```

### ASCII sketch — capture affordances

```
Cue row actions:  [12:04] [▤ save]          popup toolbar: … [⚡quick-add] [✎card] [▤save]
confirm:          toast "Saved to queue" (existing toast system, ~1.6s)
```

## Component mapping

`docs/intent/mining-queue-component-mapping.md`.
