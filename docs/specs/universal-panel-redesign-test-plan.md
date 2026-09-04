# Test Plan: Universal Panel Redesign (A2)

> Spec: `docs/specs/universal-panel-redesign.md` · Plan: `tasks/plan-universal-panel-redesign.md`

## 1. Automated gates

| # | Command | Pass condition |
|---|---|---|
| V1 | `npm run typecheck` | 0 error |
| V2 | `npm run lint` | 0 error |
| V3 | `npm run test:unit` | toàn bộ pass |
| V4 | `npm run build` | thành công |
| V5 | `npm run check-design-system-css` | pass |
| V6 | `npm run test:e2e -- --project=showcase --grep universal-panel-redesign` | pass |

## 2. E2E cases — `e2e/universal-panel-redesign.spec.ts`

| # | Case | Viewport | AC |
|---|---|---|---|
| E1 | Desktop: sidebar + header cùng nền, không border element | 1440×900 | AC1 |
| E2 | Desktop: sidebar đủ 8 nút đúng thứ tự | 1440×900 | AC2 |
| E3 | Click collapse → width 64, label ẩn; click lại → 180, label hiện | 1440×900 | AC3 |
| E4 | Click profile → popover; chọn → label sidebar cập nhật | 1440×900 | AC4 |
| E5 | Tokenize pill width ≈ header width − close | 1440×900 | AC5 |
| E6 | Click Reader/SRS/Player → handler đúng | 1440×900 | AC6 |
| E7 | Mobile: bottom bar 4 mục có nhãn; tab switch | 390×844 | AC7, AC8 |
| E8 | Mobile: Tools sheet mở/đóng/action | 390×844 | AC9 |
| E9 | Escape/click backdrop/close đóng panel | cả 2 | AC10 |
| E10 | Tab persistence qua `chrome.storage.session` | desktop | AC11 |
| E11 | Axe scan: 0 critical violation | cả 2 | AC13 |

## 3. Manual visual checklist

- [ ] M1: Desktop sidebar và header liền khối L, không đường kẻ
- [ ] M2: Content tách bằng nền sáng hơn, không border
- [ ] M3: Sidebar expanded: profile có cờ + label; collapsed: chỉ cờ
- [ ] M4: Tokenize giãn full, không bị max-width
- [ ] M5: Tools trong sidebar luôn hiển thị, tách tab bằng khoảng cách
- [ ] M6: Collapse transition mượt ≤ 250ms
- [ ] M7: Mobile bottom bar có nhãn, active rõ
- [ ] M8: Tools sheet có handle + 3 rows title/description

## 4. Completion tracker

Điền sau mỗi task. **100% = toàn bộ PASS**.

| AC | Mô tả | Verify | Status |
|---|---|---|---|
| AC1 | L-shape không border | E1 + M1, M2 | ☐ |
| AC2 | 8 nút đúng thứ tự | E2 + M3 | ☐ |
| AC3 | Collapse/expand | E3 + M3, M6 | ☐ |
| AC4 | Profile label cập nhật | E4 + M3 | ☐ |
| AC5 | Tokenize stretch | E5 + M4 | ☐ |
| AC6 | Tools luôn hiện + action | E6 + M5 | ☐ |
| AC7 | Mobile header touch target | E7 + M7 | ☐ |
| AC8 | Mobile tab switching | E7 + M7 | ☐ |
| AC9 | Tools sheet | E8 + M8 | ☐ |
| AC10 | Open/close | E9 | ☐ |
| AC11 | Tab persistence | E10 | ☐ |
| AC12 | Token-only style | V5 + M1–M8 | ☐ |
| AC13 | A11y | E11 + Task 5 | ☐ |
| AC14 | data-cell-id / test | V3 | ☐ |
| AC15 | E2E pass | E1–E11 | ☐ |

