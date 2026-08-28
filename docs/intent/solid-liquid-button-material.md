# Intent — Solid/Liquid Button Material

> Confirmed 8-field frame from elicitation.

## 1. Problem

`Button` hiện tại chỉ có material `liquid` (glass với SVG filter). Cần thêm material `solid` để dùng trên nền thường, đảm bảo tương phản rõ và tạo cơ sở mở rộng cho nhiều component sau này.

## 2. User

Dương — người duy trì design system của Cell.

## 3. Current workflow

`Button` có nhiều `variant` nhưng đều mặc định glass/liquid. `tokens.json` chứa màu sắc nhưng chưa phân biệt material.

## 4. Pain point

Glass trên nền sáng/trắng quá nhạt, không phù hợp form/dialog/settings; chưa có cơ sở để mở rộng material sang Card, Dialog, Input về sau.

## 5. Evidence

Showcase hiện tại hiển thị liquid trên cả nền trắng/đen; anh yêu cầu solid dùng palette thiên nhiên Cell.

## 6. Desired outcome

`Button` hỗ trợ `variant="solid"` render flat/opaque, dùng màu sẵn có; `liquid` vẫn là mặc định; thêm token material tối thiểu vào `tokens.json`.

## 7. Constraint

- Không overengineer.
- Không tách màu theo material (màu vẫn là màu).
- Không thêm dependency.
- `tokens.json` là SSOT.
- Chuyển dần sau.

## 8. Scope (MVP)

**In scope:**

- Thêm `variant="solid"` cho `Button`.
- Thêm token material tối thiểu cho solid: surface, hover, active, pressed, disabled, border, shadow, focus.

**Out of scope:**

- Card/Dialog/Input solid.
- Tái cấu trúc toàn bộ token màu.
- Migrate component khác.

## Chosen method

`variant="solid"` trong API `Button` hiện tại.

## Elicitation log

| Round | Question / Answer |
|---|---|
| Q1 | 2 component hay 1 prop? → User: "có loại", material cấp design system, không chỉ button |
| Q2 | prop hay token? → User: "cấp design system" |
| Q3 | token trước hay component trước? → User: "định nghĩa trước" |
| Q4 | solid là M3 filled hay flat opaque? → User: "flat/opaque không glass, dùng palette thiên nhiên Cell" |
| Q5 | nhóm token nào? → User: "tất cả" (surface, fg, border, shadow, hover, active, pressed, disabled, focus) |
| Q6 | tokens.json hay file riêng? → User: "màu hiện tại không phân chia, don't overengineer, về sau chuyển dần" |
| Q7 | variant hay class? → User: "dùng variant đi sẽ dễ hơn" |
