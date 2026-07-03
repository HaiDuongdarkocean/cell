---
name: design-system-audit
description: Audits the codebase against docs/design-system/design-system.md and updates the living document to match reality. Use when the design system may have drifted (after refactors, token renames, new components, new ADRs), when onboarding to the UI codebase, before a visual refactor, or quarterly. Triggers on "audit design system", "update design-system.md", "design system drift", "is design-system.md current", "kiểm tra design system", "design system có drift không".
---

# Design System Audit

## One-line summary

Audit the codebase against `docs/design-system/design-system.md` and update the living document so it matches reality — tokens, components, patterns, a11y, runtime contexts, sync status, guidelines.

## When to Use

- After a refactor that touched tokens, components, or patterns
- After adding/renaming/removing a token in `theme.css` or `themeTokens.ts`
- After a new ADR approves an interaction pattern
- After adding a new component (React or DOM factory)
- Before a visual refactor (measure first, refactor second)
- Onboarding to the UI codebase (read `design-system.md` first, then audit to confirm it's current)
- Quarterly drift check (G7 maintenance)

**Trigger phrases:**
- "audit design system"
- "update design-system.md"
- "design system drift"
- "is design-system.md current"
- "kiểm tra design system"
- "design system có drift không"

## Input

- **`docs/design-system/design-system.md`** — the living document to audit + update
- **`src/entrypoints/popup/styles/theme.css`** — token source of truth (popup)
- **`src/shared/lib/themeTokens.ts`** — token mirror (content-script, ADR-015 T12)
- **`docs/adr/*.md`** — ADRs that approve interaction patterns
- **`src/`** — components, DOM factories, controllers
- **`public/manifest.json`** — runtime contexts (popup, sidepanel, content-script, background, offscreen)

## Output

- **Updated `docs/design-system/design-system.md`** — 7 sections reconciled with codebase reality
- **Drift report** (inline in chat, not a file) — list of drifts found + fixed, with `file:line` citations

## Process

> **Run `checklists/audit-checklist.md` alongside each step below.** The checklist has checkable items per section; this SKILL.md has the how-to.

### Step 1 — Read the living document

Read `docs/design-system/design-system.md` end-to-end. Note the "Last updated" date at top. This is the baseline — every section will be cross-checked against the codebase.

### Step 2 — Audit Section 1: Tokens

Compare every token in the document against the source files.

1. Read `src/entrypoints/popup/styles/theme.css` — extract all `:root` tokens + `[data-theme="dark"]` overrides
2. Read `src/shared/lib/themeTokens.ts` — extract `LIGHT_TOKENS` + `DARK_TOKENS` mirror
3. For each token in the document:
   - **Still exists?** → grep token name in both files. If missing → mark for removal.
   - **Value changed?** → compare document value vs file value. If drift → update document.
   - **Source line correct?** → verify `theme.css:NN` citation still points to right line
4. For each token in the files NOT in the document → new token, add row with Status/Since/Used in/Source
5. **Cross-runtime sync check**: every token in `theme.css` must appear in `themeTokens.ts` mirror. If missing in mirror → flag as drift (Section 6 sync status → ⚠️ Out of sync)

### Step 3 — Audit Section 2: Components

1. List popup React components: `find_file_by_name` for `*.tsx` in `src/shared/ui/` + `src/features/settings/ui/` + `src/entrypoints/popup/components/`
2. List content-script DOM factories: `grep` for `^export function create` in `src/features/subtitle/ui/`
3. List controllers: `grep` for `Controller.ts` in `src/features/`
4. For each component in the document:
   - **Still exists?** → `ls` the file path. If missing → mark as deprecated or remove row.
   - **File path correct?** → verify path still resolves
   - **Variants/states/a11y columns** → spot-check 1-2 components by reading file (don't read all — sample)
5. For each component in `src/` NOT in the document → new component, add row

### Step 4 — Audit Section 3: Patterns

1. List ADRs: `ls docs/adr/*.md`
2. For each ADR, read the "## Decision" section (first 30 lines enough) — extract pattern name
3. Compare with Section 3 table:
   - **ADR still valid?** → check Status field in ADR (Proposed/Accepted/Superseded/Deprecated). If Superseded → update pattern row or remove
   - **New ADR with new pattern?** → add row with ADR ref + Use when / Don't use when
4. Cross-check: every "Used in" claim → grep the file mentioned to confirm pattern actually used there

### Step 5 — Audit Section 4: Accessibility

1. `grep` for `aria-` and `role=` in `src/features/subtitle/ui/` + `src/shared/ui/` + `src/entrypoints/popup/components/`
2. Compare conventions found vs Section 4 table:
   - **New aria convention used in code but not in table?** → add row with Level + WCAG ref
   - **Convention in table but no longer used in code?** → mark as deprecated or remove
3. Verify WCAG ref URLs still resolve (sample 2-3 — don't check all)

### Step 6 — Audit Section 5: Runtime Contexts

1. Read `public/manifest.json` — extract `action.default_popup`, `side_panel.default_path`, `content_scripts`, `background.service_worker`
2. Compare with Section 5 table:
   - **New entry point?** → add row
   - **Entry point moved?** → update path
3. Verify each "Entry point" path exists with `ls`

### Step 7 — Audit Section 6: Cross-runtime Sync

1. Diff `theme.css` `:root` block vs `themeTokens.ts` `LIGHT_TOKENS` block — token names must match
2. Diff `theme.css` `[data-theme="dark"]` block vs `themeTokens.ts` `DARK_TOKENS` block
3. Update "Last synced" date if drift found + fixed
4. If drift found that requires code change (not just doc update) → **STOP, surface to anh**. This skill updates the doc, not the code. Code fix is a separate task.

### Step 8 — Audit Section 7: Guidelines

1. Read guidelines table — these change rarely (principles, not values)
2. Only update if a new principle was established in a recent ADR or `docs/knowledge/` entry
3. `grep` `docs/knowledge/` for "principle" or "convention" — if new principle relevant to design system → add row

### Step 9 — Update "Last updated" + write drift report

1. Update "Last updated: YYYY-MM-DD" at top of file to today
2. Write drift report inline in chat:
   ```
   Design System Audit — YYYY-MM-DD
   ├── Section 1 Tokens: N drifts fixed (list each: token name + what changed)
   ├── Section 2 Components: N added, N removed, N updated
   ├── Section 3 Patterns: N added, N superseded
   ├── Section 4 A11y: N added, N removed
   ├── Section 5 Runtime: N changes
   ├── Section 6 Sync: ✅ Synced / ⚠️ N drifts flagged (code fix needed)
   └── Section 7 Guidelines: N added
   ```

## Verification

After running this skill:

- [ ] `docs/design-system/design-system.md` "Last updated" = today
- [ ] Every token in Section 1 exists in `theme.css` (grep verify)
- [ ] Every component in Section 2 exists at the file path listed (`ls` verify)
- [ ] Every ADR in Section 3 exists in `docs/adr/` (`ls` verify)
- [ ] Section 6 sync status reflects actual `theme.css` ↔ `themeTokens.ts` diff
- [ ] No "Status: deprecated" entries left in the document without a note
- [ ] Drift report output in chat lists every change made

## Boundaries

- **Always do**: Read the actual source files — never trust the document's existing values (they may already be stale). Cite `file:line` for every token.
- **Ask first**: If Section 6 sync check finds `themeTokens.ts` is out of sync with `theme.css` — this is a CODE bug, not a doc drift. Stop and surface to anh. Do not silently "fix" the mirror file.
- **Never do**: Do not invent tokens/components/patterns not in the codebase. Do not delete a row without confirming the file is truly gone (`ls` verify). Do not change token values in `theme.css` or `themeTokens.ts` — this skill updates the DOC, not the code.

## Anti-patterns

- **Bad**: "design-system.md looks fine, last updated 2 weeks ago, I'll just update the date." → Drift invisible. Always run the audit steps, don't trust the date.
- **Good**: "Section 1 has `--color-accent` but grep finds 0 matches in theme.css → remove row, note in drift report."
- **Bad**: "themeTokens.ts is missing `--nav-cluster-z-index` → I'll add it to the mirror file." → This skill updates the doc, not the code. Surface to anh.
- **Good**: "themeTokens.ts is missing `--nav-cluster-z-index` → flag in Section 6 as ⚠️ Out of sync, surface to anh for code fix."

## Frequency

This skill is **manually invoked** (not auto-triggered). Recommended cadence:

| Trigger | Priority |
|---|---|
| After token rename/add/remove in `theme.css` | High — run same day |
| After new component/factory added | High — run same day |
| After new ADR approves pattern | Medium — run within sprint |
| Before visual refactor | High — run first |
| Quarterly drift check (G7) | Low — run once per quarter |
| Onboarding new contributor | Medium — run to confirm doc is current |
