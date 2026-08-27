# ADR-093: StreamFlix Mock Pages Redesign

## Status

Proposed — awaiting build/visual verification before accepted.

## Context

`src/entrypoints/mock-streaming-page/`, `mock-streaming-iframe-page/`, and `mock-iframe-player/` are three entrypoints used to test the extension against different player scenarios:

1. Same-origin `<video>` with VTT blob (`mock-streaming-page`).
2. Top-frame host embedding a cross-origin iframe player (`mock-streaming-iframe-page` → `mock-iframe-player`).
3. Child iframe player (`mock-iframe-player`).

The previous implementation had the following issues:

- Three separate TSX files duplicated the same video list, SRT→VTT helper, metadata, comments, sidebar, and footer.
- `MockStreamingPage.module.css` contained hardcoded colors (`#0f0f1a`, `#6c5ce7`), radii, and spacing instead of using the token SSOT.
- No shared UI components were used; inline SVG, custom controls, and one-off styles were scattered through the files.
- No light/dark mode, no URL parameters for quick testing, and no UI switcher.
- The UI/UX looked unpolished: weak visual hierarchy, dense player controls, inconsistent cards.

The Cell design system (see `docs/design-system/DESIGN.md`, `src/shared/styles/README.md`, `src/shared/styles/tokens.json`) defines a "liquid glass" aesthetic with a neutral-first palette, a single indigo accent, surface lift, content-first layout, and responsive design without re-layout.

## Decision

### 1. One shared `StreamFlixPage` component, three entrypoint files

Move the UI/UX into a single `StreamFlixPage` component that accepts a `mode: 'same' | 'iframe-host' | 'iframe-child'` prop. Each entrypoint's `main.tsx` only imports the component and passes the correct mode.

- Removes duplication across the three files.
- Keeps cross-origin testing valid: `mock-iframe-player` is still served from port 4324 with a different origin.
- One place to change UI that applies to all three scenarios.

### 2. Light / dark mode with URL parameter and UI switcher

- Default to dark (matches a streaming site).
- `?theme=light|dark` for quick test links.
- Toggle in the header that persists to `localStorage`.
- Uses `data-theme` on `<html>` together with `tokens.css`.

### 3. Player / server mode switcher in the server selector area

Instead of a top-level header switch, place the same-origin / cross-origin iframe toggle in the server card under the player. This feels like switching servers on a real streaming site.

- `Same-origin player`
- `Cross-origin iframe`

### 4. Apply the Cell design system: tokens + shared UI + liquid glass

- Uses `tokens.css` for colors, spacing, radius, typography, and motion.
- Uses `Button`, `Card`, `Badge`, `Tabs`, `Breadcrumb`, `Icon`, `IconButton`, `ListItem`, `Select`, `Heading`, `Text`, `Container`, `Flex`, `Avatar` from `src/shared/ui/`.
- Glass header with `backdrop-filter: blur` and token-based translucent surfaces.
- No inline SVG; icons come from `ICON_CATALOG` via the `Icon` component.

### 5. No new dependency

Reuse Vite, React, CSS modules, and the existing shared UI. No animation library was added.

## Consequences

**Positive:**

- Reduced duplication and easier maintenance.
- Consistent look and feel with the Cell design system.
- URL parameters support automated testing.
- Cross-origin iframe test still works.

**Negative / Risks:**

- `scripts/serve-mock-pages.mjs` still serves three separate ports, so the shared component must handle `iframe-child` mode without page chrome.
- Custom video controls remain in `VideoPlayer.tsx` because no `VideoPlayer` shared component exists yet.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Single entrypoint for all three modes | Breaks cross-origin iframe testing (requires different origin/port). |
| Keep three separate TSX files and only restyle | Does not remove duplication; any UI change requires editing three files. |
| Use Material Design 3 tokens | `DESIGN.md` forbids `--md-sys-color-*`; would drift from project identity. |
| Add GSAP / Framer Motion for animations | Unnecessary for a mock test page; increases bundle size. |

## References

- `docs/design-system/DESIGN.md`
- `src/shared/styles/STANDARD.md`
- `src/shared/styles/tokens.json`
- `docs/context/project-context.md`
- `scripts/serve-mock-pages.mjs`
