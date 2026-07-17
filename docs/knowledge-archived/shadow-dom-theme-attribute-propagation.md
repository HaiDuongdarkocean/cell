# Theme attribute không truyền vào Shadow DOM — detect + set bên trong

> **Principle**: [Isolated DOM needs explicit theme propagation](principles.md#isolated-dom-needs-explicit-theme-propagation)

## Problem

After integrating `tokens.css` (with `[data-theme="dark"]` selectors) into the Dictionary Popup's Shadow DOM, dark mode didn't work — the popup always rendered in light mode regardless of the user's theme setting.

## Root causes

`tokens.css` has two blocks:

```css
:root { --color-background: #ffffff; ... }        /* light (default) */
[data-theme="dark"] { --color-background: #1a1a1a; ... }  /* dark override */
```

In `popupShell.ts`, `:root` was remapped to `:host` — so light tokens applied. But `[data-theme="dark"]` selector matches elements with `data-theme="dark"` attribute. **No element inside the Shadow DOM had `data-theme` set.**

The host page's `<html data-theme="dark">` doesn't propagate into Shadow DOM — shadow boundary blocks attribute inheritance. `data-theme` is not an inherited property (unlike `color`, `font-family`); it's just an attribute selector match.

So: `[data-theme="dark"]` selector inside Shadow DOM matched nothing → dark tokens never applied → popup stuck on light.

## Fix

**Detect theme from `chrome.storage.local.themeMode`** (the source of truth, same as React `ThemeProvider`):

```ts
private async refreshTheme(): Promise<void> {
  if (!this.container) return;
  const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_MODE);
  if (!this.container) return; // re-check after await — destroy() may have nulled it
  const mode = data[STORAGE_KEYS.THEME_MODE] as 'light' | 'dark' | 'system' | undefined;
  const resolved = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : (mode ?? 'dark'); // DEFAULT_THEME_MODE = 'dark'
  this.container.setAttribute('data-theme', resolved);
}
```

**Set `data-theme` on container (inside Shadow DOM)** — the container is a child of the shadow root. `[data-theme="dark"]` selector in the injected `tokens.css` matches it → dark tokens cascade to all children.

**Sync initial from `prefers-color-scheme`** (avoid FOUC) → async-correct from storage:

```ts
private initTheme(): void {
  // Sync — no await, no FOUC
  const syncDefault = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  this.container.setAttribute('data-theme', syncDefault);
  // Async — correct from storage
  this.refreshTheme();
  // Listeners for real-time switching
  onStorageChanged(onThemeChange);       // user toggled in settings
  mql.addEventListener('change', onSystemChange);  // OS theme changed
}
```

**Two listeners for real-time switching:**
1. `chrome.storage.onChanged` → user changes theme in settings panel → `refreshTheme()`
2. `matchMedia('prefers-color-scheme: dark')` `change` event → OS theme changes (matters when `mode='system'`) → `refreshTheme()`

**Cleanup in `destroy()`** — both listeners removed via `themeCleanup()`.

**Race condition guard** — `refreshTheme()` re-checks `this.container` after `await getStorage()`. If `destroy()` nullified `this.container` during the async gap, the function exits without throwing. Without this guard: `TypeError: Cannot read properties of null (reading 'setAttribute')`.

## Key insight

Shadow DOM blocks attribute inheritance — `data-theme` on `<html>` doesn't propagate into shadow boundary. Theme-aware Shadow DOM components must detect theme from the source of truth (storage / media query) and set `data-theme` on an element **inside** the shadow tree. The CSS selector `[data-theme="dark"]` then matches that inner element and tokens cascade to shadow children.

## Verification

7 new tests in `popupShell.test.ts`:

```
theme integration
  ✓ sets data-theme on container synchronously (no FOUC)
  ✓ applies dark mode from chrome.storage.local.themeMode
  ✓ applies light mode from chrome.storage.local.themeMode
  ✓ defaults to dark when themeMode absent in storage
  ✓ re-resolves when storage.onChanged fires for themeMode
  ✓ ignores storage.onChanged for unrelated keys
  ✓ removes storage.onChanged listener on destroy

Test Suites: 1 passed, 1 total
Tests:       48 passed, 48 total
```

Full suite: 3126 passed. Build: OK.
