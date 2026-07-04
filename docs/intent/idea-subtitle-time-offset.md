# Subtitle Time Offset (V1 — Manual Offset Management)

> Idea-refine output. Nền cho V3 Anchor STT (sync subtitle với voice). V1 = manual offset, V3 = auto-align với Whisper WASM.
> Mockup G0.5: `docs/mockups/mockup-subtitle-time-offset.html` (v2.2 — approved 2026-07-04).

## Problem Statement

**HMW cho phép user dịch chuyển toàn bộ subtitle (theo time) để khớp với voice phim, mà không bắt canh bằng tay từng cue — với UX try-before-buy (xem thử 5 phút trước khi cam kết apply all)?**

Sub drift (sub chạy trước/sau voice) là vấn đề phổ biến khi rip sub từ nguồn khác (23.976 vs 24fps, sub từ Blu-ray ghép video streaming, v.v.). 90% case là **constant offset** — 1 con số áp cho toàn bộ cues là đủ.

## Recommended Direction

**V1 Manual Offset Management** — 6 control (4 button ±0.5s/±2s, 1 input giây, 1 reset) + **lazy try-before-buy mode**:

1. User bấm offset (button/input) → **apply all ngay** (overlay dịch, mode=lazy = chưa persist).
2. Lazy timer 2 phút chạy (wall-clock + event-driven, robust trong MV3).
3. **Mỗi action với 6 control** (4 button, input change debounced, reset) → **reset timer 2 phút** (tính từ action gần nhất).
4. User xem overlay dịch có khớp voice không, có thể tiếp tục tune (mỗi tune reset timer).
5. **2 phút không có action nào với 6 control** → **auto-commit + persist** với `value` hiện tại (cam kết).
6. Reset button = set `value=0` (vẫn ở lazy mode, timer reset). Nếu 2 phút sau không touch gì → commit 0 = không thay đổi gì (tương đương revert toàn bộ).

> **Revised 2026-07-04 (drop C2 lazy window)**: V1 trước đây có "5-phút window `[anchor, anchor+5phút]`" constraint (offset chỉ apply cho cue trong window). Đã **drop** — lý do: window constraint đòi per-cue effective (rebuild `effectiveCues[]` O(n) mỗi lần tune), trong khi drop C2 chỉ gán 1 `offsetMs` biến + binary search O(log n) giữ nguyên. User-perceived behavior không đổi (user chỉ xem cue hiện tại, không quay lại cues đã qua trong lazy session). Lazy mode giờ = "apply all ngay, chưa persist" + badge "Xem thử · MM:SS" đếm ngược 2 phút.

**Lý do chọn V1 làm nền trước** (thay vì V3 Anchor STT ngay):
- Ponytail rung 1-2: 90% case sub drift là constant offset, manual đủ giải quyết, không cần STT 1-2GB RAM.
- V3 Anchor STT cần Whisper WASM — phải verify CSP/MV3 sandbox cho phép `WebAssembly.instantiate` trong content-script trước (kill risk cao).
- V1 cho anh trải nghiệm UX offset, từ đó refine V3 (V3 output cũng là offset, chỉ thay bước "user bấm" bằng "Whisper detect").
- V1 tái dùng `findCurrentLine` (binary search) + `subtitleManagerPanel` (panel pattern) hiện có — ít code mới.

## UI Design (mockup v2.2 — approved)

> Source: `docs/mockups/mockup-subtitle-time-offset.html`. 4 state (disabled / default / lazy-active / committed). Bỏ state warning (V1 không detect progressive drift).

### Layout
- **Panel**: 240px width, absolute top-left trong video wrapper, mimic `subtitleManagerPanel` pattern (DOM factory, cssText inline, `var(--token)`).
- **Header**: text "Độ lệch" (không icon) + close button (icon X 18×18).
- **Value row**: offset hiện tại (tabular-nums) bên trái + reset button (icon 26×26) bên phải. Color: zero=muted, positive=success (xanh), negative=info (xanh dương).
- **Stepper**: 4 button grid 1×4, mỗi cái 40px min-height, text-only (không icon): `−2s | −0.5s | +0.5s | +2s`. Text `+` màu success, `−` màu info (color blind safe — có dấu +/− text).
- **Input row**: input (placeholder "nhập số giây", suffix "s") + button "Áp dụng" (min-width 64px, primary bg).
- **Disabled hint**: "Cần load subtitle trước" (state 1 only).

### Interaction feedback
- **Press feedback (đàn hồi)**: tất cả button `transform: scale(0.94)` + bg `primary-subtle` khi `:active` (80ms ease). Reset `scale(0.9)`, apply `scale(0.95)`, close `scale(0.85)`.
- **Apply success feedback**: click "Áp dụng" → button đổi bg `--color-success` + text "✓ Đã lưu" 1.5s → revert. Không break layout (feedback tại nơi click). State 4 giữ permanent "✓ Đã lưu".
- **Lazy badge**: pill nhỏ top-right overlay, "Xem thử · 1:23" + dot pulse animation. Click badge = reset (hủy xem thử).
- **Touch**: `-webkit-tap-highlight-color: transparent` (no flash), min-height ≥40px (touch target).

### A11y
- `role="dialog"`, `aria-label="Độ lệch subtitle"` trên panel.
- Mỗi button có `aria-label` mô tả action (vd: "Lùi 2 giây", "Tiến 0.5 giây", "Đặt lại").
- Lazy badge: `role="status"`, `aria-label` dynamic "Đang xem thử, còn 1 phút 23 giây, bấm để hủy".
- Apply saved: `aria-label` đổi "Áp dụng" → "Đã lưu" khi flash.
- Color blind: `+`/`−` text + màu (không dựa màu duy nhất).
- Keyboard: Tab order, focus-visible `outline 2px solid --color-border-focus, offset 1px`.

### Đơn vị
- **UI hiển thị**: giây (s). Value display `+0.7s`, input suffix `s`, placeholder "nhập số giây".
- **Parser**: chấp nhận `0.7`, `1.5`, `-0.5` (giây). Internal convert sang ms (`× 1000`) để apply vào `SrtCue.start` (ms).
- **Internal storage**: ms (khớp `SrtCue` type). UI ↔ internal convert ở boundary.

## Key Assumptions to Validate

- [ ] **A1 — Drift là constant, không progressive**: 1 offset global khớp toàn bộ. Test: load 3 phim rip khác nguồn, bấm offset ở đầu + cuối phim, xem 2 số có gần nhau không. Nếu lệch > 500ms → progressive (V1 không xử lý, known limitation).
- [ ] **A2 — `findCurrentLine` search trên effective cues (đã apply offset) không break binary search invariant**: effective cues vẫn monotonic nếu shift đồng đều. Test: unit test `findCurrentLine(effectiveCues, t)` với offset ±5000ms.
- [ ] **A3 — Wall-clock lazy timer fire đúng sau 2 phút không action với 6 control** kể cả tab throttle/sleep: mỗi action reset timer, 2 phút không touch control → auto-commit. Test: bấm offset, switch tab 2 phút, quay lại verify auto-commit chạy. Test: bấm offset, 90s sau bấm tiếp, verify timer reset (tổng cộng 3.5 phút mới commit).
- [ ] **A4 — `settingsStore` cho phép per-video URL key**: verify `Record<url, number>` serialize/deserialize không truncate URL dài (YouTube URL có query string dài).
- [ ] **A5 — Clamp offset `[-60, 60]` giây (±60s) đủ rộng cho mọi case thực tế**: nếu phim rip lệch > 60s → chắc chắn sub hỏng, không phải offset. Test với 5 phim thực tế.

## MVP Scope

### In scope (V1)
- 4 button: `−2s`, `−0.5s`, `+0.5s`, `+2s` (accumulate)
- 1 input field: nhập offset trực tiếp (đơn vị giây, parser flexible: `0.7`, `1.5`, `-0.5`)
- 1 reset button (revert về 0)
- Lazy try-before-buy mode (apply all ngay, chưa persist; timer 2 phút wall-clock, reset mỗi action với 6 control)
- Auto-commit apply all sau 2 phút không action nào với 6 control
- Persist per-video URL trong `settingsStore`
- Bilingual mode: 1 offset chung cho target + native
- Clamp `[-60, 60]` giây, clamp cue `effectiveStart ≥ 0`, `effectiveEnd ≤ duration`
- Lazy badge trên overlay ("Xem thử · 1:23" + dot pulse)
- Keyboard shortcut: `[` `]` = ∓0.5s, `{` `}` = ∓2s, `\` = reset
- Panel riêng (mimic `subtitleManagerPanel` pattern, 240px width)
- Press feedback đàn hồi (scale 0.94 + bg subtle, 80ms)
- Apply success feedback (button flash "✓ Đã lưu" 1.5s, không break layout)

### Out of scope (Phase 2+)
- V3 Anchor STT (Whisper WASM auto-detect offset)
- Per-cue retime (mỗi cue 1 offset riêng — cho progressive drift)
- Bilingual tách offset (target ≠ native)
- Undo/redo stack
- Offset history log
- Progressive drift detect + warn (V1 không có, bỏ khỏi mockup)

## Not Doing (and Why)

- **V3 Anchor STT trong V1** — cần verify Whisper WASM CSP/MV3 feasibility trước (A2 kill risk), V1 cho anh UX nền trước.
- **Per-cue retime** — phá assumption "shift đồng đều", binary search invariant phức tạp, 90% case constant offset đủ. Phase 2 nếu progressive drift phổ biến.
- **Bilingual tách offset** — 90% case 2 sub cùng nguồn drift giống nhau. Tách = double UI, double state. Phase 2 nếu có demand.
- **Undo/redo** — reset về 0 đủ cho V1. Undo stack = scope creep.
- **Global offset (1 cho mọi video)** — sai (mỗi phim drift khác nhau). Per-video URL là đúng trade-off.
- **Sync offset cross-tab realtime** — offset là trial-and-error, sync chéo gây nhầm lẫn. Persist chỉ khi commit.
- **setTimeout cho lazy timer** — MV3 content-script throttle/sleep kill timer. Wall-clock + event-driven robust hơn (R13).
- **Progressive drift detect/warn trong V1** — hệ thống chưa có chế độ nhận biết lệch. Bỏ khỏi mockup + scope. Phase 2 cùng V3 Anchor STT.
- **Icon trong stepper buttons** — text-only đơn giản hơn, UI sạch. Color blind safe qua dấu +/− text.
- **Saved-indicator div riêng** — break layout. Feedback chuyển lên button "Áp dụng" (flash "✓ Đã lưu").

## Edge Case Reference (phân tích đầy đủ ở conversation)

### Phổ biến (P1-P8)
- P1 Cue đang xem biến mất → `findCurrentLine` search effective cues, overlay tự hiển thị cue mới.
- P2 Accumulate (button) vs replace (input).
- P3 Parser flexible: `0.7`, `1.5`, `-0.5` (giây). Internal convert ms. Clamp ±60s.
- P4 Clamp `effectiveStart ≥ 0`, `effectiveEnd ≤ duration` (không mutate `SrtCue` gốc).
- P5 Bilingual: 1 offset chung V1.
- P6 Persist per-video URL, reset khi load sub file mới.
- P7 Reset = về 0 (không undo).
- P8 Disable control khi chưa load subtitle.

### Hiếm (R1-R14) — quan trọng vì hay bị bỏ quẩn
- **R1 Progressive drift** — V1 không detect, không warn. Known limitation. Phase 2 + V3.
- **R2 Lazy window gap im lặng** — fallback apply all ngay + toast.
- **R3 Seek ra khỏi window** — ~~window cố định (anchor lúc bấm), timer vẫn chạy~~ **DROPPED 2026-07-04** (C2 dropped, không còn window). Seek tự do, offset apply all, timer vẫn chạy.
- **R4 Bấm liên tục trong window** — ~~reset timer mỗi lần bấm **bất kỳ control nào** (4 button, input change, reset), accumulate value, anchor giữ nguyên. "2 phút không action" = 2 phút không touch 6 control~~ **Revised 2026-07-04**: reset timer mỗi lần bấm **bất kỳ control nào** (4 button, input change, reset), accumulate value. "2 phút không action" = 2 phút không touch 6 control. (Không còn anchor — C2 dropped.)
- **R5 Load sub mới trong lazy** — cancel lazy + reset offset.
- **R6 Cue non-monotonic** — sort lúc parse (defensive, trong `subtitleParser.ts`).
- **R7 Cue zero-duration** — skip trong `findCurrentLine`.
- **R8 Multiple tabs** — per-tab state, persist chỉ khi commit.
- **R9 Offset parser** — đơn vị giây, không suffix = giây. Internal × 1000 sang ms.
- **R10 Video clock drift** — out of scope, known limitation, V3 giải quyết.
- **R11 Pause khi bấm offset** — lazy vẫn chạy (wall-clock).
- **R12 Reset lúc committed** — `value=0, mode=committed` = revert.
- **R13 MV3 tab sleep** — wall-clock + `visibilitychange`/`timeupdate` check, không `setTimeout`.
- **R14 Cue merge** — N/A V1 (shift đồng đều).

## Resolved Questions (confirmed by Anh yêu)

- Window 5 phút: ~~`[anchor, anchor+5phút]` (asymmetric, forward-only). Anchor = `currentTime` lúc bấm offset lần đầu trong lazy session.~~ **DROPPED 2026-07-04** — lazy mode apply all ngay, không window constraint (xem AD1-revised trong spec).
- Timer 2 phút: reset mỗi lần bấm **bất kỳ control nào** (4 button, input, reset). "2 phút không action với 6 control" = commit.
- Keyboard shortcut `[` `]` `}` `{` `\` — anh confirm không conflict (em vẫn grep `subtitleShortcuts.ts` verify ở G1).
- Persist key: URL gốc (full URL, không chỉ videoId).
- Offset sign convention: `+0.5s` = sub chạy **trước** voice → đẩy sub **muộn** hơn. `effectiveStart = cue.start + offset` (offset dương = start tăng = sub hiện sau). `−0.5s` = sub chạy sau voice → đẩy sub sớm hơn.
- Đơn vị UI: giây (s). Internal: ms (khớp `SrtCue`). Convert ở boundary.
- UI: text-only buttons (không icon stepper), press feedback đàn hồi, apply flash "✓ Đã lưu" (không saved-indicator div).
- Bỏ state warning (progressive drift) — V1 không detect.

## Open Questions

- (không còn — vào G1 Spec)
