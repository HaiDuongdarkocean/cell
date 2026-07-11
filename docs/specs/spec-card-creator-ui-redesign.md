# Spec — Card Creator UI Redesign

> Redesign the Card Creator dialog to be cleaner, more minimalist, and easier to scan while preserving all existing functionality and the design-system tokens.
> Supersedes the UI section of `spec-card-creator.md` once implemented. Architecture and data flow remain unchanged — see `spec-card-creator.md` and `ADR-026` for those.
> Target mockup: `docs/mockups/anki-card-mockup.html`

## 1. Objective

The current Card Creator mockup is perceived as cluttered, visually noisy, and not "tidy" (`rối mắt`, không tối giản, không gọn gàng). This spec defines a visual redesign that:

- Reduces cognitive load by strengthening visual hierarchy.
- Keeps the same fields and data flow — no feature changes.
- Uses the existing Cell design-system tokens, no new color palette.
- Produces a new `docs/mockups/anki-card-mockup.html` that becomes the implementation source of truth.
- Updates the matching React/CSS implementation in `src/features/cardCreator/ui` and `src/shared/ui`.

## 2. Design principles

Derived from current UI trends (Linear, Notion, Figma, Arc) and material-density research:

1. **Minimalism is organization, not emptiness.** A dense form can be clean if relationships are visually encoded through grouping, spacing, and hierarchy.
2. **One accent per screen.** The primary color is reserved for the main CTA and focus states. Secondary actions are muted.
3. **Surface over shadow.** Use subtle background differences (`--color-card`, `--color-background`, `--color-surface`) instead of heavy borders and bright shadows.
4. **Type hierarchy over decoration.** Section titles should be readable, not uppercase badges.
5. **Spacing carries structure.** More space between sections than between fields; more space between groups than within a group.
6. **Color with purpose.** Warning yellow is a scarce signal; do not use it for full-width alert backgrounds.

## 3. Scope

### In scope

- `docs/mockups/anki-card-mockup.html` — full rewrite with the new design.
- `src/features/cardCreator/ui/CardCreatorDialog.module.css`
- `src/features/cardCreator/ui/FieldRow.module.css`
- `src/features/cardCreator/ui/MediaList.module.css`
- `src/features/cardCreator/ui/CardCreatorDialogContent.tsx` (minor structural changes if needed)
- `src/features/cardCreator/ui/FieldRow.tsx` and `MediaList.tsx` (minor structural changes if needed)
- `src/shared/ui/Dialog.module.css` and `Button.module.css` only if the mockup exposes a token gap.

### Out of scope

- New features (deck defaults, batch create, SRS, etc.).
- Changes to the AnkiConnect flow or media extraction.
- Changes to the subtitle-block entry buttons (icon size bug was already fixed).

## 4. Detailed UI changes

### 4.1 Container / Dialog shell

- Width: keep `max-width: 512px` (design-system `--dialog-max-width`), `min-width: 360px`.
- Padding: `--space-6` (24px) overall.
- Border: `1px solid var(--color-border)`.
- Radius: `--radius-lg` (12px).
- Shadow: `var(--shadow-lg)` only; no double borders or inset shadows.
- Background: `var(--color-background)`; do not use a translucent/blurred background for the panel itself.

### 4.2 Header

- Title: "Card Creator", `font-size-xl` (20px), `font-weight-semibold`, left-aligned.
- No icon before the title unless it is a small, 16px, muted monoline icon.
- Close button: `Button` with `variant="ghost"` `size="sm"`, right-aligned. Use an `×` or close SVG, not a solid `cluster-btn`.
- No separator line under the header; rely on body padding.

### 4.3 Alert

Replace the current bright warning block with a `Notice` style:

- Layout: flex row, 12px gap, icon + text.
- Icon: 16px `info` or `alert-triangle` in `var(--color-warning)`.
- Background: `var(--color-warning-subtle)` (very low opacity).
- Left border: `3px solid var(--color-warning)`.
- Border radius: `--radius-md` (8px).
- Padding: `--space-3` (12px) vertical, `--space-3` (12px) left (including border offset), `--space-3` right.
- Text: `font-size-sm` (13px), `color-text` (not inverse).
- Error variant: swap warning for `var(--color-error)` and `var(--color-error-subtle)`.

### 4.4 Card destination

- Two selects side by side on desktop, stacked on mobile.
- Label above each select, `font-size-xs` (12px), `font-weight-medium`, `color-text-secondary`.
- No boxed section wrapper; use a `section` title "Destination" and a `pair-row` with `gap: --space-4` (16px).

### 4.5 Section titles

- No uppercase, no letter-spacing, no background box.
- Style: `font-size-sm` (13px), `font-weight-semibold`, `color-text`, `margin-bottom: --space-3` (12px).
- Sections separated by `margin-top: --space-5` (20px) or `space-6` (24px).

### 4.6 Field rows

Each field row:

```
┌─────────────────────────────────────────────┐
│ Target word              → TargetWord  ▼   │  ← label row
├─────────────────────────────────────────────┤
│ [input/textarea]                            │  ← value
└─────────────────────────────────────────────┘
```

- Label row:
  - `display: flex; justify-content: space-between; align-items: baseline;`
  - `margin-bottom: --space-1` (4px).
  - Label: `font-size-xs` (12px), `font-weight-medium`, `color-text-secondary`.
  - Field mapping: rendered as a small inline select/badge on the right.
    - Height: 20px, padding 2px 6px, border-radius `--radius-sm` (6px).
    - Background: transparent; border: `1px solid var(--color-border-subtle)`.
    - Text: `font-size-xs` (12px), `color-text-muted`.
    - Hover: background `var(--color-surface-hover)`, border `var(--color-border-focus)`.
    - Chevron: 12px, muted.
    - The select text should be short: e.g. `→ TargetWord` or just `TargetWord` with a small `arrow-right` icon.

- Input / Textarea:
  - Border: `1px solid var(--color-border)`.
  - Background: `var(--color-background)`.
  - Focus: `border-color: var(--color-border-focus)`, `box-shadow: 0 0 0 3px var(--color-primary-subtle)`.
  - Textarea min-height: 56px (for single-line), 80px for sentence/translation.

- Spacing between fields: `--space-4` (16px).

### 4.7 Media list

Replace the current vertical list of repeated icons with a compact row/chip style:

- Each media item is a horizontal row:
  - Left: thumbnail (for images) or play icon (for audio), 28px × 28px, rounded `--radius-sm`.
  - Middle: filename, `font-size-sm`, `color-text`, truncate with ellipsis.
  - Right: remove button (small ghost icon, 16px `×`).
- Row padding: `--space-1` (4px) vertical, `--space-2` (8px) horizontal.
- Row background: `var(--color-surface)` in dark, `var(--color-muted)` in light, or transparent with a subtle border.
- Add button: `+ Add {kind}` as a small ghost/link style, not a dashed box.
- Empty state: small muted text "No {kind} attached" instead of a full row.

### 4.8 Footer

- Layout: `display: flex; justify-content: space-between; align-items: center;` on desktop.
- Left: "Update mode" label + `Select` (small, width 140px).
- Right: actions in order:
  - `Cancel` — ghost
  - `Add` — secondary
  - `Update` — primary
- On mobile: stack vertically (mode on top, buttons in a row below, each `flex: 1`).
- No border-top unless it is `1px solid var(--color-border-subtle)` and very faint.

### 4.9 Settings connection card

- Keep the same fields, but clean up the status indicator:
  - Card: `var(--color-card)`, border `var(--color-border)`, radius `--radius-md`, padding `--space-3`.
  - Status row: dot (8px) + label + detail + "Test again" button on the right.
  - Dot glow: `box-shadow: 0 0 0 3px rgba(<color>, 0.15)`.
  - Online: green; offline: red; testing: yellow pulse.

## 5. Design-system tokens

Reuse existing tokens only. No new primitive colors. Allowed new component tokens if needed:

- `--notice-warning-bg: var(--color-warning-subtle)`
- `--notice-warning-border: var(--color-warning)`
- `--notice-error-bg: var(--color-error-subtle)`
- `--notice-error-border: var(--color-error)`

If these are not in `themeTokens.ts`, add them as semantic aliases, not new primitives.

## 6. Mockup output

The deliverable `docs/mockups/anki-card-mockup.html` must:

1. Render the desktop workspace (video player + Card Creator panel) and the settings page.
2. Include a dark/light theme toggle.
3. Use only design-system tokens (or `px` lengths for content-script safety as documented in `design-system.md` §6).
4. Show the no-recent-card alert, all 10 fields, populated media lists, and the footer.
5. Be self-contained (single HTML file, inline styles, no external assets except optional Google Fonts).

## 7. Success criteria

- [ ] `anki-card-mockup.html` renders in Chrome and matches the design described in §4.
- [ ] All 10 fields, media lists, alert, destination selects, and footer are visible and aligned.
- [ ] Dark and light themes both look clean and pass a 10-second visual scan.
- [ ] Implementation CSS (`CardCreatorDialog.module.css`, `FieldRow.module.css`, `MediaList.module.css`) matches the mockup.
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] Manual check: open Card Creator on a YouTube page and confirm the dialog is not visually overwhelming.

## 8. Boundaries

- **Always do:**
  - Use design-system tokens.
  - Keep `px` for content-script sizes per `design-system.md` §6.
  - Preserve keyboard shortcuts (`q`, `e`, `Esc`) and ARIA attributes.
- **Ask first:**
  - Changing `Dialog`, `Button`, or `Select` shared components.
  - Adding new dependencies.
- **Never do:**
  - Change the Card Creator data flow or AnkiConnect behavior.
  - Remove fields from the form.
  - Commit secrets or hardcode URLs.

## 9. Open questions

- Should we keep the `10 minutes` alert copy, or change it to the simpler "No existing card found in this deck" wording already used in `CardCreatorDialogContent.tsx`?
- Should media thumbnails show actual image previews (for screenshots) or keep icon-only for the mockup?
- Should the `Add` and `Update` buttons be reordered? Quick-update users may want `Update` as the rightmost primary action.
