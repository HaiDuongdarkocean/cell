# Spec: Pre-tokenize toàn bộ subtitle video

## Objective

Xây dựng cơ chế **pre-tokenize + pre-resolve metadata** cho toàn bộ subtitle của video ngay từ khi cues được load, thay vì chỉ tokenize cue đang phát hoặc panel đang render.

**User stories:**

- Là người xem, tôi muốn mở subtitle panel và thấy từ đã có status/frequency màu ngay, không nhấp nháy từ "plain" sang "có màu".
- Là người dùng máy yếu, tôi vẫn muốn pre-tokenize nhưng không bị giật lag.
- Là người học, tôi muốn sau này biết "video này có bao nhiêu % từ đã biết" để chọn nội dung phù hợp trình độ.
- Là người dùng, khi tôi mở 2 tab cùng video hoặc chuyển tab, trạng thái từ (known/tracking/unknown/ignore) phải đồng bộ.

## Tech Stack

- TypeScript
- React (function components + hooks, named export, không `any`)
- Manifest V3 Chrome extension
- `TokenizeScheduler` sẵn có (`requestAnimationFrame` 16ms + `requestIdleCallback`)
- Background service worker message handlers
- IndexedDB extension-origin cho word status / frequency
- `chrome.runtime.sendMessage` + `chrome.tabs.sendMessage` cho cross-tab broadcast

## Commands

```bash
# Verify gates
npm run typecheck
npm run test:unit
npm run build

# Lint / format nếu cần
npm run lint

# Real-Chrome verification khi cần
echo "Use skill testing-extension-browser with mock streaming site"
```

## Project Structure

```
src/features/tokenize/
  controller/subtitleTokenizeController.ts   # mở rộng: VideoTokenMap, tiered prepare
  logic/
    tokenizeScheduler.ts                     # mở rộng: microtask fast path, real budget
    cueListTokens.ts                         # giữ: map + apply status/freq helpers
    videoTokenPreloader.ts                   # MỚI: quản lý pre-tokenize toàn video
  services/
    wordStatusCrossTab.ts                    # MỚI: cross-tab broadcast + local emit
src/features/dictionary/services/
  wordStatusClient.ts                        # giữ: gọi background
  wordStatusStore.ts                         # giữ: IDB SSOT
src/entrypoints/background/handlers/
  wordStatus.ts                              # mở rộng: broadcast WORD_STATUS_CHANGED
src/entrypoints/sidepanel/components/
  CueList.tsx                                # thay đổi: dùng VideoTokenMap thay vì tự tạo
  CueList.module.css                         # giữ layout WIP hiện tại
src/features/subtitle/ui/
  reactSubtitleController.ts                 # kết nối preloader với mount
  contentScriptController.ts                 # kích hoạt pre-tokenize khi cues loaded
```

## Code Style

Ví dụ mẫu:

```ts
export interface VideoTokenMap {
  readonly get: (cueIndex: number) => PreparedCue | undefined;
  readonly set: (cueIndex: number, prepared: PreparedCue) => void;
  readonly applyStatus: (langCode: string, term: string, status: WordStatus) => void;
  readonly onUpdate: (listener: (cueIndex: number) => void) => () => void;
}
```

- Tên hàm động từ + danh từ: `prepareCueMetadata`, `broadcastWordStatus`.
- Tách logic thuần khỏi side effect (tokenize text là thuần; gọi background là side effect).
- Không `any`; dùng `readonly` cho array/object truyền vào.
- SSOT: `VideoTokenMap` là nguồn sự thật cho toàn bộ token của video trong tab đó.

## Testing Strategy

- **Unit tests** bằng Jest:
  - `videoTokenPreloader.test.ts`: tier priority, chunk lookup, pause/resume.
  - `subtitleTokenizeController.test.ts`: pre-tokenize window, cache eviction, apply status.
  - `wordStatusCrossTab.test.ts`: broadcast gửi/nhận, scope by tabId.
- **Integration:** `CueList` nhận token map updates mà không re-render toàn bộ list.
- **E2E (khi cần):** mock site, mở panel, verify không nhấp nháy; 2 tab, đánh dấu known ở tab A, tab B thấy màu đổi.
- **Coverage:** không đặt số % cứng, nhưng logic mới phải có test.

## Boundaries

### Always do
- Chạy `npm run typecheck && npm run test:unit && npm run build` trước commit.
- Cache capacity động theo `navigator.deviceMemory` (low-end ≤1GB dùng 100 blocks).
- Budget thực `performance.now()` trong scheduler, không dùng hằng số 16ms.
- Scope broadcast message bằng `tabId` để tránh fan-out leak.
- Dùng `very-low` frequency fallback cho mọi token có rank dương.

### Ask first
- Thêm dependency mới.
- Thay đổi schema IndexedDB.
- Sửa `manifest.json`.
- Thay đổi API public của `subtitleTokenizeController` hoặc `CueList`.

### Never do
- Commit secrets / debug logs.
- Xóa test cũ vô cớ.
- Chạy `requestIdleCallback` task chạm DOM trực tiếp — chỉ chuẩn bị dữ liệu, render trong rAF.
- Lưu toàn bộ token map vào `chrome.storage.local` (quota nhỏ).
- Đụng `webTokenizeController` (text tokenize trên web page).

## Success Criteria

1. Khi `loadBilingualCues` hoàn tất, pre-tokenize tự động chạy ở background (idle) cho toàn bộ cues.
2. Cue mở ra: viewport cues (±3) đã resolved metadata trước khi render; các cue khác resolved dần khi idle.
3. Panel không còn hiện tượng "từ không màu rồi đổi sang có màu" (nhấp nháy).
4. Overlay vẫn bind viewport cue ngay lập tức (< 16ms).
5. Trên máy low-RAM (≤1GB), thời gian frame không vượt quá 16ms khi viewport cue thay đổi; idle chunk ≤ 50ms.
6. Khi user đánh dấu từ `call` → known ở tab A, tab B cùng video tự động thấy `call` chuyển known trong ≤ 500ms.
7. Phân tích analytics (future): có thể reduce `VideoTokenMap` thành `{ total, known, tracking, unknown, ignore, frequencyBandCounts, coverageByKnownWords }`.

## Definition of Done

- [ ] Tất cả acceptance criteria pass.
- [ ] Unit tests pass (`npm run test:unit`).
- [ ] Typecheck pass (`npm run typecheck`).
- [ ] Build pass (`npm run build`).
- [ ] E2E hoặc Playwright verify trên mock site.
- [ ] `docs/2-architechture-system.md` cập nhật nếu API thay đổi.
- [ ] Không lỗi lint mới.

## Assumptions

- Mỗi tab có JS context riêng nên `VideoTokenMap` không share bộ nhớ giữa các tab; chỉ metadata (word status / frequency) được share qua background IDB + broadcast.
- Text tokenize (`tokenizeTextBlock`) đủ nhanh để mỗi tab tự chạy lại toàn video mà không cần share.
- `navigator.deviceMemory` có sẵn để điều chỉnh cache capacity; fallback 150 nếu không có.
- Word status là nguồn sự thật chung; tần suất (frequency) ít thay đổi nên không cần realtime sync, chỉ cần re-lookup khi cues thay đổi.

## Open Questions

1. Có cần lưu kết quả pre-tokenize vào IndexedDB để lần sau xem lại video nhanh hơn? (risk: dữ liệu lớn, quota)
2. Có muốn tắt pre-tokenize hoàn toàn trên thiết bị low-end hay chỉ giảm chunk size?
3. Có cần pre-tokenize native cue song song với target cue không?

---

*Spec này là nguồn sự thật cho feature. Nếu Anh duyệt, em sẽ chuyển sang phase Plan → Tasks → Implement.*
