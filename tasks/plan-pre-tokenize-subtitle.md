# Implementation Plan: Pre-tokenize toàn bộ subtitle video

## Overview

Xây dựng `VideoTokenMap` là single source of truth cho toàn bộ token của video trong một tab, tích hợp với `TokenizeScheduler` để pre-tokenize theo tầng ưu tiên, và đồng bộ trạng thái từ (known/tracking/unknown/ignore) giữa các tab qua background broadcast.

## Architecture Decisions

1. **Mỗi tab tự xây `VideoTokenMap` riêng, chỉ share metadata.**
   - Text tokenize nhanh; map toàn video lớn, không share bộ nhớ cross-tab.
   - Word status là SSOT trong background IndexedDB; tab cũ dùng broadcast, tab mới đọc lại.

2. **Dùng `TokenizeScheduler` sẵn có, mở rộng thêm tier idle + chunk lookup.**
   - Không tạo scheduler mới.
   - Thêm microtask fast path và real `performance.now()` budget theo bài học `learning-and-apply`.

3. **Cross-tab broadcast qua `chrome.runtime.sendMessage`/`chrome.tabs.sendMessage`, scope by `tabId`.**
   - Tránh fan-out leak qua payload identifier.
   - Chỉ broadcast sau khi IndexedDB write thành công.

4. **CueList không còn tự tạo token map.**
   - Subscribes `VideoTokenMap` updates; re-render incremental per cue.
   - Chưa hoàn thành trong slice này — cần message bridge giữa content script và sidepanel.

## Task List

### Phase 1: Cross-tab status sync (foundation)
- [x] Task 1: `WORD_STATUS_CHANGED` message contract + registry
- [x] Task 2: Background broadcast on successful `WORD_STATUS_SET`
- [x] Task 3: Content-script cross-tab listener + local event emit

### Checkpoint: Cross-tab
- [x] `npm run test:unit -- --grep wordStatus` pass
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

### Phase 2: Pre-tokenize data layer
- [x] Task 4: `VideoTokenMap` data structure + unit tests
- [x] Task 5: `videoTokenPreloader` tiered scheduler + chunk metadata lookup
- [x] Task 6: `TokenizeScheduler` microtask fast path + real budget

### Checkpoint: Pre-tokenize
- [x] `npm run test:unit -- --grep tokenize` pass
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

### Phase 3: Integration
- [x] Task 7: Wire `subtitleTokenizeController` to `VideoTokenMap`
- [ ] Task 8: Refactor `CueList` to consume shared map (blocked: needs sidepanel bridge)
- [x] Task 9: Update `docs/2-architechture-system.md`

### Checkpoint: Integration
- [x] Full `npm run test:unit` pass
- [x] `npm run typecheck` pass
- [x] `npm run build` pass
- [ ] Real-Chrome verify on mock site

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Video dài, terms hàng nghìn | High | Chia chunk 100–200 terms; pause idle khi tab hidden |
| Máy yếu vẫn lag | High | Cache capacity động theo `navigator.deviceMemory`; real budget scheduler |
| Cross-tab broadcast quá nhiều | Medium | Scope by tabId; chỉ broadcast status change, không broadcast toàn bộ map |
| CueList refactor lớn | Medium | Vertical slice: tách `VideoTokenMap` trước, refactor CueList sau |

## Open Questions

1. Có lưu pre-tokenize map vào IndexedDB cho lần sau? (tạm trả lời: không, vì quota; để future.)  
2. Có cần tắt hoàn toàn trên low-end? (tạm trả lời: giảm chunk + capacity, không tắt.)  
3. Native cue có pre-tokenize song song? (tạm trả lời: có, vì ít tốn kém.)  
4. CueList sidepanel nhận `VideoTokenMap` như thế nào? (tạm trả lời: cần design message bridge hoặc prepared-cue snapshot ở slice sau.)
