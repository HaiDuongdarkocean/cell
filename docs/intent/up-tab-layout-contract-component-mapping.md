# Component Mapping — up-tab-layout-contract

> Chosen variant: **Contract shell** (single justified variant, `all` mode — see design brief).
> Source mockup: `src/entrypoints/mockup-up-tab-layout-contract/` (`real.tsx` = AS-IS production shell; `ContractPanel.tsx` = TO-BE contract replica).
> Target files: `src/shared/ui/Scrollable.module.css`, `src/shared/ui/EmptyState.module.css`, `src/features/universalPanel/UniversalPanel.{tsx,module.css}`, `src/features/universalPanel/mountUniversalPanel.ts`, `src/features/universalPanel/tabs/{PlaylistTab,SettingsTab,DictionaryTab}.{tsx,module.css}`, `src/features/sessionRecap/ui/RecapTab.{tsx,module.css}`, `src/features/vocabulary/ui/VocabularyTab.module.css`, `src/features/studyModes/ui/StudyModesTab.module.css`.

---

## Element → component mapping

| # | Element | Component | Decision | Tokens | Icon |
|---|---|---|---|---|---|
| 1 | Tab scroll region (one per tab) | — | **Extend** — new `.scrollport` class in `src/shared/ui/Scrollable.module.css`: `composes: themed` + `flex:1; min-width:0; min-height:0; overflow-y:auto; overscroll-behavior:contain`; mechanics-only, zero padding (REQ-2) | `color-scrollbar-thumb`, `color-scrollbar-thumb-hover` | — |
| 2 | Content host `.content` | — | **Redesign** — strip `padding`, the `data-tihoka-id` carve-out, and both media-query padding overrides; keeps `display:flex; flex-direction:column; overflow:hidden` as the clip boundary (REQ-3) | — | — |
| 3 | Page-gutter contract vars on `.body` | — | **Create** — custom properties `universal-panel-tab-gutter` (`--spacing-3` `--spacing-4` → 12/16) and `universal-panel-tab-scroll-inset` (`--spacing-4`) declared once on `.body`, consumed per tab; shell-scoped contract vars, not registry tokens (REQ-3/REQ-4) | `spacing-3`, `spacing-4` | — |
| 4 | Per-tab gutter application | — | **Extend** — `padding: var(…gutter); padding-block-end: var(…scroll-inset)` on playlist `.list`, recap `.body`/`.stateWrap`, vocabulary `.tab`, studyModes `.tab` (REQ-3/REQ-4) | `spacing-3`, `spacing-4` | — |
| 5 | Keep-alive tab pane (recap joins siblings) | — | **Reuse** — `.tabPane` + `visitedTabs` + `[hidden]` pattern, identical for all six (REQ-1) | — | — |
| 6 | Activation lifecycle signal | — | **Extend** — `isActive` render-prop bound at `mountUniversalPanel` render fns (`renderPlaylistPanel(isActive)`, `renderRecapPanel(isActive)`); precedent `renderDictionaryPanel(open)` (REQ-5) | — | — |
| 7 | Playlist preview teardown | `Button` | **Reuse** — existing ghost circle preview button; new behavior is a `!isActive` effect (`setPreview(null,null)` + revoke) + publish-guard on mid-read deactivation (REQ-6) | — | `icon: play`, `icon: x` |
| 8 | Playlist row actions | `Button`, `Icon` | **Reuse** — unchanged row action cluster; rides the now-live `@container` wrap (REQ-10) | — | `icon: download`, `icon: navRepeat`, `icon: rotateCcw`, `icon: trash` |
| 9 | Playlist narrow wrap (`@container ≤480px`) | — | **Extend** — `container-type: inline-size` on `.list` activates the existing `.itemInner` wrap + `.itemActions` full-width hang-indent `calc(12+20)` (REQ-10) | `spacing-3` | — |
| 10 | Card surface remap (hoisted to `.body`) | `Card` | **Reuse** — component untouched; `--card-background`/`--color-surface-card` resolve once from `.body`; per-tab copies deleted (REQ-8) | `card-background`, `color-surface-card`, `color-surface-elevated` | — |
| 11 | studyModes `.modeCard` field override | `Card` | **Reuse** — deliberate `--color-field` override + hover pairing survives the hoist untouched (REQ-8 exception) | `color-field` | — |
| 12 | Empty state fill | `EmptyState` | **Extend** — `.root{flex:1 1 auto}`; `.root.bordered` excluded (`flex:none`) so inline placeholders stay put (REQ-9) | — | — |
| 13 | Playlist empty block (own markup, not the atom) | `Icon`, `Text` | **Extend** — `.empty` host gains `flex:1` + `justify-content:center` (REQ-9; spec-review fix) | `color-text-muted` | `icon: audioWave` |
| 14 | Recap/vocabulary empty + loading hosts | `EmptyState`, `Spinner` | **Extend** — `.stateWrap`/`.center`/`.empty` hosts become `flex:1; min-height:0` flex-column containers so the atom has height to fill (REQ-9) | — | — |
| 15 | Dictionary tab panes + mobile sheet edge | `MobileSheet` | **Reuse** — internal gutters/scroll unchanged; verify `leftPane` block-end clearance covers the collapsed sheet peek (REQ-3/REQ-4 exception) | — | — |
| 16 | Settings inner scroll column | — | **Reuse** — `SettingsDialog.module.css` `.mainCol` already composes `themed` + scrolls; conform inside `.settingsTab{overflow:hidden}`, no new class (REQ-2) | `color-scrollbar-thumb` | — |
| 17 | Recap revalidate-on-activation | — | **Extend** — `useEffect(if isActive → load())` replaces mount-only effect; stale list survives a failed refresh (REQ-7) | — | — |
| 18 | Bottom-nav clearance | — | **Extend** — scroll inset (row 4) lifts last rows ≥12px above the ≤839px bottom-nav hairline (REQ-4) | `spacing-4`, `universal-panel-bottom-nav-item-height` | — |

**Create decision justification (row 3):** the only `create` is two css custom properties on `.body` — no `src/shared/ui` atom can express "a gutter contract a tab opts into", and the alternative (registry tokens in `tokens.json`) would make shell-internal layout values globally consumable. The vars are fed by existing `--spacing-3`/`--spacing-4` leaves, so the palette is untouched.

**No new atoms:** every element maps onto shipped `src/shared/ui` parts; all other changes are css-module structure + one prop contract.

---

## Trace

| REQ | Elements |
|---|---|
| REQ-1 uniform mount | 5 |
| REQ-2 scrollport | 1, 15, 16 |
| REQ-3 gutter authority | 2, 3, 4, 15 |
| REQ-4 scroll inset | 4, 15, 18 |
| REQ-5 `isActive` | 6 |
| REQ-6 preview teardown | 6, 7 |
| REQ-7 recap revalidate | 5, 17 |
| REQ-8 surface hoist | 10, 11 |
| REQ-9 empty fill | 12, 13, 14 |
| REQ-10 `@container` | 8, 9 |

## Interaction trace (journey → REQ → element)

- Open panel, switch tabs → REQ-1 → `.tabPane`/`visitedTabs` (5)
- Scroll any list → REQ-2 → `.scrollport` (1); last row clear → REQ-4 → inset (4/18)
- Preview then switch → REQ-5/6 → `isActive` teardown (6/7)
- Return to recap → REQ-7 → keep-alive + revalidate (5/17)
- Any card on any tab → REQ-8 → hoisted remap (10/11)
- Empty tab → REQ-9 → fill + center (12/13/14)
- ≤480px playlist → REQ-10 → container wrap (9)
