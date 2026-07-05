# Spec Review: Port Theocean Dictionary + Theme System

> **Model**: subagent_general (Opus 4.8 preferred, fallback Kimi 2.7)
> **Date**: 2026-07-05
> **Spec**: `docs/specs/spec-port-theocean-dict-and-theme.md`
> **Intent**: `docs/intent/intent-port-theocean-dict-and-theme.md`
> **Reviewer**: spec-reviewer skill (subagent)

## Status

**APPROVED_WITH_CONDITIONS**

All 10 required input files read in full (intent, spec, architecture, design-system, theme.css, themeTokens.ts, config.ts, settingsStore.ts, manifest at `public/manifest.json`, package.json) + 8 reference files verified via `Get-Content -Raw` + 3 checklists + template. No missing inputs → not BLOCKED on that ground. However, 1 CRITICAL-severity checklist FAIL (T1) + 2 HIGH FAILs (T2, S2) + several HIGH risks require resolution before G2.

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 4/4 | 0/4 | 0/4 | F1-F4 |
| Testability (QA) | 1/3 | 2/3 | 0/3 | T1-T3 |
| Scope (Product) | 2/3 | 1/3 | 0/3 | S1-S3 |
| **Total** | 7/10 | 3/10 | 0/10 | |

## Checklist Details

### Feasibility (Tech Lead) — 4/4 PASS

| Item | Question | Status | Note |
|------|----------|--------|------|
| F1 | Dependencies have owner + timeline + fallback? | PASS | fflate (~30KB), sql.js (~1MB wasm, lazy-load on `.db.gz`), fake-indexeddb (devDep). Gap: no explicit fallback if sql.js wasm fails at runtime → Risk #4. |
| F2 | Architecture considerations section exists? | PASS | "Project Structure" lists FSD target tree with per-file purpose + "(MỚI)/(sửa)" markers + data flow. References future ADR-022/023. |
| F3 | Technical constraints reviewed? | PASS | MV3, React 19, TS strict, @crxjs, IndexedDB ≤500MB, batch 5000, SHA-256 dedupe (1MB sample), wasm-unsafe-eval CSP, WCAG AA/AAA thresholds all stated. |
| F4 | Rollback strategy for stateful changes? | PASS | F10 atomic rollback. F1 migration v7→v8. ImportError hierarchy. |

### Testability (QA) — 1/3 PASS, 2 FAIL

| Item | Question | Status | Note |
|------|----------|--------|------|
| T1 | Every acceptance criterion has concrete verify method? | **FAIL (CRITICAL)** | F1-F12 are concrete checkboxes BUT no per-criterion "Verify:" column. Only F12 has explicit browser verify. Fix: annotate each F1-F12 with verify method (unit test name / browser MCP step / integration smoke). |
| T2 | Edge cases ≥2 per user story? | **FAIL (HIGH)** | 2 user stories but NO explicit edge-case list. Must add ≥2 edge cases per US: empty/corrupt/oversized file, wrong format, wasm load fail, duplicate signature, rollback failure, system pref change mid-session, import-cancel mid-batch. |
| T3 | Error states defined? | PASS | `importErrors.ts` hierarchy, F10 rollback path, F11 toast error, F4 ContrastBadges Fail, reset confirm dialog. |

### Scope (Product) — 2/3 PASS, 1 FAIL

| Item | Question | Status | Note |
|------|----------|--------|------|
| S1 | Problem statement doesn't mention solution? | PASS | "Why now" states problem. User stories describe user need. |
| S2 | Out-of-scope ≥3 tempting extensions? | **FAIL (HIGH)** | Spec has NO "Out of scope" section. Intent has rich 9-item list. Spec must re-state or reference intent's out-of-scope. Risk: scope-creep into wire-dict-to-subtitle. |
| S3 | Success metrics measurable? | PASS | F1-F12 concrete + measurable: 9 named CSS vars, 3 named object stores with named indexes, batch 5000, max 500MB, WCAG thresholds, SHA-256 signature, debounce 300ms, transition 200ms. |

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | HIGH | T1 / Success Criteria | No per-criterion verify method — how does QA know each F1-F12 is done? | Add "Verify" sub-bullet to each F1-F12: unit test file name, browser MCP step, or integration smoke tag. |
| 2 | HIGH | T2 / Success Criteria | No enumerated edge cases per user story — high-risk areas untested (sql.js wasm load fail, rollback-during-rollback, 500MB boundary, corrupt zip, duplicate signature, system-mode mid-session switch). | Add "Edge cases" subsection under US-TH-1 and US-DI-1, ≥2 each. |
| 3 | HIGH | S2 / Scope | Spec lacks "Out of scope" section — intent's 9-item exclusion list not carried into spec. | Add "## Out of Scope" section mirroring intent (wire dict→subtitle, i+1 mining, WordStatus SRS, OAuth, per-site permission, multi-profile, bootstrap, TabCoordination, PerformanceMonitor). |
| 4 | HIGH | F9 / F10 | sql.js wasm lazy-load failure path undefined — if `web_accessible_resources` misconfigured or wasm fetch fails, what happens? | Specify: wasm load failure → `ImportError` (Database subtype) → toast error → resource `installationFinished=false` → rollback. Add to F9 + F10 + T2 edge cases. |
| 5 | HIGH | F7 / Testing Strategy | Schema migration v1→v9 chain complex but Testing Strategy only lists "IndexedDB CRUD" — NO migration-chain test. Untested migrations risk user data corruption. | Add to F7: "Migration chain test: openDB at v1 → assert v9 schema (3 stores + all indexes)"; add `baseRepository.migration.test.ts` to Testing Strategy. |
| 6 | MEDIUM | Project Structure | Spec lists `manifest.json` at root — actual file is `public/manifest.json` (vite.config.ts imports `./public/manifest.json`). | Change `manifest.json` → `public/manifest.json` in Project Structure + F12. |
| 7 | MEDIUM | Project Structure | Spec marks `src/app/` as "(sẽ thêm)" but `src/app/` ALREADY EXISTS (`.gitkeep`). Same `src/stores/`. | Change `src/app/` → "(sửa) thêm ThemeProvider"; note `src/stores/` already exists. |
| 8 | MEDIUM | F1 | `themeConfig` shape has both `themeConfig.mode` AND separate `themeMode` key — redundant, unclear source of truth. | Clarify: `themeMode` is source of truth, `themeConfig` has only `customColors` (no `mode` field). Document in F1. |
| 9 | MEDIUM | Open Q1 / F12 | Spec asks "cell CSP hiện tại?" — **already verified: `public/manifest.json:58` has `script-src 'self' 'wasm-unsafe-eval'`** → CSP ALREADY allows wasm, NO CSP change needed. | Update OQ#1 + F12: state CSP already allows wasm; only add `web_accessible_resources` for sql-wasm.wasm/.js. |
| 10 | MEDIUM | F2 / F5 | Content-script `themeTokens.ts` currently hardcodes LIGHT_TOKENS/DARK_TOKENS strings (171 lines). Spec F5 says rewrite but doesn't address custom user colors injection into isolated world. | Add F5 sub-criterion: "themeTokens.ts injects custom palette from `chrome.storage.local.themeConfig.customColors[mode]` (not hardcoded); derive secondary via colorGenerator (content-script-safe, no DOM deps)." |
| 11 | LOW | F7 | Spec says "schema migration v1→v9 (giữ migration chain reference)" — reference has gaps (v7,v8 skipped). Cell is NEW DB (no existing v1-v8 users) so full chain unnecessary; only v9 create-all needed. Porting full chain adds dead code. | Either (a) port only `oldVersion < 9` create-all branch (cell fresh install), or (b) keep full chain with `ponytail:` comment. Decide in G3 ADR-023. |

## Open Questions Evaluation

Spec has 8 open questions. Evaluation:

| # | Question | Need before G2? | Recommendation |
|---|----------|-----------------|----------------|
| 1 | sql.js bundle/lazy + CSP | **Partly** — CSP part answerable NOW (verified: CSP already allows `wasm-unsafe-eval`, no change needed). Lazy-load decision defer to G3 ADR. | **Update spec now**: note CSP already allows wasm. Lazy-load → G3 ADR-022/023. |
| 2 | fflate vs native `DecompressionStream` | **Yes** — affects deps list (bundle size) in G2 plan. | **Answer before G2**: recommend fflate for both (consistency + ZIP has no native; gzip native saves ~10KB but adds 2 code paths). |
| 3 | DB hash strategy (random vs hardcode) | **Yes** — affects `chrome.runtime.onInstalled` wiring + manifest + test setup. | **Answer before G2**: recommend random hash (reference pattern, avoids reinstall conflict). Tests use fallback `'devmode0'` when chrome.storage absent. |
| 4 | `--color-info` token keep/drop | No — minor, defer. | Defer to G3 ADR-022. Recommend keep (cell uses it, design-system.md documents it). |
| 5 | SettingsDialog theme toggle keep/drop | **Yes** — affects `features/settings` "(sửa)" scope + G2 task list. | **Answer before G2**: recommend drop (single source of truth = ThemePanel). |
| 6 | design-system.md fate | No — F6 already decides (giữ + add section). | **Close**: F6 answers it. |
| 7 | Migration `settings.theme` v7→v8 | No — F1 already specifies. | **Close**: F1 answers it. Verify migration test added (Risk #5). |
| 8 | i18n | No — defer. | Defer to G3 ADR. Recommend giữ tiếng Việt (cell has no i18n layer, ponytail). |

**Must answer before G2**: #2 (fflate vs native), #3 (DB hash), #5 (SettingsDialog toggle).
**Update spec now (no user input needed)**: #1 CSP note.
**Defer to G3 ADR**: #4, #8.
**Close (already answered in spec)**: #6, #7.

## Suggested Spec Updates

1. **Project Structure — manifest path** (Risk #6):
   - Old: `manifest.json                           # (sửa) + options_page + web_accessible_resources (sql-wasm.wasm)`
   - New: `public/manifest.json                    # (sửa) + options_page + web_accessible_resources (sql-wasm.wasm + sql-wasm.js)`

2. **Project Structure — src/app marker** (Risk #7):
   - Old: `├── app/                                # (sẽ thêm) ThemeProvider init ở popup/options/sidepanel`
   - New: `├── app/                                # (sửa) thêm ThemeProvider init ở popup/options/sidepanel (dir đã có .gitkeep)`

3. **F1 — clarify themeConfig vs themeMode** (Risk #8):
   - Old: `- [ ] chrome.storage.local.themeConfig (object: { mode, customColors: { light: {...}, dark: {...} } }) + themeMode ('light'|'dark'|'system') tách riêng khỏi settings`
   - New: `- [ ] chrome.storage.local.themeConfig (object: { customColors: { light: {...9 tokens...}, dark: {...9 tokens...} } }) — KHÔNG chứa mode (mode là source of truth ở themeMode riêng) + themeMode ('light'|'dark'|'system') tách riêng khỏi settings`

4. **F5 — content-script custom palette injection** (Risk #10):
   - Old: `- [ ] Content-script: themeTokens.ts đọc themeMode + themeConfig thay vì hardcoded tokens, inject CSS vars vào container`
   - New: `- [ ] Content-script: themeTokens.ts đọc themeMode + themeConfig.customColors[resolvedMode] thay vì hardcoded LIGHT_TOKENS/DARK_TOKENS strings; inject 9 core CSS vars + derive secondary (hover/subtle/border-focus) via colorGenerator (content-script-safe, no DOM deps) vào container <style>`

5. **F7 — add migration test** (Risk #5):
   - Add bullet: `- [ ] Migration chain test (baseRepository.migration.test.ts với fake-indexeddb): openDB at v1 → assert upgrade to v9 tạo đủ 3 stores + all indexes (by_signature, by_type, by_order, by_resource, by_term, by_backwardTerm)`
   - Testing Strategy table — add row: `Schema migration | Jest 30 + fake-indexeddb | src/features/dictionary/repositories/baseRepository.migration.test.ts | v1→v9 upgrade chain`

6. **F9/F10 — sql.js wasm load failure path** (Risk #4):
   - F9 add: `- [ ] sqliteStrategy: nếu sql.js wasm load fail (fetch error / wasm parse error) → throw ImportError(DatabaseError) — không crash, orchestrator catch → rollback`
   - F10 add: `- [ ] Rollback trigger bao gồm: strategy parse/transform error, wasm load failure, quota exceeded, user cancel`

7. **T1 fix — add Verify per criterion** (Risk #1): Add "Verify" sub-bullet to each F1-F12. Example for F2:
   - `Verify: unit test themeManager.test.ts (assert document.documentElement.style.getPropertyValue('--color-primary') === config.primary); browser MCP edge-devtools — switch mode, assert [data-theme] attr + computed color on sample element.`

8. **T2 fix — add Edge Cases section** (Risk #2): After "### Dictionary import (F7-F12)" add:
   ```
   ### Edge cases (test coverage)
   **Theme**: system pref change mid-session; import invalid JSON (missing customColors); color picker drag rapid-fire (debounce); reset confirm cancel; contrast Fail on user color.
   **Dict**: empty file; wrong format (txt content in .json); corrupt zip; 500MB+1 byte rejected; sql.js wasm load fail; duplicate signature (re-import same file); rollback-during-rollback (delete fails); cancel mid-batch; 0 words parsed (empty array).
   ```

9. **S2 fix — add Out of Scope section** (Risk #3): After "## Boundaries" add:
   ```
   ## Out of Scope (xem intent line 55-65)
   - Wire dict vào subtitle lookup (G sau, riêng feature)
   - i+1 sentence mining (IPlusOneSelector, SentenceExtractor, WordTokenizer)
   - WordStatus SRS tracking
   - Google OAuth + Drive sync
   - Per-site permission + blacklist
   - Multi-language profile + tier enforcement
   - Bootstrap download onboarding
   - TabCoordinationService
   - PerformanceMonitor
   ```

10. **OQ#1 — CSP already verified** (Risk #9): Update OQ#1 to:
    - `sql.js bundle: sql-wasm.wasm ~1MB+ — lazy load chỉ khi user import .db.gz (decide G3 ADR). CSP: ĐÃ VERIFIED — public/manifest.json:58 đã có script-src 'self' 'wasm-unsafe-eval', KHÔNG cần đổi CSP. Chỉ cần thêm web_accessible_resources cho sql-wasm.wasm + sql-wasm.js.`

## Verification

- [x] All 10 input files read (not from memory)
- [x] Subagent launched (subagent_general)
- [x] All 3 checklists run (Feasibility, Testability, Scope)
- [x] Review report saved to `docs/reviews/review-port-theocean-dict-and-theme.md`
- [x] Status: APPROVED_WITH_CONDITIONS
- [x] Every FAIL has a risk entry (T1→#1, T2→#2, S2→#3)
- [x] No CRITICAL risk without open question (T1 CRITICAL → addressed via Risk #1 fix + OQ eval)
- [x] Model recorded in header
- [ ] User presented with status + risks + open questions (pending)
