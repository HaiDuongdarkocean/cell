# Design System Changelog — Cell Extension

> **Format**: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)
> **Versioning**: Semantic Versioning — DS version independent from extension `package.json` version. See [governance.md](governance.md) §12.3.
> **Governance**: See [governance.md](governance.md) §12 (ownership, contribution, versioning, deprecation).

---

## [1.2.0] — 2026-07-08

### Changed
- **Split `design-system.md` (749 lines) → nested folder structure (DSDS-style)**. Single file replaced by 7 layer folders/files + README + references:
  - `README.md` — entry + mục lục + DS version + quick start + score card
  - `principles/README.md` — §8 (17 principles, 3 categories)
  - `tokens/` — README + color.md + typography.md + spacing.md + shape-elevation-motion.md (§1 + §11 theme runtime)
  - `components/` — README + popup-react.md + popup-media.md + content-script-factories.md + controllers.md (§2 + §2.5 usage guide)
  - `patterns/` — README + interaction.md + settings.md (§3 + §9)
  - `guidelines/` — README + development.md + accessibility.md + content.md + layout.md + visual.md (§7 + §7.1 examples + §7.2 conflict resolution + §4 a11y conventions)
  - `runtime.md` — §5 runtime contexts + §6 cross-runtime sync
  - `governance.md` — §12 ownership/contribution/versioning/deprecation + Update Protocol
  - `references.md` — §10 YouTube/M3 comparisons + 27 research sources + ADR links + specs
- **Deleted `design-system.md`** — content preserved across layer files, no loss.
- **Updated cross-refs**: `AGENTS.md` line 170 + `.agents/skills/software-production-workflow/SKILL.md` line 70-72 → trỏ tới `docs/design-system/README.md`. Deprecated/historical docs (skills-deprecated, docs/task/plan/specs/intent/mockups) giữ nguyên — frozen records.

### Notes
- **Minor bump** (backward-compatible — content preserved, only structure changed).
- DS score unchanged: 55.5/60 (93%) — split là structural, không thêm/fill content.
- 17 files reference old `design-system/design-system.md` path — 2 active updated, 15 deprecated/historical kept as frozen records.

---

## [1.1.0] — 2026-07-08

### Added
- **§2.5 Usage guide** in `design-system.md` — do/don't + code examples per component group (IconButton, MultiSelect, SettingsDialog, media cards, content-script DOM factories) + atomic design composition mapping (atoms/molecules/organisms/templates/pages → Cell equivalents). Fills Layer 3 gaps 3.8 (do/don't) + 3.9 (code examples).
- **§2.5.6 Composition rules** — explicit atomic design hierarchy mapping with Cell-specific examples + composition rules per level.
- **§7.1 Guideline examples** in `design-system.md` — concrete do/don't example per guideline, grouped by category (development/accessibility/content/layout/visual). Fills Layer 5 gap 5.6 (examples per guideline).
- **§7.2 Conflict resolution** in `design-system.md` — resolution priority (must > should, a11y > visual, specific > general, ADR > all) + 6 common conflicts with resolutions + escalation path to ADR. Fills Layer 5 gap 5.8 (conflict resolution).

### Notes
- **Minor bump** (backward-compatible additions — no token/component/pattern removed or renamed).
- DS score: 52/60 (87%) → 56/60 (93%) after this version.

---

## [1.0.0] — 2026-07-08

### Added
- **§12 Governance** in `design-system.md` — ownership (DS Owner = anh yêu, Maintainer = Devin), contribution process (proposal template + ADR flow), versioning policy (major/minor/patch rules), deprecation policy (mark → migrate → remove cycle), changelog location (this file).
- **CHANGELOG.md** (this file) — established as DS version history source.

### Notes
- **Baseline version**: 1.0.0 reflects the DS as documented on 2026-07-08 (§1-§11 already existed — tokens, components, patterns, a11y, runtime contexts, sync, guidelines, principles, settings patterns, theme runtime customization).
- **No breaking changes** — this version establishes governance foundation; all prior DS content is grandfathered in at this baseline.
- **Future bumps**: per §12.3 — major (breaking), minor (addition), patch (tweak). Every bump = entry here.

---

## How to add an entry

1. Decide bump type per §12.3 (major/minor/patch).
2. Add entry under new `## [X.Y.Z] — YYYY-MM-DD` heading at TOP (below this intro).
3. Use sections: `### Added` / `### Changed` / `### Deprecated` / `### Removed` / `### Migration guide` (major only).
4. Link ADR if applicable: `<token/component/pattern> — docs/adr/NNN-<decision>.md`.
5. Update `DS version: X.Y.Z` in `design-system.md` header (if we add a version field there).
6. Commit DS doc + changelog together (atomic — per AGENTS.md "atomic commits" rule, but DS doc + changelog are same concern, so 1 commit OK).
