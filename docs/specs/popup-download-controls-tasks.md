# Tasks: Popup Download Controls + UI Polish

> **Spec**: `docs/specs/popup-download-controls-spec.md`
> **Plan**: `docs/specs/popup-download-controls-plan.md`
> **Phase**: 3 — Task Breakdown
> **Status**: Ready for implementation

---

## Task List

### Phase A — Types + Backend

#### Task A1: Add DownloadItem fields + message types
- **Acceptance**: `DownloadItem` có `quality`, `downloadProgress`, `convertProgress`. `MessageType` có `RETRY_DOWNLOAD`, `REMOVE_DOWNLOAD`. `tsc --noEmit` pass.
- **Verify**: `npx tsc --noEmit`
- **Files**:
  - `src/types/media.ts` — add 3 optional fields vào `DownloadItem`
  - `src/types/message.ts` — add 2 message types

#### Task A2: downloadQueue.retry() + remove()
- **Acceptance**: `retry(id)` reset item về queued + clear error/progress. `remove(id)` xóa item khỏi Map. Không phá existing methods.
- **Verify**: `npx jest tests/unit/background/downloadQueue.test.ts`
- **Files**:
  - `src/background/downloadQueue.ts` — add 2 methods
  - `tests/unit/background/downloadQueue.test.ts` — add tests

#### Task A3: downloader pause/resume/retry + reportProgress two-phase
- **Acceptance**: `pause()` add vào cancelledIds. `resume()` + `retry()` delete khỏi cancelledIds. `reportProgress()` set `downloadProgress` khi downloading, `convertProgress` khi converting.
- **Verify**: `npx tsc --noEmit`
- **Files**:
  - `src/background/downloader.ts` — add 3 methods, modify `reportProgress()`

#### Task A4: Background handlers + createDownloadItem quality
- **Acceptance**: `handleRetryDownload` + `handleRemoveDownload` wired. `createDownloadItem()` set `quality` field. Mock downloader có `retry()`/`remove()`/`pause()`/`resume()`.
- **Verify**: `npx tsc --noEmit` + `npx jest tests/unit/background/integration.test.ts`
- **Files**:
  - `src/background/index.ts` — add 2 handlers, wire `on()`, modify `createDownloadItem`
  - `tests/unit/background/integration.test.ts` — add tests, update mock

**Checkpoint A**: `npx tsc --noEmit` + `npm run build` + `npx jest --silent` — tất cả pass.

---

### Phase B — UI Components

#### Task B1: DownloadCard rewrite — two-phase + action buttons
- **Acceptance**: DownloadCard render 2 progress bar khi converting. Action buttons (pause/resume/cancel/retry/remove) hiện đúng theo status. Phase label + detail items hiển thị. Quality badge bên cạnh title.
- **Verify**: `npx tsc --noEmit`
- **Files**:
  - `src/popup/components/media/DownloadCard.tsx` — rewrite
  - `src/popup/components/media/DownloadCard.module.css` — add styles

#### Task B2: VideoCard + SubtitleCard format icons
- **Acceptance**: VideoCard có icon `▶` bên trái. SubtitleCard có icon `T` bên trái. Icon có màu khác nhau (video=primary, subtitle=secondary).
- **Verify**: `npx tsc --noEmit`
- **Files**:
  - `src/popup/components/media/VideoCard.tsx` — add icon
  - `src/popup/components/media/VideoCard.module.css` — add `.mediaIcon`
  - `src/popup/components/media/SubtitleCard.tsx` — add icon
  - `src/popup/components/media/SubtitleCard.module.css` — add `.mediaIcon`

#### Task B3: SelectionBar component
- **Acceptance**: SelectionBar render khi `selectionCount > 0`. Có nút Clear (X), text "N selected", nút Download. Fixed bottom, slide-up animation.
- **Verify**: `npx tsc --noEmit`
- **Files**:
  - `src/popup/components/SelectionBar.tsx` — new file
  - `src/popup/components/SelectionBar.module.css` — new file

**Checkpoint B**: `npx tsc --noEmit` + `npm run build` — 0 errors.

---

### Phase C — Wiring + Polish

#### Task C1: Wire download control handlers vào App
- **Acceptance**: `handlePauseDownload`, `handleResumeDownload`, `handleCancelDownload`, `handleRetryDownload`, `handleRemoveDownload` gửi message đúng. DownloadCard nhận props. Cancel/Remove xóa item khỏi store (optimistic UI).
- **Verify**: `npx tsc --noEmit` + manual popup
- **Files**:
  - `src/popup/App.redesigned.tsx` — add 5 handlers, pass props vào DownloadCard

#### Task C2: Render SelectionBar + default quality auto-apply
- **Acceptance**: SelectionBar hiện khi `selectedIds.size > 0`. Click Clear → clear selection. Click Download → download selected. Đổi `defaultQuality` → tất cả VideoCards update variant. Content có padding đáy khi bar visible.
- **Verify**: `npx tsc --noEmit` + manual popup
- **Files**:
  - `src/popup/App.redesigned.tsx` — render SelectionBar, useEffect auto-apply
  - `src/popup/App.redesigned.module.css` — add padding đáy

**Checkpoint C**: `npx tsc --noEmit` + `npm run build` + manual popup test.

---

### Phase D — Tests

#### Task D1: DownloadCard unit tests
- **Acceptance**: Tests cover: two-phase render theo status, action buttons visibility, phase labels, quality badge, detail items.
- **Verify**: `npx jest tests/unit/popup/DownloadCard.test.tsx`
- **Files**:
  - `tests/unit/popup/DownloadCard.test.tsx` — new file

#### Task D2: E2E download controls
- **Acceptance**: E2E trên kisskh.co: download → pause → resume → cancel. Download → error → retry → remove. Selection bar flow.
- **Verify**: `npx playwright test e2e/download-controls.spec.ts`
- **Files**:
  - `e2e/download-controls.spec.ts` — new file

#### Task D3: Update docs
- **Acceptance**: `architechture-system.md` có SelectionBar trong cây thư mục + bảng phụ thuộc. `reference-knowledge_base.md` có entries cho bugs mới (nếu có).
- **Verify**: Read files, verify entries exist
- **Files**:
  - `docs/architechture-system.md` — add SelectionBar, update DownloadCard
  - `docs/knowleadge/reference-knowledge_base.md` — add bug entries if any

**Checkpoint D**: `npx jest --silent` + `npx playwright test` — tất cả pass.

---

## Execution Order

```
A1 → A2 → A3 → A4     (sequential — types trước, backend sau)
  ↓
B1 → B2 → B3           (B2 + B3 có thể parallel, B1 trước)
  ↓
C1 → C2                (sequential — wire handlers trước, rồi SelectionBar)
  ↓
D1 → D2 → D3           (D1 + D2 có thể parallel, D3 cuối)
```

## Summary

| Phase | Tasks | Files touched | Est. complexity |
|-------|-------|---------------|-----------------|
| A | 4 | 6 | Medium |
| B | 3 | 8 | Medium-High (B1 rewrite) |
| C | 2 | 2 | Medium |
| D | 3 | 4 | Medium |
| **Total** | **12** | **20** | |
