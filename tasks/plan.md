# Implementation Plan: Subtitle Overlay — 3-Zone Full-Width Block (ADR-025 + spec override)

## Overview

Bug: subtitle block hỏng trên themoviebox — layout hiện tại là flex-column stacked (blockLayer + navLayer centered absolute), không phải 3-zone full-width block như ADR-025. SubtitleBlock return null khi cues rỗng → blockLayer height=0 → nav cluster floating sai vị trí. Logic drag/snap/persist không tồn tại (legacy đã xóa commit ada2f71, React UI chưa implement).

Fix: implement layout 3-zone `[NavCluster left][SubtitleBlock center][ToolsLayer right]` full-width, drag Y toàn block, snap 25/50/75%, persist yOffsetPercent. Showcase + production dùng cùng `SubtitlePanels` (Reuse).

## Architecture Decisions

- **Layout 3-zone (spec override ADR-025):** spec anh yêu cầu cluster trái + phải, ADR-025 nói cluster chỉ trái. Theo spec (mới hơn): left=NavCluster (nav), right=ToolsLayer (card actions), center=SubtitleBlock.
- **Drag Y 1D:** pointerdown trên `.root` background (pointer-events auto, exclude cluster/button/text via pointer-events:none on children except interactive). transform translateY compositor-only + will-change khi .dragging + rAF throttle (atom ux-drag-transform-willchange-raf). touch-action:none (atom ux-touch-action-none-for-pointer-drag). Bake yOffsetPercent lúc pointerup.
- **Snap:** snap đến 25/50/75% sau drag (nearest). Simple clamp 0-95 + round về snap point.
- **Persist:** yOffsetPercent → settingsStore subtitleBlockSettings, debounce 300ms (pattern như offset persist).
- **Collapsed:** container query — khi container width < threshold, NavCluster collapse (behavior hiện có), tools ẩn. Không layout dọc.
- **Layer:** z-index var(--z-overlay-video) qua mountSubtitle (ADR-031 pattern). reparentOnFullscreen=true.
- **Cues rỗng:** SubtitleBlock vẫn render block container (không return null) → blockLayer có height → 3-zone layout giữ shape. Hiện text rỗng.

## Task List

### Phase 1: Layout 3-zone (CSS + structure)
- [ ] T1: Rewrite SubtitlePanels.module.css → 3-zone flex row full-width + drag surface + container query collapsed
- [ ] T2: Rewrite SubtitleBlock.module.css → center zone, min-width:0, không return null khi cues rỗng
- [ ] T3: SubtitlePanels.tsx — restructure JSX: root > [navLayer][blockLayer][toolsLayer], drag surface

### Checkpoint 1: Layout đúng shape trên showcase + themoviebox
- [ ] Build pass, showcase render 3-zone, themoviebox block giữ shape khi cues rỗng

### Phase 2: Drag + snap + persist
- [ ] T4: Pure drag logic (subtitleBlockDrag.ts) — clamp + snap + delta→percent, testable
- [ ] T5: SubtitlePanels.tsx — wire pointer events drag Y, rAF, will-change, touch-action:none
- [ ] T6: reactSubtitleController — implement yOffsetPercent state + persist debounce, wire to mount
- [ ] T7: mountSubtitle — pass yOffsetPercent + reparentOnFullscreen=true

### Checkpoint 2: Drag hoạt động, persist qua reload
- [ ] Drag Y trên showcase + themoviebox, reload giữ vị trí

### Phase 3: Verify + docs
- [ ] T8: Unit test subtitleBlockDrag.ts (clamp/snap pure)
- [ ] T9: Browser verify showcase + themoviebox (DevTools), responsive container query
- [ ] T10: Update docs/2-architechture-system.md + ADR-025 amends

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shadow DOM pointer-events retargeting | Med | atom shadow-dom-retargeting — dùng e.currentTarget, không e.target |
| Fullscreen reparent break layout | Med | reparentOnFullscreen đã có trong mountReactShadow, test fullscreen |
| Container query support | Low | Chrome 105+ hỗ trợ, extension target Chrome |
| Drag conflict với text select | Med | pointer-events:none trên text span, auto trên button, drag chỉ trên background |

## Open Questions
- Snap points: 25/50/75% hay tự do 0-95? → implement snap 25/50/75 (simple, predictable).
