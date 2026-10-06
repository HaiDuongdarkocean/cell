# Spec: up-tab-layout-contract — One tab-layout contract for the Universal Panel's six tabs

> Intent: `docs/intent/up-tab-layout-contract.md` · ui_surface: yes · Mode: all

## Objective

The Universal Panel ships six tabs under three divergent mounting patterns, a `data-cell-id`-keyed padding carve-out, two surface schemes, two tabs with no scroll region, and no deactivate lifecycle. The system must replace per-tab negotiation with one shell-declared contract: `.content` is a flush neutral host, every tab mounts identically through `.tabPane`/`visitedTabs`, every tab owns one scroll region via a shared `.scrollport` recipe, page gutters are declared per tab from a single token pair owned by the shell, the card-surface remap is hoisted once onto `.body`, a scroll-bottom inset clears the nav hairline, an `isActive` signal gives kept-alive panes a defined lifecycle (pause media on hide, revalidate stale data on activation), empty states fill the scrollport, and the dead `@container` rule is activated. This is defect repair + contract declaration — not visual redesign (items 30–33 own that).

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | Opens panel, switches tabs, scrolls lists, plays playlist preview, closes panel | Tab selection, preview play/stop, scroll | Tab content (all items reachable), audio only from visible tab, recap place preserved, centered empty states |
| Maintainer / tab author | Adds or renames a `UniversalPanelTab` | Tab component + entry in `TABS` | Correct layout inherited by construction — no shell carve-out to update |
| Background SW (implicit) | `GET_SESSION_RECAP`, `CONDENSE_AUDIO_LIST`/`_EVENT`/`_READ` responses | — | Revalidation requests on activation |

System-internal: `visitedTabs` keep-alive bookkeeping, `.tabPane` `[hidden]` toggling, `isActive` derivation, preview object-URL lifecycle, recap refetch on activation, CSS contract (`.content`, `.tabPane`, `.scrollport`, gutter tokens, `.body` remap). Human behavior never appears inside a system flow step.

## Requirements

### Functional

REQ-1: Uniform tab-pane mounting for all six tabs
- Actor: learner (tab switch) · maintainer (adds/renames a tab)
- Goal: every tab rides the same keep-alive mount — no bare conditional renders in `.content`
- Preconditions: panel open; `visitedTabs` already tracks visited keys (`UniversalPanel.tsx:167-170`)
- Basic flow:
  1. Learner activates a tab → system adds it to `visitedTabs` (existing render-phase set — unchanged by this item; the `setVisitedTabs`-in-render smell is item 29's)
  2. System renders `{visitedTabs.has(tab) && panel && <div className={styles.tabPane} hidden={activeTab !== tab}>{panel}</div>}` — identical for all six keys
  3. System applies `.tabPane[hidden]{display:none}` (existing `UniversalPanel.module.css:68-70`) to inactive panes
- Alt flow: tab's panel prop is undefined (`playlistPanel`, `recapPanel`, `vocabularyPanel` optional) → `visitedTabs.has(x) && xPanel && (...)` guard, same as today
- Exception: none new — pane render failure is contained by the mount-level `ErrorBoundary` wrappers (`mountUniversalPanel.ts:217-228`)
- Rules:
  - Recap replaces its bare mount `UniversalPanel.tsx:287` (`{activeTab === 'recap' && recapPanel}`) with the same `.tabPane` + `visitedTabs` pattern — the diff is structural, not a third pattern
  - `.content` keeps `data-cell-id={\`universal-panel-content-${activeTab}\`}` — it is the repo test-id attribute (`tests/setup.ts:6` `testIdAttribute: 'data-cell-id'`; e2e deps `e2e/stage2/universal-panel-ux-audit.spec.ts:107,120,147,236,288`, `e2e/extension-condensed-audio.spec.ts:198-263`, `mountUniversalPanel.test.tsx:116,186`). The attribute stays; **CSS must never key on it** (see REQ-3)
  - Existing test `UniversalPanel.test.tsx:101-119` ("still remounts the recap tab on each visit") asserts the defect — DELIVER flips it to assert same-node persistence across a round-trip
- Postcondition: all six tabs lazily mount on first visit and persist for the panel's mounted lifetime
- NFR refs: NFR-3 (memory bound), NFR-4

REQ-2: Shared `.scrollport` scroll contract — one scroll region per tab
- Actor: learner (scrolls to reach owned content)
- Goal: every overflowing tab is fully scrollable at every supported viewport and 200% zoom
- Preconditions: `.content{overflow:hidden}` (`UniversalPanel.module.css:48`) clips anything without an inner scroller; playlist `.list` (`PlaylistTab.module.css:1-6`) and recap `.body` (`RecapTab.module.css:1-6`) have no scroll rules
- Basic flow:
  1. System declares a new class `.scrollport` in `src/shared/ui/Scrollable.module.css` (the scrollbar-utility module already composed across the repo — `SettingsDialog.module.css:18` precedent):
     ```css
     .scrollport {
       composes: themed;
       flex: 1;
       min-width: 0;
       min-height: 0;
       overflow-y: auto;
       overscroll-behavior: contain;
     }
     ```
  2. Each tab designates its scrolling element via `composes: scrollport from '@/shared/ui/Scrollable.module.css'`:
     - playlist `.list` — adds composes (today: no scroll at all)
     - recap `.body` — adds composes (today: no scroll at all)
     - vocabulary `.list` — replaces inline `overflow-y:auto; flex:1; min-height:0` (`VocabularyTab.module.css:53-55`) with composes — net-neutral plus themed scrollbar
     - studyModes `.tab` — replaces `overflow-y:auto` (`:6`) with composes (it is the tab-level scroller)
     - settings — inner scroller is `SettingsDialog.module.css` `.mainCol` (already `themed`+`overflow-y:auto` `:17-28`); verify it scrolls inside `.settingsTab{overflow:hidden}` and conforms, no new class needed unless verification fails
     - dictionary — two-pane layout scrolls internally (`leftPane`/`rightPane` + `MobileSheet .content` `MobileSheet.module.css:97-102`); verify existing scrollers suffice
  3. System outputs a working scroll region per tab: `overflow-y:auto` inside a `min-height:0` flex chain (`.content` → `.tabPane` → tab root → scrollport)
- Alt flow: tab with fixed chrome above the scroller (vocabulary toolbar/search `:15-39`) — scrollport is the list element below the chrome, not the tab root
- Exception: scrollport inside `mountReactShadow` shows unstyled scrollbar → solved by `composes: themed` inside `.scrollport`; if the toolchain rejects chained composes (`scrollport` composing `themed`), DELIVER inlines the `.themed` declarations instead — outcome identical
- Rules:
  - `.scrollport` is mechanics-only — **no padding** lives in it (gutter is REQ-3; bottom inset is REQ-4); keeps it composable by flush-layout tabs (dictionary panes)
  - `.content` keeps `display:flex; flex-direction:column; overflow:hidden` — it is the clip boundary; panes must not overflow it
  - The scroll chain must be unbroken `flex`+`min-height:0` from `.tabPane` to the scrollport — a `flex:1` scroller inside an auto-height parent silently re-introduces F-1
- Postcondition: every item in every tab is reachable by scrolling; themed scrollbar appears on playlist/recap/studyModes/vocabulary scrollports
- NFR refs: NFR-1 (zoom/viewport reachability), NFR-5

REQ-3: Gutter single-authority — `.content` flush, tabs own padding via shared tokens
- Actor: maintainer (uniform gutters survive tab add/rename) · learner (consistent spacing)
- Goal: exactly one padding declaration per tab, owned by the tab, fed by shell-owned token values — zero name-keyed selectors in the shell
- Preconditions: `.content{padding:var(--space-4)}` + carve-out `:53-58` zeroes it for 4 named `data-cell-id`s; playlist/recap double-pad (`~28-32px` effective vs `12-16px` on siblings); `.content` media-query padding overrides `:99-103,:113-115`
- Basic flow:
  1. System removes ALL padding from `.content` — the `:49` declaration, the entire `:53-58` attribute-keyed carve-out block, and the `.content` padding overrides in the `≤839px`/`<599px` media queries — `.content` becomes a pure flush flex host
  2. System declares the canonical gutter + inset as custom properties on `.body` (`UniversalPanel.module.css`), owned by the shell, consumed by tabs:
     ```css
     .body {
       --universal-panel-tab-gutter: var(--space-3) var(--space-4);
       --universal-panel-tab-scroll-inset: var(--space-4);
     }
     ```
  3. Each page-gutter tab declares `padding: var(--universal-panel-tab-gutter)` on its page container (playlist `.list`, recap `.body` + `.stateWrap`, vocabulary `.tab`, studyModes `.tab`); the scrollport's block-end padding additionally consumes the inset (REQ-4) — declaration pinned as `padding: var(--universal-panel-tab-gutter); padding-block-end: var(--universal-panel-tab-scroll-inset);`, i.e. block-end = the inset alone (16px ≥ `--space-3`), NOT gutter-block + inset; on non-scroll hosts (`.stateWrap`) the gutter's own block-end stands
  4. Edge-managed tabs (dictionary two-pane, settings inner column) keep their internal guttering — they satisfy the contract by declaring their own padding in their own module CSS, never via shell selectors
- Alt flow: DESIGN may substitute the token values (e.g. a reduced inline gutter below a breakpoint) — values change in ONE place (`.body`); application sites never change
- Exception: a new tab forgetting the padding declaration renders flush — a visible, greppable defect (`var(--universal-panel-tab-gutter)` in its CSS or not), not the silent double-padding/rename-orphan failure of the carve-out
- Rules:
  - The carve-out existed because `.content` is a single element whose `data-cell-id` tracks the *active* tab — per-tab padding at shell level is impossible without name-keying. Therefore: `UniversalPanel.module.css` MUST NOT contain any `[data-cell-id]` selector or per-tab padding ever again
  - Canonical pair pinned at `var(--space-3) var(--space-4)` (12/16px — playlist/recap's existing self-padding): vocabulary inline gutter goes 12→16, studyModes block gutter 16→12 — intended deltas for DESIGN sign-off
  - Mobile gutter: spec pins one pair at all widths; if DESIGN wants a `≤599px` reduction it is declared once on `.body` under the media query, not per tab
- Postcondition: effective page gutters are uniform across page-gutter tabs; renaming a `data-cell-id` or adding a seventh tab cannot silently break layout
- NFR refs: NFR-4 (by-construction), NFR-5

REQ-4: Scroll-bottom inset clears the nav hairline
- Actor: learner (reads the last row)
- Goal: a fully-scrolled last row never lands flush on the bottom-nav hairline (nav is bottom-anchored at `≤839px` via `.panel{flex-direction:column-reverse}` `UniversalPanel.module.css:80-84`)
- Preconditions: no bottom scroll inset exists today (audit M-3); last rows clip at the hairline
- Basic flow:
  1. Learner scrolls any tab to the end at `≤839px`
  2. System has extended the scroll extent's block-end by `var(--universal-panel-tab-scroll-inset)` (≥ `--space-3`, default `--space-4`) via `padding-block-end` inside the scroll container
  3. Last row comes to rest ≥ `--space-3` above the nav hairline, including safe-area where present
- Alt flow: tab whose root already provides ≥ `--space-3` clearance between scrollport edge and nav (e.g. gutter on tab root) satisfies the AC — but the uniform mechanism is inset inside the scroll extent; DESIGN normalizes
- Exception: dictionary tab — the bottom chrome there is `MobileSheet` anchored `bottom:0` to `.dictionaryTab` (`MobileSheet.module.css:10-14`), not the nav: the `leftPane` scroller's block-end clearance must additionally cover the collapsed sheet peek (`--mobile-sheet-peek-height`) when the sheet overlays the list edge; verify specifically
- Rules:
  - Mechanism is `padding-block-end` on the scroll container — NOT `scroll-padding-bottom` (shifts scroll-into-view targets, does not extend scroll extent) and NOT a spacer div (extra DOM for a CSS job)
  - Apply at all breakpoints — uniform breathing room; desktop sidebar is left-anchored but the inset is harmless there
- Postcondition: last row of every scrollport clears bottom chrome by the spacing rhythm
- NFR refs: NFR-1

REQ-5: Activation lifecycle signal — `isActive` bound at the mount seam
- Actor: system-internal contract — maintainer consumes when authoring a tab with live resources
- Goal: a kept-alive pane under `[hidden]` has a defined lifecycle signal; `display:none` alone is not the lifecycle (it stops nothing — `PlaylistTab.tsx:217-225` `<audio autoPlay>` proves it)
- Preconditions: panes are opaque `ReactNode`s created once in `mountUniversalPanel.ts:223-228`; `cloneElement` injection is blocked by `ErrorBoundary` wrappers — the signal must be bound at element creation
- Basic flow:
  1. `mountUniversalPanel` converts `playlistPanel`/`recapPanel` constants into render functions `renderPlaylistPanel(isActive)` / `renderRecapPanel(isActive)` — the established precedent is `renderDictionaryPanel(open)` at `:186-215`
  2. `render()` binds `isActive := open && currentTab === <tab>` — a tab is active only when its pane is user-visible (panel closed/closing counts as inactive)
  3. The consuming tab declares `readonly isActive: boolean` and reacts in an effect; element recreation per render preserves component instance state (same type + position)
- Alt flow: a future tab needing the same lifecycle declares `isActive` and its mount site binds it — the contract is the prop name + derivation, not a new mechanism
- Exception: none — pure prop threading; `open`/`currentTab` already exist at the mount site
- Rules:
  - A `.tabPane[hidden]` subtree MUST produce no user-perceivable output: no audio, no timers driving visible mutation, no toasts. Silent state updates (list refresh listeners) MAY stay subscribed while hidden
  - `isActive` is the canonical signal — tabs MUST NOT observe `[hidden]` via MutationObserver or DOM polling
  - Reactivation MUST NOT reset preserved UI state (scroll, expansion) — keep-alive exists to keep it
  - Chosen over a context provider: one prop is the smallest mechanism for 2 consumers (intent risk register); revisit if a third consumer appears
- Postcondition: activation/deactivation is a defined, inheritable part of the tab contract
- NFR refs: NFR-2, NFR-4

REQ-6: Playlist preview teardown on deactivate (REQ-5 consumer)
- Actor: learner (switches away mid-preview)
- Goal: sound follows the visible tab; the blob URL is released, not just muted
- Preconditions: `<audio autoPlay controls src={previewUrl}>` renders inside the keep-alive pane; `previewUrlRef`/`setPreview` (`PlaylistTab.tsx:88-117`) already centralize create+revoke
- Basic flow:
  1. Learner presses Preview → system chunks-reads the record, creates a blob URL, mounts `<audio autoPlay>`
  2. Learner switches to another tab (or closes the panel) → `isActive` flips false
  3. System effect `on !isActive → setPreview(null, null)` — unmounts `<audio>` (playback stops deterministically) and revokes the object URL
- Alt flow: learner toggles preview off while active → existing `setPreview(null, null)` path (unchanged); panel close mid-preview → `isActive` false pauses during the close animation, then unmount cleanup (`:105-110`) revokes — both layers stay
- Exception: preview requested while a chunk read is in flight then tab deactivates → `onPreview`'s async loop still resolves and calls `setPreview` while inactive; the `!isActive` edge already fired and `previewUrl` is not an effect dep, so nothing clears the `<audio autoPlay>` it mounts inside `[hidden]` — it would play forever. Pinned guard (DELIVER picks one): skip `setPreview` + revoke the created URL when `isActive` went false mid-read (ref-mirror checked before publish), OR extend the teardown effect's deps to `[isActive, previewUrl]`; the AC is "no audio from a hidden pane, ever"
- Rules: teardown = stop AND release (revoke URL) — a paused-but-mounted `<audio>` still satisfies the audio-stop AC but leaks the blob; the contract releases
- Postcondition: hidden playlist pane is silent and releases its blob URL; returning to the tab shows no stale preview UI
- NFR refs: NFR-2

REQ-7: Recap revalidate-on-activation, place preserved (REQ-1 + REQ-5 consumer)
- Actor: learner (returns to Recap between other work)
- Goal: recap keeps scroll + expansion across tab switches while the session list refreshes — keep-alive without staleness
- Preconditions: recap now mounts via `.tabPane`/`visitedTabs` (REQ-1); `expandedId` state + `.body` scroll node persist while hidden; `load()` (`RecapTab.tsx:187-199`) is idempotent
- Basic flow:
  1. First activation → pane mounts (`visitedTabs` gate) with `isActive=true` → effect `if (isActive) void load()` fires → `GET_SESSION_RECAP`
  2. Learner expands a session, scrolls, switches away → pane hides, subtree preserved
  3. Re-activation → `isActive` flips true → `load()` re-fires → `sessions` replaced if changed; `expandedId` survives (keyed by `session.id`; a vanished session simply renders collapsed); `.body` scroll position survives (same DOM node)
- Alt flow: revalidation returns identical data → render settles, no visual churn (React reconciles; scroll unaffected — verify no scroll jump)
- Exception: revalidation fails while hidden data exists → surface via existing `failed` path only on first load semantics — while stale data is displayed, a failed refresh MUST NOT blank the list; set `failed` only when `sessions === null` (empty-cache error view unchanged); a failed refresh over displayed data keeps the stale list (stale > void; note in verify)
- Rules: `useEffect(() => { if (isActive) void load(); }, [isActive, load])` replaces the mount-only effect at `RecapTab.tsx:201-203`; no debounce needed — tab switches are human-paced, one cheap message each
- Postcondition: `expandedId` + scroll survive round-trips; data is never older than the last activation
- NFR refs: NFR-2, NFR-3

REQ-8: Single surface remap hoisted to `.body`
- Actor: maintainer · learner (cards read as one surface scheme)
- Goal: one declaration site for the `--card-background`/`--color-surface-card` → `surface-elevated` remap; a `Card` renders the same shade on every tab
- Preconditions: remap exists ×3 (`VocabularyTab.module.css:9-10`, `SettingsTab.module.css:9-10`, `StudyModesTab.module.css:8` — the last covers only `--card-background`); dictionary paints `background:var(--color-surface)` with no remap (`DictionaryTab.module.css:8`); playlist/recap paint neither
- Basic flow:
  1. System adds to `.body` (`UniversalPanel.module.css:33-41`): `--card-background: var(--color-surface-elevated); --color-surface-card: var(--color-surface-elevated);`
  2. System deletes the three per-tab remap lines; `background: var(--color-surface)` declarations on `.tab`/`.settingsTab`/`.dictionaryTab` remain — they are the base surface, not the remap (base surface decision `surface` stays as-is; DESIGN may revisit)
  3. Every `Card` in every tab now resolves the elevated token identically
- Alt flow: none
- Exception: `StudyModesTab.module.css:39` `.modeCard{--card-background:var(--color-field)}` is a deliberate inner override paired with the `:88-93` hover rule — it MUST survive; it is not a remap site
- Rules:
  - `.body` is the hoist site (covers header + content; `UniversalPanelHeader` uses no `Card` today — verify); `.panel` would leak to nav/sidebar, per-tab stays fragmented
  - Visual delta is intended (N6): playlist/recap/dictionary cards gain the elevated shade — before/after captures must show cards still reading raised on the base surface; this shade unification touches but does not cross into item 33 (no recipe/typography/shadow changes)
- Postcondition: exactly one `--card-background`/`--color-surface-card` declaration per color-scheme axis in the panel subtree (plus whitelisted inner overrides); grep finds zero tab-level remap copies
- NFR refs: NFR-4, NFR-5

REQ-9: Empty state fills the scrollport
- Actor: learner (opens an empty tab)
- Goal: `EmptyState` optically centers in the available area instead of hugging the top over a 60–70% void (audit M-14/V-11 part)
- Preconditions: `EmptyState.module.css .root` (`:4-13`) has no fill rule; consumers already hand-patch `style={{flex:1}}` (`SubtitlePanel.tsx:350`, `CueList.tsx:405`) — the atom conventionally wants flex-fill
- Basic flow:
  1. System adds `flex: 1 1 auto` to `.root` — in a flex-column host it fills and internal `justify-content:center` centers; in a block host the property is inert
  2. `.root.bordered` is excluded (`flex: none`) — the bordered variant is an inline list placeholder (`:106-112`), not a page filler (`ResourcesPanel.tsx:336`, `DictLinksManager.tsx:116`)
  3. Tab-level empty/loading/error hosts become `flex:1; min-height:0` flex-column containers so the atom has height to fill: recap `.stateWrap`/`.center`, playlist `.empty`, settings loading stub, vocabulary empty branches — playlist `.empty` (`PlaylistTab.module.css:56-64`) is NOT an `EmptyState` host (own Icon+Text content) and lacks `justify-content:center`, so it additionally gains it (AC-8 requires centering on all six tabs)
- Alt flow: tabs whose `EmptyState` is already a direct flex-column child (vocabulary `.tab`/`.list`) need no host change
- Exception: non-panel consumers inside flex containers with siblings could grow unexpectedly — DELIVER greps every `EmptyState` render site (subtitle panel, dictionary popup surfaces, sync/language panels, card creator, popup, sidepanel, showcase) and visually spot-checks ≥3; `flex:1` on a sole-child empty state inside flex-column is the desired outcome everywhere
- Rules: no per-call `style={{flex:1}}` needed after this — existing inline overrides become redundant (leave them; removing is optional churn)
- Postcondition: empty states center vertically on all six tabs at `768×1024` and `390×844`; no regression at other consumers
- NFR refs: NFR-1, NFR-5

REQ-10: Activate the dead playlist `@container`
- Actor: learner on narrow viewport (row actions wrap)
- Goal: `PlaylistTab.module.css:82-91` `@container (max-width:480px)` evaluates — or is honestly gone; dead code does not survive
- Preconditions: the query never evaluates — no `container-type` ancestor under `universalPanel`; the wrap intent + hang-indent `calc(var(--space-3) + 20px)` were written for it
- Basic flow:
  1. System adds `container-type: inline-size` to the playlist scroll container `.list` (nearest ancestor of `.itemInner`/`.itemActions`; inline-size containment does not constrain block size or scrolling — same pattern as `SettingsDialog.module.css:6` `.popoverBody` with live queries at `:180-209`)
  2. At container width ≤480px (≈320–390px viewports) `.itemInner` wraps and `.itemActions` takes `width:100%` + hang-indent
  3. Verify the wrap renders correctly at 320/390px — this CSS has never painted; the capture is first-ever visual QA of it
- Alt flow (recorded fork): if verification shows the never-exercised wrap layout is broken beyond a trivial fix → delete `:82-91` + the `container-type`; narrow-width row behavior then verified as non-wrapping at 320–390px. Either way, no dead `@container` remains
- Exception: `.list` becomes the containing block for absolutely-positioned descendants — none exist in playlist rows (all in-flow); safe
- Rules: do not widen scope — this fixes the dead query only, not a playlist row redesign (item 33)
- Postcondition: row-wrap demonstrably works at ≤480px container width, or the block is deleted with verification
- NFR refs: NFR-1, NFR-5

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Reachability at every supported viewport + 200% zoom | U/a11y | Viewports 1440×900, 900×700, 768×1024, 390×844, 320×568; 200% zoom keeps all items scrollable-reachable (STANDARD §10.2) |
| NFR-2 | Deterministic lifecycle | R | Zero audio/perceivable output from a `[hidden]` pane; teardown releases blob URLs; reactivation revalidates stale data without resetting UI state |
| NFR-3 | Resource bound | P/resource | Keep-alive adds ≤1 DOM subtree (recap: one list, no media); revalidation = 1 `GET_SESSION_RECAP` per activation; ≥1GB RAM persona holds |
| NFR-4 | Contract-by-construction | S/maintain | New tab inherits `.tabPane`+`visitedTabs`+`.scrollport`+gutter tokens without touching shell selectors; zero `[data-cell-id]`-keyed CSS in `UniversalPanel.module.css` |
| NFR-5 | Bounded visual delta | U | Pixel parity except declared deltas: scroll reachability, unified gutters (vocab 12→16 inline, studyModes 16→12 block, playlist/recap ~28-32→12/16), card shade on playlist/recap/dictionary, studyModes `--color-surface-card` newly remapped to surface-elevated (REQ-8 hoist — `StudyModesTab.module.css:8` only remapped `--card-background`), centered empty states, bottom inset, playlist row wrap ≤480px |

## Flows / States

```
Tab pane lifecycle (per tab — all six identical after REQ-1):

unvisited ──first activation──▶ active     (visitedTabs.add; mount; isActive=true)
active    ──switch away────────▶ hidden    ([hidden]→display:none; isActive=false;
                                          media stopped+released; silent listeners ok)
hidden    ──re-activate────────▶ active    (isActive=true; revalidate stale data;
                                          scroll + expansion preserved)
any       ──panel close────────▶ unmounted (isOpen=false counts inactive; unmount
                                          effects revoke URLs; visitedTabs survives
                                          for next open)

Playlist preview (REQ-6):
idle ──Preview tap──▶ reading chunks ──done──▶ previewing (<audio autoPlay> + blob URL)
previewing ──isActive:false──▶ idle          (setPreview(null,null): unmount audio + revoke)
previewing ──Preview tap / unmount──▶ idle   (existing paths unchanged)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Reveal all owned tab content | `.scrollport` shared class in `Scrollable.module.css`; per-tab scroll container designation; unbroken `min-height:0` flex chain `.content`→`.tabPane`→scrollport |
| Mount tabs uniformly | `.tabPane` + `visitedTabs` for all six; `.tabPane[hidden]` display rule |
| Give panes a lifecycle | `isActive` prop bound at `mountUniversalPanel` render fns; playlist preview teardown effect; recap revalidate effect |
| Own gutters uniformly | flush `.content`; `--universal-panel-tab-gutter`/`--universal-panel-tab-scroll-inset` vars on `.body`; per-tab `padding:` declaration consuming the vars |
| Clear the bottom chrome | `padding-block-end` inside each scroll extent; dictionary `MobileSheet`-peek verification |
| Unify card surfaces | `.body` hoisted `--card-background`/`--color-surface-card` remap; per-tab remap deletions |
| Fill empty space | `EmptyState .root{flex:1}` (bordered excluded); tab host containers `flex:1` flex-column |
| Honor narrow-width intent | `container-type:inline-size` on playlist `.list` + live `@container` wrap (or honest deletion) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `visitedTabs` | `ReadonlySet<UniversalPanelTab>` | `UniversalPanel` state (`:167`) | Panel component lifetime (survives close→open; panes remount on reopen) |
| `activeTab` / `currentTab` | `UniversalPanelTab` | controller + `chrome.storage.session` `UNIVERSAL_PANEL_TAB` | session; unchanged by this item |
| `isActive` | derived `open && currentTab===tab` | computed at `mountUniversalPanel` render | not stored |
| Playlist preview | `previewId`, `previewUrl` (+`previewUrlRef`) | `PlaylistTab` state; blob object URL | released on deactivate AND unmount |
| Recap view state | `sessions`, `expandedId`, `failed` | `RecapTab` state | survives tab switch (keep-alive); dies on panel close; revalidated per activation |
| Scroll position | DOM `scrollTop` on scrollport node | scrollport element | survives tab switch (node persists); dies on unmount |
| CSS contract | `.scrollport`, `--universal-panel-tab-gutter`, `--universal-panel-tab-scroll-inset`, `.body` remap | `Scrollable.module.css`, `UniversalPanel.module.css`, per-tab module CSS | n/a |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 scroll region per tab | REQ-2 | AC-1 |
| N2 media stops on hide | REQ-5, REQ-6 | AC-2 |
| N3 uniform mounting | REQ-1 | AC-3 |
| N4 recap place + freshness | REQ-7 | AC-4 |
| N5 gutter single-authority | REQ-3 | AC-5 |
| N6 one surface remap | REQ-8 | AC-6 |
| N7 nav clearance | REQ-4 | AC-7 |
| N8 dead `@container` | REQ-10 | AC-9 |
| N9 empty-state fill | REQ-9 | AC-8 |
| N10 lifecycle contract | REQ-5 (+REQ-6/7 consumers) | AC-2, AC-4, AC-10 |

| Journey step | REQ |
|---|---|
| TO-BE-1 playlist reachable + inset | REQ-2, REQ-4 |
| TO-BE-2 preview stops on switch | REQ-5, REQ-6 |
| TO-BE-3 recap place + revalidate | REQ-1, REQ-7 |
| TO-BE-4 one contract felt | REQ-1, REQ-3, REQ-8 |
| TO-BE-5 phone inset + wrap + centered empty | REQ-4, REQ-9, REQ-10 |

Stories S1–S7 map: S1→REQ-2/4; S2→REQ-5/6; S3→REQ-1/7; S4→REQ-1/3/8; S5→REQ-4; S6→REQ-1/3; S7→REQ-10.

## Boundaries

- Always: tokens/custom-props only for spacing+colors; `composes:` from `@/shared/ui/Scrollable.module.css` is the scrollbar/scrollport mechanism (repo precedent); `data-cell-id` kept as test hook but NEVER CSS-keyed; flip `UniversalPanel.test.tsx:101-119` and add coverage for recap keep-alive + isActive-driven teardown; pure prop derivation (`isActive`) at mount seam; update `docs/2-architechture-system.md` for the contract.
- Ask first: none anticipated — all mechanisms exist in-repo; if DELIVER finds `.mainCol`/dictionary scrollers non-conformant beyond a one-line fix, surface it rather than redesigning the tab (items 32/33 territory).
- Never: touch nav chrome/order/badges (item 31), tab hit-targets/focus/tablist semantics (item 30), settings section subnav (item 32), selected-state recipes/typography/chips/playlist hand-rolled-EmptyState migration (item 33), token registry or native-atom dedup (item 29); no new dependencies; no CSS keyed on `data-cell-id`; no MutationObserver on `[hidden]`; do not "fix" `setVisitedTabs`-during-render (item 29, F-24).

## Success Criteria

- [ ] AC-1 (N1): Every tab's content is scroll-reachable when it overflows at 1440×900, 900×700, 768×1024, 390×844, 320×568 and at 200% zoom — playlist `.list` and recap `.body` gain `composes: scrollport`; themed scrollbar renders in the shadow root; verified per tab, not assumed.
- [ ] AC-2 (N2, N10): With a playlist preview playing, switching to any other tab stops audio and clears the preview UI (object URL revoked — `previewUrlRef` null); closing the panel mid-preview cleans up as before; no audio is ever emitted from a `[hidden]` pane (real-Chromium verify — jsdom does not play audio).
- [ ] AC-3 (N3): Recap mounts through `.tabPane` + `visitedTabs` identical to its siblings; a tab round-trip preserves the recap pane's DOM node identity (unit test — the `:101-119` test flipped); `{activeTab === 'recap' && recapPanel}` no longer exists in `UniversalPanel.tsx`.
- [ ] AC-4 (N4): Recap `expandedId` and scroll position survive a tab round-trip; `GET_SESSION_RECAP` fires once per activation (first visit and every return); a failed refresh over displayed data keeps the stale list.
- [ ] AC-5 (N5): `grep -n "data-cell-id" UniversalPanel.module.css` → zero hits; `.content` carries no padding at any breakpoint; effective page gutter is `12px block / 16px inline` (`--space-3 --space-4`) uniform on playlist, recap, vocabulary, studyModes at desktop and mobile breakpoints; dictionary/settings internal guttering verified consistent.
- [ ] AC-6 (N6): `--card-background`/`--color-surface-card` remap declared exactly once, on `.body`; zero copies in tab CSS; computed card background is identical on all six tabs; `.modeCard`'s `var(--color-field)` override intentionally preserved; cards still read raised on the base surface in before/after captures.
- [ ] AC-7 (N7): Fully-scrolled last row of every tab scrollport clears the bottom-nav hairline by ≥ `--space-3` at ≤839px (incl. safe-area where present); dictionary `leftPane` last row clears the collapsed `MobileSheet` peek — verified specifically.
- [ ] AC-8 (N9): `EmptyState` optically centers within the scrollport on all six tabs at 768×1024 and 390×844 (top/bottom gap roughly symmetric — the 60–70% top-anchored void is gone); `bordered` variant and ≥3 non-panel consumers spot-checked unchanged.
- [ ] AC-9 (N8): Playlist rows demonstrably wrap at ≤480px container width (verify at 320/390px viewports — hang-indent `calc` paints correctly), OR the `@container` block is deleted and non-wrapping rows verified at 320–390px. No dead `@container` remains either way.
- [ ] AC-10 (N10): The lifecycle mechanism is the single `isActive` prop bound at the mount seam — no MutationObserver/DOM-polling on `[hidden]`, no per-tab ad-hoc variants.
- [ ] AC-11 (delta bound): Before/after captures for all 6 tabs × {1440×900 desktop, 390×844 mobile} show only the declared deltas (NFR-5 list); everything else pixel-parity.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run test:unit && npm run build` green (build catches Vite CSS `composes` errors tsc misses)
- [ ] Unit coverage: recap keep-alive (flipped test), `isActive` → preview teardown, recap revalidate-on-activation; `mountUniversalPanel` render-fn binding
- [ ] Real-Chromium pass (Playwright persistent + `--load-extension` per `testing-extension-browser`): tab-switch audio stop, recap keep-alive + refetch, scroll reachability sweep, `MobileSheet`/dictionary edge
- [ ] Before/after captures: all 6 tabs × desktop + mobile per AGENTS UI-evidence rule (this item has real visual deltas — DOM rects alone insufficient)
- [ ] `docs/2-architechture-system.md` updated with the tab-layout contract; `docs/0-wiki.md` changelog

## Open Questions / Accepted Risks

- **`@container` fork:** primary = activate via `container-type:inline-size` on `.list` (original intent evident; hang-indent written for it; `SettingsDialog` precedent). Fallback = delete the block if first-ever rendering is broken beyond trivial fix. Either satisfies AC-9.
- **Card-shade delta breadth:** hoisting applies the elevated remap to playlist/recap/dictionary, which previously had none — intended (N6), bounded by captures; flagged adjacency to item 33 (shade unification is in scope; recipes/shadows are not).
- **Mobile gutter token:** spec pins `var(--space-3) var(--space-4)` at all widths, deleting the `.content` 599px reduction (`--space-2`) — a 320px viewport then gets 16px inline gutters (288px content). DESIGN may add one `--universal-panel-tab-gutter` override on `.body` at `≤599px`; the var keeps it single-site.
- **`isActive` over context:** smallest mechanism for 2 consumers per the intent risk register; if a third tab needs the signal, revisit context — the contract (prop name + derivation + hidden-pane rules) is what matters, not the transport.
- **EmptyState global `flex:1`:** 15+ render sites beyond the panel; `bordered` excluded; sole-child-in-flex-column fill is desired everywhere; regression surface bounded by the AC-8 sweep.
- **Reopen semantics unchanged:** `visitedTabs` persists across close→open but panes unmount on close — recap refetches on reopen via the mount-activation path; no behavior change intended here.
