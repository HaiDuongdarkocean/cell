# Plan: Port Theocean Dictionary + Theme System

> Phase G2 — Implementation Plan (high-level). Input: `docs/specs/spec-port-theocean-dict-and-theme.md`.
> Cite spec: mỗi approach/risk/milestone maps to spec F1-F12 + Out of Scope + Open Questions (resolved 2026-07-05).
> **Thứ tự**: Theme trước (F1-F6, M1-M6) → Dict sau (F7-F12, M7-M12). Tuần tự, không song song 2 feature.

## Approach

### Architecture (FSD, 2 feature độc lập + 1 shared options entrypoint)

```
┌─────────────────────────────────────────────────────────────────────┐
│ OPTIONS PAGE (MỚI — src/entrypoints/options/)                       │
│  OptionsApp.tsx — tab shell: Tài nguyên | Giao diện | Cài đặt (F12) │
│   ├─ Tab "Giao diện"  → ThemePanel (F4)                             │
│   ├─ Tab "Tài nguyên" → ResourcesPanel (F11)                        │
│   └─ Tab "Cài đặt"    → (reuse SettingsDialog content, M11)         │
└─────────────────────────────────────────────────────────────────────┘
                          │ chrome.storage.local + IndexedDB
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────────┐
│ FEATURE: theme (MỚI)        │   │ FEATURE: dictionary (MỚI)       │
│  entities/theme (types)     │   │  entities/dictionary (types)    │
│  stores/themeStore (Zustand)│   │  logic/                         │
│  logic/                     │   │   importOrchestrator (F10)      │
│   themeConfig (F1)          │   │   formatDetector (F8)           │
│   colorGenerator (F3)       │   │   fileDetector (F8)             │
│   contrastValidator (F3)    │   │   signatureGenerator (F8)       │
│   themeManager (F2)         │   │   normalizationPipeline         │
│   themeStorage (F1)         │   │   batchProcessor                │
│  ui/                        │   │   strategies/ (F9) ×6 + factory │
│   ThemePanel + 5 sub (F4)   │   │   importErrors                  │
│  app/ThemeProvider (F5)     │   │  repositories/ (F7) ×4          │
│                             │   │   baseRepository (migration v9) │
│  Content-script:            │   │   resource/frequency/dict repo  │
│   themeTokens.ts REWRITE    │   │  ui/                            │
│   (F5 — inject customColors)│   │   ResourcesPanel + 5 sub (F11)  │
└─────────────────────────────┘   └─────────────────────────────────┘
          │                               │
          ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────────┐
│ chrome.storage.local        │   │ IndexedDB orca-dict-{hash8}-en  │
│  themeMode (mới, tách)      │   │  3 stores (F7):                  │
│  themeConfig.customColors   │   │   langResourceInfo               │
│  settings (sửa: bỏ .theme)  │   │   langFrequencyEntry             │
│  orca.dbHash (mới, onInstall│   │   langDictionaryEntry            │
└─────────────────────────────┘   └─────────────────────────────────┘
```

### Key decisions (cite spec Open Questions resolved)

- **Storage tách riêng** (spec F1, OQ#8 closed) — `themeMode` + `themeConfig` ra khỏi `settings`, schema settings bump v7→v8 (xóa field `theme`). `themeConfig` KHÔNG chứa `mode` (mode là source of truth ở `themeMode` riêng — Risk #8 fix).
- **9 core tokens runtime configurable**, secondary derived (spec F2) — `colorGenerator` derive hover/subtle/border-focus, không store secondary (DRY).
- **System mode** (spec F2) — `prefers-color-scheme` media query + listener re-apply. Resolved mode = light|dark (system chỉ meta).
- **Content-script inject customColors** (spec F5, Risk #10) — `themeTokens.ts` rewrite: đọc `themeConfig.customColors[resolvedMode]` thay vì hardcoded LIGHT_TOKENS/DARK_TOKENS, derive secondary via `colorGenerator` (content-script-safe, no DOM deps).
- **SettingsDialog GIỮ theme toggle** (spec OQ#5) — shortcut light/dark quick switch, gọi `themeStore.switchMode()`. ThemePanel (options) = full config source of truth. Cùng store, không conflict.
- **fflate cho cả gzip + zip** (spec OQ#2) — 1 lib (~30KB) đơn giản hơn 2 code paths (gzip native + zip fflate). Ponytail: fewer code paths.
- **sql.js lazy-load** (spec OQ#1, F9) — `web_accessible_resources` cho `sql-wasm.wasm` + `sql-wasm.js`, load chỉ khi import `.db.gz`. CSP đã có `wasm-unsafe-eval` (verified `public/manifest.json:58`), KHÔNG đổi CSP.
- **DB hash random 8 chars** (spec OQ#3, F7) — sinh trên `chrome.runtime.onInstalled`, lưu `chrome.storage.local.orca.dbHash`. Tests fallback `'devmode0'`.
- **Migration v9 create-all only** (spec F7, Risk #11) — cell là DB mới (không user v1-v8), chỉ `oldVersion < 9` create-all branch + `ponytail:` comment. Full chain = dead code. Decide final ở G3 ADR-023.
- **Strategy template method** (spec F9) — `baseImportStrategy.execute()` template method (parse → transformEntry → batch → flush), subclass override `parse()` + `transformEntry()` + `getRepository()`. Giữ pattern reference, rewrite TS.
- **Atomic rollback** (spec F10, Risk #4) — orchestrator catch error → `rollbackImport(resourceId)` → rethrow. Rollback triggers: parse/transform error, **wasm load fail**, quota exceeded, user cancel. Rollback-during-rollback → `RollbackError`.

## Scope

### In scope (spec F1-F12)

**Theme (F1-F6)**:
- New `src/entities/theme/` (types), `src/features/theme/` (logic 5 + ui 6 + store), `src/app/ThemeProvider` (init popup/options/sidepanel)
- Modify: `src/shared/config/config.ts` (bỏ `settings.theme`, thêm storage keys), `src/features/settings/` (SettingsDialog theme toggle → switchMode shortcut), `src/entrypoints/popup|sidepanel` (boot themeStore.init), content-script `themeTokens.ts` (rewrite inject customColors)
- New `src/entrypoints/options/` (index.html, main.tsx, OptionsApp.tsx) — shared với dict
- Modify `public/manifest.json` (options_page) + vite.config (options entry)
- Update `docs/design-system/design-system.md` (F6 — mark 9 tokens runtime customizable + new section)
- Tests: pure logic 100% branches + UI render/interaction + migration test

**Dict (F7-F12)**:
- New `src/entities/dictionary/` (types), `src/features/dictionary/` (logic 9 + repositories 4 + ui 6)
- New `src/shared/lib/storage/dbHash.ts` (onInstall hash init)
- Modify `public/manifest.json` (`web_accessible_resources` sql-wasm + `chrome.runtime.onInstalled` wiring)
- New deps: `fflate`, `sql.js`, `fake-indexeddb` (devDep)
- Tests: pure logic 100% branches + repositories (fake-indexeddb) + strategies (each format 1 file) + migration test + integration smoke (opt-in)

### Out of scope (spec §Out of Scope — 9 items)

Wire dict→subtitle, i+1 mining, WordStatus SRS, Google OAuth, per-site permission, multi-profile, bootstrap onboarding, TabCoordinationService, PerformanceMonitor.

## Risk Mitigation

| # | Risk (spec ref) | Severity | Mitigation | Milestone |
|---|---|---|---|---|
| 1 | sql.js wasm load fail (F9, F10, Risk #4) | HIGH | `ImportError(DatabaseError)` → orchestrator catch → rollback. Test mock fetch fail. | M9, M10 |
| 2 | Schema migration untested (F7, Risk #5) | HIGH | `baseRepository.migration.test.ts` (fake-indexeddb): openDB v0 → assert v9 (3 stores + 6 indexes). | M7 |
| 3 | Scope creep wire dict→subtitle (S2, Risk #3) | HIGH | Out of Scope section in spec + plan. G4 task list KHÔNG include wire. | all |
| 4 | Content-script customColors inject (F5, Risk #10) | HIGH | Rewrite `themeTokens.ts` đọc `themeConfig.customColors[resolvedMode]`, derive secondary via `colorGenerator` (no DOM deps). Browser verify MCP. | M5 |
| 5 | SettingsDialog theme toggle conflict (OQ#5) | MEDIUM | GIỮ toggle làm shortcut → `themeStore.switchMode()`. Cùng store = no conflict. Test backward compat. | M6 |
| 6 | 500MB boundary + corrupt zip (F8, edge cases) | MEDIUM | `fileDetector.validateFile` reject >500MB trước parse. fflate throw → `CorruptedZipError` → rollback. Test boundary. | M8 |
| 7 | Rollback-during-rollback (F10, edge case) | MEDIUM | `rollbackImport` catch delete fail → `RollbackError` surfaced (không silent). Test. | M10 |
| 8 | sql.js bundle ~1MB (F1 deps) | MEDIUM | Lazy-load chỉ khi `.db.gz`. Check bundle size trước add, report anh. `web_accessible_resources` không vào main bundle. | M9 |
| 9 | settings.theme migration v7→v8 data loss (F1) | MEDIUM | Migration: read `settings.theme` → write `themeMode` → delete field. Migration test. | M1 |
| 10 | Options page entrypoint mới break build (F12) | MEDIUM | Vite + @crxjs config thêm options entry. `npm run build` verify. Browser MCP load unpacked. | M11 |
| 11 | G0.5 mockup skipped (workflow gap) | LOW | Spec F4/F11/F12 mô tả UI chi tiết đủ. Nếu anh muốn visual confirm trước G4 → chạy `design-driven-development` sinh mockup HTML. Quyết định anh. | pre-G4 |

## Milestones (high-level — task breakdown chi tiết ở G4)

### Phase A — Theme (F1-F6)

| M | Name | Spec ref | Verify |
|---|---|---|---|
| M1 | Theme types + storage + store + settings migration v7→v8 | F1 | tsc + `themeStore.test.ts` + `settingsStore.migration.test.ts` |
| M2 | colorGenerator + contrastValidator (pure logic) | F3 | `colorGenerator.test.ts` + `contrastValidator.test.ts` 100% branches |
| M3 | themeManager.applyTheme + system mode listener | F2 | `themeManager.test.ts` (CSS vars assert) + browser MCP switch mode |
| M4 | ThemePanel UI (ModeCards + ColorCustomization + ThemePreview + ContrastBadges + ThemeImportExport) | F4 | component tests + browser MCP open options, live preview |
| M5 | Integration popup/sidepanel/content-script + ThemeProvider + themeTokens.ts rewrite | F5 | `themeTokens.test.ts` + browser MCP change color in options → overlay updates no reload |
| M6 | SettingsDialog theme toggle shortcut + design-system.md update (F6) | F4 toggle, F6 | `SettingsDialog.test.tsx` backward compat + `ls` design-system.md |

**Checkpoint CP-A (sau M6)**: `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` + browser MCP (theme switch end-to-end popup/options/sidepanel/content-script). Gate vào Phase B.

### Phase B — Dict (F7-F12)

| M | Name | Spec ref | Verify |
|---|---|---|---|
| M7 | IndexedDB schema + 4 repositories + dbHash + migration test | F7 | repo tests (fake-indexeddb) + `baseRepository.migration.test.ts` v0→v9 |
| M8 | fileDetector + formatDetector + signatureGenerator (pure logic) | F8 | 3 test files 100% branches (magic bytes, 500MB boundary, SHA-256) |
| M9 | 6 strategies + strategyFactory + importErrors + batchProcessor + normalizationPipeline | F9 | each strategy 1 test file + sqliteStrategy mock wasm fail |
| M10 | importOrchestrator (use-case + atomic rollback) | F10 | `importOrchestrator.test.ts` (happy + duplicate + rollback + wasm fail + cancel) |
| M11 | ResourcesPanel UI (Dropzone + FilePreview + ResourceCard + ImportProgress + DeleteConfirmModal) + Options page entrypoint + manifest + vite config | F11, F12 | component tests + `npm run build` (options bundled) + browser MCP load unpacked, TXT import end-to-end |
| M12 | Integration smoke (opt-in) + E2E (Playwright options page) | spec Testing Strategy | `tests/integration/dictionary.integration.test.ts` + E2E |

**Checkpoint CP-B (sau M12)**: full quality gates + browser MCP (theme switch + 1 dict import TXT end-to-end trên real Edge). Gate vào G5.

## Verification Checkpoints

| CP | After | Gate |
|---|---|---|
| CP1 | M1-M2 | tsc + unit test pass (theme foundation) |
| CP2 | M3-M4 | unit + browser MCP (theme apply + ThemePanel live) |
| CP-A | M5-M6 | full gates + browser MCP theme end-to-end (popup/options/sidepanel/content-script) — **gate Phase B** |
| CP3 | M7-M8 | tsc + unit test pass (dict infra + detection) |
| CP4 | M9-M10 | unit test pass (strategies + orchestrator rollback) |
| CP-B | M11-M12 | full gates + browser MCP dict import end-to-end — **gate G5** |

## Parallel vs Sequential

- **Sequential bắt buộc**: M1→M2→M3→M4→M5→M6 (theme dependency chain: types→logic→manager→UI→integration→settings toggle). M7→M8→M9→M10→M11 (dict chain: schema→detection→strategies→orchestrator→UI).
- **Phase A → Phase B sequential**: spec quyết định theme trước, dict sau. Không song song 2 feature (shared options entrypoint M6/M11, tránh merge conflict).
- **Parallel possible (nếu nhiều agent)**: trong M4 (5 ThemePanel sub-components độc lập), trong M9 (6 strategies độc lập sau khi baseImportStrategy + batchProcessor xong). Decide ở G4 task breakdown.
- **M12 last**: integration + E2E cần tất cả M1-M11 xong.

## Dependencies

### New deps (ask first — spec Boundaries)

| Dep | Size | Purpose | When | Risk |
|---|---|---|---|---|
| `fflate` | ~30KB | gzip + zip decompress (F8) | M8 | nhỏ, pure JS, no wasm |
| `sql.js` | ~1MB+ wasm | SQLite parse `.db.gz` (F9) | M9 | lazy-load, `web_accessible_resources`, KHÔNG vào main bundle |
| `fake-indexeddb` | devDep | repo + migration test (F7) | M7 | test only, 0 prod impact |

> Check bundle size trước add, report anh (spec Boundaries "Ask first"). `sql.js` wasm KHÔNG vào main bundle (lazy fetch từ `web_accessible_resources`).

### Reuse codebase cell

- `theme.css` tokens (sửa thành runtime-driven, giữ naming — spec assumption #1)
- `themeTokens.ts` (rewrite, không xóa file)
- `settingsStore` + `config.ts` (modify migration)
- `getActiveContentTab`, `chrome.storage` helpers, `chromeMock` test pattern
- FSD structure (`entities/`, `features/`, `shared/`, `entrypoints/`)
- CSS Modules, named exports, JSDoc conventions

### New files (count)

- Theme: ~13 new (5 logic + 6 ui + store + ThemeProvider + types) + modify ~6
- Dict: ~20 new (9 logic + 4 repositories + 6 ui + types) + modify ~2
- Options entrypoint: 3 new + modify manifest + vite config

## Open Questions (defer G3 ADR)

- **ADR-022** (Theme): `--color-info` token keep/drop (OQ#4 — recommend giữ), i18n (OQ#8 — recommend giữ tiếng Việt), migration chain final decision (recommend create-all only).
- **ADR-023** (Dict): sql.js lazy-load mechanism final (dynamic import vs fetch wasm), migration v9 create-all vs full chain (Risk #11 — recommend create-all + ponytail comment).

## Next

- G3 ADR → `system-architecture-design` + `api-and-interface-design`
  - ADR-022: Theme system runtime customization (storage tách riêng, 9 core tokens, derive secondary, system mode, content-script inject)
  - ADR-023: Dictionary import IndexedDB schema + strategy pattern + atomic rollback + sql.js lazy-load
- G4 Implementation → `task-port-theocean-dict-and-theme.md` (task breakdown chi tiết, theme trước M1-M6, dict sau M7-M12)
