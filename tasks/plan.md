# Implementation Plan: Subtitle Manager — Video Overlay Positioning

## Overview
Manager phủ toàn bộ video area (độ phủ = overlay subtitle), background xuyên thấu dark translucent (tham chiếu YouTube settings panel). Desktop: render trong iframe nếu đủ size, host page sheet nếu mobile. Trigger: nút trên overlay panel. Close: click outside / X. Animation: scale from button.

## Architecture Decisions
- **Reuse `findPlayerContainer()`** để lấy video rect — đã có algorithm tìm player shell
- **Reuse body-level shadow host** (`#cell-manager-portal`) — escape stacking context, đã có
- **Không reparent video** (khác PlayerMode) — manager overlay trên video, không di chuyển video
- **Iframe bridge**: reuse `iframePlayerModeBridge` pattern — child iframe render manager nếu đủ size, host page sheet nếu không
- **Translucent**: `backdrop-filter: blur(8px) + rgba(15,15,15,0.7)` — tham chiếu YouTube settings panel

## Task List

### Phase 1: Geometry — position manager over video area
- [ ] Task 1: Detect video player container rect + pass to manager
- [ ] Task 2: CSS — manager full-cover video rect (desktop), translucent bg

### Checkpoint: Geometry
- [ ] Manager phủ đúng video area trên desktop
- [ ] Background xuyên thấu thấy video

### Phase 2: Responsive — mobile sheet + iframe
- [ ] Task 3: Mobile sheet 75vh trên host page (bottom sheet, drag handle)
- [ ] Task 4: Iframe size detection — render trong iframe vs host page

### Checkpoint: Responsive
- [ ] Mobile: bottom sheet 75vh
- [ ] Iframe đủ size: manager trong iframe
- [ ] Iframe nhỏ/mobile: manager host page sheet

### Phase 3: Interaction
- [ ] Task 5: Click outside to close
- [ ] Task 6: Scale-from-button animation

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Video rect thay đổi khi resize/scroll | High | ResizeObserver + scroll listener update rect |
| Iframe cross-origin không đo được rect | Med | Fallback host page sheet |
| backdrop-filter không support trên một số browser | Low | Fallback rgba bg |
| z-index conflict với video controls | Med | pointer-events:none trên overlay, auto trên panel |

## Open Questions
- None (spec confirmed via interview)
