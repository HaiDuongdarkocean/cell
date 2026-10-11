# Spec: Settings Tab Surface Redesign (YouTube/Spotify-inspired)

> Intent: `docs/intent/settings-tab-redesign.md` · ui_surface: yes · Mode: all

## Objective

The settings surface rendered by `SettingsDialogContent` must present all 13 sections through one redesigned visual grammar — section headers, grouped rows, dividers, and controls — so the page scans like a consumer settings surface rather than a stack of identical boxes. Every change is markup/CSS/token-level inside `src/features/settings/` (and shared atoms only where a repeating pattern demands promotion); no setting's function, storage, or contract changes. Direction reference: YouTube/Spotify settings grammar (flat grouped lists, visible supporting text, right-edge controls, strong section titles) expressed through this repo's design tokens — never literal foreign values.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Settings user | Opens Settings tab (universal panel) or standalone Settings dialog; scrolls; clicks subnav item; operates a control | Scroll position, pointer/keyboard input, control values | The settings surface: labeled subnav, section column, rows, controls, hint popovers |
| System (this spec) | — | — | Renders section anatomy, applies scroll-sync/hide-on-scroll, persists values (unchanged), honors theme + breakpoint |

System-internal processing never includes human behavior. Rendering decisions are the system's; control *values* are actor input.

## Requirements

### Functional

REQ-1: Unified section anatomy for all 13 sections
- Actor: settings user
- Goal: recognize section boundaries and purpose while scanning
- Preconditions: Settings surface mounted in either consumer (`SettingsTab` horizontal, `SettingsDialog` vertical-sidebar ≥768px)
- Basic flow:
  1. actor opens Settings
  2. system renders the 13 sections (general, languageProfile, resources, media, block, dictionaryPopup, wordBadge, audio, localPlayer, download, shortcuts, theme, sync) each through the single section anatomy defined by the design brief (header: title + supporting description; body: grouped rows)
  3. actor sees a consistent section grammar instead of mixed `cardHeader`/`cardBody`/`downloadCardBody`/bare variants
- Alt flow: sections whose body is a single embedded feature panel (resources, audio, theme, sync) render that panel inside the same section chrome — no nested card doubling
- Exception: a section with no content (e.g. resources with zero profiles) renders its `EmptyState` inside the same anatomy
- Rules: 13/13 sections covered — none may keep the legacy boxed-card treatment; section order/ids/scroll-sync anchor targets unchanged
- Postcondition: `data-section` attributes and `sectionRefs` contract preserved for scroll-sync
- NFR refs: NFR-1, NFR-2, NFR-4

REQ-2: Unified row anatomy
- Actor: settings user
- Goal: read and operate any setting row predictably
- Preconditions: a section is visible
- Basic flow:
  1. actor scans a section's rows
  2. system renders each control row through one shared anatomy — setting name, optional supporting description, control at a consistent edge — as defined by the design brief and implemented via the shared `SettingsRow` atom (extended if needed)
  3. actor reads purpose and operates the control in the same place in every row
- Alt flow: composite rows (Download's grouped selects, Shortcuts grid fields, child fields like `workers-select`) use the same anatomy's group variant rather than bespoke wrappers
- Exception: none — a row that cannot fit the anatomy is a design-brief finding, not an exception
- Rules: control behavior and `data-cell-id` hooks unchanged; `HintIcon` remains available for secondary explanation
- Postcondition: one row recipe per variant, applied across all sections
- NFR refs: NFR-1, NFR-3, NFR-4

REQ-3: Visible supporting text where primary
- Actor: settings user
- Goal: understand a setting without an extra tap/click on ⓘ
- Preconditions: a row's supporting information exists
- Basic flow:
  1. actor reads a row
  2. system presents supporting description inline per the design brief's stated rule (which settings get inline text vs. retain ⓘ)
  3. actor reads purpose without triggering the popover
- Alt flow: settings with long/secondary explanation keep `HintIcon` — the design rule decides per setting, but no information is removed
- Exception: none
- Rules: i18n keys — new description strings get new `settings.*` keys in both en/vi; existing hint keys stay for retained hints
- Postcondition: every row's primary purpose readable inline or via retained hint per the stated rule
- NFR refs: NFR-1, NFR-3

REQ-4: One grouping/divider grammar
- Actor: settings user
- Goal: perceive sub-grouping consistently (Download groups, Shortcut groups, toggle-card dividers)
- Preconditions: a section contains sub-groups
- Basic flow:
  1. actor scans a multi-group section
  2. system renders group labels/dividers through the single recipe chosen in DESIGN — replacing today's three dialects (`downloadGroup`/`downloadGroupTitle`, `shortcutGroupWrap`/`groupLabel`, `divider` row flags, `childField` left-border)
  3. actor perceives identical sub-structure semantics everywhere
- Alt flow: nested indentation (child fields) renders via the same recipe's child variant, not a bespoke border
- Exception: none
- Rules: visual only — group membership/order unchanged
- Postcondition: one grouping recipe across all sections
- NFR refs: NFR-1, NFR-4

REQ-5: Embedded panel de-duplication of chrome
- Actor: settings user
- Goal: see embedded feature panels as part of the settings surface, not boxes-in-boxes
- Preconditions: section embeds a feature panel (ResourcesPanel+Dictionary, AudioPanel, ThemePanel, SyncPanel+AnkiStatusSyncPanel, DictionaryPopupSettingsPanel→DictLinksManager, LanguageProfilePanel, WordBadgeSettingsPanel)
- Basic flow:
  1. actor opens a section with an embedded panel
  2. system renders the panel integrated into the section anatomy — outer section chrome provides the boundary; inner panel does not double card chrome/shadow/padding where the design brief calls for integration
  3. actor sees one surface, not a box inside a box
- Alt flow: where an embedded panel is also consumed standalone elsewhere (e.g. `Dictionary` integrated variant), the de-doubling must be scoped to the settings context (prop/CSS context), not the shared component's global style
- Exception: a panel whose internal design cannot integrate safely keeps its chrome — recorded as a design-brief decision with reason
- Rules: shared components' other consumers unaffected
- Postcondition: no visually doubled boundaries in settings sections
- NFR refs: NFR-1, NFR-4

REQ-6: Subnav and scroll behavior preserved
- Actor: settings user
- Goal: navigate sections via the labeled subnav and keep orientation while scrolling
- Preconditions: settings surface mounted
- Basic flow:
  1. actor clicks a subnav item / scrolls the column
  2. system scrolls to the section anchor / updates active item, auto-centers it, hides-on-scroll-down and shows-on-up in horizontal mode
  3. actor navigates exactly as shipped by `up-settings-subnav`
- Alt flow: none — identical to today
- Exception: reduced-motion → instant scroll (existing `prefers-reduced-motion` rules preserved)
- Rules: `Navigation`/`NavItem` internals untouched; section anchor contract (`sectionRefs`, `data-section`) intact; labels stay visible (no revert to icon-only)
- Postcondition: navigation behavior parity with pre-change build
- NFR refs: NFR-2, NFR-4

REQ-7: Settings function preservation
- Actor: settings user
- Goal: every control still works
- Preconditions: any setting changed
- Basic flow:
  1. actor operates a control (Toggle, Select, MultiSelect, ShortcutInput, embedded panel action)
  2. system persists via the same `onChange`→`saveSettings`/`syncFlatFieldsToActiveProfile` path as today
  3. actor's setting persists; external storage changes still propagate into the open tab
- Alt flow: first-render focus-into behavior (`SettingsTab.tsx:50-61`) preserved; Escape/dialog-dismissal handling unchanged in both surfaces
- Exception: none new
- Rules: no storage schema change; no i18n key removal; every existing `data-cell-id` value preserved — they live on controls, not anatomy, so zero-cost; any exception is a spec-visible change named in the verify report; no reduction of existing hit-target sizes (row density may not shrink targets below current measurements); aria semantics, focus order, and reduced-motion handling preserved
- Postcondition: functional parity — every existing SettingsTab/SettingsDialogContent test still meaningful (updated only for intentional anatomy changes)
- NFR refs: NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | All spacing/radius/color/typography values resolve to `tokens.json` tokens or shared atoms; zero new literals; residual literals in touched embedded panels swept | S | 100% token-backed in touched files |
| NFR-2 | No behavior regression: tests, aria, focus order, scroll-sync, Escape/dismissal, reduced-motion, existing hit-target sizes | R | Existing suites pass (anatomy-intentional updates only); no control's hit target shrinks below its current rendered size |
| NFR-3 | Information accessibility: primary supporting text visible inline; no contrast/focus regression | U | WCAG AA text contrast preserved; `prefers-reduced-motion` honored |
| NFR-4 | Both surfaces + all breakpoints + light/dark (widths are **container** widths — `popoverBody` is `container-type: inline-size`) | U | Verified at panel container <600px, panel desktop, dialog container ≥768px sidebar, each in light+dark |
| NFR-5 | No new dependencies; no per-section copy of shared recipes | S | New patterns promoted to shared atom/variant only when repeated ≥2 sections |

## Flows / States

No new runtime behavior is introduced — the surface's interaction state machine is unchanged. The only relevant flow is rendering resolution:

```
mount → loadSettings → render 13 sections via shared anatomy
      → storage-changed → re-render (unchanged path)
scroll → Navigation scroll-sync → active item update (unchanged)
subnav click → scrollIntoView → section shown (unchanged)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Present settings sections as one visual grammar | Section anatomy (header+body recipe), shared `SettingsSection`/Card usage per brief, `data-section` anchors |
| Present each setting as a readable, operable row | Unified `SettingsRow` anatomy (name/description/control), `HintIcon` for secondary info |
| Express sub-grouping inside sections | Group-label + divider recipe (one implementation) |
| Integrate embedded feature panels | Context-scoped de-doubling of card chrome (prop or section-scoped CSS) |
| Navigate sections | Existing `Navigation`/`NavItem` + `sectionRefs` (unchanged) |
| Persist + reflect settings | Existing `onChange`/storage listeners (unchanged) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| Settings | unchanged — this spec introduces no data change | `chrome.storage.local` `STORAGE_KEYS.SETTINGS` | unchanged |
| i18n strings | new `settings.*.desc`-style keys for inline descriptions (if the design rule adds any) | `src/shared/i18n/messages/{en,vi}.json` | shipped |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (all 13 redesigned) | REQ-1 | AC-1, AC-2 |
| N2 (section hierarchy legible) | REQ-1, REQ-4 | AC-3 |
| N3 (self-explanatory rows) | REQ-2, REQ-3 | AC-4, AC-5 |
| N4 (consumer-grade, token-backed) | REQ-1..5 | AC-6 |
| N5 (both surfaces, all viewports, themes) | REQ-1..7 | AC-7 |
| N6 (zero behavior regression) | REQ-6, REQ-7 | AC-8, AC-9 |
| N7 (subnav preserved) | REQ-6 | AC-9 |

| Journey step | REQ |
|---|---|
| AS-IS 1-5 (uniform cards, hidden info, three grouping dialects, flat scan, box-in-box) | REQ-1, REQ-3, REQ-4, REQ-5 |
| TO-BE 1 (section grammar) | REQ-1 |
| TO-BE 2 (row anatomy + visible info) | REQ-2, REQ-3 |
| TO-BE 3 (one sub-group language) | REQ-4 |
| TO-BE 4 (embedded panels integrated) | REQ-5 |
| TO-BE 5 (same behavior everywhere) | REQ-6, REQ-7 |

## Boundaries

- Always: design tokens only; shared atoms first; `data-section`/`sectionRefs` scroll-sync contract intact; i18n for any new string; both surfaces verified; before/after screenshots per section.
- Ask first: new dependency; a new shared `shared/ui` atom name that collides with existing API; any i18n *meaning* change of existing keys.
- Never: change what a setting does or its storage key; remove or re-order the 13 sections; touch `Navigation`/`NavItem` internals; hardcode non-token values; literal YouTube/Spotify pixel values.

## Success Criteria

- [ ] AC-1: All 13 `data-section` blocks render the new section anatomy in `SettingsTab` and `SettingsDialog`; zero sections retain the legacy card-box treatment.
- [ ] AC-2: Section anatomy is one implementation — every section's header/body goes through the same component/CSS recipe chosen in the design brief; Download/Sync no longer deviate with bespoke body wrappers.
- [ ] AC-3: One grouping/divider recipe replaces `downloadGroup`, `groupLabel`, and `divider`-flag dialects across sections.
- [ ] AC-4: Every settings row renders through the unified `SettingsRow` anatomy (name / optional description / control); no per-section bespoke row wrapper for the same job.
- [ ] AC-5: Per the design brief's stated rule, primary supporting text renders inline (new `settings.*` keys in en+vi) or the hint is retained; **floor check**: every row that today carries info only via ⓘ ends with either inline supporting text or the retained hint — zero rows lose information coverage.
- [ ] AC-6: `scripts/check-design-system-css.mjs` (or equivalent token lint) reports zero new non-token literals in every touched file; no hardcoded color/spacing/typography added.
- [ ] AC-7: Verified on real browser at three configurations — panel container <600px, panel desktop, standalone dialog container ≥768px sidebar — in both light and dark presets, with before/after screenshots per section group.
- [ ] AC-8: `npm run typecheck && npm run lint && npm run test:unit && npm run build` green; existing SettingsTab/SettingsDialogContent tests pass (updated only for intentional anatomy changes, each diff justified).
- [ ] AC-9: Subnav behavior parity: anchor click scrolls to section, scroll-sync updates active item + auto-centers, hide-on-scroll-down/show-on-up works, reduced-motion honored, `aria-current` intact.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass `check-design-brief.mjs` + token lint
- [ ] Real-browser before/after evidence per section group (pixel/paint evidence, not DOM rects alone)
- [ ] `docs/2-architechture-system.md` updated for changed files; `docs/0-wiki.md` changelog entry

## Open Questions / Accepted Risks

- The exact section grammar (cards kept but redesigned vs. flat grouped list à la Spotify) is decided at DESIGN — spec constrains consistency + token-backing, not the chosen recipe.
- How much hint text moves inline is a design-rule decision; the risk of over-densifying rows is accepted and resolved by the brief's stated rule.
- Aesthetic direction ships without user pre-approval (mode all) — conservative token-true choices; iterate post-ship if needed.
