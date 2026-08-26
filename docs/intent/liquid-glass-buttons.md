# Intent — Liquid-Glass Button System

> Confirmed 2026-08-27. Methods: reference analysis, code audit, interview, adversarial review.

## Problem

Cell có ba nguồn biểu hiện button không đồng nhất: shared `Button`, shared `IconButton`, và feature CSS trong subtitle overlay. `Button` đã có liquid-glass opt-in nhưng còn idle drift, hover lift, borders và solid-color variants; `IconButton` chưa có material tương đương; overlay lại ghi đè background/material bằng selector rộng.

## User

- Người dùng Cell 5–80 tuổi, trọng tâm 10–25.
- Chrome, Edge, Brave trên desktop, tablet và Android.
- Người học ngoại ngữ tương tác thường xuyên với button trong popup/panel và subtitle overlay trên video.

## Current workflow

1. Calibrate visual trong Dewdrop mockup.
2. Chuyển một phần CSS/token sang shared component.
3. Feature CSS tiếp tục override size, background và states.
4. Cùng một shared component render khác nhau giữa showcase và subtitle overlay.

## Pain point

- `153` shared `Button` usages và `101` shared `IconButton` usages không dùng cùng optical material.
- Subtitle UI còn `11` native button source occurrences; action buttons, tabs và semantic controls chưa được phân loại thống nhất.
- `NavCluster.module.css` và `subtitlePanelsShared.module.css` đang sở hữu cả geometry lẫn material.
- Infinite liquid animation và hover lift không phù hợp high-frequency overlay controls hoặc máy RAM thấp.

## Evidence

- Button reference: `C:\Users\The0cean\Documents\ShareX\Screenshots\2026-08\chrome_Uud9d7Neyz.png`.
- V4 edge-case mockup: `src/entrypoints/design-system-showcase/mockups/liquid-glass-dewdrop-v4.html`.
- Shared implementation: `src/shared/ui/Button.tsx`, `Button.module.css`, `IconButton.tsx`, `IconButton.module.css`.
- Overlay overrides: `src/features/subtitle/ui/NavCluster.module.css`, `subtitlePanelsShared.module.css`.

## Desired outcome

- `Button` và `IconButton` dùng cùng một themed liquid-glass optical model.
- Light mode: glass sáng + foreground tối.
- Dark mode: glass tối + foreground trắng.
- Subtitle overlay: protected dark glass + foreground trắng trên mọi video.
- Tất cả semantic variants dùng cùng neutral material; không màu semantic.
- IconButton luôn tròn; horizontal content-width Button luôn capsule; vertical/full-width Button có radius `0`.
- Không idle animation, không hover lift; hover chỉ tăng highlight, pressed scale khoảng `0.985`.
- V4 được anh duyệt trước khi sync production.

## Constraints

- `tokens.json` là SSOT; không sửa generated token files.
- Shared component sở hữu material/state; feature CSS chỉ sở hữu layout/geometry cần thiết.
- WCAG AA, visible focus, touch target ≥44px touch và ≥40px desktop.
- Cross-browser, Shadow DOM, host-CSS isolation, RAM ≥1GB.
- Không animate blur hoặc chạy compositor animation vô hạn.
- Destructive action không có màu phải dùng label/icon rõ và confirmation khi hậu quả nghiêm trọng.

## Scope

### In scope

1. V4 visual contract.
2. Shared `Button` và `IconButton` material/tokens/tests/showcase.
3. Subtitle migration:
   - API-key hint → `Button`.
   - Latency decrement/increment → `Button`.
   - Manager header back → `IconButton`.
   - Nav-cluster preset pills → `Button`.
   - Target/Native tabs → `Tabs`.
4. Overlay CSS ownership cleanup: geometry may remain local; material belongs to shared components.

### Preserve as semantic controls

- Search-result listbox option.
- Track “Off” listbox option.
- Alignment segmented radios.
- Shadow segmented radios.

### Out of scope

- Liquid-glass containers, cards, inputs, selects, tabs, list rows or segmented controls.
- Native custom buttons outside subtitle feature.
- SVG displacement filters.
- Idle liquid animation.
- Semantic color-filled variants.
- Business-logic changes.

## Confirmed decisions

1. Scope is Button + IconButton + subtitle overlay action buttons.
2. Material adapts to light/dark; overlay gets protected dark context.
3. No semantic color differentiation.
4. Motion is static and subtle.
5. Geometry: circle / capsule / radius-zero vertical and full-width.
6. Rollout: V4 → human approval → shared production → subtitle migration.
7. Native migration: action buttons + Tabs; listbox rows and segmented radios remain semantic controls.

## Route

Next: `docs/specs/liquid-glass-buttons.md` → `tasks/plan-liquid-glass-buttons.md` → implementation after plan approval.
