# Cell DESIGN.md

> Agent-facing source of truth for UI implementation in Cell.
> Reference `src/shared/styles/STANDARD.md` for full design-system theory and `src/shared/styles/tokens.json` for canonical token values.
> This document is the practical checklist agents must follow before declaring any UI task done.

---

## 1. Golden Rules

1. **Never use Material Design 3 tokens.** No `var(--md-sys-color-*)`. Ever.
2. **Never hardcode colors, spacing, or radii.** Use tokens from `tokens.css`.
3. **Never create ad-hoc components.** Reuse `src/shared/ui/*`; if a component is missing, add it to `src/shared/ui/` first, then use it.
4. **Prototype in the design-system showcase is the final UI.** After user confirmation, the same code integrates into production.
5. **Every UI change must pass the audit commands at the bottom of this file.**

---

## 2. Token Quick Reference

### 2.1 Color tokens (use these, not M3)

| M3 token (FORBIDDEN) | Cell token to use | Usage |
|---|---|---|
| `var(--md-sys-color-surface)` | `var(--color-surface)` | Card/panel background |
| `var(--md-sys-color-surface-container)` | `var(--color-background)` or `var(--color-surface)` | Page/section background |
| `var(--md-sys-color-surface-container-high)` | `var(--color-surface-card)` | Slightly raised surface |
| `var(--md-sys-color-surface-container-highest)` | `var(--color-surface-hover)` | Hover/raised surface |
| `var(--md-sys-color-on-surface)` | `var(--color-text-primary)` | Body text |
| `var(--md-sys-color-on-surface-variant)` | `var(--color-text-secondary)` | Muted text |
| `var(--md-sys-color-primary)` | `var(--color-primary)` | Brand accent |
| `var(--md-sys-color-on-primary)` | `var(--color-text-on-primary)` | Text on primary |
| `var(--md-sys-color-secondary-container)` | `var(--color-secondary)` or `var(--color-primary-subtle)` | Selected/subtle accent |
| `var(--md-sys-color-outline)` | `var(--color-border)` | Default border |
| `var(--md-sys-color-outline-variant)` | `var(--color-border-subtle)` | Subtle divider |
| `var(--md-sys-color-error)` | `var(--color-destructive)` | Error text |
| `var(--md-sys-color-error-container)` | `var(--color-error-subtle)` | Error background |

### 2.2 Spacing scale

| Token | Value | Usage |
|---|---|---|
| `var(--space-0-5)` | 2px | Icon/text gap inside buttons |
| `var(--space-1)` | 4px | Tight internal padding |
| `var(--space-2)` | 8px | Default gap, small padding |
| `var(--space-3)` | 12px | Input padding, row gap |
| `var(--space-4)` | 16px | Card padding, section gap |
| `var(--space-5)` | 20px | Large gap |
| `var(--space-6)` | 24px | Dialog padding |

### 2.3 Radius scale

| Token | Value | Usage |
|---|---|---|
| `var(--radius-pill)` | 9999px | Buttons, inputs, selects, badges |
| `var(--radius-xl)` | 12px | Cards, panels (replaces the old `--radius-card`) |
| `var(--radius-md)` | 6px | Inputs, small cards |
| `var(--radius-sm)` | 4px | Small controls |
| `var(--radius-xs)` | 2px | Chips, tags, micro elements |
| `var(--radius-full)` | 9999px | Deprecated per `STANDARD.md`; use `--radius-pill` |

### 2.4 Typography

| Token | Usage |
|---|---|
| `var(--color-text-primary)` | Body, headings |
| `var(--color-text-secondary)` | Descriptions, metadata |
| `var(--font-size-base)` | Body text |
| `var(--font-size-sm)` | Supporting text |
| `var(--font-size-xs)` | Captions, timestamps |
| `var(--font-weight-medium)` | Labels, metadata |
| `var(--font-weight-semibold)` | Headings, titles |

---

## 3. Component Map

When building any UI, map each element to an existing `src/shared/ui/*` component. If missing, create the component in `src/shared/ui/` first.

| UI element in prototype | Use this component | File |
|---|---|---|
| Button (any) | `Button` | `src/shared/ui/Button.tsx` |
| Icon-only button | `IconButton` | `src/shared/ui/IconButton.tsx` |
| Card / list item container | `Card` | `src/shared/ui/Card.tsx` |
| Text input | `Input` or `InputField` | `src/shared/ui/Input.tsx` |
| Search input | `SearchField` | `src/shared/ui/SearchField.tsx` |
| Toggle switch | `Toggle` | `src/shared/ui/Toggle.tsx` |
| Select dropdown | `Select` | `src/shared/ui/Select.tsx` |
| Slider with label | `SliderRow` | `src/shared/ui/SliderRow.tsx` |
| Copy button | `CopyButton` | `src/shared/ui/CopyButton.tsx` |
| Dialog / modal | `Dialog` | `src/shared/ui/Dialog.tsx` |
| Bottom sheet (mobile) | `BottomSheet` | `src/shared/ui/BottomSheet.tsx` |
| Sidebar | `Sidebar` | `src/shared/ui/Sidebar.tsx` |
| Tabs | `Tabs` | `src/shared/ui/Tabs.tsx` |
| Empty state | `EmptyState` | `src/shared/ui/EmptyState.tsx` |
| Pagination | `Pagination` (to be created) | `src/shared/ui/Pagination.tsx` |
| Kebab / dropdown menu | `Menu` or `Popover` (create if missing) | `src/shared/ui/Menu.tsx` |
| Page heading | `Heading` | `src/shared/ui/Heading.tsx` |
| Text | `Text` | `src/shared/ui/Text.tsx` |
| Stack layout | `Stack` | `src/shared/ui/Stack.tsx` |
| Flex layout | `Flex` | `src/shared/ui/Flex.tsx` |

---

## 4. Layout Rules

1. **Frame-first.** Define the app shell, panels, and cards before styling content.
2. **Surface hierarchy.** Background → surface → card → popover. Never use the same background for a card and its parent.
3. **Concentric radius.** Inner element radius = `max(0, outerRadius - padding)`.
4. **Touch targets.** Mobile 44px, desktop 40px minimum.
5. **Mobile-first.** Design for 320px, then 768px, then 1280px.
6. **No hardcoded px outside the spacing scale.** If a value isn't in `tokens.json`, add it there, don't hardcode.

---

## 5. Hover / State Rules

```css
/* Correct hover */
:hover { background: var(--color-surface-hover); }

/* Correct selected/active */
.selected { background: var(--color-primary-subtle); color: var(--color-primary); }

/* Correct focus */
:focus-visible { box-shadow: var(--shadow-focus); }

/* Correct disabled */
.disabled { opacity: 0.5; pointer-events: none; }
```

**Forbidden:** `var(--color-accent)` for hover. Use `var(--color-surface-hover)`.

---

## 6. Icon Rules

1. Query `src/shared/icons/index.ts` before creating a new icon.
2. Use semantic names, not shapes.
3. Never inline `<svg>` in a component.
4. Sizes: xs=16px, sm=20px, md=24px, lg=32px.

---

## 7. Audit Commands (run before merge)

Run these commands and fix any output before declaring a UI task done:

```bash
# 1. M3 tokens (must be 0)
grep -rn 'md-sys-color' src/ --include="*.css" --include="*.tsx" --include="*.ts" | grep -v "DESIGN.md" | grep -v "\.test\."

# 2. Hardcoded hex colors in CSS (must be 0 outside tokens.css)
grep -rn '#[0-9a-fA-F]\{3,8\}' src/ --include="*.css" --include="*.module.css" | grep -v tokens.css | grep -v "\.test\."

# 3. Hardcoded px outside token scale (must be 0)
grep -rn 'padding:\|margin:\|gap:\|width:\|height:\|border-radius:\|font-size:\|top:\|left:\|right:\|bottom:' src/ --include="*.module.css" | grep -v 'var(' | grep -v '0px' | head -50

# 4. Inline SVG in TSX (must be 0)
grep -rn '<svg' src/ --include="*.tsx" | grep -v src/shared/icons | grep -v Icon.tsx

# 5. Hardcoded z-index (must be 0)
grep -rn 'z-index:' src/ --include="*.css" --include="*.module.css" | grep -v 'var(--z-' | grep -v tokens
```

---

## 8. Prototype → Production Flow

1. Build or redesign the feature in `src/entrypoints/design-system-showcase/`.
2. Use only `src/shared/ui/*` components and `var(--color-*)` / `var(--space-*)` / `var(--radius-*)` tokens.
3. Verify in Chrome with `?mode=light&viewport=320`, `?mode=dark&viewport=768`, `?mode=light&viewport=1280`.
4. Run the audit commands above.
5. User confirms visual.
6. Move the same code into the production feature directory (e.g., `src/features/clipboard/` or `src/entrypoints/clipboard/`).

---

## 9. M3 → Cell Migration Cheatsheet

For the current `ClipboardPage` prototype, replace these tokens immediately:

| In `ClipboardPage.module.css` | Replace with |
|---|---|
| `var(--md-sys-color-surface, #fef7ff)` | `var(--color-surface)` |
| `var(--md-sys-color-on-surface, #1d1b20)` | `var(--color-text-primary)` |
| `var(--md-sys-color-surface-container, #f3edf7)` | `var(--color-background)` |
| `var(--md-sys-color-surface-container-high, #ece6f0)` | `var(--color-surface-card)` |
| `var(--md-sys-color-surface-container-highest, #e6e0e9)` | `var(--color-surface-hover)` |
| `var(--md-sys-color-primary, #6750a4)` | `var(--color-primary)` |
| `var(--md-sys-color-on-primary, #ffffff)` | `var(--color-text-on-primary)` |
| `var(--md-sys-color-secondary-container, #e8def8)` | `var(--color-primary-subtle)` |
| `var(--md-sys-color-outline, #79747e)` | `var(--color-border)` |
| `var(--md-sys-color-outline-variant, #cac4d0)` | `var(--color-border-subtle)` |
| `var(--md-sys-color-error, #b3261e)` | `var(--color-destructive)` |
| `var(--md-sys-color-error-container, #f9dedc)` | `var(--color-error-subtle)` |

Replace hardcoded values:

| Hardcoded | Token |
|---|---|
| `border-radius: 8px` | `var(--radius-lg)` |
| `border-radius: 4px` | `var(--radius-sm)` |
| `padding: 8px 12px` | `var(--space-2) var(--space-3)` |
| `padding: 12px 16px` | `var(--space-3) var(--space-4)` |
| `padding: 10px 16px` | `var(--space-2-5) var(--space-4)` |
| `padding: 6px 10px` | `var(--space-1-5) var(--space-2-5)` |
| `gap: 4px` | `var(--space-1)` |
| `gap: 8px` | `var(--space-2)` |
| `gap: 12px` | `var(--space-3)` |
| `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15)` | `var(--shadow-popover)` |
| `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)` | `var(--shadow-modal)` |

---

## 10. Lifecycle & Contribution Contract

### 10.1 Component/token lifecycle

Every public token, component and pattern in `src/shared/ui/` and `src/shared/styles/tokens.json` must have a status:

| Status | Meaning | Exit/entry gate |
|---|---|---|
| `experimental` | New; proof-of-concept or single-consumer | Needs reuse-gap evidence, owner, showcase, behavior test and human approval to move to `stable`. |
| `stable` | Proven in at least two production features or one proven pattern; safe to reuse | Must have showcase, deterministic Playwright test, documented states, a11y contract and consumer count. |
| `deprecated` | Will be removed; replacement exists or usage dropped to 0 | Needs migration note in `docs/design-system/MIGRATION.md`, deprecation window ≥ one minor release, and a warning in source. |
| `removed` | Deleted in current or next major release | Allowed only after migration window closes and CI proves 0 consumers. |

**Status source of truth:** `docs/design-system/COMPONENT_INVENTORY.json` for components and `src/shared/styles/tokens.json` metadata for tokens.

### 10.2 Contribution requirements

Before adding or changing a public UI primitive, complete the checklist below. The smallest proposal that satisfies the gap wins.

1. **Re-use search first.** Check `src/shared/ui/`, `src/shared/icons/index.ts` and `tokens.json`.
2. **Prove the gap.** A one-line example of why the existing library cannot express the new use case.
3. **Define owner.** One named owner in `docs/design-system/COMPONENT_INVENTORY.json`.
4. **Prototype in showcase.** Add `src/entrypoints/design-system-showcase/pages/*.showcase.tsx` + `.module.css`.
5. **Add evidence.** Unit/behavior test or Playwright E2E; for components add `src/shared/ui/<Name>.test.tsx`.
6. **Run audit commands.** Section 7 of this file must return zero for the new source.
7. **Document decision.** ADR only when the change is hard to reverse (new token family, new layer, breaking API). CSS tweaks and new variants do not need an ADR.

### 10.3 Breaking changes and deprecation

A change is breaking when it:
- removes or renames a public export,
- changes token value semantics (e.g. `--color-error-subtle` now means a different color),
- changes a component prop API or ARIA contract,
- removes a pattern file or e2e contract.

Required for every breaking change:
- Migration note in `docs/design-system/MIGRATION.md` with "from / to / action".
- Deprecation window of at least one minor release.
- `console.warn` or source comment marking the deprecated path.
- No deletion before CI shows 0 consumers inside `src/` and `e2e/`.

### 10.4 When to write an ADR

- New token family, new visual layer, new dependency, breaking API, or a governance/tooling decision.
- NOT for: CSS value tweaks, adding a component variant, renaming a class, or any change reversible in one commit.

### 10.5 Example proposal — dry run

**Proposal:** Add a new `Pagination` component.

| Check | Evidence | Pass |
|---|---|---|
| Re-use search | No existing pagination primitive in `src/shared/ui/` | ✅ |
| Reuse gap | Card list needs numbered page controls; `Button` + `HStack` does not express active/disabled page semantics | ✅ |
| Owner | `owner: "ui-guild"` | ✅ |
| Showcase | `src/entrypoints/design-system-showcase/pages/Pagination.showcase.tsx` | ✅ |
| Tests | `src/shared/ui/Pagination.test.tsx` + Playwright pattern test | ✅ |
| Audit | 0 M3 / hardcoded / px / inline SVG / z-index | ✅ |
| ADR needed? | No — it is a new variant of existing `Button` + `Text` | ✅ |

Result: proposal can enter `experimental` status.
