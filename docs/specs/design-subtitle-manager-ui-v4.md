# Design Spec: Subtitle Manager UI v4

## Source
`docs/mockups/subtitle-selector-mockup.html` — Design Mockup v4 (ADR-014 enhancement).

## Goal
Make the content-script subtitle UI match the mockup pixel-by-pixel (as much as possible within the current theme-token system). Keep accessibility, keyboard support, and all existing behavior.

## Scope
Content-script overlay only:
- Top-left toolbar (import button + manager icon)
- Subtitle Manager panel (header, collapsible sections, radio-style items)
- Toast (bottom-center, check icon)
- Target/Native subtitle text overlays (positioning)

Out of scope: popup, sidepanel, settings, background logic.

Note: The active chip was removed by design. Active subtitle selection is
visible in the manager panel, not in a compact toolbar chip.

## Design Tokens
Use existing CSS custom properties from `themeTokens.ts`. Map mockup tokens to the closest existing token:

| Mockup token | Existing token | Notes |
|---|---|---|
| `--color-primary` | `--color-primary` | Target/active accent |
| `--color-warning` | `--color-warning` | Native accent (keep as amber/orange) |
| `--color-success` | `--color-success` | Imported indicator |
| `--color-background` | `--color-background` | Panel background |
| `--color-surface` | `--color-surface` | Toolbar buttons |
| `--color-surface-hover` | `--color-surface-hover` | Hover states |
| `--color-text` | `--color-text` | Primary text |
| `--color-text-secondary` | `--color-text-secondary` | Chip text, secondary |
| `--color-text-muted` | `--color-text-muted` | Close icon, count |
| `--color-border` | `--color-border` | Borders |
| `--color-border-subtle` | `--color-border-subtle` | Section dividers |
| `--font-size-xs` | `--font-size-xs` (12px) | Meta, count, labels |
| `--font-size-sm` | `--font-size-sm` (13px) | Names, panel title |
| `--font-size-base` | `--font-size-base` (14px) | Base |
| `--space-xs` | `--space-xs` (4px) | Gaps |
| `--space-sm` | `--space-sm` (8px) | Toolbar gaps, section padding |
| `--space-md` | `--space-md` (12px) | Item padding |
| `--radius-sm` | `--radius-sm` (6px) | Format badge, radio |
| `--radius-md` | `--radius-md` (8px) | Toolbar buttons, panel |
| `--shadow-md` | `--shadow-md` | Panel shadow |

Z-index: toolbar `1000001`, panel `1000002`, toast `1000003`.

## Components

### 1. Top-left Toolbar
Container: absolute `top: 8px; left: 8px; display: flex; gap: 8px; z-index: 1000001;` inside video container.

Children left-to-right:
1. **Import button** (icon-only)
2. **Manager icon** (icon-only)

#### 1.1 Import button
- Element: `<button type="button" data-testid="subtitle-import-button" aria-label="Import subtitle file">`
- Size: 32x32px
- Style: `border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); cursor: pointer; display: flex; align-items: center; justify-content: center;`
- Icon: upload SVG (24x24 viewBox, stroke icon)
- Hidden `<input type="file" accept=".srt,.vtt,.ass,.ssa" multiple>` inside button for native click handling
- Hover: `border-color: var(--color-border-focus); background: var(--color-surface-hover);`
- Active (file picker open): `background: var(--color-primary-subtle); border-color: var(--color-primary); color: var(--color-primary);` (match mockup)
- Drag-drop target area = whole video container (unchanged behavior)

#### 1.2 Manager icon
- Element: `<button type="button" data-testid="subtitle-manager-icon" aria-label="Subtitle manager" aria-expanded="false">`
- Size: 32x32px
- Style: same as import button, plus `box-shadow: 0 2px 8px rgba(0,0,0,0.4);`
- Icon: subtitle-card SVG (rect + lines)
- Active state (panel open): `background: var(--color-primary-subtle); border-color: var(--color-primary); color: var(--color-primary);`
- Position: left: 112px (right of import button) within toolbar

### 2. Manager Panel
Container: `<div data-testid="subtitle-manager-panel" role="dialog" aria-label="Subtitle manager">`
- Position: absolute `top: 44px; left: 8px; z-index: 1000002;`
- Width: 320px; max-height: 360px; overflow-y: auto;
- Background: `var(--color-background)`; border; border-radius: `var(--radius-md)`; shadow: `var(--shadow-md)`; padding: 4px

#### Header
- Row: flex space-between; padding: 8px 12px; border-bottom: 1px solid `var(--color-border-subtle)`
- Title: "Subtitle Manager", `font-size-sm`, semibold, `var(--color-text)`
- Close button: 20x20, transparent bg, `var(--color-text-muted)`; hover `var(--color-surface-hover)` + `var(--color-text)`. X SVG.

#### Sections (Target, Native)
- Section header: flex row, gap 8px; padding: 8px 12px; cursor pointer; border-radius `var(--radius-sm)`; hover `var(--color-surface-hover)`
- Chevron: 12x12 down arrow; rotate -90deg when collapsed
- Label: uppercase, letter-spacing 0.06em, font-size-xs, semibold
  - Target label color: `var(--color-primary)`
  - Native label color: `var(--color-warning)`
- Label text: `Target · {language}` or `Native · {language}` (e.g. `Target · English`)
- Count: `X subtitles` (font-size-xs, `var(--color-text-muted)`)
- Section body: padding 0 4px; visible when expanded

#### Subtitle item
- Row: flex; gap 8px; align-items center; padding: 8px 12px; cursor pointer; border-radius `var(--radius-sm)`; hover `var(--color-surface-hover)`
- Active state (selected for role):
  - Target: `background: var(--color-primary-subtle); border: 1px solid var(--color-primary);`
  - Native: `background: rgba(245,158,11,0.1); border: 1px solid var(--color-warning);`
  - Padding reduced by 1px to keep size constant
- Radio circle: 14x14; border 2px `var(--color-text-muted)`; border-radius 50%
  - Active: border + background = role color; white dot (4px) centered
- Main column: flex column; gap 2px; flex:1; min-width:0
- Name: `font-size-sm`, medium, `var(--color-text)`, truncate
- Meta row: flex; gap 8px; align-items center; font-size-xs, `var(--color-text-muted)`
  - Format badge: 9px uppercase, background `var(--color-surface-hover)`, padding 1px 5px, border-radius 3px, semibold
  - Size (optional): e.g. "53 KB"
  - Imported indicator: `var(--color-success)`, semibold
  - Role indicator: only on imported items when role differs from detected language? Mockup shows `→ Native` for vi-sub in native section. Implement as `→ {role}` when useful.

### 3. Toast
- Position: absolute `bottom: 30%; left: 50%; transform: translateX(-50%); z-index: 1000003;`
- Container: background `var(--color-background)`; color `var(--color-text)`; border; border-radius `var(--radius-md)`; shadow `var(--shadow-md)`; padding: 8px 12px; font-size-sm, medium
- Content: flex row; gap 8px; align-items center
- Check icon: 16x16, `var(--color-success)`
- Text: "Switched to English #1" or "Imported 2 files → Target + Native"
- Animation: 0.2s ease fade/slide in

### 4. Subtitle Overlay Lines
- Target line: absolute `bottom: 18%; left: 50%; transform: translateX(-50%);` background `rgba(0,0,0,0.85)`; color white; padding 4px 12px; border-radius 6px; font-size 15px; font-weight 500; max-width 85%; text-align center; text-shadow
- Native line: absolute `bottom: 6%; left: 50%; transform: translateX(-50%);` background `rgba(0,0,0,0.7)`; color `#fcd34d` (amber-300); padding 2px 8px; border-radius 6px; font-size 13px; font-weight 400; max-width 85%; text-align center; text-shadow
- Keep existing cue rendering logic, only update CSS.

## Interactions
- Import button click: opens native file picker
- Manager icon click: toggles panel open/close; updates `aria-expanded`
- Close button click: closes panel
- Section header click: toggle collapse/expand of section body; rotate chevron
- Subtitle item click: select item (if selectable) → trigger `onSelect` callback → update active index → toast "Switched to {name}"
- Click outside panel/icon/import: close panel (existing behavior)
- Keyboard: all buttons focusable; Enter/Space activates

## Accessibility
- All buttons have `aria-label`
- Manager icon has `aria-expanded`
- Panel has `role="dialog"` and `aria-label`
- Section headers are clickable but use `<div>` with `role="button"`? Prefer `<button>` styled as header.
- Focus states visible via outline

## File Plan
- `src/content/subtitleManagerPanel.ts`: rewrite to create toolbar + panel according to spec. Keep public API (`icon`, `panel`, `open`, `close`, `updateTarget`, `updateNative`, `destroy`).
- `src/content/subtitleImport.ts`: change `createImportButton` to return icon-only button with hidden file input. Keep drag-drop wiring.
- `src/content/subtitleToast.ts`: create or update toast component with v4 style (check icon, bottom 30%).
- `src/content/subtitleOverlay.ts`: update CSS for target/native line positions (if not already matching).
- `src/content/content-script.ts`: wire icon-only import button and manager panel into toolbar; update toast calls.
- `src/content/themeTokens.ts`: verify tokens exist; add any missing warning tokens if needed.

## Verification Checklist
- [ ] Mockup toolbar rendered in browser (import icon + manager icon)
- [ ] Panel matches mockup (header, sections, items, active states)
- [ ] Toast matches mockup (bottom 30%, check icon)
- [ ] Overlay target/native positions match mockup
- [ ] Dark mode tokens applied correctly
- [ ] No console errors
- [ ] Unit tests pass
- [ ] Keyboard navigation works
