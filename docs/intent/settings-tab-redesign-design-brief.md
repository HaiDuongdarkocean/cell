# Settings Tab Redesign — Design Brief

> Item: `settings-tab-redesign` · mode `all` (single justified variant) · Spec: `docs/specs/settings-tab-redesign.md`
> Inspiration anchor: YouTube/Spotify settings grammar — **flat grouped lists, strong section titles, visible supporting text, right-edge controls** — expressed only through Tihoka tokens + shared atoms. No literal foreign values.

## Design Read

The shipped surface stacks 13 identical boxed `Card`s. Inside them, the same job — "a group of related settings" — is rendered seven different ways (`downloadGroupTitle`, `groupLabel`, `SectionHeader`, `Heading level=5`, raw `<h2>`, `.sectionTitle` xs-caps, `.timelineLabel`), rows hide all explanation behind ⓘ popovers, embedded panels add box-in-box chrome (`ResourceCard`, `DictLinksManager` rows, `SourceDetailPanel`, sync `.row`s), and the Sync card ships a real bug: no `.cardBody` wrapper so panels render flush to the card edge. The surface reads as "a stack of boxes" instead of one settings page.

## Primary job

Let a learner (5–80, phone → desktop) scan 13 sections, know what each section is for, and understand each row's purpose without tapping ⓘ — while every existing control, scroll-sync anchor, and `data-tihoka-id` keeps working byte-for-byte.

## 3 dials (defaults)

- DESIGN_VARIANCE: 4 — same IA, same section order, same controls; only the visual grammar changes (bands + rows, not a new navigation model).
- MOTION_INTENSITY: 2 — keep the existing `cardEnter` fade only as `sectionEnter`; no new motion; `prefers-reduced-motion` honored.
- VISUAL_DENSITY: 5 — YouTube/Spotify-row density: rows tall enough to carry a description line, no taller.

## Chosen variant — "Flat bands, labeled groups" (all-mode single variant)

**IA mental model:** one scrolling page of 13 flat bands, each = title + description + rows. Like youtube.com/settings and Spotify's Settings page: no boxed cards, structure from spacing + hairlines + one group-label style.

**Why this variant (vs keeping redesigned cards):** The audit shows the card chrome is the source of the box-in-box problem — every embedded panel fights its container. Removing the box removes the class of defect entirely, needs no per-panel negotiation, and is exactly the YouTube/Spotify grammar the request names. A "prettier card" variant would keep the defect class alive.

### Layout sketch

```
┌─ popoverBody ────────────────────────────────────────┐
│ [Sidebar|Navigation]   │ .mainCol (scroll)           │
│                        │                             │
│                        │ ┌─ SettingsSection ────────┐│
│                        │ │ General                  ││  Heading level=3 size=3
│                        │ │ App-level preferences.   ││  Text variant=supporting
│                        │ │                          ││
│                        │ │ Interface language       ││  SettingsRow title+desc
│                        │ │ Changes the app's own…   ││  ↳ Select (stacked ctrl)
│                        │ │ ───────────── hairline ──││  divider
│                        │ │ Dictionary popup      ○──││  Toggle right edge
│                        │ └──────────────────────────┘│
│                        │   · space-6 gap ·           │
│                        │ ┌─ SettingsSection ────────┐│
│                        │ │ Downloads                ││
│                        │ │ Format, quality, speed…  ││
│                        │ │  SPEED                   ││  SettingsGroup label
│                        │ │  Simultaneous downloads  ││
│                        │ │  [ select full-width ]   ││
│                        │ └──────────────────────────┘│
└────────────────────────┴─────────────────────────────┘
```

### The grammar — 4 recipes replace ~14 dialects

1. **`SettingsSection`** (new shared atom) — `<section>` band: `title`, `description`, optional `hint` on the title, `data-section` anchor passthrough + forwarded ref. No card chrome: transparent surface, no border, no radius, no shadow. Sections separated by `space-6` + hairline `border-top` on all but the first. Replaces `Card.sectionCard` + `.cardHeader` + `.cardTitle` + `.cardDesc` + `.cardBody` + `.downloadCardBody` (and fixes the Sync missing-body bug by making the body wrapper non-optional).

2. **`SettingsRow` extended** (shared atom) — gains `title?: ReactNode`, `description?: ReactNode`, `hint?: string`/`hintAriaLabel?: string` props composing the canonical left stack (title sm-medium primary + description sm secondary) with the control as the last child at the right edge. Children-based API stays for composite rows (grid fields, list rows). `divider` keeps the hairline-between-rows job. New `child` variant replaces `.childField` (indent = `margin-left space-4` + `border-left hairline`, same visual, one recipe).

3. **`SettingsGroup`** (new shared atom) — `label` + children; label = `Text` sm semibold secondary, normal case (no uppercase transform — the old small-caps dialect was flagged). Replaces `downloadGroupTitle`, `groupLabel`, `SectionHeader`-in-card, `Heading level=5`, raw `<h2>`, `.sectionTitle`, `.timelineLabel` for the "sub-heading inside a section" job everywhere.

4. **Row description rule (REQ-3)** — every `settings.*.hint` string attached to a *row* renders **inline** as the row's `description` (they are 40–170 chars — YouTube-length, not essay-length). `HintIcon` survives only on the two section *titles* that carry one today (`dictionaryPopup.saveHint`, `wordBadge.hint`) and inside embedded panels' forms. Zero rows lose information (AC-5 floor) — the hint text is promoted, not dropped. **No new i18n keys needed**: the same message string moves from popover to inline.

### Atom-level decisions (shape / spacing / color / type)

| Aspect | Recipe | Token |
|---|---|---|
| Section gap | whitespace, not boxes | `static.spacing.6` between bands; `border-top` `static.borderWidth.hairline` `derived.light.color-divider`/`derived.dark.color-divider` on sections 2..13 |
| Section title | `Heading level={3} size={3}` | inherits `static.font.sizes.lg` semibold |
| Section desc | `Text variant="supporting"` | `presets.dawn.core.light.textSecondary`/`presets.dawn.core.dark.textSecondary` |
| Row label | `Text`-equivalent sm medium | `static.font.sizes.sm`, `static.font.weights.medium`, `core.*.text` |
| Row description | visible inline | `static.font.sizes.xs`→`sm` `presets.dawn.core.light.textSecondary`/`presets.dawn.core.dark.textSecondary` |
| Row padding | `SettingsRow` default | `static.spacing.3` / `static.spacing.4` |
| Sub-group label | `SettingsGroup` label | `static.font.sizes.sm` semibold `color-text-secondary`, normal case |
| Sub-group gap | whitespace | `static.spacing.4` above label, `static.spacing.2` below |
| List-row-in-panel | one recipe: `Card` `--card-padding: static.spacing.2 static.spacing.3`, `--card-radius: static.radius.lg` for draggable/actionable rows (resources, dict-links, jobs); bordered-div `.row` in SyncPanel converted to same recipe; transparent hover rows (voice list) keep transparent + `derived.light.color-surface-hover`/`derived.dark.color-surface-hover` |
| Detail/preview box | one recipe: `derived.light.color-field`/`derived.dark.color-field` bg + `static.radius.lg` + `static.spacing.3` padding — `SourceDetailPanel`, `.previewBox`, `.profileForm`, `.editBar` all converge to it; `Dropzone` keeps dashed border (affordance) with `static.borderWidth.hairline` not space-token |
| Nested radius | converge: inner surfaces `static.radius.lg`; only the outer popover/dialog keeps `static.radius.xl` |

### Embedded panels — de-chroming decisions (REQ-5)

| Panel | Decision |
|---|---|
| `LanguageProfilePanel` | Keep `.banner` (status surface = content, not chrome). `SelectableCard` list rows keep — drag/radio affordance needs boundaries. Fix `.radio` px hardcodes → radio dot/bg tokens (see mapping); `.choice` raw `1px` → `static.borderWidth.hairline`. `.linkBtn` → `Button variant="link" size="sm"`. |
| `ResourcesPanel` | `gap space-10` → `static.spacing.6`; `ResourceSection` `SectionHeader` → `SettingsGroup` recipe (kills h2-inside-h3 outline); `ResourceCard`/`JobRow` keep Card list-row recipe above; `ImportProgress` `min-height:48px` → `static.spacing.12`; `Dropzone` border width → `static.borderWidth.medium`. |
| `DictionaryPopupSettingsPanel` | Timeline steps' `.timelineLabel` (base medium — louder than section labels) → `SettingsGroup` label sm semibold; `.surfaceTabs` custom pill strip keeps (unique archetype) but active tint → `derived.light.color-primary-subtle`/`derived.dark.color-primary-subtle` token instead of color-mix literal. `DictLinksManager` `SectionHeader` → `SettingsGroup`; row `Card`s keep list-row recipe. |
| `WordBadgeSettingsPanel` | `.previewBox` → the shared detail-box recipe (`color-field` + `radius-lg`); `.label` xs secondary → canonical row label sm medium; inline `9999px`/`2px` → `static.radius.full` / `static.borderWidth.medium`. |
| `AudioPanel` | `.group` headers → `SettingsGroup`; `SourceDetailPanel` box → shared detail-box recipe; `TtsLanguagePanel` bare `SettingsRow` (double-inset bug) → `dense` variant to match siblings; `.sectionTitle` xs-uppercase → `SettingsGroup` label. |
| `ThemePanel` | raw `<h2>` → `SettingsGroup` label (or `Heading level=4` via SettingsSection sub-structure); `ModeCards` unchanged (they ARE the control). |
| `SyncPanel` + `AnkiStatusSyncPanel` | Sync card gains the standard body (flush-bug fix). `AnkiStatusSyncPanel`'s `SectionHeader` double-title → `SettingsGroup` label only ("Anki status sync" stays, subtitle folds into SyncPanel summary context). `.row` bordered divs → list-row Card recipe; all raw `1px`/`96px`/`140px`/`0.04em` → hairline / spacing tokens / shared label style. `.privacy` `border-top:1px` → `static.borderWidth.hairline`. |
| `Shortcuts` grid | `.shortcutGroupWrap` + `.groupLabel` → `SettingsGroup`; `.shortcutField` keeps grid-field shape (it is a control), normalized to `.field` padding `static.spacing.2 static.spacing.3`. |
| `Download` | `.downloadCardBody` → `SettingsSection` body; 4× `.downloadGroup` → `SettingsGroup`; `.childField` → `SettingsRow child`. |

### Surface kept verbatim

- `Sidebar`/`Navigation`/`NavItem`/`SettingsRow`-independent subnav logic, `observeScrollDirection`, `sectionRefs`, `data-section`, `aria-current`, auto-center, hide-on-scroll (REQ-6/AC-9).
- All controls, `data-tihoka-id`s, `onChange` paths, storage listeners, Escape layers (REQ-7/AC-8).
- `Heading`/`Text`/`Toggle`/`Select`/`MultiSelect`/`ShortcutInput`/`HintIcon`/`Button`/`SegmentedControl`/`EmptyState`/`Alert`/`StatusDot`/`Badge`/`Chip`/`Checkbox`/`Dialog`/`Menu` atoms.

## Responsive behavior (container widths — `popoverBody` is `container-type: inline-size`)

| Container | Layout |
|---|---|
| `<600px` | Horizontal subnav (auto-hide on scroll) + stacked full-width bands; rows wrap via existing `SettingsRow` ≤480px wrap; `child` indent shrinks to `space-2`. |
| `600–767px` | Same bands, roomier row padding; selects keep stacked full-width. |
| `≥768px` (dialog) | Vertical sidebar + labels; identical band grammar, `space-6` gaps. |
| `≥840px` | Resources `lookupColumn` side-by-side (existing `@container ≥860px` rule kept). |

## States

- **default/hover** — rows flat; interactive list rows hover `derived.light.color-surface-hover`/`derived.dark.color-surface-hover`.
- **focus-visible** — `derived.light.shadow-focus`/`derived.dark.shadow-focus` ring on all controls (unchanged atoms).
- **disabled** — toggle/select `disabled` unchanged; blocked rows keep `divider`.
- **error** — `Alert` variants unchanged.
- **empty** — `EmptyState` inside the same `SettingsSection` band (resources-no-profile case).
- **reduced-motion** — `sectionEnter` animation gated under `prefers-reduced-motion` like today.

## i18n

- **Zero new keys required** — existing `settings.*.hint` strings render inline (same message id, different surface).
- Title-level hints (`settings.dictionaryPopup.saveHint`, `settings.wordBadge.hint`) stay as `HintIcon`s.
- If a later section needs a *new* description string, the key goes in `settings.*.desc` in `en.json` + `vi.json` (spec data rule).

## Anti-patterns avoided

- No card-box chrome on sections (AC-1) — bands, not boxes.
- No second sub-heading recipe — `SettingsGroup` is the only "group title" (AC-3).
- No per-section row wrapper — `SettingsRow` anatomy only (AC-4).
- No ⓘ-only info rows — primary help visible inline (AC-5).
- No new color/spacing/type literals — token lint must pass on every touched file (AC-6); sweep residual literals in touched panels (NFR-1).
- No shadow-DOM-unsafe listeners; no `window`-scoped assumptions; Escape via `pushEscapeLayer` unchanged.

## Mockup

`src/entrypoints/mockup-settings-tab-redesign/` — mounts the real `SettingsDialogContent` (baseline) next to the redesigned band anatomy applied to representative sections (General, Downloads, Keyboard Shortcuts, Sync, Dictionary Popup) with viewport (320/600/840) + theme (light/dark) switchers. Open `http://localhost:5173/src/entrypoints/mockup-settings-tab-redesign/`.
