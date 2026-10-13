# Spec Review — up-tab-layout-contract

> Artifact: `docs/specs/up-tab-layout-contract.md` · Intent: `docs/intent/up-tab-layout-contract.md` · Reviewer: fresh-context adversarial audit (BA+PO+TL, one pass)

Every author-reported locked decision re-verified against source: `Scrollable.module.css` (`themed` :11-32, chained-composes precedent `.themedWide` :34-41); `UniversalPanel.module.css` (`.content` padding :49, carve-out :53-58, `.tabPane[hidden]` :68-70, media padding :99-103/:113-115); `mountUniversalPanel.ts` (`renderDictionaryPanel(open)` :186-215 precedent, `render()` re-invoked on open/close/tabChange :118-134); `UniversalPanel.tsx` (`visitedTabs` :167-170, recap bare mount :287, `data-tihoka-id` template :274 — attribute survives, only CSS keying dies); `UniversalPanel.test.tsx:101-119` asserts the defect exactly; `PlaylistTab.tsx` (`previewUrlRef`/`setPreview` :88-117, unmount revoke :105-110, `<audio autoPlay>` :217-225); `RecapTab.tsx` (`load()` :187-199, mount-only effect :201-203); `StudyModesTab.module.css` (`overflow-y:auto` :6, remap `:8` card-background only, `.modeCard` field override :39 + hover :88-93); `VocabularyTab.module.css` (remap :9-10, `.list` :53-55); `SettingsDialog.module.css` (`container-type` :6, `.mainCol` composes `themed` :18, live queries :180-209); `SettingsTab.module.css:9-10` + `overflow:hidden` :14; `DictionaryTab.module.css:8`; `EmptyState.module.css` `.root` :4-13, `.root.bordered` :106-112; `MobileSheet.module.css` `bottom:0` :10-14, `.content` scroller :97-102; `tests/setup.ts:6`. `.scrollport` name: zero existing collisions. `container-type:inline-size` on `.list` safe — stretch-sized flex item, no abs-pos descendants.

## Blockers

none.

## Major

1. [REQ-6 exception] [TL]: The listed fallback "let the next deactivate edge clear it" cannot satisfy AC-2. If the in-flight `CONDENSE_AUDIO_READ` loop resolves while `isActive` is already false, `setPreview` mounts `<audio autoPlay>` inside `[hidden]` and no further deactivate edge ever fires → audio plays from a hidden pane indefinitely. Fix: strike that option; pin the publish-guard (skip `setPreview` + revoke the created URL when `isActive` went false mid-read) — or extend teardown-effect deps to `previewUrl`.

## Minor

1. [REQ-9 step 3] [PO]: playlist `.empty` (`PlaylistTab.module.css:56-64`) renders its own content — not an `EmptyState`-atom host — and lacks `justify-content:center`. AC-8 requires centering on all six tabs; REQ text only says `flex:1` flex-column. Fix: state `.empty` also gains `justify-content:center`.
2. [REQ-3 step 3 / REQ-4] [TL]: gutter+inset composition underdetermined — is block-end `var(--universal-panel-tab-scroll-inset)` alone or `space-3 + inset`? Fix: pin exact declaration, e.g. `padding: var(--universal-panel-tab-gutter); padding-block-end: var(--universal-panel-tab-scroll-inset);`.
3. [REQ-8] [TL]: Hoisting `--color-surface-card` onto `.body` newly remaps it for studyModes (whose `:8` only remapped `--card-background`) — add "studyModes `--color-surface-card` gains remap" to NFR-5's declared-delta list.
4. Line-cite drift: `EmptyState.module.css` bordered block is `:106-112` (spec `:105-113`); SettingsDialog container queries end `:209` (spec `:180-205`).

## Nhận xét theo role

- BA: Opens with the defect landscape, actors/persona bounded, non-goals fence items 29–33 cleanly; N1–N10 → REQ → AC traceability complete and bidirectional (AC numbering swap for N8/N9 mapped explicitly).
- PO: ACs testable with real pass/fail mechanics (grep checks, node-identity assertion, viewport sweep, 6-tab × 2-form-factor captures, real-Chromium audio verify); failure paths present.
- TL: Alternatives documented with rejection reasons; keep-alive semantics coherent; `isActive` derivation feasible — `render()` re-fires on every activation transition.

## Action items

1. Strike the invalid "next deactivate edge" option; pin the publish-guard — REQ-6.
2. Pin exact `padding-block-end` declaration for gutter+inset composition — REQ-3/REQ-4.
3. Add `justify-content:center` requirement for playlist `.empty` — REQ-9.
4. Add studyModes `--color-surface-card` delta to NFR-5 — REQ-8/NFR-5.

## Risks chấp nhận

- `.scrollport` chained `composes: themed` — repo precedent exists, fallback spec'd — revisit if Vite build rejects.
- EmptyState `flex:1` across 15+ non-panel consumers — bounded by `bordered` exclusion + AC-8 spot-check sweep.
- `@container` fork is a recorded either/or with first-ever-paint verification.
- Keep-alive memory bound (+1 DOM subtree) — NFR-3 bound stated; ≥1GB persona holds.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. REQ-6 exception: struck the "let the next deactivate edge clear it" fallback (it cannot fire — `previewUrl` is not an effect dep); pinned publish-guard as skip-`setPreview`+revoke on mid-read `isActive` flip OR teardown deps extended to `[isActive, previewUrl]`.
2. REQ-3 step 3: pinned `padding: var(--universal-panel-tab-gutter); padding-block-end: var(--universal-panel-tab-scroll-inset);` — block-end is the inset alone (16px ≥ `--space-3`), not gutter-block + inset; non-scroll hosts keep the gutter's own block-end.
3. REQ-9 step 3: playlist `.empty` (`PlaylistTab.module.css:56-64`) stated to gain `justify-content:center` — it renders own Icon+Text, not the `EmptyState` atom.
4. NFR-5: added studyModes `--color-surface-card` newly remapped to surface-elevated to the declared-delta list (`StudyModesTab.module.css:8` only remapped `--card-background`).
5. Cite drift: `EmptyState.module.css` bordered corrected `:105-113` → `:106-112`; SettingsDialog container queries `:180-205` → `:180-209`.
