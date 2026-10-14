# Worked Example — Delete Account flow

Chạy trọn B0→B7 trên một destructive flow. Cho thấy: goal → content → consequence đổi khi biết undo-window → anatomy → spec → gaps phát hiện trong code thật.

## B0 — Goal

> "User quyết định **có chủ đích**: xóa hay giữ tài khoản — và hệ quả của lựa chọn rõ ràng trước khi họ bấm."

(Journey scope: không nói "thiết kế dialog" — dialog là quyết định của B2.)

## B1 — Content inventory

| slot | loại | content đại diện | worst case | vai trò | nhóm |
|---|---|---|---|---|---|
| status icon | icon | warning | — | status cue | header |
| title | text | "Delete Account" | 2 dòng | heading | header |
| body | text | "Permanently deletes {email} and all data." | email 60ch + i18n ×1.3 | description | header |
| gate | checkbox | "Tôi hiểu mất toàn bộ dữ liệu" | 2 dòng | intentional confirm | content |
| safe action | button | "No, keep it." | i18n ×1.3 | exit an toàn | footer |
| destructive action | button | "Yes, Delete!" + loading "Deleting…" | i18n ×1.3 | action L3 | footer |
| close | icon btn | × | — | exit | chrome |

**Bài học content-driven:** label nói hệ quả ("Yes, Delete!"), không "Yes/No" mơ hồ — inventory bắt được trước khi vẽ nút.

## B2 — Consequence Triad → quyết định thay đổi theo dữ kiện

| Trục | Xóa vĩnh viễn | Xóa có undo-window 30 ngày |
|---|---|---|
| Irreversibility | 3 | 1 |
| Risk | 2–3 | 2 |
| Attention | 2 | 1 |
| **UI bắt buộc** | **Dialog + destructive + gate** (checkbox/typed) | secondary + **toast Undo** |

→ Cùng một "delete", hai UI hoàn toàn khác nhau. **Hỏi product trước**: có restore không? Có → consequence 1, không dựng dialog đỏ. Đây là điểm dễ sai nhất của flow.

## B3 — Anatomy → map component

```
scrim        → overlay token + click-outside + z-modal
panel        → Surface variant="dialog", size sm (360), dialog-padding, radius-xl, shadow-lg
header       → titleIcon 40×40 + title xl-bold + description
content      → children (gate Checkbox variant="row" nếu nhánh vĩnh viễn)
footer       → sticky, divider, gap space-3, justify-end
close        → IconButton ghost (showCloseButton)
behavior     → useFocusTrap + pushEscapeLayer + aria-modal/labelledby/describedby
```

**Gap phát hiện khi đo code thật (`Dialog.module.css`):** `titleIcon` hardwire `primary-subtle`/`primary` — destructive dialog cần tone `error-subtle`/`error` (L-STATUS). Đề xuất: prop `titleIconTone` → contribution contract (`ops/lifecycle.md`), KHÔNG nhét icon styled vào children.

## B4 — Spec (rút trích)

```
┌─────────────────────────────────────┐ ← inset dialog-padding (space-6)
│ ┌────┐ Delete Account     ←space-3  │
│ │ ⚠ │  Permanently...    ←space-1  │
│ │40 │                              │
│ └────┘                             │
│ [☐ Tôi hiểu...]  ← space-3, row≥40 │
│ ─────────────── ← space-4, divider │
│        [No, keep it.] [Yes,Delete!]│ ← gap space-3, pad-block space-3
└─────────────────────────────────────┘
```

| Quan hệ | Số | Token | Source |
|---|---|---|---|
| icon→title | 12 | `space-3` | measured Dialog.module.css |
| title→desc | 4 | `space-1` | measured |
| body→gate | 12 | `space-3` | decision: between-groups |
| gate→footer | 16 | `space-4` | measured |
| btn↔btn | 12 | `space-3` | decision: same-group |
| inset | 24 | `dialog-padding`→`space-6` | token |
| icon box | 40 | `size-element-lg` | measured (hardcode 40px → map lại token) |

Ladder: `12 > 4 < 12 < 16 < 24` ✓

## B5 — Prototype ticks

- [ ] Email 60ch + i18n ×1.3 không vỡ 360px panel
- [ ] `?mode=dark` — error-subtle đọc được trên surface
- [ ] 320 viewport — footer buttons wrap đẹp
- [ ] Checkbox chưa tick → destructive disabled (cue ngoài màu)

## B6 — Behavior

- Focus trap trong dialog; Escape đóng; focus restore về trigger
- Gate: `aria-checked` trên checkbox row ≥40 hit
- Loading: destructive button `loading` state, disable cả hai nút
- Sau delete: toast "Account deletion scheduled" (nhánh undo) hoặc điều hướng (nhánh vĩnh viễn)

## B7 — Audit + ghi lại

- Audit commands = 0; mọi số có source.
- Insight mới → vào knowledge: "consequence đổi theo dữ kiện product (undo-window) — hỏi trước khi design dialog" (đã ở `method/behavior.md` ví dụ chuẩn).
