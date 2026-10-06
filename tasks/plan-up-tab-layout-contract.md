# Plan — up-tab-layout-contract (item 28, DELIVER)

> Spec: `docs/specs/up-tab-layout-contract.md` · Design: `docs/intent/up-tab-layout-contract-design-brief.md` + `-component-mapping.md` · Review: `docs/reviews/up-tab-layout-contract-design.md` (PASS)

## Approach

Declare the contract once in the shell, let every tab opt in by construction:

1. `.scrollport` in `src/shared/ui/Scrollable.module.css` — `composes: themed` + `flex:1; min-width:0; min-height:0; overflow-y:auto; overscroll-behavior:contain`. Mechanics-only, zero padding.
2. `.body` in `UniversalPanel.module.css` owns `--universal-panel-tab-gutter` (`--space-3 --space-4`), `--universal-panel-tab-scroll-inset` (`--space-4`), and the single `--card-background`/`--color-surface-card` → `surface-elevated` remap. `.content` becomes a pure flush `overflow:hidden` flex host — padding + the `[data-cell-id]` carve-out + both media-query padding overrides deleted.
3. `isActive := open && currentTab === tab` bound at the `mountUniversalPanel` render fns (`renderPlaylistPanel`, `renderRecapPanel`) — precedent `renderDictionaryPanel(open)`.
4. All six panes ride identical `.tabPane[hidden]` keep-alive mounts — recap joins the pattern.
5. `EmptyState .root` gains `flex:1 1 auto`; `.root.bordered` keeps `flex:none`.

## Per-REQ implementation

| REQ | Change | Files |
|---|---|---|
| REQ-1 uniform mount | `{visitedTabs.has('recap') || activeTab === 'recap'} && recapPanel && <div className={styles.tabPane} hidden=…>` — identical to siblings | `UniversalPanel.tsx` |
| REQ-2 scrollport | new `.scrollport`; playlist `.list`, recap `.body`, vocabulary `.list`, studyModes `.tab` compose it; settings `.mainCol` already conforms (`themed`+`overflow-y:auto` inside `min-height:0` chain); dictionary scrolls internally via `.dictionaryPanel`/MobileSheet `.content` | `Scrollable.module.css`, `PlaylistTab.module.css`, `RecapTab.module.css`, `VocabularyTab.module.css`, `StudyModesTab.module.css` |
| REQ-3 gutter authority | `.content` fully flush; contract vars on `.body`; `padding: var(--universal-panel-tab-gutter)` on playlist `.list`, recap `.body`+`.stateWrap`, vocabulary `.tab`, studyModes `.tab`; dictionary/settings keep internal guttering | same CSS files |
| REQ-4 scroll inset | `padding-block-end: var(--universal-panel-tab-scroll-inset)` on each scrollport/page container; dictionary `.integratedMode` gains `padding-block-end: var(…scroll-inset, var(--space-4))` so the last row clears the collapsed MobileSheet peek | `DictionaryPanelView.module.css` + the four tab modules |
| REQ-5 isActive | `renderPlaylistPanel(isActive)` / `renderRecapPanel(isActive)`; bound `open && currentTab === 'playlist'|'recap'` in `render()` | `mountUniversalPanel.ts`, prop types in `PlaylistTab.tsx`, `RecapTab.tsx` |
| REQ-6 preview teardown | `useEffect(() => { if (!isActive) setPreview(null, null); }, [isActive, previewUrl, setPreview])` — deps include `previewUrl` so a chunk read resolving while inactive is revoked (spec-pinned option b) | `PlaylistTab.tsx` |
| REQ-7 recap revalidate | `useEffect(() => { if (isActive) void load(); }, [isActive, load])`; error view gated by `failed && sessions === null` so a failed refresh over data keeps the stale list (derived predicate — no extra state/ref needed) | `RecapTab.tsx` |
| REQ-8 surface hoist | remap on `.body`; deleted from `VocabularyTab.module.css`, `SettingsTab.module.css`, `StudyModesTab.module.css`; `.modeCard` `--color-field` override preserved | `UniversalPanel.module.css` + three tab modules |
| REQ-9 empty fill | `EmptyState .root{flex:1 1 auto}`, `.root.bordered{flex:none}`; recap `.stateWrap`/`.center` + playlist `.empty` become `flex:1; min-height:0` column hosts (`justify-content:center` added); settings loading stub gets `.loading` centering modifier; vocabulary EmptyStates are already direct `.tab` children | `EmptyState.module.css`, `RecapTab.module.css`, `PlaylistTab.module.css`, `SettingsTab.{tsx,module.css}` |
| REQ-10 `@container` | `container-type: inline-size` on playlist `.list` activates the existing ≤480px wrap + hang-indent | `PlaylistTab.module.css` |

## Tests

- `UniversalPanel.test.tsx`: `101-119` flipped — "keeps the recap tab mounted across tab switches" asserts same-node persistence + `[hidden]` toggling on a recap round-trip.
- New `PlaylistTab.test.tsx`: preview mounts while active; `isActive→false` unmounts `<audio>` + revokes `blob:` URL; mid-read deactivation still revokes; unmount cleanup preserved.
- New `RecapTab.test.tsx`: loads on activation only, revalidates per activation, stale list survives failed refresh, error view only on empty cache.
- `mountUniversalPanel.test.tsx`: mocked `PlaylistTab`/`RecapTab` assert `isActive` = `open && currentTab` across open/switch/close.

## Docs

- `docs/2-architechture-system.md`: universalPanel dir blurb + `UniversalPanel.tsx`/`.module.css`/`mountUniversalPanel.ts` rows + `EmptyState` row updated.
- `docs/0-wiki.md`: changelog entry.

## Boundaries respected

No `data-cell-id`-keyed CSS added (the attribute stays as test hook). No nav chrome/hit-target/subnav/recipe changes (items 30–33). No `setVisitedTabs`-during-render fix (item 29). No new deps, no `tokens.json`/`tokens.css`/`manifest.json` changes. `composes: themed` inside `.scrollport` mirrors the in-file `.themedWide` precedent — Vite accepts it.
