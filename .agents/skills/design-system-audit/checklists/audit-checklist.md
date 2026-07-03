# Design System Audit Checklist

> Run each item during `design-system-audit` Step 2-8. Check off as you go.
> If any item FAILS → fix the drift in `design-system.md` before moving to next section.

## Section 1 — Tokens

- [ ] Read `src/entrypoints/popup/styles/theme.css` — extracted all `:root` + `[data-theme="dark"]` tokens
- [ ] Read `src/shared/lib/themeTokens.ts` — extracted `LIGHT_TOKENS` + `DARK_TOKENS`
- [ ] For each token in doc: grep name in `theme.css` → still exists?
- [ ] For each token in doc: compare value in doc vs value in file → drift?
- [ ] For each token in `theme.css` NOT in doc → add row (Status/Since/Used in/Source)
- [ ] For each token in doc NOT in `theme.css` → remove row (mark deprecated if intentional)
- [ ] Cross-runtime: every `theme.css` token appears in `themeTokens.ts` mirror? (if not → Section 6 flag)

## Section 2 — Components

- [ ] `find_file_by_name *.tsx` in `src/shared/ui/` + `src/features/settings/ui/` + `src/entrypoints/popup/components/`
- [ ] `grep "^export function create" src/features/subtitle/ui/` — DOM factories listed
- [ ] `grep "Controller.ts" src/features/` — controllers listed
- [ ] For each component in doc: `ls <file path>` → still exists?
- [ ] For each component in `src/` NOT in doc → add row
- [ ] Spot-check 2 components: read file, verify Variants/States/a11y columns accurate

## Section 3 — Patterns

- [ ] `ls docs/adr/*.md` — ADR list current
- [ ] For each ADR: read "## Decision" (first 30 lines) → extract pattern
- [ ] For each pattern in doc: ADR Status still "Accepted"? (if Superseded → update/remove)
- [ ] For each new ADR with new pattern → add row (ADR ref + Use when / Don't use when)
- [ ] Cross-check 2 "Used in" claims: grep file mentioned → pattern actually used?

## Section 4 — Accessibility

- [ ] `grep "aria-|role=" src/features/subtitle/ui/` + `src/shared/ui/` + `src/entrypoints/popup/components/`
- [ ] New aria convention in code but not in table? → add row with Level + WCAG ref
- [ ] Convention in table but 0 grep matches in code? → mark deprecated or remove
- [ ] Sample 2 WCAG ref URLs → still resolve?

## Section 5 — Runtime Contexts

- [ ] Read `public/manifest.json` — extract entry points
- [ ] Compare with Section 5 table → new/removed/moved entry point?
- [ ] `ls` each "Entry point" path → exists?

## Section 6 — Cross-runtime Sync

- [ ] Diff `theme.css` `:root` vs `themeTokens.ts` `LIGHT_TOKENS` → token names match?
- [ ] Diff `theme.css` `[data-theme="dark"]` vs `themeTokens.ts` `DARK_TOKENS` → match?
- [ ] If drift found: is it a DOC issue or CODE issue?
  - DOC issue (doc says wrong sync status) → fix doc
  - CODE issue (mirror file missing token) → **STOP, surface to anh**
- [ ] Update "Last synced" date if drift fixed

## Section 7 — Guidelines

- [ ] `grep "principle|convention" docs/knowledge/` → new principle relevant to design system?
- [ ] If yes → add row with Level + Category + Rationale

## Final

- [ ] Update "Last updated: YYYY-MM-DD" at top of `design-system.md` to today
- [ ] Drift report output in chat (list every change per section)
- [ ] `git diff docs/design-system/design-system.md` — review changes before commit
