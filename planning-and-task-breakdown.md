# Child-Iframe Player Mode — Planning and Task Breakdown

## Objective

Sửa lỗi layout của Player Mode trên các website có video nằm trong **cross-origin child iframe** (AnimeKai/MegaPlay, moviepire/vidnest, v.v.).

Hiện trạng:

- Native fullscreen đã hoạt động.
- Video không bị black screen/reload.
- Tuy nhiên, **player container chưa nằm trong `videoStage`** của Player Mode overlay.
- Dẫn đến video không vừa với vùng stage, không responsive, overlay che native controls, không thể điều khiển video đúng cách.

Mục tiêu cuối:

```text
Native fullscreen
→ Player container nằm trong videoStage
→ Video responsive theo videoStage
→ Native video controls hoạt động
→ Cell subtitle / cue list / controls hoạt động
→ Không regression trên top-frame sites
```

## Tech Stack

- React 18 + TypeScript
- Chrome Extension MV3
- Shadow DOM cho subtitle overlay
- CDP (Chrome DevTools Protocol) qua nodriver để E2E
- MCP stealth-chrome-devtools / chrome-devtools

## Commands

```bash
# Typecheck
npm run typecheck

# Unit tests
npx jest --selectProjects unit

# Production build
npm run build

# Development build (seeds dictionary/frequency data)
npx vite build --mode development

# E2E: load Cell extension via nodriver
uv run --python 3.11 --with nodriver python -u .agents\skills\testing-extension-browser\script\test-cell-browser.py

# Manual E2E navigate + verify via MCP
# spawn_browser(user_data_dir=<clone>, headless=false) -> navigate(url) -> execute_script -> screenshot
```

## Project Structure

```text
src/features/subtitle/ui/PlayerModeOverlay.tsx         # Main overlay component
src/features/subtitle/ui/PlayerModeOverlay.module.css  # Overlay styles
src/features/subtitle/ui/SubtitlePanels.tsx            # Player Mode state machine + fullscreen sync
src/features/subtitle/logic/playerModeGeometry.ts      # Pure layout helpers
src/features/subtitle/logic/findPlayerContainer.ts     # Player container discovery
src/features/subtitle/logic/iframeContext.ts           # Child-iframe detection
src/features/subtitle/ui/playerModeHost.ts             # Host style reparenting helpers
src/features/subtitle/ui/mountSubtitle.tsx             # Shadow root mount + attachFullscreenReparenting
docs/adr/native-fullscreen-iframe-player-mode.md       # Existing ADR
```

## Code Style

- Named exports.
- Pure logic tách hàm, không side effect.
- Không dùng `any`.
- Giữ convention gốc của file.
- Minimal diff — chỉ sửa những gì cần.

## Testing Strategy

| Level | Tool | Scope |
|---|---|---|
| Unit | Jest | `playerModeGeometry`, `findPlayerContainer`, `iframeContext`, `PlayerModeOverlay` behavior |
| Styles | Jest + DOM | `PlayerModeOverlay.styles` — layout, pointer events, class names |
| Build | Vite + tsc | Typecheck, bundle, dev/prod build |
| E2E | nodriver + CDP + MCP | AnimeKai, TheMovieBox, KissKH, MoviePire |
| Visual | `vision-reader` subagent | Chứng cứ screenshot/video state; agent chính không tự đánh giá hình ảnh |

## Boundaries

### Always do

- Chạy `typecheck`, `build` và unit tests sau mỗi slice.
- Commit mỗi slice hoàn thành.
- Dùng subagent để verify screenshot/visual.
- Cập nhật ADR/wiki khi thay đổi kiến trúc.

### Ask first

- Thêm dependency mới.
- Thay đổi `manifest.json`.
- Thay đổi content script all_frames policy.

### Never do

- Không commit secret/key.
- Không xóa test đang fail mà không sửa.
- Không dùng `setTimeout` hack để chờ lifecycle nếu có event/signal rõ ràng.

## Success Criteria (AC)

1. **AC1 — Native fullscreen child iframe**: `document.documentElement.requestFullscreen()` được gọi từ child document khi bấm Player Mode.
2. **AC2 — Full viewport + no header**: fullscreen element phủ toàn viewport; header top frame không visible.
3. **AC3 — Player projection**: `videoStage` slot có đúng 1 assigned element là player container chứa `<video>`.
4. **AC4 — Responsive**: player width/height khớp với `videoStage` width/height; cập nhật khi resize viewport, content panel, orientation.
5. **AC5 — No black/reload**: video vẫn hiển thị frame, `currentTime` không reset, `videoWidth > 0`.
6. **AC6 — Native controls click được**: play/pause/seek/volume hoạt động trong vùng `videoStage`.
7. **AC7 — Cell controls hoạt động**: nav cluster, subtitle block, cue list, quick add, v.v.
8. **AC8 — Cue list/seek**: cue list nằm đúng vùng, click cue seek đúng time.
9. **AC9 — Responsive devices**: desktop/tablet/mobile layout không overflow, touch target đủ lớn.
10. **AC10 — Exit restore**: exit Player Mode khôi phục player về vị trí ban đầu, fullscreen = null.
11. **AC11 — Top-frame regression**: TheMovieBox, KissKH vẫn hoạt động như cũ.
12. **AC12 — Permission failure safe**: nếu `requestFullscreen()` bị từ chối, toast lỗi, không crash, không mất video.
13. **AC13 — Tests/build pass**: typecheck, unit tests, dev/prod build đều pass.

## Task Breakdown

### Task 1 — Collect Runtime Evidence

**Mục tiêu:** Xác nhận chính xác DOM/layout hiện tại trước khi sửa.

**Hành động:**

1. Build dev extension.
2. Launch nodriver + load Cell extension.
3. Navigate AnimeKai episode.
4. Bật Player Mode.
5. Chụp screenshot.
6. Execute script lấy:

```ts
{
  fullscreenElement: document.fullscreenElement?.tagName,
  cellRootParent: document.querySelector('#cell-subtitle-root')?.parentElement?.tagName,
  videoStageRect: document.querySelector('[data-cell-id="player-mode-video-stage"]')?.getBoundingClientRect(),
  slotAssignedCount: document
    .querySelector('[data-cell-id="player-mode-video-stage"] slot[name="cell-video"]')
    ?.assignedElements().length,
  playerContainer: findPlayerContainer()?.tagName,
  playerContainerRect: findPlayerContainer()?.getBoundingClientRect(),
  videoRect: document.querySelector('video')?.getBoundingClientRect(),
}
```

**Acceptance:**

- Có screenshot trước fix.
- Có DOM dump xác nhận slot assigned count.
- Có thể lặp lại lỗi tối thiểu 2 lần.
- Subagent `vision-reader` xác nhận player không nằm trong videoStage.

**Files touched:** none (pure evidence)

---

### Task 2 — Enable Child-Frame Player Projection

**Mục tiêu:** Đưa player container vào `videoStage` trong child iframe.

**Hành động:**

1. Trong `PlayerModeOverlay.tsx`, sửa guard ở mount effect.
2. Phân biệt top-frame fullscreen vs child-frame fullscreen.
3. Cho phép child-frame reparent player container vào shadow host/slot.
4. Đảm bảo player container không bị đưa ra khỏi child document.

**Acceptance:**

- Sau khi bật Player Mode, `slot.assignedElements().length === 1`.
- Assigned element chứa `<video>`.
- Player container vẫn thuộc child iframe document.

**Files touched:**

- `src/features/subtitle/ui/PlayerModeOverlay.tsx`

---

### Task 3 — Make Projected Player Responsive

**Mục tiêu:** Video co giãn theo `videoStage` kích thước thực.

**Hành động:**

1. Đảm bảo responsive effect chạy trong child frame.
2. Lấy kích thước thực từ `getBoundingClientRect()` của `videoStage`.
3. Áp dụng width/height lên player container và các wrapper con.
4. Không reparent lại player mỗi lần resize, chỉ style.

**Acceptance:**

- `playerRect.width === videoStageRect.width`
- `playerRect.height === videoStageRect.height`
- Khi resize viewport, content panel, orientation, player vẫn khớp.
- `currentTime` không reset.

**Files touched:**

- `src/features/subtitle/ui/PlayerModeOverlay.tsx`

---

### Task 4 — Fix Pointer-Events and Overlay Layering

**Mục tiêu:** Video controls nhận click, Cell controls vẫn tương tác.

**Hành động:**

1. Sửa `PlayerModeOverlay.module.css`.
2. Bỏ hoặc thu hẹp `.childFrame` transparent/pointer-events passthrough.
3. Chỉ để click-through ở vùng background không chứa controls.
4. `videoStage` phải có layout thật, slot player `pointer-events: auto`.
5. Content panel + dock `pointer-events: auto`.

**Acceptance:**

- Click play/pause trên video hoạt động.
- Click seek bar hoạt động.
- Click Cell nav cluster hoạt động.
- Click cue list hoạt động.

**Files touched:**

- `src/features/subtitle/ui/PlayerModeOverlay.module.css`

---

### Task 5 — Verify Fullscreen Lifecycle and Exit Restore

**Mục tiêu:** Không mất player khi exit fullscreen, khôi phục đúng DOM.

**Hành động:**

1. Trace `attachFullscreenReparenting` lifecycle.
2. Kiểm tra thứ tự: `fullscreenchange` → shadow host reparent → overlay mount → player projection.
3. Kiểm tra exit: player trở về parent gốc, inline style được restore.
4. Đảm bảo không leak listener.

**Acceptance:**

- Sau exit, `document.fullscreenElement === null`.
- Player container trở về DOM gốc.
- Cell overlay unmount.
- Video tiếp tục phát.

**Files touched:**

- `src/features/subtitle/ui/mountSubtitle.tsx` (nếu cần)
- `src/features/subtitle/ui/playerModeHost.ts` (nếu cần)
- `src/features/subtitle/ui/SubtitlePanels.tsx` (nếu cần)

---

### Task 6 — Add/Update Regression Tests

**Mục tiêu:** Kiểm tra tự động để tránh regression.

**Hành động:**

1. Cập nhật `PlayerModeOverlay.test.tsx`:
   - Top-frame vẫn project player.
   - Child-frame fullscreen project player.
   - Slot assigned 1 element.
2. Cập nhật `PlayerModeOverlay.styles.test.ts`:
   - Video stage pointer events.
   - Child frame không mất layout.
3. Cập nhật `playerModeGeometry.test.ts`:
   - Responsive height calculation.
   - Mobile layout.
4. Thêm/cập nhật `findPlayerContainer.test.ts` nếu cần.

**Acceptance:**

- Các test mới fail trước fix, pass sau fix.
- Tất cả test cũ vẫn pass.

**Files touched:**

- `tests/unit/features/subtitle/ui/PlayerModeOverlay.test.tsx`
- `tests/unit/features/subtitle/ui/PlayerModeOverlay.styles.test.ts`
- `tests/unit/features/subtitle/logic/playerModeGeometry.test.ts`
- `tests/unit/features/subtitle/logic/findPlayerContainer.test.ts` (nếu cần)

---

### Task 7 — Run Build and Test Gates

**Mục tiêu:** Code sạch và build pass.

**Hành động:**

1. `npm run typecheck`
2. `npx jest --selectProjects unit`
3. `npm run build`
4. `npx vite build --mode development`

**Acceptance:**

Tất cả lệnh trên exit code 0, không có warning mới.

**Files touched:** none

---

### Task 8 — Cross-Site E2E with Subagent Vision Verification

**Mục tiêu:** Xác nhận hành vi trên thực tế nhiều site.

**Hành động:**

1. Dùng nodriver load Cell extension.
2. Navigate từng site:
   - AnimeKai
   - TheMovieBox
   - KissKH
   - MoviePire (nếu provider load được)
3. Click Player Mode.
4. Chụp screenshot.
5. Execute script lấy DOM evidence.
6. Gửi screenshot cho subagent `vision-reader` để đánh giá.
7. Ghi kết quả vào file report hoặc tóm tắt.

**Acceptance:**

| Site | Check |
|---|---|
| AnimeKai | fullscreen, player in stage, responsive, controls clickable, subtitle visible |
| TheMovieBox | player in stage, responsive, no regression |
| KissKH | player in stage, responsive, no regression |
| MoviePire | PASS nếu provider load, BLOCKED nếu không load |

**Files touched:**

- Có thể tạo file report `tasks/player-mode-fix-report.md` (không bắt buộc)

---

### Task 9 — Final Code Review and AC Verdict

**Mục tiêu:** Đánh giá tổng thể và kết luận.

**Hành động:**

1. Review diff (`git diff HEAD~N..HEAD -- src/ tests/ docs/`).
2. Áp dụng 5-axis code review.
3. Kiểm tra dead code.
4. Cập nhật `docs/adr/native-fullscreen-iframe-player-mode.md` nếu thay đổi quyết định.
5. Cập nhật `docs/0-wiki.md` / `docs/2-architechture-system.md` nếu cần.
6. Đưa ra bảng AC pass/fail.

**Acceptance:**

- Tất cả AC đạt mới kết luận PASS.
- Có commit cuối cùng ghi rõ thay đổi.

**Files touched:**

- `docs/adr/native-fullscreen-iframe-player-mode.md` (nếu cần)
- `docs/0-wiki.md` (nếu cần)
- `docs/2-architechture-system.md` (nếu cần)

## Execution Order

```text
Task 1 → Task 2 → Task 3 → Task 4
              ↓
        Task 5 (verify lifecycle)
              ↓
        Task 6 (tests)
              ↓
        Task 7 (build gates)
              ↓
        Task 8 (E2E + subagent verify)
              ↓
        Task 9 (review + verdict)
```

## Verification Protocol

- **DOM/runtime evidence**: agent chính thu thập qua `execute_script`.
- **Visual/UX evidence**: `vision-reader` subagent đọc screenshot.
- **Build/test evidence**: agent chính chạy lệnh terminal.
- **Code review evidence**: agent chính hoặc `subagent_general` thực hiện 5-axis review.

> Agent chính KHÔNG tự đánh giá hình ảnh screenshot. Mọi screenshot phải gửi qua subagent vision-reader.
