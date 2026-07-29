# ADR-075 — Content-script UI rendered by React inside Shadow DOM

## Status

Accepted — Phase 1a CSS injection PoC validated (`?inline` works for CSS module in shadow root). Phase 1b infrastructure and Phase 1c fixed overlay PoC still pending.

**Supersedes:** ADR-038 (Popup Dictionary Shadow DOM + Vanilla DOM)
**Related:** ADR-022, ADR-024, ADR-025, ADR-031, ADR-038, ADR-061, ADR-065, ADR-071

## Context

Cell is a Chrome extension (MV3) that injects UI into web pages:
- Subtitle overlays + nav cluster + manager/offset/toast panels on video players.
- Orbital badge, popup dictionary, tokenize word badges + FAB, card creator, settings dialog, universal panel, word highlight overlay.
- Most content-script UI currently written in vanilla DOM + CSS; một số (card creator, settings, universal panel) đã là React nhưng mount trong light DOM.

Not every UI element can live in a shadow root:
- **Token span / word highlight overlay** must wrap host page text nodes, so they remain in light DOM and are styled by a dynamically injected stylesheet (`tokenSpanCss.ts`).

Popup, sidepanel, and options pages already use React + `src/shared/ui/` components. When features move between contexts (e.g., popup dictionary → UniversalPanel, card creator → shadow DOM), the UI must be rewritten, causing:
- Duplicate code.
- Visual drift between content-script and popup versions.
- High maintenance cost.

ADR-038 previously chose vanilla DOM for popup dictionary to avoid React bundle size in content-script. Since then:
- `UniversalPanel` (React) has proven React runtime in content-script is acceptable.
- `tokens.json` and `tokens.css` provide a stable design-token SSOT.
- `src/shared/ui/` has 25+ reusable components.
- `design-system-showcase` needs a way to render content-script components too.

## Decision

We will render all **chrome UI containers** with React components and mount them into **Shadow DOM**. Text-level decoration (token spans, word highlight overlay) stays in the host page light DOM because it must anchor to existing text nodes.

This means:
1. A single React component is used for popup, sidepanel, options, content-script, and `design-system-showcase`.
2. Content-script chrome UI mounts the component into a shadow root attached to a host element.
3. Shadow DOM provides CSS isolation: host page CSS cannot override Cell, and Cell CSS cannot leak out.
4. `tokens.css` (design tokens) and component CSS modules are injected into the shadow root.
5. Token spans and word highlight use a scoped light-DOM stylesheet derived from `tokens.css`; we accept a small risk of host-page override here.

## Why this approach

| Alternative | Rejected because |
|---|---|
| Keep vanilla DOM in content-script | Duplicate UI code, visual drift, hard to maintain. |
| React root on host `div` (no shadow) | Host page CSS overrides Cell styles; we have observed Netflix/YouTube global resets breaking UI. |
| Web Components as wrapper | Adds abstraction; still requires React runtime; props through attributes are awkward for complex state. |
| Pre-rendered HTML + CSS | Cannot reuse React components; back to duplicate templates. |

## Technical design

### 1. Mount helper

`src/shared/lib/shadowRoot/mountReactShadow.ts`:
- Create a host `div`.
- `host.attachShadow({ mode: 'open' })`.
- Inject CSS into shadow root.
- `createRoot(rootEl).render(<ShadowThemeProvider host={host}><Component /></ShadowThemeProvider>)`.
- Return `unmount()`.

### 2. CSS injection

CSS must be injected into the shadow root. After Phase 1a PoC we validated:

- **Option A — `*.module.css?inline` + manual `<style>` injection:**
  - `import buttonCss from './Button.module.css?inline'` returns the processed CSS string with the same hashed class names the React component uses.
  - Host page CSS cannot cross the shadow boundary.
  - This is the chosen mechanism for component styles.

- **Option B / C (Constructable StyleSheets / single bundle):** Not needed for the PoC; `?inline` is sufficient per component.

Implementation:
- `tokens.css?raw` is the base token layer. Generated `tokens.css` keeps static tokens on `:root` and default color tokens on `:root`; the static `@media (pointer: coarse)` block also stays on `:root`. When the file is injected into a shadow root we replace `:root` with `:host` so the variables apply to the shadow host.
- `components.css?raw` is the legacy global utility layer (to be removed after migration).
- Each feature component imports its own `*.module.css?inline` and appends it to the shadow `<style>` element.
- `tokens.css` `:root` selector is replaced with `:host` before injection.

### 3. Theme

`ShadowThemeProvider` wraps `ThemeProvider` with a `container` prop:
- `ThemeProvider.container` defaults to `document.documentElement` for popup/sidepanel.
- In content-script, `ShadowThemeProvider` passes the shadow host as `container`.
- `applyTheme(mode, config, target)` sets CSS vars and `data-theme` on the target.

Content-script does **not** boot a separate `themeStore`; it reuses `themeTokens.ts` injection and syncs `data-theme` on the shadow host.

### 3.1 Z-index and host ordering

Multiple shadow hosts can coexist. `mountReactShadow` exposes a numeric `layer` option that is mapped to `z-index: layer * 100` on the host. The contract is:
- Each feature owns a layer range: subtitles + nav cluster (1), popup dictionary (2), tokenize badge + panel (3), card creator (4), settings (5), universal panel (6).
- Hosts are appended to `document.body` in mounting order; `z-index` resolves stacking for positioned hosts.
- Components that need to escape the shadow host (e.g. fixed overlay) are `position: fixed` on the host itself, not on internal elements, so the host creates the stacking context.

### 4. Events and focus

Shadow DOM retargets events and `document.activeElement`. We will:
- Use `event.composedPath()` for click-outside detection.
- Use `getRootNode().activeElement` for focus trap.
- Add `aria-*` attributes and `role` to content-script interactive components.

### 5. Portals

Current codebase has **0 `createPortal`**. We will not build a generic portal container abstraction until a component actually needs it (YAGNI). If needed later, a `PortalContainerContext` will provide a container inside the shadow root.

### 6. Data flow

Content-script logic (cue detection, lookup, etc.) dispatches events to Zustand stores; React components subscribe to stores. Example:

```
Content-script cue detector
    → CustomEvent('cell:cues:updated')
    → cuesStore.setCues()
    → SubtitleBlock re-render
```

## Consequences

### Positive

- One React codebase for all UI contexts.
- `design-system-showcase` automatically previews content-script components.
- CSS isolation removes site-specific defensive hacks.
- Theme, tokens, and components stay in sync.

### Negative / Risks

1. **Bundle size** — React runtime + CSS in content-script. Mitigation: lazy-load optional UIs (popup dictionary, card creator); share one shadow root for subtitle+nav+tokenize.
2. **Performance** — multiple React roots + shadow roots. Mitigation: measure baseline; use `React.memo`; batch cue store updates; consider Constructable StyleSheets.
3. **Focus/event retargeting** — requires careful hooks. Mitigation: `useShadowFocusTrap`, `composedPath()`.
4. **CSS module injection in shadow root** — not a default Vite path. Mitigation: PoC in Phase 1a validated `?inline`.
5. **Feature parity** — popup dictionary vanilla có toolbar 4 tab, resize, anchor positioning; React `DictionaryTab` thiếu. Mitigation: port từ vanilla, dùng chung `DictionaryCore`.
6. **Z-index / host ordering** — nhiều shadow host trên cùng trang, DOM order và `z-index` cần contract rõ. Mitigation: ADR-024/031/061/065, `mountReactShadow` nhận layer/z-index.
7. **Light-DOM token spans** — host page CSS có thể override style. Mitigation: dùng token CSS var, đoạn text chọn kỹ, giữ `TOKEN_STYLE_ID` idempotent.
8. **Fixed overlay in shadow root** — `mountCardCreatorDialog.ts` hiện tại cố tình tránh shadow root vì sợ `position: fixed` bị trap trong stacking context của shadow host. Mitigation: Phase 1b chạy PoC dialog/panel trong shadow root trên YouTube fullscreen; nếu thất bại, card creator/settings/universal panel ở lại light DOM với class prefix `cell-` + local reset.

## Rollout plan

See `docs/specs/content-script-react-shadow-root.md` for 10 phases + sub-phases. Key gates:
- Phase 1a: PoC CSS module in shadow root.
- Phase 1b: mount helper + theme + event model.
- Phase 2: subtitle + nav cluster (single shared shadow root).
- Phase 3: orbital badge (split into gesture / React shell / mount).
- Phase 4-8: popup dictionary, tokenize, card creator, settings, universal panel.
- Phase 9: design-system-showcase auto-discovery.

Each phase keeps old code behind a feature flag until the new UI passes build, unit tests, and manual tests on YouTube/Netflix/GeeksforGeeks.

## Baseline metrics (pre-migration)

Captured after Phase 0c token cleanup, before Phase 1 begins.

| Metric | Value |
|---|---|
| Main content-script JS (`dist/assets/content-script.ts-*.js`) | 248.54 kB / 62.32 kB gzip |
| Content-script CSS (`dist/assets/content-script-*.css`) | 27.98 kB / 4.39 kB gzip |
| React vendor chunk (`dist/assets/react-vendor-*.js`) | 189.63 kB / 59.65 kB gzip |
| Content-script IIFE helpers (`dist/src/entrypoints/content/`) | 13 KB total |
| Design-system showcase (`docs/design-system/`) | 804 KB total |
| Total `dist/` | 78 MB (includes sql-wasm.wasm 659.73 kB) |
| YouTube 10 min idle RAM | TBD — requires manual Chrome DevTools run |

## References

- Spec: `docs/specs/content-script-react-shadow-root.md`
- Intent: `docs/intent/content-script-react-shadow-root.md`
- Design system standard: `src/shared/styles/STANDARD.md`
- Previous ADR: `docs/adr/038-popup-dictionary-shadow-dom-vanilla-dom.md` (superseded)
- Theme: `docs/adr/022-port-theocean-theme-system.md`
- Fullscreen/theme boundary: `docs/adr/024-portable-theme-boundary.md`
- Subtitle block: `docs/adr/025-subtitle-block-unified.md`
- Z-index: `docs/adr/031-netflix-ui-z-index-fix.md`
- Orbital settings: `docs/adr/061-orbital-settings-dialog.md`
- Universal panel: `docs/adr/065-universal-orbital-panel.md`
- Reduced motion: `docs/adr/071-motion-standardization-and-reduced-motion.md`
