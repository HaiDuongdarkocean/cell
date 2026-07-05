# Task List: Port Theocean Dictionary + Theme System

> **Giai đoạn**: G4 Implementation (task breakdown chi tiết đầu G4)
> **Date**: 2026-07-05
> **Spec**: `docs/specs/spec-port-theocean-dict-and-theme.md` (F1-F12)
> **Plan**: `docs/plan/plan-port-theocean-dict-and-theme.md` (M1-M12)
> **ADR**: `docs/adr/022-port-theocean-theme-system.md`, `docs/adr/023-port-theocean-dictionary-import.md`
> **Methodology**: `incremental-implementation` (vertical slices) + `test-driven-development` (RED→GREEN→REFACTOR) + `extension-browser-debugging` (browser-facing stop-the-line)
> **Thứ tự**: Theme trước (M1-M6) → CP-A → Dict sau (M7-M12) → CP-B

## Slicing strategy

Vertical slices per file. Pure logic first (testable, no DOM), then stateful, then UI, then integration, then browser verify. Each slice = 1 file + 1 test file, TDD, commit per slice (atomic). Browser-facing slice = +1 browser MCP verify trước commit.

---

## Phase A — Theme (F1-F6)

### M1: Foundation — Theme types + storage + store + settings migration

#### Task 1: Theme entity types + DEFAULT_THEME_CONFIG
**Description**: Add `ThemeMode`, `ResolvedMode`, `CoreColorTokens`, `ThemeConfig` to `src/entities/theme/types.ts`. Export `DEFAULT_THEME_CONFIG` (current LIGHT/DARK palette from `themeTokens.ts`).
**Acceptance**:
- [ ] `ThemeMode = 'light'|'dark'|'system'`, `ResolvedMode = 'light'|'dark'`
- [ ] `CoreColorTokens` 9 fields (primary, background, surface, text, textSecondary, border, success, warning, error)
- [ ] `ThemeConfig { customColors: { light: CoreColorTokens; dark: CoreColorTokens } }` — NO `mode` field
- [ ] `DEFAULT_THEME_CONFIG` matches current LIGHT_TOKENS/DARK_TOKENS palette
**Verify**: `npx tsc --noEmit` + `npm run test:unit -- --testPathPatterns=entities/theme`
**Dependencies**: None
**Files**: `src/entities/theme/types.ts` (new), `src/entities/theme/index.ts` (new), `tests/unit/entities/theme/types.test.ts` (new)
**Scope**: S

#### Task 2: colorGenerator pure logic (extract from future M2 — needed by DEFAULT derive)
**Description**: `src/features/theme/logic/colorGenerator.ts` — `hexToRgb`, `rgbToHex`, `getLuminance`, `generateShade`, `generateHoverColor`, `generatePalette`. Pure, content-script-safe (no DOM).
**Acceptance**:
- [ ] `hexToRgb('#2563eb')` → `{r:37,g:99,b:235}`; invalid hex → throw
- [ ] `getLuminance('#ffffff')` = 1, `#000000` = 0
- [ ] `generateShade('#2563eb', 10)` → darker 10%
- [ ] `generateHoverColor` = `generateShade(hex, 10)`
- [ ] 100% branch coverage
**Verify**: RED→GREEN `colorGenerator.test.ts` 100% branches + `npx tsc --noEmit`
**Dependencies**: Task 1 (uses CoreColorTokens in palette typing)
**Files**: `src/features/theme/logic/colorGenerator.ts` (new), `src/features/theme/logic/colorGenerator.test.ts` (new)
**Scope**: S

#### Task 3: themeStorage CRUD (chrome.storage.local)
**Description**: `src/features/theme/logic/themeStorage.ts` — `loadThemeMode`, `loadThemeConfig`, `saveThemeMode`, `saveThemeConfig`. Add `THEME_MODE` + `THEME_CONFIG` to `STORAGE_KEYS` in config.ts.
**Acceptance**:
- [ ] `STORAGE_KEYS.THEME_MODE = 'themeMode'`, `STORAGE_KEYS.THEME_CONFIG = 'themeConfig'`
- [ ] `loadThemeMode()` returns `'dark'` default if absent
- [ ] `loadThemeConfig()` returns `DEFAULT_THEME_CONFIG` if absent
- [ ] `saveThemeMode`/`saveThemeConfig` persist via `setStorage`
**Verify**: `themeStorage.test.ts` (chromeMock) + `npx tsc --noEmit`
**Dependencies**: Task 1
**Files**: `src/features/theme/logic/themeStorage.ts` (new), `src/shared/config/config.ts` (modify STORAGE_KEYS), `src/features/theme/logic/themeStorage.test.ts` (new)
**Scope**: S

#### Task 4: themeStore (Zustand) + settings migration v7→v8
**Description**: `src/stores/themeStore.ts` — `mode`, `config`, `init()`, `switchMode`, `updateColor`, `setConfig`, `resetTheme`. Bump `CURRENT_SCHEMA_VERSION=8` + migration v7→v8 (read `settings.theme` → write `themeMode` separate key → delete `theme` field from settings). Remove `theme` from `Settings` interface + `DEFAULT_SETTINGS`.
**Acceptance**:
- [ ] `themeStore.init()` loads themeMode + themeConfig from storage
- [ ] `switchMode('system')` persists + triggers re-apply
- [ ] `updateColor('dark', 'primary', '#60a5fa')` updates config + persists
- [ ] Migration v7→v8: `settings.theme='dark'` → `themeMode='dark'` (separate key), `settings.theme` field removed
- [ ] `Settings` interface no longer has `theme` field
- [ ] `DEFAULT_SETTINGS` no `theme` field
**Verify**: RED migration test fails → GREEN bump+migration passes; `themeStore.test.ts`; `npx tsc --noEmit` (will catch all `settings.theme` references)
**Dependencies**: Task 3
**Files**: `src/stores/themeStore.ts` (new), `src/shared/lib/storage/settingsStore.ts` (modify), `src/entities/settings/types.ts` (modify — remove `theme`), `src/shared/config/config.ts` (modify — remove `theme` from DEFAULT_SETTINGS), `src/stores/themeStore.test.ts` (new), `tests/unit/settingsStore.migration.test.ts` (new or extend)
**Scope**: M (touches settings — grep all `settings.theme` callers first)

> **Ponytail PRE-FILTER**: `grep -r "settings.theme\|\.theme\b" src/` — find all callers before removing field. SettingsDialog theme toggle (M6) will switch to `themeStore.switchMode`. content-script `themeTokens.ts` (M5) will switch to `themeStore`. Fix all in their respective tasks.

---

### M2: contrastValidator (pure logic)

#### Task 5: contrastValidator pure logic + tests
**Description**: `src/features/theme/logic/contrastValidator.ts` — `getContrastRatio`, `meetsAA` (4.5), `meetsAAA` (7), `meetsAALarge` (3), `getRating`, `validateTheme` (3 pairs: text/canvas, text-secondary/canvas, white/primary).
**Acceptance**:
- [ ] `getContrastRatio('#000','#fff')` = 21
- [ ] `meetsAA(4.5)` true, `meetsAA(4.4)` false
- [ ] `getRating(7.5)` → `{ level:'AAA', ratio:7.5, pass:true }`
- [ ] `validateTheme(config.light)` returns 3 pair results
- [ ] 100% branch coverage
**Verify**: `contrastValidator.test.ts` 100% branches + `npx tsc --noEmit`
**Dependencies**: Task 2 (getLuminance)
**Files**: `src/features/theme/logic/contrastValidator.ts` (new), `src/features/theme/logic/contrastValidator.test.ts` (new)
**Scope**: S

---

### M3: themeManager.applyTheme + system mode

#### Task 6: themeManager (set CSS vars on :root + system mode listener)
**Description**: `src/features/theme/logic/themeManager.ts` — `resolveMode(mode)`, `applyTheme(mode, config)` (set 9 core + derive secondary via colorGenerator on `:root`), system mode `matchMedia` listener.
**Acceptance**:
- [ ] `resolveMode('system')` → 'light'|'dark' via `matchMedia`
- [ ] `applyTheme('dark', config)` → `document.documentElement.style.getPropertyValue('--color-primary')` === config.customColors.dark.primary
- [ ] Secondary derived: `--color-primary-hover` = shade(primary,10%), `--color-border-focus` = primary, `--color-primary-subtle` = rgba(primary,0.1)
- [ ] System mode listener re-apply on `prefers-color-scheme` change
**Verify**: `themeManager.test.ts` (jsdom — assert CSS vars set) + `npx tsc --noEmit`
**Dependencies**: Task 2 (colorGenerator), Task 1 (types)
**Files**: `src/features/theme/logic/themeManager.ts` (new), `src/features/theme/logic/themeManager.test.ts` (new)
**Scope**: S

---

### M4: ThemePanel UI (options page tab "Giao diện")

#### Task 7: ThemePanel shell + ModeCards
**Description**: `src/features/theme/ui/ThemePanel.tsx` + `ModeCards.tsx` + CSS module. 3-card radio (Light/Dark/System), a11y (role=radio, keyboard). Wire to `themeStore.switchMode`.
**Acceptance**:
- [ ] 3 cards render, current mode highlighted
- [ ] Click card → `themeStore.switchMode` called
- [ ] role=radio, keyboard arrow nav
**Verify**: `ThemePanel.test.tsx` + `ModeCards.test.tsx` (render + a11y + interaction) + `npx tsc --noEmit`
**Dependencies**: Task 4 (themeStore), Task 6 (themeManager for live apply)
**Files**: `src/features/theme/ui/ThemePanel.tsx`, `ModeCards.tsx`, `ThemePanel.module.css` (new ×3), `*.test.tsx` (new ×2)
**Scope**: M

#### Task 8: ColorCustomization (9 color pickers per mode, light/dark tabs)
**Description**: `src/features/theme/ui/ColorCustomization.tsx` — accordion, light/dark tabs, 9 color pickers, real-time `themeStore.updateColor`. Debounce 300ms for drag.
**Acceptance**:
- [ ] 9 color pickers per mode tab
- [ ] Pick color → `themeStore.updateColor` called (debounced 300ms)
- [ ] Light/Dark tab switch
**Verify**: `ColorCustomization.test.tsx` + `npx tsc --noEmit`
**Dependencies**: Task 7
**Files**: `src/features/theme/ui/ColorCustomization.tsx`, `.module.css`, `.test.tsx` (new ×3)
**Scope**: M

#### Task 9: ThemePreview + ContrastBadges
**Description**: `ThemePreview.tsx` (buttons, typography, card, form, dropzone, toast — live update) + `ContrastBadges.tsx` (AA/AAA/Fail per pair, tooltip ratio).
**Acceptance**:
- [ ] Preview updates live when color changes
- [ ] ContrastBadges show AA/AAA/Fail per pair, click → tooltip ratio
**Verify**: `*.test.tsx` + `npx tsc --noEmit`
**Dependencies**: Task 5 (contrastValidator), Task 8
**Files**: `ThemePreview.tsx`, `ContrastBadges.tsx`, `.module.css`, `.test.tsx` (new ×4)
**Scope**: M

#### Task 10: ThemeImportExport
**Description**: `ThemeImportExport.tsx` — export JSON (download), copy JSON, import file, paste JSON textarea, apply + validation error surface.
**Acceptance**:
- [ ] Export downloads `.json`, copy to clipboard
- [ ] Import file/paste → validate shape → `themeStore.setConfig` or error surface
- [ ] Invalid JSON (missing customColors) → error message
**Verify**: `ThemeImportExport.test.tsx` + `npx tsc --noEmit`
**Dependencies**: Task 4 (setConfig)
**Files**: `ThemeImportExport.tsx`, `.module.css`, `.test.tsx` (new ×3)
**Scope**: M

---

### M5: Integration popup/sidepanel/content-script + ThemeProvider + themeTokens rewrite

#### Task 11: ThemeProvider + boot popup/sidepanel
**Description**: `src/app/ThemeProvider.tsx` — boot `themeStore.init()` trước render, `applyTheme`, register listeners, render children. Wrap `<App/>` in popup/main.tsx + sidepanel/main.tsx.
**Acceptance**:
- [ ] `ThemeProvider` calls `themeStore.init()` + `applyTheme` before render
- [ ] System mode + storage.onChanged listener registered + cleanup
- [ ] popup + sidepanel wrapped
**Verify**: `ThemeProvider.test.tsx` + `npx tsc --noEmit` + browser MCP (popup no FOUC)
**Dependencies**: Task 6
**Files**: `src/app/ThemeProvider.tsx`, `src/app/ThemeProvider.test.tsx`, `src/entrypoints/popup/main.tsx` (modify), `src/entrypoints/sidepanel/main.tsx` (modify)
**Scope**: M (browser-facing — MCP verify)

#### Task 12: themeTokens.ts rewrite (content-script inject customColors)
**Description**: Rewrite `src/shared/lib/themeTokens.ts` — đọc `themeMode` + `themeConfig.customColors[resolvedMode]` thay vì hardcoded LIGHT/DARK_TOKENS. Inject 9 core + derive secondary via colorGenerator. Backward compat: themeConfig absent → DEFAULT_THEME_CONFIG.
**Acceptance**:
- [ ] Inject đọc customColors từ storage, không fallback hardcoded strings (unless themeConfig absent)
- [ ] `data-theme` set on container = resolvedMode
- [ ] `chrome.storage.onChanged` (themeMode + themeConfig) → re-apply
- [ ] Backward compat: no themeConfig → DEFAULT palette (0 visual regression)
**Verify**: `themeTokens.test.ts` + `npx tsc --noEmit` + **browser MCP edge-devtools** (change color in options → content-script overlay updates no reload)
**Dependencies**: Task 2 (colorGenerator), Task 3 (themeStorage), Task 4 (themeMode key)
**Files**: `src/shared/lib/themeTokens.ts` (rewrite), `src/shared/lib/themeTokens.test.ts` (new/extend)
**Scope**: M (browser-facing — MCP verify stop-the-line)

---

### M6: SettingsDialog theme toggle shortcut + design-system.md update

#### Task 13: SettingsDialog theme toggle → themeStore.switchMode shortcut
**Description**: Modify SettingsDialog theme toggle: trước `settingsStore.set({theme})` → sau `themeStore.switchMode('light'|'dark')` (shortcut, no 'system'). Remove all `settings.theme` references.
**Acceptance**:
- [ ] Toggle calls `themeStore.switchMode`, not `settingsStore.set({theme})`
- [ ] Backward compat: toggle still works (light/dark quick switch)
- [ ] No `settings.theme` references remain (grep clean)
**Verify**: `SettingsDialog.test.tsx` (backward compat) + `npx tsc --noEmit` + browser MCP (popup toggle works)
**Dependencies**: Task 4 (themeStore), Task 11 (ThemeProvider in popup)
**Files**: `src/features/settings/SettingsDialog.tsx` (modify), `*.test.tsx` (extend)
**Scope**: S (browser-facing — MCP verify)

#### Task 14: design-system.md update (F6)
**Description**: Update `docs/design-system/design-system.md` Section 1.1 — mark 9 core tokens "runtime customizable", secondary "stable/derived". Add section "Theme runtime customization".
**Acceptance**:
- [ ] Section 1.1: 9 tokens marked "runtime customizable"
- [ ] New section "Theme runtime customization" (mode, custom palette, WCAG, import/export)
**Verify**: `ls` + read section
**Dependencies**: None (docs only)
**Files**: `docs/design-system/design-system.md` (modify)
**Scope**: S

---

### CP-A: Phase A gate (sau M6)

- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run lint` pass
- [ ] **Browser MCP edge-devtools**: theme switch end-to-end (popup toggle + options ThemePanel + sidepanel + content-script overlay updates no reload)
- [ ] Update `docs/2-architechture-system.md` 3 chỗ (tree, dependency table, function index) — verify by `ls`
- [ ] Commit CP-A

---

## Phase B — Dict (F7-F12)

### M7: IndexedDB schema + repositories + dbHash

#### Task 15: dbHash (onInstall random + getter)
**Description**: `src/shared/lib/storage/dbHash.ts` — `getDbHash()` read `chrome.storage.local.orca.dbHash`, fallback `'devmode0'`. `chrome.runtime.onInstalled` → generate 8-char random → save.
**Acceptance**:
- [ ] `getDbHash()` returns stored hash or 'devmode0'
- [ ] onInstalled generates random 8-char + saves
**Verify**: `dbHash.test.ts` (chromeMock) + `npx tsc --noEmit`
**Dependencies**: None
**Files**: `src/shared/lib/storage/dbHash.ts` (new), `.test.ts` (new)
**Scope**: S

#### Task 16: Dictionary entity types
**Description**: `src/entities/dictionary/types.ts` — `ImportFormat`, `ResourceType`, `ResourceInfo`, `FrequencyEntry`, `DictionaryEntry`.
**Acceptance**: All types exported per ADR-023 module boundaries
**Verify**: `npx tsc --noEmit`
**Dependencies**: None
**Files**: `src/entities/dictionary/types.ts`, `index.ts` (new)
**Scope**: S

#### Task 17: baseRepository (connection + migration v9 create-all)
**Description**: `src/features/dictionary/repositories/baseRepository.ts` — singleton `getDB()`, `getStore`, migration v9 create-all (3 stores + 6 indexes). Add `fake-indexeddb` devDep.
**Acceptance**:
- [ ] `getDB()` returns singleton IDBDatabase
- [ ] Migration v0→v9 creates 3 stores + all indexes
- [ ] DB name `orca-dict-{hash}-en`
**Verify**: `baseRepository.test.ts` + `baseRepository.migration.test.ts` (fake-indexeddb) + `npx tsc --noEmit`
**Dependencies**: Task 15 (dbHash), Task 16 (types). **Add dep `fake-indexeddb`** (ask first — devDep, 0 prod impact)
**Files**: `src/features/dictionary/repositories/baseRepository.ts` (new), `.test.ts`, `.migration.test.ts` (new)
**Scope**: M

#### Task 18: resourceRepository + frequencyRepository + dictionaryRepository
**Description**: 3 repositories extend BaseRepository — CRUD + bulkInsert + findByTerm/Prefix/Suffix + getByResource + countByResource + deleteByResource.
**Acceptance**: All public methods per ADR-023
**Verify**: 3 `*.test.ts` (fake-indexeddb) + `npx tsc --noEmit`
**Dependencies**: Task 17
**Files**: 3 repo files + 3 test files (new)
**Scope**: M

---

### M8: fileDetector + formatDetector + signatureGenerator (pure)

#### Task 19: fileDetector (validate, magic bytes, gunzip, unzip)
**Description**: `src/features/dictionary/logic/fileDetector.ts` — `validateFile` (max 500MB), `readMagicBytes`, `isGzip`/`isZip`/`isSqlite`, `gunzipFile` (fflate), `unzipAll` (fflate), `listZipEntries`, `extractZipFile`. **Add dep `fflate`** (ask first — ~30KB).
**Acceptance**:
- [ ] 500MB+1 reject, 500MB pass
- [ ] Magic bytes detect gzip/zip/sqlite
- [ ] gunzip + unzip work
**Verify**: `fileDetector.test.ts` 100% branches + `npx tsc --noEmit`
**Dependencies**: **Add dep `fflate`**
**Files**: `fileDetector.ts`, `.test.ts` (new)
**Scope**: M

#### Task 20: formatDetector + signatureGenerator
**Description**: `formatDetector.detect(file)` → ImportFormat enum (hybrid magic+ext+zip sniff). `signatureGenerator.compute(file)` → SHA-256(first 1MB)_size_name.
**Acceptance**:
- [ ] Detect 6 formats correctly
- [ ] SHA-256 deterministic, same file = same signature
**Verify**: 2 `*.test.ts` 100% branches + `npx tsc --noEmit`
**Dependencies**: Task 19
**Files**: `formatDetector.ts`, `signatureGenerator.ts`, 2 test files (new)
**Scope**: S

---

### M9: Strategies + factory + importErrors + batch + normalization

#### Task 21: importErrors hierarchy + batchProcessor + normalizationPipeline
**Description**: `importErrors.ts` (ImportError abstract + 7 subclasses + getUserMessage). `batchProcessor.ts` (accumulate + flush at 5000). `normalizationPipeline.ts` (processWord: trim, NFC, lowercase, backwardTerm).
**Acceptance**: All error classes + batch flush at 5000 + normalize correct
**Verify**: 3 `*.test.ts` + `npx tsc --noEmit`
**Dependencies**: Task 16 (types), Task 18 (repos for batch)
**Files**: 3 logic files + 3 test files (new)
**Scope**: M

#### Task 22: baseImportStrategy + baseDictionaryStrategy (template method)
**Description**: `baseImportStrategy.ts` (abstract, template `execute()`) + `baseDictionaryStrategy.ts` (dict variant).
**Acceptance**: Template method flow (parse → transform → batch → flush)
**Verify**: `baseImportStrategy.test.ts` (mock subclass) + `npx tsc --noEmit`
**Dependencies**: Task 21
**Files**: 2 strategy files + 1 test (new)
**Scope**: S

#### Task 23: txtLineStrategy + jsonArrayStrategy
**Description**: 2 strategies — TXT streaming line-by-line (auto-unzip), JSON streaming token-level.
**Acceptance**: Parse correct, streaming (not load full)
**Verify**: 2 `*.test.ts` + `npx tsc --noEmit`
**Dependencies**: Task 22
**Files**: 2 strategy files + 2 test files (new)
**Scope**: M

#### Task 24: yomitanStrategy + cambridgeJsonStrategy
**Description**: Yomitan (unzip, index.json, term_meta_bank sort, 3 freq meta variants). Cambridge (JSON array dict entry).
**Acceptance**: Parse correct per format spec
**Verify**: 2 `*.test.ts` + `npx tsc --noEmit`
**Dependencies**: Task 22
**Files**: 2 strategy files + 2 test files (new)
**Scope**: M

#### Task 25: sqliteStrategy + strategyFactory
**Description**: sqliteStrategy (gunzip → sql.js lazy-load → exec SQL → yield). **Add dep `sql.js`** (ask first — ~1MB wasm lazy). strategyFactory (route JSON → Cambridge if DICTIONARY). Mock wasm load fail → ImportError.
**Acceptance**:
- [ ] Parse `.db.gz` correct
- [ ] wasm load fail → `ImportError(DatabaseError)` (mock fetch fail)
- [ ] Factory routes correct
**Verify**: `sqliteStrategy.test.ts` (mock sql.js + wasm fail) + `strategyFactory.test.ts` + `npx tsc --noEmit`
**Dependencies**: Task 22, Task 19 (fileDetector gunzip). **Add dep `sql.js`** + manifest `web_accessible_resources`
**Files**: `sqliteStrategy.ts`, `strategyFactory.ts`, 2 test files (new), `public/manifest.json` (modify — web_accessible_resources)
**Scope**: M

---

### M10: importOrchestrator (use-case + atomic rollback)

#### Task 26: importOrchestrator + rollbackImport
**Description**: `importOrchestrator.ts` — `importFile(file, langCode, options)`: validate → detect → signature → checkDuplicate → create resource (installationFinished=false) → strategy.execute() → update resource → return result. Error → `rollbackImport(resourceId)` → rethrow. Rollback-during-rollback → RollbackError.
**Acceptance**:
- [ ] Happy path: import TXT → resource created + wordCount
- [ ] Duplicate signature → DuplicateFileError, no resource
- [ ] Strategy error → rollback → rethrow
- [ ] wasm load fail → rollback
- [ ] Cancel mid-batch → rollback partial
- [ ] Rollback-during-rollback → RollbackError
**Verify**: `importOrchestrator.test.ts` (mock strategies + repos) + `npx tsc --noEmit`
**Dependencies**: Task 18, Task 20, Task 25
**Files**: `importOrchestrator.ts`, `.test.ts` (new)
**Scope**: M

---

### M11: ResourcesPanel UI + Options entrypoint + manifest + vite

#### Task 27: Options page entrypoint + vite config + manifest
**Description**: `src/entrypoints/options/` (index.html, main.tsx, OptionsApp.tsx — 3 tab shell). vite.config add options entry. `public/manifest.json` add `options_page`. Wrap in ThemeProvider.
**Acceptance**:
- [ ] `npm run build` bundles options entry
- [ ] manifest has options_page
- [ ] 3 tabs render (Tài nguyên | Giao diện | Cài đặt)
**Verify**: `npm run build` + **browser MCP** (load unpacked, open options, 3 tabs)
**Dependencies**: Task 11 (ThemeProvider), Task 7 (ThemePanel for Giao diện tab)
**Files**: `src/entrypoints/options/index.html`, `main.tsx`, `OptionsApp.tsx` (new), `vite.config.ts` (modify), `public/manifest.json` (modify)
**Scope**: M (browser-facing — MCP verify)

#### Task 28: ResourcesPanel + Dropzone + FilePreview + ResourceCard + ImportProgress + DeleteConfirmModal
**Description**: 6 UI components — ResourcesPanel (2 section dict+frequency), Dropzone (drag-drop + file picker), FilePreview (chip), ResourceCard (list + delete), ImportProgress (bar + cancel), DeleteConfirmModal.
**Acceptance**:
- [ ] Dropzone drag-drop + click file picker
- [ ] Import button → importOrchestrator + progress + cancel
- [ ] ResourceCard list + delete confirm
- [ ] Toast success/error
**Verify**: 6 `*.test.tsx` + `npx tsc --noEmit` + **browser MCP** (import TXT small, assert progress + success + card)
**Dependencies**: Task 26 (orchestrator), Task 27 (options entry)
**Files**: 6 UI files + CSS modules + 6 test files (new)
**Scope**: L (break into 2 commits if needed: Dropzone+FilePreview+ImportProgress, then ResourceCard+DeleteConfirmModal+ResourcesPanel)

---

### M12: Integration smoke + E2E

#### Task 29: Integration smoke test (opt-in)
**Description**: `tests/integration/dictionary.integration.test.ts` — 1 smoke test per format (real IndexedDB, opt-in không chạy default).
**Acceptance**: 5 smoke tests pass (opt-in)
**Verify**: `npm run test:integration -- --testPathPatterns=dictionary`
**Dependencies**: Task 26
**Files**: `tests/integration/dictionary.integration.test.ts` (new)
**Scope**: M

#### Task 30: E2E (Playwright options page)
**Description**: `tests/e2e/` — theme switch + 1 dict import end-to-end.
**Acceptance**: E2E pass
**Verify**: `npm run test:e2e`
**Dependencies**: Task 28
**Files**: `tests/e2e/dict-theme.spec.ts` (new)
**Scope**: M

---

### CP-B: Phase B gate (sau M12)

- [ ] `npm run test:unit` pass
- [ ] `npm run test:integration` pass (opt-in smoke)
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run lint` pass
- [ ] **Browser MCP edge-devtools**: dict import TXT end-to-end (dropzone → progress → success toast → resource card) + theme switch
- [ ] Update `docs/2-architechture-system.md` 3 chỗ — verify by `ls`
- [ ] Commit CP-B

---

## Dependencies graph

```
M1 (Task 1-4) ──→ M2 (Task 5) ──→ M3 (Task 6) ──→ M4 (Task 7-10) ──→ M5 (Task 11-12) ──→ M6 (Task 13-14) ──→ CP-A
                                                                                                              │
M7 (Task 15-18) ──→ M8 (Task 19-20) ──→ M9 (Task 21-25) ──→ M10 (Task 26) ──→ M11 (Task 27-28) ──→ M12 (Task 29-30) ──→ CP-B
```

## New deps (ask first — spec Boundaries)

| Dep | Task | Size | Purpose |
|---|---|---|---|
| `fake-indexeddb` | Task 17 | devDep | repo + migration test |
| `fflate` | Task 19 | ~30KB | gzip + zip decompress |
| `sql.js` | Task 25 | ~1MB wasm lazy | SQLite parse `.db.gz` |

> Check bundle size trước add, report anh. sql.js wasm KHÔNG vào main bundle (lazy fetch web_accessible_resources).

## Verification per task

| Task type | Verify |
|---|---|
| Pure logic | `*.test.ts` 100% branches + `npx tsc --noEmit` |
| Stateful (store, repo) | `*.test.ts` (chromeMock/fake-indexeddb) + `npx tsc --noEmit` |
| UI component | `*.test.tsx` (render + a11y + interaction) + `npx tsc --noEmit` |
| Browser-facing (ThemeProvider, themeTokens, options, manifest) | + **browser MCP edge-devtools** stop-the-line |
| Integration/E2E | `npm run test:integration` / `test:e2e` |

## Commit strategy

- Atomic per task (or 2-3 related small tasks): `feat: M1 theme types + storage + store`, `feat: M2 contrastValidator`, ...
- Docs ≠ code (2 commit nếu touch cả 2 — Task 14 design-system.md riêng)
- CP-A + CP-B = checkpoint commits
- Update `docs/2-architechture-system.md` 3 chỗ trong CP-A/CP-B commit (không rải rác)
