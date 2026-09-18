# Intent — Adaptive Subtitles

Backlog: `docs/ideas/product-backlog.md` #9 `adaptive-subtitles` (group: Quản lý Phụ đề thích ứng).

## Pain

Sub luôn hiện = đọc thay vì nghe. Coverage cao → đáng lẽ phải ẩn sub để nghe; coverage thấp → cần translation để không mất mạch truyện. Hôm nay user phải tự bật/tắt sub thủ công từng cue — không ai làm vậy khi đang xem phim.

## Goal

Một study mode mới — **Adaptive** — tự quyết định visibility của subtitle **theo từng cue** dựa trên độ khó cue đó (số từ learnable = unknown|tracking trong band frequency user chọn):

- Cue dễ (0 từ lạ) → ẩn hết sub → buộc nghe.
- Cue vừa sức (1–2 từ lạ) → chỉ target sub → đọc hỗ trợ, vẫn nghe.
- Cue dày (≥3 từ lạ) → target + native → translation cứu mạch truyện.

User chọn mode như mọi preset khác (Normal/Listen/Read/…), không cần hiểu threshold.

## Why now

Toàn bộ machinery đã sẵn từ #4/#5/#7:

- `cueDifficultyMap` + `cueHeatBand` — định nghĩa "cue khó" shared với heat map + FAB.
- `createUnknownCueResolver` — đã resolve per-cue tokenMap + statuses + freq, chỉ đang expose "first pausable word"; expose thêm band là rẻ.
- `StudyStep.subtitle` + `StudyModePlaybackController` — state machine đã emit `setSubtitle` tại mỗi cue boundary, đúng chỗ cần adaptive quyết định.
- `studyBaseline` restore + `applySubtitleHidden` + panel blur — lifecycle/manual-override semantics đã battle-tested.

Adaptive chỉ làm cho `subtitle` value của step trở thành data-driven thay vì static.

## Non-goals

- Không đụng persisted style (`visible` trong style settings là runtime-owned — lesson `persisted-style-must-not-carry-runtime-visibility`).
- Không port study modes sang local player (local player không có study-mode stack — adaptive sống đúng các surface có modes: streaming overlay + side panel).
- Không adaptive theo rolling-window/video-level — quyết định per-cue tại boundary (đơn giản, dự đoán được, khớp state machine).
- Không mid-cue flip — mark-known giữa cue apply ở boundary kế (consistent với pauseOnUnknown).

## Success criteria

- Bật mode Adaptive trên video có cues: cue dễ sub tắt, cue khó sub bật — không chạm tay.
- Tắt mode → visibility trả về baseline trước khi bật.
- Probe chưa sẵn (resolver đang load / không có resolver) → fallback 'both' (hành xử y hệt Normal — không bao giờ "mất sub" vì thiếu data). Chưa import freq list thì bands vẫn tính được (mọi từ learnable đếm — unfiltered), không phải fallback.
