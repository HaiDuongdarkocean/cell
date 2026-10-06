# Plan: up-token-atom-debt — Token & atom SSOT cleanup (DELIVER)

> Spec: `docs/specs/up-token-atom-debt.md` · Intent: `docs/intent/up-token-atom-debt.md` · Review r2: `docs/reviews/up-token-atom-debt-spec.md` · Mode: all, ui_surface: no

## Goal

One mechanical SSOT pass over the universal-panel surface: canonical token names, byte-equivalent literal→token swaps, single tab registry, native controls → `src/shared/ui` atoms, `pushEscapeLayer` adoption, shell-craft corrections, scoped `undefined-token` gate.

## Task breakdown

### T1 — REQ-1/REQ-2: CSS token corrections + literal swaps (AC-1, AC-2, AC-6)

Files:
- `src/features/studyModes/ui/StudyModesTab.module.css` — 5× `--borderWidth-hairline, 1px` → `--border-width-hairline`; 2× `font-weight: 600` → `var(--font-weight-semibold)`.
- `src/features/sessionRecap/ui/RecapTab.module.css` — `--font-sizes-xs` → `--font-size-xs` (×2, accepted deltas D1/D2); `--font-weights-semibold, 600` → `--font-weight-semibold`; `--motion-duration-fast, 120ms` → `--duration-fast`; `--radius-full, 999px` → `--radius-pill`.
- `src/features/universalPanel/tabs/PlaylistTab.module.css` — drop dead fallbacks; `--error`/`--success` → `--color-error`/`--color-success`.
- `--radius-full` → `--radius-pill` converged 7-file set: `NavItem` (+ `border-radius: 50%` → `--radius-pill`), `VocabularyTab`, `SettingsDialog`, `RecapTab`, `FieldRow`, `CandidateView`, `DictionaryCheckable`. Token itself stays defined.
- Literals staying literal (not swapped): `94%`, `0.04em`, `ease-in-out`.

### T2 — REQ-3: `panelTabs.ts` registry (AC-3)

- New `src/features/universalPanel/panelTabs.ts` exporting `PanelTabEntry` + `PANEL_TABS` (`key`/`icon`/`label`/`shortLabel`, sidebar order).
- `UniversalPanel.tsx` sidebar items consume `tab.label`; `UniversalPanelBottomNav.tsx` consumes `tab.shortLabel`; both local `TABS` deleted; `data-cell-id` values unchanged; `TOOLS` stays in `UniversalPanel.tsx`.

### T3 — REQ-4: native controls → shared atoms (AC-4, AC-5)

- Additive `variant="unstyled"` on `Button` (bare element, children unwrapped — no `.label` span, no ripple attrs), `Input` (no wrapper divs), `Textarea` (+ `ref?: Ref<HTMLTextAreaElement>` React-19 prop). Default-preserving.
- `FieldRow.tsx`: `FieldAutoGrowInput` `<textarea>` → `Textarea unstyled` (keeps `rows={lineCount}` + `field-sizing: content`); TagInput `<input>` → `Input unstyled`; `handleKeyDown` gains `e.nativeEvent.isComposing` guard (D3).
- `CandidateView.tsx`: 3× `<button>` → `Button unstyled` (accent toggle, empty-state link, `defLineReveal` with Icon as direct child); 3× decorative `<input type="checkbox">` deleted, `<label>` → `<span>`, label `stopPropagation` dropped so marker clicks bubble to the row's `onClick`.
- `VocabularyTab.tsx`: `Icon` from `@/shared/ui/Icon`; `size={16}` → `"xs"`; `size={14}` numeric stays; bare usages stay default.

### T4 — REQ-5: Escape via `pushEscapeLayer` (AC-7)

- `UniversalPanel.tsx`: delete `handleKeyDown`/`onKeyDown`/`defaultPrevented` dance → `pushEscapeLayer` in effect gated on `isOpen`, `onClose` ref-pinned `[isOpen]` dep only.
- Atoms `Dialog`/`BottomSheet`/`Drawer`: same atom migration — `onOpenChange` ref-pinned, layer while `open`, overlay `onKeyDown` deleted.
- Transient layers: `ResourceCard` (while `renaming`), `DictLinksManager` (while `renamingId !== null`), `MultiSelect` (while `focused` → `inputRef.current?.blur()`), `useSectionDrag` (layer inside the drag-session effect → `endDrag(false)`); input Escape branches dropped (Enter commit stays).
- `popupLifecycle.ts`: `onStackKeydown` replaced by one `pushEscapeLayer` pushed on `popupStack.push` 0→1, unregistered when `closeFromLevel` empties and in `dispose`; handler = `closeFromLevel(isSheetMode() ? 0 : idx >= 0 ? idx : popupStack.length - 1)` where `idx` = `findIndex` over `e.composedPath()` ⊇ `level.mount.host` (same lookup as `onStackPointerDown`). `Dictionary.tsx` Escape `onKeyDown` deleted.
- Capture consumers: `regionSelector` → window capture + `preventDefault` on cancel; `PlayerModeOverlay` → window capture; `statusKeyControls` → `preventDefault` only when it consumed (selection/hover actually cleared).
- Pass-throughs unchanged: `ShortcutInput`, `SubtitlePractice`, `Surface`, `ManagerLayer`, `mountReactShadow`, `contentScriptKeyboard`.

Recorded deltas (accepted, per spec): D4 panel Escape document-global; D5 dictionary-popup two paths merge into one layer (composedPath preserves focused-level pop); D6 one-Escape-one-layer during player mode/region select; D7 unreachable mid-drag panel-open ordering; D8 Dialog/BottomSheet/Drawer Escape document-global.

### T5 — REQ-6: shell craft (AC-8)

- `UniversalPanel.tsx`: delete `role="presentation"` on backdrop; docstring → centered 94% modal / left rail / ≤839px bottom nav / ≤599px full-screen; `setVisitedTabs` moved to `useEffect`, panes gated on `visitedTabs.has(tab) || tab === activeTab`; `{activeTab === 'recap' && recapPanel}` verbatim.
- `UniversalPanel.module.css`: `will-change` deleted outright (not moved to `.open`/`.close`).

### T6 — REQ-7: checker covers feature dirs (AC-9, AC-10)

- `scripts/check-design-system-css.mjs`: positional `path…` (multiple) bypass `shouldExclude`; `--rules <csv>` filters emitted rule IDs (`parse-error` exempt — always reports + exits non-zero); explicit paths resolving to zero files → exit 2.
- `package.json`: new `check-design-system-css:features` script scoped to the seven dirs + `--rules undefined-token`; appended to `prebuild` after `check-feature-cycles.mjs`.

### T7 — Tests

- `UniversalPanel.test.tsx`: `:218` unchanged; `:237`/`:297` comments name the stack (assertions identical); `:262` unchanged.
- `ResourceCard.test.tsx:197`, `ResourcesPanel.test.tsx:929`: unchanged behavior + new "panel layer not invoked" assertion via stub `pushEscapeLayer`.
- `Dictionary.test.tsx`: removed Surface `onKeyDown` case retargeted to `popupLifecycle` — Escape pops composedPath-resolved level (focused level / top level when focus outside), non-Escape ignored.
- `SearchableSelect.test.tsx`: unchanged.

## Gates

`npm run typecheck && npm run lint && npm run test:unit && npm run build` + `npm run check-design-system-css:features` (exit 0) + default `check-design-system-css` unchanged behavior.

## Risks / notes

- REQ-5 file span extends to `features/{ocr,tokenize,subtitle,dictionary,dictionaryPopup,settings}` + `shared/{ui,lib}` — forced by document-capture stack (recorded in review r2, bounded by NFR-4).
- `check-design-system-css` (default shared/ui scope) has 6 pre-existing undefined-token findings on committed code (runtime-injected custom props: `--radio-border`, `--mobile-sheet-*`, `--ink-*`, `--breadcrumb-separator`) — pre-dates this work; repo-wide gating deferred per spec Boundaries.
- jsdom `fireEvent.keyDown` dispatches real DOM events → document capture listener fires — tests exercise the real stack.
