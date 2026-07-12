# ADR-033: Netflix seek async — track lastSeekTarget for rapid cue-nav

## Status
Accepted (2026-07-13)

## Context
Netflix `player.seek()` (qua `__NF_SEEK` CustomEvent → MAIN-world `player.seek(ms)`) là **async** và có behavior đặc thù:

- **Forward seek**: `video.currentTime` advance dần (fast-play) tới target, không jump. ~600ms.
- **Backward seek**: `video.currentTime` **stuck** ở old pos, rồi **jump** tới target. ~1s.
- `video.seeking` (HTMLMediaElement) **không reliable** — chỉ `true` ~2ms trên Netflix.

### Bug
Khi user nhấn A/S/D liên tiếp (cách 400ms, vượt dedupe window 300ms), content script tính next/prev cue từ `video.currentTime` — nhưng video chưa tới seek target trước → tính sai → **seek lặp cùng cue** (stuck).

Trace 10×D cách 400ms (trước fix):
```
seek[0]=2250623, seek[1]=2254753, seek[2-9]=2254753 (stuck 8x)
```
Video stuck ở 2253672 (chưa tới 2254753) → next cue from 2253672 = 2254753 → seek lặp.

## Decision
Track `lastSeekTargetMs` + `lastSeekTime`. `getEffectiveMs()` trả về:
- `lastSeekTargetMs + offsetMs` nếu seek đang in-progress
- `video.currentTime * 1000 + offsetMs` nếu settled

**Seek in-progress** = `|videoMs - lastSeekTargetMs| > 50ms` AND `Date.now() - lastSeekTime < 1000ms`.

### Why 50ms tolerance
- Nhỏ enough để settle nhanh (video tới target → |delta| < 50 → settled)
- Lớn enough cho float jitter
- Forward: video advance tới target, |delta| giảm → settle
- Backward: video stuck ở old pos, |delta| lớn → in-progress → dùng target. Khi jump, |delta| < 50 → settle

### Why 1000ms time guard
Netflix seek settle: ~600ms forward, ~1s backward. Sau 1s, clear `lastSeekTargetMs` — video đã tới target HOẶC play qua target (normal playback). Không clear → stale lastSeekTarget sau khi video advance xa target → sai.

### Listener
`document.addEventListener('__NF_SEEK', onNfSeek)` — catch ALL seeks (keydown, NavCluster, Side Panel relay, external). `onNfSeek` set `lastSeekTargetMs = e.detail` (video target time in ms) + `lastSeekTime = Date.now()`. Named function, removed trong cleanup (no leak).

### `e.detail` = video time (không effective)
`seekVideo(video, targetSeconds)` dispatch `__NF_SEEK` với `detail = targetSeconds * 1000`. `seekToCue(video, cue, offsetMs)` gọi `seekVideo(video, (cue.start - offsetMs) / 1000)` → `detail = cue.start - offsetMs` (video time). `getEffectiveMs` return `lastSeekTargetMs + offsetMs = cue.start` (effective). Đúng.

## Consequences
- Rapid A/S/D (400ms interval) → 10 seeks khác nhau, tăng/giảm dần, không stuck
- Sync A/S/D (dedupe) → 1 seek (ADR-032 dedupe vẫn hoạt động)
- Replay-cue (S) → luôn seek về start cue hiện tại (đúng logic — video advance trong cue, S replay)
- Stale listeners fix (ADR-032 commit `61b7f6a`) + dedupe (ADR-032) + lastSeekTarget (ADR-033) = 3 lớp fix cho seek navigation

## Test
`tests/manual/netflix-seek-predict-test.js` — 10×A/S/D sync + 400ms. Kết quả Edge (2026-07-13):
- Sync: 1 seek mỗi case (dedupe OK)
- 400ms D: 10 seeks tăng dần [2254753...2280987]
- 400ms A: 10 seeks giảm dần [2246786...2210458]
- 400ms S: 10 seeks cùng cue [2246786×10] (replay logic)

## Ponytail ceiling
- 50ms tolerance + 1000ms time guard là heuristic, không phải exact. Nếu Netflix seek > 1s (slow network), lastSeekTarget clear sớm → có thể stuck lại. Upgrade: listen `seeked` event trên Netflix player API (nếu expose) thay vì time guard.
- Backward seek "stuck rồi jump" quan sát trên 1 title. Có thể khác title/network. Upgrade: test trên nhiều title.
