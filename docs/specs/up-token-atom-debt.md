# Spec: up-token-atom-debt — Token & atom SSOT cleanup on the Universal Panel surface

> Intent: `docs/intent/up-token-atom-debt.md` · ui_surface: no · Mode: all

## Objective

Execute one mechanical SSOT pass over the universal-panel surface: correct every undefined `var(--*)` name to its canonical token, swap literals that have byte-equivalent tokens, collapse the duplicated `TABS` registry into one module, migrate native controls in `FieldRow.tsx`/`CandidateView.tsx` to `src/shared/ui` atoms, adopt `pushEscapeLayer` across the panel and every non-stack Escape consumer reachable while it is open, fix four shell-craft defects, and modify `check-design-system-css.mjs` so an explicit feature-dir arg actually gets checked — then wire a scoped `undefined-token` run into the build gate. Contract: zero rendered diff; the only accepted visual deltas are `.when` (inherited ~14px) and `.statusChip` (a `<button>`, so its live size today is the UA stylesheet ~13.3px — not inherited 14px) in `RecapTab.module.css` resolving to the designed `--font-size-xs` (12px), plus the recorded behavioral deltas: D3 (IME-composition guard on the tag input's commit keys) and the REQ-5 Escape deltas enumerated in that REQ (panel Escape becomes document-global).

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Maintainer/agent (this pipeline item's owner) | Runs the cleanup task | Edits to the named source files; runs npm scripts | Gates: `typecheck`, `lint`, `test:unit`, `build` (incl. the new scoped check); audit greps; before/after captures |
| CI/local build (`npm run build` → `prebuild`) | Any future build | `.module.css` files under the touched feature dirs | Non-zero exit + finding list when an undefined `var(--*)` is introduced |
| End user | — none — | — | Identical UI; only `.when`/`.statusChip` render 12px as designed |

System-internal processing never includes human behavior. The "system" here = the checked-in artifacts (TSX/CSS modules/registry/checker) plus the checker script's evaluation of them.

## Requirements

### Functional

REQ-1: Token-name corrections (F-6)
- Actor: Maintainer
- Goal: Every `var(--*)` in the touched CSS modules names a defined token; redundant fallbacks dropped.
- Preconditions: `tokens.css` is generated and current (prebuild runs `generate-tokens.js` first).
- Basic flow:
  1. actor applies the swap table below
  2. system resolves each `var(--*)` against the token registry
  3. system renders byte-identical output except the two no-fallback sites
- Swap table (undefined name → canonical reference; literal fallbacks dropped where they duplicate the token value):

  | File:line | From | To |
  |---|---|---|
  | `StudyModesTab.module.css:100,105,121,134,191` | `var(--borderWidth-hairline, 1px)` | `var(--border-width-hairline)` |
  | `RecapTab.module.css:54` | `var(--font-sizes-xs)` (no fallback — `.when` inherits ~14px) | `var(--font-size-xs)` — **accepted delta D1** |
  | `RecapTab.module.css:102` | `var(--font-sizes-xs)` (no fallback — `.statusChip` is a `<button>`, so live size = UA ~13.3px) | `var(--font-size-xs)` — **accepted delta D2** (found in SPECIFY; same defect class as D1, missed by the intent's `.when`-only callout; magnitude note corrected in REVIEW — 13.3→12px, not 14→12) |
  | `RecapTab.module.css:103` | `var(--font-weights-semibold, 600)` | `var(--font-weight-semibold)` |
  | `RecapTab.module.css:168` | `var(--motion-duration-fast, 120ms)` | `var(--duration-fast)` |
  | `PlaylistTab.module.css:10` | `var(--color-border-subtle, #e3e3e0)` | `var(--color-border-subtle)` (dead hex fallback dropped) |
  | `PlaylistTab.module.css:10,14` | `var(--border-width-thick, 2px)` | `var(--border-width-thick)` (redundant `2px` fallback dropped on the two lines already being edited — token = 2px) |
  | `PlaylistTab.module.css:14,67,75` | `var(--error, var(--color-error))` | `var(--color-error)` |
  | `PlaylistTab.module.css:71` | `var(--success, var(--color-success))` | `var(--color-success)` |

- Alt flow: none — the table is exhaustive for the touched files.
- Exception: a `var(--*)` whose canonical name does not exist in the registry → stop; do not invent tokens (see Boundaries).
- Rules: canonical names verified against `src/shared/styles/tokens.css` (`--border-width-hairline:1px`, `--border-width-thick:2px`, `--font-size-xs:12px`, `--font-weight-semibold:600`, `--duration-fast:120ms`, `--color-error`, `--color-success` — all defined).
- Postcondition: zero `undefined-token` findings in the touched files.
- NFR refs: NFR-1, NFR-2

REQ-2: Literal→token swaps — byte-equivalent only (F-22)
- Actor: Maintainer
- Goal: Literals duplicating an existing token read the token; deprecated alias `--radius-full` converges to `--radius-pill` (both = 9999px) in the enumerated file set.
- Basic flow: actor applies the table; system renders identically because every replacement is byte-equivalent at the usage site.

  | File:line | From | To | Equivalence proof |
  |---|---|---|---|
  | `StudyModesTab.module.css:153,188` | `font-weight: 600` | `var(--font-weight-semibold)` | token = 600 |
  | `NavItem.module.css:163` | `border-radius: 50%` | `var(--radius-pill)` | element is `width=height=var(--touch-target)` (square) → 50% ≡ 9999px |
  | `NavItem.module.css:102` | `var(--radius-full)` | `var(--radius-pill)` | alias, both 9999px (found in SPECIFY; same file, same rule) |
  | `VocabularyTab.module.css:122` | `var(--radius-full)` | `var(--radius-pill)` | alias |
  | `SettingsDialog.module.css:171` | `var(--radius-full)` | `var(--radius-pill)` | alias |
  | `RecapTab.module.css:101` | `var(--radius-full, 999px)` | `var(--radius-pill)` | alias; fallback was dead code |
  | `FieldRow.module.css:177,197` | `var(--radius-full)` | `var(--radius-pill)` | alias (file already touched by REQ-4; same rule, found in SPECIFY) |
  | `CandidateView.module.css:149,237` | `var(--radius-full)` | `var(--radius-pill)` | alias (found in REVIEW; sibling `.cellDefCheck*` styling verified by REQ-4) |
  | `DictionaryCheckable.module.css:93` | `var(--radius-full)` | `var(--radius-pill)` | alias (found in REVIEW; REQ-4 verifies this file's contract) |

- **`--radius-full` converged file set (complete)**: `NavItem.module.css`, `VocabularyTab.module.css`, `SettingsDialog.module.css`, `RecapTab.module.css`, `FieldRow.module.css`, `CandidateView.module.css`, `DictionaryCheckable.module.css` — 7 files.
- Remaining alias sites inside the seven gated dirs stay on `--radius-full` — **Out** (untouched surfaces; the alias is deprecated but still valid): `CardCreatorSettingsPanel.module.css:114`, `MediaList.module.css:294,331`, `QueueSidebar.module.css:115`, `DictionaryPanelView.module.css:236,302,332`, `DictionaryToolbar.module.css:27,61`, `OrbitalBadge.module.css:4,39,79,91,95,99,103`, `PopupDictionary.module.css:140`, `PronunciationAudioPanel.module.css:90`, `DictionaryPopupSettingsPanel.module.css:34,81`, `LanguageProfilePanel.module.css:186,196`, `WordBadgeSettingsPanel.module.css:23` — 23 sites in 11 files. A repo-wide alias sweep is a follow-up item, not this one.
- Alt flow (stays literal — no byte-equivalent, explicitly NOT swapped): `94%` modal size (`UniversalPanel.module.css:12-13`), `0.04em` tracking (`VocabularyTab.module.css:66`; `--tracking-wide` = 0.03em), `ease-in-out` keyword (`NavItem.module.css:28-31,147`; token resolves `cubic-bezier(0.4,0,0.2,1)` vs keyword `cubic-bezier(0.42,0,0.58,1)` — real curve delta).
- Exception: literal whose nearest token is not byte-equivalent → stays literal; do not invent tokens.
- Rules: `--radius-full` stays defined in `tokens.json` (~180 repo usages; its removal is out of scope).
- Postcondition: no `--radius-full` and no duplicating literals in the converged file set.
- NFR refs: NFR-1

REQ-3: Single tab registry `panelTabs.ts` (F-20)
- Actor: Maintainer
- Goal: Add/rename/reorder a panel tab is a single-site, type-checked edit consumed by both nav surfaces.
- Preconditions: both `TABS` copies exist (`UniversalPanel.tsx:52-59` sidebar full labels; `UniversalPanelBottomNav.tsx:29-36` short labels) and already diverge in label keys + icon typing.
- Basic flow:
  1. actor creates `src/features/universalPanel/panelTabs.ts` (NOT `tabs.ts` — collides with `src/shared/lib/chrome-apis/tabs.ts`)
  2. system exports:

     ```ts
     export interface PanelTabEntry {
       readonly key: UniversalPanelTab;
       readonly icon: keyof typeof ICON_CATALOG;
       readonly label: MessageKey;      // sidebar rail (full)
       readonly shortLabel: MessageKey; // mobile bottom nav
     }
     export const PANEL_TABS: readonly PanelTabEntry[] = [
       { key:'dictionary', icon:'bookOpen',          label:'panel.tab.dictionary', shortLabel:'panel.tab.dictionary' },
       { key:'vocabulary', icon:'scanText',          label:'panel.tab.vocabulary', shortLabel:'panel.tab.vocabularyShort' },
       { key:'studyModes', icon:'slidersHorizontal', label:'panel.tab.studyModes', shortLabel:'panel.tab.studyModesShort' },
       { key:'playlist',   icon:'audioWave',         label:'panel.tab.playlist',   shortLabel:'panel.tab.playlistShort' },
       { key:'recap',      icon:'clock',             label:'panel.tab.recap',      shortLabel:'panel.tab.recapShort' },
       { key:'settings',   icon:'settings',          label:'panel.tab.settings',   shortLabel:'panel.tab.settings' },
     ];
     ```
  3. `UniversalPanel.tsx` consumes `PANEL_TABS` → `CollapsibleSidebar` items (`label`); `UniversalPanelBottomNav.tsx` consumes `PANEL_TABS` → nav `Button`s (`shortLabel`). Both local `TABS` arrays deleted.
- Alt flow: future tab add → one entry; both surfaces update.
- Exception: a `…Short` key missing in `en.json`/`vi.json` → typecheck fails (keys typed via `MessageKey`); all six pairs verified present.
- Rules: registry order = current sidebar order; `data-cell-id` attributes (`universal-panel-tab-<key>`, `universal-panel-mobile-tab-<key>`) generated from `tab.key`, unchanged; `TOOLS` stays in `UniversalPanel.tsx` (not part of this registry).
- Postcondition: one source of truth; every current label (full + `…Short`) still resolves.
- NFR refs: NFR-4

REQ-4: Native controls → shared atoms (F-21)
- Actor: Maintainer
- Goal: No native `<button>`/`<input>`/`<textarea>` remains in `FieldRow.tsx`/`CandidateView.tsx`; `VocabularyTab.tsx` uses the public `Icon` barrel; visuals and behavior byte-stable.
- Preconditions: atoms exist but impose their own chrome (`Button` forces `min-height: var(--touch-target)` + fixed height + padding/border; `Input` wraps in `.root`/`.wrapper` divs; `Textarea` paints `.textarea` border/radius/bg/`resize`) — consumer classes (`cellAccentLabel`, `cellEmptyLink`, `defLineReveal`, `fieldInput__control`, `tagInput__field`) were written to style a bare element, so a naive swap drifts visually.
- Basic flow:
  1. actor adds a minimal **`variant="unstyled"`** to `Button`, `Input`, `Textarea`: renders the bare element with only consumer `className` + a11y wiring (`aria-invalid`/`aria-busy`, `disabled||loading`) — no chrome classes, no wrapper divs (Input), no auto-ripple (Button). For `Button`, `unstyled` renders `{children}` **unwrapped** — no `.label` span (`Button.tsx:143`), no `data-cell-ripple-self` (`:137`), no icon-slot spans — so `.defLineReveal > span` keeps matching the `Icon`'s own `<span>` as a direct child. `Textarea` also gains `ref?: Ref<HTMLTextAreaElement>` (React 19 ref-as-prop). Additive, default-preserving — the one flagged API addition; the alternative (consumer CSS overriding every conflicting atom property) is larger and order-fragile.
  2. actor applies the element map:

  | Site | Native element | Maps to |
  |---|---|---|
  | `FieldRow.tsx:148` | `<textarea>` (FieldAutoGrowInput) | `<Textarea variant="unstyled" className={controlClass} rows={lineCount} ref={controlRef} value onChange={handleChange} {...rest}>` — `field-sizing: content` + `rows={lineCount}` fallback growth preserved verbatim |
  | `FieldRow.tsx:264` | `<input>` (TagInput field) | `<Input variant="unstyled" className={styles.tagInput__field}>` — same value/onChange/onKeyDown/onBlur/placeholder/aria-label props |
  | `CandidateView.tsx:253` | `<button>` accent toggle | `<Button variant="unstyled" className={styles.cellAccentLabel}>` — same disabled/title/onClick |
  | `CandidateView.tsx:383` | `<button>` empty-state link | `<Button variant="unstyled" className={styles.cellEmptyLink}>` |
  | `CandidateView.tsx:530` | `<button>` translation reveal | `<Button variant="unstyled" className={styles.defLineReveal}>` — `Icon` stays a direct child so `.defLineReveal > span` still matches; aria-expanded/label/title preserved |
  | `CandidateView.tsx:606,708,791` | decorative `<input type="checkbox">` inside `.cellDefCheck` label | **Delete** — input is `opacity:0/pointer-events:none/tabIndex=-1/aria-hidden`; semantics live on the `role="checkbox"` row. `<label>` becomes `<span className={checkStyles.cellDefCheck(+--checked)}>` and its `onClick={e.stopPropagation()}` (`:604,706,789`) is dropped with it — kept, it would stop marker clicks bubbling to the row's `onClick` and kill the toggle; with it gone, marker clicks bubble to the row's existing `onClick` (identical single-toggle path previously via label→input `onChange`); `.cellDefCheckBox` span + check `Icon` unchanged. `Checkbox` atom does NOT fit — its `.root` forces 44px touch target + always-visible box vs the idle-dot→reveal morph = visual drift |

  3. `VocabularyTab.tsx:14` → `import { Icon } from '@/shared/ui/Icon'`; sizes map `size={16}`→`size="xs"`, `size={14}` stays numeric, bare usages keep default `md` (=24px, same as catalog default); all call sites sit inside `Button` children so the atom's `inline-flex` wrapper span is layout-neutral.
  4. TagInput `handleKeyDown` gains `if (e.nativeEvent.isComposing) return;` before the Enter/Space/`,` commit — **accepted behavioral delta D3**: today a composition keypress mid-IME commits raw text (CJK data-loss path for the exact user persona); the guard is required, not optional.
- Alt flow: none — table is exhaustive for the two files.
- Exception: a native element that cannot map without losing behavior → stop and flag (none expected; the decorative-input case resolves via deletion, verified against `DictionaryCheckable.module.css` contract — `.cellDefCheck*` classes stay in that file, still used by `DictionaryPanelView`/`ImagePanel`/`PronunciationAudioPanel`/`TranslatePanel` which are out of the native-element sweep).
- Rules: zero visual drift on every migrated control; handlers migrate verbatim except D3; `data-cell-id` attributes preserved.
- Postcondition: grep `<(button|input|textarea)` on both files → 0 matches (excluding comments); IME + autosize parity verified on real Chromium in BOTH mounts (universal panel dictionary tab + dictionary popup).
- NFR refs: NFR-1, NFR-3

REQ-5: Escape via `pushEscapeLayer` (F-24a)
- Actor: Maintainer
- Goal: Panel Escape goes through the shared LIFO stack; every non-stack Escape consumer reachable while the panel is open either joins the stack or is a capture-phase consumer gated by `defaultPrevented` — inner-first ordering preserved, residual deltas recorded.
- Preconditions: `UniversalPanel.tsx:148-157` hand-rolls Escape on the `Surface`'s `onKeyDown` — element-scoped, so today Escape only closes the panel when focus is inside it, and inner consumers win by `preventDefault`/`stopPropagation`. `pushEscapeLayer` exists (`escapeLayerStack.ts:36`): one document **capture** listener fires before every React synthetic handler and every bubble listener, skips `e.defaultPrevented` events (`:44`), `stopPropagation()`s, and runs only the topmost layer. Migrating the panel alone therefore starves every off-stack consumer below.
- Non-stack consumer enumeration (verified in REVIEW) and per-consumer treatment:

  | Consumer | Mechanism today | Treatment |
  |---|---|---|
  | `Dialog.tsx:68-75` — profile dialog in the panel, any Dialog inside a pane | React `onKeyDown` + `stopPropagation` on the overlay | Migrate the **atom**: `useEffect(() => open ? pushEscapeLayer(() => onOpenChangeRef.current?.(false)) : undefined, [open])` with `onOpenChange` pinned in a ref (`useSheet.ts:83` pattern); delete the overlay's Escape `onKeyDown` (`handleKeyDown`, `:91`) |
  | `BottomSheet.tsx:59-66` — tools sheet (`UniversalPanelBottomNav.tsx:88`) — the old spec wrongly listed it as already on-stack | same React `onKeyDown` pattern | same atom migration |
  | `Drawer.tsx:40-47` — no in-panel consumer today, but the capture listener would silently shadow it | same React `onKeyDown` pattern | same atom migration — identical hunk, removes the trap for the first consumer |
  | `ResourceCard.tsx:293-296` — rename input (settings tab → `SettingsDialogContent` → `ResourcesPanel`) | React `onKeyDown` → `preventDefault` + `setRenaming(false)` | push a layer while `renaming` (`useEffect(() => renaming ? pushEscapeLayer(() => setRenaming(false)) : undefined, [renaming])`); drop the Escape branch from the input's `onKeyDown` (Enter commit stays) |
  | `DictLinksManager.tsx:170-173` — rename input (settings tab → `DictionaryPopupSettingsPanel`) | same pattern | push a layer while `renamingId !== null`; drop the Escape branch |
  | `MultiSelect.tsx:100-105` — Escape blurs the focused input (settings tab) | React `onKeyDown` → `stopPropagation` + blur | push a layer while `focused` calling `inputRef.current?.blur()`; drop the Escape branch |
  | `useSectionDrag.ts:180-181,197` — drag-cancel in `ResourcesPanel` | `window` bubble `keydown` → `endDrag(false)` | replace the window listener with `pushEscapeLayer(() => endDrag(false))` inside the same effect — a layer exists exactly while a drag session lives |
  | `Dictionary.tsx:108-113` + `popupLifecycle.ts:815-836` — page popup open while panel open | popup Surface `onKeyDown` (focused level) + document-bubble `onStackKeydown` (top level) | replace `onStackKeydown` (`:815-820`, registered `:836`) with one `pushEscapeLayer` held while `popupStack.length > 0` — push the layer at `popupStack.push(level)` (`:487`) when the stack goes 0→1, unregister when `closeFromLevel` empties the stack (`:217`) and in `dispose` (`:839`, alongside `listeners.removeAll()`); handler resolves the level containing `e.composedPath()` (same host lookup as `onStackPointerDown` `:826-834`) → `closeFromLevel(isSheetMode() ? 0 : idx >= 0 ? idx : popupStack.length - 1)` — `findIndex` returns **-1** (not undefined) when focus is outside, so `??` would compile to `closeFromLevel(-1)` which early-returns (`:212`) = dead Escape — preserves both old paths (focused level + descendants, or top level when focus is outside). `Dictionary.tsx`'s Escape `onKeyDown` is then unreachable → delete |
  | `regionSelector.ts:307-310` — OCR region select/edit | `window` bubble `keydown` → `handleCancel()` | move to `window` **capture** + `e.preventDefault()` when it cancels — a window-capture listener runs before the stack's document listener and `defaultPrevented` makes the stack skip; the active selection always wins regardless of push order (it may predate the panel's layer) |
  | `PlayerModeOverlay.tsx:500-531` — exit player mode / close CueList | `window` bubble `keydown`, already `preventDefault`+`stopPropagation` | move to `window` capture (`:529` → `true`) — `defaultPrevented` then makes the stack skip it unchanged |
  | `statusKeyControls.ts:65-77` — clear tokenize selection/hover | `window` capture already — fires before the stack | add `e.preventDefault()` **only when it actually consumed** (selection or hovered term cleared) so clearing a selection doesn't also close the panel; a no-op Escape falls through to the stack → document-global close (recorded delta) |
  | `ShortcutInput.tsx:87`, `SubtitlePractice.tsx:163-167`, `Surface.tsx:67-72`, `ManagerLayer.tsx:94-104`, `mountReactShadow.ts:94-107`, `contentScriptKeyboard.ts:153-168` | deliberate Escape pass-throughs | unchanged — the surface closing on their Escape is the intended outcome |
  | Not consumers (verified): `useFocusTrap.ts` (Tab only), `srsCardShared.tsx:146` (arrows only), `webTriggerController.ts:414` (modifier keys), `iframePlayerModeBridge.ts:293` (shortcut only), `ocrOverlay.ts:108` (Enter/Space), `sidepanel`/`local-player` entrypoints (separate documents) | — | no action |

- Basic flow:
  1. panel: `const onCloseRef = useRef(onClose); useEffect(() => { onCloseRef.current = onClose; });` then `useEffect(() => isOpen ? pushEscapeLayer(() => onCloseRef.current()) : undefined, [isOpen])` — the ref-pin keeps an **unstable `onClose` prop from re-pushing the panel's layer to the stack top** (above inner layers) on every render; delete `handleKeyDown`, the `onKeyDown` prop, the `defaultPrevented` dance, and the stale `KeyboardEvent` import
  2. system's document capture listener runs before React synthetic handlers and bubble listeners; only the topmost layer fires
  3. Escape while panel is topmost → `onClose()`; Escape while a nested stack layer (profile `Dialog`, tools `BottomSheet`, `Menu`/`Select`, rename/drag/MultiSelect transient layers) or a `preventDefault`-gated capture consumer is active → inner wins, panel stays open
- Alt flow: Escape during the close animation — layer already unregistered (`isOpen` false → effect cleanup ran); no-op, correct.
- Exception: layers pushed before the panel's effect — impossible for React children (children mount after parent effects commit, so inner overlays land above the panel); pre-existing page-level state is handled per row above (capture + `preventDefault`).
- Recorded deltas (accepted, not regressions):
  - **D4** — panel Escape becomes **document-global**: it was element-scoped `onKeyDown`, so an Escape with focus on the page now closes the panel unless a capture-phase consumer or a higher stack layer consumed it. Consistent with every existing `pushEscapeLayer` surface (`CardCreatorSidePanel:78`, `Sheet:87`, `Select:190`, `Menu:64`).
  - **D5** — dictionary-popup Escape: the two old paths (per-Surface `onKeyDown` → `onClose` → `closeFromLevel(indexOf(level))` `popupLifecycle.ts:276` for focus inside; document-bubble `onStackKeydown` → top level for focus outside) merge into **one stack layer** — the `composedPath` resolution preserves the focused-level pop verbatim, so no level-selection delta; the delta is structural only (corrected in REVIEW r2 — the prior draft claimed it "now pops the top level").
  - **D6** — during player mode / region select, in-panel-focus Escape previously fired *both* the panel close and the page handler (the element handler didn't `stopPropagation`); now the capture consumer wins alone — one Escape = one layer.
  - **D7** — Escape during a `useSectionDrag` session with the panel opened *mid-drag* closes the panel first (push order), drag continues to pointerup — unreachable in practice (pointer capture holds the drag).
  - **D8** — migrating `Dialog`/`BottomSheet`/`Drawer` makes their Escape **document-global** (was element-scoped `onKeyDown` on the overlay) — same class as D4; near-equivalent in practice because each overlay's focus trap keeps focus inside while open.
- Test updates (named):
  - `UniversalPanel.test.tsx:237` ("Escape inside a nested Dialog closes only the dialog") and `:297` (tools sheet) — **assertions stay identical**; under a panel-only migration both fail (stack consumes the key before React → `onClose` fires, inner state stale). Once `Dialog`/`BottomSheet` are on-stack they pass and exercise the real ordering — update the comments to name the stack.
  - `UniversalPanel.test.tsx:218` (plain Escape → `onClose`) — unchanged; the capture listener handles `fireEvent.keyDown` fine in jsdom.
  - `ResourceCard.test.tsx:197` (rename Escape) and `ResourcesPanel.test.tsx:929` (drag Escape) — unchanged; the layer is pushed by the same state the tests drive, so they exercise the stack path transparently. Add one new assertion to each covering "panel stays open" (render under an open-panel layer: push a stub `pushEscapeLayer` first, assert it was not invoked).
  - `Dictionary.test.tsx` Escape case — retarget from the removed Surface `onKeyDown` to the `popupLifecycle` layer (assert `closeFromLevel` pops the top / focused level).
  - `UniversalPanel.test.tsx:262` (Select listbox Escape → menu only, next Escape → panel) and `SearchableSelect.test.tsx:90` (Escape in search input closes the menu) — unchanged; `Select`/`SearchableSelect` already push layers (`Select.tsx:190`, `SearchableSelect.tsx:140`), so both exercise the same ordering the migration preserves.
- Rules: convention matches `CardCreatorSidePanel.tsx:76-79` + the `useSheet.ts:83` ref-pin; `document` default is correct for the shadow-DOM mounts — keydown composes through shadow roots to the page document.
- Postcondition: one Escape = at most one layer closes, inner-first; no non-stack consumer is starved by the capture listener.
- NFR refs: NFR-1, NFR-3

REQ-6: Shell-craft corrections (F-24b)
- Actor: Maintainer
- Goal: Backdrop, compositing hint, docstring, and state update each tell the truth.
- Basic flow — four independent edits:
  1. `UniversalPanel.tsx:187` — delete `role="presentation"` on the clickable backdrop div (it wraps `role="dialog"` content; the role is false and the element is interactive).
  2. `UniversalPanel.module.css:18` — **delete** `will-change: transform, opacity` entirely; do NOT move it to `.open`/`.close` — `panelClass` (`UniversalPanel.tsx:180`) guarantees `.panel` always carries one of the two, so moving it would be a no-op and the hint would still apply for the panel's whole mounted lifetime (corrected in REVIEW). Chromium composits `transform`/`opacity` keyframe animations without the hint; the before/after captures must confirm no first-frame jank on the open animation on real Chromium — if any is observed, escalate rather than silently restoring it.
  3. `UniversalPanel.tsx:88-93` — docstring rewritten to actual geometry: centered `94%` modal inside a full-surface overlay; desktop left vertical tab rail via `CollapsibleSidebar`; ≤839px bottom nav; ≤599px full-screen. (Current text says "right-edge panel" — false.)
  4. `UniversalPanel.tsx:167-170` — render-phase `setVisitedTabs` moved out: keep `useState` set, add `useEffect(() => { setVisitedTabs(prev => prev.has(activeTab) ? prev : new Set(prev).add(activeTab)); }, [activeTab])`, and gate the five `.tabPane`-wrapped panes on `visitedTabs.has(tab) || tab === activeTab` — the active pane must mount in the same commit (an effect-only version flashes one empty frame). **Recap keeps `activeTab`-only gating**: `{activeTab === 'recap' && recapPanel}` (`:287`) stays verbatim — it is deliberately not visited-gated today (unmounts → recomputes per visit), and gating it on `visitedTabs` would additionally render `recapPanel` unwrapped outside `.tabPane` whenever inactive — a real persistence + layout delta we are not taking. `'recap'` still enters the visited set via the uniform effect; nothing reads it for the recap pane.
- Alt flow: none — the four edits are independent and unordered.
- Exception: none.
- Rules: no behavioral change; `data-cell-id="universal-panel-backdrop"` and the click-to-dismiss handler stay.
- NFR refs: NFR-1

REQ-7: Checker covers feature dirs (N7)
- Actor: Maintainer (script edit) → CI/local build (gate consumer)
- Goal: The `undefined-token` typo class fails the build on the touched feature dirs instead of aging into a quarterly audit finding.
- Preconditions: `check-design-system-css.mjs` drops `/src/features/` in `shouldExclude` (`:205-219`) for ALL modes, so `node scripts/check-design-system-css.mjs src/features` today exits 0 printing "No matching .module.css files found." — a silently green gate that checks nothing (verified in SPECIFY).
- Basic flow:
  1. actor modifies the script: positional args become `path…` (multiple accepted); `--rules <csv>` filters which rule IDs emit findings (default = all; `parse-error` is exempt from filtering — it always reports **and still exits non-zero** even under `--rules undefined-token` — it signals a broken file, not a style debt)
  2. explicit positional paths bypass `shouldExclude` entirely — explicit intent wins; the no-arg default glob (`src/shared/ui/*.module.css` + exclusions) is unchanged
  3. explicit paths resolving to zero files → non-zero exit (exit 2) — never silently green
  4. actor adds npm script and wires the gate:

     ```json
     "check-design-system-css:features": "node scripts/check-design-system-css.mjs --rules undefined-token src/features/universalPanel src/features/sessionRecap src/features/studyModes src/features/vocabulary src/features/settings src/features/dictionaryPopup src/features/cardCreator"
     ```
     and appends `&& npm run check-design-system-css:features` to `prebuild` (after `check-feature-cycles.mjs`).
- Alt flow: future expansion of the scoped dir list = one-line script edit; widening beyond these dirs requires auditing runtime-injected custom props first (Boundaries).
- Exception: a finding on a file the actor didn't touch inside the scoped dirs → still fails the gate; fix or escalate, do not widen exclusions silently.
- Rules: scope = the seven touched feature dirs only. Scoped baseline recorded (REVIEW): with the `shouldExclude` bypass applied and REQ-1's swaps not yet landed, the seven-dir `undefined-token` run reports **exactly the 13 undefined names in the REQ-1 table** (4 in `PlaylistTab`, 4 in `RecapTab`, 5 in `StudyModesTab`; `vocabulary`/`settings`/`dictionaryPopup`/`cardCreator` are clean) — every other `var(--*)` in scope resolves to a defined token or a file-local custom prop, including the `--chip-*`/`--universal-panel-*`/`--card-*`/`--sidebar-*` component props — so AC-1's "exits 0" is a REQ-1 diff check, not an unknown-baseline assumption. Verified in SPECIFY: a bypassed run over all `src/features` yields 24 undefined-token hits in 14 files — including intentional runtime-injected props (`--sb-y`, `--content-pct`, `--pm-orbital-lift`, `--pm-anchor-bottom` in `subtitle/`) and out-of-scope typos (`srs/`, `condensedAudio/`, `tokenize/`). Whole-`src/features` gating is a follow-up item, not this one.
- Postcondition: `npm run check-design-system-css:features` exits 0 after REQ-1 lands; a new typo in those dirs fails `npm run build` in `prebuild`.
- NFR refs: NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Zero visual drift — pixel-level parity on all touched surfaces | R | Before/after captures identical except `.when` 14→12px and `.statusChip` UA ~13.3→12px |
| NFR-2 | Gate integrity — check fails loudly, never silently green | S / +infra | Exit non-zero on violation AND on empty explicit target |
| NFR-3 | Behavior parity — autosize, tag commit, IME composition, Escape ordering | R | Real-Chromium verification in both mounts |
| NFR-4 | S-cost discipline — smallest diff, no new abstractions beyond `panelTabs.ts` + `unstyled` variant | resource | Diff limited to named files + the REQ-4 atoms (Button/Input/Textarea) + the REQ-5 overlay atoms (Dialog/BottomSheet/Drawer) + the REQ-5 consumer files + checker + package.json |

## Flows / States

**Escape ordering (sequence):**
```
open panel   → effect pushes panel layer         stack: [panel]
open tools sheet / menu / profile dialog inside → pushes later  stack: [panel, inner]
transient inner state (rename / drag / focused MultiSelect)
             → callsite pushes a layer           stack: [panel, …, inner]
Escape 1     → doc capture listener → top = inner → inner closes, stopPropagation
                                                    (React onKeyDown never sees it)
Escape 2     → top = panel → onClose()            stack: []
close        → effect cleanup unregisters panel layer

page-level capture consumers (region select / player mode /
tokenize-selection clear) run BEFORE the stack listener;
preventDefault on consume → stack skips the event entirely
```

**Checker gate flow:**
```
prebuild → generate-tokens → check-icons → check-feature-cycles → check-design-system-css:features
  explicit dirs → bypass shouldExclude → glob *.module.css per dir
    files = 0        → exit 2 (misconfigured gate, fails loudly)
    findings = 0     → exit 0 "0 violations (N files checked)"
    undefined-token  → print findings → exit 1 → build stops
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Guarantee every `var(--*)` resolves | Token-name corrections (REQ-1); scoped `undefined-token` gate (REQ-7) |
| Express one tab list | `panelTabs.ts` registry + two consumers (REQ-3) |
| Render controls via shared atoms | `unstyled` variant on Button/Input/Textarea; element map; decorative-input deletion; Icon barrel (REQ-4) |
| Order overlay dismissal LIFO | `pushEscapeLayer` adoption + non-stack consumer enumeration/migration (REQ-5) |
| Keep shell semantics honest | role removal, will-change removal, docstring, effect-phase `setVisitedTabs` (REQ-6) |
| Read canonical values, not literals/aliases | Literal→token swap table (REQ-2) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `PanelTabEntry` | `key, icon, label, shortLabel` | `src/features/universalPanel/panelTabs.ts` (new) | compile-time constant |
| Token registry | `--*` names | `tokens.json` → generated `tokens.css` | unchanged (no token additions/deletions) |

No runtime state, storage, or messages touched.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 undefined `var(--*)` | REQ-1 | AC-1, AC-2 |
| N2 duplicated tab registry | REQ-3 | AC-3 |
| N3 native controls + Icon barrel | REQ-4 | AC-4, AC-5 |
| N4 literals/aliases → tokens | REQ-2 | AC-6 |
| N5 hand-rolled Escape | REQ-5 | AC-7 |
| N6 shell craft | REQ-6 | AC-8 |
| N7 checker blind spot | REQ-7 | AC-9, AC-10 |

| Journey step | REQ |
|---|---|
| AS-IS 1 / TO-BE 1 (two-place tab edit → single registry) | REQ-3 |
| AS-IS 2 / TO-BE 2 (silent typo → gate fails; `.when` 12px) | REQ-1, REQ-7 |
| AS-IS 3 / TO-BE 3 (copied native pattern → atoms) | REQ-4 |
| AS-IS 4 / TO-BE 4 (Escape dance → shared stack) | REQ-5, REQ-6 |

## Boundaries

- Always: byte-equivalent swaps only; run `npm run typecheck && npm run lint && npm run test:unit && npm run build` before commit; before/after captures on touched surfaces; keep `data-cell-id` values stable; preserve `rows={lineCount}` growth + `field-sizing: content`; registry/atoms stay dependency-free.
- Ask first: any visual delta beyond D1/D2; any behavioral delta beyond D3; widening the checker scope beyond the seven dirs; deleting `--radius-full` from `tokens.json`; touching files owned by items 28/30/31 beyond the listed hunks.
- Never: edit `tokens.json` or generated `tokens.css`; add tokens; invent a token for `94%`/`0.04em`/`ease-in-out`; add dependencies; change layout/hit-areas/menus (items 28/30/33 territory); widen `shouldExclude` to hide a finding; leave the gate green-on-empty.

## Success Criteria

- [ ] **AC-1** — `npm run check-design-system-css:features` exits 0 and reports `0 violations` over the seven feature dirs; the default `npm run check-design-system-css` is byte-identical in behavior to HEAD (amended at VERIFY: its exit status at HEAD is already 1 — 6 pre-existing `undefined-token` findings on runtime-injected props in `src/shared/ui` (`--radio-border`, `--mobile-sheet-peek-height`, `--mobile-sheet-drag-height`, `--ink-x`, `--ink-w`, `--breadcrumb-separator`); a runtime-prop whitelist is a separate follow-up, out of scope here).
- [ ] **AC-2** — `.when` and `.statusChip` in `RecapTab.module.css` resolve `--font-size-xs` (computed 12px on real Chromium — the only two accepted visual deltas).
- [ ] **AC-3** — `src/features/universalPanel/panelTabs.ts` exports `PANEL_TABS` of `{key, icon, label, shortLabel}`; both `UniversalPanel.tsx` (sidebar, `label`) and `UniversalPanelBottomNav.tsx` (nav, `shortLabel`) consume it; both local `TABS` arrays deleted; all full + `…Short` labels resolve; `data-cell-id` outputs unchanged.
- [ ] **AC-4** — Grep `</?(button|input|textarea)[ />]` in `FieldRow.tsx` and `CandidateView.tsx` → 0 element matches; `FieldAutoGrowInput` still grows via `field-sizing` + `rows={lineCount}` fallback on real Chromium in both mounts.
- [ ] **AC-5** — `VocabularyTab.tsx` imports `Icon` from `@/shared/ui/Icon`; tag input commits tags and does not commit mid-IME-composition (`isComposing` guard, delta D3).
- [ ] **AC-6** — Every REQ-2 swap applied; `grep -n "radius-full"` on the converged file set (`NavItem`, `VocabularyTab`, `SettingsDialog`, `RecapTab`, `FieldRow`, `CandidateView`, `DictionaryCheckable` `.module.css`) → 0; the REQ-2 "Out" list is unchanged; `94%`, `0.04em`, `ease-in-out` remain literal.
- [ ] **AC-7** — `UniversalPanel.tsx` has no `onKeyDown`/`defaultPrevented` Escape handling; `pushEscapeLayer` registered in an effect gated on `isOpen` with `onClose` ref-pinned (unstable prop must not re-push the layer). Every REQ-5 consumer row landed: `Dialog`/`BottomSheet`/`Drawer` push their own layers; rename (`ResourceCard`, `DictLinksManager`), `MultiSelect` blur, and `useSectionDrag` cancel push transient layers; `popupLifecycle` holds a stack layer while `popupStack` is non-empty (pushed on the first level, unregistered on empty + `dispose`) and `Dictionary.tsx`'s Escape `onKeyDown` is deleted; `regionSelector`/`PlayerModeOverlay` are window-capture with `preventDefault`; `statusKeyControls` `preventDefault`s only on consume. On real Chromium: Escape with tools sheet/profile dialog open closes the inner layer only, second Escape closes the panel; Escape during rename/drag cancels it without closing the panel; Escape inside an open dictionary popup pops the `composedPath`-resolved level (focused level + descendants; top level when focus is outside), not the panel.
- [ ] **AC-8** — Backdrop has no `role="presentation"`; `will-change` no longer appears in `UniversalPanel.module.css` (no `.open`/`.close` re-add — `panelClass` always carries one); docstring describes the centered modal + both nav modes; `setVisitedTabs` runs in an effect, the five `.tabPane` panes mount same-commit via `visitedTabs.has(tab) || tab === activeTab`, and `{activeTab === 'recap' && recapPanel}` is unchanged.
- [ ] **AC-9** — `check-design-system-css.mjs` accepts `path…` + `--rules`; explicit paths bypass `shouldExclude`; an explicit path resolving to zero files exits non-zero; `node scripts/check-design-system-css.mjs src/features` no longer prints "No matching files" + exit 0.
- [ ] **AC-10** — `check-design-system-css:features` exists in `package.json` and runs inside `prebuild`; injecting a fake `var(--typo-test)` into a touched file makes `npm run build` fail (gate proof), then revert.
- [ ] **AC-11** — Before/after captures on the touched surfaces (panel shell desktop + mobile nav, Recap tab, Study Modes, Playlist, Vocabulary, Settings dialog, card-creator fields incl. tag input, dictionary popup candidate view) show zero drift except `.when`/`.statusChip`.
- [ ] **AC-12** — `npm run typecheck && npm run lint && npm run test:unit && npm run build` green.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Design-system CSS check passes on both scopes (default + features)
- [ ] Real-Chromium verification (Playwright persistent Chromium per `testing-extension-browser`): field autosize grow/shrink, paste/clear buttons, tag commit incl. Japanese IME composition, Escape inner-first ordering across the REQ-5 enumeration (profile dialog, tools sheet, rename input, drag, MultiSelect blur, dictionary popup), panel open/close animation first frame clean without `will-change`, both mounts
- [ ] Audit greps clean on touched files: `var\(--[a-zA-Z0-9]*[A-Z]` (camelCase tokens), `var\(--(font-sizes|font-weights|motion-duration|borderWidth|error|success)[^a-z-]`, `<(button|input|textarea)[ />]` on the two TSX, `@/shared/icons/Icon` on `VocabularyTab.tsx`, `radius-full` on the REQ-2 file set, `role="presentation"`, `will-change` in `UniversalPanel.module.css`, `defaultPrevented`/`onKeyDown` in `UniversalPanel.tsx`
- [ ] `docs/2-architechture-system.md` updated (registry module + unstyled variant + gate), `docs/0-wiki.md` if spec/docs touched
- [ ] `git status` clean of stray root files before commit

## Open Questions / Accepted Risks

| Item | Status |
|---|---|
| `unstyled` variant on Button/Input/Textarea is a small API addition — intent hoped for "no API surgery", but no atom can absorb these usage patterns with zero visual drift; additive opt-in variant is the smallest honest mechanism (recorded decision, not a redesign) | accepted |
| `.statusChip` (`RecapTab.module.css:102`) is a second no-fallback live bug — delta D2 recorded alongside `.when`; it is a `<button>` so the live size is UA ~13.3px, not inherited ~14px | accepted |
| REQ-5 records deltas D4–D8 (document-global panel Escape; the two popup-Escape paths merging into one layer; capture-consumer precedence; mid-drag ordering; document-global Escape on `Dialog`/`BottomSheet`/`Drawer`) — the migration widens from one file to the enumerated consumer set because the capture-phase listener would otherwise starve them | accepted |
| Repo-wide `undefined-token` gating blocked by intentional runtime-injected props (`--sb-y`, `--pm-*`) and out-of-scope typos (`srs`, `condensedAudio`, `tokenize`) — scoped gate is this item; repo-wide is a follow-up | accepted risk |
| Items 28/30/31 touch the same files' other aspects — land order per backlog deps; this item is prerequisite-free | coordination note |
