# Task Breakdown: Refactor System Architecture — Worktree cho Orca Platform

> **Giai đoạn**: G4 Task Breakdown (chi tiết acceptance criteria + verify per task)
> **Input (cite)**: spec `docs/specs/spec-refactor-system-architecture.md` (APPROVED) + plan `docs/plan/plan-refactor-system-architecture.md` + ADR `docs/adr/016-fsd-screaming-architecture-worktree.md`
> **Status**: Draft — implementation sequential M0→M13
> **Date**: 2026-06-30

## Codebase Reality Check (phát hiện khi verify — KHÁC spec, phải xử lý)

1. **`src/types/media.ts` là god-file** (403 dòng): trộn DetectedVideo, M3u8*, TsSegment, DetectedSubtitle, Ass/Vtt/Srt types, Settings, FilenameSource, WhitelistEntry, DownloadItem, DownloadProgress, AutoSelectResult, NetworkRequest. Spec target `entities/{subtitle,video,settings,message,media}` → **M3 phải split media.ts theo domain** (rủi ro import cascade — handle cẩn thận).
2. **`src/types/subtitle.ts`** riêng (overlay-specific: OverlayConfig, TextShadowConfig, SyncStatus, BilingualParseResult) — khác `media.ts` SubtitleFormat. **2 file định nghĩa `SubtitleFormat` khác nhau** (media.ts: 'ass'|'vtt'|'srt'; subtitle.ts: thêm 'ssa'|'unknown') → cẩn thận khi consolidate.
3. **popup dùng `App.redesigned.tsx` + `App.redesigned.module.css`** (không phải `App.tsx`). `main.tsx` import App.redesigned.
4. **`tests/unit/` cấu trúc KHÔNG nhất quán**: subtitle test rải 3 chỗ — `tests/unit/content/`, `tests/unit/subtitleOverlay/`, root (`subtitleDragPosition.test.ts`, `subtitleOverlayLayer.test.ts`, `subtitleStyleApply.test.ts`). Converters ở cả `tests/unit/converters/` lẫn `tests/unit/lib/converters/`. → M12 chuẩn hóa mirror.
5. **Integration test có subtitle**: `subtitleAppearance/ManagerPanel/Selector.integration.test.ts` — import path update khi move subtitle (M7).
6. **`src/constants/` có 3 file**: config.ts, messages.ts, urls.ts (không chỉ config + urls).
7. **`src/background/subtitleService.ts`** → thuộc subtitle feature (service), không phải download.

## Embedded Rules (mỗi task tuân thủ — AGENTS.md)

- **Trước sửa**: đọc `docs/2-architechture-system.md` Bảng phụ thuộc (impact radius).
- **Ponytail PRE-FILTER**: grep mọi caller trước khi move (import path cascade).
- **Move = preserve behavior**: chỉ move + update import + barrel. KHÔNG đổi logic. `git diff --stat` review chỉ move.
- **Verify mỗi task**: `npm run test:unit` + `npx tsc --noEmit`. Build (M9). Browser (M7/M9/M10).
- **Update docs**: `docs/2-architechture-system.md` trong cùng commit structure change.
- **Commit convention**: `refactor: <action> <cluster>` (Q3 resolved).

---

## Phase M0 — Coverage Baseline + Characterization (pre-flight, KHÔNG move)

### Task M0.1: Đo coverage baseline
**Description**: Chạy `npm run test:coverage`, ghi coverage subtitle + transmux + download cluster làm regression net trước refactor.
**Acceptance criteria**:
- [ ] Coverage report generated, lưu `docs/test-reports/coverage-baseline-pre-refactor.md`.
- [ ] Ghi rõ % coverage + uncovered critical behaviors cho: subtitle (overlay/drag/sync/merge), transmux (parallel coordinator/fMP4 merge), download (auto-download dedup).
**Verification**:
- [ ] `npm run test:coverage` exit 0, report file tồn tại.
**Dependencies**: None.
**Files touched**: `docs/test-reports/coverage-baseline-pre-refactor.md` (new).
**Scope**: S.

### Task M0.2: Viết characterization test cho critical behaviors chưa cover
**Description**: Với behavior critical chưa cover (từ M0.1), viết characterization test pin "code ACTUALLY does" (Feathers). Cover threshold = critical behaviors (Q2 resolved), không chase %.
**Acceptance criteria**:
- [ ] Critical behaviors có test pin: subtitle overlay drag math (`calcYOffsetPercent`), sync binary search (`findCurrentLine`), bilingual merge, transmux fMP4 merge (tfdt offset — knowledge `parallel-fmp4-merge.md`), auto-download dedup (knowledge `auto-download-subtitle-catchup.md`).
- [ ] Nếu DOM-heavy không unit-test được → ghi vào baseline doc là "browser-verify-only", reference Edge MCP report.
**Verification**:
- [ ] `npm run test:unit` pass (test mới + cũ).
- [ ] `npx tsc --noEmit` exit 0.
**Dependencies**: M0.1.
**Files touched**: `tests/unit/**` (new characterization tests, ≤5 file).
**Scope**: M.

### Checkpoint A (after M0):
- [ ] Coverage baseline saved, critical behaviors pinned. Anh confirm baseline đủ làm regression net trước khi move.
- [ ] Commit: `test: coverage baseline + characterization tests pre-refactor`.

---

## Phase M1 — Scaffolding

### Task M1.1: Tạo 6 layer folder + cập nhật architecture map
**Description**: Tạo `src/{entrypoints,features,entities,shared,stores,app}/` với `.gitkeep`. Note target structure trong `docs/2-architechture-system.md`.
**Acceptance criteria**:
- [ ] 6 folder tồn tại với `.gitkeep`.
- [ ] `docs/2-architechture-system.md` có section "Target structure (refactor in progress)".
**Verification**:
- [ ] `npm run test:unit` pass (không move gì). `git status` thấy folder.
**Dependencies**: M0.
**Files touched**: `src/{entrypoints,features,entities,shared,stores,app}/.gitkeep`, `docs/2-architechture-system.md`.
**Scope**: S. **Commit**: `refactor: scaffold FSD layer folders`.

---

## Phase M2 — shared/ layer

### Task M2.1: Move lib/parsers/ → shared/lib/parsers/ + 3 stray converters
**Description**: Move 4 parser (`assParser, m3u8Parser, srtParser, vttParser`) + 3 stray converter (`assToSrt, vttToSrt, srtNormalizer` từ `lib/converters/`) → `shared/lib/parsers/`. Tạo barrel `index.ts`.
**Acceptance criteria**:
- [ ] 7 file ở `shared/lib/parsers/`, barrel export.
- [ ] Mọi import của 7 file update sang new path (grep old = 0).
**Verification**:
- [ ] `npm run test:unit` + `npx tsc --noEmit` pass.
- [ ] `git diff --stat` chỉ move + import.
**Dependencies**: M1.
**Files touched**: `src/shared/lib/parsers/*` (7 + barrel), callers (background, content, converters).
**Scope**: M. **Commit**: `refactor: move parsers + srt converters to shared/lib/parsers`.

### Task M2.2: Move lib/storage/ + lib/utils/ (trừ whitelist) + constants/
**Description**: Move `lib/storage/opfsStorage` → `shared/lib/storage/`; `lib/utils/{fileUtils,timeUtils,urlUtils}` (KHÔNG whitelist) → `shared/utils/`; `constants/{config,messages,urls}` → `shared/config/`. Barrel mỗi nhóm.
**Acceptance criteria**:
- [ ] opfsStorage ở `shared/lib/storage/`; 3 util ở `shared/utils/`; 3 constant ở `shared/config/`.
- [ ] `whitelist.ts` GIỮ NGUYÊN ở `lib/utils/` (move ở M5).
- [ ] Import update (grep old = 0).
**Verification**:
- [ ] `npm run test:unit` + `npx tsc --noEmit` pass.
**Dependencies**: M2.1.
**Files touched**: `src/shared/{lib/storage,utils,config}/*` + barrels, callers (nhiều).
**Scope**: L. **Commit**: `refactor: move storage, utils, constants to shared/`.

### Checkpoint B (after M2):
- [ ] shared/ stable, tsc pass, grep old import = 0. No behavior change.

---

## Phase M3 — entities/ layer (HIGH care — split god-file)

### Task M3.1: Split types/media.ts theo domain → entities/{video,settings,media}
**Description**: Split `types/media.ts` (god-file): video types (DetectedVideo, M3u8*, TsSegment, SegmentRange, HlsEncryption, HlsInitSegment, VideoVariant/Format/Quality) → `entities/video/`; Settings + FilenameSource + ConvertToMp4Mode + Parallel*Mode → `entities/settings/`; DownloadItem, DownloadStatus, DownloadProgress, ConversionPhase, MediaType, DetectedSubtitle, AssStyle/Dialogue/Subtitle, Vtt/Srt types, BilingualCue, ShortcutAction, KeyboardShortcut, AutoSelectResult, WhitelistEntry, NetworkRequest → `entities/media/` (giữ chung tạm, split tiếp nếu cần).
**Acceptance criteria**:
- [ ] media.ts split thành ≥3 file domain trong entities/, mỗi domain có barrel.
- [ ] `SubtitleFormat` duplicate (media.ts vs subtitle.ts) — ghi note, KHÔNG consolidate vội (ponytail, để feature M7 quyết).
- [ ] Import update toàn bộ caller (grep `types/media` = 0).
**Verification**:
- [ ] `npx tsc --noEmit` exit 0 (type cascade lớn nhất ở đây).
- [ ] `npm run test:unit` pass.
**Dependencies**: M2.
**Files touched**: `src/entities/{video,settings,media}/*` + barrels, ~30+ caller files.
**Scope**: L (risk cao — split god-file). **Commit**: `refactor: split types/media.ts into entities/{video,settings,media}`.

### Task M3.2: Move types/{message,subtitle}.ts + muxjs.d.ts
**Description**: `types/message.ts` → `entities/message/`; `types/subtitle.ts` → `entities/subtitle/`; `types/muxjs.d.ts` → `src/types/muxjs.d.ts` (giữ global decl ở types/, hoặc `entities/`? — giữ `src/types/` cho ambient .d.ts).
**Acceptance criteria**:
- [ ] message.ts ở `entities/message/`, subtitle.ts ở `entities/subtitle/`, barrel.
- [ ] `muxjs.d.ts` + `vite-env.d.ts` GIỮ ở `src/types/` (ambient declarations).
- [ ] Import update (grep old = 0).
**Verification**:
- [ ] `npx tsc --noEmit` + `npm run test:unit` pass.
**Dependencies**: M3.1.
**Files touched**: `src/entities/{message,subtitle}/*` + barrels, callers.
**Scope**: M. **Commit**: `refactor: move message + subtitle types to entities/`.

### Checkpoint B2 (after M3):
- [ ] entities/ stable, tsc pass (type cascade resolved), grep old type import = 0.

---

## Phase M4 — detection/ feature

### Task M4.1: Move lib/detectors/ → features/detection/logic/
**Description**: Move 4 detector (video, subtitle, script, language) → `features/detection/logic/`. Barrel `features/detection/index.ts`.
**Acceptance criteria**:
- [ ] 4 detector ở `features/detection/logic/`, barrel export public API.
- [ ] Import update (grep `lib/detectors` = 0).
**Verification**:
- [ ] `npm run test:unit` pass (detection test: 38 language profiles, script detection).
- [ ] `npx tsc --noEmit` exit 0.
**Dependencies**: M3.
**Files touched**: `src/features/detection/{logic,index.ts}`, callers (background, content).
**Scope**: M. **Commit**: `refactor: move detectors to features/detection`.

---

## Phase M5 — whitelist/ feature

### Task M5.1: Move lib/utils/whitelist.ts → features/whitelist/
**Description**: Move `whitelist.ts` → `features/whitelist/logic/whitelist.ts`. Tách `whitelistStore.ts` (chrome.storage CRUD) nếu logic+storage trộn. Barrel.
**Acceptance criteria**:
- [ ] whitelist logic ở `features/whitelist/`, barrel.
- [ ] Import update (grep `utils/whitelist` = 0).
**Verification**:
- [ ] `npm run test:unit` pass (whitelist test). `npx tsc --noEmit` exit 0.
**Dependencies**: M4.
**Files touched**: `src/features/whitelist/*`, callers (background, popup).
**Scope**: S. **Commit**: `refactor: move whitelist to features/whitelist`.

---

## Phase M6 — transmux/ feature

### Task M6.1: Move transmux planning + execution modules
**Description**: Move pure planning (`parallelPlanner, segmentGrouping, parallelPolicy`) → `features/transmux/planning/`; execution (`parallelCoordinator, parallelProgress, parallelCancellation, parallelFallback, parallelSafetyAnalyzer, autoEnablement, benchmarkHarness`) → `features/transmux/execution/`. Barrel.
**Acceptance criteria**:
- [ ] Planning + execution module ở đúng folder.
- [ ] Import update (grep `lib/converters/parallel` + `lib/converters/segment` + ... = 0 cho module đã move).
**Verification**:
- [ ] `npm run test:unit` pass (parallel* unit tests). `npx tsc --noEmit` exit 0.
**Dependencies**: M5.
**Files touched**: `src/features/transmux/{planning,execution}/*`, callers (offscreen, background).
**Scope**: L. **Commit**: `refactor: move transmux planning + execution to features/transmux`.

### Task M6.2: Move transmux merging modules + barrel
**Description**: Move merging (`segmentMerger, mp4Validator, conversionTimer, tsTransmuxer, parallelTransmuxer`) → `features/transmux/merging/`. Tạo `features/transmux/index.ts` barrel tổng.
**Acceptance criteria**:
- [ ] Merging module ở `features/transmux/merging/`, barrel tổng export.
- [ ] `workerFactory.ts` move (→ execution hoặc merging tùy dùng). Import update (grep `lib/converters` = 0 hoàn toàn — converters folder rỗng → xóa).
**Verification**:
- [ ] `npm run test:unit` pass. `npx tsc --noEmit` exit 0.
- [ ] **Integration test**: `npm run test:integration` (parallel + sequential m3u8 download + transmux + Web Worker spawn) pass.
**Dependencies**: M6.1.
**Files touched**: `src/features/transmux/{merging,index.ts}`, callers, xóa `src/lib/converters/`.
**Scope**: L. **Commit**: `refactor: move transmux merging to features/transmux + remove lib/converters`.

### Checkpoint C1 (after M6):
- [ ] transmux/ migrated, unit + integration pass (Web Worker spawn OK).

---

## Phase M7 — subtitle/ feature (LARGEST — browser verify)

### Task M7.1: Move subtitle logic + ui modules
**Description**: Move pure logic (`subtitleSync→logic/sync`, `subtitleMerge→logic/merge`, `subtitleBilingualParser→logic/bilingualParser`, `subtitleNaming→logic/naming`, `subtitleParser→logic/parserAdapter`) + ui (`subtitleUI→ui/overlayLayer`, `subtitleDragPosition→ui/dragPosition`, `subtitleSelector→ui/selector`, `subtitlePanel→ui/panelToggle`, `subtitleImport→ui/importButton`, `subtitleTrackDropdown→ui/trackDropdown`, `subtitleManagerPanel→ui/managerPanel`, `subtitleToast→ui/toast`) → `features/subtitle/{logic,ui}/`.
**Acceptance criteria**:
- [ ] 13 module ở `features/subtitle/{logic,ui}/` theo mapping spec.
- [ ] Import update từng file (Parallel Change, test sau mỗi). Grep old `content/subtitle*` = 0 cho module đã move.
**Verification**:
- [ ] `npm run test:unit` pass (subtitle test rải `content/`, `subtitleOverlay/`, root). `npx tsc --noEmit` exit 0.
**Dependencies**: M6.
**Files touched**: `src/features/subtitle/{logic,ui}/*`, callers (content-script, background/subtitleService).
**Scope**: L. **Commit**: `refactor: move subtitle logic + ui to features/subtitle`.

### Task M7.2: Move subtitle service modules + barrel + browser verify
**Description**: Move service (`subtitleOverlay→service/overlay`, `subtitleAutoLoad→service/autoLoad`, `subtitleDragDrop→service/dragDrop`, `subtitleShortcuts→service/shortcuts`) + `background/subtitleService.ts→service/`. Barrel `features/subtitle/index.ts`. `content/` còn `content-script, fetchInterceptor.iife, pageScanner, themeTokens` (move M9).
**Acceptance criteria**:
- [ ] Service module ở `features/subtitle/service/`, barrel tổng.
- [ ] Import update (grep old = 0 cho subtitle modules).
**Verification**:
- [ ] `npm run test:unit` + `npx tsc --noEmit` pass.
- [ ] Integration: `subtitleAppearance/ManagerPanel/Selector.integration.test.ts` pass (import update).
- [ ] **Browser verify (Edge MCP, stop-the-line)**: overlay hiển thị, drag 1:1, select text, bilingual, panel toggle, import. KHÔNG commit nếu fail.
**Dependencies**: M7.1.
**Files touched**: `src/features/subtitle/{service,index.ts}`, callers, integration test imports.
**Scope**: L. **Commit**: `refactor: move subtitle service to features/subtitle + browser verify`.

### Checkpoint C2 (after M7):
- [ ] subtitle/ migrated, unit + integration pass, browser verify pass (overlay/drag/bilingual).

---

## Phase M8 — download/ feature

### Task M8.1: Move download service + selectBestMedia
**Description**: Move `background/{downloader,downloadQueue,autoDownload,networkInterceptor}` → `features/download/service/`; `lib/selectors/selectBestMedia` → `features/download/logic/`. Barrel. chrome.* call GIỮ inline (wrap M11).
**Acceptance criteria**:
- [ ] Download service + logic ở `features/download/`, barrel.
- [ ] Import update (grep old = 0). chrome.* call chưa wrap (đúng — wrap M11).
**Verification**:
- [ ] `npm run test:unit` pass (downloader, downloadQueue, autoDownload, networkInterceptor, selectBestMedia tests). `npx tsc --noEmit` exit 0.
- [ ] Integration: download flow pass.
**Dependencies**: M7.
**Files touched**: `src/features/download/{service,logic,index.ts}`, callers (background/index).
**Scope**: L. **Commit**: `refactor: move download to features/download`.

### Checkpoint C3 (after M8):
- [ ] All features (detection/whitelist/transmux/subtitle/download) migrated. features/ screams domain (NF1).

---

## Phase M9 — entrypoints/ migration (5 sub-commit — HIGHEST risk, build per commit)

### Task M9.1: Move background entry + manifest service_worker
**Description**: Move `background/{index,messageBus,offscreenManager}` → `entrypoints/background/`. Tách handlers theo feature nếu hợp lý (download/subtitle/media-detection/offscreen) — hoặc giữ index.ts monolithic (ponytail, tách sau). Update `manifest.json` `service_worker`.
**Acceptance criteria**:
- [ ] background entry ở `entrypoints/background/`. manifest `service_worker: "src/entrypoints/background/index.ts"`.
- [ ] Import update (grep old = 0).
**Verification**:
- [ ] `npm run build` pass. `npm run test:unit` + `npx tsc --noEmit` pass.
**Dependencies**: M8.
**Files touched**: `src/entrypoints/background/*`, `public/manifest.json`, callers.
**Scope**: M. **Commit**: `refactor: move background to entrypoints + update manifest`.

### Task M9.2: Move content entry (+ fetchInterceptor MAIN world) + manifest content_scripts
**Description**: Move `content/{content-script→index, pageScanner, fetchInterceptor.iife, themeTokens}` → `entrypoints/content/`. Update `manifest.json` `content_scripts[0].js` (content-script) + `content_scripts[1].js` (fetchInterceptor.iife MAIN world).
**Acceptance criteria**:
- [ ] content entry ở `entrypoints/content/`. manifest content_scripts[0] + [1] path update.
- [ ] fetchInterceptor.iife giữ MAIN world + document_start trong manifest.
**Verification**:
- [ ] `npm run build` pass. `npx tsc --noEmit` exit 0.
- [ ] **Browser verify (Edge MCP)**: extension load, content script inject (ISOLATED), fetchInterceptor inject (MAIN world — verify fetch intercept hoạt động).
**Dependencies**: M9.1.
**Files touched**: `src/entrypoints/content/*`, `public/manifest.json`.
**Scope**: M. **Commit**: `refactor: move content scripts to entrypoints + update manifest`.

### Task M9.3: Move offscreen + vite input
**Description**: Move `offscreen/{ffmpeg.html,ffmpegRunner,transmuxWorker}` → `entrypoints/offscreen/`. Update `vite.config.ts` `rollupOptions.input.offscreen`.
**Acceptance criteria**:
- [ ] offscreen ở `entrypoints/offscreen/`. vite input.offscreen path update.
- [ ] transmuxWorker import (Vite worker syntax) update.
**Verification**:
- [ ] `npm run build` pass. Integration test (transmux qua offscreen) pass.
**Dependencies**: M9.2.
**Files touched**: `src/entrypoints/offscreen/*`, `vite.config.ts`.
**Scope**: M. **Commit**: `refactor: move offscreen to entrypoints + update vite input`.

### Task M9.4: Move popup + manifest action.default_popup
**Description**: Move `popup/` → `entrypoints/popup/` (giữ `App.redesigned.tsx` tên — KHÔNG rename, ponytail). Update `manifest.json` `action.default_popup` + vite input nếu có.
**Acceptance criteria**:
- [ ] popup ở `entrypoints/popup/`. manifest action.default_popup = `src/entrypoints/popup/index.html`.
- [ ] index.html script src update sang main.tsx new path.
**Verification**:
- [ ] `npm run build` pass. `npm run test:unit` pass (popup tests). 
- [ ] **Browser verify (Edge MCP)**: popup mở, detect media hiển thị, download button hoạt động.
**Dependencies**: M9.3.
**Files touched**: `src/entrypoints/popup/*`, `public/manifest.json`.
**Scope**: M. **Commit**: `refactor: move popup to entrypoints + update manifest`.

### Task M9.5: Move sidepanel + manifest side_panel + vite input
**Description**: Move `sidepanel/` → `entrypoints/sidepanel/`. Update `manifest.json` `side_panel.default_path` + `vite.config.ts` `rollupOptions.input.sidepanel`.
**Acceptance criteria**:
- [ ] sidepanel ở `entrypoints/sidepanel/`. manifest side_panel + vite input.sidepanel update.
**Verification**:
- [ ] `npm run build` pass. `npm run test:unit` pass (sidepanel tests).
- [ ] **Browser verify (Edge MCP)**: sidepanel mở, cue list hiển thị, seek hoạt động.
**Dependencies**: M9.4.
**Files touched**: `src/entrypoints/sidepanel/*`, `public/manifest.json`, `vite.config.ts`.
**Scope**: M. **Commit**: `refactor: move sidepanel to entrypoints + update manifest + vite`.

### Checkpoint D (after M9) — CRITICAL:
- [ ] 5 entrypoint migrated, manifest/vite update. `npm run build` pass.
- [ ] Browser verify: extension install + core flow (detect/download/subtitle overlay/sidepanel) hoạt động end-to-end.
- [ ] `src/{background,content,offscreen,popup,sidepanel}/` rỗng → xóa.

---

## Phase M10 — settings/ feature

### Task M10.1: Extract settings UI + logic → features/settings/
**Description**: Move `entrypoints/popup/components/settings/{SettingsDialog,MultiSelect,SubtitlePreview,SubtitleStylePanel}` → `features/settings/ui/`. Extract settings validation/migration logic (từ popupStore hoặc config) → `features/settings/logic/`. Barrel. Store GIỮ ở popup (Q2 — chưa tách slice).
**Acceptance criteria**:
- [ ] Settings UI ở `features/settings/ui/`, barrel.
- [ ] Import update (popup App import từ features/settings barrel).
**Verification**:
- [ ] `npm run test:unit` pass (SettingsDialog, MultiSelect, SubtitleStylePanel tests). `npx tsc --noEmit` exit 0.
- [ ] **Browser verify**: settings dialog mở, đổi setting persist.
**Dependencies**: M9.
**Files touched**: `src/features/settings/*`, `src/entrypoints/popup/` callers.
**Scope**: M. **Commit**: `refactor: extract settings to features/settings`.

---

## Phase M11 — chrome-apis/ adapters (incremental wrap)

### Task M11.1: Wrap chrome.storage + chrome.runtime
**Description**: Tạo `shared/lib/chrome-apis/{storage,runtime}.ts` wrap chrome.storage.local/session + chrome.runtime.sendMessage/onMessage. Update callers. Characterization test pin behavior TRƯỚC wrap.
**Acceptance criteria**:
- [ ] storage + runtime adapter, barrel. Callers dùng adapter (không gọi chrome.* trực tiếp ngoài entrypoints).
**Verification**:
- [ ] Adapter test (mock chrome.*) pass. `npm run test:unit` + `npx tsc --noEmit` pass. Browser verify.
**Dependencies**: M10.
**Files touched**: `src/shared/lib/chrome-apis/{storage,runtime}.ts`, callers.
**Scope**: L. **Commit**: `refactor: wrap chrome.storage + runtime in adapters`.

### Task M11.2: Wrap chrome.tabs + downloads + webRequest + offscreen
**Description**: Wrap còn lại vào `shared/lib/chrome-apis/`. Incremental per API. Characterization test trước wrap.
**Acceptance criteria**:
- [ ] tabs/downloads/webRequest/offscreen adapter. Callers update.
- [ ] chrome.* chỉ còn ở `shared/lib/chrome-apis/` + `entrypoints/` (NF3 — grep verify).
**Verification**:
- [ ] Adapter test pass. `npm run test:unit` + `npx tsc --noEmit` + build pass. Browser verify.
**Dependencies**: M11.1.
**Files touched**: `src/shared/lib/chrome-apis/*`, callers.
**Scope**: L. **Commit**: `refactor: wrap remaining chrome.* APIs in adapters`.

---

## Phase M12 — tests/ mirror

### Task M12.1: Chuẩn hóa tests/unit/ mirror src/features/ + entrypoints/
**Description**: Move test mirror new structure: `tests/unit/{converters,lib/converters}` → `tests/unit/features/transmux/`; subtitle test (rải `content/`, `subtitleOverlay/`, root) → `tests/unit/features/subtitle/{ui,logic,service}/`; `detectors` → `features/detection/`; `selectors`+`background` download → `features/download/`; `utils/whitelist` → `features/whitelist/`; `parsers` → `shared/lib/parsers/`; `background/{messageBus,...}` → `entrypoints/background/`.
**Acceptance criteria**:
- [ ] Test colocate mirror src. Không còn test ở root `tests/unit/` (subtitleDragPosition, subtitleOverlayLayer, subtitleStyleApply move vào features/subtitle).
- [ ] Import path test update (grep old src path = 0).
**Verification**:
- [ ] `npm run test:unit` pass. Coverage không giảm so M0 baseline.
**Dependencies**: M11.
**Files touched**: `tests/unit/**` (move + import update, nhiều file).
**Scope**: L. **Commit**: `refactor: mirror test structure to match src/features`.

### Task M12.2: Update integration test import paths
**Description**: Update import path 6 integration test (compare, parallel, sequential, subtitleAppearance, subtitleManagerPanel, subtitleSelector) theo new src structure.
**Acceptance criteria**:
- [ ] Integration test import update (grep old src path = 0).
**Verification**:
- [ ] `npm run test:integration` pass.
**Dependencies**: M12.1.
**Files touched**: `tests/integration/*`.
**Scope**: M. **Commit**: `refactor: update integration test import paths`.

---

## Phase M13 — Final cleanup + docs + full regression

### Task M13.1: Cleanup empty folders + update architecture map + wiki
**Description**: Xóa old empty folder (`src/lib/`, etc). Update `docs/2-architechture-system.md` full new structure (file index + dependency + data flow). Update `docs/0-wiki.md` mục lục.
**Acceptance criteria**:
- [ ] `Get-ChildItem -Recurse src` diff target structure = 0 unaccounted.
- [ ] `docs/2-architechture-system.md` phản ánh new structure (NF6). `docs/0-wiki.md` update.
**Verification**:
- [ ] `npm run test:unit` + `npx tsc --noEmit` pass.
**Dependencies**: M12.
**Files touched**: `docs/2-architechture-system.md`, `docs/0-wiki.md`, xóa empty folders.
**Scope**: M. **Commit**: `docs: update architecture map for FSD structure`.

### Task M13.2: Full regression + E2E
**Description**: Chạy full regression suite + E2E Playwright. Verify tất cả Success Criteria.
**Acceptance criteria**:
- [ ] F1-F6, NF1-NF6, P1-P3 (spec §Success Criteria) verified.
- [ ] NF3 grep: chrome.* chỉ ở shared/lib/chrome-apis + entrypoints. NF1 grep: không technical prefix phẳng trong features/.
**Verification**:
- [ ] `npm run test:unit` + `npm run test:integration` + `npx tsc --noEmit` + `npm run build` pass.
- [ ] **Browser verify (Edge MCP)**: full flow. **E2E (Playwright)**: `npm run test:e2e` pass.
**Dependencies**: M13.1.
**Files touched**: None (verification only).
**Scope**: M. **Commit**: `test: full regression pass post-refactor` (nếu có test fix).

### Checkpoint E (after M13) — COMPLETE:
- [ ] Full regression pass (unit + integration + tsc + build + browser + E2E).
- [ ] All Success Criteria met. Ready for G5/merge.

---

## Summary

| Phase | Tasks | Scope | Commit | Risk |
|---|---|---|---|---|
| M0 | M0.1-M0.2 | S+M | 1 | coverage gap |
| M1 | M1.1 | S | 1 | low |
| M2 | M2.1-M2.2 | M+L | 2 | medium |
| M3 | M3.1-M3.2 | L+M | 2 | **HIGH (split god-file)** |
| M4 | M4.1 | M | 1 | low |
| M5 | M5.1 | S | 1 | low |
| M6 | M6.1-M6.2 | L+L | 2 | medium (Worker) |
| M7 | M7.1-M7.2 | L+L | 2 | **HIGH (largest + browser)** |
| M8 | M8.1 | L | 1 | medium |
| M9 | M9.1-M9.5 | M×5 | 5 | **CRITICAL (manifest/build)** |
| M10 | M10.1 | M | 1 | low |
| M11 | M11.1-M11.2 | L+L | 2 | medium (wrap) |
| M12 | M12.1-M12.2 | L+M | 2 | medium |
| M13 | M13.1-M13.2 | M+M | 2 | low |
| **Total** | **25 task** | | **~25 commit** | |

## References

- **Spec**: `docs/specs/spec-refactor-system-architecture.md`
- **Plan**: `docs/plan/plan-refactor-system-architecture.md`
- **ADR**: `docs/adr/016-fsd-screaming-architecture-worktree.md`
- **Architecture map**: `docs/2-architechture-system.md`
- **Knowledge (behavior pin)**: `parallel-fmp4-merge.md`, `auto-download-subtitle-catchup.md`, `subtitle-language-detection.md`, `tab-scoping-popup-leak.md`
