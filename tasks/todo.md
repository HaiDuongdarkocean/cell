# TODO: Subtitle Manager — Video Overlay Positioning

## Phase 1: Geometry
- [ ] **Task 1**: Detect video player container rect + pass to manager
  - AC: Manager nhận videoRect {x, y, width, height} từ findPlayerContainer()
  - AC: ResizeObserver + scroll listener update rect khi video thay đổi
  - Verify: log rect, resize browser, rect update
  - Dependencies: None
  - Files: SubtitlePanels.tsx, SubtitleManagerPanel.tsx
  - Scope: M

- [ ] **Task 2**: CSS — manager full-cover video rect + translucent bg
  - AC: Manager panel position = absolute, inset = videoRect
  - AC: Background: rgba(15,15,15,0.7) + backdrop-filter blur(8px)
  - AC: Video thấy được phía sau (dimmed)
  - AC: pointer-events:none trên overlay, auto trên panel content
  - Verify: screenshot, video visible behind manager
  - Dependencies: Task 1
  - Files: SubtitleManagerPanel.module.css, SubtitleManagerPanel.tsx
  - Scope: M

## Checkpoint: Geometry
- [ ] Manager phủ đúng video area
- [ ] Background xuyên thấu

## Phase 2: Responsive
- [ ] **Task 3**: Mobile sheet 75vh trên host page
  - AC: <768px → bottom sheet 75vh, drag handle, slide up animation
  - AC: Sheet render trên host page (top frame), không trong iframe
  - AC: Video vẫn thấy phía trên sheet
  - Verify: 360px viewport, sheet từ bottom
  - Dependencies: Task 2
  - Files: SubtitleManagerPanel.module.css, SubtitlePanels.tsx
  - Scope: M

- [ ] **Task 4**: Iframe size detection — render trong iframe vs host page
  - AC: Iframe width >= 480px AND height >= 400px → manager render trong iframe
  - AC: Iframe nhỏ hơn → manager render host page (sheet)
  - AC: isChildFrame() check + iframe rect measurement
  - Verify: test trên kisskh.co (iframe), themoviebox.xyz (no iframe)
  - Dependencies: Task 3
  - Files: SubtitlePanels.tsx, iframePlayerModeBridge.ts
  - Scope: L

## Checkpoint: Responsive
- [ ] Mobile: bottom sheet 75vh
- [ ] Iframe đủ size: manager trong iframe
- [ ] Iframe nhỏ: manager host page sheet

## Phase 3: Interaction
- [ ] **Task 5**: Click outside to close
  - AC: Click trên overlay (không phải panel content) → close manager
  - AC: Nút X vẫn hoạt động
  - AC: Overlay chỉ catch click khi manager open
  - Verify: click outside, manager closes
  - Dependencies: Task 2
  - Files: SubtitleManagerPanel.tsx, SubtitleManagerPanel.module.css
  - Scope: S

- [ ] **Task 6**: Scale-from-button animation
  - AC: Manager scale từ 0.9 → 1.0 + fade in, origin = button position
  - AC: transform-origin = button rect center
  - AC: 220ms cubic-bezier(0.32, 0.72, 0, 1)
  - Verify: visual smooth, origin từ button
  - Dependencies: Task 5
  - Files: SubtitleManagerPanel.module.css, SubtitleManagerPanel.tsx
  - Scope: S

## Checkpoint: Complete
- [ ] All AC met
- [ ] Build pass
- [ ] Verify trên showcase + real site
