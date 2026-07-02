# Drift Audit Checklist

> Run during Step 4 (enforcement) on every UI-touching PR, and during Step 5 (periodic audit).
> Mark PASS / FAIL per item. Any FAIL = block merge or schedule fix.

## A. Token usage (run on changed CSS files)

- [ ] **PASS / FAIL**: No raw hex colors (`#2563eb`) in production CSS — all colors via `var(--color-*)`
- [ ] **PASS / FAIL**: No raw rgba in production CSS — use `var(--color-*-subtle)` or `var(--color-*-alpha)`
- [ ] **PASS / FAIL**: No raw border-radius (`6px`, `8px`) — use `var(--radius-*)`
- [ ] **PASS / FAIL**: No raw spacing (`12px`, `16px`) in layout — use `var(--spacing-*)`
- [ ] **PASS / FAIL**: No raw font-size — use `var(--font-size-*)`
- [ ] **PASS / FAIL**: No raw font-weight — use `var(--font-weight-*)`
- [ ] **PASS / FAIL**: No token name >3 words (Token Fatigue guard)
- [ ] **PASS / FAIL**: No token referenced but undefined (grep token name in tokens.css)

## B. Atom usage (run on changed component files)

- [ ] **PASS / FAIL**: New component uses existing atoms where behavior matches (don't reinvent IconButton)
- [ ] **PASS / FAIL**: No atom has a `mode` prop that changes behavior (wrong abstraction)
- [ ] **PASS / FAIL**: No atom has slots added for one caller's edge case
- [ ] **PASS / FAIL**: No inline `style={{ color: '...' }}` with hardcoded values — use atom or token
- [ ] **PASS / FAIL**: No `style.cssText` with hardcoded color/radius in content-script DOM — use injected tokens

## C. Cross-runtime (if project has multiple runtime contexts)

- [ ] **PASS / FAIL**: Every runtime context that renders UI receives tokens (import or injection)
- [ ] **PASS / FAIL**: Token mirror file (if any) in sync with tokens.css (run sync test)
- [ ] **PASS / FAIL**: No new runtime context added without token injection plan

## D. Interaction states (every interactive element)

- [ ] **PASS / FAIL**: Every button has `:hover` state
- [ ] **PASS / FAIL**: Every button has `:focus-visible` state (keyboard a11y)
- [ ] **PASS / FAIL**: Every button has `:disabled` state (if applicable)
- [ ] **PASS / FAIL**: Every selectable item has `:active` / `.selected` state
- [ ] **PASS / FAIL**: Hover/focus/active use same tokens across all call sites of same atom

## E. By-design differences (document, don't fix)

- [ ] **PASS / FAIL**: Every intentional visual difference documented with reason (e.g. "dark overlay on video — affordance fits dark video context")
- [ ] **PASS / FAIL**: By-design differences excluded from token-usage check (not counted as inconsist)

## F. Accessibility (WCAG 2.1 AA — delegate detail to frontend-ui-engineering)

- [ ] **PASS / FAIL**: Color contrast ≥4.5:1 for normal text, ≥3:1 for large text
- [ ] **PASS / FAIL**: Interactive elements not color-only (icon + label or aria-label)
- [ ] **PASS / FAIL**: Focus visible (not removed via `outline: none` without replacement)

## Summary

| Section | PASS | FAIL |
|---|---|---|
| A. Token usage | <n> | <n> |
| B. Atom usage | <n> | <n> |
| C. Cross-runtime | <n> | <n> |
| D. Interaction states | <n> | <n> |
| E. By-design | <n> | <n> |
| F. Accessibility | <n> | <n> |

**Verdict**: APPROVED (0 FAIL) / NEEDS_FIXES (list critical FAILs)
