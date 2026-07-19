# Todo: Web-text dictionary popup + word highlight

## Phase 1: Foundation

- [ ] **T1: Create `WordHighlight` module + unit tests**
  - Description: Implement `createWordHighlight()` với `show(target: Range | HTMLElement)` và `clear()`. Primary DOM wrap `<mark class="js-cell-word-highlight">`, fallback overlay div. Subtitle token chỉ thêm class. Restore DOM khi `clear`.
  - Acceptance:
    - [ ] Unit test wrap/clear continuous range.
    - [ ] Unit test fallback overlay cho inline-tag-split range (`<em>ap</em>ple`).
    - [ ] Unit test element mode (subtitle token span).
    - [ ] Unit test restore DOM sau `clear`.
    - [ ] `npm run test:unit` pass.
  - Files:
    - `src/features/dictionaryPopup/ui/wordHighlight.ts`
    - `src/features/dictionaryPopup/ui/wordHighlight.test.ts`
  - Size: M
  - Dependencies: None

- [ ] **T2: Update `WebTriggerController` to support highlight + skip subtitle tokens**
  - Description: Đổi `onLookup` callback signature thành `(request, requestId, anchorRect, range)`. Thêm skip `.js-cell-token` trong `onMouseMove`/`onMouseUp`. Đảm bảo `Range` được clone trước khi debounce dispatch nếu DOM có thể thay đổi.
  - Acceptance:
    - [ ] `dispatchLookup` truyền `range` cho `onLookup`.
    - [ ] `onMouseMove` return early khi `event.target.closest('.js-cell-token')`.
    - [ ] Unit test mới: skip token span, range passed to callback.
    - [ ] `npm run test:unit` pass.
  - Files:
    - `src/features/dictionaryPopup/trigger/webTriggerController.ts`
    - `src/features/dictionaryPopup/trigger/webTriggerController.test.ts`
  - Size: M
  - Dependencies: None

### Checkpoint: Foundation
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:unit` pass
- [ ] Code review self-check

## Phase 2: Core web-text controller

- [ ] **T3: Create `WebTextDictionaryController` skeleton + unit tests**
  - Description: Tạo `src/features/dictionaryPopup/controller/webTextDictionaryController.ts` với deps interface, `popupDictState` init, `attach`/`detach`/`destroy`/`updateSettings`, và `handleLookup`/`cancelLookup` tối thiểu (chưa cần card creator). Đảm bảo `showPopup`/`appendCandidate` hoạt động.
  - Acceptance:
    - [ ] Controller có API theo spec.
    - [ ] Unit test `handleLookup` gửi `LOOKUP_REQUEST` qua `sendMessage`.
    - [ ] Unit test `cancelLookup` gửi `LOOKUP_CANCEL`.
    - [ ] `npm run test:unit` pass.
  - Files:
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.test.ts`
  - Size: M
  - Dependencies: T1, T2

- [ ] **T4: Integrate `WordHighlight` into `WebTextDictionaryController`**
  - Description: Trong `handleLookup`, gọi `showHighlight(range|element)` trước khi gửi lookup. Trong `onDismiss`/`cancel`/`new trigger`, gọi `clearHighlight()`. Đảm bảo highlight xuất hiện ngay khi trigger, popup vẫn hiện async.
  - Acceptance:
    - [ ] Unit test `handleLookup` gọi `wordHighlight.show` với range.
    - [ ] Unit test popup dismiss / new trigger gọi `wordHighlight.clear`.
    - [ ] `npm run test:unit` pass.
  - Files:
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.test.ts`
  - Size: S
  - Dependencies: T3

- [ ] **T5: Wire `WebTextDictionaryController` at top-level `content-script.ts`**
  - Description: Khởi tạo `WebTextDictionaryController` ở top-level `content-script.ts` khi `dpSettings.enabled`, dùng `onStorageChanged` để update/re-attach. `WebTextDictionaryController` tạo `WebTriggerController` với `onLookup` callback bao gồm `range`.
  - Acceptance:
    - [ ] `content-script.ts` gọi `createWebTextDictionaryController` và `attach(triggerMode)`.
    - [ ] `onStorageChanged` re-trigger `initWebTextDictionary`.
    - [ ] Trang không video vẫn init (Apple HIG / National Geographic).
  - Files:
    - `src/entrypoints/content/content-script.ts`
  - Size: M
  - Dependencies: T3, T4

- [ ] **T6: Add highlight CSS class with tokens**
  - Description: Thêm CSS class `.js-cell-word-highlight` và `.js-cell-word-highlight-overlay` dùng token `var(--color-primary-subtle)`, `var(--radius-xs)`, `color: inherit`. Có thể inject style sheet động hoặc dùng inline style trong `WordHighlight`.
  - Acceptance:
    - [ ] Style không hardcode value, dùng token.
    - [ ] Visual test: highlight có background màu primary-subtle, border-radius.
  - Files:
    - `src/features/dictionaryPopup/ui/wordHighlight.ts` (hoặc CSS file riêng)
  - Size: XS
  - Dependencies: T1

### Checkpoint: Core web-text
- [ ] Manual test Apple HIG: hover/click → highlight + popup đúng target/sentence
- [ ] Manual test `dp.enabled` toggle: bật/tắt trong Settings, behavior thay đổi không reload
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:unit` pass

## Phase 3: Subtitle integration

- [ ] **T7: Extract popup card-creator callbacks into `WebTextDictionaryController`**
  - Description: Tách `handlePopupCardCreatorAction` và `handlePopupQuickAdd` từ `contentScriptController` vào `WebTextDictionaryController`. Controller nhận `container`, optional `video`, optional `getTargetCues()` callback. `cardCreatorMount` lazy-init trong controller.
  - Acceptance:
    - [ ] `WebTextDictionaryController` có `handlePopupCardCreatorAction` + `handlePopupQuickAdd`.
    - [ ] Các method dùng `container` từ deps (document.body hoặc overlay container).
    - [ ] `video` capture screenshot/audio nếu `hasVideo` true.
  - Files:
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
  - Size: L
  - Dependencies: T3

- [ ] **T8: Refactor `contentScriptController` to share `WebTextDictionaryController`**
  - Description: Sửa `initContentScriptController` nhận tham số `webTextCtrl?: WebTextDictionaryController`. `SubtitleTriggerController` gọi `webTextCtrl.handleLookup` và `webTextCtrl.showHighlight(span)`. Xóa `popupDictState`, `popupDictWasPlaying`, `webTextTrigger`, `wireDictionaryPopup`, `handleLookup`, `cancelLookup`, `handlePopupCardCreatorAction`, `handlePopupQuickAdd` từ `contentScriptController` (chuyển vào controller). Giữ `handleCardCreatorAction` của overlay (từ subtitle block) vì nó cần subtitle context.
  - Acceptance:
    - [ ] `initContentScriptController(video, webTextCtrl)` signature.
    - [ ] Subtitle token click/hover gọi `webTextCtrl.handleLookup`.
    - [ ] Subtitle token highlight qua `webTextCtrl.showHighlight(span)`.
    - [ ] `contentScriptController` không còn duplicate popup state.
  - Files:
    - `src/features/subtitle/ui/contentScriptController.ts`
    - `src/entrypoints/content/content-script.ts` (pass controller vào)
  - Size: L
  - Dependencies: T5, T7

### Checkpoint: Subtitle integration
- [ ] Manual test YouTube: subtitle token hover/click → highlight + popup + pause video
- [ ] Manual test card creator từ popup: Quick Add / Send to Card vẫn hoạt động
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:unit` pass

## Phase 4: Settings lifecycle + edge cases

- [ ] **T9: Implement `updateSettings` lifecycle in `WebTextDictionaryController`**
  - Description: `updateSettings` detach trigger cũ, cập nhật settings, attach trigger mới với mode hiện tại. `destroy` clear popup, highlight, listeners. Đảm bảo khi `dp.enabled` false thì controller detach + destroy.
  - Acceptance:
    - [ ] Unit test `updateSettings` với trigger mode khác gọi `detach` + `attach` mới.
    - [ ] Unit test `destroy` clear highlight và popup.
    - [ ] `npm run test:unit` pass.
  - Files:
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.test.ts`
  - Size: S
  - Dependencies: T5

- [ ] **T10: Handle active video re-init on settings enable**
  - Description: Khi `dp.enabled` bật lên trong khi video overlay active, `content-script.ts` cần gọi lại `findAndInitOverlay` (hoặc relax `video === currentVideo` guard) để `contentScriptController` nhận controller mới.
  - Acceptance:
    - [ ] Manual test: bật `dp.enabled` khi đang xem YouTube, subtitle trigger hoạt động ngay.
  - Files:
    - `src/entrypoints/content/content-script.ts`
  - Size: S
  - Dependencies: T8

### Checkpoint: Settings lifecycle
- [ ] Settings change test: đổi trigger mode trong Options, quay lại tab web/text/video, behavior thay đổi
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:unit` pass

## Phase 5: P1/P2 + verification

- [ ] **T11: National Geographic manual test + Shadow DOM / `user-select:none` fixes**
  - Description: Test trên https://www.nationalgeographic.com/animals. Nếu không hoạt động do Shadow DOM hoặc `user-select:none`, implement `composedPath()` fallback hoặc skip logic.
  - Acceptance:
    - [ ] Popup + highlight đúng trên National Geographic.
    - [ ] Shadow DOM open được xử lý nếu có.
    - [ ] `user-select:none` được xử lý hoặc fallback.
  - Files:
    - `src/features/dictionaryPopup/trigger/webTriggerController.ts`
    - `src/features/dictionaryPopup/ui/wordHighlight.ts`
  - Size: M
  - Dependencies: T5, T6

- [ ] **T12: Latency measurement + P1 optimization (if needed)**
  - Description: Đo `performance.now()` từ trigger đến popup render. Nếu warm > 1s, optimize: prefetch phrase index, render skeleton popup, cache lookup results.
  - Acceptance:
    - [ ] Cold-start ≤2s, warm ≤1s trên Apple HIG / National Geographic.
    - [ ] Log latency rõ ràng trong console.
  - Files:
    - `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
  - Size: M
  - Dependencies: T5

- [ ] **T13: Final verification + documentation update**
  - Description: Chạy `tsc`, `test:unit`, `build`, manual test trên 3 trang. Cập nhật `docs/2-architechture-system.md` với file mới và dependency.
  - Acceptance:
    - [ ] `npx tsc --noEmit` clean.
    - [ ] `npm run test:unit` pass.
    - [ ] `npm run build` success.
    - [ ] Manual test Apple HIG + National Geographic + YouTube pass.
    - [ ] `docs/2-architechture-system.md` updated.
  - Files:
    - `docs/2-architechture-system.md`
  - Size: S
  - Dependencies: T11, T12

## Final Checkpoint
- [ ] All P0 acceptance criteria met
- [ ] Spec `docs/specs/web-text-dictionary-popup.md` signed off
- [ ] ADR `docs/adr/046-web-text-dictionary-decouple.md` signed off
- [ ] PR ready (commit message, diff review)
