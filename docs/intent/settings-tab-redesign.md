# Intent: Settings Tab Surface Redesign (YouTube/Spotify-inspired)

> Slug: `settings-tab-redesign` · Mode: all · Source: user statement — "cải thiện giao diện trong tab settings của universal panel, tổng quan section tới atom nhỏ nhất — shape, spacing, color, typography, layout hierarchy; đẹp lấy cảm hứng từ YouTube và Spotify"
> ui_surface: yes
> confidence: medium

## Business Case

BACCM inference — every Tihoka cites evidence (`file:line`) or `[assumption]` + confidence.

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | The settings surface presents 13 sections as a stack of near-identical heavy cards — 11 of 13 share one `cardHeader`/`cardBody` chrome while Download and Sync deviate with their own — rows are dense label+control pairs where supporting text is rare and the tap-activated ⓘ popover carries the explanation load, so the page reads as uniform boxes rather than a scannable hierarchy. Users who know consumer settings surfaces (YouTube, Spotify — flat grouped lists, clear section titles, generous row rhythm, label+description+control anatomy) face a harder scan than the product's own quality bar implies. | `SettingsDialogContent.tsx:250-820` (13 `Card` blocks; 11 share `cardHeader`/`cardBody`, Download uses `downloadCardBody` :625, Sync has no `cardBody` :815-820), `SettingsDialog.module.css:30-59` (`sectionCard` chrome), `SettingsDialogContent.tsx:284-300,380-435` (rows = `rowLabel` + `HintIcon` + `Toggle`, no description text), `HintIcon.tsx:136` (click/tap popover — no hover path), user statement | high — code-verified; user-stated direction |
| Change | Settings goes from "13 equal cards, dense rows" to a designed settings page — hierarchy expressed through section titling, grouping, row anatomy (name / supporting description / right-aligned control), consistent spacing rhythm and dividers — converged onto design-system tokens, with the calm flat-list reading YouTube/Spotify users already know. | user statement ("section → atom", "shape, spacing, color, typography, layout hierarchy"); `SettingsDialog.module.css:38-59` current anatomy to be replaced/reshaped | medium — exact shape is DESIGN's job |
| Solution | A section-driven redesign executed inside the existing design system: every proposal maps to tokens/shared atoms (`SettingsRow`, `Card`, `Text`, `Heading`, `Toggle`, `Select`, `Menu`) or promotes one new shared atom where a real gap exists; YouTube/Spotify provide *reference grammar* (flat groups, hairline dividers, description-under-label, right-edge controls, strong section headers), not literal copying. | AGENTS.md SSOT/Menu/shared-ui rules; `up-visual-system-convergence` (shipped) already fixed recipe chaos — this item inherits one grammar | medium |
| Value | The surface users open to trust the product (settings = the "serious" surface) matches the polish of the playback/dictionary surfaces; scan cost drops for the 5–80 persona; the last visibly-generic surface in the universal panel gets productized. | AGENTS.md persona + polish mandate; user explicitly asked for "đẹp" consumer-grade outcome | medium — aesthetic value is user-stated, no external research |
| Stakeholder | Primary: extension end users on all viewports, both surfaces (`SettingsTab` horizontal nav, standalone `SettingsDialog` vertical sidebar). Secondary: maintainers — row/section anatomy becomes shared atoms, not per-section CSS. | `SettingsTab.tsx:75-80` (`navMode="horizontal"` forced), `SettingsDialog.tsx`, `mountSettingsDialog.ts` | high |
| Context | Two shipped predecessor items bound this work: `up-settings-subnav` (labeled subnav — shipped) and `up-visual-system-convergence` (one selected recipe, token typography, dividers, EmptyState — shipped, and whose non-goal was "designing new visual language"). This item's novelty sits exactly in that former non-goal: a deliberate settings-specific layout redesign. Content/logic of settings (what controls do, storage, i18n keys) is untouched. | `docs/intent/up-settings-subnav.md`, `docs/intent/up-visual-system-convergence.md` non-goals section | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers (this project) | Deliver a wide but low-risk restyle: 13 sections, mostly markup/CSS re-shape; every change maps to tokens or shared atoms; evidence via before/after screenshots per section | All ingredients exist (`SettingsRow`, `Card`, `Text`, `Heading`, `Toggle`, `Select`, tokens); no new deps |
| Customer | Persona 5–80, desktop + tablet + phone, both light/dark themes | Scan a section list, recognize groups, read a setting's name+purpose, and operate controls predictably; readability ≥ current | Rows must stay touch-operable; hint affordance must not regress (V-15 fix shipped) |
| Supplier/Dependency | Chrome MV3 + shadow-DOM mount | None new — pure DOM/CSS inside existing mounts | Shadow-DOM stylesheet scope rules unchanged |
| Organization | Future contributors; owners of shipped convergence items | One canonical settings-row/section anatomy in `shared/ui` (or feature-level CSS where truly local) — not 13 bespoke treatments | AGENTS.md: exemplar patterns belong to `shared/ui` |
| Regulator | Chrome Web Store policy, WCAG | None specific — must not regress contrast, focus-visible, aria semantics, reduced-motion | `up-a11y-hit-targets` owns hit-target minimums separately — this item must not shrink current targets |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Every one of the 13 settings sections is redesigned — not a subset: General, Language Profile, Resources, Media, Subtitle Block, Dictionary Popup, Word Badge, Audio, Local Player, Download, Shortcuts, Theme, Sync. | F / U | user statement "chỉnh sửa hết tất cả sections"; `SettingsDialogContent.tsx:197-211` (sidebarItems = 13) | high |
| N2 | Section-level hierarchy is legible: the user can tell a section boundary, its title, and its purpose faster than today — whether via grouping, titling, or divider grammar chosen in DESIGN. | U | `SettingsDialog.module.css:30-59` (uniform card chrome = weak boundary semantics today); user statement "layout hierarchy" | high |
| N3 | Every setting row is self-explanatory at a glance — the user can tell what a setting is *for* without triggering its ⓘ popover for primary information; supporting text is readable inline where it matters, and controls sit at a consistent place row to row. | U | `SettingsDialogContent.tsx:284-300,380-435` (label+HintIcon+Toggle pattern repeated, no description slot); `HintIcon.tsx:136` (hints are click/tap-activated popovers — an extra interaction for primary info); user statement "atom nhỏ nhất" | medium |
| N4 | The visual treatment reads as a designed consumer surface — spacing rhythm, radius, color, typography internally consistent and at YouTube/Spotify calmness level — while remaining 100% token-backed (no literal foreign values, no hardcode). | U / S | user statement; AGENTS.md token/no-hardcode rules; `up-token-atom-debt` (shipped) already tokenized the shell CSS — residual literals sit in embedded panels (`WordBadgeSettingsPanel.tsx:42-44`, `LanguageProfilePanel.module.css:171-182`) and get swept where touched | medium |
| N5 | Works identically in both consuming surfaces and all viewports: universal-panel tab (forced horizontal subnav) and standalone `SettingsDialog` (vertical sidebar ≥768px); light and dark presets. | R / U | `SettingsTab.tsx:79`, `SettingsDialogContent.tsx:56` (`SIDEBAR_LABEL_MIN_WIDTH=768`), `SettingsDialog.tsx` | high |
| N6 | Zero behavior regression: every control keeps its current function, storage keys, i18n keys, aria semantics, focus order, scroll-sync, and reduced-motion handling. | R | current behaviors: `Navigation.tsx` scroll-sync, `SettingsTab.tsx:50-61` focus-into, `observeScrollDirection` hide/show | high |
| N7 | Sub-navigation itself stays as shipped (`up-settings-subnav` — labeled items + overflow); this item may polish its visual integration (spacing/sticky behavior) but not revert the labeling contract. | S | `up-settings-subnav` intent/spec shipped 2026-10-06 | medium |

## Scope

- **In:** The settings surface rendered by `SettingsDialogContent` in both consumers — `SettingsTab` (universal panel) and `SettingsDialog` (standalone). All 13 section cards and their embedded panels (`LanguageProfilePanel`, `ResourcesPanel` + integrated `Dictionary`, `DictionaryPopupSettingsPanel` — which itself nests `DictLinksManager`, `WordBadgeSettingsPanel`, `AudioPanel`, `SyncPanel`, `AnkiStatusSyncPanel`, `ThemePanel`) — section anatomy, row anatomy, spacing/typography/color/shape at token level, group/divider grammar, scroll-region polish. Shared atoms may be extended (e.g., a `SettingsRow` description slot or a `SettingsSection` molecule) when a pattern repeats — per AGENTS.md shared-ui rule.
- **Out:** What settings exist and what controls do; storage schema; i18n keys' *meaning* (wording changes only where a description slot is added); other universal-panel tabs; dictionary popup surfaces; the subnav's labeling contract (shipped); hit-target minimums owned by `up-a11y-hit-targets`.
- **Non-goals:** Literal copying of YouTube/Spotify pixel values or assets; new settings; removing settings; redesigning the design-token system itself (new tokens only if a real gap → one token + note per AGENTS.md); converting the subnav into a different component; any backend/messaging change.

## Workflow

Narrative: an end user opens the universal panel over a video page (or the standalone settings dialog) and switches to Settings. The system presents a labeled sub-navigation and a scrollable column of settings sections. The user scans the column: section titles announce boundaries, each row reads as name + short description + a control parked at a predictable edge. The user jumps to "Download" via the subnav, scans grouped rows (concurrency, format/quality, conversion, filename), and edits a control; the change persists exactly as today. On a narrow container or phone the same hierarchy collapses without losing the row anatomy. Start: user opens Settings. End: user finds, understands, and changes a setting on first scan — and the surface reads like a product, not a settings dump. Person↔device only; system↔system only at storage persistence (unchanged).

## Journey

### AS-IS

1. User opens Settings in the universal panel: a labeled subnav (shipped `up-settings-subnav`) sits above a column of 13 visually identical cards — every section an equal-weight box with `cardEnter` animation (`SettingsDialog.module.css:30-36`), so section importance and grouping read flat.
2. Inside a card, rows are dense `label + ⓘ + control` triplets (`SettingsDialogContent.tsx:284-300`); supporting text lives inside a tap-to-open popover on the hint icon — an extra interaction just to learn what "Auto load ASR" means (`SettingsDialogContent.tsx:437-451`, `HintIcon.tsx:136`), and descriptions exist only at card level.
3. Scanning Download reveals a second dialect: `downloadGroup` mini-headings + stacked selects + a left-border child field (`SettingsDialog.module.css:93-112`) — different grouping grammar from Shortcut's `groupLabel` + `VStack columns={2}` grid (`SettingsDialogContent.tsx:643,750`) and from Toggle cards' `divider` rows — three ways to say "sub-group".
4. Long-page scanning: 13 cards × uniform chrome means position memory, not typography, carries navigation; on mobile the same density applies inside a constrained sheet.
5. Edge case: sections that embed whole sub-features (Resources → `ResourcesPanel` + integrated `Dictionary`; Audio → `AudioPanel`) render nested surfaces inside the card chrome, compounding box-in-box visuals (`SettingsDialogContent.tsx:320-367,553-571`).

### TO-BE

1. User opens Settings and sees a designed page: section boundaries announced by a consistent section-header grammar (title + optional description) and divider/group rhythm — not 13 identical boxes — in a style grammar comparable to consumer settings surfaces (N1, N2).
2. Inside a section, every row follows one anatomy: setting name, optional supporting description beneath it, control aligned to a predictable edge; explanations that matter are visible text, not hover-only hints (N3).
3. Sub-grouping speaks one language everywhere — Download, Shortcuts, and toggle cards share the same group-label/divider recipe (N2, N4).
4. Embedded panels (Resources/Audio/Sync/Theme) sit inside the section surface without box-in-box doubling — the section chrome and the panel chrome resolve to one boundary (N4).
5. On any viewport and either theme, the same hierarchy holds — flat, readable, token-backed — and every control behaves identically to today (N5, N6): the promised value lands when a first-time user can scan, understand, and change any of the 13 sections' settings without learning the layout.

## Stories

Business-level only — "I want X so that Y, done when Z." Story ≠ task.

- S1: As a settings user, I want each section to announce itself clearly so that I can scan 13 sections without reading every title — done when section boundaries follow one visible grammar at every viewport.
- S2: As a first-time user, I want to understand what a setting does without hovering or tapping a hint icon — done when rows carry their supporting text visibly where the info is primary.
- S3: As a returning user, I want controls where I expect them so that I operate settings by muscle memory — done when all rows share one name/description/control anatomy and alignment.
- S4: As a user on phone or the standalone dialog, I want the same hierarchy so that the experience doesn't degrade with the container — done when the redesign holds in both consuming surfaces at all breakpoints.
- S5: As a maintainer, I want the anatomy expressed through shared atoms/tokens so that the next settings row can't drift — done when no per-section CSS re-implements the row or section recipe.

## Risks

| Risk | Type (human/operational/internal/external/legal/hidden) | Impact | Team's ability to respond |
|---|---|---|---|
| 13 sections + embedded panels = wide visual surface; a shared-atom change (`SettingsRow`, `Card`, `Navigation`) bleeds into other features | internal | High blast radius if atoms edited carelessly | High — grep consumers per atom before touching; prefer additive props/slots; per-section screenshots as evidence |
| "YouTube/Spotify-inspired" read literally → foreign spacing/color values hardcoded, breaking token SSOT | human/design | Medium | High — DESIGN enforces token mapping (brief-lint gate exists: `check-design-brief.mjs`); inspiration = grammar, not values |
| Embedded feature panels (Resources/Audio/Sync/Theme/DictLinks) have their own internal design languages — flattening section chrome may clash with their cards | hidden | Medium | Medium — DESIGN audits each embedded panel; worst case keeps inner surfaces and reshapes outer chrome only |
| Subnav scroll-sync + hide-on-scroll interplay: flatter sections change scroll offsets/heights | operational | Low–Medium | High — `Navigation` internals untouched; verify scroll-sync AC on both surfaces |
| Removing card chrome may reduce section-boundary salience if the new grammar is too subtle (the very problem inverted) | human/design | Medium | High — DESIGN stage produces mockup + vision-reader check on the real render |
| Mode `all` = no user approval gate; aesthetic direction lands unreviewed by the stakeholder who asked for "đẹp" | process | Medium | Accepted risk — conservative direction (token-true, minimal novelty) + user can iterate post-ship |
| Both surfaces share `SettingsDialogContent`; a panel-optimized redesign can regress the standalone dialog | hidden | Medium | High — N5 AC forces both-surface verification |

## Decision

go — user-requested redesign of a primary surface with clear direction (section→atom, YouTube/Spotify-inspired, all sections), predecessor debt items already shipped (clean base to restyle), all work is markup/CSS inside one feature boundary, and risk is contained by token-only rules + per-section screenshot evidence. Accepted risks: aesthetic direction unreviewed by user pre-ship (mode all contract); embedded-panel clashes resolved at DESIGN.

## Draft Acceptance Criteria

Need-level ACs (system ACs are derived in SPECIFY → `## Success Criteria`).

- [ ] All 13 settings sections render the redesigned anatomy in both consuming surfaces (`SettingsTab`, `SettingsDialog`) at mobile/desktop breakpoints, light + dark.
- [ ] One row anatomy (name / optional description / control) and one section grammar (header / group / divider) apply consistently; no per-section bespoke reimplementation of the same recipe.
- [ ] Every spacing/radius/color/typography value resolves to a design token; no new hardcoded literals introduced (existing literals in touched files swept per `up-token-atom-debt` where touched).
- [ ] Information previously available only inside tap-opened hint popovers is either visible as supporting description or retained as hint — per a stated DESIGN rule; nothing informational is lost.
- [ ] All existing behavior preserved: settings save/load, subnav scroll-sync + anchor jump, focus-into, Escape handling, reduced-motion, aria semantics, i18n keys.
- [ ] Before/after screenshot evidence per section group on the real browser build; vision/a11y checks (contrast, focus-visible) green.
