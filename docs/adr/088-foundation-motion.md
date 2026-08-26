# ADR-088: Motion for "Quiet Confidence" Foundation

## Status

Proposed — awaiting build + showcase prototype before final acceptance.

## Context

Motion trong UI không phải decoration — nó là feedback. Cell hiện có tokens `duration-fast: 150ms`, `duration-normal: 250ms`, `duration-slow: 500ms` nhưng chưa có easing scale rõ ràng, chưa có nguyên lý khi nào dùng loại nào.

Với brand **"quiet confidence"**, motion phải **nhanh, nhẹ, có mục đích**. Không flashy, không kéo dài, không gây phân tâm.

## Decision

### 1. Duration scale

| Token | Value | Usage | Rationale |
|-------|-------|-------|-----------|
| `--duration-instant` | 0ms | Disable transition | Instant state change. |
| `--duration-fast` | 120ms | Hover, active, color/background change | Phản hồi ngay lập tức, không làm chậm tương tác. |
| `--duration-normal` | 200ms | Expand/collapse, fade, opacity | Vừa đủ nhìn thấy, không cảm thấy chậm. |
| `--duration-slow` | 300ms | Modal/dialog enter, page transition, bottom sheet | Rõ ràng nhưng vẫn nhanh. |
| `--duration-slower` | 500ms | Toast, large layout shift | Hiếm dùng, chỉ khi cần emphasis. |

**Nguyên lý:**
- Linear dùng 120–180ms cho hầu hết motion, coi đây là "signals state change without delaying the user" ([nguồn](https://www.designsystems.one/design-systems/linear)).
- 150ms là chuẩn common nhưng 120ms cảm giác "snappier".
- >300ms sẽ bắt đầu gây cảm giác chậm trên UI dày đặc.

### 2. Easing scale

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default UI transitions | Material ease-in-out — smooth, natural. |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit/leave | Nhanh đầu, chậm cuối. |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Enter/appear | Chậm đầu, nhanh cuối — cảm giác "mở ra". |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Popover, toggle, badge | Subtle bounce, playful but not childish. Hiếm dùng. |
| `--ease-linear` | `linear` | Progress, scroll, continuous | Không có acceleration. |

**Nguyên lý:**
- Enter dùng `ease-out` để element "settle" nhẹ nhàng.
- Exit dùng `ease-in` để element rời đi nhanh, không chiếm attention.
- `ease-spring` chỉ dùng cho micro-interactions (toggle, checkbox) để tạo cảm giác responsive, không dùng cho page transition.

### 3. Motion purposes

Mỗi motion phải thuộc 1 trong 4 mục đích:

1. **Feedback**: hover, active, focus — duration-fast, ease-default.
2. **Hierarchy**: expand/collapse, accordion, tree — duration-normal, ease-out.
3. **Continuity**: page/section transition, dialog enter/exit — duration-slow, ease-out/ease-in.
4. **Emphasis**: toast, notification — duration-slow, ease-spring (rất hiếm).

### 4. Reduced motion

Respect `prefers-reduced-motion: reduce`:
- Tắt tất cả transition > 0ms.
- Giữ instant state change.
- Không dùng animation/parallax.

## Consequences

**Positive:**
- Motion nhanh, không gây phân tâm.
- Easing rõ ràng, dễ áp dụng.
- Respect a11y.

**Negative:**
- 120ms có thể quá nhanh trên thiết bị yếu — cần test.
- `ease-spring` dễ lạm dụng.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Dùng 300ms cho hover | Quá chậm, làm UI cảm giác nặng. |
| Dùng nhiều spring/bounce | Quá playful, không phù hợp "điềm đạm". |
| Không có reduced motion | Vi phạm a11y, gây khó chịu cho một số user. |

## References

- [Linear — Motion as feedback](https://www.designsystems.one/design-systems/linear)
- [Material 3 — Motion](https://m3.material.io/styles/motion/overview)
- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/foundations/motion)
