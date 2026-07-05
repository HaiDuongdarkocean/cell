# Spec: Port Theocean Dictionary + Theme System

> **Phase**: G1 Spec (PRD/SRS)
> **Input**: `docs/intent/intent-port-theocean-dict-and-theme.md` (G0 confirmed)
> **Reference**: `project-reference/import dictioanry and requency list for theocean-extension-dictionary/` (vanilla JS v3.0.0)
> **Approach**: Theme trước (F1-F6), dict sau (F7-F12). Tuần tự, không song song.

---

## Objective

Port 2 tính năng từ reference `theocean-extension-dictionary` sang cell (React 19 / TS / Vite / @crxjs), **rewrite idiomatic** — không copy y nguyên vanilla JS. Cell hiện là video downloader + subtitle translate; mở rộng sang immersion language learning.

### User stories

**US-TH-1** (Theme): Là user cell, em muốn đổi light/dark/system mode + custom 9 core color tokens qua UI, có WCAG contrast validation + import/export theme JSON, để cá nhân hóa giao diện theo sở thích mà vẫn đảm bảo readable.

**US-DI-1** (Dict import): Là user cell học ngôn ngữ, em muốn import frequency list / dictionary từ 5 format (TXT, JSON Array, Yomitan ZIP, Migaku SQLite `.db.gz`, Cambridge JSON) vào IndexedDB qua options page, với auto-detect format + streaming + dedupe + atomic rollback, để có corpus từ vựng cho việc tra từ sau này (wire vào subtitle lookup ở feature sau).

### Why now

- Cell có `docs/design-system/design-system.md` living doc + `theme.css` + `themeTokens.ts` nhưng **chưa runtime customizable** — `settings.theme: 'dark'` chỉ toggle light/dark, không có system mode, không có custom palette, không có WCAG validator, không có import/export.
- Cell sẽ mở rộng sang immersion learning → cần dict/frequency storage IndexedDB (chrome.storage không đủ cho corpus lớn ≤500MB).

---

## Tech Stack

| Khía cạnh | Cell hiện tại | Port thêm |
|---|---|---|
| UI | React 19, Zustand 5, TS 6, Vite 8, @crxjs | (không đổi) |
| Style | CSS Modules + `theme.css` tokens | Theme runtime configurable qua CSS custom properties |
| Storage | chrome.storage.local (settings) | + `chrome.storage.local.themeConfig`/`themeMode` (tách riêng) + IndexedDB `orca-dict-{hash}-en` |
| Dep mới | — | `fflate` (zip/gzip ~30KB), `sql.js` (SQLite wasm ~1MB+, lazy-load chỉ khi import `.db.gz`) |
| Test | Jest 30 (unit + integration) | + `fake-indexeddb` cho dict repo test |

---

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test
Test unit only:   npm run test:unit         # ~3s, day-to-day
Test integration: npm run test:integration  # real m3u8 download + transmux
Test watch:       npm run test:watch        # unit only
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

> Jest 30: dùng `--testPathPatterns=` (không phải `--testPathPattern=`).

---

## Project Structure (target — FSD compliant)

```
src/
├── app/                                # (sẽ thêm) ThemeProvider init ở popup/options/sidepanel
├── stores/
│   └── themeStore.ts                   # (mới) Zustand store: themeMode, themeConfig, actions
├── entrypoints/
│   ├── options/                        # (MỚI) Options page entrypoint
│   │   ├── index.html                  #   Vite entry HTML
│   │   ├── main.tsx                    #   React root
│   │   └── OptionsApp.tsx              #   Tab shell: Tài nguyên | Giao diện | Cài đặt
│   ├── popup/                          # (sửa) áp dụng theme runtime thay vì static theme.css
│   └── sidepanel/                      # (sửa) áp dụng theme runtime
├── features/
│   ├── theme/                          # (MỚI) Theme system feature
│   │   ├── logic/
│   │   │   ├── themeConfig.ts          #   ThemeConfig: 9 core tokens, defaults light/dark
│   │   │   ├── colorGenerator.ts       #   hex↔rgb, luminance, tint/shade, hover derive
│   │   │   ├── contrastValidator.ts    #   WCAG AA/AAA, getRating, validateTheme
│   │   │   ├── themeManager.ts         #   applyTheme (set CSS vars on :root), switchMode, updateColor, reset
│   │   │   └── themeStorage.ts         #   chrome.storage.local themeConfig/themeMode CRUD
│   │   └── ui/
│   │       ├── ThemePanel.tsx          #   Tab "Giao diện": mode cards + accordion colors + preview + import/export
│   │       ├── ThemePanel.module.css
│   │       ├── ModeCards.tsx           #   Light/Dark/System 3-card selector
│   │       ├── ColorCustomization.tsx  #   9 color pickers per mode (light/dark tabs)
│   │       ├── ThemePreview.tsx        #   Real-time preview (buttons, typography, card, form, dropzone, toast)
│   │       ├── ThemeImportExport.tsx   #   Export JSON / copy / import file / paste / apply
│   │       └── ContrastBadges.tsx      #   WCAG AA/AAA/Fail badges per color pair
│   ├── dictionary/                     # (MỚI) Dict/frequency import feature
│   │   ├── logic/
│   │   │   ├── importOrchestrator.ts   #   Main use-case: detect → dedupe → strategy → rollback
│   │   │   ├── formatDetector.ts       #   magic bytes + extension → format enum
│   │   │   ├── fileDetector.ts         #   validate, readMagicBytes, isGzip/isZip/isSqlite, gunzip, unzip
│   │   │   ├── signatureGenerator.ts   #   SHA-256(first 1MB) + size + name
│   │   │   ├── normalizationPipeline.ts #  processWord: trim, NFC, lowercase, backwardTerm
│   │   │   ├── batchProcessor.ts       #   accumulate + flush at batchSize
│   │   │   ├── strategies/
│   │   │   │   ├── baseImportStrategy.ts      # template method: parse() + transformEntry() + execute()
│   │   │   │   ├── baseDictionaryStrategy.ts  # dict variant: DictionaryRepository + rich fields
│   │   │   │   ├── txtLineStrategy.ts
│   │   │   │   ├── jsonArrayStrategy.ts
│   │   │   │   ├── yomitanStrategy.ts
│   │   │   │   ├── sqliteStrategy.ts
│   │   │   │   ├── cambridgeJsonStrategy.ts
│   │   │   │   └── strategyFactory.ts
│   │   │   └── importErrors.ts         #   ImportError hierarchy (Validation/Parse/Database/Rollback/Duplicate)
│   │   ├── repositories/
│   │   │   ├── baseRepository.ts       #   IndexedDB connection (DB name from chrome.storage hash)
│   │   │   ├── resourceRepository.ts   #   langResourceInfo CRUD
│   │   │   ├── frequencyRepository.ts  #   langFrequencyEntry CRUD + findByTerm/Prefix/Suffix
│   │   │   └── dictionaryRepository.ts #   langDictionaryEntry CRUD
│   │   └── ui/
│   │       ├── ResourcesPanel.tsx      #   Tab "Tài nguyên": dict section + frequency section
│   │       ├── ResourcesPanel.module.css
│   │       ├── Dropzone.tsx            #   Reusable dropzone (dict + frequency)
│   │       ├── FilePreview.tsx         #   File chip with name/meta/remove
│   │       ├── ResourceCard.tsx        #   Resource item: name, wordCount, format badge, delete
│   │       ├── ImportProgress.tsx      #   Progress bar + percent + cancel
│   │       └── DeleteConfirmModal.tsx  #   Confirm dialog before delete
│   └── settings/                       # (sửa) SettingsDialog: bỏ theme toggle (đã có ThemePanel riêng)
├── entities/
│   ├── theme/                          # (MỚI) ThemeConfig, ThemeMode, ColorTokens types
│   └── dictionary/                     # (MỚI) ResourceInfo, FrequencyEntry, DictionaryEntry, ImportFormat types
├── shared/
│   ├── lib/
│   │   ├── storage/
│   │   │   └── dbHash.ts               # (MỚI) DB hash init on install, getter
│   │   └── chrome-apis/                # (sửa) + storage.local themeConfig/themeMode helpers nếu cần
│   ├── ui/                             # (sửa) atoms dùng theme tokens runtime (đã dùng var(--color-*), OK)
│   └── config/
│       └── config.ts                   # (sửa) bỏ settings.theme, thêm themeStorage keys
└── types/
manifest.json                           # (sửa) + options_page + web_accessible_resources (sql-wasm.wasm)
```

**Test colocate** (Rule of Three + colocate tests convention):
- `src/features/theme/logic/*.test.ts` — pure logic (colorGenerator, contrastValidator, normalizationPipeline)
- `src/features/theme/ui/*.test.tsx` — component render + interaction
- `src/features/dictionary/logic/*.test.ts` — strategies, detector, signature, batch
- `src/features/dictionary/repositories/*.test.ts` — IndexedDB CRUD với `fake-indexeddb`
- `tests/integration/dictionary.integration.test.ts` — real import flow với real IndexedDB (opt-in, không chạy default)

---

## Code Style

Functional components + hooks, named exports, TypeScript strict, CSS Modules, JSDoc cho public API. Mimic cell patterns:

```ts
// src/features/theme/ui/ThemePanel.tsx
interface ThemePanelProps {
  /** Initial mode to show in preview (controlled by themeStore). */
  initialMode?: ThemeMode;
}
export function ThemePanel({ initialMode }: ThemePanelProps): ReactElement {
  const { mode, config, switchMode, updateColor, resetTheme } = useThemeStore();
  // ...
}
```

```ts
// src/features/dictionary/logic/strategies/baseImportStrategy.ts — template method
export abstract class BaseImportStrategy {
  protected abstract getRepository(): BaseRepository;
  protected abstract transformEntry(raw: RawEntry, index: number): StoredEntry | null;
  protected abstract parse(): AsyncGenerator<RawEntry>;
  async execute(): Promise<ImportResult> { /* template method — subclass không override */ }
}
```

**Conventions**:
- Pure functions cho logic (testable, no side effects) — `colorGenerator`, `contrastValidator`, `normalizationPipeline`, `signatureGenerator`, `formatDetector`
- Class cho stateful orchestrator/repositories/strategies (giữ pattern reference, rewrite TS)
- `@/entities/*` cho types, `@/features/*` cho logic+ui, `@/shared/*` cho infra
- No `any` without justification — dict entries dùng `unknown` + type guard
- Colocate tests: `Button.tsx` → `Button.test.tsx`

---

## Testing Strategy

| Layer | Framework | Location | Coverage |
|---|---|---|---|
| Pure logic (color, contrast, normalize, signature, detect, batch) | Jest 30 | `src/features/*/logic/*.test.ts` | 100% branches cho pure functions |
| Repositories (IndexedDB CRUD) | Jest 30 + `fake-indexeddb` | `src/features/dictionary/repositories/*.test.ts` | All public methods |
| Strategies (parse + transform) | Jest 30 + `fake-indexeddb` | `src/features/dictionary/logic/strategies/*.test.ts` | Each format 1 test file |
| UI components | Jest 30 + Testing Library | `src/features/*/ui/*.test.tsx` | Render + a11y + interaction |
| Integration (real import flow) | Jest 30 (integration project) | `tests/integration/dictionary.integration.test.ts` | 1 smoke test per format (opt-in) |
| E2E (options page) | Playwright | `tests/e2e/` | Theme switch + 1 dict import |

**Test helpers**: `fake-indexeddb` (devDep mới), `chromeMock` (cell đã có pattern trong `tests/utils/`).

**Coverage target**: pure logic 100% branches, repositories 90%+, UI 80%+ (render + key interaction).

---

## Boundaries

### Always do
- Run `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` trước commit
- Browser-facing change (options page, theme apply) → verify real Edge/Chrome (MCP `edge-devtools`) trước commit
- Atomic commits: docs ≠ code (2 commit nếu touch cả 2)
- Update `docs/2-architechture-system.md` 3 chỗ (tree, dependency table, function index) khi add/remove/rename `src/` file — verify by `ls`
- Update `docs/0-wiki.md` mục lục khi add/remove `docs/` file
- Colocate tests theo convention
- Mimic cell patterns (FSD, named exports, CSS Modules, JSDoc)

### Ask first
- Add dependency (fflate, sql.js, fake-indexeddb) — check bundle size trước, report anh
- Modify `manifest.json` (options_page, web_accessible_resources, permissions) — test real Chrome sau
- Bump settings schema version (migration `settings.theme` → `themeMode` tách riêng)
- Change `theme.css` token naming (assumption #1: giữ naming cell, không đổi sang reference)
- Delete `docs/design-system/design-system.md` hoặc rewrite — living doc có thể stale sau port

### Never do
- Commit secrets / `.env`
- Copy y nguyên vanilla JS từ reference — phải rewrite idiomatic TS
- Add `any` without justification comment
- Skip browser verify cho options page / theme apply
- Mix docs + code trong 1 commit

---

## Success Criteria

### Theme system (F1-F6)

**F1 — Theme storage + store** (logic)
- [ ] `chrome.storage.local.themeConfig` (object: `{ mode, customColors: { light: {...}, dark: {...} } }`) + `themeMode` ('light'|'dark'|'system') tách riêng khỏi settings
- [ ] Migration: `settings.theme: 'dark'` (schema v7) → `themeMode: 'dark'` (separate key), bump settings schema v8 (xóa field `theme`)
- [ ] Zustand `themeStore` với actions: `init()`, `switchMode(mode)`, `updateColor(mode, token, hex)`, `setConfig(config)`, `resetTheme()`

**F2 — Theme apply** (logic + infra)
- [ ] `themeManager.applyTheme(mode)`: set 9 core CSS vars trên `:root` (`--color-primary`, `--color-background`, `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-border`, `--color-success`, `--color-warning`, `--color-error`)
- [ ] Derive secondary tokens từ core: `--color-primary-hover` (shade 10%), `--color-surface-hover` (shade 10%), `--color-text-muted` (giữ hoặc derive), `--color-border-subtle`, `--color-border-focus` (= primary), `--color-primary-subtle` (rgba primary 10%)
- [ ] System mode: `prefers-color-scheme` media query + listener, re-apply khi system đổi
- [ ] Applier chạy ở popup + options + sidepanel + content-script (themeTokens.ts inject)
- [ ] Smooth CSS transition 200ms khi switch (color/background-color/border-color)

**F3 — Color generator + contrast validator** (pure logic)
- [ ] `colorGenerator`: `hexToRgb`, `rgbToHex`, `getLuminance`, `generateTint`, `generateShade`, `generateHoverColor` (shade 10%), `generatePalette` (50-950)
- [ ] `contrastValidator`: `getContrastRatio(c1, c2)`, `meetsAA` (4.5:1), `meetsAAA` (7:1), `meetsAALarge` (3:1), `getRating` → `{ level, ratio, pass }`, `validateTheme(colors)` → 3 pairs (text/canvas, text-secondary/canvas, white/primary)
- [ ] 100% branch coverage cho pure functions

**F4 — ThemePanel UI** (options page tab "Giao diện")
- [ ] ModeCards: 3 card (Light/Dark/System) radio + preview + a11y (role=radio, keyboard)
- [ ] ColorCustomization: accordion, light/dark tabs, 9 color pickers per mode, real-time apply
- [ ] ThemePreview: buttons (primary/secondary/disabled), typography (primary/secondary/success/error/warning), card, form+input+switch, dropzone, toast (success/error) — live update khi đổi color
- [ ] ContrastBadges: AA/AAA/Fail badge per pair, click → tooltip ratio
- [ ] ThemeImportExport: export `.json` (download), copy JSON, import file `.json`, paste JSON textarea, apply + validation error surface
- [ ] Reset button → confirm → reset to defaults
- [ ] Persistence: mọi change lưu `chrome.storage.local` ngay (debounce 300ms cho color picker drag)

**F5 — Integration popup/sidepanel/content-script**
- [ ] Popup: boot `themeStore.init()` trước render, áp dụng theme runtime
- [ ] Sidepanel: tương tự popup
- [ ] Content-script: `themeTokens.ts` đọc `themeMode` + `themeConfig` thay vì hardcoded tokens, inject CSS vars vào container
- [ ] `chrome.storage.onChanged` listener: realtime sync giữa options/popup/sidepanel/content-script

**F6 — design-system.md update**
- [ ] Update `docs/design-system/design-system.md` Section 1.1: mark 9 core tokens là "runtime customizable", giữ secondary tokens "stable/derived"
- [ ] Add Section: "Theme runtime customization" (mode, custom palette, WCAG, import/export)

### Dictionary import (F7-F12)

**F7 — IndexedDB schema + repositories** (infra)
- [ ] DB name `orca-dict-{hash8}-en`, hash sinh trên `chrome.runtime.onInstalled` (lưu `chrome.storage.local.orca.dbHash`)
- [ ] 3 object stores: `langResourceInfo` (keyPath `id` auto, indexes: by_signature, by_type, by_order), `langFrequencyEntry` (keyPath `id` auto, indexes: by_resource, by_term, by_backwardTerm), `langDictionaryEntry` (keyPath `id` auto, indexes: by_resource, by_term, by_backwardTerm)
- [ ] `baseRepository`: openDB (singleton promise), getStore, getIndex, txDone, schema migration v1→v9 (giữ migration chain reference)
- [ ] `resourceRepository`: create, getById, getAllOrdered, update, delete, findBySignature, search, updateOrders
- [ ] `frequencyRepository` + `dictionaryRepository`: bulkInsert, findByTerm, findByPrefix, findBySuffix (backwardTerm trick), getByResource (cursor pagination), countByResource, deleteByResource (cascade + progress)
- [ ] Test với `fake-indexeddb`

**F8 — File/format detection + signature** (pure logic)
- [ ] `fileDetector`: validateFile (max 500MB), readMagicBytes, isGzip/isZip/isSqlite, gunzipFile (fflate), unzipAll (fflate), listZipEntries, extractZipFile
- [ ] `formatDetector.detect(file)` → `'TXT_PLAIN'|'TXT_ZIPPED'|'JSON_PLAIN'|'JSON_ZIPPED'|'YOMITAN'|'GZIP_WRAPPED'` (hybrid magic bytes + extension + ZIP content sniff)
- [ ] `signatureGenerator.compute(file)` → `SHA-256(first 1MB)_size_nameWithoutExt`
- [ ] 100% branch coverage

**F9 — Strategies** (template method pattern)
- [ ] `baseImportStrategy`: template method `execute()` (parse → transformEntry → batchProcessor.add → flush), subclass override `parse()` + `transformEntry()` + `getRepository()`
- [ ] `txtLineStrategy`: streaming line-by-line via ReadableStream + TextDecoder, auto-unzip if `.zip`
- [ ] `jsonArrayStrategy`: streaming token-level JSON string-array parse (không load full JSON)
- [ ] `yomitanStrategy`: unzip all, parse `index.json` (metadata), sort `term_meta_bank_*.json`, yield `{term, reading, frequency}` (handle 3 freq meta variants)
- [ ] `sqliteStrategy`: gunzip → load sql.js wasm (lazy, web_accessible_resources) → exec SQL → yield `{term, reading, frequency}` + metadata
- [ ] `cambridgeJsonStrategy`: parse JSON array `[{term, altterm, pronunciation, definition, pos, examples, audio}]` → dict entry
- [ ] `baseDictionaryStrategy`: dict variant (DictionaryRepository + rich fields: definition, pos, examples, audio)
- [ ] `strategyFactory.create(format, file, resourceId, options)` — `options.resourceType === 'DICTIONARY'` route JSON → Cambridge
- [ ] Each strategy 1 test file với fake file content

**F10 — ImportOrchestrator** (use-case)
- [ ] `importFile(file, langCode, options)`: validate → detect → signature → checkDuplicate → create resource (installationFinished=false) → strategy.execute() → update resource (wordCount, installationFinished=true, metadata) → return `{resourceId, format, totalWords, skipped, durationMs}`
- [ ] Atomic rollback: catch error → `rollbackImport(resourceId)` (deleteByResource + resourceService.delete) → rethrow (hoặc RollbackError nếu rollback cũng fail)
- [ ] Progress callback: `onProgress(processed, estimatedTotal)`, `onResourceCreated(resourceId)`
- [ ] Test: mock strategies + repositories, verify rollback path

**F11 — ResourcesPanel UI** (options page tab "Tài nguyên")
- [ ] 2 section: Dictionary (Cambridge JSON/ZIP) + Frequency (TXT/JSON/Yomitan/SQLite)
- [ ] Dropzone: drag-drop + click file picker, multi-file, accept per section, preview chip
- [ ] Import button → ImportOrchestrator.importFile with progress bar + cancel
- [ ] ResourceCard list: name, format badge, wordCount, createdAt, delete button → DeleteConfirmModal
- [ ] Toast: success (wordCount + duration) / error (ImportError.getUserMessage())
- [ ] Empty state: hint text + format help tooltip

**F12 — Options page entrypoint + manifest**
- [ ] `src/entrypoints/options/` (index.html, main.tsx, OptionsApp.tsx) — tab shell 3 tab: Tài nguyên | Giao diện | Cài đặt
- [ ] `manifest.json`: thêm `options_page: "src/entrypoints/options/index.html"`, `web_accessible_resources` cho `sql-wasm.wasm` + `sql-wasm.js`
- [ ] Vite + @crxjs config: thêm options entry
- [ ] Browser verify: load unpacked, mở options page, theme switch + 1 dict import (TXT nhỏ) chạy được

---

## Open Questions

1. **sql.js bundle**: `sql-wasm.wasm` ~1MB+ — lazy load chỉ khi user import `.db.gz`, hay require upfront? Em guess lazy (ponytail: chỉ load khi cần). Cần check `web_accessible_resources` + CSP `wasm-unsafe-eval` (cell CSP hiện tại?).
2. **fflate vs native**: Browser có `DecompressionStream` (gzip native, Chrome 80+). Có nên dùng native thay fflate cho gzip? ZIP native thì không có (cần fflate hoặc JSZip). Em guess: fflate cho cả 2 (consistency, ZIP không có native).
3. **DB hash strategy**: Reference sinh hash random trên install → DB name `orca-dict-{hash}-en`. Cell có nên dùng pattern này không, hay hardcode `orca-dict-en`? Random hash tránh conflict nếu install lại, nhưng phức tạp hơn. Em guess: dùng random hash (giữ reference pattern).
4. **Theme tokens `--color-info`**: Cell có `--color-info` (= primary), reference không có. Giữ hay bỏ? Em guess giữ (cell đang dùng).
5. **SettingsDialog theme toggle**: Hiện tại SettingsDialog có theme toggle (light/dark). Sau port, bỏ toggle này (đã có ThemePanel riêng) hay giữ làm shortcut? Em guess bỏ (single source of truth = ThemePanel).
6. **design-system.md fate**: Living doc hiện tại documents 30+ tokens. Sau port, 9 core tokens runtime configurable. Rewrite doc hay giữ + add section? Em guess giữ + add section (F6).
7. **Migration `settings.theme`**: Field hiện tại `'dark'` default. Migration v7→v8: đọc `settings.theme` → write `themeMode` → delete `settings.theme`. User đã set 'light' giữ nguyên. OK?
8. **i18n**: Reference UI tiếng Việt. Cell UI cũng tiếng Việt (messages.ts). Giữ tiếng Việt hay add i18n layer? Em guess giữ tiếng Việt (cell chưa có i18n, ponytail).

---

## Next

- G2 Plan → `planning-and-task-breakdown` (cite spec này, high-level approach + risk mitigation + milestones)
- G3 ADR → `system-architecture-design` + `api-and-interface-design`
  - ADR-022: Theme system runtime customization (storage tách riêng, 9 core tokens, derive secondary, system mode)
  - ADR-023: Dictionary import IndexedDB schema + strategy pattern + atomic rollback
- G4 Implementation → theme trước (F1-F6), dict sau (F7-F12)
