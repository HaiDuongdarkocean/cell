# Spec Review — settings-tab-redesign

Verified cited references against repo: `SettingsTab.tsx:50-61` (focus-into effect — at `src/features/universalPanel/tabs/SettingsTab.tsx:50-61` ✓), `:75-80` `navMode="horizontal"` ✓, `SettingsDialogContent.tsx:56` `SIDEBAR_LABEL_MIN_WIDTH=768` ✓, `:197-211` 13 sidebarItems ✓, `:619-625` `data-section="download"` + `downloadCardBody` ✓, `:813` sync ✓, `SettingsDialog.module.css:30-59` `sectionCard`/`cardHeader`/`cardBody` ✓, `HintIcon.tsx:136` onClick popover ✓, `scripts/check-design-system-css.mjs` + `check-design-brief.mjs` exist ✓, `SettingsRow` atom exists in `shared/ui` ✓.

**Blockers:** none.

**Major:** none.

**Minor:**

1. [REQ-7 / NFR-2] [PO/BA]: Intent N6 + draft AC enumerate "Escape handling" and (stakeholder table) "must not shrink hit targets (`up-a11y-hit-targets`)". Spec drops both — REQ-7 lists focus-into but not Escape; no NFR preserves current hit-target minimums. For a markup/CSS restyle, row density shrink is a real regression risk. Fix: add "no reduction of existing hit-target sizes; Escape/dialog dismissal unchanged" to REQ-7 Rules or NFR-2.
2. [AC-5 / REQ-3] [PO]: The inline-vs-ⓘ rule is fully deferred to the design brief, so AC-5 is testable only after brief lands. Acceptable per spec→design split, but the AC should pin a minimum bound now (e.g., "every row that today has only ⓘ as primary info gets either inline text or retains the hint" — already half-said in Rules; make it an explicit AC line so QA doesn't need the brief to check the floor).
3. [Traceability table] [BA]: AS-IS steps mapped to REQs is unusual direction (AS-IS describes problems, not requirements) — harmless, but REQ coverage of N6/N7 is thinner than it looks: REQ-6 alt flow "none" + REQ-7 "none new" rely on "parity" wording rather than enumerated behaviors. Fix: fold the intent's behavior list (scroll-sync, anchor jump, focus-into, Escape, reduced-motion, aria, i18n keys) into REQ-6/REQ-7 rules so parity is checkable without re-reading intent.
4. [REQ-7 Rules] [PO]: "`data-cell-id` hooks preserved **where feasible**" is fuzzy — either commit to preserving all existing `data-cell-id` values (they're all on controls, not anatomy, so zero cost) or name which ones may change. Fix: tighten to "preserved; any change is a spec-visible exception".
5. [NFR-4] [PO]: "panel-mobile (<600)" is stated but `<600` px of what — the container (`container-type: inline-size` on `popoverBody`) vs viewport matters since `mainCol` uses container queries. Fix: say "container width" explicitly.
6. [Objective/Boundaries] [BA]: "shared atoms only where a repeating pattern demands promotion" + NFR-5 "≥2 sections" is consistent — good. No leak vs `up-settings-subnav` (REQ-6 pins labels-visible + internals untouched) or `up-visual-system-convergence` (spec takes recipe as input, redesigns grammar on top). No finding, noting as confirmed-clean check.

**Nhận xét theo role:**
- BA: Problem-framed via intent, scope tightly fenced against shipped predecessors, both traceability directions complete — only enumerated-behavior carryover (Escape, hit targets) is missing.
- PO: ACs are mostly verifiable for markup/CSS-only work (counts, lint, parity, screenshots at named breakpoints); residual softness is "where feasible" and brief-dependent AC-5 floor.
- TL: Boundary clean (actor external-only, system flow contains no human behavior), data section correctly declares no schema change, failure modes appropriately framed as regression-parity for a restyle; alternatives legibly deferred to DESIGN with a stated constraint (token-backed, consistent) — acceptable.

**Action items:**
1. Add Escape-handling + hit-target preservation clauses to REQ-7 Rules / NFR-2 — spec author — REQ-7, NFR table.
2. State the AC-5 floor (no primary-info row loses visible-or-hint coverage) — spec author — Success Criteria.
3. Replace "where feasible" with a firm `data-cell-id` preservation rule — spec author — REQ-7.
4. Clarify `<600`/`≥768` as container width — spec author — NFR-4.

**Risks chấp nhận:**
- Section grammar + inline-text rule deferred to DESIGN — revisit if `check-design-brief.mjs` gate or mockup review shows the brief exceeding spec constraints.
- Aesthetic direction unreviewed pre-ship (mode `all`) — already an accepted risk in intent.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

Applied to `docs/specs/settings-tab-redesign.md` after review:

- Item 1: REQ-7 Rules + NFR-2 now enumerate Escape/dismissal preservation and no reduction of existing hit-target sizes.
- Item 2: AC-5 gained an explicit floor — every row that carried info only via ⓘ ends with inline supporting text or a retained hint; zero coverage loss.
- Item 3: REQ-7 Rules changed from "where feasible" to firm `data-cell-id` preservation (any exception named in verify report).
- Item 4: NFR-4 + AC-7 now state breakpoints are container widths (`popoverBody` is `container-type: inline-size`).
