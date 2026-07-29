# Implementation Plan: Content-script React + Shadow Root (SSOT)

> **Scope:** planning artifacts only. No source code is changed by this plan.  
> **Inputs read:** `docs/specs/content-script-react-shadow-root.md` (full), `docs/intent/content-script-react-shadow-root.md` (full), `tasks/plan-content-script-react-shadow-root.md` (partial), `.agents/skills/planning-and-task-breakdown/SKILL.md`, `tasks/plan.md`, `tasks/todo.md`, `src/shared/styles/STANDARD.md`, `src/shared/styles/README.md`, `package.json`, `jest.config.ts`, `vite.config.ts`, `src/entrypoints/design-system-showcase/App.tsx`, `src/entrypoints/design-system-showcase/ShadowButtonPoC.tsx`, `src/features/settings/ui/mountSettingsDialog.ts`, `src/features/universalPanel/mountUniversalPanel.ts`, `src/features/cardCreator/ui/mountCardCreatorDialog.ts`, and the relevant `src/features/` source files listed in the inventory.

## 1. Overview

Convert every Cell chrome UI container (subtitle, nav cluster, orbital badge, popup dictionary, tokenize FAB, card creator, settings dialog, universal panel) into a single-source-of-truth React component. Where safe, mount these into an open `ShadowRoot` so host-page CSS cannot override Cell and Cell CSS cannot leak. Text-level decorations (token spans, word highlight overlays) stay in the host light DOM because they must anchor to host text. The same React components must also render in `popup`, `sidepanel`, `options`, and the `design-system-showcase` without edits.

### Goals
- One React component per UI surface; reuse across all contexts.
- CSS isolation via Shadow DOM; fallback to `cell-*` class prefix + local reset if Phase 1b fixed-overlay PoC is NO-GO.
- `tokens.json` follows the 3-layer model (primitive → semantic → component) in `STANDARD.md`.
- Zero hardcoded color/spacing/z-index outside `tokens.json` + `SubtitlePreview`.
- Popup dictionary and `DictionaryTab` share a headless `DictionaryCore`; no duplicated lookup logic.
- Design-system-showcase auto-discovers components via `import.meta.glob` + `*.showcase.tsx`.

### Non-goals
- No business-logic rewrites (subtitle parsing, dictionary lookup, tokenization, media capture, Anki flows).
- No new dependencies or `manifest.json` changes without explicit human approval.
- No migration of token spans or word/sentence highlights into Shadow DOM.
- No deletion of a working legacy renderer before its replacement passes build + unit + browser verification.

## 2. Architecture decisions

1. **Shadow DOM CSS injection** — `tokens.css?raw` (replace `:root` → `:host`), `components.css?raw`, and per-component `*.module.css?inline` injected into a shadow `<style>`. `?inline` gives the hashed CSS-string produced by Vite CSS Modules, so class names in the string match the React component. Verified by the existing `ShadowButtonPoC`.
2. **`mountReactShadow.ts`** — generic helper: create host, attach shadow, inject CSS, `createRoot`, render, return unmount. All new content-script mounts go through it unless the fixed-overlay PoC fails.
3. **`ShadowThemeProvider.tsx`** — wraps `ThemeProvider` with an optional `container` prop. For shadow mounts it syncs `data-theme` and CSS vars on the shadow host, reusing `themeTokens.ts` / `tokens.ts` for runtime theme changes.
4. **Fixed overlay GO/NO-GO (Phase 1b)** — Test `position: fixed; inset: 0` inside a shadow host on YouTube fullscreen. If the overlay is not trapped, migrate card creator / settings / universal panel to shadow; otherwise keep them in light DOM with `cell-` prefix + local reset.
5. **Cue data flow** — Content-script detectors dispatch `cell:cues:updated` CustomEvents; `cuesStore.ts` (Zustand) consumes them; `SubtitleBlock` and `NavCluster` read from the store.
6. **Dictionary SSOT** — The existing vanilla popup dictionary is the feature SSOT. Extract headless hooks `useDictionaryLookup` and `useDictionaryToolbar` into a `DictionaryCore` reused by `PopupDictionary` and `DictionaryTab`.
7. **Feature flags** — Every replacement ships behind a `USE_LEGACY_*` flag (default `false`). The legacy code is deleted only after the new UI passes build, unit tests, manual tests on YouTube/Netflix/GeeksforGeeks, and one full development cycle.
8. **Showcase auto-discovery** — Vite `import.meta.glob` scans `src/shared/ui/*.showcase.tsx` and `src/features/*/ui/*.showcase.tsx` at build time; `MockProviders` feed data-dependent previews.

## 3. Content-script UI inventory (current → target)

| Surface | Current | Main file(s) | Shadow? | Phase |
|---|---|---|---|---|
| Subtitle overlay | vanilla DOM | `subtitleBlockDom.ts` | no (target: yes) | 2 |
| Nav cluster | vanilla DOM | `navClusterButton.ts`, `navClusterCss.ts` | no | 2 |
| Subtitle manager | vanilla DOM | `subtitleManagerPanel.ts` | no | 2 |
| Subtitle offset | vanilla DOM | `subtitleOffsetPanel.ts`, `offsetController.ts` | no | 2 |
| Subtitle toast/hint | vanilla DOM | `subtitleToast.ts`, `subtitleUI.ts` | no | 2 |
| Tokenize word spans | vanilla light DOM | `tokenSpanRenderer.ts`, `tokenSpanCss.ts` | **no** | 5 |
| Tokenize FAB/panel | vanilla + shadow | `tokenBadge.ts` | yes | 5 |
| Orbital badge | vanilla + shadow | `createOrbitalBadge.ts`, `orbitalBadgeCss.ts` | yes | 3 |
| Popup dictionary shell/toolbar/content | vanilla + shadow | `popupShell.ts`, `popupToolbar.ts`, `popupContent.ts` | yes | 4 |
| Word highlight overlay | vanilla light DOM | `wordHighlight.ts` | **no** | 4 |
| Settings dialog | React, light DOM | `mountSettingsDialog.ts` | no (target: TBD by PoC) | 7 |
| Card creator dialog | React, light DOM | `mountCardCreatorDialog.ts` | no (target: TBD by PoC) | 6 |
| UniversalPanel | React, light DOM | `mountUniversalPanel.ts` | no (target: TBD by PoC) | 8 |

## 4. Phase dependency graph

```
P0a → P0b → P0c
            │
            ▼
            P1a → P1b → P1c
            │
            ├──→ P2a → P2b ──→ P5
            │
            ├──→ P3a → P3b → P3c
            │                         │
            │                         ▼
            │                         P4a → P4b → P4c → P4d
            │                         │
            │                         ▼
            │                         P6a → P6b → P6c → P7 → P8
            │                                                   │
            └───────────────────────────────────────────────────┘
                                                                ▼
                                                                P9
```

- P0/P1 are foundations and block all later phases.
- P2 blocks P5 (tokenize badges are composed into subtitle).
- P3 blocks P4 (popup positions from orbital pointer).
- P4 blocks P6 (quick-add prefill) and P8 (`DictionaryTab` reuse).
- P5 also blocks P8 (tokenize toggle in panel header).
- P6/P7 block P8 (card creator / settings are tabs in universal panel).
- P9 depends on all reusable components being available.

## 5. Parallelization lanes

| Lane | Focus | Phases |
|---|---|---|
| **A — Foundation** | tokens, build, ADR | 0a–0c, 1a, docs |
| **B — Shadow infra** | mount helpers, theme, focus, z-order | 1a–1c |
| **C — Subtitle** | cues, block, nav, panels | 2a–2b |
| **D — Orbital** | badge, pointer, gestures | 3a–3c |
| **E — Popup dictionary** | headless core, shell, parity | 4a–4d |
| **F — Tokenize** | FAB, token spans | 5 |
| **G — Card creator** | dialog, store, showcase | 6a–6c |
| **H — Settings / UniversalPanel** | mount, tabs, fullscreen | 7–8 |
| **I — Showcase** | auto-discovery, `.showcase.tsx`, final verify | 9 |
| **Q — QA / Performance** | typecheck, build, bundle/RAM, manual tests | cross-cutting |

## 6. Task list

### T001 — Add semantic token layer + backwards aliases to `tokens.json`
**Phase:** 0a | **Lane:** A | **Scope:** S | **Depends on:** None  
**Files likely touched:** `src/shared/styles/tokens.json`
**Acceptance criteria:**
- Primitive, derived (semantic), and component layers are clearly separated.
- New semantic tokens follow `STANDARD.md` naming: `--color-text-primary`, `--color-text-secondary`, `--color-surface-card`, `--color-surface-popover`, `--color-text-disabled`, `--color-icon-*`, `--color-on-*`, `--color-overlay-*`, `--color-border-emphasized`, `--color-skeleton`.
- Backwards aliases exist: `--color-foreground`, `--color-text-muted`, `--color-card`, `--color-popover`.
- Semantic radius tokens added: `--radius-inner`, `--radius-element`, `--radius-container`, `--radius-page`.
- Composite typography tokens added: `--text-body`, `--text-label`, `--text-heading-1/2/3`, `--text-supporting`.
**Verification:**
- `node scripts/generate-tokens.js` runs without errors.
- `rg "color-foreground|color-text-muted|color-card|color-popover" src/shared/styles/tokens.json` shows only alias entries.
- Manual: inspect `tokens.css` for new semantic variables and alias declarations.

### T002 — Update `scripts/generate-tokens.js` for alias resolution and composite typography
**Phase:** 0a | **Lane:** A | **Scope:** M | **Depends on:** T001  
**Files likely touched:** `scripts/generate-tokens.js`, `src/shared/lib/tokens.ts`, `src/shared/styles/tokens.css` (generated)
**Acceptance criteria:**
- Alias values resolve to the referenced token value in `tokens.css`.
- Composite typography tokens emit `font-size`, `font-weight`, `line-height`, `letter-spacing` declarations.
- Generated `tokens.ts` runtime map includes semantic and component tokens.
**Verification:**
- `node scripts/generate-tokens.js`.
- `npm run typecheck`.
- Inspect generated `tokens.css` for `var(--color-text-primary)` in alias values and `text-body` composition.

### T003 — Refactor `src/shared/lib/tokens.ts` to read derived tokens from `tokens.json`
**Phase:** 0a | **Lane:** A | **Scope:** M | **Depends on:** T002  
**Files likely touched:** `src/shared/lib/tokens.ts`, `src/shared/styles/tokens.json`, `src/shared/lib/themeTokens.ts`
**Acceptance criteria:**
- `deriveColorTokens` / `getColorTokens` consume derived token definitions from `tokens.json` instead of hardcoding semantic values.
- Theme injection (`themeTokens.ts`) still produces identical CSS output for default light/dark.
- No runtime errors in popup/sidepanel/content-script.
**Verification:**
- `npm run test:unit` (tokens tests).
- `npm run build`.
- Diff `tokens.css` before/after; only expected additions.

### T004 — Move nav-cluster CSS strings into tokens / module CSS
**Phase:** 0a | **Lane:** A | **Scope:** M | **Depends on:** T001  
**Files likely touched:** `src/features/subtitle/ui/navClusterCss.ts`, `src/shared/lib/themeTokens.ts`, `src/shared/styles/tokens.json`, `src/features/subtitle/ui/NavCluster.module.css` (new)
**Acceptance criteria:**
- `NAV_CLUSTER_CSS` hardcoded string removed or reduced to layout-only.
- All colors/spacing/radius/z-index come from `tokens.css` variables.
- Nav cluster still renders in current showcase.
**Verification:**
- `rg 'NAV_CLUSTER_CSS' src/` shows only an import in legacy code.
- `npm run build`.
- Manual: design-system-showcase nav cluster preview unchanged.

### T005 — Move subtitle block / toast CSS strings into tokens / module CSS
**Phase:** 0a | **Lane:** A | **Scope:** M | **Depends on:** T001  
**Files likely touched:** `src/features/subtitle/ui/subtitleBlockCss.ts`, `src/features/subtitle/ui/subtitleUI.ts`, `src/shared/styles/tokens.json`, `src/features/subtitle/ui/SubtitleBlock.module.css` (new), `src/features/subtitle/ui/SubtitleToast.module.css` (new)
**Acceptance criteria:**
- `subtitleBlockCss.ts` and `subtitleUI.ts` hardcoded CSS replaced by token refs or module CSS.
- `dialog.overlay-bg`, `subtitle.drag-hint`, and overlay tokens use semantic values.
**Verification:**
- `rg '#[0-9a-fA-F]{3,8}' src/features/subtitle/ui/` (outside tokens.json) returns 0.
- `npm run typecheck`.
- Manual: YouTube subtitle overlay renders.

### T006 — Move orbital badge CSS into tokens / module CSS
**Phase:** 0a | **Lane:** A | **Scope:** S | **Depends on:** T001  
**Files likely touched:** `src/features/dictionaryPopup/badgePointer/orbitalBadgeCss.ts`, `src/shared/styles/tokens.json`, `src/features/dictionaryPopup/ui/OrbitalBadge.module.css` (new)
**Acceptance criteria:**
- `orbitalBadgeCss.ts` hardcoded values moved to `tokens.json` or `OrbitalBadge.module.css`.
- No raw colors/spacing outside tokens.
**Verification:**
- `rg '#[0-9a-fA-F]{3,8}' src/features/dictionaryPopup/badgePointer/` returns 0.
- `npm run build`.

### T007 — Move tokenize badge / span CSS into tokens / module CSS
**Phase:** 0a | **Lane:** A | **Scope:** M | **Depends on:** T001  
**Files likely touched:** `src/features/tokenize/ui/tokenBadgeCss.ts`, `src/features/tokenize/ui/tokenSpanCss.ts`, `src/shared/styles/tokens.json`, `src/features/tokenize/ui/TokenizeFab.module.css` (new)
**Acceptance criteria:**
- `tokenBadgeCss.ts` and `tokenSpanCss.ts` color/spacing values reference `tokens.css` variables.
- Token frequency tier colors use `--color-success-muted`, `--color-warning-muted`, `--color-error-muted` or dedicated token refs.
- Token span (light DOM) still wraps host text.
**Verification:**
- `rg '#[0-9a-fA-F]{3,8}' src/features/tokenize/ui/` returns 0.
- `npm run test:unit` for tokenize.
- Manual: token spans color correctly on subtitle.

### T008 — Move popup dictionary CSS into tokens / module CSS
**Phase:** 0a | **Lane:** A | **Scope:** M | **Depends on:** T001  
**Files likely touched:** `src/features/dictionaryPopup/ui/popupDictionary.css`, `src/shared/styles/tokens.json`, `src/features/dictionaryPopup/ui/PopupDictionary.module.css` (new)
**Acceptance criteria:**
- `popupDictionary.css` raw values replaced by tokens.
- No hardcoded colors/spacing/z-index outside `tokens.json`.
- Legacy popup still works during migration.
**Verification:**
- `rg '#[0-9a-fA-F]{3,8}' src/features/dictionaryPopup/ui/*.css` returns 0.
- `npm run build`.

### T009 — Regenerate tokens and baseline build
**Phase:** 0a | **Lane:** A | **Scope:** S | **Depends on:** T002–T008  
**Files likely touched:** `src/shared/styles/tokens.css` (gen), `src/shared/styles/tokens.ts` (gen)
**Acceptance criteria:**
- `tokens.css` and `tokens.ts` generated successfully.
- `npm run typecheck` and `npm run build` pass.
- Existing UI still renders in showcase/popup.
**Verification:**
- `node scripts/generate-tokens.js && npm run typecheck && npm run build`.
- Manual: open `docs/design-system/design-system-showcase.html` and toggle light/dark.

### T010 — Replace `--color-foreground` callers with `--color-text-primary`
**Phase:** 0b | **Lane:** A | **Scope:** M | **Depends on:** T009  
**Files likely touched:** `src/shared/ui/*.module.css`, `src/features/**/*.module.css`, `src/features/**/*.tsx`, `src/entrypoints/**/*.tsx`, `src/shared/lib/tokens.ts`
**Acceptance criteria:**
- Zero `var(--color-foreground)` outside `tokens.json` / generated files.
- Alias still resolves correctly so legacy users see no break.
**Verification:**
- `rg "var\(--color-foreground\)" src/ --type css --type ts --type tsx -v tokens.json -v tokens.css` returns 0.
- `npm run typecheck && npm run build`.

### T011 — Replace `--color-text-muted` callers with `--color-text-secondary`
**Phase:** 0b | **Lane:** A | **Scope:** M | **Depends on:** T009  
**Files likely touched:** `src/shared/ui/*.module.css`, `src/features/**/*.module.css`, `src/features/**/*.tsx`, `src/entrypoints/**/*.tsx`, `src/shared/lib/tokens.ts`
**Acceptance criteria:**
- Zero `var(--color-text-muted)` outside `tokens.json` / generated files.
**Verification:**
- `rg "var\(--color-text-muted\)" src/ --type css --type ts --type tsx -v tokens.json -v tokens.css` returns 0.
- `npm run build`.

### T012 — Replace `--color-card` callers with `--color-surface-card`
**Phase:** 0b | **Lane:** A | **Scope:** M | **Depends on:** T009  
**Files likely touched:** `src/shared/ui/*.module.css`, `src/features/**/*.module.css`, `src/features/**/*.tsx`, `src/entrypoints/**/*.tsx`, `src/shared/lib/tokens.ts`
**Acceptance criteria:**
- Zero `var(--color-card)` outside `tokens.json` / generated files.
**Verification:**
- `rg "var\(--color-card\)" src/ --type css --type ts --type tsx -v tokens.json -v tokens.css` returns 0.
- `npm run build`.

### T013 — Replace `--color-popover` callers with `--color-surface-popover`
**Phase:** 0b | **Lane:** A | **Scope:** M | **Depends on:** T009  
**Files likely touched:** `src/shared/ui/*.module.css`, `src/features/**/*.module.css`, `src/features/**/*.tsx`, `src/entrypoints/**/*.tsx`, `src/shared/lib/tokens.ts`
**Acceptance criteria:**
- Zero `var(--color-popover)` outside `tokens.json` / generated files.
**Verification:**
- `rg "var\(--color-popover\)" src/ --type css --type ts --type tsx -v tokens.json -v tokens.css` returns 0.
- `npm run build`.

### T014 — Audit raw px / hardcoded values and build
**Phase:** 0b | **Lane:** A/Q | **Scope:** M | **Depends on:** T010–T013  
**Files likely touched:** all `*.module.css`, `*.tsx` (audit fixes)
**Acceptance criteria:**
- Zero hardcoded `#[0-9a-fA-F]{3,8}` in `src/**/*.css` outside `tokens.css` and `SubtitlePreview`.
- Zero `color-accent` used in hover states.
- Zero raw `px` in `src/shared/ui/*.module.css` outside `var(...)` or `0px`.
**Verification:**
- `rg '#[0-9a-fA-F]{3,8}' src/ --type css -v tokens.css -v SubtitlePreview`.
- `rg 'color-accent' src/ --type css | rg hover`.
- `rg 'px' src/shared/ui/ --type css -v "var\(" -v "0px"`.
- `npm run typecheck && npm run build`.

### T015 — Confirm zero old token names and tag pre-alias-removal commit
**Phase:** 0c | **Lane:** A/Q | **Scope:** S | **Depends on:** T014  
**Files likely touched:** `git` (tag only)
**Acceptance criteria:**
- `rg` for old token names in `src/` (outside `tokens.json` / generated) returns 0.
- Git tag `pre-token-alias-removal` exists.
**Verification:**
- `rg "--color-foreground|--color-text-muted|--color-card|--color-popover" src/ --type css --type ts --type tsx -v tokens.json -v tokens.css` returns 0.
- `git tag pre-token-alias-removal`.

### T016 — Remove aliases and alias-generation logic
**Phase:** 0c | **Lane:** A | **Scope:** M | **Depends on:** T015  
**Files likely touched:** `src/shared/styles/tokens.json`, `scripts/generate-tokens.js`, `src/shared/styles/tokens.css` (gen), `src/shared/styles/tokens.ts` (gen)
**Acceptance criteria:**
- Old token names removed from `tokens.json`.
- Alias-generation code removed from `generate-tokens.js`.
- Generated `tokens.css` contains no aliases.
**Verification:**
- `node scripts/generate-tokens.js`.
- `rg "--color-foreground|--color-text-muted|--color-card|--color-popover" src/shared/styles/tokens.css` returns 0.
- `npm run typecheck`.

### T017 — Capture baseline bundle / RAM metrics
**Phase:** 0c | **Lane:** Q | **Scope:** M | **Depends on:** T016  
**Files likely touched:** `docs/adr/075-shadow-root-react.md` (new section)
**Acceptance criteria:**
- `dist/content/` bundle size recorded.
- `docs/design-system` build size recorded.
- YouTube 10 min idle RAM baseline recorded.
- Metrics written into `docs/adr/075-shadow-root-react.md`.
**Verification:**
- `npm run build` and `npx vite build --mode development`.
- `ls -lh dist/content/`, `du -sh docs/design-system`.
- Chrome DevTools Memory on YouTube video page.

### T018 — Verify all entrypoints after token cleanup
**Phase:** 0c | **Lane:** Q | **Scope:** S | **Depends on:** T016, T017  
**Files likely touched:** none
**Acceptance criteria:**
- `npm run build` and `npx vite build --mode development` pass.
- Showcase, popup, sidepanel, options render with no style regression.
**Verification:**
- `npm run typecheck && npm run build && npx vite build --mode development`.
- Manual: load each entrypoint and toggle light/dark.

#### Checkpoint 0 (Foundation)
- [ ] `tokens.json` has 3 layers, no old aliases.
- [ ] `generate-tokens.js` supports alias + composite.
- [ ] Build and typecheck pass.
- [ ] Baseline bundle/RAM captured.

### T019 — Formalize `ShadowButtonPoC` as design-system page
**Phase:** 1a | **Lane:** B | **Scope:** S | **Depends on:** T018  
**Files likely touched:** `src/entrypoints/design-system-showcase/ShadowButtonPoC.tsx`, `src/entrypoints/design-system-showcase/App.tsx`, `docs/adr/075-shadow-root-react.md`
**Acceptance criteria:**
- `ShadowButtonPoC` renders a `Button` inside a shadow root.
- Host page injects hostile CSS (`button { all: unset !important; }`).
- Button keeps Cell styling (color, radius, padding, hover).
**Verification:**
- `npm run dev` or `npx http-server docs/design-system -p 8123`.
- Manual: open Shadow Button PoC, inspect button, confirm background is primary (not red).

### T020 — Prototype `src/shared/lib/shadowRoot/mountReactShadow.ts`
**Phase:** 1a | **Lane:** B | **Scope:** S | **Depends on:** T019  
**Files likely touched:** `src/shared/lib/shadowRoot/mountReactShadow.ts`
**Acceptance criteria:**
- Function accepts a host element and a React element.
- Creates open shadow root, creates `div`, `createRoot`, renders.
- Returns `unmount()` that unmounts React and removes host.
**Verification:**
- Unit test: `mountReactShadow` returns cleanup and removes host from document.
- `npm run test:unit -- mountReactShadow`.

### T021 — Prototype `src/shared/lib/shadowRoot/injectShadowCss.ts`
**Phase:** 1a | **Lane:** B | **Scope:** S | **Depends on:** T019  
**Files likely touched:** `src/shared/lib/shadowRoot/injectShadowCss.ts`
**Acceptance criteria:**
- Imports `tokens.css?raw` and `components.css?raw`.
- Replaces `:root` with `:host` in tokens.
- Appends one `<style>` with tokens + components to the shadow root.
- Returns a cleanup function.
**Verification:**
- Unit test: injected `<style>` contains expected token variable strings.
- `npm run test:unit -- injectShadowCss`.

### T022 — Add Jest moduleNameMapper for `?inline` CSS imports
**Phase:** 1a | **Lane:** B/Q | **Scope:** S | **Depends on:** T019  
**Files likely touched:** `jest.config.ts`, `tests/inlineMock.ts` (new)
**Acceptance criteria:**
- `\?inline$` mapped before `^@/(.*)$`.
- `?inline` imports return a plain CSS string in unit tests.
- `npm run test:unit` passes with a component using `*.module.css?inline`.
**Verification:**
- `npm run test:unit -- Button` (or a new shadow test) passes.
- `npm run typecheck`.

### T023 — Document CSS injection decision in ADR-075
**Phase:** 1a | **Lane:** B | **Scope:** S | **Depends on:** T021, T022  
**Files likely touched:** `docs/adr/075-shadow-root-react.md`
**Acceptance criteria:**
- ADR explains why `?inline` over `constructable`/`adoptedStyleSheets` for now.
- Notes the `?inline` limitation (not runtime CSS modules in shadow).
- Lists budget and fallback if CSS size > 50KB.
**Verification:**
- Read `docs/adr/075-shadow-root-react.md`.
- Review with human.

#### Checkpoint 1a (Shadow PoC)
- [ ] Shadow PoC page renders isolated Button.
- [ ] `?inline` Jest mapping works.
- [ ] ADR-075 has the injection decision.

### T024 — Implement `mountReactShadow.ts`
**Phase:** 1b | **Lane:** B | **Scope:** M | **Depends on:** T020–T023  
**Files likely touched:** `src/shared/lib/shadowRoot/mountReactShadow.ts`, `src/shared/lib/shadowRoot/mountReactShadow.test.ts`
**Acceptance criteria:**
- Generic helper with host, layer (`zIndex`), and optional `position: fixed/absolute`.
- Creates shadow root, calls `injectShadowCss`, creates React root, renders.
- Returns `unmount` + host ref.
- Multiple hosts ordered by layer/subtitle order.
**Verification:**
- Unit tests: mount/unmount, multiple hosts, z-index ordering.
- `npm run test:unit -- shadowRoot`.
- `npm run typecheck`.

### T025 — Implement `injectShadowCss.ts` with per-component CSS
**Phase:** 1b | **Lane:** B | **Scope:** M | **Depends on:** T021, T022  
**Files likely touched:** `src/shared/lib/shadowRoot/injectShadowCss.ts`, `src/shared/lib/shadowRoot/injectShadowCss.test.ts`
**Acceptance criteria:**
- Injects `tokens.css?raw` (with `:host`), `components.css?raw`, and optional per-component `*.module.css?inline`.
- Keeps tokens and legacy component global classes separate.
- Returns cleanup.
- Handles re-injection idempotency (same shadow, same style block).
**Verification:**
- Unit tests for token and component CSS injection.
- `npm run test:unit -- injectShadowCss`.

### T027 — Refactor `themeManager.ts` `applyTheme` to accept a target element
**Phase:** 1b | **Lane:** B | **Scope:** S | **Depends on:** T018  
**Files likely touched:** `src/features/theme/logic/themeManager.ts`, `src/features/theme/logic/themeManager.test.ts`
**Acceptance criteria:**
- `applyTheme(mode, config, target = document.documentElement)` sets CSS vars and `data-theme` on the target.
- Existing callers (`ThemeProvider`, options, popup) still work.
- No regression in popup/sidepanel theme.
**Verification:**
- `npm run test:unit -- themeManager`.
- `npm run build`.

### T026 — Implement `ShadowThemeProvider.tsx`
**Phase:** 1b | **Lane:** B | **Scope:** M | **Depends on:** T024, T027  
**Files likely touched:** `src/shared/lib/shadowRoot/ShadowThemeProvider.tsx`, `src/features/theme/ui/ThemeProvider.tsx`, `src/features/theme/logic/themeManager.ts`
**Acceptance criteria:**
- `ShadowThemeProvider` wraps `ThemeProvider` with `container` prop set to the shadow host.
- `ThemeProvider` accepts optional `container` (default `document.documentElement`).
- In content-script, does not boot a separate `themeStore`; reuses `themeTokens.ts` injection and syncs `data-theme` on the host.
**Verification:**
- Unit test: toggling `data-theme` on host updates CSS vars inside shadow.
- `npm run test:unit -- ShadowThemeProvider`.

### T028 — Create `cuesStore.ts`
**Phase:** 1b | **Lane:** B/C | **Scope:** S | **Depends on:** T018  
**Files likely touched:** `src/stores/cuesStore.ts`, `src/stores/cuesStore.test.ts`
**Acceptance criteria:**
- Zustand store with `targetCues`, `nativeCues`, `activeIndex`, `setCues`, `setActiveIndex`.
- Subtitle components subscribe to slices to avoid re-renders.
**Verification:**
- `npm run test:unit -- cuesStore`.
- `npm run typecheck`.

### T029 — Create `useShadowFocusTrap.ts`
**Phase:** 1b | **Lane:** B | **Scope:** S | **Depends on:** T024  
**Files likely touched:** `src/shared/lib/shadowRoot/useShadowFocusTrap.ts`, `src/shared/lib/shadowRoot/useShadowFocusTrap.test.ts`
**Acceptance criteria:**
- Focus trap queries `panel.getRootNode().activeElement` instead of `document.activeElement`.
- Cycles focus within the shadow tree.
- Respects `prefers-reduced-motion` / reduced motion not relevant here.
**Verification:**
- Unit tests with jsdom + shadow root.
- `npm run test:unit -- useShadowFocusTrap`.

### T030 — Define z-index and shadow host ordering contract
**Phase:** 1b | **Lane:** B | **Scope:** S | **Depends on:** T024  
**Files likely touched:** `src/shared/lib/shadowRoot/mountReactShadow.ts`, `docs/adr/075-shadow-root-react.md`, `src/shared/styles/tokens.json`
**Acceptance criteria:**
- Documented stacking order: subtitle/nav bottom, orbital, popup dict, token badge, panel/settings/card creator top.
- `mountReactShadow` accepts a `layer`/`zIndex` prop that sets the host `z-index` from tokens (`--z-*`).
- No hardcoded z-index in callers.
**Verification:**
- Review ADR-075 ordering section.
- `rg 'z-index:' src/ --type css | rg -v 'var(--z-' | rg -v tokens` returns 0.

### T031 — PoC fixed overlay inside Shadow DOM
**Phase:** 1b | **Lane:** B/G/H | **Scope:** M | **Depends on:** T024, T026  
**Files likely touched:** `src/entrypoints/design-system-showcase/ShadowOverlayPoC.tsx` (new), `src/entrypoints/design-system-showcase/App.tsx`, `docs/adr/075-shadow-root-react.md`
**Acceptance criteria:**
- Mount a `Dialog`/`Card` into a shadow host with `position: fixed; inset: 0`.
- Test on YouTube fullscreen: dialog stays full viewport, not clipped/trapped.
- Record GO/NO-GO in ADR-075.
**Verification:**
- `npm run build`.
- Chrome DevTools MCP: YouTube fullscreen, open overlay, confirm full viewport.
- If NO-GO: update ADR, plan light DOM + `cell-` reset for card creator / settings / universal panel.

### T032 — Update `tokens.css` / `tokens.ts` generation for `:host`
**Phase:** 1b | **Lane:** A/B | **Scope:** S | **Depends on:** T002, T021  
**Files likely touched:** `scripts/generate-tokens.js`, `src/shared/styles/tokens.css` (gen)
**Acceptance criteria:**
- Generated `tokens.css` can be consumed by `injectShadowCss` with simple `:root` → `:host` replacement.
- `:root` block contains static tokens; `[data-theme]` blocks contain color + component tokens.
- No `:root` references remain in the injected string after replacement.
**Verification:**
- `node scripts/generate-tokens.js`.
- `rg ':root' src/shared/styles/tokens.css` shows only static block.

### T033 — Verify shadow mount on real pages
**Phase:** 1c | **Lane:** Q | **Scope:** M | **Depends on:** T024–T032  
**Files likely touched:** none (manual)
**Acceptance criteria:**
- CSS isolation works on YouTube, Netflix, GeeksforGeeks.
- Light/dark toggle works inside shadow.
- Focus, hover, click-outside behave correctly.
**Verification:**
- Load extension on each page; mount a PoC `Button` + `Card` in shadow.
- Confirm no FOUC, no style leak.

### T034 — Measure bundle / RAM after Phase 1
**Phase:** 1c | **Lane:** Q | **Scope:** S | **Depends on:** T033  
**Files likely touched:** `docs/adr/075-shadow-root-react.md`
**Acceptance criteria:**
- `dist/content/` JS bundle delta ≤ baseline + 300KB (Phase 1a budget).
- Shadow CSS injected ≤ 50KB.
- YouTube 10 min RAM delta within budget (≤ baseline + 50% or 250MB hard ceiling).
**Verification:**
- Bundle analyzer / `du -sh dist/content/`.
- Chrome DevTools Memory.
- Update ADR-075 with measurements.

#### Checkpoint 1 (Shadow infra)
- [ ] `mountReactShadow` + `injectShadowCss` implemented and unit tested.
- [ ] `ShadowThemeProvider` works with `ThemeProvider`.
- [ ] Fixed overlay PoC has GO/NO-GO recorded.
- [ ] No style leak on YouTube/Netflix/GeeksforGeeks.



### T035 — Define `cell:cues:updated` event types
**Phase:** 2a | **Lane:** C | **Scope:** S | **Depends on:** T028  
**Files likely touched:** `src/features/subtitle/events.ts` (new)
**Acceptance criteria:**
- `SUBTITLE_CUES_UPDATED` event type and `CustomEvent` detail defined.
- Detail carries `target`, `native`, `activeIndex`.
- TypeScript consumers can dispatch and listen without `any`.
**Verification:**
- `npm run test:unit -- events` (new test).
- `npm run typecheck`.

### T036 — Create `SubtitleBlock.tsx`
**Phase:** 2a | **Lane:** C | **Scope:** M | **Depends on:** T028, T035  
**Files likely touched:** `src/features/subtitle/ui/SubtitleBlock.tsx`, `src/features/subtitle/ui/SubtitleBlock.module.css`, `src/features/subtitle/ui/SubtitleBlock.test.tsx`
**Acceptance criteria:**
- Renders target and/or native cues from `cuesStore`.
- Applies `OverlayStyleConfig` (font size, color, opacity, shadow, family, weight).
- Uses `React.memo` + selectors so only active-cue highlight re-renders.
- Follows `STANDARD.md` and uses only token variables.
**Verification:**
- `npm run test:unit -- SubtitleBlock`.
- `npm run build`.
- Manual: design-system-showcase subtitle preview.

### T037 — Create `NavCluster.tsx`
**Phase:** 2a | **Lane:** C | **Scope:** M | **Depends on:** T028, T035  
**Files likely touched:** `src/features/subtitle/ui/NavCluster.tsx`, `src/features/subtitle/ui/NavCluster.module.css`, `src/features/subtitle/ui/NavCluster.test.tsx`
**Acceptance criteria:**
- Renders prev/next/replay/repeat/toggle buttons.
- Collapses to edge, supports drag/slide behavior.
- Connects to keyboard shortcuts and cue navigation controller.
- All icons from `ICON_CATALOG`; no inline SVG.
**Verification:**
- `npm run test:unit -- NavCluster`.
- Manual: showcase nav cluster preview.

### T038 — Refactor content-script controllers to dispatch cue events
**Phase:** 2a | **Lane:** C | **Scope:** M | **Depends on:** T035  
**Files likely touched:** `src/features/subtitle/ui/contentScriptController.ts`, `src/features/subtitle/ui/subtitleBlockController.ts`, `src/entrypoints/content/subtitle/*`
**Acceptance criteria:**
- Controllers dispatch `cell:cues:updated` instead of direct DOM manipulation.
- `cuesStore` listeners update state.
- Subtitle overlay business logic (parsing, sync, import) untouched.
**Verification:**
- `npm run test:unit` for affected controllers.
- `npm run build`.

### T039 — Mount `SubtitleBlock` + `NavCluster` into a shared shadow root
**Phase:** 2a | **Lane:** C | **Scope:** M | **Depends on:** T024, T036, T037, T038  
**Files likely touched:** `src/features/subtitle/ui/mountSubtitle.ts` (new), `src/entrypoints/content/subtitle/*`, `src/shared/lib/shadowRoot/mountReactShadow.ts`
**Acceptance criteria:**
- Single shadow host appended to the video player element.
- Host has `pointer-events: none` and lets controls be `pointer-events: auto`.
- Subtitle block + nav cluster share one `tokens.css` / component CSS injection.
- Unmount removes host and cleans up listeners.
**Verification:**
- `npm run test:unit -- mountSubtitle`.
- Manual: YouTube / Netflix subtitle + nav cluster render and respond.

### T040 — Apply `OverlayStyleConfig` from settings
**Phase:** 2a | **Lane:** C | **Scope:** S | **Depends on:** T036, T039  
**Files likely touched:** `src/features/subtitle/ui/SubtitleBlock.tsx`, `src/features/settings/ui/SubtitleStylePanel.tsx`
**Acceptance criteria:**
- Target and native `OverlayStyleConfig` passed as props to `SubtitleBlock`.
- Live updates from settings propagate to the shadow-mounted subtitle.
- No hardcoded overlay colors outside `tokens.json`.
**Verification:**
- `npm run test:unit`.
- Manual: change subtitle style in settings; observe on YouTube.

### T041 — Add subtitle components to design-system-showcase
**Phase:** 2a | **Lane:** I | **Scope:** S | **Depends on:** T036, T037  
**Files likely touched:** `src/entrypoints/design-system-showcase/App.tsx`, `src/entrypoints/design-system-showcase/mockCues.ts` (new)
**Acceptance criteria:**
- `SubtitleBlock` and `NavCluster` previews with mock cues in the showcase.
- Same components render in popup/sidepanel/content-script without edits.
**Verification:**
- `npm run build`.
- Manual: open `docs/design-system/design-system-showcase.html`; scroll to Subtitle section.

#### Checkpoint 2a (Subtitle core)
- [ ] `cuesStore` drives `SubtitleBlock` and `NavCluster`.
- [ ] Shared shadow root on video element.
- [ ] Cues update in real time; controls work.
- [ ] Showcase previews exist.

### T042 — Create `SubtitleManagerPanel.tsx`
**Phase:** 2b | **Lane:** C | **Scope:** M | **Depends on:** T039  
**Files likely touched:** `src/features/subtitle/ui/SubtitleManagerPanel.tsx`, `src/features/subtitle/ui/SubtitleManagerPanel.module.css`, `src/features/subtitle/ui/SubtitleManagerPanel.test.tsx`
**Acceptance criteria:**
- Select / load / import subtitles; naming and offset entry.
- Uses shared `Button`, `Input`, `Select` from `src/shared/ui`.
- Works inside the same shadow root as `SubtitleBlock`.
**Verification:**
- `npm run test:unit -- SubtitleManagerPanel`.
- Manual: open manager on YouTube, import SRT, verify list.

### T043 — Create `SubtitleOffsetPanel.tsx`
**Phase:** 2b | **Lane:** C | **Scope:** M | **Depends on:** T039  
**Files likely touched:** `src/features/subtitle/ui/SubtitleOffsetPanel.tsx`, `src/features/subtitle/ui/SubtitleOffsetPanel.module.css`, `src/features/subtitle/ui/offsetController.ts`
**Acceptance criteria:**
- Slider for time offset with live preview.
- Updates `cuesStore` or dispatches offset events.
- Theme and tokens only.
**Verification:**
- `npm run test:unit -- SubtitleOffsetPanel`.
- Manual: adjust offset on Netflix, subtitle timing shifts.

### T044 — Create `SubtitleToast.tsx` and `SubtitleHint.tsx`
**Phase:** 2b | **Lane:** C | **Scope:** M | **Depends on:** T039  
**Files likely touched:** `src/features/subtitle/ui/SubtitleToast.tsx`, `src/features/subtitle/ui/SubtitleHint.tsx`, `src/features/subtitle/ui/SubtitleToast.module.css`
**Acceptance criteria:**
- Toast messages, drag hint, error hint render in shared shadow.
- No raw animations; respects `prefers-reduced-motion`.
- Context-aware (drag, import, error).
**Verification:**
- `npm run test:unit -- SubtitleToast`.
- Manual: trigger toast/hint on YouTube.

### T045 — Mount subtitle panels in the shared shadow root
**Phase:** 2b | **Lane:** C | **Scope:** M | **Depends on:** T042, T043, T044  
**Files likely touched:** `src/features/subtitle/ui/mountSubtitle.ts`, `src/features/subtitle/ui/subtitlePanel.ts` (legacy)
**Acceptance criteria:**
- Manager, offset, toast, hint all mounted into the same shadow host as subtitle/nav.
- Visibility toggled by state, not separate vanilla mount.
- Cleanup removes all panel DOM.
**Verification:**
- `npm run test:unit -- mountSubtitle`.
- Manual: open manager/offset/toast and confirm CSS isolation.

### T046 — Add `USE_LEGACY_SUBTITLE` flag and delete vanilla subtitle files
**Phase:** 2b | **Lane:** C/Q | **Scope:** M | **Depends on:** T045  
**Files likely touched:** `src/features/subtitle/ui/mountSubtitle.ts`, `src/features/subtitle/ui/subtitleBlockDom.ts`, `src/features/subtitle/ui/subtitleManagerPanel.ts`, `src/features/subtitle/ui/subtitleOffsetPanel.ts`, `src/features/subtitle/ui/subtitleToast.ts`
**Acceptance criteria:**
- New `mountSubtitle` used by default; `USE_LEGACY_SUBTITLE=false`.
- Old files deleted after verification on 3 pages + build + unit tests.
- If regression, flag can be set to `true` and old files still exist until next commit.
**Verification:**
- `npm run test:unit`.
- `npm run build`.
- Manual: YouTube, Netflix, GeeksforGeeks subtitle behavior.

#### Checkpoint 2 (Subtitle complete)
- [ ] Manager, offset, toast, hint are React in shadow.
- [ ] `USE_LEGACY_SUBTITLE` false and old code deleted.
- [ ] No subtitle style leak.

### T047 — Refactor `pointerPosition.ts` into `useOrbitalPointer`
**Phase:** 3a | **Lane:** D | **Scope:** M | **Depends on:** T034  
**Files likely touched:** `src/features/dictionaryPopup/badgePointer/useOrbitalPointer.ts` (new), `src/features/dictionaryPopup/badgePointer/pointerPosition.ts`, `src/features/dictionaryPopup/badgePointer/useOrbitalPointer.test.ts`
**Acceptance criteria:**
- Hook returns badge center, pointer tip, and preset for given inputs.
- Pure logic; no DOM side effects inside the hook.
- Output matches current `pointerPosition.ts` for the same inputs.
**Verification:**
- `npm run test:unit -- useOrbitalPointer`.
- Compare outputs against existing `pointerPosition.test.ts`.

### T048 — Refactor `badgeCollapse.ts` into `useOrbitalSnap`
**Phase:** 3a | **Lane:** D | **Scope:** M | **Depends on:** T034  
**Files likely touched:** `src/features/dictionaryPopup/badgePointer/useOrbitalSnap.ts` (new), `src/features/dictionaryPopup/badgePointer/badgeCollapse.ts`, `src/features/dictionaryPopup/badgePointer/useOrbitalSnap.test.ts`
**Acceptance criteria:**
- Hook returns nearest edge, collapsed center, and expanded position.
- Pure; takes viewport rect and badge size as inputs.
- Same edge-snap/collapse behavior as current `badgeCollapse.ts`.
**Verification:**
- `npm run test:unit -- useOrbitalSnap`.

### T049 — Refactor `gestureDetector.ts` into `useOrbitalGesture`
**Phase:** 3a | **Lane:** D | **Scope:** M | **Depends on:** T034  
**Files likely touched:** `src/features/dictionaryPopup/badgePointer/useOrbitalGesture.ts` (new), `src/features/dictionaryPopup/badgePointer/gestureDetector.ts`, `src/features/dictionaryPopup/badgePointer/useOrbitalGesture.test.ts`
**Acceptance criteria:**
- Hook handles drag, expand threshold, double/triple tap.
- Returns `dragging`, `expanded`, and event handlers.
- Unit-testable without real pointer events.
**Verification:**
- `npm run test:unit -- useOrbitalGesture`.
- `npm run typecheck`.

#### Checkpoint 3a (Orbital hooks)
- [ ] Pointer, snap, gesture hooks are pure and tested.
- [ ] Outputs match vanilla helpers.

### T050 — Create `OrbitalBadge.tsx`
**Phase:** 3b | **Lane:** D | **Scope:** M | **Depends on:** T047, T048, T049  
**Files likely touched:** `src/features/dictionaryPopup/ui/OrbitalBadge.tsx`, `src/features/dictionaryPopup/ui/OrbitalBadge.module.css`, `src/features/dictionaryPopup/ui/OrbitalBadge.test.tsx`
**Acceptance criteria:**
- Renders half-moon/circle badge with `Icon` and `IconButton`.
- Uses the three hooks.
- Drag, expand/collapse, edge-snap, single-click open panel.
- `aria-label="Open Cell panel"`, `role="button"`, `aria-expanded`.
**Verification:**
- `npm run test:unit -- OrbitalBadge`.
- Manual: showcase preview.

### T051 — Add orbital badge position persistence
**Phase:** 3b | **Lane:** D | **Scope:** S | **Depends on:** T050  
**Files likely touched:** `src/stores/orbitalBadgeStore.ts` (new), `src/features/dictionaryPopup/ui/OrbitalBadge.tsx`
**Acceptance criteria:**
- Store persists position preset and collapsed edge via `chrome.storage.local`.
- Badge restores position across reloads.
- No flash of default position.
**Verification:**
- `npm run test:unit -- orbitalBadgeStore`.
- Manual: drag badge on YouTube, reload, verify position.

### T052 — Add orbital badge to design-system-showcase
**Phase:** 3b | **Lane:** I | **Scope:** S | **Depends on:** T050  
**Files likely touched:** `src/entrypoints/design-system-showcase/App.tsx`, `src/entrypoints/design-system-showcase/mockOrbital.ts` (new)
**Acceptance criteria:**
- `OrbitalBadge` preview with mock pointer controls.
- Works in light/dark mode.
**Verification:**
- `npm run build`.
- Manual: open showcase, interact with badge preview.

### T053 — Mount `OrbitalBadge` in shadow root with fullscreen re-parenting
**Phase:** 3c | **Lane:** D | **Scope:** M | **Depends on:** T024, T050  
**Files likely touched:** `src/features/dictionaryPopup/ui/mountOrbitalBadge.ts` (new), `src/features/dictionaryPopup/ui/OrbitalBadge.tsx`
**Acceptance criteria:**
- Uses `mountReactShadow` on `document.body` with top z-index (`--z-overlay-top`).
- Fullscreen change re-parents host into fullscreen element.
- Click-outside uses `event.composedPath()` to close badge.
- `USE_LEGACY_ORBITAL` flag added, default `false`.
**Verification:**
- `npm run test:unit -- mountOrbitalBadge`.
- Toggle `USE_LEGACY_ORBITAL`, both paths compile.
- Manual: YouTube fullscreen, badge stays visible and clickable.

### T054 — Delete old orbital badge vanilla files
**Phase:** 3c | **Lane:** D/Q | **Scope:** M | **Depends on:** T053  
**Files likely touched:** `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts`, `src/features/dictionaryPopup/badgePointer/orbitalBadgeCss.ts`, `src/entrypoints/content/*` (update calls)
**Acceptance criteria:**
- Old files deleted after T053 verified.
- All content-script callers use `mountOrbitalBadge`.
- `USE_LEGACY_ORBITAL` flag removed once deleted.
**Verification:**
- `npm run test:unit`.
- `npm run build`.
- Manual: YouTube/Netflix/GeeksforGeeks orbital behavior.

#### Checkpoint 3 (Orbital complete)
- [ ] `OrbitalBadge` is React, mounted in shadow.
- [ ] Position persists; fullscreen works.
- [ ] Old code deleted.

### T055 — Create `useDictionaryLookup` headless hook
**Phase:** 4a | **Lane:** E | **Scope:** M | **Depends on:** T054  
**Files likely touched:** `src/features/dictionaryPopup/logic/useDictionaryLookup.ts` (new), `src/features/dictionaryPopup/ui/useDictionaryPanel.ts`, `src/features/dictionaryPopup/ui/popupDictionaryController.ts`
**Acceptance criteria:**
- Encapsulates search, loading, error, result list.
- No DOM dependency.
- Reused by `DictionaryPanelView` and `PopupDictionary`.
- Cancellation of in-flight lookups preserved.
**Verification:**
- `npm run test:unit -- useDictionaryLookup`.
- `npm run typecheck`.

### T056 — Create `useDictionaryToolbar` headless hook
**Phase:** 4a | **Lane:** E | **Scope:** M | **Depends on:** T054  
**Files likely touched:** `src/features/dictionaryPopup/logic/useDictionaryToolbar.ts` (new), `src/features/dictionaryPopup/ui/useDictionaryPanel.ts`, `src/features/dictionaryPopup/ui/useCandidate.ts`
**Acceptance criteria:**
- Manages 4 tabs (audio/image/translate/links), selection counts.
- Returns active tab, setters, and selection state.
- No DOM dependency.
**Verification:**
- `npm run test:unit -- useDictionaryToolbar`.

### T057 — Refactor `CandidateView` to pure presentation
**Phase:** 4a | **Lane:** E | **Scope:** M | **Depends on:** T055, T056  
**Files likely touched:** `src/features/dictionaryPopup/ui/CandidateView.tsx`, `src/features/dictionaryPopup/ui/CandidateView.test.tsx`
**Acceptance criteria:**
- Receives all state via props / per-candidate hook.
- No direct global state.
- 4 tab panels moved to standalone components in Phase 4b.
**Verification:**
- `npm run test:unit -- CandidateView`.

### T058 — Refactor `DictionaryPanelView` to pure presentation
**Phase:** 4a | **Lane:** E | **Scope:** M | **Depends on:** T057  
**Files likely touched:** `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`, `src/features/dictionaryPopup/ui/DictionaryPanelView.test.tsx`
**Acceptance criteria:**
- Uses `useDictionaryLookup` + `useDictionaryToolbar`.
- Chips remain but jump-scroll; no global tab state.
- Search history still works.
**Verification:**
- `npm run test:unit -- DictionaryPanelView`.

#### Checkpoint 4a (Dictionary core)
- [ ] `useDictionaryLookup` and `useDictionaryToolbar` exist and are tested.
- [ ] `CandidateView` / `DictionaryPanelView` are presentation-only.

### T059 — Create `AudioPanel.tsx`
**Phase:** 4b | **Lane:** E | **Scope:** S | **Depends on:** T058  
**Files likely touched:** `src/features/dictionaryPopup/ui/AudioPanel.tsx`, `src/features/dictionaryPopup/ui/AudioPanel.test.tsx`
**Acceptance criteria:**
- Renders word/sentence audio, TTS fallback, selection.
- Receives `selection`, `onToggle`, `onTts` callbacks.
- Uses shared `Button`, `Icon`, `Skeleton`.
**Verification:**
- `npm run test:unit -- AudioPanel`.

### T060 — Create `ImagePanel.tsx`
**Phase:** 4b | **Lane:** E | **Scope:** S | **Depends on:** T058  
**Files likely touched:** `src/features/dictionaryPopup/ui/ImagePanel.tsx`, `src/features/dictionaryPopup/ui/ImagePanel.test.tsx`
**Acceptance criteria:**
- Renders image strip, selected state, Google Images fallback link.
- Handles image error.
- No inline SVG.
**Verification:**
- `npm run test:unit -- ImagePanel`.

### T061 — Create `TranslatePanel.tsx`
**Phase:** 4b | **Lane:** E | **Scope:** S | **Depends on:** T058  
**Files likely touched:** `src/features/dictionaryPopup/ui/TranslatePanel.tsx`, `src/features/dictionaryPopup/ui/TranslatePanel.test.tsx`
**Acceptance criteria:**
- Shows term, context sentence, translation, loading, error.
- Toggle selection and trigger translate.
**Verification:**
- `npm run test:unit -- TranslatePanel`.

### T062 — Create `LinksPanel.tsx`
**Phase:** 4b | **Lane:** E | **Scope:** S | **Depends on:** T058  
**Files likely touched:** `src/features/dictionaryPopup/ui/LinksPanel.tsx`, `src/features/dictionaryPopup/ui/LinksPanel.test.tsx`
**Acceptance criteria:**
- Renders external dictionary links from settings.
- Opens links safely (`rel="noopener noreferrer"`).
**Verification:**
- `npm run test:unit -- LinksPanel`.

### T063 — Create `DictionaryToolbar.tsx`
**Phase:** 4b | **Lane:** E | **Scope:** M | **Depends on:** T059–T062  
**Files likely touched:** `src/features/dictionaryPopup/ui/DictionaryToolbar.tsx`, `src/features/dictionaryPopup/ui/DictionaryToolbar.module.css`, `src/features/dictionaryPopup/ui/DictionaryToolbar.test.tsx`
**Acceptance criteria:**
- 4 tab buttons with icons and selected-item count badges.
- Uses `useDictionaryToolbar`.
- Works in both popup and `DictionaryTab` contexts.
**Verification:**
- `npm run test:unit -- DictionaryToolbar`.
- Manual: toggle tabs, see badges update.

### T064 — Wire `DictionaryToolbar` into `DictionaryTab`
**Phase:** 4b | **Lane:** E/H | **Scope:** M | **Depends on:** T063  
**Files likely touched:** `src/features/universalPanel/tabs/DictionaryTab.tsx`, `src/features/universalPanel/tabs/DictionaryTab.test.tsx`
**Acceptance criteria:**
- `DictionaryTab` now has full 4-tab toolbar.
- Audio/image/translate/links data binds correctly.
- No regression in existing `DictionaryPanelView`.
**Verification:**
- `npm run test:unit -- DictionaryTab`.
- Manual: open UniversalPanel Dictionary tab, use all 4 tabs.

#### Checkpoint 4b (Dictionary toolbar)
- [ ] 4 tab panels are standalone React components.
- [ ] `DictionaryToolbar` works in both popup and panel.

### T065 — Create `PopupDictionary.tsx` shell
**Phase:** 4c | **Lane:** E | **Scope:** M | **Depends on:** T064  
**Files likely touched:** `src/features/dictionaryPopup/ui/PopupDictionary.tsx`, `src/features/dictionaryPopup/ui/PopupDictionary.module.css`, `src/features/dictionaryPopup/ui/PopupDictionary.test.tsx`
**Acceptance criteria:**
- Composes `DictionaryCore` + `DictionaryToolbar` + shell layout.
- Supports header, chip bar, search, and candidate list.
- Works inside shadow root.
**Verification:**
- `npm run test:unit -- PopupDictionary`.
- `npm run build`.

### T066 — Reuse popup position / resize / sheet logic
**Phase:** 4c | **Lane:** E | **Scope:** M | **Depends on:** T065  
**Files likely touched:** `src/features/dictionaryPopup/ui/popupShell.ts`, `src/features/dictionaryPopup/ui/popupDictionary.css`, `src/features/dictionaryPopup/ui/PopupDictionary.tsx`, `src/features/dictionaryPopup/ui/usePopupPosition.ts` (new), `src/features/dictionaryPopup/ui/wordHighlight.ts`
**Acceptance criteria:**
- `computePopupPosition`, resize handle, sheet handle, clamp logic extracted to pure helpers.
- `PopupDictionary` uses them without re-implementing.
- Position auto-avoids viewport overflow and orbital pointer.
- `wordHighlight.ts` overlay remains in light DOM and only refactors state binding to coordinate with `PopupDictionary` (no migration into shadow root).
**Verification:**
- `npm run test:unit -- usePopupPosition`.
- Manual: drag/resize popup on YouTube.
- Confirm `wordHighlight.ts` still injects styles into the host light DOM, not the shadow root.

### T067 — Mount `PopupDictionary` under orbital pointer tip
**Phase:** 4c | **Lane:** E | **Scope:** M | **Depends on:** T053, T065  
**Files likely touched:** `src/features/dictionaryPopup/ui/mountPopupDictionary.ts` (new), `src/features/dictionaryPopup/ui/PopupDictionary.tsx`, `src/features/dictionaryPopup/ui/OrbitalBadge.tsx`
**Acceptance criteria:**
- Uses `mountReactShadow` with z-index below orbital.
- Receives orbital pointer tip and badge center for positioning.
- Click-outside uses `composedPath()` and closes popup.
**Verification:**
- `npm run test:unit -- mountPopupDictionary`.
- Manual: orbital tip lookup opens popup near tip; click outside closes.

### T068 — Add `USE_LEGACY_POPUP_DICTIONARY` feature flag
**Phase:** 4c | **Lane:** E/Q | **Scope:** S | **Depends on:** T067  
**Files likely touched:** `src/features/dictionaryPopup/ui/mountPopupDictionary.ts`, `src/shared/config/featureFlags.ts` (new or inline)
**Acceptance criteria:**
- `USE_LEGACY_POPUP_DICTIONARY=false` uses new React popup.
- Flag `true` keeps old `popupShell.ts` path until it is deleted.
**Verification:**
- Toggle flag; verify both paths compile.
- `npm run build`.

### T070 — Unify `DictionaryTab` with `DictionaryCore`
**Phase:** 4d | **Lane:** E/H | **Scope:** M | **Depends on:** T064, T067  
**Files likely touched:** `src/features/universalPanel/tabs/DictionaryTab.tsx`, `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
**Acceptance criteria:**
- `DictionaryTab` uses the same `DictionaryCore` + `DictionaryToolbar` as popup.
- Keeps 2-pane layout (dictionary left, card creator right).
- No duplicate lookup logic.
**Verification:**
- `npm run test:unit -- DictionaryTab`.
- `npm run build`.

### T071 — Verify quick-add / send-to-card flow
**Phase:** 4d | **Lane:** E/G | **Scope:** S | **Depends on:** T070  
**Files likely touched:** `src/features/dictionaryPopup/ui/buildCandidatePrefill.ts`, `src/features/universalPanel/tabs/DictionaryTab.tsx`
**Acceptance criteria:**
- Quick Add in popup builds prefill and sends to card creator.
- Send to Card in `DictionaryTab` builds the same prefill.
- Media selections (audio/image/translation) carry over.
**Verification:**
- `npm run test:unit -- buildCandidatePrefill`.
- Manual: popup quick-add → card creator; panel send-to-card.

### T069 — Delete old popup vanilla files after parity
**Phase:** 4c/4d | **Lane:** E/Q | **Scope:** M | **Depends on:** T068, T071  
**Files likely touched:** `src/features/dictionaryPopup/ui/popupShell.ts`, `src/features/dictionaryPopup/ui/popupToolbar.ts`, `src/features/dictionaryPopup/ui/popupContent.ts`, `src/features/dictionaryPopup/ui/popupDictionary.css`
**Acceptance criteria:**
- Old files deleted only after quick-add/send-to-card parity (T071) verified.
- `PopupDictionary` is the only popup path.
- `USE_LEGACY_POPUP_DICTIONARY` flag removed once deleted.
**Verification:**
- `npm run test:unit`.
- `npm run build`.
- Manual: YouTube/Netflix/GeeksforGeeks full lookup + quick-add flow.

#### Checkpoint 4c (Popup dictionary)
- [ ] `PopupDictionary` React shell with position/resize.
- [ ] Mounted in shadow under orbital tip.
- [ ] Old vanilla files deleted.

### T072 — Add popup dictionary to design-system-showcase
**Phase:** 4d | **Lane:** I | **Scope:** S | **Depends on:** T065  
**Files likely touched:** `src/entrypoints/design-system-showcase/App.tsx`, `src/entrypoints/design-system-showcase/mockDictionary.ts` (new)
**Acceptance criteria:**
- `PopupDictionary` preview with mock lookup results.
- 4 tabs functional in isolated showcase context.
**Verification:**
- `npm run build`.
- Manual: showcase popup preview.

#### Checkpoint 4 (Dictionary complete)
- [ ] Popup and `DictionaryTab` share `DictionaryCore`.
- [ ] Feature parity matrix satisfied.
- [ ] Old vanilla code deleted.

### T073 — Create `TokenizeFab.tsx`
**Phase:** 5 | **Lane:** F | **Scope:** M | **Depends on:** T024, T046  
**Files likely touched:** `src/features/tokenize/ui/TokenizeFab.tsx`, `src/features/tokenize/ui/TokenizeFab.module.css`, `src/features/tokenize/ui/TokenizeFab.test.tsx`
**Acceptance criteria:**
- Toggle enabled / status / frequency.
- Position by edge; avoid overlap with orbital badge.
- Uses shared `Button`, `Icon`, `Toggle`.
- ARIA labels and keyboard operable.
**Verification:**
- `npm run test:unit -- TokenizeFab`.
- Manual: showcase preview.

### T074 — Create `useTokenize` hook
**Phase:** 5 | **Lane:** F | **Scope:** S | **Depends on:** T073  
**Files likely touched:** `src/features/tokenize/ui/useTokenize.ts`, `src/features/tokenize/ui/useTokenize.test.ts`
**Acceptance criteria:**
- Encapsulates tokenize state and callbacks.
- Pure; returns toggle handlers and current state.
- Reused by `TokenizeFab` and `UniversalPanel` header.
**Verification:**
- `npm run test:unit -- useTokenize`.

### T075 — Mount `TokenizeFab` in shadow root
**Phase:** 5 | **Lane:** F | **Scope:** M | **Depends on:** T024, T073  
**Files likely touched:** `src/features/tokenize/ui/mountTokenizeFab.ts` (new), `src/features/tokenize/ui/TokenizeFab.tsx`, `src/entrypoints/content/*`
**Acceptance criteria:**
- Uses `mountReactShadow` on `document.body` with z-index below orbital, above subtitle.
- FAB state bridges to `tokenizeStateStore`.
- Fullscreen re-parenting works.
**Verification:**
- `npm run test:unit -- mountTokenizeFab`.
- Manual: YouTube tokenize FAB toggles and opens mini panel.

### T076 — Clean `tokenSpanCss.ts` hardcoded tokens
**Phase:** 5 | **Lane:** F | **Scope:** S | **Depends on:** T001  
**Files likely touched:** `src/features/tokenize/ui/tokenSpanCss.ts`, `src/shared/styles/tokens.json`
**Acceptance criteria:**
- Frequency tier colors / status colors use token variables.
- No raw colors in `tokenSpanCss.ts`.
- Token spans still wrap host text in light DOM.
**Verification:**
- `rg '#[0-9a-fA-F]{3,8}' src/features/tokenize/ui/tokenSpanCss.ts` returns 0.
- Manual: token spans color by tier on subtitle.

### T077 — Delete `tokenBadge.ts` and `tokenBadgeCss.ts`
**Phase:** 5 | **Lane:** F/Q | **Scope:** S | **Depends on:** T075, T076  
**Files likely touched:** `src/features/tokenize/ui/tokenBadge.ts`, `src/features/tokenize/ui/tokenBadgeCss.ts`, `src/entrypoints/content/*`
**Acceptance criteria:**
- Old files removed; content-script callers use `mountTokenizeFab`.
- `USE_LEGACY_TOKENIZE=false` default.
**Verification:**
- `npm run test:unit`.
- `npm run build`.
- Manual: verify tokenize FAB on 3 pages.

#### Checkpoint 5 (Tokenize complete)
- [ ] `TokenizeFab` is React in shadow.
- [ ] Token spans still work in light DOM.
- [ ] Old code deleted.

### T078 — Refactor card creator components to be mount-agnostic
**Phase:** 6a | **Lane:** G | **Scope:** M | **Depends on:** T071  
**Files likely touched:** `src/features/cardCreator/ui/CardCreatorDialog.tsx`, `src/features/cardCreator/ui/CardCreatorBottomSheet.tsx`, `src/features/cardCreator/ui/QueueSidebar.tsx`
**Acceptance criteria:**
- Components receive `open`, `settings`, `queue`, callbacks via props.
- No assumption of being inside a specific mount host.
- No direct `chrome.runtime` calls from presentation components.
**Verification:**
- `npm run test:unit -- CardCreatorDialog`.
- `npm run typecheck`.

### T079 — Create `cardCreatorStore.ts`
**Phase:** 6a | **Lane:** G | **Scope:** M | **Depends on:** T078  
**Files likely touched:** `src/stores/cardCreatorStore.ts` (new), `src/features/cardCreator/ui/useCardCreatorState.ts`, `src/features/cardCreator/ui/CardCreatorDialog.tsx`
**Acceptance criteria:**
- Zustand store owns draft, decks, note types, fields, queue, toasts.
- `useCardCreatorState` reduced to a thin hook reading from store.
- Persistence and side effects unchanged.
**Verification:**
- `npm run test:unit -- cardCreatorStore`.

### T080 — Add a11y and keyboard navigation to card creator
**Phase:** 6a | **Lane:** G | **Scope:** S | **Depends on:** T078  
**Files likely touched:** `src/features/cardCreator/ui/QueueSidebar.tsx`, `src/features/cardCreator/ui/MediaList.tsx`
**Acceptance criteria:**
- Queue sidebar and media list have `aria-label`, arrow-key navigation.
- Focus visible on interactive elements.
- Reduced motion respected.
**Verification:**
- `npm run test:unit`.
- Manual: keyboard navigate queue in showcase.

#### Checkpoint 6a (Card creator core)
- [ ] Components are mount-agnostic.
- [ ] `cardCreatorStore` owns state.

### T081 — Add card creator preview to design-system-showcase
**Phase:** 6b | **Lane:** I | **Scope:** M | **Depends on:** T079  
**Files likely touched:** `src/entrypoints/design-system-showcase/App.tsx`, `src/entrypoints/design-system-showcase/mockProviders.tsx`
**Acceptance criteria:**
- Card creator opens in showcase with mock queue and media.
- No real `chrome.runtime` / AnkiConnect calls.
- Queue add/edit/reorder, field edit, preview work.
**Verification:**
- `npm run build`.
- Manual: open showcase, interact with card creator.

### T082 — Mount card creator with chosen mechanism + `USE_LEGACY_CARD_CREATOR` flag
**Phase:** 6c | **Lane:** G | **Scope:** M | **Depends on:** T031, T081  
**Files likely touched:** `src/features/cardCreator/ui/mountCardCreatorDialog.ts` (or `mountCardCreator.ts`), `src/shared/lib/shadowRoot/mountReactShadow.ts`
**Acceptance criteria:**
- If fixed-overlay PoC is GO: use `mountReactShadow`.
- If NO-GO: keep light DOM with `cell-` prefix + local reset.
- `USE_LEGACY_CARD_CREATOR` flag added, default `false`.
- Fullscreen re-parenting preserved.
**Verification:**
- `npm run build`.
- Toggle `USE_LEGACY_CARD_CREATOR`, both paths compile.
- Manual: open card creator on YouTube; verify full viewport and no CSS leak.

### T083 — Delete old vanilla card creator code
**Phase:** 6c | **Lane:** G/Q | **Scope:** M | **Depends on:** T082  
**Files likely touched:** Batch cleanup of legacy non-React card creator files identified during T078–T081; representative: `src/features/cardCreator/ui/legacy*` / `src/features/cardCreator/ui/mountCardCreator*.ts` (exact list TBD before execution)
**Acceptance criteria:**
- No vanilla card creator DOM files left.
- `USE_LEGACY_CARD_CREATOR` flag removed once deleted.
**Verification:**
- `npm run test:unit`.
- `npm run build`.

### T084 — Verify card creator queue, media, export
**Phase:** 6c | **Lane:** Q | **Scope:** S | **Depends on:** T082  
**Files likely touched:** none
**Acceptance criteria:**
- Queue, media list, field edit, preview, export to AnkiConnect work.
- No visual regression.
**Verification:**
- Manual: full card creator flow on YouTube.
- `npm run test:unit -- cardCreator`.

#### Checkpoint 6 (Card creator complete)
- [ ] Card creator React in chosen mount.
- [ ] Showcase preview works with mock data.
- [ ] Export/save to Anki works.

### T085 — Update `mountSettingsDialog` for chosen mechanism
**Phase:** 7 | **Lane:** H | **Scope:** M | **Depends on:** T031, T024  
**Files likely touched:** `src/features/settings/ui/mountSettingsDialog.ts`, `src/shared/lib/shadowRoot/mountReactShadow.ts`, `src/features/settings/ui/SettingsDialog.tsx`
**Acceptance criteria:**
- Uses `mountReactShadow` if fixed-overlay PoC GO, otherwise light DOM + `cell-` prefix.
- Reuses `SettingsDialog` React component unchanged.
- Theme toggle and save/load still work.
**Verification:**
- `npm run test:unit -- mountSettingsDialog`.
- Manual: open settings from orbital badge; verify all sections.

### T086 — Add `USE_LEGACY_SETTINGS` flag
**Phase:** 7 | **Lane:** H | **Scope:** S | **Depends on:** T085  
**Files likely touched:** `src/features/settings/ui/mountSettingsDialog.ts`
**Acceptance criteria:**
- `USE_LEGACY_SETTINGS=false` uses new mount.
- `true` keeps previous light-DOM path during verification.
**Verification:**
- `npm run build`.

### T087 — Verify settings save/load and theme
**Phase:** 7 | **Lane:** Q | **Scope:** S | **Depends on:** T085  
**Files likely touched:** none
**Acceptance criteria:**
- All settings sections render and persist.
- Theme toggle updates the shadow host / light-DOM host.
**Verification:**
- Manual: change settings on YouTube, reload, verify persistence.

#### Checkpoint 7 (Settings complete)
- [ ] Settings dialog mounts via chosen mechanism.
- [ ] Theme and persistence work.

### T088 — Update `mountUniversalPanel` for chosen mechanism + `USE_LEGACY_UNIVERSAL_PANEL` flag
**Phase:** 8 | **Lane:** H | **Scope:** M | **Depends on:** T031, T024, T071, T075, T082, T085  
**Files likely touched:** `src/features/universalPanel/mountUniversalPanel.ts`, `src/features/universalPanel/UniversalPanel.tsx`, `src/shared/lib/shadowRoot/ShadowThemeProvider.tsx`
**Acceptance criteria:**
- Uses `mountReactShadow` if fixed-overlay PoC GO; otherwise light DOM + `cell-` prefix.
- `USE_LEGACY_UNIVERSAL_PANEL` flag added, default `false`.
- Keeps fixed full-viewport host + `pointer-events: none`.
- Fullscreen re-parenting of host + theme style works.
**Verification:**
- `npm run test:unit -- mountUniversalPanel`.
- Toggle `USE_LEGACY_UNIVERSAL_PANEL`, both paths compile.
- `npm run build`.

### T089 — Update `getHosts()` and click-outside to `composedPath()`
**Phase:** 8 | **Lane:** H | **Scope:** S | **Depends on:** T088  
**Files likely touched:** `src/features/universalPanel/mountUniversalPanel.ts`, `src/features/universalPanel/UniversalPanelController.ts`
**Acceptance criteria:**
- Click-outside logic uses `event.composedPath()` when shadow DOM.
- Light-DOM path still uses `event.target` fallback.
- Panel closes correctly when clicking outside.
**Verification:**
- `npm run test:unit -- UniversalPanelController`.
- Manual: open panel, click outside, panel closes.

### T090 — Replace `injectThemeTokens` / `syncElementTheme` in shadow mounts
**Phase:** 8 | **Lane:** H/B | **Scope:** M | **Depends on:** T088  
**Files likely touched:** `src/features/universalPanel/mountUniversalPanel.ts`, `src/features/cardCreator/ui/mountCardCreatorDialog.ts`, `src/features/settings/ui/mountSettingsDialog.ts`, `src/shared/lib/themeTokens.ts`
**Acceptance criteria:**
- Shadow mounts use `ShadowThemeProvider` + `injectShadowCss`.
- Light-DOM fallback keeps `themeTokens.ts`.
- `injectThemeTokens` only deleted after no callers remain.
**Verification:**
- `npm run build`.
- Manual: light/dark switch inside panel and card creator.

### T091 — Verify UniversalPanel tabs and fullscreen
**Phase:** 8 | **Lane:** Q | **Scope:** M | **Depends on:** T088, T089, T090  
**Files likely touched:** none
**Acceptance criteria:**
- Dictionary, settings, card creator, tokenize toggle all work.
- Fullscreen video: panel stays visible.
- No CSS leak, no event retarget bugs.
**Verification:**
- Manual: YouTube/Netflix fullscreen, switch tabs, open card creator.
- `npm run test:unit -- universalPanel`.

#### Checkpoint 8 (UniversalPanel complete)
- [ ] UniversalPanel mounts via chosen mechanism.
- [ ] Tabs, fullscreen, theme work.
- [ ] Old theme injection retired if possible.

### T092 — Build auto-discovery scanner
**Phase:** 9 | **Lane:** I | **Scope:** M | **Depends on:** T018  
**Files likely touched:** `src/entrypoints/design-system-showcase/autoDiscovery.ts` (new), `src/entrypoints/design-system-showcase/App.tsx`, `src/entrypoints/design-system-showcase/main.tsx`
**Acceptance criteria:**
- Vite `import.meta.glob` scans `src/shared/ui/*.showcase.tsx` and `src/features/*/ui/*.showcase.tsx`.
- Discovered modules rendered in grouped sections.
- Components without `.showcase.tsx` get a default preview from prop types where feasible.
**Verification:**
- `npm run build`.
- Manual: add a `.showcase.tsx`, run build, it appears.

### T093 — Create `.showcase.tsx` for shared UI (action & input)
**Phase:** 9 | **Lane:** I | **Scope:** M | **Depends on:** T092  
**Files likely touched:** `src/shared/ui/Button.showcase.tsx`, `src/shared/ui/IconButton.showcase.tsx`, `src/shared/ui/Input.showcase.tsx`, `src/shared/ui/Select.showcase.tsx`, `src/shared/ui/Toggle.showcase.tsx`
**Acceptance criteria:**
- Each file exports a `Showcase` component and `showcaseMeta`.
- Auto-discovered and rendered.
- No duplicate default `App.tsx` edits.
**Verification:**
- `npm run build`.
- Manual: open showcase, see action/input group.

### T094 — Create `.showcase.tsx` for shared UI (feedback & data)
**Phase:** 9 | **Lane:** I | **Scope:** M | **Depends on:** T092  
**Files likely touched:** `src/shared/ui/Alert.showcase.tsx`, `src/shared/ui/Badge.showcase.tsx`, `src/shared/ui/Card.showcase.tsx`, `src/shared/ui/Skeleton.showcase.tsx`, `src/shared/ui/EmptyState.showcase.tsx`
**Acceptance criteria:**
- Feedback and data-display components have showcases.
- Rendered by auto-discovery.
**Verification:**
- `npm run build`.
- Manual: showcase feedback/data group.

### T095 — Create `.showcase.tsx` for overlay & navigation components
**Phase:** 9 | **Lane:** I | **Scope:** M | **Depends on:** T092  
**Files likely touched:** `src/shared/ui/Dialog.showcase.tsx`, `src/shared/ui/Drawer.showcase.tsx`, `src/shared/ui/Tabs.showcase.tsx`, `src/shared/ui/Tooltip.showcase.tsx`, `src/shared/ui/NavItem.showcase.tsx`
**Acceptance criteria:**
- Overlay and navigation components have composed examples.
- No `createPortal` abstraction created unless a component actually uses `createPortal`.
**Verification:**
- `npm run build`.
- Manual: showcase overlay/nav group.

### T096 — Create `.showcase.tsx` for feature components
**Phase:** 9 | **Lane:** I | **Scope:** M | **Depends on:** T036, T050, T073, T065, T078  
**Files likely touched:** `src/features/subtitle/ui/SubtitleBlock.showcase.tsx`, `src/features/dictionaryPopup/ui/OrbitalBadge.showcase.tsx`, `src/features/tokenize/ui/TokenizeFab.showcase.tsx`, `src/features/dictionaryPopup/ui/PopupDictionary.showcase.tsx`, `src/features/cardCreator/ui/CardCreatorDialog.showcase.tsx`
**Acceptance criteria:**
- Feature components have `.showcase.tsx` with mock data.
- Auto-discovered and rendered.
- No real `chrome.runtime` calls in showcase.
**Verification:**
- `npm run build`.
- Manual: showcase feature group.

### T097 — Create `MockProviders` for data-dependent showcases
**Phase:** 9 | **Lane:** I | **Scope:** M | **Depends on:** T092  
**Files likely touched:** `src/entrypoints/design-system-showcase/mockProviders.tsx`, `src/entrypoints/design-system-showcase/App.tsx`
**Acceptance criteria:**
- Providers supply mock cues, dictionary results, card creator state.
- Components consume mocks instead of real stores.
- No `chrome.runtime` in showcase.
**Verification:**
- `npm run test:unit -- mockProviders`.
- `npm run build`.

### T098 — Auto-scan icon grid and token swatches
**Phase:** 9 | **Lane:** I | **Scope:** S | **Depends on:** T092  
**Files likely touched:** `src/entrypoints/design-system-showcase/autoDiscovery.ts`, `src/entrypoints/design-system-showcase/App.tsx`
**Acceptance criteria:**
- `ICON_CATALOG` rendered as icon grid automatically.
- `tokens.json` rendered as token swatches (color, spacing, radius, typography).
- Updates when catalog/tokens change without `App.tsx` edits.
**Verification:**
- `npm run build`.
- Manual: add an icon to `ICON_CATALOG`, rebuild, grid updates.

### T099 — Final system verification
**Phase:** 9 | **Lane:** Q | **Scope:** M | **Depends on:** T091–T098  
**Files likely touched:** none
**Acceptance criteria:**
- `npm run typecheck` passes.
- `npm run test:unit` passes (coverage maintained ≥ 80%).
- `npm run build` and `npx vite build --mode development` pass.
- Manual: YouTube, Netflix, GeeksforGeeks full flows.
- Bundle/RAM within budget.
**Verification:**
- `npm run typecheck && npm run test:unit && npm run build && npx vite build --mode development`.
- Chrome DevTools MCP on 3 sites.
- Bundle analyzer / DevTools Memory.

#### Checkpoint 9 (Showcase & final)
- [ ] Showcase auto-discovers all components.
- [ ] All builds, tests, manual checks pass.
- [ ] Bundle/RAM within budget.

## 7. Checkpoints, risks, open questions

### 7.1 Feature-flag / rollback summary

| Flag | Default | Use | Removed after | Task |
|---|---|---|---|---|
| `USE_LEGACY_SUBTITLE` | `false` | Revert to `subtitleBlockDom.ts` etc. | Phase 2b verified | T046 |
| `USE_LEGACY_ORBITAL` | `false` | Revert to old `createOrbitalBadge.ts` mount | Phase 3c verified | T053 |
| `USE_LEGACY_POPUP_DICTIONARY` | `false` | Revert to `popupShell.ts` | Phase 4d verified | T068 |
| `USE_LEGACY_TOKENIZE` | `false` | Revert to `tokenBadge.ts` | Phase 5 verified | T075 |
| `USE_LEGACY_CARD_CREATOR` | `false` | Revert to old light-DOM mount | Phase 6c verified | T082 |
| `USE_LEGACY_SETTINGS` | `false` | Revert to old light-DOM mount | Phase 7 verified | T086 |
| `USE_LEGACY_UNIVERSAL_PANEL` | `false` | Revert to old light-DOM mount | Phase 8 verified | T088 |

For every UI replacement, the new code and flag are committed together. Legacy files are deleted in the *following* commit only after build, unit, and manual tests on all 3 sites pass.

### 7.2 Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `position: fixed` overlay trapped in shadow host | High | Phase 1b PoC on YouTube fullscreen; NO-GO → keep light DOM + `cell-` reset. |
| `?inline` CSS modules do not work in Jest | Medium | Add moduleNameMapper (T022) and an `inlineMock.ts`. |
| Bundle size > 2× baseline | High | Single shadow host per feature, lazy load popup/card creator, measure after each phase. |
| Shadow DOM event retargeting breaks click-outside/focus | High | Use `composedPath()` and `getRootNode().activeElement` in `useShadowFocusTrap` and panel controllers. |
| Token migration breaks existing UI | Medium | Keep aliases in Phase 0a–0b; remove only after all callers migrated; tag commit. |
| Fullscreen re-parenting lost | High | Preserve host-move logic and theme `<style>` move in `mountReactShadow` and each mount. |
| Coverage drops below 80% | Medium | Write new tests for every React component/hook before deleting legacy tests. |
| `createPortal` needed later | Low | Do not create `PortalContainerContext` until a real use case exists (YAGNI). |

### 7.3 Open questions / blocking gates

1. **Fixed overlay GO/NO-GO** (T031): Does a `position: fixed; inset: 0` host inside an open shadow root on YouTube fullscreen stay full viewport? If NO-GO, card creator / settings / universal panel stay in light DOM.
2. **Constructable `adoptedStyleSheets`** (T025, optional): If PoC proves viable later, should we switch from `<style>` injection to shared `CSSStyleSheet` to reduce memory? **Decision: not in this plan; document as future optimization in ADR-075.**
3. **Portal container** (across all phases): Current `src/` has 0 `createPortal` calls. Do not add `PortalContainerContext` unless a Dialog/Drawer/Tooltip actually needs a portal.
4. **Token span isolation** (T076): Token spans must stay in light DOM. Confirm `tokenSpanCss.ts` only injects variable-based styles and does not leak layout.
5. **Feature flag location** (T046, T068, etc.): Should flags live in `src/shared/config/featureFlags.ts` or be local constants? **Assumption:** start as local constants; promote to a shared file only if reused across >1 feature.

### 7.4 Verification gating (every task)

Every task must pass the following before being marked done:
- `npm run typecheck` passes for the affected files.
- New unit tests pass (`npm run test:unit -- <pattern>`).
- `npm run build` passes after each phase.
- Manual check on at least one of YouTube / Netflix / GeeksforGeeks for content-script UI changes.
- No new hardcoded colors/spacing/z-index outside `tokens.json` (use the audit commands in `STANDARD.md`).

### 7.5 Assumptions made while planning

- `ShadowButtonPoC` (existing) proves the `?inline` CSS injection mechanism works; the plan formalizes it into `mountReactShadow` / `injectShadowCss`.
- `cardCreatorStore.ts` and `orbitalBadgeStore.ts` are created in `src/stores/` following the `themeStore.ts` pattern.
- Existing `useCandidate.ts` and `useDictionaryPanel.ts` will be refactored in place to use the new `DictionaryCore` hooks; no net-new duplicate stores.
- `components.css?raw` (global non-hashed utility classes) continues to be needed until all `.btn` / `.icon-btn` class-based markup is migrated to shared `Button` / `IconButton` components.
- No `manifest.json` changes and no new npm dependencies are planned; any such need is an "ask first" gate.
- The old dictionary-candidate-list plan in `tasks/plan.md` and `tasks/todo.md` remains untouched.
