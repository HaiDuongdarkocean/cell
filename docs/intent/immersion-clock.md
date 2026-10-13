# Intent — `immersion-clock`

> Backlog: #7 · Cost: M · Value: ★★★★ · Source: dreaming-spanish · Status: confirmed frame (autonomous — zero-questions pipeline)

## Pain (raw)

"Không biết đã nạp bao nhiêu giờ input — không có roadmap level→fluency"

## 8-field frame

1. **Who**: Tihoka user đang học tiếng Anh qua comprehensible input — xem phim (local player) + streaming sites (YouTube/Netflix…) với Tihoka subtitles.
2. **Problem**: Krashen/DS methodology cần *volume* — input tích lũy theo giờ. Hôm nay Tihoka đo được coverage (%) nhưng không đo thời gian: user không biết mình đã xem bao nhiêu giờ, không có mốc "bao giờ thì fluent".
3. **Current workaround**: không có — `HistoryRecord.watchDurationMs` tồn tại trong schema nhưng mọi writer ghi `0`; `getHistory` không có UI consumer.
4. **Trigger**: mở local-player library — cùng màn hình user chọn "xem gì tiếp" (i1-content-queue) nên cũng là chỗ tự nhiên để trả lời "đã xem bao nhiêu".
5. **Desired outcome**: một con số honest — tổng giờ input (local + streaming), giờ tuần này, chuỗi ngày (streak), và level trên roadmap Dreaming-Spanish (0/50/150/300/600/1000/1500h) với progress tới mốc kế.
6. **Success metric**: clock hiển thị số giờ khớp thời gian user thực xem (±5%); streaming time được đếm khi Tihoka subtitle session active; số persist qua reload/restart.
7. **Constraints**: đếm *wall-clock* (DS semantics), không phải video-time; fail-closed (SW chết mất ≤ buffer trong RAM, không bơm số ảo); không phá existing history consumers; UI nhẹ — một card trong LibraryView, không page mới.
8. **Out of scope**: tracking streaming khi Tihoka subtitles không active (raw watch ≠ comprehensible input theo định nghĩa của feature); cross-device sync; calendar heatmap; per-video watch totals UI; editable/manual time entry.

## Assumptions (accepted risks)

- DS milestone ladder `[0, 50, 150, 300, 600, 1000, 1500]` hours ≈ Level 1–7 — encode as `IMMERSION_MILESTONES_H`; labels "Level N" generic (không bê nguyên branding DS).
- "Streaming time" = thời gian `VIDEO_TIME_UPDATE` chảy ~4fps từ content-script controller — proxy cho "đang xem với Tihoka subtitles". Tab bị throttle/không focus vẫn đếm nếu video chạy — đúng semantics "đang nạp input".
- Local-player count = wall-delta giữa `timeupdate` events trên `<video>` (đã có trong `useLocalVideo`), upsert một `HistoryRecord` per open-session.
- UI surface = `LibraryView` header card (single surface, M-cost); pill/dashboard surfaces defer.
