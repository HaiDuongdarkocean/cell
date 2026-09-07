# Download Settings — Design Brief

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

## Design Read
The shipped `Download` card is a flat stack of `label-left / select-right` rows broken up by faint uppercase group labels — functional and compact, but the groups blur together, the conditional `Workers` row appears without ceremony, and nothing about the surface reflects the liquid-glass, nature-first language Cell is built on.

## Primary job
Let a language learner (age 5–80) set how many downloads run at once, what format/quality to prefer, how conversion behaves, and how files are named — quickly, on a 320 px phone up to a desktop, without reading every row.

## 3 dials (defaults)
- DESIGN_VARIANCE: 4 — keep the same data model and `Select` atom; rethink only the container.
- MOTION_INTENSITY: 2 — opacity/expand transitions only; honors `prefers-reduced-motion`.
- VISUAL_DENSITY: 5 — one glance should surface the current choices without a long scroll.

## Inspiration anchor
Pebbles resting at the bottom of a still lake: each setting group is a smooth, separate stone — visible through clear water, calm, ordered, never shouting. Sky blue leads, leaf green and sunlight amber accent, stone gray grounds.

> Context quote: *"tôi muốn liquic glass sẽ là design system style, màu chủ đạo là màu xanh dương của bầu trời, tiếp đó là màu xanh lá của cây, trong suốt của nước, màu xám của các viên sỏi, màu nâu của đất, màu vàng của ánh mặt trời… yên bình, nhẹ nhàng, lả lướt."* — `docs/context/project-context.md`

## Concepts

### Concept A — Liquid Glass Grouped Cards (proposed default)
- **IA mental model:** the four groups (Concurrency, Format & Quality, Conversion, Filename) are four separate frosted-glass cards. Same content, same order — only the container changes.
- **UX flow:** scan the small uppercase group title on each card → read the label above each select → change the value. The Workers child only appears inside Conversion when Parallel conversion is Manual.
- **UI structure:** `Card` frame → `VStack` of `Card variant="glass"` group cards → per-group title + stacked `SettingsRow` fields (`label` + `Select`). Format & Quality uses a 2-column container-query grid on wide cards, stacked on mobile.
- **3 dials:** VARIANCE 3, MOTION 1, DENSITY 4
- **Why it fits:** pure liquid-glass expression — translucent surfaces, inner highlight, soft shadow — while staying almost 1:1 with production IA. Lowest adoption risk.
- **Risk:** slightly taller than the flat list (each group card has its own padding); group cards compete with the outer section card's chrome.
- **Audit findings:** production `groupLabel` styling fades too much against `cardBody` (secondary color on same surface); A fixes this by giving each group its own elevated glass surface.

### Concept B — Nature Dashboard Tiles
- **IA mental model:** settings are tiles on a dashboard. Each tile = one setting, tinted by a nature accent (sky / leaf / sun / stone) with an icon, a one-line blurb, the current value, and the select.
- **UX flow:** scan the tinted icon + current value at the top of each tile → adjust the select at the bottom → the Workers tile slides into the grid when Manual is chosen.
- **UI structure:** responsive CSS grid inside the card body (1 col mobile → 2 col ≥480 px → 3 col ≥640 px). Each tile is a glass surface with an accent stripe, `Icon` chip, value line, and `Select`.
- **3 dials:** VARIANCE 6, MOTION 2, DENSITY 7
- **Why it fits:** touch-friendly targets, glanceable current values, and the accent system directly expresses the sky/leaf/sun/stone palette without hardcoding colors (all tints derive from `--color-*` tokens).
- **Risk:** higher visual density; tiles are taller than rows so the section scrolls more on 320 px; accent stripes must stay subtle to remain "quiet".
- **Audit findings:** production shows the current value only inside the closed select; B surfaces it as text so the state is readable at rest.

### Concept C — Progressive Accordion
- **IA mental model:** the card is a set of collapsible group drawers with a sticky summary bar on top — like a calm table of contents that always answers "what is set right now?"
- **UX flow:** the summary bar shows chips of current choices (At once · Format · Quality · MP4 · Parallel · Filename) → tap a group header to expand → change values → the bar and the group's meta line update live.
- **UI structure:** sticky glass summary bar → `Collapsible` groups with `aria-expanded` header buttons → stacked `FieldRow`s inside. Workers stays nested inside Conversion.
- **3 dials:** VARIANCE 7, MOTION 3, DENSITY 3
- **Why it fits:** minimal cognitive load — collapsed by default, so a first-time user sees four calm group rows plus a summary, not eight selects.
- **Risk:** one extra tap to change anything; the sticky bar only helps while the card itself scrolls (it sticks to the page top within the mockup stage).
- **Audit findings:** production's conditional `Workers` row appears inline with no relationship cue; C keeps it nested inside Conversion where it belongs.

## Responsive behavior

| Viewport | A · Glass Groups | B · Nature Tiles | C · Accordion |
|----------|------------------|------------------|---------------|
| **320 px** | Full-width glass cards, fields stacked, selects full width. | Single-column tiles, full-width selects. | Sticky chips wrap to 2–3 rows; groups full width. |
| **768 px** | Format & Quality goes 2-column; other groups stay stacked. | 2-column tile grid. | Same as 320; chips fit on one row. |
| **1280 px** | Same as 768 with airier padding. | 3-column tile grid. | Same; meta line shows more of the values. |
| **1920 px** | Card capped at stage width; no layout fork. | 3-column grid; no fork. | No fork. |

## States
- **default** — current value shown in the select; groups/tiles at rest.
- **hover** — tile/group surface lifts to `--color-glass-surface-hover` (hover-capable devices only).
- **focus-visible** — `--color-primary` outline / `--shadow-focus` ring on selects and accordion headers.
- **conditional** — Workers field/tile only exists when Parallel conversion is `manual`.
- **expanded / collapsed** (C) — chevron rotates 180°, `Collapsible` animates height.
- **disabled / reduced-motion** — all transitions removed; instant state change.

## Anti-patterns avoided
- No three reskins of the same list — each concept uses a different IA (grouped cards / dashboard tiles / collapsible drawers).
- No static mock — every concept is fully interactive against shared state.
- No skipping the real panel — the shipped card is recreated live for comparison.
- No hardcoded colors, px spacing, or new components — everything is `var(--*)` tokens + `shared/ui` atoms.
- No mobile-afterthought — the 375 px stage is the default viewport.
- No unconditional advanced fields — Workers stays hidden until Manual, matching production semantics.

## Mockup
`src/entrypoints/mockup-download-settings/` — Real panel + Concepts A/B/C with concept, viewport (default mobile), and theme switchers. Open `http://localhost:5173/src/entrypoints/mockup-download-settings/`.
