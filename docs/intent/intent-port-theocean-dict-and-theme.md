# G0 Intent — Port Theocean Dictionary + Theme System

> **Source**: `project-reference/import dictioanry and requency list for theocean-extension-dictionary/` (vanilla JS MV3, v3.0.0)
> **Phase**: G0 Discovery (confirmed via `interview-me`)
> **Approach**: G0 → G0.5 mockup (UI features) → G1 spec → G2 plan → G3 ADR → G4 implement. **Theme trước, dict sau** (tuần tự).

---

## Outcome

Port 2 tính năng từ reference `theocean-extension-dictionary` sang cell (React 19 / TS / Vite / @crxjs), **rewrite idiomatic** — không copy y nguyên vanilla JS:

1. **Theme system** (làm trước) — runtime configurable, thay thế `docs/design-system/design-system.md` living doc thành tokens đổi được qua options page.
2. **Import dictionary/frequency** (làm sau) — 5 format → IndexedDB, standalone trong options page. Wire vào subtitle lookup ở G sau (riêng feature).

## User

Publish **Chrome Web Store** → quality bar đầy đủ: WCAG contrast validation, import/export theme JSON, system preference detection. Không phải tool tự dùng tối giản.

## Why now

- Cell đang có `docs/design-system/design-system.md` living doc (DSDS-inspired, 7 sections) nhưng **chưa runtime customizable** — tokens là static dev reference, user không đổi được.
- Cell sẽ mở rộng sang **immersion language learning** (kết hợp video downloader + subtitle) nên cần dict/frequency storage IndexedDB.

## Success criteria

### Theme system
- Light / Dark / System mode + custom color palette (9 tokens/mode: primary, canvas, surface, textPrimary, textSecondary, border, success, error, warning)
- WCAG contrast validation với visual indicators
- Real-time preview với instant updates
- Import/export theme JSON (chia sẻ/sao lưu)
- Reset to default colors
- Persistence qua `chrome.storage.local`
- Smooth CSS transitions khi switch theme
- System preference detection (`prefers-color-scheme`)

### Import dictionary/frequency
- 5 format: TXT (mỗi dòng 1 từ), JSON Array, Yomitan ZIP (`index.json` + `term_meta_bank_*.json`), Migaku SQLite `.db.gz`, Cambridge JSON (dict entry có definition/pronunciation/examples)
- Auto-detect format qua magic bytes + extension
- Streaming parser cho file lớn (≤ 500MB)
- Batch insert IndexedDB 5,000 records/transaction
- Dedupe qua SHA-256 signature (1MB đầu + size + name)
- Atomic rollback khi import fail
- 2 object stores: `langFrequencyEntry` + `langDictionaryEntry`
- Resource management UI (list + delete + metadata)

## Constraint

- **Stack cell**: React 19 + Zustand 5 + TS 6 + Vite 8 + @crxjs + CSS Modules. **Không** port y nguyên vanilla JS — phải rewrite idiomatic (functional components + hooks, named exports, TypeScript strict, colocate tests).
- **Browser-facing change** → verify real Edge/Chrome (MCP `edge-devtools`/`chrome-devtools`) trước commit. Unit + `tsc` necessary but NOT sufficient.
- **Atomic commits**: docs ≠ code (2 commit nếu touch cả 2).
- **Ponytail**: reuse codebase cell trước, stdlib > native platform > installed dep > new dep. `sql.js` (wasm ~1MB+) và `fflate` là dep mới cần check bundle size trước khi add.
- **Update protocol**: add/remove/rename `src/` file → update `docs/2-architechture-system.md` 3 chỗ (tree, dependency table, function index) + verify by `ls`.

## Out of scope (không port đợt này)

- **Wire dict vào subtitle lookup** — G sau, riêng feature (intent mới)
- **i+1 sentence mining** — `IPlusOneSelector`, `SentenceExtractor`, `WordTokenizer` (pure logic có trong reference nhưng chưa wire UI)
- **WordStatus SRS tracking** — `WordStatusRepository`, status flow unknown→tracking→learning→known→ignore
- **Google OAuth + Drive sync** — `AuthService`, `AccountService`, `UserRepository`, `chrome.identity.launchWebAuthFlow`
- **Per-site permission + blacklist** — `PermissionService`, `OptionsBlacklistController`
- **Multi-language profile + tier enforcement** — `ProfileService`, `ProfileRepository`, `LanguageProfileService`, `CONFIG.tierLimits` (reference đang WIP, config thiếu field)
- **Bootstrap download onboarding** — `BootstrapDownloadService`, `OnboardingController` (cell đã có onboarding riêng)
- **TabCoordinationService** — broadcast messaging + dedup (cell đã có `getActiveContentTab` + `tabId` payload pattern riêng)
- **PerformanceMonitor** — metrics infra

## Reference assessment (tóm tắt từ exploration)

| Nhóm | Reference status | Cell port |
|---|---|---|
| Import 5 format | ✅ code đầy đủ, chạy được (trừ `.db.gz` cần sql.js manual) | Port + rewrite TS |
| Theme system | ✅ code đầy đủ, chạy được | Port + rewrite TS, thay DSDS |
| Multi-profile | ⚠️ WIP (`CONFIG.languages`, `tierLimits` thiếu) | Skip |
| Auth Google | ⚠️ WIP (`CONFIG.oauth` thiếu) | Skip |
| i+1 analysis | ✅ pure logic, có test, chưa wire UI | Skip đợt này |
| Per-site permission | ✅ code đầy đủ | Skip (cell có pattern riêng) |

**Lưu ý reference**: có 2 file trùng lặp `BaseRepository.js` + `BaseRepository.refactored.js` — đang giữa refactor chưa finish. Port sang cell chỉ lấy bản `.refactored` (WordStatusRepository + ProfileRepository dùng nó, nhưng 2 repo này out of scope → có thể không cần port BaseRepository).

## Next

- G0.5 mockup (cả 2 feature có UI surface trong options page) → `design-driven-development` skill
- G1 spec → `spec-driven-development` (cite mockup)
- G2 plan → `planning-and-task-breakdown` (cite spec)
- G3 ADR → `system-architecture-design` + `api-and-interface-design` (ADR-022 theme, ADR-023 dict — số tentative)
- G4 implement → theme trước, dict sau
