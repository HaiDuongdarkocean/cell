# Implement Checklist — Phase 2

> Run during Phase 2. Three sections: State Matrix, Compliance Check, Pre-ship Gates.

## State matrix

For each component, verify every required state. Missing required state = contract violation.

| Component | loading | empty | error | hover | active | focus | disabled |
|---|---|---|---|---|---|---|---|
| (each) | [ ] skeleton or [ ] n/a | [ ] composed or [ ] n/a | [ ] inline or [ ] n/a | [ ] yes | [ ] yes | [ ] yes (2px ring) | [ ] yes or [ ] n/a |

**State rules:**
- **loading**: skeleton matching final layout shape. No generic spinner. Surface color + subtle shimmer.
- **empty**: composed "getting started". Not blank box, not "No data" alone. Guide user to populate.
- **error**: inline near relevant element. No `window.alert()`, no "Oops!". Direct: "Connection failed. Try again."
- **hover**: color shift to text-primary or subtle bg. No scale on non-interactive.
- **active**: `scale(0.98)` or `translate-y(1px)` via `:active`.
- **focus**: visible ring ≥ 2px accent, 3:1 contrast (WCAG 2.4.13) via `:focus-visible`.
- **disabled**: reduced opacity/muted, `aria-disabled="true"`, no hover, not clickable.

## Compliance check

### Placement
- [ ] Every `functions:` row has a component in code.
- [ ] Each at correct `zone` (primary=above-fold, secondary=supporting, tertiary=buried).
- [ ] Each at correct `priority` (above-fold/below-fold/on-demand).
- [ ] Nav matches `ia:` (type, items, grouping, default tab).
- [ ] No zone/priority move without contract addendum.

### Token
- [ ] Every color from CSS var in `palette:`. No freeform hex (grep `#` in components → 0).
- [ ] Font-family matches `fonts:`. No Inter.
- [ ] Radius matches `shape:`. No mixed systems without documented rule.
- [ ] Spacing uses contract scale. No arbitrary px outside scale.
- [ ] Motion matches `motion:`. No `linear`/`ease-in-out`.

### State
- [ ] Every component has all `states:` implemented.
- [ ] Loading=skeleton, empty=composed, error=inline, focus rings visible 3:1.

### A11y
- [ ] Text contrast ≥ 4.5:1 (WCAG 1.4.3 AA). Large text ≥ 3:1.
- [ ] Focus indicator ≥ 2px perimeter, 3:1 contrast (WCAG 2.4.13).
- [ ] Touch targets ≥ 44x44px (WCAG 2.5.8).
- [ ] ARIA matches contract `a11y:`. Tablist: `role="tablist"`, `role="tab"` `aria-controls`→panel `id`, `role="tabpanel"` `aria-labelledby`→tab `id`.
- [ ] `aria-selected="true"` only on active tab.
- [ ] Keyboard: logical tab order, no traps. Arrow keys in tablist, Tab to panel, Home/End first/last.
- [ ] Skip link present + functional. Alt text on meaningful images, `alt=""` on decorative.

### Anti-slop
- [ ] Zero em-dash (`—`) — grep all files. Zero Inter as font-family default.
- [ ] Zero AI-purple gradient — grep `purple`/`from-purple`. Zero 3-card equal feature row.
- [ ] Zero fake screenshot divs. Zero scroll cues. Zero locale strips. Zero version footers.
- [ ] Eyebrow count ≤ ceil(sectionCount/3). No centered hero when variance > 4 (landing only).

## Pre-ship gates

Run before handing to reviewer.

- [ ] `npm run test:unit` passes. [ ] `npx tsc --noEmit` passes. [ ] `npm run lint` passes.
- [ ] Browser verify via MCP `edge-devtools`/`chrome-devtools`:
  - [ ] Desktop screenshot 1440x900. [ ] Mobile screenshot 375x812.
  - [ ] Active state (focus ring visible). [ ] Empty state. [ ] Error state.
  - [ ] Console log captured (0 errors). [ ] A11y report captured (0 violations).
- [ ] Flow simulation written for each task. [ ] Code diff captured (`git diff`).
- [ ] Evidence package saved to `evidence/<screen>/`.
