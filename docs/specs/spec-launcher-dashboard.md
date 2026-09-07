# Spec: Launcher Dashboard — Liquid Glass Prototype Entrypoint

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

> Intent: prototype a full-screen Liquid Glass launcher for Cell to validate the `liquid-glass-concept.md` language on a real page before applying it to popup/sidepanel/options.  
> Status: Draft for plan approval  
> Confirmed: 2026-08-30

---

## Objective

Build a new Vite entrypoint `launcher-dashboard` that renders a standalone launcher screen:

- A **search bar** (pill glass) at the top.
- A **grid of glass tiles** (squircle) representing Cell features: Dictionary, Subtitle Manager, Settings, History, Reader, Local Player, Help.
- A **floating user/action bar** at the bottom with 3-5 circular glass icon buttons (Profile, Theme, Settings, Add).
- A **responsive background** (gradient + subtle animated mesh) so glass layers show their translucency.
- An **interactive demo**: hover/press states, click feedback, light/dark mode toggle, preset switcher.

This entrypoint serves as the **canonical Liquid Glass reference implementation** for popup/sidepanel/options redesigns. It is not wired to the extension manifest yet; it runs via `vite dev` and the design-system showcase pipeline.

### User stories

1. **As a designer/PM**, I can open `http://127.0.0.1:5173/launcher-dashboard.html` and see the full Liquid Glass vocabulary in one screen.
2. **As a developer**, I can copy the tile/search-bar/user-bar component patterns into `src/shared/ui/` for reuse.
3. **As a QA**, I can run `npm run test:e2e` against this page to verify glass contrast, touch targets, and reduced-motion/transparency behavior.
4. **As a maintainer**, I can adjust all glass values in `tokens.json` and see them reflected immediately.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 19 + TypeScript | Existing stack. |
| Build | Vite 8 | CRX plugin already handles entrypoints; add `launcherDashboard` to `rollupOptions.input`. |
| Styling | CSS Modules + `tokens.css` | SSOT tokens, no hardcoded values. |
| Components | Reuse `src/shared/ui/{Button, IconButton, Card, Input, SearchField}`; add local `Launcher*` molecules. |
| State | Local React state | No global store needed for prototype. |
| Assets | Unsplash-style gradient image (committed) or CSS conic gradient | Avoid external network at build time. |

---

## Commands

```bash
# Dev server for launcher only
npx vite --config vite.config.ts

# Build all entrypoints (includes launcher)
npm run build

# Run design-system showcase server (if we also expose launcher via showcase)
npm run design-system:dev
npm run build:design-system

# Typecheck / lint / test
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
```

---

## Project Structure

### New files

```
src/entrypoints/launcher-dashboard/
├── index.html              # HTML shell, viewport-fit, no chrome UI
├── main.tsx                # Mount React, set initial theme/preset, import tokens
├── App.tsx                 # Root layout: background, header, grid, user bar
├── App.module.css          # Page-level grid, responsive padding, safe-area
├── components/
│   ├── LauncherTile.tsx          # Squircle glass tile with icon + label
│   ├── LauncherTile.module.css   # Tile glass surface, hover/press, focus ring
│   ├── LauncherSearchBar.tsx     # Pill glass search input with icon + clear
│   ├── LauncherSearchBar.module.css
│   ├── LauncherUserBar.tsx       # Floating bottom bar with icon buttons
│   ├── LauncherUserBar.module.css
│   ├── LauncherBackground.tsx    # Animated gradient/mesh background
│   ├── LauncherBackground.module.css
│   └── LauncherThemeToggle.tsx   # Light/dark/preset toggle (for demo)
├── data/
│   └── launcherTiles.ts    # Static tile metadata (icon, label, route/empty)
└── types.ts                # TileItem, Preset types
```

### Files to modify

```
vite.config.ts
  └── Add `launcherDashboard: resolve(__dirname, 'src/entrypoints/launcher-dashboard/index.html')` to rollupOptions.input.

docs/2-architechture-system.md
  └── Add `src/entrypoints/launcher-dashboard/` under entrypoints tree + function index.

docs/0-wiki.md
  └── Add `docs/specs/spec-launcher-dashboard.md` to specs list.

public/manifest.json
  └── Optional: add entry to `chrome_url_overrides` or `side_panel` only when promoting from prototype to production. NOT required for prototype.
```

---

## Code Style

### React component example (`LauncherTile.tsx`)

```tsx
import { Icon } from '@/shared/icons';
import { Pressable } from '@/shared/ui';
import styles from './LauncherTile.module.css';

export interface LauncherTileProps {
  icon: string;
  label: string;
  onClick?: () => void;
}

export function LauncherTile({ icon, label, onClick }: LauncherTileProps) {
  return (
    <button type="button" className={styles.tile} onClick={onClick}>
      <span className={styles.icon}>
        <Icon name={icon} size={28} />
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
```

### CSS module example (`LauncherTile.module.css`)

```css
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  aspect-ratio: 1;
  padding: var(--space-3);
  border: none;
  border-radius: var(--radius-2xl); /* squircle */
  color: var(--color-text-primary);
  background: var(--color-glass-surface);
  backdrop-filter: blur(var(--blur-md)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--blur-md)) saturate(150%);
  box-shadow:
    inset 0 0 0 1px var(--color-glass-border),
    var(--shadow-liquid-md);
  text-align: center;
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out),
              background-color var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .tile:hover {
    background: var(--color-glass-surface-hover);
    transform: translateY(calc(var(--space-0-5) * -0.5));
    box-shadow: var(--shadow-liquid-lg);
  }
}

.tile:active {
  transform: scale(var(--press-scale));
}

.tile:focus-visible {
  outline: var(--space-0-5) solid var(--color-border-focus);
  outline-offset: var(--space-0-5);
}

.icon {
  color: var(--color-text-primary);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}
```

### Conventions

- **Named exports only.**
- **No hardcoded px / hex / radius.** All values come from `tokens.css`.
- **Glass layers:** use `backdrop-filter` + `background` token + inset `box-shadow` for rim light.
- **Touch targets:** tile min-size `88×88px` mobile, `96×96px` tablet, `120×120px` desktop.
- **Icon-first controls** per `liquid-glass-concept.md` §7.3.

---

## Testing Strategy

| Level | Framework | Location | What to test |
|---|---|---|---|
| Unit | Jest + React Testing Library | `src/entrypoints/launcher-dashboard/*.test.tsx` | Tile render, search filter, theme toggle state. |
| E2E | Playwright | `e2e/launcher-dashboard.spec.ts` | Page loads, all tiles visible, search filters, hover/press, reduced-motion/transparency, contrast, touch target size. |
| Visual | Manual + Playwright screenshot | `e2e/__snapshots__/launcher-dashboard/` | Light/dark/preset variants at 375/768/1280px. |
| Performance | Chrome DevTools Performance | Manual | 60fps scroll, no jank with 3 glass layers. |

### Acceptance tests (AT)

1. **AT1 — First glance:** Within 3s, user sees search bar, feature grid, and bottom action bar.
2. **AT2 — Search:** Typing "sub" filters tiles to "Subtitle Manager" (max 3 keystrokes from focus).
3. **AT3 — Responsive:** 375px shows 2-column grid; 768px shows 3-column; 1280px shows 4-column; 1920px shows 6-column.
4. **AT4 — Glass legibility:** All tile labels have contrast >= 4.5:1 against default background on light and dark mode.
5. **AT5 — Accessibility:** `prefers-reduced-motion` disables press spring; `prefers-reduced-transparency` makes glass opaque; focus ring visible and logical.
6. **AT6 — Performance:** No frame drop during scroll; max 3 glass layers on screen; `backdrop-filter` blur within budget.
7. **AT7 — No glass-on-glass:** Bottom user bar over tiles is accepted (1 Clear layer on top of Regular tiles), but input inside search bar is not glass-on-glass.

---

## Boundaries

### Always do
- Use tokens from `tokens.css`; regenerate via `npm run build` if new tokens added.
- Reuse `src/shared/ui/{Button, IconButton, Card, Input, SearchField}` where shape matches.
- Wrap app in `ThemeProvider` and set `data-theme`/`data-preset` on `<html>` before React hydrate.
- Test with `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Keep tile content text-only or icon+text; no complex nested components in v1.

### Ask first
- Add new entrypoint to `public/manifest.json` (chrome_url_overrides / side_panel).
- Add new `tokens.json` entries not already listed in `liquid-glass-concept.md` §13.
- Add external image/gradient asset > 50KB.
- Promote launcher from prototype to real popup/sidepanel/options homepage.

### Never do
- Hardcode colors, px, or radii.
- Add a new npm dependency without bundle-size check.
- Use `any` (ESLint forbids it).
- Apply glass to content list/table or text body.
- Animate `backdrop-filter` or `filter` directly.
- Use default exports.

---

## Success Criteria

All must be true to ship the prototype:

1. `npm run typecheck` passes.
2. `npm run lint` passes.
3. `npm run build` passes and emits `dist/launcher-dashboard.html`.
4. `npm run test:unit` passes for new unit tests.
5. `npm run test:e2e` passes for `e2e/launcher-dashboard.spec.ts`.
6. Launcher renders identically in Chrome, Edge, Brave, Safari 16+, Firefox 103+ at breakpoints 375/768/1280/1920px.
7. Contrast ratio >= 4.5:1 for tile labels in light and dark mode.
8. No glass-on-glass violations beyond the accepted bottom-bar-over-tiles case.
9. Reduced-motion and reduced-transparency media queries produce usable fallback UI.
10. Performance: 60fps scroll on a Snapdragon 665 equivalent or benchmark >= 200k.

---

## Open Questions

1. Should the launcher background be a committed image, a CSS-only conic gradient, or a video? (CSS-only avoids network/build asset bloat.)
2. Should the tile click navigate to an existing entrypoint (e.g. sidepanel) or just log to console for the prototype? (Prototype: console log + visual press feedback.)
3. Should the user bar include a real theme/preset switcher or only a placeholder toggle? (Include working switcher for demo value.)
4. Do we add this page to the design-system showcase gallery, or keep it as a separate entrypoint? (Start as separate entrypoint; optionally register in showcase gallery after v1.)

---

## Implementation Plan (5 phases)

1. **Phase 1 — Boilerplate** (1 file group)
   - Add `launcher-dashboard` entrypoint files (`index.html`, `main.tsx`, `App.tsx`, `App.module.css`).
   - Register in `vite.config.ts`.
   - Verify `vite dev` opens the page.

2. **Phase 2 — Background + layout** (2 file groups)
   - `LauncherBackground` + responsive grid/padding.
   - No glass yet; prove layout at all breakpoints.

3. **Phase 3 — Glass tiles** (3 file groups)
   - `LauncherTile`, `LauncherSearchBar`, tile data.
   - Apply glass tokens and states.

4. **Phase 4 — User bar + theme toggle** (2 file groups)
   - `LauncherUserBar`, `LauncherThemeToggle`.
   - Light/dark/preset switching.

5. **Phase 5 — Tests + verification** (2 file groups)
   - Unit tests, Playwright spec, visual screenshots.
   - Run `npm run typecheck`, `lint`, `build`, `test:unit`, `test:e2e`.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `backdrop-filter` performance poor on low-end Android | High | Enforce blur budget (8/12/16px); max 3 glass layers; test on `mock` low-end profile. |
| Cross-browser differences in glass rendering | Medium | Test Chrome/Edge/Brave/Safari/Firefox; use `-webkit-backdrop-filter` and solid fallback. |
| Glass-on-glass visual clutter | Medium | Strict material-tier rules; user bar is only Clear/Thin layer over Regular tiles. |
| Token not yet in `tokens.json` | Low | Add `color-glass-thin`, `color-glass-thick`, `shadow-liquid-*` in `tokens.json` Phase 1. |

---

## References

- `docs/design-system/liquid-glass-concept.md` — design language.
- `docs/design-system/liquid-glass-critique.md` — review findings and Option D verdict.
- `src/shared/styles/README.md` — token usage.
- `src/shared/ui/` — reusable components.
- `vite.config.ts` — entrypoint registration pattern.

---

*Generated with [Devin](https://devin.ai) using `spec-driven-development` skill.*
