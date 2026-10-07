# Design review — mining-queue

- Item: `mining-queue` (backlog #34)
- Spec: `docs/specs/mining-queue.md`
- Brief: `docs/intent/mining-queue-design-brief.md` · Mapping: `docs/intent/mining-queue-component-mapping.md`
- Mockup: `src/entrypoints/mockup-mining-queue/` (design-time, removed at ship)
- Screenshots: `tmp/mining-queue-design/` (6 shots)

## Variant

"Inbox Tray" — queue tab reads as an inbox: newest-first compact rows (kind chip + content + source/age metadata + trailing actions), EmptyState when empty, capture affordances (`layers`) at cue row and popup toolbar. Reuses `NavItem`, `SectionHeader`, `Text`, `Chip`, `IconButton`, `EmptyState`, `Spinner`, `Button`, `Menu`; queue row is feature-scoped composition, no new shared atom.

## Evidence

| Shot | Viewport | Theme | Result |
|---|---|---|---|
| queue-mobile-dark.png | 390px | dark | PASS |
| queue-mobile-light.png | 390px | light | PASS |
| queue-desktop-dark.png | 960px | dark | PASS |
| queue-desktop-light.png | 960px | light | PASS |
| real-mobile-dark.png | 390px | dark | production CueList baseline |
| real-desktop-dark.png | 960px | dark | production CueList baseline |

Vision-reader pass: no clipped text, no broken icons, no overlap between content and action column, contrast readable in both themes.

Notes resolved as design intent:
- Term rows show term+reading line and context sentence line — intentional two-line anatomy per brief, not duplication.
- Bold weight on sentence-kind rows only — intentional kind differentiation.
- Row 3 metadata wraps `1d ago` at 390px — acceptable word-boundary wrap, no overlap.

## Checks

- `node scripts/check-design-brief.mjs mining-queue` → `design brief ok — 7 tokens, 10 components, 2 icons`, VERDICT: PASS
- All interactions map to spec journeys: save-from-popup / save-from-cue → capture affordances; review/cardify/quick-add/discard → row actions; empty/failed-load → EmptyState/Spinner/Button-retry (covered in brief states).
- No invented tokens or icons (`layers`, `pencil`, `zap`, `trash2` all in ICON_CATALOG).
- Requirement traceability: REQ-1 save affordances, REQ-2 durable queue surface, REQ-3 cardify handoff, REQ-4 discard, REQ-5 failure surfacing (retry state), REQ-6 mobile entry via Tools sheet.

VERDICT: PASS
