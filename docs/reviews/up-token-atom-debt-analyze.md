# Analyze-Gate Review — `docs/intent/up-token-atom-debt.md`

**Mode:** `all` · **Reviewer:** fresh-context adversarial audit (did not author the doc)

## 1. Evidence spot-checks (~20 citations)

All held except interpretation-level defects D1–D2. Verified exact: `RecapTab.module.css:54` (`--font-sizes-xs` no-fallback → `.when` ~14px — live bug); `StudyModesTab.module.css:100,105,121,134,191` (`--borderWidth-hairline` ×5); `PlaylistTab.module.css:14,67,71,75` (`--error`/`--success` undefined); `UniversalPanel.tsx:52-59` vs `UniversalPanelBottomNav.tsx:29-36` (duplicate TABS, diverging label keys); `UniversalPanel.tsx:148-157,187,167-170,88-93` (Escape dance, fake role, render-phase setState, lying docstring); `UniversalPanel.module.css:18` permanent `will-change`; `FieldRow.tsx:148,264`; `CandidateView.tsx:253,383,530,606,708,791`; `VocabularyTab.tsx:14` wrong Icon barrel; `Textarea.tsx:10-17` no auto-grow; `escapeLayerStack.ts:36` `pushEscapeLayer`; `tokens.css:38` `--tracking-wide`=0.03em; canonical names all defined.

## 2. Defects found (all applied — see `## Applied fixes`)

- **D1 (material):** checker claim understated — `shouldExclude` applies to path-args too (`:226,230-232`); passing `src/features/universalPanel` exits 0 "No matching files" = silently green gate. The script must be *modified*, not just wired; run should be scoped to the `undefined-token` rule.
- **D2 (material):** `ease-in-out` is not byte-equivalent — `--ease-in-out` = `cubic-bezier(0.4,0,0.2,1)` vs keyword `cubic-bezier(0.42,0,0.58,1)`; swapping changes the motion curve → moved to the stays-literal bucket.
- **D3 (minor):** `#e3e3e0` at `PlaylistTab.module.css:10` is a dead `var(--color-border-subtle, #e3e3e0)` fallback — action is dropping the fallback, not a literal→token swap.
- **D4 (minor):** `02-code-audit.md` citations re-anchored to durable docs (`docs/audits/20261006-universal-panel-ux-audit.md`, `universal-panel-*-2026-09-05.md`) — `loop/` is ephemeral.
- **D5 (minor):** drifts corrected — `94%` at `:12-13` (not `:11-12`), `FieldRow.tsx:141-153` (not `:140-152`), backlog refs `:65-68`, `--radius-full` 177→~180 in `src/`, "six surface files" → "touched surface files", N1 fallback wording broadened (`var(--color-error)` alias isn't a literal), AC stays-literal list += `ease-in-out`.

## 3. Structural checks

- **Journey:** AS-IS 4 steps / TO-BE 4 steps, narratives ✓; TO-BE lands the promised value.
- **Decision:** `go` supported — live `.when` defect + bounded risk register with verification plans.
- **Scope fencing:** explicit Out mapping to items 28/30/32/33; `--radius-full` deletion correctly excluded (180+ uses); non-byte-equivalent literals excluded (after D2 fix, consistently).
- **`ui_surface: no`:** justified — maintainer↔codebase work; the sole user-visible delta restores an already-designed value.
- **Stories:** business-level with done-when ✓. **Risks:** realistic (dual-mount blast radius, Escape ordering, paint-verification gap).
- **Template completeness:** all required sections; Regulator row answers "none — why" ✓.
- Forward note (not a defect): proposed registry must not be named `tabs.ts` (collides with `src/shared/lib/chrome-apis/tabs.ts`) — recorded in doc as `panelTabs.ts`.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. Solution row + Scope-In N7 + Supplier row: corrected to "modify `check-design-system-css.mjs` (explicit path arg currently dropped by `shouldExclude` → silently green), then wire a run scoped to `undefined-token` at the touched feature dirs".
2. `ease-in-out` literals removed from N4 swap list → moved to the no-byte-equivalent "stays literal" bucket with the curve-delta explanation; AC updated.
3. `#e3e3e0` reworded as a redundant `var()` fallback to drop.
4. `02-code-audit.md` evidence refs re-anchored to durable audit docs; `loop/` marked ephemeral.
5. Line/count drifts fixed (`:12-13`, `:141-153`, `:65-68`, 177→~180 in `src/`, "six"→"touched"); N1 fallback wording corrected.
