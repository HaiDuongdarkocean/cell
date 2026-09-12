# Plan: Tokenize Header Redesign — Segmented Pill Group (Style A)

## Context

Universal panel header (`aria-label="Tokenize controls"`) cần redesign theo 2 trục:

1. **Logic fix**: 2 sources (Page + Subtitle) độc lập, 2 display (Status + Frequency) shared + luôn interactive. Display OFF ≠ tokenize OFF.
2. **Visual redesign**: Segmented Pill Group — 2 pill-group bo tròn, active = pill trắng nổi lên + dot primary.

## Design Spec — Style A (Segmented Pill Group)

### Layout
```
[Sources: (Page)(Subtitle)] | [Display: (Status)(Frequency)]    [✕]
```

- 2 pill-group containers, mỗi chứa 2 pill buttons
- Vertical divider (1px) tách 2 nhóm
- Close button (IconButton ghost sm) bên phải, `margin-left: auto`

### Pill spec (exact values from mockup)

| Property | Value |
|---|---|
| Container border | `var(--border-width-hairline) solid var(--color-border)` |
| Container radius | `var(--radius-full)` |
| Container padding | `var(--space-0-5)` |
| Container gap | `var(--space-0-5)` |
| Container background | `var(--color-surface-hover)` |
| Pill padding | `var(--space-1) var(--space-2-5)` |
| Pill radius | `var(--radius-full)` |
| Pill font-size | `var(--font-size-xs)` (12px) |
| Pill font-weight | `var(--font-weight-medium)` |
| Pill color (off) | `var(--color-text-secondary)` |
| Pill color (on) | `var(--color-text-primary)` |
| Pill bg (on) | `var(--color-surface)` |
| Pill shadow (on) | `0 1px 2px rgba(0,0,0,0.08)` |
| Pill font-weight (on) | `var(--font-weight-semibold)` |
| Dot size | `6px` |
| Dot radius | `var(--radius-full)` |
| Dot bg (off) | `var(--color-border-emphasized)` |
| Dot bg (on) | `var(--color-primary)` |
| Divider width | `var(--border-width-hairline)` |
| Divider height | `16px` |
| Divider bg | `var(--color-border)` |

### Dark mode overrides
- `.pill.on` background: `var(--color-surface-hover)` (not `var(--color-surface)`)
- `.pill.on` shadow: `0 1px 2px rgba(0,0,0,0.3)`

### Responsive (<= 480px)
- Header gap: `var(--space-2)`
- Pill font-size: `var(--font-size-2xs)` (10px)
- Pill padding: `var(--space-0-5) var(--space-1-5)`

### Accessibility
- Container: `role="group"` + `aria-label="Tokenize sources"` / `aria-label="Tokenize display"`
- Pill: `role="switch"` + `aria-checked={checked}` + `aria-label={...}` + `title="{Label}: {ON|OFF}"`
- `data-cell-id="universal-panel-header-toggle-{key}"` (giữ nguyên test ID convention)

## Logic Spec

### TokenizePanelState (KHÔNG đổi — giữ nguyên types.ts)
```ts
interface TokenizePanelState {
  readonly enabled: boolean;        // Page source
  readonly showStatus: boolean;     // Display option
  readonly showFrequency: boolean;  // Display option
  readonly subtitleEnabled: boolean; // Subtitle source
}
```

### Toggle mapping (4 keys → 2 groups)
| Group | Key | Label | ariaLabel |
|---|---|---|---|
| Sources | `enabled` | Page | Toggle page tokenize |
| Sources | `subtitleEnabled` | Subtitle | Toggle subtitle tokenize |
| Display | `showStatus` | Status | Toggle status badges |
| Display | `showFrequency` | Frequency | Toggle frequency bands |

### Key behavior change
- **OLD**: Status + Frequency `disabled` when `enabled === false` (master gate)
- **NEW**: ALL toggles always interactive. No `disabled` prop. Display toggles are preferences — apply when source is on, but user can set them anytime.

---

## Task Breakdown — 3 Parallel Subagents

### Task 1: Rewrite UniversalPanelHeader (TSX + CSS)
**Files:**
- `src/features/universalPanel/UniversalPanelHeader.tsx`
- `src/features/universalPanel/UniversalPanelHeader.module.css`

**Subagent profile:** `subagent_general`

**AC:**
1. Component exports `UniversalPanelHeader` (named export, no default)
2. Props interface `UniversalPanelHeaderProps` unchanged (same 3 props)
3. Two pill-group containers with `role="group"`:
   - Sources group: `aria-label="Tokenize sources"`, contains Page + Subtitle pills
   - Display group: `aria-label="Tokenize display"`, contains Status + Frequency pills
4. Each pill = `<button>` with `role="switch"`, `aria-checked`, `aria-label`, `title`, `data-cell-id`
5. Each pill has a `<span class={styles.pillDot}>` before the label text
6. Vertical divider `<span>` between the two groups
7. Close button = existing `IconButton` (ghost sm) with `margin-left: auto`
8. NO `disabled` prop on any pill — all always interactive
9. NO `Toggle` component import — pills are plain `<button>` elements
10. NO `HStack` import — use plain div with flex
11. CSS uses ONLY design system tokens (var(--space-*), var(--color-*), var(--radius-*), etc.)
12. Dark mode override via `[data-theme="dark"]` selector
13. Responsive `@media (max-width: 480px)` — smaller pill font + padding
14. `@media (prefers-reduced-motion: reduce)` — disable transitions
15. `npm run typecheck` passes
16. `npm run build` passes

**Exact TSX structure:**
```tsx
<header className={styles.header} data-cell-id="universal-panel-header">
  <div className={styles.pillGroup} role="group" aria-label="Tokenize sources">
    {SOURCE_ITEMS.map(item => (
      <button
        key={item.key}
        type="button"
        className={`${styles.pill} ${tokenizeState[item.key] ? styles.on : ''}`}
        role="switch"
        aria-checked={tokenizeState[item.key]}
        aria-label={item.ariaLabel}
        title={`${item.label}: ${tokenizeState[item.key] ? 'ON' : 'OFF'}`}
        data-cell-id={`universal-panel-header-toggle-${item.key}`}
        onClick={() => onToggleTokenize(item.key)}
      >
        <span className={styles.pillDot} />
        {item.label}
      </button>
    ))}
  </div>
  <span className={styles.groupDivider} />
  <div className={styles.pillGroup} role="group" aria-label="Tokenize display">
    {DISPLAY_ITEMS.map(item => /* same pill structure */)}
  </div>
  <IconButton size="sm" variant="ghost" aria-label="Close panel"
    className={styles.closeButton} onClick={onClose}
    data-cell-id="universal-panel-close">
    <Icon name="x" />
  </IconButton>
</header>
```

**Constants:**
```ts
const SOURCE_ITEMS = [
  { key: 'enabled', label: 'Page', ariaLabel: 'Toggle page tokenize' },
  { key: 'subtitleEnabled', label: 'Subtitle', ariaLabel: 'Toggle subtitle tokenize' },
] as const;

const DISPLAY_ITEMS = [
  { key: 'showStatus', label: 'Status', ariaLabel: 'Toggle status badges' },
  { key: 'showFrequency', label: 'Frequency', ariaLabel: 'Toggle frequency bands' },
] as const;
```

---

### Task 2: Fix useTokenize logic
**Files:**
- `src/features/tokenize/ui/useTokenize.ts`
- `src/features/tokenize/ui/useTokenize.test.ts`

**Subagent profile:** `subagent_general`

**AC:**
1. `toPanelState` no longer hardcodes `subtitleEnabled: false` — read from store if available, else `false`
2. `onToggle` handles `subtitleEnabled` key (currently missing — only handles enabled/showStatus/showFrequency)
3. When no store: internal state manages all 4 keys including `subtitleEnabled`
4. When store provided: `subtitleEnabled` toggle updates internal state only (store doesn't have subtitleEnabled — it's URL-based via settings store, managed by content-script)
5. All existing tests pass
6. Add test case: toggling `subtitleEnabled` updates state
7. `npm run test:unit -- useTokenize` passes
8. `npm run typecheck` passes

**Current bug in useTokenize.ts:**
- Line 20: `subtitleEnabled: false` hardcoded — should be `false` only when no store, but when store has subtitle state it should reflect it
- Line 48-56: `onToggle` doesn't handle `subtitleEnabled` key — clicking subtitle toggle does nothing

**Fix approach:**
- `toPanelState`: add optional `subtitleEnabled` param, default `false`
- `onToggle`: add `subtitleEnabled` case — when store provided, only update internal state (content-script handles persistence via `toggleSubtitleTokenize`)
- Add test: `act(() => result.current.onToggle('subtitleEnabled'))` → `state.subtitleEnabled === true`

---

### Task 3: Update showcase page
**Files:**
- `src/entrypoints/design-system-showcase/pages/UniversalPanelPage.showcase.tsx`

**Subagent profile:** `subagent_general`

**AC:**
1. `INITIAL_TOKENIZE` updated: `enabled: true, showStatus: true, showFrequency: true, subtitleEnabled: true` (show all 4 ON for demo)
2. `showcaseMeta.description` updated to reflect new design: "Slide-in side panel with Dictionary + Settings tabs. Header has Segmented Pill Group: Sources (Page + Subtitle) | Display (Status + Frequency). Desktop: vertical tab bar left. Mobile: full-screen with bottom tabs."
3. `handleToggleTokenize` already works (generic key toggle) — no change needed
4. `npm run typecheck` passes

---

## Dependency Graph

```
Task 1 (Header TSX+CSS) ──────────┐
Task 2 (useTokenize logic) ───────┤──→ Build + Verify (sequential)
Task 3 (Showcase page) ───────────┘
```

Tasks 1, 2, 3 are **fully independent** — different files, no shared imports between them.

## Sequential Phase (after all 3 complete)

### Build + Verify
1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run build`
4. Reload extension in Chrome (instance `9d72a7c5` — DO NOT close+spawn)
5. Navigate to `chrome-extension://cnggdebgaglbfchjikompjlfhconopgj/src/entrypoints/design-system-showcase/index.html?showcase=Universal%20Panel%20Page`
6. Screenshot + vision-reader verify:
   - 2 pill groups visible (Sources + Display)
   - Active pills = white bg + dot primary
   - Inactive pills = transparent + dot gray
   - Vertical divider between groups
   - Close button right edge
   - Dark mode toggle works

## Files NOT to touch
- `src/features/tokenize/types.ts` — TokenizePanelState unchanged
- `src/entrypoints/content/content-script.ts` — already wires subtitleEnabled correctly
- `src/features/universalPanel/UniversalPanel.tsx` — props unchanged
- `src/features/universalPanel/mountUniversalPanel.ts` — mount logic unchanged
- `src/shared/ui/Toggle.tsx` — not used anymore in header, but keep for other consumers
