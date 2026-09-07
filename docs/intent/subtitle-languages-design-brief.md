# Subtitle Languages — Design Brief

## Design Read
`selectedSubtitleLanguages` is a **whitelist filter** for `selectBestMedia` — it decides which
detected subtitle languages are eligible when auto-selecting media. `'all'` is an exclusive
sentinel (`wantAllSubs` short-circuits the filter), yet the shipped `MultiSelect` renders it as
a sibling toggle inside the same list — a mental-model flaw: `['all', 'vi']` is semantically
`all` anyway.

## Primary job
Tell the auto-select pipeline which subtitle languages are acceptable: **everything** or a
**specific small set** (typically 1–3). Visible only when `autoSelectEnabled` is on.

## 3 dials (defaults)
- DESIGN_VARIANCE: 5 — same data, different control shapes.
- MOTION_INTENSITY: 3 — expand/fade only, honors prefers-reduced-motion.
- VISUAL_DENSITY: 6 — one row when possible; the 182-item list should not dominate the card.

## Responsive behavior
- **320 px:** all concepts are single-column; lists cap at ~6 rows tall with internal scroll;
  touch targets ≥ 32 px (Toggle xs) / row height ≥ touch-target.
- **1280 px:** same structure, wider stage — no layout fork needed.

## Concepts

### Concept A — Checklist (conservative)
- **IA mental model:** same open list, but "All" is a *mode row* pinned above, not an item.
- **UX flow:** toggle All on → list mutes (aria-hidden); pick any specific language → All turns off; pick All → specifics clear.
- **UI structure:** All-row + divider → search (single focus ring) → Selected/All sections → rows with shared `Toggle` atom.
- **3 dials:** VARIANCE 2, MOTION 1, DENSITY 4
- **Why it fits:** zero learning curve; fixes the sentinel flaw + double focus ring + custom CSS toggle.
- **Risk:** still tall inside the card even when user only ever wants "All".

### Concept B — Collapsed picker (hybrid)
- **IA mental model:** the setting is one summary row; the list is a disclosure.
- **UX flow:** row shows "All languages" / "English +2" + chevron → click expands the picker **in-flow** (section card grows — same convention as the new in-flow select menus) → search + toggle rows → click again to collapse.
- **UI structure:** ghost Button trigger (trailingIcon chevron, rotates on expand) → bordered panel: All chip-toggle + SearchField + LangRow list.
- **3 dials:** VARIANCE 5, MOTION 3, DENSITY 8
- **Why it fits:** card stays compact; summary answers "what's selected" without opening; matches today's "card grows" rule.
- **Risk:** one extra click to see the full selection; discoverability relies on the summary text.

### Concept C — Tag field (experimental)
- **IA mental model:** the field is the selection — chips are the state.
- **UX flow:** "All languages" renders as one locked chip; type to filter suggestions (click/+ to add, Enter adds first match, Backspace removes last chip); empty state shows a Popular quick-pick row.
- **UI structure:** chip field (search icon + chips + inline input) → popular chips → in-flow suggestion list.
- **3 dials:** VARIANCE 8, MOTION 4, DENSITY 9
- **Why it fits:** densest possible representation; common case (All, or 1–3 langs) is one glance; removes are obvious (× per chip).
- **Risk:** browsing 182 languages is weaker (suggestions truncated to 8–12); less familiar pattern in this settings surface.

## States
- default / hover / focus-visible / selected / all-mode / empty-results / disabled (Concept A mutes list under All).

## Anti-patterns avoided
- No `'all'` item inside the same multi-select list as specific languages.
- No custom CSS toggle — all concepts use the shared `Toggle` atom (xs default, `var(--color-primary)`).
- No double focus ring — ring lives on the field wrap only.
- No hardcoded px/colors — tokens only.

## Mockup
`src/entrypoints/mockup-subtitle-languages/` — Real panel + A/B/C, viewport + theme switchers.
