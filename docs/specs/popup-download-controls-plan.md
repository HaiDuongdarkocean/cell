# Plan: Popup Download Controls + UI Polish

> **Spec**: `docs/specs/popup-download-controls-spec.md`
> **Phase**: 2 — Technical Implementation Plan
> **Status**: Ready for review

---

## Decisions (resolved from spec Open Questions)

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Pause strategy | **Cancel + re-queue** | AbortController phức tạp với OPFS streaming. Re-queue đơn giản, tái sử dụng `cancel()` + `add()`. Mất progress nhưng đáng đổi lấy simplicity. |
| 2 | Retry giữ quality? | **Có** | Thêm `quality?: VideoQuality` vào `DownloadItem`, retry giữ nguyên |
| 3 | Cancel vs Remove | **Tách riêng** | Cancel (X đỏ) khi đang chạy, Remove (trash) khi done/error |
| 4 | Duration field | **Tính từ timestamps** | `completedAt - startedAt`, không thêm field |
| 5 | Quality field | **Thêm vào DownloadItem** | `quality?: VideoQuality`, set khi tạo item |

---

## Architecture Changes

### Type changes (`src/types/media.ts`)

```typescript
// DownloadItem — thêm 3 fields
interface DownloadItem {
  // ... existing fields ...
  readonly quality?: VideoQuality;        // [NEW] quality label cho badge
  readonly downloadProgress?: number;     // [NEW] 0-100, phase download riêng
  readonly convertProgress?: number;      // [NEW] 0-100, phase convert riêng
}
```

**Why**: `progress` field hiện tại là overall (download + convert gộp). Two-phase UI cần tách riêng để vẽ 2 bar.

**Impact**: `downloadQueue.updateProgress()` cần map `downloadProgress`/`convertProgress` từ `DownloadProgress`. `reportProgress()` trong downloader cần set cả 3.

### Message changes (`src/types/message.ts`)

```typescript
// Thêm 2 message types
type MessageType = 
  | ... existing ...
  | 'RETRY_DOWNLOAD'     // [NEW]
  | 'REMOVE_DOWNLOAD';   // [NEW]

// Payloads (dùng chung CancelDownloadPayload — chỉ cần downloadId)
// Không cần payload type mới
```

**Why**: RETRY_DOWNLOAD và REMOVE_DOWNLOAD chỉ cần `downloadId`, cùng shape như CANCEL_DOWNLOAD.

### Backend changes

**`downloadQueue.ts`** — thêm 2 methods:

```
retry(id: string): void
  → Tìm item, reset: status='queued', progress=0, error=undefined
  → Xóa downloadProgress, convertProgress
  → processNext()

remove(id: string): void
  → items.delete(id)
  → Không cần processNext (không giải phóng slot)
```

**`downloader.ts`** — pause/resume/retry:

```
pause(downloadId: string): void
  → this.cancelledIds.add(downloadId)  // abort current fetch
  → (queue đã set status='paused')

resume(downloadId: string): void
  → this.cancelledIds.delete(downloadId)  // cho phép chạy lại
  → (queue sẽ re-queue, executor chạy lại từ đầu)

retry(downloadId: string): void
  → this.cancelledIds.delete(downloadId)  // clear cancel flag
  → (queue.reset item, executor chạy lại)
```

**Key insight**: Pause = cancel + set status 'paused'. Resume = clear cancel flag + re-queue. Downloader không cần logic phức tạp — chỉ cần `throwIfCancelled` check (đã có).

**`index.ts`** — thêm 2 handlers:

```
handleRetryDownload(request) → downloadQueue.retry(id) + downloader.retry(id)
handleRemoveDownload(request) → downloadQueue.remove(id) + downloader.cancel(id) (cleanup OPFS)
```

### UI changes

**New component: `SelectionBar.tsx`**

```
Props:
  selectionCount: number
  onClear: () => void
  onDownload: () => void

Render:
  <div class="selectionBar" data-testid="selection-bar">
    <button data-testid="selection-clear-btn" onClick={onClear}>✕</button>
    <span>{selectionCount} selected</span>
    <button data-testid="selection-download-btn" onClick={onDownload}>⬇ Download</button>
  </div>

Visibility: chỉ render khi selectionCount > 0
Position: fixed bottom, z-index cao, slide-up animation
```

**Rewrite: `DownloadCard.tsx`**

```
Props (thêm):
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void

Layout:
  ┌─────────────────────────────────────────┐
  │ Title                    [1080p]  [⏸][✕] │  ← header + quality badge + actions
  │ Error message (if error)                 │
  │ ── Download phase ──                     │
  │ ████████████████████░░░░░  68%          │  ← download progress bar
  │ ── Converting phase ──                   │
  │ ████████░░░░░░░░░░░░░░░░  35%          │  ← convert progress bar
  │ ⬇ 212MB/445MB  ⚡ 4 workers  ⏱ 1.2s   │  ← detail items
  └─────────────────────────────────────────┘

Action buttons (theo status):
  downloading/converting → [Pause] [Cancel]
  paused                 → [Resume] [Cancel]
  error                  → [Retry] [Remove]
  done                   → [Remove]
  queued                 → [Cancel]
```

**Modify: `VideoCard.tsx` + `SubtitleCard.tsx`** — thêm format icon

```
VideoCard:
  ┌──┬───────────────────────────┐
  │ ▶│ Title                     │
  │  │ m3u8 · 1080p · 445MB      │
  └──┴───────────────────────────┘

SubtitleCard:
  ┌──┬───────────────────────────┐
  │ T│ Display title             │
  │  │ vtt · 42KB                │
  └──┴───────────────────────────┘
```

**Modify: `App.redesigned.tsx`** — wire handlers + SelectionBar + default quality auto-apply

```
Handlers mới:
  handlePauseDownload(id) → sendMessage({ type: 'PAUSE_DOWNLOAD', payload: { downloadId: id } })
  handleResumeDownload(id) → sendMessage({ type: 'RESUME_DOWNLOAD', payload: { downloadId: id } })
  handleCancelDownload(id) → sendMessage({ type: 'CANCEL_DOWNLOAD', payload: { downloadId: id } })
                                    → removeDownload(id) từ store (optimistic UI)
  handleRetryDownload(id) → sendMessage({ type: 'RETRY_DOWNLOAD', payload: { downloadId: id } })
  handleRemoveDownload(id) → sendMessage({ type: 'REMOVE_DOWNLOAD', payload: { downloadId: id } })
                                    → removeDownload(id) từ store

Default quality auto-apply:
  Khi settings.defaultQuality đổi → useEffect → videos.forEach update selectedVariant
  → setVideos(updatedVideos)

SelectionBar:
  Render <SelectionBar> khi selectedIds.size > 0
  onDownload → handleDownloadSelected
  onClear → handleClearSelection
```

---

## Implementation Order

### Phase A — Types + Backend (không phá vỡ UI hiện tại)

| Step | File | Change | Risk | Verify |
|------|------|--------|------|--------|
| A1 | `types/media.ts` | Thêm `quality`, `downloadProgress`, `convertProgress` vào `DownloadItem` | Thấp — optional fields | `tsc --noEmit` |
| A2 | `types/message.ts` | Thêm `RETRY_DOWNLOAD`, `REMOVE_DOWNLOAD` vào `MessageType` | Thấp | `tsc --noEmit` |
| A3 | `downloadQueue.ts` | Thêm `retry()`, `remove()` methods | Thấp — không sửa existing | Unit test |
| A4 | `downloader.ts` | Thêm `pause()`, `resume()`, `retry()` (đều thao tác `cancelledIds`) | Thấp — reuse cancel pattern | `tsc --noEmit` |
| A5 | `downloader.ts` | `reportProgress()` set `downloadProgress` + `convertProgress` riêng | Trung bình — cần phân biệt phase | Unit test |
| A6 | `index.ts` | Thêm `handleRetryDownload`, `handleRemoveDownload` + wire `on()` | Thấp | Integration test |
| A7 | `index.ts` | `createDownloadItem()` set `quality` field | Thấp | `tsc --noEmit` |

**Checkpoint A**: `tsc --noEmit` + `npm run build` + `npx jest --silent` — tất cả pass, UI không đổi.

### Phase B — UI Components (không thay đổi flow)

| Step | File | Change | Risk | Verify |
|------|------|--------|------|--------|
| B1 | `DownloadCard.tsx` | Rewrite: two-phase progress, action buttons, phase labels, detail items | Cao — rewrite toàn component | Unit test render |
| B2 | `DownloadCard.module.css` | Thêm styles: `.twoPhase`, `.phaseRow`, `.actionBtn`, `.detailItem`, `.qualityBadge` | Thấp | Visual check |
| B3 | `VideoCard.tsx` | Thêm format icon `▶` bên trái card | Thấp | `tsc --noEmit` |
| B4 | `VideoCard.module.css` | Thêm `.mediaIcon` styles | Thấp | Visual check |
| B5 | `SubtitleCard.tsx` | Thêm format icon `T` bên trái card | Thấp | `tsc --noEmit` |
| B6 | `SubtitleCard.module.css` | Thêm `.mediaIcon` styles | Thấp | Visual check |
| B7 | `SelectionBar.tsx` (mới) | Component: clear button, count, download button | Thấp — component mới | `tsc --noEmit` |
| B8 | `SelectionBar.module.css` (mới) | Fixed bottom bar, slide-up animation, z-index | Thấp | Visual check |

**Checkpoint B**: `tsc --noEmit` + `npm run build` — components compile, chưa wire vào App.

### Phase C — Wiring + Polish

| Step | File | Change | Risk | Verify |
|------|------|--------|------|--------|
| C1 | `App.redesigned.tsx` | Wire `handlePauseDownload`, `handleResumeDownload`, `handleCancelDownload`, `handleRetryDownload`, `handleRemoveDownload` | Trung bình — message flow | E2E |
| C2 | `App.redesigned.tsx` | Pass `onPause`/`onResume`/`onCancel`/`onRetry`/`onRemove` props vào `DownloadCard` | Thấp | `tsc --noEmit` |
| C3 | `App.redesigned.tsx` | Render `<SelectionBar>` khi `selectedIds.size > 0` | Thấp | Visual check |
| C4 | `App.redesigned.tsx` | Default quality auto-apply: `useEffect` khi `settings.defaultQuality` đổi | Trung bình — cần update variants | Unit test |
| C5 | `App.redesigned.module.css` | Thêm padding đáy cho content khi selection bar visible | Thấp | Visual check |
| C6 | `popupStore.ts` | Thêm `clearDoneDownloads()` action (optional — cho "Clear completed" button) | Thấp | `tsc --noEmit` |

**Checkpoint C**: `tsc --noEmit` + `npm run build` + manual popup test — tất cả tính năng hoạt động.

### Phase D — Tests

| Step | File | Change | Risk | Verify |
|------|------|--------|------|--------|
| D1 | `tests/unit/background/downloadQueue.test.ts` | +tests: `retry()` resets item, `remove()` deletes item | Thấp | `npx jest` |
| D2 | `tests/unit/popup/DownloadCard.test.tsx` (mới) | Tests: two-phase render theo status, action buttons visibility, phase labels | Thấp | `npx jest` |
| D3 | `tests/unit/background/integration.test.ts` | +tests: `RETRY_DOWNLOAD` handler, `REMOVE_DOWNLOAD` handler | Thấp | `npx jest` |
| D4 | `e2e/download-controls.spec.ts` (mới) | E2E: download → pause → resume → cancel; download → error → retry → remove | Cao — real network | Playwright |
| D5 | `tests/unit/background/integration.test.ts` | Update mock: thêm `retry()`, `remove()` vào `MockDownloader` | Thấp | `npx jest` |

**Checkpoint D**: `npx jest --silent` + `npx playwright test` — tất cả pass.

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pause = cancel+re-queue tải lại từ đầu | User mất progress download | Hiện "⚠ Restarting from beginning" khi resume. Phase 2 có thể improve với AbortController |
| `downloadProgress` + `convertProgress` không sync với `progress` | UI hiển thị sai | `reportProgress()` luôn set cả 3: `progress` (overall), `downloadProgress`, `convertProgress` |
| DownloadCard rewrite phá E2E test hiện tại | `filename-source.spec.ts` fail | Giữ `data-testid="download-item"`, chỉ thêm test IDs mới |
| Selection bar che khuất download card cuối | UX kém | Thêm `padding-bottom` vào `.content` khi bar visible |
| Default quality auto-apply trigger re-render loop | Performance | `useEffect` với dependency `[settings.defaultQuality]` only, không dependency `videos` |
| Retry tạo OPFS conflict (dir đã tồn tại) | Download fail | `retry()` gọi `deleteDownloadSubdir()` trước khi re-queue |

---

## Parallel vs Sequential

**Sequential** (must do in order):
- A1 → A2 → A3 → A4 → A5 → A6 → A7 (types trước, backend sau)
- B1 → C2 (DownloadCard trước khi wire)
- B7 → C3 (SelectionBar trước khi wire)
- C1 → C2 → C3 → C4 (wiring theo thứ tự)

**Parallel** (có thể làm cùng lúc):
- B3+B4 (VideoCard icon) || B5+B6 (SubtitleCard icon) || B7+B8 (SelectionBar)
- D1 (queue tests) || D2 (DownloadCard tests) || D3 (integration tests)
- B2 (DownloadCard CSS) || B4+B6 (icon CSS) || B8 (SelectionBar CSS)

---

## Verification Checkpoints

| Checkpoint | Khi | Commands | Must pass |
|------------|-----|----------|-----------|
| **A** | Sau Phase A | `tsc --noEmit` + `build` + `jest --silent` | 592+ tests, 0 errors |
| **B** | Sau Phase B | `tsc --noEmit` + `build` | 0 errors, components compile |
| **C** | Sau Phase C | `tsc --noEmit` + `build` + manual popup | 0 errors, UI hoạt động |
| **D** | Sau Phase D | `jest --silent` + `playwright test` | 592+ N tests, E2E pass |

---

## File Impact Summary

| File | Phase | Change type |
|------|-------|-------------|
| `src/types/media.ts` | A1 | Add 3 optional fields |
| `src/types/message.ts` | A2 | Add 2 message types |
| `src/background/downloadQueue.ts` | A3 | Add 2 methods |
| `src/background/downloader.ts` | A4, A5 | Add 3 methods, modify reportProgress |
| `src/background/index.ts` | A6, A7 | Add 2 handlers, modify createDownloadItem |
| `src/popup/components/media/DownloadCard.tsx` | B1 | Rewrite |
| `src/popup/components/media/DownloadCard.module.css` | B2 | Add styles |
| `src/popup/components/media/VideoCard.tsx` | B3 | Add icon |
| `src/popup/components/media/VideoCard.module.css` | B4 | Add styles |
| `src/popup/components/media/SubtitleCard.tsx` | B5 | Add icon |
| `src/popup/components/media/SubtitleCard.module.css` | B6 | Add styles |
| `src/popup/components/SelectionBar.tsx` | B7 | New file |
| `src/popup/components/SelectionBar.module.css` | B8 | New file |
| `src/popup/App.redesigned.tsx` | C1-C4 | Add handlers, wire props, SelectionBar, auto-apply |
| `src/popup/App.redesigned.module.css` | C5 | Add padding |
| `src/popup/store/popupStore.ts` | C6 | Add clearDoneDownloads (optional) |
| `tests/unit/background/downloadQueue.test.ts` | D1 | Add tests |
| `tests/unit/popup/DownloadCard.test.tsx` | D2 | New file |
| `tests/unit/background/integration.test.ts` | D3, D5 | Add tests, update mock |
| `e2e/download-controls.spec.ts` | D4 | New file |

**Total**: 20 files (16 modify, 4 new)

---

## Next Step

→ **Anh yêu approve plan này, tôi sẽ viết Phase 3: Tasks** (break down thành tasks có thể implement, mỗi task ≤ 5 files).
