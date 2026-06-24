# Spec: Popup Download Controls + UI Polish

> **Status**: Draft — chờ Anh yêu review
> **Scope**: 11 tính năng từ prototype chưa có trong hệ thống
> **Spec ID**: `popup-download-controls-v1`

---

## Objective

Hệ thống hiện tại đã có backend `pause()`/`resume()`/`cancel()` trong `downloadQueue.ts` và message handlers wired trong `index.ts`, nhưng UI popup chưa có nút để user tương tác. Prototype `docs/prototype/` đã thiết kế đầy đủ UI cho các tính năng này, nhưng hệ thống thực tế chỉ render progress bar + status text cơ bản.

**Mục tiêu**: Implement 11 tính năng UI/UX từ prototype để popup đạt parity, bao gồm:
- 6 tính năng ưu tiên cao: selection bar, two-phase progress, pause/resume, cancel, remove, retry
- 5 tính năng phụ: phase labels, progress details, quality badge, format icon, default quality auto-apply

**User stories**:
1. Tôi chọn 2/5 media → thấy selection bar nổi "2 selected" + nút Download + Clear
2. Tôi download video m3u8 → thấy 2 progress bar: Download (xong 100%) → Converting (đang chạy)
3. Tôi pause 1 download đang chạy → download dừng, nút đổi thành Resume
4. Tôi cancel 1 download → download biến mất khỏi list, queue tự chạy item kế
5. Download xong → tôi click nút Remove → card biến mất
6. Download lỗi → tôi click Retry → download chạy lại từ đầu
7. Tôi nhìn download card → thấy badge "1080p" bên cạnh title
8. Tôi nhìn media card → thấy icon ▶ (video) hoặc T (subtitle) bên trái
9. Tôi đổi default quality → tất cả media cards tự update quality
10. Tôi nhìn download card converting → thấy phase "Transmuxing" + "4 workers" + "1.2s"

## Tech Stack

- **UI**: React 18 + TypeScript + Zustand (`popupStore`)
- **Styling**: CSS Modules (`*.module.css`)
- **Messaging**: `chrome.runtime.sendMessage` (popup → background)
- **Backend**: Service Worker MV3 (`downloadQueue.ts`, `downloader.ts`, `index.ts`)
- **Types**: `src/types/media.ts`, `src/types/message.ts`
- **Test**: Jest (unit) + Playwright (E2E)

## Commands

```bash
# Typecheck
npx tsc --noEmit

# Build extension → dist/
npm run build

# Run all Jest tests
npx jest --silent

# Run specific test file
npx jest tests/unit/popup/<file>.test.ts --verbose

# Run E2E
npx playwright test e2e/<file>.spec.ts --reporter=line --timeout 120000
```

## Project Structure (files sẽ touch)

```
src/
├── types/
│   ├── media.ts              # +downloadProgress, +convertProgress, +quality field trên DownloadItem
│   └── message.ts            # +RETRY_DOWNLOAD, +REMOVE_DOWNLOAD message types + payloads
├── background/
│   ├── downloadQueue.ts      # +retry(), +remove() methods
│   ├── downloader.ts         # +retry(), +pause(), +resume() (cancel đã có)
│   └── index.ts              # +handleRetryDownload, +handleRemoveDownload handlers
├── popup/
│   ├── App.redesigned.tsx    # +SelectionBar component, +handlers pause/resume/cancel/retry/remove
│   ├── App.redesigned.module.css  # +.selectionBar styles
│   ├── store/popupStore.ts   # (đã có removeDownload, có thể cần thêm clearDoneDownloads)
│   └── components/media/
│       ├── DownloadCard.tsx          # rewrite: two-phase progress, action buttons, phase labels, details
│       ├── DownloadCard.module.css   # +two-phase, +actionBtn, +detailItem styles
│       ├── VideoCard.tsx             # +format icon (▶)
│       ├── VideoCard.module.css      # +.mediaIcon styles
│       ├── SubtitleCard.tsx          # +format icon (T)
│       └── SubtitleCard.module.css   # +.mediaIcon styles

tests/
├── unit/
│   ├── background/downloadQueue.test.ts  # +retry, +remove tests
│   └── popup/DownloadCard.test.tsx       # (mới) two-phase, action buttons
└── e2e/
    └── download-controls.spec.ts         # (mới) pause/resume/cancel/retry/remove E2E
```

## Code Style

```typescript
// Functional component, typed props interface, CSS Modules
interface DownloadCardProps {
  download: DownloadItem;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DownloadCard({ download, onPause, onResume, onCancel, onRetry, onRemove }: DownloadCardProps): React.JSX.Element {
  const isDownloading = download.status === 'downloading';
  const isConverting = download.status === 'converting';
  const isPaused = download.status === 'paused';
  const isError = download.status === 'error';
  const isDone = download.status === 'done';
  // ...
}
```

**Conventions**:
- PascalCase components, camelCase handlers, `onXxx` props cho callbacks
- `data-testid` cho mọi element cần E2E selector
- `aria-label` cho icon-only buttons
- CSS class names: camelCase trong `.module.css`, truy cập via `styles.className`
- Không dùng emoji trong code

## Testing Strategy

| Layer | Framework | File location | Coverage |
|-------|-----------|---------------|----------|
| Unit — backend | Jest | `tests/unit/background/downloadQueue.test.ts` | retry, remove, pause/resume edge cases |
| Unit — UI | Jest + RTL | `tests/unit/popup/DownloadCard.test.tsx` | two-phase render, action buttons visibility |
| Integration | Jest | `tests/unit/background/integration.test.ts` | RETRY_DOWNLOAD, REMOVE_DOWNLOAD handlers |
| E2E | Playwright | `e2e/download-controls.spec.ts` | pause/resume/cancel/retry/remove trên kisskh.co |

**Test levels**:
- Unit 80%: logic thuần (queue retry/remove, DownloadCard render theo status)
- Integration 15%: message handler → queue → response
- E2E 5%: real flow trên kisskh.co (chỉ nếu unit + integration pass)

## Boundaries

**Always do**:
- Run `npx tsc --noEmit` + `npm run build` + `npx jest --silent` trước khi commit
- Thêm `data-testid` cho mọi element mới cần E2E
- Update `docs/architechture-system.md` khi thêm/xóa file
- Update `docs/knowleadge/reference-knowledge_base.md` khi fix bug

**Ask first**:
- Thêm dependency mới (npm package)
- Đổi `DownloadItem` type schema (ảnh hưởng toàn app)
- Thay đổi message type contract giữa popup ↔ background

**Never do**:
- Commit secrets/credentials
- Xóa test fail mà không có lý do rõ
- Edit `node_modules/` hoặc `dist/`

## Success Criteria

### 6 tính năng ưu tiên cao

**1. Selection bar**
- [ ] Khi `selectedIds.size > 0`, selection bar hiện ở đáy popup với: nút Clear (X), text "N selected", nút Download
- [ ] Khi `selectedIds.size === 0`, selection bar ẩn
- [ ] Click Clear → clear selection, bar ẩn
- [ ] Click Download → download selected items, bar ẩn
- [ ] Selection bar không che khuất media cards (z-index + padding đáy)
- [ ] `data-testid="selection-bar"`, `data-testid="selection-clear-btn"`, `data-testid="selection-download-btn"`

**2. Two-phase progress**
- [ ] Khi `status === 'downloading'`: 1 progress bar với `downloadProgress`%
- [ ] Khi `status === 'converting'`: 2 progress bar — Download (100% done) + Converting (`convertProgress`%)
- [ ] Khi `status === 'done'`: 1 progress bar 100%
- [ ] Khi `status === 'error'`: 1 progress bar với `progress`% + error text
- [ ] Khi `status === 'queued'`: text "Waiting…" không có progress bar
- [ ] `DownloadItem` có field `downloadProgress` và `convertProgress` (0-100, riêng biệt)

**3. Pause/Resume button**
- [ ] Khi `status === 'downloading'` hoặc `'converting'`: hiện nút Pause
- [ ] Click Pause → gửi `PAUSE_DOWNLOAD`, status đổi thành `'paused'`, nút đổi thành Resume
- [ ] Khi `status === 'paused'`: hiện nút Resume
- [ ] Click Resume → gửi `RESUME_DOWNLOAD`, status đổi lại, nút đổi thành Pause
- [ ] Backend `downloader.ts` có `pause()`/`resume()` method (hiện chỉ có `cancel()`)
- [ ] `data-testid="pause-btn"`, `data-testid="resume-btn"`

**4. Cancel button**
- [ ] Khi `status !== 'done'`: hiện nút Cancel (X đỏ)
- [ ] Click Cancel → gửi `CANCEL_DOWNLOAD`, download biến mất khỏi list
- [ ] Queue tự động chạy item kế (đã có `processNext()` trong downloadQueue)
- [ ] `data-testid="cancel-btn"`

**5. Remove button**
- [ ] Khi `status === 'done'` hoặc `'error'`: hiện nút Remove (trash icon)
- [ ] Click Remove → gửi `REMOVE_DOWNLOAD`, card biến mất khỏi popup + background
- [ ] `data-testid="remove-btn"`

**6. Retry button**
- [ ] Khi `status === 'error'`: hiện nút Retry (refresh icon)
- [ ] Click Retry → gửi `RETRY_DOWNLOAD`, download reset progress + chạy lại từ đầu
- [ ] Backend `downloadQueue.retry()` + `downloader.retry()` method mới
- [ ] Retry tạo download item mới (hoặc reset item cũ) + re-queue
- [ ] `data-testid="retry-btn"`

### 5 tính năng phụ

**7. Phase labels**
- [ ] Khi `status === 'converting'`: hiện phase label từ `conversionPhase` field
- [ ] Labels: Planning → Transmuxing → Merging → Validating → Done
- [ ] Phase label hiển thị bên cạnh progress bar, format: "Converting · Transmuxing"

**8. Progress detail items**
- [ ] Khi `status === 'downloading'`: hiện `downloadedBytes/fileSize` (vd "212MB/445MB")
- [ ] Khi `status === 'converting'` hoặc `'done'`: hiện `fileSize` (vd "445MB")
- [ ] Khi `workerCount > 0`: hiện "N workers"
- [ ] Khi `status === 'done'`: hiện duration (vd "1.2s") — cần thêm `durationMs` field

**9. Quality badge trên download card**
- [ ] Hiện badge nhỏ bên cạnh title với quality label (vd "1080p")
- [ ] Lấy từ `DownloadItem.quality` field (cần thêm field này)
- [ ] Badge style: pill, nhỏ, màu nhạt

**10. Format icon trên media card**
- [ ] VideoCard: icon ▶ bên trái card
- [ ] SubtitleCard: icon "T" (hoặc icon phụ đề) bên trái card
- [ ] Icon có màu khác nhau: video = primary, subtitle = secondary

**11. Default quality auto-apply**
- [ ] Khi user đổi `defaultQuality` trong SettingsDialog → tất cả VideoCards update `selectedVariant` theo quality mới
- [ ] Nếu quality không có trong variants → giữ nguyên variant đầu

## Open Questions

1. **Pause implementation**: `downloader.ts` hiện chỉ có `cancel()`. Pause cần abort fetch nhưng giữ state để resume. Có 2 cách:
   - (a) Pause = abort fetch + giữ segment index, resume = fetch tiếp từ segment đó
   - (b) Pause = cancel + re-queue từ đầu (đơn giản nhưng tải lại từ đầu)
   - → Tôi đề xuất (a) cho UX tốt hơn, nhưng (b) nhanh implement hơn. Anh chọn?

2. **Retry strategy**: Retry có nên giữ nguyên quality đã chọn hay dùng default quality?
   - → Tôi đề xuất: giữ nguyên quality cũ (lưu trong DownloadItem)

3. **Remove vs Cancel**: Cancel (đang chạy) vs Remove (done/error) — có nên gộp thành 1 nút không?
   - → Tôi đề xuất: tách riêng như prototype (Cancel = X đỏ khi đang chạy, Remove = trash khi done)

4. **Duration field**: `DownloadItem` chưa có `durationMs`. Thêm field mới hay tính từ `startedAt`/`completedAt`?
   - → Tôi đề xuất: tính từ `completedAt - startedAt` (đã có sẵn), không thêm field

5. **Quality field**: `DownloadItem` chưa có `quality` field. Thêm field mới hay lấy từ `videoId` → `DetectedVideo.variants`?
   - → Tôi đề xuất: thêm `quality?: VideoQuality` field vào `DownloadItem` (đơn giản, không cần lookup)

## Implementation Order (preview — chi tiết ở Phase 3 Tasks)

```
Phase A — Types + Backend (không phá vỡ hiện tại)
  1. Thêm fields: downloadProgress, convertProgress, quality vào DownloadItem
  2. Thêm RETRY_DOWNLOAD, REMOVE_DOWNLOAD message types + payloads
  3. downloadQueue.retry() + downloadQueue.remove()
  4. downloader.pause() / resume() / retry()
  5. index.ts: handleRetryDownload, handleRemoveDownload

Phase B — UI Components (không thay đổi flow)
  6. DownloadCard rewrite: two-phase, action buttons, phase labels, details
  7. VideoCard + SubtitleCard: format icons
  8. SelectionBar component mới

Phase C — Wiring + Polish
  9. App.redesigned.tsx: wire pause/resume/cancel/retry/remove handlers
  10. App.redesigned.tsx: default quality auto-apply
  11. CSS: selection bar, two-phase, action buttons, badges

Phase D — Tests
  12. Unit: downloadQueue retry/remove
  13. Unit: DownloadCard render
  14. Integration: RETRY_DOWNLOAD, REMOVE_DOWNLOAD handlers
  15. E2E: download-controls.spec.ts
```

---

## Next Steps

Sau khi Anh yêu approve spec này:
1. Tôi sẽ vào **Phase 2: Plan** — technical implementation plan chi tiết
2. Rồi **Phase 3: Tasks** — break down thành tasks có thể implement
3. Cuối cùng **Phase 4: Implement** — execute từng task

→ **Anh yêu review spec này, trả lời 5 Open Questions, rồi tôi sẽ viết Plan.**
