# Spec: Popup Tab Scoping

## Objective
Popup mở cho tab A chỉ hiển thị media của tab A. Media của tab nền (tab B) không được rò rỉ vào popup của tab A — cả lúc mở popup lẫn live update. Bug từ gốc: kiến trúc message passing chưa bao giờ scope đúng theo tab active.

**User story:** Là end-user mở popup tại tab đang xem, tôi muốn danh sách media phản ánh đúng tab đó, để không tải nhầm media của tab nền không mong muốn.

**Source intent:** [docs/intent/popup-tab-scoping.md](../intent/popup-tab-scoping.md)

## Tech Stack
- Chrome Extension MV3 (`@crxjs/vite-plugin ^2.7.0`, `@types/chrome ^0.2.0`)
- TypeScript 6, React 19, Zustand 5
- Jest 30 + ts-jest (unit), Playwright 1.61 (e2e)
- Vite 8

## Commands
```
Build:      npm run build
Typecheck:  npm run typecheck
Test:       npm test
Test watch: npm run test:watch
Coverage:   npm run test:coverage
Lint:       npm run lint
Lint fix:   npm run lint:fix
E2E:        npm run test:e2e
```

## Project Structure (files touched)
```
src/types/message.ts                       → thêm tabId vào DetectedMediaUpdatePayload
src/background/index.ts                    → sửa handleGetDetectedMedia, handleDownloadAll, broadcast
src/popup/hooks/useDetectedMedia.ts        → query active tab, gửi tabId, filter live update
src/popup/App.redesigned.tsx               → (nếu cần) truyền tabId cho download handlers
tests/unit/background/index.test.ts        → unit test handlers (không leak)
tests/unit/popup/useDetectedMedia.test.ts  → unit test hook (filter theo tabId)
tests/unit/background/integration.test.ts  → integration test broadcast flow
docs/architechture-system.md               → cập nhật note về tab-scoping
```

## Code Style
Theo codebase hiện tại: TypeScript strict, functional style, JSDoc cho public methods, no emojis. Ví dụ pattern message handler:

```typescript
private handleGetDetectedMedia = async (
  request: MessageRequest,
): Promise<MessageResponse<DetectedMediaUpdatePayload>> => {
  const payload = request.payload as GetDetectedMediaPayload | undefined;
  const tabId = payload?.tabId;
  if (tabId === undefined) {
    return { success: true, data: { videos: [], subtitles: [], tabId: undefined } };
  }
  const { videos, subtitles } = this.networkInterceptor.getMedia(tabId);
  return { success: true, data: { videos, subtitles, tabId } };
};
```

## Testing Strategy
- **Unit (80%):** `handleGetDetectedMedia` không fallback all-media; `handleDownloadAll` không fallback all-media; `useDetectedMedia` filter live update theo `tabId`; `DetectedMediaUpdatePayload` có field `tabId`.
- **Integration (15%):** Broadcast `DETECTED_MEDIA_UPDATE` từ tab B không thay đổi store khi popup đang ở tab A; chuyển tab → store update đúng.
- **E2E (5%):** (optional, manual) Mở 2 tab video, popup tab A chỉ thấy tab A.
- Framework: Jest + ts-jest. Test state, không test interactions. DAMP over DRY. Real implementations over mocks (trừ `chrome.*` API).

## Boundaries
- **Always:** Viết failing test trước (TDD RED), chạy `npm test` + `npm run typecheck` trước khi commit, cập nhật `docs/architechture-system.md` khi đổi data flow.
- **Ask first:** Đổi schema `DetectedMediaUpdatePayload` cách khác hướng, thêm dependency, đổi CI config.
- **Never:** Commit secrets, xóa test failing mà không có approval, sửa `NetworkInterceptor` capture logic (capture global là đúng — chỉ sửa layer message passing + popup).

## Success Criteria
1. Mở popup ở tab A (có media) → chỉ thấy media của tab A. Unit test: `handleGetDetectedMedia` với `tabId=A` trả về đúng media A, không chứa media B.
2. Mở popup ở tab A (không có media) → danh sách rỗng, **không** fallback all-media. Unit test: `handleGetDetectedMedia` với `tabId=A` (A trống) trả `{videos:[], subtitles:[]}` ngay cả khi B có media.
3. Tab B detect media nền trong khi popup tab A đang mở → popup A không đổi. Integration test: broadcast từ tab B với `tabId=B`, hook ở tab A không `setVideos`.
4. Chuyển từ tab A sang tab B → popup (reopen) thấy media B. Unit test: `handleGetDetectedMedia` với `tabId=B` trả media B.
5. `handleDownloadAll` với `tabId=A` (A trống) → trả error "No media for this tab", **không** tải all-media. Unit test.
6. `DetectedMediaUpdatePayload` có field `tabId: number` (non-optional). Typecheck pass.
7. `npm test` + `npm run typecheck` + `npm run lint` pass.

## Out of Scope
- Không xóa media của tab nền (vẫn giữ trong `NetworkInterceptor` để user chuyển tab xem được).
- Không thêm UI "group theo tab" — chỉ ẩn hoàn toàn tab không active.
- Không đổi `NetworkInterceptor` capture logic (global capture đã đúng).
- Không đụng badge toolbar (đã scope đúng theo tab).

## Open Questions
(none — intent đã confirm)

---

# Phase 2: Plan

## Architecture Analysis
`NetworkInterceptor` đã đúng: capture global (`chrome.webRequest.onBeforeRequest` với `<all_urls>`), lưu per-tab trong `Map<id, DetectedVideo>` có `tabId`. Badge toolbar đã scope đúng (`updateBadgeForTab(tabId)`). Vấn đề chỉ nằm ở **layer message passing + popup**:

1. **`handleGetDetectedMedia`** (background/index.ts:671-697): fallback all-media khi tab active trống → leak.
2. **`handleDownloadAll`** (background/index.ts:740-772): fallback all-media khi tab trống → tải nhầm.
3. **Broadcast `DETECTED_MEDIA_UPDATE`** (background/index.ts:179-203): `messageBus.broadcast` gửi `chrome.runtime.sendMessage` chung cho mọi popup, không target theo tab. Popup nhận broadcast từ tab B dù đang ở tab A.
4. **`useDetectedMedia`** (popup/hooks/useDetectedMedia.ts:30): gửi `GET_DETECTED_MEDIA` không kèm `tabId`; nhận broadcast không filter.

## Implementation Strategy
Chrome MV3 `chrome.runtime.sendMessage` **không target theo tab** — broadcast là fan-out tới mọi listener cùng origin. Vì popup chỉ có 1 instance active tại một thời điểm, chiến lược là:

- **Background** thêm `tabId` vào payload `DETECTED_MEDIA_UPDATE` (field bắt buộc, non-optional).
- **Popup** tự biết `tabId` của mình (query active tab khi mount), lưu vào state, và **filter broadcast** theo `tabId` trước khi `setVideos`/`setSubtitles`.
- **Bỏ cả 2 fallback all-media** (GET + DOWNLOAD_ALL). Trả empty/error khi tab không có media — đúng语义 "scope theo tab".

## Components & Dependencies
```
Task 1 (types)        → không phụ thuộc
Task 2 (background)   → phụ thuộc Task 1 (cần type mới)
Task 3 (popup hook)   → phụ thuộc Task 1 + Task 2 (cần tabId trong payload)
Task 4 (download all) → phụ thuộc Task 1 (không cần type mới nhưng cùng scope fix)
Task 5 (architecture doc) → phụ thuộc Task 2,3,4
```

## Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Popup query active tab fail (popup window vs browser window) | Dùng pattern đã có ở `App.redesigned.tsx:164-176` (`currentWindow: false` + fallback `lastFocusedWindow`). Cache `tabId` vào state, không re-query mỗi broadcast. |
| Broadcast từ tab B đến trước khi popup có `tabId` (race) | Hook chỉ `setVideos` khi `tabId !== undefined && payload.tabId === tabId`. Broadcast trước khi có tabId bị drop — acceptable (sẽ có GET_DETECTED_MEDIA ban đầu). |
| Test `chrome.tabs.query` mock phức tạp | Dùng pattern mock đã có trong `tests/unit/popup/store.test.ts` / `hooks.test.tsx`. |
| Breaking change `DetectedMediaUpdatePayload` (thêm required field) | Tất cả consumer đều trong codebase này — cập nhật đồng bộ. Typecheck sẽ bắt. |

## Implementation Order
1. **Task 1** — types (foundation, không phá vỡ gì)
2. **Task 2** — background handlers (RED test → GREEN code)
3. **Task 4** — download all fallback (cùng file background, làm song song logic với Task 2)
4. **Task 3** — popup hook (cần Task 1+2 xong để test integration)
5. **Task 5** — docs update (sau khi code stable)

## Verification Checkpoints
- Sau Task 1: `npm run typecheck` pass (type mới compile).
- Sau Task 2+4: `npm test -- background` pass (unit test handlers).
- Sau Task 3: `npm test -- popup` pass + `npm test -- integration` pass.
- Cuối: `npm test` + `npm run typecheck` + `npm run lint` toàn green.

---

# Phase 3: Tasks

### Task 1: Thêm `tabId` vào `DetectedMediaUpdatePayload`
- **Acceptance:** `DetectedMediaUpdatePayload` có field `tabId: number` (non-optional). Typecheck pass.
- **Verify:** `npm run typecheck` — TS sẽ báo lỗi ở mọi chỗ construct payload chưa có `tabId` (dẫn đường tới Task 2).
- **Files:** `src/types/message.ts`

### Task 2: Sửa `handleGetDetectedMedia` + broadcast — bỏ fallback all-media, thêm `tabId` vào payload
- **Acceptance:**
  - `handleGetDetectedMedia` trả empty khi `tabId` không có hoặc tab trống — KHÔNG fallback `getAllVideos`/`getAllSubtitles`.
  - Broadcast `DETECTED_MEDIA_UPDATE` (background/index.ts:189-195) thêm `tabId` của tab phát hiện vào payload.
  - Broadcast re-enrich (background/index.ts:535) cũng thêm `tabId`.
  - Broadcast page-scan (background/index.ts:970) cũng thêm `tabId`.
- **Verify:** Unit test `handleGetDetectedMedia`: tab A trống + tab B có media → response chỉ `{videos:[], subtitles:[]}`. Test broadcast payload có `tabId`.
- **Files:** `src/background/index.ts`, `tests/unit/background/integration.test.ts` (hoặc `index.test.ts` nếu có)

### Task 3: Sửa `useDetectedMedia` — query active tab, gửi `tabId`, filter broadcast
- **Acceptance:**
  - Hook query active tab khi mount (pattern `App.redesigned.tsx:164-176`), lưu `tabId` vào ref/state.
  - `GET_DETECTED_MEDIA` request kèm `tabId`.
  - Listener `DETECTED_MEDIA_UPDATE` chỉ `setVideos`/`setSubtitles` khi `payload.tabId === tabId` của popup.
- **Verify:** Unit test hook: broadcast `tabId=B` khi hook ở `tabId=A` → store không đổi. Broadcast `tabId=A` → store update.
- **Files:** `src/popup/hooks/useDetectedMedia.ts`, `tests/unit/popup/useDetectedMedia.test.ts` (tạo mới — hiện chưa có)

### Task 4: Sửa `handleDownloadAll` — bỏ fallback all-media
- **Acceptance:** `handleDownloadAll` với `tabId=A` (A trống) → trả `{success: false, error: 'No media found for this tab'}`, KHÔNG tải all-media.
- **Verify:** Unit test: tab A trống + tab B có media → `handleDownloadAll({tabId:A})` trả error, `downloadQueue.addAll` không được gọi với media B.
- **Files:** `src/background/index.ts`, `tests/unit/background/integration.test.ts`

### Task 5: Cập nhật `docs/architechture-system.md`
- **Acceptance:** Document note về tab-scoping: popup filter broadcast theo `tabId`, không fallback all-media, capture vẫn global per-tab.
- **Verify:** Đọc lại file, confirm phản ánh đúng code sau Task 2-4.
- **Files:** `docs/architechture-system.md`
