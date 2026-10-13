# Plan — subtitle-bulk-status

> Spec: `docs/specs/subtitle-bulk-status.md` · Design: `docs/intent/subtitle-bulk-status-design-brief.md` (Concept B — Water wash, approved) · Mapping: `docs/intent/subtitle-bulk-status-component-mapping.md`

## Slices (ordered; each ends green: typecheck + targeted unit tests)

### 1. Root-union selection extraction — REQ-2
- `src/features/tokenize/utils/selectionTerms.ts`: effective allowed roots = `document` ∪ registered shadow roots (registering a panel root must not exclude document/overlay selections).
- Tests: light-DOM only, shadow only, mixed roots, dedupe.

### 2. Selected-state CSS (Water wash) — REQ-4
- `src/features/tokenize/ui/tokenSpanCss.ts`:
  - `Tihoka_TOKEN_MAP` += `--Tihoka-token-selected-bg` → resolved primary-subtle-ish wash (~18% `color-mix` of primary, resolved like existing entries).
  - `buildTokenSpanCss` + `buildTokenSpanCssForShadow`: `.js-Tihoka-token` + selected modifier → `background-image` wash overlay; add selected to the known/ignore underline-reveal selector group.
- Tests: CSS builder emits the rule in both variants; `tokenSpanCss.test.ts` extension.

### 3. Selection API on subtitle controller — REQ-3
- `createSubtitleTokenizeController`: expose minimal selection surface (toggle term, read set, subscribe, clear) over its private store — the same store `statusKeyControls` reads. Web controller untouched.
- Tests: toggle/clear/subscribe semantics.

### 4. CueList ctrl/cmd+click + selected rendering — REQ-3
- `src/features/subtitle/ui/CueList.tsx`: `CueListTokenize` opt-in selection members (select-toggle callback + selected-term source); ctrl/meta+click intercepted before `onTokenClick`; selected tokens get the modifier class; non-opt-in consumers unchanged.
- Tests: ctrl+click toggles, plain click still fires `onTokenClick`, class rendered, opt-out path.

### 5. aria-live selection announcements — REQ-4
- One document-level `VisuallyHidden` `aria-live="polite"` region per page (streaming content script + local player); announce count + cleared via i18n (`en.json` + `vi.json`).
- Tests: message content, dedupe.

### 6. Local-player subtitle tokenize controller — REQ-1, REQ-6
- Composition root wiring (`src/entrypoints/local-player/`): `createSubtitleTokenizeController` with `getLineElements` (live overlay only, exclude `OverlayPreview`), `getExtraShadowRoots` → `[data-tihoka-split-view="panel"].shadowRoot`, `onOpenDictionary` → `webTextCtrl.handleLookup`, `getPopupStatusTarget` → `webTextCtrl.getPopupStatusTarget`; `cuesStore` subscription → `setCues`/`render`; destroy on language change/teardown; selection cleared on destroy.
- Tests: lifecycle, wiring, cue-driven render.

### 7. Gates + verification
- `npm run typecheck && npm run lint && npm run test:unit && npm run build`.
- Existing e2e stay green: `e2e/stage2/bulk-status-selection.spec.ts`, `e2e/stage2/popup-status-keys.spec.ts`.
- Real-Chrome verify per spec DoD: streaming overlay + split view + Player Mode, local-player block + panel; select→1–4, ctrl+click→1–4, Esc, popup priority, cross-surface repaint.
- Update `docs/2-architechture-system.md` + `docs/0-wiki.md`; delete `src/entrypoints/mockup-subtitle-bulk-status/` at ship.

## Dependencies / risks
- Pipeline slot held by `vocabulary-tab-redesign` (deliver) — init/transitions run when it ships.
- Shadow-list merging is avoided entirely by the wash channel (background-image) — the design decision halves implementation surface vs. ring/tick.
