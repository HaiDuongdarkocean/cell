# ADR-007: Bilingual Subtitle Auto-Load — Runtime Align + Pre-Merge, Background Push, V1 No Dropdown

## Status
Proposed

## Context
Feature bilingual subtitle auto-load (intent: `docs/intent/intent-bilingual-subtitle-auto-load.md`, plan: `docs/plan/plan-bilingual-subtitle-auto-load.md`) cần:
- Auto-load 2 subtitle riêng biệt (target = ngôn ngữ đang học, native = vi) khi vào trang có video
- Hiển thị cả 2 dòng trên overlay + panel sidebar song ngữ
- Settings: 2 dropdown chọn target + native language
- Tự động khi vào trang, không cần thao tác manual

**Current state (AS-IS):**
- `findSubtitleForOverlay(subtitles, settings)` trả 1 sub khớp target language
- `SubtitleOverlayController.loadCues(cues)` load 1 bộ `SrtCue[]`, overlay 1 span
- `parseBilingualSrt(content)` parse 1 file SRT interleaved (target lẻ / native chẵn) → `BilingualCue[]`
- Panel list `BilingualCue[]` từ 1 file bilingual
- Settings: `subtitleOverlayTargetLanguage: string` (text input) + `subtitleOverlayAutoLoad: boolean`

**Constraints:**
- Chrome MV3: content-script isolated world, không có `chrome.tabs`, fetch từ page origin
- Background SW ephemeral: state mất khi SW kill → persist chrome.storage
- Ponytail: reuse `BilingualCue` interface, không phá flow `parseBilingualSrt` cũ
- Browser-facing code: phải verify bằng MCP/Playwright, không chỉ unit test

**Forces (trade-off):**
- Runtime align (overlay) vs pre-merge (panel): 2 strategy cho 2 view, có thể không đồng bộ trong khoảng lệch timestamp
- Background push vs content-script poll: background biết settings + detected media, content-script biết DOM
- Dropdown multi-sub vs chọn sub đầu tiên: dropdown giải quyết edge case 2+ sub cùng lang, nhưng scope creep
- CORS: content-script fetch từ page origin có thể fail (403/CORS), cần fallback
- Hardcode default `vi` vs empty: `vi` tiện cho Anh yêu, nhưng sai cho user khác

## Decision

### D1: Runtime align cho overlay, pre-merge cho panel (dual strategy)
- **Overlay**: mỗi `timeupdate` tìm cue target active + cue native active độc lập (2 binary search dùng `findCurrentLine` từ `subtitleSync.ts`). Hiển thị 2 dòng (target trên, native dưới). Khi 1 sub thiếu → 1 dòng rỗng.
- **Panel**: pre-merge 2 bộ `SrtCue[]` → `BilingualCue[]` (target làm xương, native best-effort overlap tại `cue.start`). Render list 1 lần, click seek. **Khi target rỗng → fallback native xương** (panel vẫn list để click seek native — không để panel trống khi user vẫn có sub native).

**Rationale**: Overlay cần phản ứng real-time với `currentTime` → runtime align đơn giản nhất (không merge logic phức tạp). Panel cần list tĩnh (render 1 lần, click seek) → pre-merge để có `BilingualCue[]` thống nhất với interface hiện có. Fallback native xương khi target rỗng — user vẫn cần click seek native.

**Trade-off chấp nhận**: Trong khoảng lệch timestamp giữa 2 sub, overlay và panel có thể không đồng bộ (overlay hiển thị native cue 4, panel highlight target cue 5 ghép native cue 4). Đây là intentional — sub từ 2 nguồn khác nhau, lệch nhẹ là mặc định.

### D2: Background push `AUTO_LOAD_SUBTITLES`, content-script request re-push
- Background nhận `PAGE_SCAN_RESULT` → gọi `findSubtitlesForOverlay` → push `AUTO_LOAD_SUBTITLES` xuống content-script (kèm target + native URL).
- Content-script khi init xong gửi `REQUEST_AUTO_LOAD_SUBTITLES` → background re-push nếu sub đã detect (xử lý race condition: background push trước content-script ready).
- **`REQUEST_AUTO_LOAD_SUBTITLES` handler** đọc detected media từ session storage (`session_media` key, survive SW restart — đã có pattern trong `BackgroundService.performSessionRestore`) → re-run `findSubtitlesForOverlay` → re-push. Không phụ thuộc in-memory `mediaMap` (SW ephemeral).

**Rationale**: Background là nơi duy nhất biết settings + detected media (network interceptor). Content-script chỉ biết DOM. Tách rõ: background quyết định "load cái nào", content-script quyết định "hiển thị thế nào". Pattern nhất quán với MV3 hiện có. Session storage survive SW restart → re-push reliable.

### D3: V1 không dropdown multi-sub — chọn sub đầu tiên khớp
- Khi 2+ sub cùng target language → chọn sub đầu tiên khớp (deterministic, first-match).
- Dropdown overlay cho user chọn sub mong muốn = **V2** (future).

**Rationale**: Dropdown thêm UI complexity (trigger, position, persist preference, re-fetch khi chọn). Edge case 2+ sub cùng lang hiếm. V1 ship nhanh, validate demand, V2 thêm nếu cần.

### D4: CORS fallback — content-script fetch fail → background fetch
- Content-script fetch sub URL từ page origin. Nếu fail (CORS/403) → gửi message `FETCH_SUBTITLE_CONTENT` lên background (kèm `tabUrl` để background resolve relative URL).
- Background fetch bằng `fetch()` trong SW (cross-origin allowed với host permission `<all_urls>`). Background resolve relative URL từ `tabUrl` trước khi fetch.
- **SW fetch không có page cookie context** — SW fetch với extension origin, không gửi cookie của page origin. Netflix/YouTube sub URL cần cookie + referer → SW fetch vẫn có thể fail.
- Vẫn fail → toast error, không crash. Ponytail: V1 chấp nhận CORS fallback 2 layer (content-script → SW). Offscreen document fetch với `credentials: 'include'` là **V2** nếu demand (offscreen có extension origin, vẫn có thể fail cho strict CORS — ROI thấp cho V1).

**Rationale**: Content-script fetch bị CORS restrict theo page origin. Background SW có host permission → fetch cross-origin được (nhưng không có cookie). Fallback 2 layer giải quyết đa số case (public sub). Sub cần credentials (Netflix/YouTube) → V1 chấp nhận fail + toast, V2 offscreen nếu demand.

### D5: Content-script cache parsed cues theo URL
- Cache `Map<URL, { cues: SrtCue[], format: string }>` trong tab session.
- Khi `AUTO_LOAD_SUBTITLES` re-trigger (SPA lazy-load) → check cache, không re-fetch/re-parse nếu URL đã load.
- Cache clear khi tab navigate (content-script re-inject).

**Rationale**: `PAGE_SCAN_RESULT` có thể fire nhiều lần (SPA load từng phần). Re-fetch + re-parse cùng sub URL = waste network + CPU. Cache đơn giản giải quyết.

### D6: Default native language = `''` (empty), migration fill `'vi'` cho existing users
- `DEFAULT_SETTINGS.subtitleOverlayNativeLanguage = ''` (empty → không auto-load native).
- Migration trong `popupStore.loadPersistedSettings`: nếu settings cũ thiếu field → fill `'vi'` (backward compat cho Anh yêu — user hiện tại).
- Migration normalize `subtitleOverlayTargetLanguage` về ISO 639-1 hợp lệ; nếu không hợp lệ → reset `''`.

**Rationale**: Hardcode `vi` cho tất cả user = sai cho user học zh/ja/ko với native en. Empty default + migration fill `'vi'` cho existing = backward compat + forward flexible.

### D7: 2 flow song song — giữ `parseBilingualSrt` + thêm auto-load 2 file
- Drag-drop/import 1 file bilingual SRT → vẫn dùng `parseBilingualSrt` (cũ, không sửa).
- Auto-load 2 file riêng → fetch + parse 2 sub → `loadBilingualCues(targetCues, nativeCues)` (mới) + `mergeCuesForPanel` (mới).
- **Auto-load và drag-drop là 2 flow độc lập** — ai đến sau override overlay + panel, không accumulate cross-flow.
- **Auto-load hỗ trợ SRT/VTT/ASS** — ASS → convert sang SRT (reuse `assToSrt`). Convert fail → toast error, skip sub đó.
- **Sub URL relative** — content-script resolve theo page origin. Background `FETCH_SUBTITLE_CONTENT` handler resolve từ `tabUrl` + relative URL trước khi fetch.

**Rationale**: Không phá flow đã test. Reuse `BilingualCue` interface cho panel. Ponytail rung 2 (reuse codebase). 2 flow độc lập đơn giản hơn accumulate cross-flow.

### D8: Security — không log full subtitle URL
- Log chỉ language + format + cue count.
- Sub URL có thể chứa token (signed URL) → không leak vào console/log.

**Rationale**: Subtitle URL từ Netflix/YouTube có thể chứa signed token. Log full URL = leak credential vào console.

## Consequences

### Positive
- Overlay phản ứng real-time, panel render 1 lần — đúng characteristic mỗi view.
- Background/content-script tách rõ, nhất quán MV3 pattern.
- V1 ship nhanh không dropdown, validate demand trước V2.
- CORS fallback 2 layer → sub load được đa số case.
- Cache dedup → không waste network/CPU.
- Default empty + migration → forward flexible.
- 2 flow song song → không phá flow cũ.

### Negative
- Overlay + panel có thể không đồng bộ trong khoảng lệch timestamp (intentional, chấp nhận).
- V1 không dropdown → user không chọn sub khi 2+ sub cùng lang (chấp nhận first-match).
- CORS fallback thêm 1 message round-trip khi fail (latency +1 round-trip trong error case).
- Cache trong tab session → memory grow nếu nhiều sub URL (low risk, sub text nhỏ).
- 2 flow song song → code duplication nhẹ (drag-drop + auto-load cùng dùng `BilingualCue` nhưng parser khác).

### Neutral
- Migration fill `'vi'` cho existing users — Anh yêu không thấy khác biệt, user mới phải set native.
- `REQUEST_AUTO_LOAD_SUBTITLES` thêm 1 message type — không đáng kể.

## Alternatives Considered

### A1: Pre-merge cho cả overlay + panel (1 strategy)
- Merge 2 bộ cues → `BilingualCue[]` trước, overlay + panel cùng dùng.
- **Rejected**: Overlay cần phản ứng real-time với `currentTime`. Pre-merge với native best-effort tại `cue.start` → overlay hiển thị native cue đã ghép, không phải native cue active tại `currentTime` thực. Sai semantic cho overlay.

### A2: Runtime align cho cả overlay + panel (1 strategy)
- Panel không pre-merge, runtime tìm cue active cho panel highlight.
- **Rejected**: Panel cần list tĩnh (render 1 lần, click seek). Runtime align cho panel = không có list để render (cue target + cue native có số lượng/index khác nhau). Phải list 2 bộ riêng (2 cột) → UI phức tạp hơn (rejected ở interview Q5).

### A3: Content-script tự đọc settings + tự fetch (không qua background)
- Content-script đọc `chrome.storage.local` trực tiếp, tự fetch sub.
- **Rejected**: Content-script không biết settings thay đổi khi nào (trừ khi poll/storage event). Background đã có settings + detected media → tách rõ trách nhiệm. Thêm: content-script không có `chrome.tabs`, không biết sub đã detect (chỉ background biết qua network interceptor).

### A4: V1 làm dropdown multi-sub
- Dropdown overlay chọn sub khi 2+ sub cùng lang.
- **Rejected**: Scope creep. Dropdown thêm UI complexity (trigger, position, persist, re-fetch). Edge case hiếm. V1 ship nhanh, V2 thêm nếu cần.

### A5: Hardcode default `vi` cho tất cả user
- Đơn giản, tiện cho Anh yêu.
- **Rejected**: Sai cho user học zh/ja/ko với native en. Default empty + migration fill `'vi'` cho existing = backward compat + forward flexible.

### A6: Smart-merge timestamp (nối cue khi lệch)
- Merge 2 bộ cues với logic thông minh: nối cue native khi target tách thành 2, tách cue native khi target ghép 1.
- **Rejected**: Out of scope (confirmed ở interview Q4). Chấp nhận lệch nhẹ, native best-effort. Smart-merge = complexity cao, edge case nhiều, ROI thấp.

### A7: Thay thế `parseBilingualSrt` bằng 1 flow ghép thống nhất
- Mọi thứ đi qua "ghép 2 bộ cues" (drag-drop bilingual SRT → split thành 2 bộ → ghép lại).
- **Rejected**: Phá flow đã test. `parseBilingualSrt` đơn giản (split text block), flow ghép 2 file phức tạp hơn (fetch + parse 2 file + merge). 2 flow song song, reuse `BilingualCue` interface.

## Sources
- Intent: `docs/intent/intent-bilingual-subtitle-auto-load.md` (confirmed `yes`)
- Plan: `docs/plan/plan-bilingual-subtitle-auto-load.md`
- CTO review feedback (session 2026-06-27)
- Chrome MV3 docs: https://developer.chrome.com/docs/extensions/reference/
- ADR-005: `docs/adr/005-subtitle-floating-panel.md` (pattern inline DOM, bilingual delimiter)
- Ponytail rule: reuse codebase (rung 2), YAGNI (rung 1)
