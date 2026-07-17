# Shadow DOM CSS isolation → inject shared tokens via ?raw

> **Principle**: [Rendering boundary → explicit token injection](principles.md#rendering-boundary--explicit-token-injection)

## Problem

Dictionary Popup (Vanilla DOM + Shadow DOM) used its own `--dp-*` CSS variables and inline styles, creating a "two-world" problem: React components used shared `tokens.css` + `Button.module.css`, but Vanilla DOM components duplicated tokens with different names. Changing a token in `tokens.css` didn't update the popup — they drifted.

## Root causes

Shadow DOM isolates CSS — host page stylesheets don't apply inside shadow boundary. React surfaces import CSS via Vite's CSS loader (CSS Modules, `@import`), but Shadow DOM content scripts can't use that pipeline. The popup defined its own `--dp-*` tokens in an inline `<style>` block, duplicating every color/spacing/radius value from `tokens.css`.

Two issues:
1. **Token duplication**: `--dp-bg: #ffffff` vs `--color-background: #ffffff` — same value, different names, no sync
2. **Button style duplication**: inline `style.padding = '8px'` + `style.borderRadius = '18px'` on every button, no shared class

## Fix

**Single source via `?raw` import** — Vite's `?raw` suffix imports a file as a string. Inject that string into Shadow DOM `<style>`:

```ts
import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';

// In mount():
styleEl.textContent = tokensCss
  .replace(/:root/g, ':host')  // remap :root → :host for Shadow DOM
  + componentsCss
  + popupSpecificCss;
```

**`:root` → `:host` remap** — `tokens.css` defines `:root { --color-*: ... }`. Inside Shadow DOM, `:root` = `<html>` (outside shadow). Remap to `:host` so tokens apply to the shadow host element.

**`[data-theme]` selectors work as-is** — `[data-theme="dark"]` matches any element with that attribute, including elements inside Shadow DOM. No remap needed (unlike `:root`). Just set `data-theme` on the container element.

**Button classes** — `components.css` defines `.icon-btn`, `.icon-btn--sm`, `.icon-btn--active`, etc. Both React (`@import` in `global.css`) and Vanilla DOM (`?raw` injection) use the same file. Change one file → both surfaces update.

**Removed**: all `--dp-*` definitions (120 lines), all inline button styles, all JS hover handlers (CSS `:hover` handles it now).

## Key insight

Shadow DOM CSS isolation means shared design tokens must be explicitly injected as a CSS string. Vite's `?raw` import turns any `.css` file into a string — inject it into Shadow DOM `<style>`, remap `:root` → `:host`, and both React + Vanilla DOM share the same source file. No duplication, no drift.

## Verification

```
npx jest --selectProjects unit --testPathPatterns="popupToolbar|popupShell|popupContent"
Test Suites: 3 passed, 3 total
Tests:       117 passed, 117 total

npm run build → ✓ built in 526ms
```

Grep confirms zero `--dp-*` references remain:
```
grep 'className.*dp-|\.dp-' src/features/dictionaryPopup/ → No matches found
```
