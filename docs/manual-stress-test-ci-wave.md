# Manual Stress Test — Krashen CI wave (backlog #4–#10)

Chuẩn bị chung:

- `npm run build` mới nhất, load extension (clone profile hoặc Chrome-for-Testing).
- `npm run mock` → mở StreamFlix `http://127.0.0.1:4321/index.html` (legs streaming).
- Local-player: mở extension page, drop 1 video + 1 file `.srt` tiếng Anh.
- Side panel/panel subtitle: bật bằng phím `t` trên trang streaming.
- Mở sẵn side panel hoặc popup để đổi word status nhanh (click token → cycle status).

---

## 1. `cue-recommend-fab` (#4) — FAB lọc cue i+1

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1.1 | Load trang streaming, bật panel (`t`) | FAB lọc xuất hiện góc phải dưới subtitle panel (chỉ khi tokenize bật cho URL) |
| 1.2 | Click FAB → chọn **Một từ mới (i+1)** | List chỉ còn cue có **đúng 1 từ unknown và 0 từ tracking**; cue 2+ từ lạ hay có từ đang học đều bị loại; chip đếm khớp |
| 1.3 | Mark toàn bộ từ trong video = known | Cue i+1 → 0; empty state rõ ràng, không crash, không list trắng |
| 1.4 | Mark 1 từ trong 1 cue = unknown → quay lại list | List update **live** không cần reload (filter re-derive) |
| 1.5 | Đổi filter liên tục nhanh all → i1 → hasUnknown → all | Không flicker vô hạn, scroll reset đúng về đầu khi đổi epoch, không re-resolve metadata thừa |
| 1.6 | Click 1 cue đã lọc | Seek đúng tới cue đó, highlight đúng cue (half-open boundary) |
| 1.7 | Seek tới biên `end` của cue (overlap boundary) | Highlight cue sau, không double-highlight |
| 1.8 | Reload trang | Filter mode persist nếu đã lưu; không lỗi khi chưa có cues |
| 1.9 | Mở menu FAB | 5 mục đúng thứ tự: **i+1 → Has new words → Words I'm learning → No new words → All cues**; không có icon/checkmark; container bo góc nhẹ (~6px); nhãn màu chữ chính, số đếm màu muted |
| 1.10 | Cue có ≥2 từ lạ trong list | Không xuất hiện trong i+1 nhưng **có** trong Has new words; heat dot = dense khớp với filter |
| 1.11 | Cue chỉ có từ tracking (đang học) | Không vào i+1, không vào Has new words; chỉ vào Words I'm learning |

## 2. `cue-difficulty-map` (#5) — Heat bar độ khó

| # | Bước | Kỳ vọng |
|---|------|---------|
| 2.1 | Panel mở, tokenize on | Mỗi cue item có `data-heat` (easy/i1/dense) + bar màu trái |
| 2.2 | Hover bar heat | Tooltip hiện số từ lạ; opacity khác nhau theo band (không chỉ dựa màu) |
| 2.3 | Đổi status 1 từ trong cue | `data-heat` cue đó đổi band live (known→unknown: easy→i1/dense) |
| 2.4 | Tắt tokenize cho URL | Heat biến mất sạch, không orphan bar |
| 2.5 | Screen reader (hoặc inspect) | `VisuallyHidden` label + `aria-describedby` trên timestamp; bar `aria-hidden` |
| 2.6 | Video dài (nhiều cue) + scroll nhanh | Heat đúng trên từng cue sau rerender, không lệch index |

## 3. `i1-content-queue` (#6) — Sort "Best fit (i+1)"

| # | Bước | Kỳ vọng |
|---|------|---------|
| 3.1 | Local player → library có ≥3 video | Sort dropdown có **Best fit (i+1)** |
| 3.2 | Chọn Best fit | Video sort theo `|coverage − 95|`; unscored xếp cuối |
| 3.3 | Đổi word status vài từ (popup/dictionary) | Rescore chạy nền (debounce), card update badge live, không reload |
| 3.4 | Mở tab extension khác đổi status | Local player rescore cross-tab |
| 3.5 | Video chưa score + video lỗi file | Không crash; unscored cuối list; badge chỉ hiện khi có comprehension |
| 3.6 | Đổi sort qua lại name/date/fit liên tục | Grid re-sort đúng (regression cũ: dropdown từng là dead UI) |
| 3.7 | Reject permission folder khi được hỏi | Scoring silent skip, không prompt lặp, không lỗi console |
| 3.8 | Play video → quay lại library | `comprehension` không bị xóa khi record merge |

## 4. `immersion-clock` (#7) — Đồng hồ immersion

| # | Bước | Kỳ vọng |
|---|------|---------|
| 4.1 | Library view | Card Immersion Stats trên đỉnh (kể cả empty library) |
| 4.2 | Play local video 1–2 phút | Total time tăng sau flush (~15s), đúng wall-clock không đếm paused |
| 4.3 | Pause giữa chừng, resume | Không đếm thời gian paused; segment flush đúng khi pause/unmount |
| 4.4 | Seek tua qua lại | Chỉ đếm thời gian xem thật, không đếm jump |
| 4.5 | Streaming: play trên mock ≥30s (có cues) | Tracker đếm; tab không có cues → không đếm |
| 4.6 | Đóng tab streaming giữa chừng | Segment đóng sạch (closeTab), không leak session |
| 4.7 | Qua nửa đêm (hoặc đổi giờ máy) | Record split qua local-midnight, today/streak đúng |
| 4.8 | `currentTime` float (0.5s lẻ) | Side-panel không mất timeupdate (regression: schema `.int()` từng reject float) |
| 4.9 | Reload extension + mở lại | Stats persist từ history store, level ladder hiển thị đúng |

## 5. `pre-watch-primer` (#8) — Words tab

| # | Bước | Kỳ vọng |
|---|------|---------|
| 5.1 | Streaming: panel mở (tokenize on) | Tab **Words** hiện, list từ unknown/tracking sort theo rank→count→term |
| 5.2 | Local player: drop video+srt | Words tab hiện trên local (tokenize wiring mới), auto-switch khi cues đầu tiên tới |
| 5.3 | Click timestamp trong row | Seek tới cue chứa từ, **không** mở dictionary popup |
| 5.4 | Click vào từ (row) | Dictionary popup mở đúng (lookup contract đầy đủ) |
| 5.5 | Mark 1 từ = known từ popup | Row biến mất **live** khỏi Words tab (kể cả khi CueList unmounted) |
| 5.6 | Mark từ = tracking | Row mới xuất hiện live |
| 5.7 | Tất cả từ known | EmptyState "All words known" |
| 5.8 | Blur panel / practice mode / zh | Words tab ẩn đúng gate |
| 5.9 | Reload | Words tab rebuild từ lastGood, không fetch thừa |

## 6. `adaptive-subtitles` (#9) — Subtitle thích ứng

| # | Bước | Kỳ vọng |
|---|------|---------|
| 6.1 | Side panel → chọn mode **Adaptive** | Mode apply ngay |
| 6.2 | Tất cả từ known → play qua cue easy | Cả 2 dòng sub ẩn tại cue easy; panel blur |
| 6.3 | Cue có đúng 1 từ lạ (i+1) | Chỉ dòng target hiện (không dịch) |
| 6.4 | Cue ≥2 từ lạ hoặc có từ đang học (dense) | Cả 2 dòng hiện |
| 6.5 | Mark từ đổi status giữa chừng | Cue sau resolve theo band mới (live applyStatus) |
| 6.6 | Đổi mode adaptive → normal giữa playback | Baseline visibility + speed restore sạch |
| 6.7 | Đổi mode adaptive → custom mode khác | Không degrade về `both` (probe re-forward) |
| 6.8 | pauseOnUnknown OFF + adaptive | Resolver vẫn tạo; adaptive vẫn đổi visibility đúng |
| 6.9 | Reload trang | Mode persist, adaptive re-engage |
| 6.10 | Video paused giữa cue boundary | Step-end không consume repeat/step state khi resume |

## 7. `dense-cue-replay` (#10) — i1 Replay

| # | Bước | Kỳ vọng |
|---|------|---------|
| 7.1 | Side panel → chọn **i+1 Replay** | Mode apply; easy cue đầu bị skip |
| 7.2 | Seek vào cue easy | Nhảy thẳng tới i1 cue đầu tiên (1 seek, không hop) |
| 7.3 | Cue i1 phát | Loop lại đúng 3 lần rồi đi tiếp |
| 7.4 | Seek vào cue dense (≥3 lạ) | Skip tới i1 cue kế |
| 7.5 | Seek vào cue i1 cuối list, không còn i1 sau | Cue đó phát bình thường (không nhảy lung tung) |
| 7.6 | User seek giữa chừng khi skip đang bay | Skip bị abort đúng, không kẹt, re-eval cue mới |
| 7.7 | Cues overlap (seek land sớm vào cue trước) | Không ping-pong vô hạn — hội tụ về cue playable |
| 7.8 | Đổi status live: cue i1 → mark known hết | Lần enter sau cue đó bị skip (easy) |
| 7.9 | Đổi mode → normal | Không còn skip/replay, baseline restore |
| 7.10 | Reload | i1-replay persist + re-engage |
| 7.11 | Custom mode: bỏ skip ở step 2 (StepEditor) | Không tạo resolver cho dead config |
| 7.12 | Tắt network freq (unfiltered) | Vẫn skip/replay đúng — band đếm status, không phụ thuộc freq |

---

## Cross-cutting

- Đổi `unknownLevel` (core→advanced) giữa session → pause-on-unknown hit đổi nhưng **band/filter/heat không đổi** (status-only counting) — pill từ lạ trên cue luôn khớp con số filter.
- Console không có error/uncaught trong suốt session.
- chrome.storage không ghi runtime state (adaptive visibility, skip pending) vào persisted styles.
- SPA navigate (nếu mock hỗ trợ) → cleanup sạch, không duplicate listener/resolver.
