# Todo: Pre-tokenize toàn bộ subtitle video

## Phase 1: Cross-tab status sync

## Task 1: `WORD_STATUS_CHANGED` message contract + registry
**Description:** Thêm message type, schema, type, và registry entry cho sự kiện đồng bộ trạng thái từ giữa các tab.

**Acceptance criteria:**
- [x] Có hằng số `WORD_STATUS_CHANGED` trong `messages.ts`.
- [x] Có schema `WordStatusChangedPayload` trong `dictionarySchemas.ts`.
- [x] Có type trong `types.ts`.
- [x] Message registry đăng ký handler type.

**Verification:**
- [x] `npm run typecheck` pass.
- [x] Unit test qua wordStatus handler.

**Dependencies:** None
**Priority:** P0
**Parallel:** false
**Blocked strategy:** N/A
**Files likely touched:**
- `src/shared/config/messages.ts`
- `src/entities/message/dictionarySchemas.ts`
- `src/entities/message/types.ts`
- `src/entities/message/registry.ts`

**Estimated scope:** Small

---

## Task 2: Background broadcast on successful `WORD_STATUS_SET`
**Description:** Sau khi `setWordStatus` lưu IndexedDB thành công, background gửi `WORD_STATUS_CHANGED` đến các tab khác (và có thể tab gốc để đảm bảo consistency nếu cần).

**Acceptance criteria:**
- [x] Broadcast chỉ xảy ra khi persistence success.
- [x] Payload chứa `langCode`, `term`, `status`, `tabId`.
- [x] Không broadcast khi lỗi/quota-exceeded.
- [x] Scope by tabId: gửi `chrome.tabs.sendMessage` đến các tab khác.

**Verification:**
- [x] Unit test: success path gọi broadcast; failure path không gọi.
- [x] `npm run test:unit -- --grep wordStatus` pass.

**Dependencies:** Task 1
**Priority:** P0
**Parallel:** false
**Blocked strategy:** mock-contract
**Files likely touched:**
- `src/entrypoints/background/handlers/wordStatus.ts`
- `src/entrypoints/background/handlers/wordStatus.test.ts`

**Estimated scope:** Small

---

## Task 3: Content-script cross-tab listener + local event emit
**Description:** Content script nhận `WORD_STATUS_CHANGED` từ background rồi forward vào `wordStatusEvents` local bus. Đảm bảo cleanup khi destroy.

**Acceptance criteria:**
- [x] Listener attach trong content script lifecycle.
- [x] Nhận payload, gọi `emitWordStatusChanged`.
- [x] Validate payload qua schema.
- [x] Cleanup listener khi gọi hàm trả về.

**Verification:**
- [x] Unit test: nhận message → local event emit; sai payload → bỏ qua.
- [x] `npm run test:unit -- --grep wordStatusCrossTab` pass.

**Dependencies:** Task 1, Task 2
**Priority:** P0
**Parallel:** false
**Blocked strategy:** wait
**Files likely touched:**
- `src/features/dictionary/services/wordStatusCrossTab.ts` (new)
- `src/features/dictionary/services/wordStatusCrossTab.test.ts` (new)
- `src/features/dictionary/services/wordStatusEvents.ts`
- `src/entrypoints/content/index.ts` hoặc nơi attach listener

**Estimated scope:** Small

---

## Checkpoint 1
- [x] `npm run typecheck` pass
- [x] `npm run test:unit -- --grep wordStatus` pass
- [x] `npm run build` pass

---

## Phase 2: Pre-tokenize data layer

## Task 4: `VideoTokenMap` data structure + unit tests
**Description:** Tạo `VideoTokenMap` lưu `PreparedCue` theo index, hỗ trợ apply status/frequency, subscribe per-cue updates, and clear/reset.

**Acceptance criteria:**
- [x] Map có `get`, `prepare`, `has`, `clear`.
- [x] `applyStatus(term, status)` cập nhật tất cả cue chứa term, emit `onUpdate(cueIndex)`.
- [x] `termSet` deduplicate để biết term nào cần resolve.
- [x] Subscribe/unsubscribe cleanup.

**Verification:**
- [x] Unit tests: set/get, apply status across multiple cues, unsubscribe.
- [x] `npm run test:unit -- --grep videoTokenMap` pass.

**Dependencies:** None
**Priority:** P0
**Parallel:** true (với Task 1–3 vì file riêng, nhưng logic cần apply status từ Task 3 sau)
**Blocked strategy:** mock-contract
**Files likely touched:**
- `src/features/tokenize/logic/videoTokenMap.ts` (new)
- `src/features/tokenize/logic/videoTokenMap.test.ts` (new)

**Estimated scope:** Small

---

## Task 5: `videoTokenPreloader` tiered scheduler + chunk metadata lookup
**Description:** Điều phối pre-tokenize theo tầng ưu tiên: viewport → prepare ±N → buffer → idle. Gom terms thành chunk 100–200, gọi background batch lookup status/frequency. Deduplicate in-flight requests.

**Acceptance criteria:**
- [x] Tier 0: active cue tokenize + resolve ngay.
- [x] Tier 1: ±N cues kế tiếp resolve trong rAF/rIC.
- [x] Tier 2/3: chunk theo 100–200 terms, không gửi message quá lớn.
- [x] Pause/resume khi tab hidden, video pause, user seek.
- [x] Không tra lại term đã resolved.

**Verification:**
- [x] Unit tests: tier priority, chunk size, pause/resume, deduplicate.
- [x] `npm run test:unit -- --grep videoTokenPreloader` pass.

**Dependencies:** Task 4
**Priority:** P0
**Parallel:** false
**Blocked strategy:** wait
**Files likely touched:**
- `src/features/tokenize/logic/videoTokenPreloader.ts` (new)
- `src/features/tokenize/logic/videoTokenPreloader.test.ts` (new)
- `src/features/tokenize/logic/cueListTokens.ts` (reuse helpers)
- `src/features/tokenize/logic/textTokenizer.ts`

**Estimated scope:** Medium

---

## Task 6: `TokenizeScheduler` microtask fast path + real budget
**Description:** Mở rộng scheduler sẵn có theo bài học `raf-mutation-fast-path-incremental-tokenize`: thêm queueMicrotask fast path cho viewport tasks và dùng `performance.now()` thay vì hằng số 16ms.

**Acceptance criteria:**
- [x] Viewport task có thể flush qua `queueMicrotask` khi batch nhỏ.
- [x] Budget `timeRemaining` dùng `performance.now()` động.
- [x] Không làm hỏng existing tests.

**Verification:**
- [x] Unit test: microtask flush, real budget.
- [x] `npm run test:unit -- --grep tokenizeScheduler` pass.

**Dependencies:** None
**Priority:** P1
**Parallel:** true (với Task 4–5)
**Blocked strategy:** mock-contract
**Files likely touched:**
- `src/features/tokenize/logic/tokenizeScheduler.ts`
- `src/features/tokenize/logic/tokenizeScheduler.test.ts`

**Estimated scope:** Small

---

## Checkpoint 2
- [x] `npm run test:unit -- --grep tokenize` pass
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

---

## Phase 3: Integration

## Task 7: Wire `subtitleTokenizeController` to `VideoTokenMap`
**Description:** Thay thế cache cue hiện tại trong `subtitleTokenizeController` bằng `VideoTokenMap` và `videoTokenPreloader`. Overlay vẫn bind viewport cue ngay lập tức, panel nhận shared map.

**Acceptance criteria:**
- [x] Controller sử dụng `VideoTokenMap` thay vì prepared cue cache cũ.
- [x] `setCues(cues)` khởi tạo preloader.
- [x] `render(activeIndex)` ưu tiên viewport cue.
- [x] Cross-tab status change cập nhật overlay tokens ngay.

**Verification:**
- [x] Unit tests: controller with mock preloader, status change update.
- [x] `npm run test:unit -- --grep subtitleTokenize` pass.

**Dependencies:** Task 3, Task 4, Task 5
**Priority:** P0
**Parallel:** false
**Blocked strategy:** wait
**Files likely touched:**
- `src/features/tokenize/controller/subtitleTokenizeController.ts`
- `src/features/tokenize/controller/subtitleTokenizeController.test.ts`
- `src/features/subtitle/ui/contentScriptController.ts`
- `src/features/subtitle/ui/reactSubtitleController.ts`

**Estimated scope:** Medium

---

## Task 8: Refactor `CueList` to consume shared map
**Description:** `CueList` không còn tự tạo `createCueListTokenMap` và `resolveCueListTokenMetadata` độc lập. Nó nhận `VideoTokenMap` từ context/controller, subscribe per-cue updates, render từ map.

**Acceptance criteria:**
- [ ] CueList không tạo token map riêng.
- [ ] CueList render từ `VideoTokenMap.get(cueIndex)`.
- [ ] Cập nhật từng cue khi map emit `onUpdate(cueIndex)`, không re-render toàn bộ list.
- [ ] Không nhấp nháy: viewport cues đã resolved trước khi hiện.

**Verification:**
- [ ] Unit/ integration test: CueList render from map, update one cue.
- [ ] `npm run test:unit -- --grep CueList` pass.

**Dependencies:** Task 7
**Priority:** P0
**Parallel:** false
**Blocked strategy:** wait
**Files likely touched:**
- `src/entrypoints/sidepanel/components/CueList.tsx`
- `src/entrypoints/sidepanel/components/CueList.module.css` (giữ WIP)
- `src/entrypoints/sidepanel/components/CueList.test.tsx` (nếu có)

**Estimated scope:** Medium

**Notes:** Chưa hoàn thành trong slice này. `VideoTokenMap` sống trong content-script world; sidepanel cần message bridge hoặc shared prepared-cue snapshot để nhận map. Layout CueList đã được cập nhật (timestamp xuống `.actions` row) nhưng vẫn dùng `createCueListTokenMap` local.

---

## Task 9: Update `docs/2-architechture-system.md`
**Description:** Cập nhật tài liệu kiến trúc mô tả `VideoTokenMap`, `videoTokenPreloader`, cross-tab sync.

**Acceptance criteria:**
- [x] `docs/2-architechture-system.md` mô tả luồng mới.
- [x] Giải thích `WORD_STATUS_CHANGED` broadcast.
- [x] Nêu rõ web text tokenize không bị ảnh hưởng.

**Verification:**
- [x] Manual review file.

**Dependencies:** Task 7, Task 8
**Priority:** P1
**Parallel:** true (với Task 8, sau Task 7)
**Blocked strategy:** wait
**Files likely touched:**
- `docs/2-architechture-system.md`

**Estimated scope:** Small

---

## Checkpoint 3
- [x] `npm run test:unit` pass
- [x] `npm run typecheck` pass
- [x] `npm run build` pass
- [ ] Real-Chrome verify trên mock site

---

## Definition of Done (project-wide)
- [x] All acceptance criteria pass (trừ Task 8 chưa hoàn thành)
- [x] Unit tests pass
- [x] `npm run typecheck` pass
- [x] `npm run build` pass
- [x] `docs/2-architechture-system.md` updated
- [x] No lint errors
- [ ] `git status` clean of unrelated files
