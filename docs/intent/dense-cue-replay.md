# Intent — Dense Cue Replay (i+1 Replay)

Backlog #10 · `dense-cue-replay` · source: asbplayer + internal-audit

## Pain (verbatim)

> Cue có đúng 1–2 từ lạ = vàng nhưng trôi qua; auto-loop cue đó, skip cue 0 lạ hoặc quá nhiều lạ

## Interpretation

Cue 1–2 từ lạ (band `i1`) là comprehensible input "vàng" — đủ hiểu để nghe được, đủ lạ để học. Nhưng khi xem bình thường nó trôi qua một lần rồi mất. Người dùng muốn một drill mode: cue i+1 tự loop lại vài lần để nghe kỹ, còn cue quá dễ (0 lạ) hay quá dense (3+ lạ) thì bỏ qua — "skip cue" nghĩa đen là nhảy qua, không phải "không loop". Đây là opt-in study mode (preset), không phải default behavior — ai chỉ muốn xem thường thì chọn mode khác.

## In scope

- Step-level `skip` policy mới: `'non-i1'` — tại cue entry, nếu band của cue ≠ `i1` thì seek tới cue `i1` đầu tiên phía sau.
- Preset `i1-replay`: `subtitle:'adaptive'` (i+1 → target-only, ép nghe), `repeat:3` (nghe cue vàng 3 lần), `skip:'non-i1'`, `pause:'none'`, `speed:1`, `after:'continue'`.
- Reuse `CueBandProbe` chain từ adaptive-subtitles (easy/i1/dense per cue) — zero new resolver infra.
- Custom modes: `skip` persist qua migration; StepEditor chip group chỉ ở step đầu (skip evaluate một lần ở cue entry).
- Frequency-level chips hiện khi mode dùng band probe (adaptive HOẶC skip) — knob band tuning giữ reachable.

## Fallbacks (fail-safe)

- Probe null / band null → play bình thường, không skip.
- Không còn cue i1 nào phía sau → play bình thường (không seek vô định).
- Skip seek bounce (overlapping cues đáp landing về cue ≤ target) → cue đáp sai bị disable skip, play một lần, không loop vô hạn.

## Out of scope

- Local player (không có study-mode stack — established).
- Skip mid-cue / rolling window — quyết định chỉ ở cue boundary, nhất quán với adaptive.
- Repeat count tunable riêng cho drill (dùng `repeat` field sẵn có, custom modes tự chỉnh).
- Auto-enable theo coverage — user tự chọn preset.

## Success criteria

- Bật `i1-replay` → cue easy/dense bị nhảy qua, cue i+1 nghe 3 lần với target sub.
- Status đổi giữa chừng (mark word) → bandProbe live-update → cue kế tiếp evaluate theo band mới.
- Switch sang mode khác → baseline restore như mọi mode.
- Probe mất (resolver unavailable) → mode degrade về "play everything" chứ không skip hết.
