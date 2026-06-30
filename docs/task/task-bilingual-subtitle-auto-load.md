# Task List — Bilingual Subtitle Auto-Load

> Output của `planning-and-task-breakdown` chạy ở **G4 đầu** (sau Spec G2 + ADR G3).
> Input: `docs/specs/spec-bilingual-subtitle-auto-load.md` (PRD) + `docs/adr/007-bilingual-subtitle-auto-load.md` (architecture decisions).
> Feasibility (G1 output): `docs/plan/plan-bilingual-subtitle-auto-load.md`.

## Task List

### Phase 1: Foundation (types + settings)

#### Task 1: Settings type + default + migration
**Description**: Thêm `subtitleOverlayNativeLanguage: string`. Default mới = `''` (empty). Migration: nếu settings cũ chưa có field → fill `'vi'` (backward compat cho Anh yêu). Đồng thời normalize `subtitleOverlayTargetLanguage` về ISO 639-1 hợp lệ; nếu không hợp lệ → reset `''`.
**Acceptance criteria** (Spec F1):
- [ ] `Settings` interface có `subtitleOverlayNativeLanguage`
- [ ] `DEFAULT_SETTINGS.subtitleOverlayNativeLanguage = ''`
- [ ] Migration fill `'vi'` khi field missing
- [ ] Migration normalize invalid target language code
- [ ] `npx tsc --noEmit` pass
**Verification**: `npm run test:unit` + `npx tsc --noEmit`
**Dependencies**: None
**Files likely touched**:
- `src/types/media.ts`
- `src/constants/config.ts`
- `src/popup/store/popupStore.ts`
**Estimated scope**: S (3 files)

#### Task 2: Settings UI — 2 CustomSelect
**Description**: Thay text input bằng 2 `CustomSelect` single-select: "Overlay target language" + "Overlay native language". Reuse `SUBTITLE_LANGUAGES` (bỏ option `all`). Giữ toggle auto-load.
**Acceptance criteria** (Spec F1):
- [ ] 2 `CustomSelect` hiển thị: target + native (cả 2 default `''`)
- [ ] Option `all` bị loại
- [ ] Text input cũ xóa
- [ ] `npx tsc --noEmit` pass
**Verification**: `npm run test:unit` + browser MCP
**Dependencies**: Task 1
**Files likely touched**:
- `src/popup/components/settings/SettingsDialog.tsx`
**Estimated scope**: S (1 file)

### Checkpoint: Foundation
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Settings UI hiển thị 2 dropdown

### Phase 2: Background (decision layer)

#### Task 3: Mở rộng `findSubtitleForOverlay` → `findSubtitlesForOverlay`
**Description**: Trả target + native (không candidates ở V1). V1 chọn sub đầu tiên khớp mỗi language. Refactor callers (1-2 chỗ).
**Acceptance criteria** (Spec F2):
- [ ] `findSubtitlesForOverlay(subtitles, settings)` trả `{ target, native } | null`
- [ ] Khi autoLoad off → null
- [ ] Khi cả 2 language empty → null
- [ ] **Không null khi chỉ 1 language set** (trả sub khớp, sub kia = null → partial load)
- [ ] Unit test cover: cả 2 có, chỉ target, chỉ native, không có, autoLoad off, cả 2 language empty
**Verification**: `npm run test:unit`
**Dependencies**: Task 1
**Files likely touched**:
- `src/background/subtitleService.ts`
- `tests/unit/subtitleService.test.ts`
**Estimated scope**: S (2 files)

#### Task 4: Message + handler `AUTO_LOAD_SUBTITLES` + `REQUEST_AUTO_LOAD_SUBTITLES`
**Description**: Thêm 2 message types. Background push `AUTO_LOAD_SUBTITLES` xuống content-script khi `PAGE_SCAN_RESULT` đến + autoLoad on + có sub khớp. Handler `REQUEST_AUTO_LOAD_SUBTITLES` đọc detected media từ `session_media` (survive SW restart) → re-push khi content-script init xong.
**Acceptance criteria** (Spec F3, F10):
- [ ] `AUTO_LOAD_SUBTITLES` type + `AutoLoadSubtitlesPayload`
- [ ] `REQUEST_AUTO_LOAD_SUBTITLES` type
- [ ] Background push khi sub detect + autoLoad on
- [ ] Background re-push khi content-script request (đọc từ `session_media`)
- [ ] Skip push khi null
- [ ] `npx tsc --noEmit` pass
**Verification**: `npm run test:unit` + `npx tsc --noEmit`
**Dependencies**: Task 3
**Files likely touched**:
- `src/types/message.ts`
- `src/background/index.ts`
- `src/constants/messages.ts` (nếu cần)
**Estimated scope**: M (3 files)

### Checkpoint: Background
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Background push + re-push hoạt động

### Phase 3: Content-script (display layer)

#### Task 5: `subtitleMerge.ts` — merge cho panel
**Description**: Pure function `mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[]`. Target xương, native best-effort overlap tại `cue.start`. **Target rỗng → fallback native xương** (panel vẫn list để click seek native). Empty cả 2 → trả `[]`.
**Acceptance criteria** (Spec F6):
- [ ] Pure function testable
- [ ] Target xương + native best-effort
- [ ] Target rỗng → fallback native xương
- [ ] Unit test cover: perfect match, lệch timestamp, target > native, native > target, empty target, empty native, empty cả 2
**Verification**: `npm run test:unit`
**Dependencies**: None
**Files likely touched**:
- `src/content/subtitleMerge.ts`
- `tests/unit/subtitleMerge.test.ts`
**Estimated scope**: S (2 files)

#### Task 6: `subtitleUI.ts` + overlay controller — 2 dòng runtime align
**Description**: Overlay có 2 span (target + native). Controller runtime align: mỗi `timeupdate` tìm cue target active + native active độc lập (2 binary search `findCurrentLine`). Giữ `loadCues` cũ cho drag-drop.
**Acceptance criteria** (Spec F5):
- [ ] 2 span trong overlay (`data-testid="overlay-target"` + `data-testid="overlay-native"`)
- [ ] `loadBilingualCues(targetCues, nativeCues)` hoạt động
- [ ] Khi chỉ có 1 sub → 1 dòng hiển thị
- [ ] `loadCues` cũ không phá (drag-drop flow)
- [ ] Unit test cover: runtime align, chỉ target active, chỉ native active, cả 2 active, không có cue active
**Verification**: `npm run test:unit` + browser MCP
**Dependencies**: Task 5
**Files likely touched**:
- `src/content/subtitleOverlay.ts`
- `src/content/subtitleUI.ts`
- `tests/unit/subtitleOverlay.test.ts`
**Estimated scope**: M (3 files)

#### Task 7: Content-script cache + auto-load listener
**Description**: Cache `Map<URL, { cues, format }>` theo URL trong tab session. Listen `AUTO_LOAD_SUBTITLES`. Fetch (nếu chưa cache) + parse target + native (SRT/VTT/ASS; ASS → `assToSrt`). Load overlay + panel. **Re-render toàn bộ khi sub thứ 2 đến** (không accumulate cross-flow). Đăng ký `REQUEST_AUTO_LOAD_SUBTITLES` khi init. Cache clear khi content-script re-inject (tab navigate).
**Acceptance criteria** (Spec F4, F7, F8):
- [ ] Cache theo URL, không re-fetch khi đã cache
- [ ] Re-render toàn bộ khi sub thứ 2 đến (không mất sub đầu)
- [ ] Auto-load + drag-drop độc lập, ai đến sau override
- [ ] Request re-push khi init
- [ ] Hỗ trợ SRT/VTT/ASS (ASS → `assToSrt`, fail → skip + toast)
- [ ] Error handling: toast, không crash
- [ ] `npx tsc --noEmit` pass
**Verification**: `npm run test:unit` + browser MCP
**Dependencies**: Task 4, Task 6
**Files likely touched**:
- `src/content/content-script.ts`
- `src/content/subtitleOverlay.ts` (nếu cần helper)
**Estimated scope**: M (2 files)

#### Task 8: CORS fallback + relative URL resolve
**Description**: Content-script fetch fail (CORS/403) → gửi `FETCH_SUBTITLE_CONTENT` (kèm `tabUrl` để background resolve relative URL). Background fetch trong SW (cross-origin allowed với host permission, nhưng không có page cookie context). Vẫn fail → toast error. Ponytail: V1 chấp nhận 2 layer (content-script → SW), offscreen V2 nếu demand.
**Acceptance criteria** (Spec F9, A7):
- [ ] Content-script detect fetch error (CORS/403)
- [ ] Request background `FETCH_SUBTITLE_CONTENT` (kèm `tabUrl`)
- [ ] Background resolve relative URL từ `tabUrl` trước khi fetch
- [ ] Background fetch trả text content
- [ ] Fallback toast error nếu vẫn fail (không crash)
- [ ] `npx tsc --noEmit` pass
**Verification**: `npm run test:unit` + browser MCP
**Dependencies**: Task 7
**Files likely touched**:
- `src/content/content-script.ts`
- `src/background/index.ts`
- `src/types/message.ts`
**Estimated scope**: M (3 files)

### Checkpoint: Content-script
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Browser MCP: auto-load 2 sub, partial load, re-trigger, CORS fallback

### Phase 4: Verification

#### Task 9: Browser MCP test + report
**Description**: Real Chrome test. Verify tất cả acceptance criteria A1–A7 trong Spec.
**Acceptance criteria** (Spec A1–A7):
- [ ] A1: auto-load 2 sub → overlay 2 dòng + panel song ngữ
- [ ] A2: chỉ target → 1 dòng; native đến sau → ghép bổ sung
- [ ] A3: chỉ native → 1 dòng native
- [ ] A4: tắt auto-load → không auto-load
- [ ] A5: drag-drop bilingual SRT → flow cũ không phá
- [ ] A6: 2+ sub cùng target lang → chọn sub đầu tiên
- [ ] A7: CORS fail → background fetch fallback → vẫn load; vẫn fail → toast
- [ ] Test report lưu `docs/test-reports/<date>-bilingual-subtitle-auto-load-mcp.md`
- [ ] Screenshots overlay + panel
- [ ] Console clean
**Verification**: MCP browser test report
**Dependencies**: Task 8
**Files likely touched**:
- `docs/test-reports/<date>-bilingual-subtitle-auto-load-mcp.md`
**Estimated scope**: S (1 file)

#### Task 10: Update architecture docs
**Description**: Update `docs/2-architechture-system.md` 3 chỗ (cây thư mục + bảng phụ thuộc + function index). Update `docs/0-wiki.md` mục lục.
**Acceptance criteria**:
- [ ] Cây thư mục src/ khớp `ls src/content/` + `ls src/background/`
- [ ] Bảng phụ thuộc mới (file mới + dependency mới)
- [ ] Function index mới (`findSubtitlesForOverlay`, `mergeCuesForPanel`, `loadBilingualCues`)
- [ ] `docs/0-wiki.md` mục lục update
**Verification**: `ls src/content/` + `ls src/background/` + review docs
**Dependencies**: Task 9
**Files likely touched**:
- `docs/2-architechture-system.md`
- `docs/0-wiki.md`
**Estimated scope**: S (2 files)

### Checkpoint: Complete
- [ ] Tất cả task completed
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run lint` pass
- [ ] Browser MCP pass
- [ ] ADR + docs updated
- [ ] Ready for review
