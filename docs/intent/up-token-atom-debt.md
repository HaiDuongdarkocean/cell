# Intent: up-token-atom-debt — Token & atom SSOT cleanup on the Universal Panel surface

> Slug: `up-token-atom-debt` · Mode: all · Source: backlog row #29 (`docs/ideas/product-backlog.md:64`), findings F-6/F-20/F-21/F-22/F-24 in `docs/audits/20261006-universal-panel-ux-audit.md` (detailed per-finding evidence: `loop/universal-panel-ux/state/02-code-audit.md`, ephemeral)
> ui_surface: no          ← intent is zero visual change; any visual drift is a defect of the fix (one exception: restoring an already-broken timestamp size)
> confidence: high        ← every finding below re-verified against source; only noted lines drifted ±1

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Styles on this surface silently degrade and per-file truth forks: undefined `var(--*)` names resolve to fallback/inherit with zero build-time signal (one is a live visual bug today), the tab list is defined twice with already-diverging labels, literals duplicate existing tokens, and native controls bypass the shared atoms that carry the system's states/a11y | F-6/F-20/F-21/F-22/F-24, all line refs re-verified below | high |
| Change | Hand-maintained names, literals, duplicated registries, bespoke controls → canonical token names, one `tabs.ts` registry, shared atoms, shared Escape layer, shell-craft corrections | `UniversalPanel.tsx:52-59` vs `UniversalPanelBottomNav.tsx:29-36`; `FieldRow.tsx:148,264`; `CandidateView.tsx:253,383,530,606,708,791` | high |
| Solution | One mechanical SSOT pass over the named files — correct token names, swap literals for existing tokens, consolidate the registry, migrate native controls to `src/shared/ui` atoms, adopt `pushEscapeLayer`, and extend the existing undefined-token checker so it actually covers the touched feature dirs | atoms exist: `src/shared/ui/Textarea.tsx`, `Input.tsx`, `Button.tsx`; `src/shared/ui/escapeLayerStack.ts:36`; checker exists but must be modified: `scripts/check-design-system-css.mjs` | high |
| Value | Every future maintenance touch on this surface becomes single-site; the recurring undefined-token class (this is the third batch — `--font-size-xm`, `--Tihoka-*` before it) gains a guard; unblocks item 33 which lists this as a dependency | `product-backlog.md:68` (33 ← {28,29,30,31,32}); reconciliation note in `docs/audits/20261006-universal-panel-ux-audit.md` (prior `docs/audits/universal-panel-*-2026-09-05.md`) | high |
| Stakeholder | Maintainers/agents editing `universalPanel`, `cardCreator`, `dictionaryPopup`, `sessionRecap`, `studyModes`, `vocabulary`, `settings` surfaces — and downstream items 30/33 that diff against these files | file paths per evidence | high |
| Context | MV3 content-script shadow-DOM surface; zero-visual-change constraint; S cost; sibling items 28/30/31/32 touch the same files' other aspects → ownership/merge discipline required; FieldRow/CandidateView also mount inside the dictionary popup, so "the surface" spans both mounts | `UniversalPanel.tsx` mounts `CandidateView` path via dictionaryPanel; `cardCreator` embedded in dictionary right pane | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Single dev/agent | Mechanical diff; every atom and the checker already exist — no new dependency, no invention | high capability; constraint: `Textarea` has no auto-grow variant (`Textarea.tsx:10-17`, `resize` prop only) — FieldRow's `rows={lineCount}` growth (`FieldRow.tsx:141-153`) must be preserved, not flattened |
| Customer | Immersionist end users | Only contact point: `.when` timestamps currently render ~14px not the intended 12px; everything else is invisible | none — zero visual change is the contract |
| Supplier/Dependency | `src/shared/ui` atoms, `escapeLayerStack`, `check-design-system-css.mjs`, `tokens.json`/`tokens.css` | Atoms must accept the FieldRow/CandidateView usage patterns (autosize, tag-input keydown, IME) without API surgery | `check-design-system-css.mjs` already detects `undefined-token` but `shouldExclude` drops `/src/features/` (`:205-219`) — and it applies to path-args too (`:226,230-232`), so passing `src/features/universalPanel` exits **0 with "No matching files"** = silently green gate that checks nothing; the script needs a real change (relax the exclusion for explicit paths, scope the run to the `undefined-token` rule), not just wiring |
| Organization | Items 28/30/31/33 owners | Item 33 (visual convergence) diffs against these exact files; item 30 touches the same controls for hit-areas — landing order matters | backlog deps `product-backlog.md:65-68`; coordination, not code, is the cost |
| Regulator | none — no store policy, API, permission, or manifest surface touched | none — why: internal CSS/TSX refactor only | n/a |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Undefined `var(--*)` names must stop resolving silently — one (`--font-sizes-xs` at `RecapTab.module.css:54`, **no fallback**) is a live bug: `.when` timestamps inherit ~14px instead of 12px; the other sites survive only on fallbacks — literal `1px`/`600`/`120ms` or the defined-but-wrong `var(--color-error)`/`var(--color-success)` aliases | **R** (the timestamp is a real defect today) + S | verified: `StudyModesTab.module.css:100,105,121,134,191` (`--borderWidth-hairline`); `RecapTab.module.css:54,102` (`--font-sizes-xs`), `:103` (`--font-weights-semibold`), `:168` (`--motion-duration-fast`); `PlaylistTab.module.css:14,67,71,75` (`--error`/`--success`) | high |
| N2 | The tab list must have one source of truth — `TABS` is duplicated with diverging label keys (`panel.tab.vocabulary` vs `panel.tab.vocabularyShort`) and diverging icon-union typing; add/rename/reorder touches two files and drift is invisible at build time | S | `UniversalPanel.tsx:52-59` vs `UniversalPanelBottomNav.tsx:29-36` | high |
| N3 | Field/candidate controls must consume shared atoms instead of re-implementing them natively — and the public `Icon` barrel must be used | S | `FieldRow.tsx:148` `<textarea>`, `:264` `<input>`; `CandidateView.tsx:253,383,530` `<button>`, `:606,708,791` `<input>`; `VocabularyTab.tsx:14` imports `@/shared/icons/Icon` not `@/shared/ui/Icon` | high |
| N4 | Literals with byte-equivalent tokens must read the tokens; deprecated aliases on this surface converge to the canonical name | S | verified: dead `#e3e3e0` fallback inside `var(--color-border-subtle, #e3e3e0)` `PlaylistTab.module.css:10` (action = drop the redundant fallback, not a literal swap); `font-weight: 600` `StudyModesTab.module.css:153,188`; `border-radius: 50%` `src/shared/ui/NavItem.module.css:163`; `--radius-full` alias `VocabularyTab.module.css:122`, `SettingsDialog.module.css:171`, `RecapTab.module.css:101`; `0.04em` `VocabularyTab.module.css:66` (no byte-equivalent — stays literal, see Out) | high |
| N5 | Escape dismissal must go through the shared layer stack, not a hand-rolled `defaultPrevented` dance | S | `UniversalPanel.tsx:148-157` vs convention `pushEscapeLayer` (`src/shared/ui/escapeLayerStack.ts:36`) | high |
| N6 | Shell craft corrections: fake `role="presentation"` on a clickable wrapper, permanent `will-change`, a docstring describing geometry the CSS doesn't implement, and a render-phase `setVisitedTabs` | S | `UniversalPanel.tsx:187` (role), `UniversalPanel.module.css:18` (`will-change: transform, opacity`), `UniversalPanel.tsx:88-93` (docstring says "right-edge" while `.overlay` centers a 94% modal), `UniversalPanel.tsx:167-170` (setState in render) | high |
| N7 | The undefined-token class needs a regression guard on feature surfaces — the checker exists but is scoped to `src/shared/ui` only, which is exactly why batch #3 of this bug exists | S / +infra | `check-design-system-css.mjs:205-219` (`shouldExclude` drops `/src/features/`), `:217` (default glob); history: `--font-size-xm`, `--Tihoka-*` fixed in prior audits (`docs/audits/universal-panel-*-2026-09-05.md`, reconciliation in `docs/audits/20261006-universal-panel-ux-audit.md`) | high |

## Scope

- **In:**
  - F-6 token-name corrections in the touched surface files (names verified against `tokens.css`: `--border-width-hairline`, `--font-size-xs`, `--font-weight-semibold`, `--duration-fast`, `--color-error`, `--color-success`).
  - F-20: one registry module exporting `{key, icon, label, shortLabel}` consumed by both `CollapsibleSidebar` sections and `UniversalPanelBottomNav` — name it e.g. `panelTabs.ts` co-located in `universalPanel/` (`tabs.ts` collides with `src/shared/lib/chrome-apis/tabs.ts`).
  - F-21: FieldRow + CandidateView native→atom migration **preserving autosize (`rows={lineCount}`) and IME composition behavior**; `VocabularyTab.tsx` Icon import → public barrel.
  - F-22: literal→token swaps on the universal-panel surface files **where a byte-equivalent token exists**.
  - F-24: Escape→`pushEscapeLayer`; drop `role="presentation"`; `will-change` onto animation classes only; truthful docstring; `setVisitedTabs` moved out of render phase.
  - N7: modify `check-design-system-css.mjs` so an explicit path arg survives `shouldExclude` (`:205-236` — today it silently exits 0 on feature dirs), then wire a run at the touched feature dirs scoped to the `undefined-token` rule, so the typo class fails a check instead of aging into an audit finding.
- **Out:**
  - Hit-area/touch-target changes → item 30 (F-4, V-1, M-8/M-9).
  - Layout contract: scroll regions, gutters, `.tabPane` mounting patterns, surface remap → item 28 (F-1, F-3, F-5, F-9, F-10).
  - Menus, selected-state recipes, chips, dividers, empty-state convergence → item 33 (V-*, F-11, F-13, F-15, F-23, F-25).
  - Deleting `--radius-full` from `tokens.json` — ~180 usages in `src/` alone; alias removal is its own sweep.
  - Literals with **no** byte-equivalent token: `94%` modal size (`UniversalPanel.module.css:12-13`), `0.04em` tracking (`--tracking-wide` is 0.03em, `tokens.css:38`), `ease-in-out` keywords (`NavItem.module.css:28-31,147` — `--ease-in-out` resolves to `cubic-bezier(0.4,0,0.2,1)` while the CSS keyword is `cubic-bezier(0.42,0,0.58,1)`: a real curve delta, not a cleanup) — inventing tokens or accepting motion deltas is DESIGN work; these stay literal (SPECIFY may name a local custom property if it costs one line, but no token additions).
- **Non-goals:**
  - Any visual change — pixel-level parity is the success bar; the only accepted delta is `.when` returning to its designed 12px.
  - New shared abstractions beyond the single `tabs.ts` module; no `Textarea` redesign — autosize is preserved, not re-architected.
  - Repo-wide literal/typo sweep beyond the named surface files (other entrypoints keep their `--radius-full` etc.).

## Workflow

Analysis end-to-end: the audit produced five deduplicated findings (F-6/F-20/F-21/F-22/F-24) with file:line evidence; ANALYZE re-verified each ref against source (all confirmed; only minor line drift). Next: SPECIFY derives the system spec (exact swap table, `tabs.ts` shape, atom-mapping per control, guard wiring); `ui_surface: no` → skips DESIGN → DELIVER implements the mechanical diff and verifies via `typecheck + test:unit + build`, a re-run of the audit §7 grep commands on the touched files, and a real-Chromium pass on the two behavior-risk spots (card-creator field autosize, IME typing, Escape-inside-menu ordering). Person↔system contact is zero; this is maintainer↔codebase work end to end.

## Journey

### AS-IS
1. A maintainer renames or adds a Universal Panel tab: they edit `TABS` in `UniversalPanel.tsx:52-59`, then must remember the second copy in `UniversalPanelBottomNav.tsx:29-36` — the two lists already diverge (full vs `…Short` label keys, different icon typing), and nothing fails if an entry is missed.
2. A maintainer writes `var(--borderWidth-hairline)` or `var(--font-sizes-xs)`; the build stays green, the name silently resolves to fallback/inherit; weeks later an audit discovers `.when` timestamps render ~14px instead of the designed 12px — the checker that would have caught it (`check-design-system-css.mjs`) deliberately skips every file under `/src/features/`.
3. A maintainer extends the card creator and copies the native `<textarea>`/`<input>` pattern in `FieldRow.tsx`; the control drifts from the `Textarea`/`Input` atoms' error/disabled/token styling, and the auto-grow behavior lives only in that file's bespoke `rows={lineCount}`.
4. A maintainer wires Escape into a new overlay inside the panel and must rediscover the `defaultPrevented` dance in `handleKeyDown` (`UniversalPanel.tsx:148-157`) instead of the repo's `pushEscapeLayer` convention — ordering vs nested menus is re-reasoned by hand each time.

### TO-BE
1. The maintainer edits one `tabs.ts` entry `{key, icon, label, shortLabel}`; both the sidebar rail and the bottom nav render from it — a tab rename/add/reorder is single-site and type-checked.
2. Every `var(--*)` on the surface names a defined token; the undefined-token check runs over the touched feature dirs in a gate, so a new typo fails the check the day it is written, not at the next quarterly audit; `.when` is back at `--font-size-xs` (12px).
3. Field and candidate controls are shared atoms; autosize rides an explicit variant/prop and IME composition follows the atom's tested path — the same components serve both the universal-panel mount and the dictionary-popup mount.
4. Escape goes through `pushEscapeLayer`, which orders nested overlays correctly (inner menu/sheet closes first); the backdrop carries no fake role, `will-change` exists only during animation, the docstring describes the real centered modal, and `visitedTabs` updates in an effect. Net visual diff: zero — the promised value is that all of the above is now boring.

## Stories

- S1: As a maintainer, I want one canonical tab registry so that adding/renaming/reordering a panel tab is a single-site edit — done when one module exports tab metadata and both `UniversalPanel` and `UniversalPanelBottomNav` consume it, with all current labels (full + short) still resolving.
- S2: As a maintainer, I want undefined token references to fail loudly so that style typos can't ship silently — done when no `var(--*)` in the touched files references an undefined token and a check covering the feature dirs reports clean.
- S3: As a maintainer, I want card-creator and dictionary-pane controls built from shared atoms so that state styling, a11y, and future token changes apply uniformly — done when no native `<button>`/`<input>`/`<textarea>` remains in `FieldRow.tsx`/`CandidateView.tsx` and autosize + IME behave identically on real Chromium.
- S4: As a maintainer, I want dismissal and shell craft to follow repo conventions so that overlay ordering is inherited, not hand-rolled — done when Escape uses `pushEscapeLayer`, nested overlays still close inner-first, and the fake role/permanent `will-change`/lying docstring/render-phase setState are gone.
- S5: As a user viewing session recap, I want timestamps at the designed size — done when `.when` resolves `--font-size-xs` (12px).

## Risks

| Risk | Type (human/operational/internal/external/legal/hidden) | Impact | Team's ability to respond |
|---|---|---|---|
| FieldRow/CandidateView atom swap regresses behavior: shared `Textarea` has no auto-grow variant (`Textarea.tsx:10-17`) and FieldRow's `rows={lineCount}` growth + tag-input keydown + IME composition are bespoke | internal | Card-creator typing broken in **both** mounts (universal panel + dictionary popup) — hidden blast radius | preserve `rows`-derived growth via prop/variant rather than flattening; verify `compositionstart/end` + autosize on real Chromium in both mounts; smallest-diff mapping per control |
| Escape ordering: `pushEscapeLayer` must keep menu/sheet-inside-panel Escape closing the inner layer, not the panel | internal | Panel closes on menu Escape = UX regression | verify tools-sheet + any nested menu Escape on real Chromium; stack order is the convention's contract |
| "Equivalent token" that isn't byte-equal: `0.04em` tracking vs `--tracking-wide` = 0.03em (`tokens.css:38`) — a mechanical swap would drift the visual | internal | Subtle typography drift violates the zero-visual-change contract | conservative rule: swap only byte-equivalent values; literals with no exact token stay literal — accepted risk recorded |
| `--radius-full` sweep scope creep — alias has ~180 usages in `src/` | operational | Unbounded diff | surface files only; token stays defined; alias removal is a separate backlog decision |
| Parallel-file contention: items 28/30/31 touch the same files' other aspects (layout, hit-areas, mobile chrome) | operational | Merge noise / re-verify churn | land order per backlog deps; this item is prerequisite-free and S-size — land early |
| Zero-visual-change verification gap: DOM rect/computed checks can't prove no paint drift | hidden | Latent visual defect shipped as "cleanup" | before/after capture on the touched surfaces per AGENTS; only accepted delta is `.when` 14px→12px |

## Decision

go — S-cost mechanical cleanup with one real user-facing bug already live (`.when` timestamp size), all atoms and the guard already exist (nothing new to build or depend on), and item 33 lists this as a dependency; the only genuine risks are the two known atom-swap sites, which carry an explicit verification plan.

## Draft Acceptance Criteria

Need-level ACs (system ACs are derived in SPECIFY → `## Success Criteria`).

- [ ] No `var(--*)` in the touched files references an undefined token; `.when` resolves `--font-size-xs` (12px); the undefined-token check runs clean over the touched feature dirs.
- [ ] One tab registry module exists; `UniversalPanel` sidebar and `UniversalPanelBottomNav` both consume it; every current label (full and `…Short` keys) still resolves.
- [ ] No native `<button>`/`<input>`/`<textarea>` remains in `FieldRow.tsx`/`CandidateView.tsx`; `Icon` in `VocabularyTab.tsx` imports via the public `@/shared/ui` barrel; field autosize and IME composition verified unchanged on real Chromium in both mounts.
- [ ] Every listed literal with a byte-equivalent token reads the token; literals without a byte-equivalent (`94%`, `0.04em`, `ease-in-out`) remain literal; `--radius-full` usages on this surface converge to `--radius-pill` with the token itself left defined.
- [ ] Escape is handled via `pushEscapeLayer`; a nested overlay's Escape still closes the inner layer only; backdrop has no `role="presentation"`; `will-change` applies during animation only; docstring matches actual geometry; no render-phase `setVisitedTabs`.
- [ ] Before/after visual capture shows zero drift across the touched surfaces except the intended `.when` size fix.
- [ ] `npm run typecheck && npm run test:unit && npm run build` green.
