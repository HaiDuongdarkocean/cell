# ADR-042: Sticky Candidate Header cho Popup Dictionary

> **Status**: Accepted
> **Date**: 2026-07-17
> **Supersedes**: —
> **Related**: ADR-038 (Popup Dictionary Shadow DOM + vanilla DOM)

## Context

Khi popup có nhiều candidate (vd. phrase match + word fallback + lemma candidates), user cuộn xuống để đọc definitions. Khi cuộn, header của candidate (`data-dp-header`) biến mất khỏi viewport — user mất ngữ cảnh: không biết definitions nào thuộc candidate nào.

User muốn **iOS-style sticky section headers**: header của candidate gần top nhất dính ở đó cho đến khi header của candidate kế tiếp đẩy nó ra. Đây là pattern quen thuộc trên iOS (Settings app, Music app) — header section "stick" ở top khi scroll.

## Decision

Dùng **CSS `position: sticky; top: 0`** (với `-webkit-sticky` fallback cho iOS Safari < 13) trên mỗi `data-dp-header`. Pure CSS, không JS scroll listener.

### Quyết định cấu trúc

#### 1. Tách popup shell thành 2 lớp

```
[data-dp-popup]        (outer shell — overflow:hidden, position:fixed)
├── [data-dp-content]  (inner scroll wrapper — overflowY:auto, flex:1 1 auto, min-height:0)
│    └── div[data-dp-candidate-list]  (display:block)
│         ├── [data-dp-header]  (position:sticky; top:0)
│         ├── definitions…
│         ├── [data-dp-header]  (position:sticky; top:0)
│         └── definitions…
└── [data-dp-resize]   (resize handle — sibling của contentEl, KHÔNG nằm trong scroll wrapper)
```

Resize handle là **sibling** của content wrapper, không nằm trong nó — điều này ngăn handle cuộn cùng content. Trước đây handle nằm trong container và phải re-append sau mỗi `clearContainer`; giờ nó tự nhiên pinned ở bottom-right.

#### 2. Wrap candidates trong `div[data-dp-candidate-list]` (`display:block`)

iOS Safari có bug đã biết: `position:sticky` không hoạt động trong flex container. Content wrapper (`[data-dp-content]`) là `display:flex; flex-direction:column` (cần cho layout), nên candidates phải nằm trong một block-level wrapper riêng để sticky hoạt động đúng.

#### 3. `background: var(--dp-bg, #ffffff)` trên mỗi `data-dp-header`

Khi header sticky, content cuộn phía dưới sẽ xuyên qua header nếu header trong suốt. Background đảm bảo header che content phía sau.

### Tại sao pure CSS (không JS scroll listener)

- **Performance**: JS scroll listener trên mobile low-RAM (4GB) gây jank — `scroll` event fire liên tục, mỗi frame phải tính toán + reflow. CSS sticky do browser engine xử lý, zero JS cost.
- **Simplicity**: Không state management, không race condition, không cleanup listener.
- **Cross-browser**: `position:sticky` hỗ trợ đầy đủ trên Chrome/Firefox/Edge/Opera/Brave. iOS Safari 8+ qua `-webkit-sticky`.

## Consequences

- **Positive**: Pure CSS, performant trên low-RAM mobile. Không JS scroll listener → không jank. Resize handle tự pinned (no more `reAppendResizeHandle` hack).
- **Negative**: Thêm 1 DOM wrapper layer (`div[data-dp-candidate-list]`) — overhead tối thiểu, chỉ 1 element.
- **Trade-off**: `reAppendResizeHandle()` giờ là no-op (giữ cho backward compat) — caller không cần biết handle đã được tách ra khỏi scroll wrapper.

## Implementation

- `popupShell.ts`: thêm `contentEl` field (inner scroll wrapper). `getContainer()` trả về `contentEl` (không phải `container`). `reAppendResizeHandle()` → no-op.
- `popupContent.ts`: thêm `getOrCreateCandidateList()` export — tạo/lookup `div[data-dp-candidate-list]` (`display:block`). `renderPopupContent` tạo wrapper rồi render vào đó. `appendCandidateContent` append vào wrapper. Mỗi `data-dp-header` có `position:-webkit-sticky;position:sticky;top:0;z-index:10;background:var(--dp-bg,#ffffff)`.
