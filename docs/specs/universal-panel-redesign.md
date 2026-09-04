# Spec: Universal Panel Redesign (A2)

> Status: **Approved SSOT**
> Visual SSOT: `src/entrypoints/design-system-showcase/mockups/universal-panel-redesign-a2.html`
> Intent: `docs/intent/universal-panel-redesign-brief.md`
> Related specs: `profile-language.md`, `sidebar-navigation-decoupling.md`, `media-study-modes.md`, `reader.md`

## Objective

Redesign **Universal Panel** (`src/features/universalPanel/`) theo concept **A2** chốt:

- **Mobile**: header profile cờ + tokenize giãn + close; content; bottom tab bar (Dictionary · Study · Settings · **Tools**) + **List Tools bottom sheet**.
- **Desktop**: **L-shape sidebar** liền khối với header, không border; sidebar chứa profile, tab, tools; **collapse/expand** (180px ↔ 64px); header chứa tokenize stretch + close.

### User stories

1. **Desktop**: user mở panel → thấy sidebar dọc bên trái liền với header; chọn tab/tool; thu gọn sidebar vẫn dùng được.
2. **Mobile**: user bấm `Tools` → sheet liệt kê Reader/SRS/Player; chọn tool.
3. **Cả hai**: tokenize `Text | Media` giãn rộng, touch target ≥ 44px (mobile).

### Non-goals / Out of scope

- Không đổi logic bên trong tab.
- Không đổi `UniversalPanelController` API.
- Không thêm dependency mới.
- Không đụng `mountUniversalPanelLegacy.ts`.
- Clipboard tab — làm sau.

---

## Layout Contract

### Desktop (> 839px)

```
px)

```
┌─────────────────────────────────────────────────────────────┐
│ [🇻🇳 Profile]  [ tokenize pill — stretch ───────────── ]  [x] │  ← L-shape: sidebar + header cùng nền
│ [Dictionary]                                                │
│ [Study     ]          CONTENT                               │
│ [Settings  ]           (surface, no border)                 │
│                                                             │
│ [Reader]                                                   │
│ [SRS   ]                                                   │
│ [Player]                                                   │
│ [‹ collapse]                                                 │
└─────────────────────────────────────────────────────────────┘
```

- **L-shape**: sidebar + header cùng màu `surface-elevated`, content `surface`; tách bằng nền, **không border**.
- **Sidebar** `180px` (expanded) / `64px` (collapsed), transition `250ms`.
- **Profile** ở đầu sidebar: expanded hiện label, collapsed chỉ cờ.
- **8 nút sidebar** theo thứ tự: profile, Dictionary, Study, Settings, Reader, SRS, Player, Collapse.
- **Tokenize** ở header, giãn toàn bộ, không border, `box-shadow`.
- **Tools** luôn hiển thị, 1 click mở.

### Mobile (≤ 839px)

- Header: profile cờ (trái), tokenize (giãn), close (phải).
- Bottom bar: 4 mục có nhãn (Dictionary, Study, Settings, Tools).
- Tools: bottom sheet 3 rows icon + title + description.

---

## Component Mapping

| Hiện tại | Mục tiêu | Ghi chú |
|---|---|---|
| `UniversalPanel.tsx` | Shell mới: desktop L-shape; mobile header+sheet | Giữ `data-cell-id` |
| `CollapsibleSidebar.tsx` (NEW) | Sidebar: profile + tabs + tools + collapse | Collapsible �180↔64 |
| `UniversalPanelHeader.tsx` | Header desktop: tokenize stretch + close | Không profile |
| `TokenizeControls.tsx` | Giữ logic, CSS pill `flex:1` | |
| `UniversalPanelBottomNav.tsx` (NEW) | Mobile bottom bar 4 mục + mở sheet | |
| `UniversalPanelToolsSheet.tsx` (NEW) | Mobile bottom sheet | |
| `UniversalPanelController.ts` | Không đổi | |

### Files dự kiến

```text
src/features/universalPanel/
  ├── UniversalPanel.tsx                  # MODIFY
  ├── UniversalPanel.module.css           # MODIFY
  ├── UniversalPanelHeader.tsx            # MODIFY
  ├── UniversalPanelHeader.module.css     # MODIFY
  ├── UniversalPanelBottomNav.tsx         # NEW
  ├── UniversalPanelBottomNav.module.css  # NEW
  ├── UniversalPanelToolsSheet.tsx        # NEW
  ├── UniversalPanelToolsSheet.module.css # NEW
  ├── TokenizeControls.module.css         # MODIFY
  └── (uses `src/shared/ui/CollapsibleSidebar`)

src/shared/ui/
  ├── CollapsibleSidebar.tsx              # NEW
  ├── CollapsibleSidebar.module.css       # NEW
  └── CollapsibleSidebar.test.tsx         # NEW
```

---

## Tech Stack & Commands

React 19 + TS 6 + CSS Modules + tokens SSOT.

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run check-design-system-css
npm run design-system:dev
npm run test:e2e
```

---

## Success Criteria (AC)

### Desktop
- **AC1**: L-shape liền khối, không border giữa sidebar và header.
- **AC2**: Sidebar đủ 8 nút đúng thứ tự: profile, Dictionary, Study, Settings, Reader, SRS, Player, Collapse.
- **AC3**: Collapse/expand: width 180↔64, label hiện/ẩn mượt.
- **AC4**: Profile expanded có cờ + label, collapsed chỉ cờ; chọn profile cập nhật label.
- **AC5**: Tokenize pill stretch full trong header.
- **AC6**: Tools luôn hiện, click mở đúng action.

### Mobile
- **AC7**: Header profile cờ + tokenize giãn + close, touch target ≥ 44px.
- **AC8**: Bottom bar 4 mục có nhãn, tab switching hoạt động.
- **AC9**: Tools sheet mở/đóng/action đúng.

### Cross-cutting
- **AC10**: Open/close không đổi (backdrop, Escape, close).
- **AC11**: Tab persistence qua `chrome.storage.session`.
- **AC12**: 100% token style; `check-design-system-css` pass.
- **AC13**: A11y: `aria-label`, keyboard, focus visible, axe 0 critical.
- **AC14**: `data-cell-id` giữ hoặc cập nhật test.
- **AC15**: E2E spec pass.

---

## Definition of Done

- [ ] 6 quality gates xanh (`typecheck`, `lint`, `test:unit`, `build`, `check-design-system-css`, e2e)
- [ ] Toàn bộ AC1–AC15 verified
- [ ] Showcase `UniversalPanelPage` đúng layout mới
