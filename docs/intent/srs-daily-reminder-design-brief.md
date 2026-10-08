# Design Brief — srs-daily-reminder

## Design Read

Một dòng settings nhỏ trong sheet SrsStudySettings — toggle "Nhắc học hằng ngày" + giờ lý tưởng + status line báo giờ thực sẽ nhắc (hoặc trạng thái bị chặn). Notification ra ngoài OS là system surface — design chỉ quyết nội dung, không quyết chrome.

## Context quote

Intent: *"giời cố định lý tưởng, sau đó hệ thống sẽ theo dõi lịch sử user thường học vào ngày nào để có thể nhắc user vào lúc đó. cơ chế tự điều chỉnh thích nghi"* — Anh yêu

## Primary job

**Bật một lần, biết chắc mình sẽ bị nhắc — và biết nhắc lúc mấy giờ.** Mọi element phục vụ confidence đó: toggle rõ ràng, giờ đọc được, trạng thái chặn không giấu.

## Function audit

| Function | Class | Why |
|---|---|---|
| Toggle bật/tắt reminder | must-have | REQ-1 — control tối thiểu |
| Chọn giờ lý tưởng (preferredHour) | must-have | REQ-1 — anchor cho adaptive |
| Status line: effective hour (learned hay preferred) + trạng thái permission | must-have | REQ-6 — user phải biết feature có thật sự hoạt động không |
| Re-request affordance khi permission bị deny | must-have | REQ-6 alt flow |
| Notification content (title, due+streak body, 2 buttons) | must-have | REQ-2/REQ-3 — OS renders, ta quyết copy |
| Preview/test notification button | remove | Không spec; chrome.notifications trong page context cũng không chắc render được đúng — defer |
| Quiet-hours / nhiều mốc giờ / per-day schedule | remove | Out of scope (intent) |

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Enable | Bật toggle trong SrsStudySettings | `permissions.request` → save → status line hiện giờ sẽ nhắc | Settings sheet, tab General |
| 2 | Pick hour | Đổi "Giờ lý tưởng" | Re-arm; status line cập nhật | Cùng section |
| 3 | Learned | (không action — hệ học sau đủ sessions) | Status line đổi sang "≈21:00 · theo thói quen" | Status line |
| 4 | Blocked | Toggle on nhưng deny notification | Status line đỏ nhạt + nút "Bật lại trong cài đặt" | Status line |
| 5 | Fire | (alarm) | OS notification: title + "N thẻ đến hạn · streak N ngày" + [Học ngay \| Nhắc lại 1h] | OS tray |
| 6 | Click | Click notification | srs-study tab mở/focus | — |
| 7 | Snooze | Click "Nhắc lại 1h" | Re-fire sau 60' nếu vẫn chưa học | — |

Moment of uncertainty: bước 4 — user deny rồi quên; status line đỏ là cách duy nhất feature tự bệnh án.

## Dials

Single variant (all mode): `DESIGN_VARIANCE: 2` — đây là row trong sheet đã có grammar, không phải surface mới; `MOTION_INTENSITY: 0` — settings row không motion; `VISUAL_DENSITY: 4` — tối đa 3 dòng content trong section.

## Variant — "Sibling row" (justified)

- **IA mental model:** "reminder là một schedule setting" — sống cùng `dayBegins` trong tab General, vì cả hai đều là quy ước thời gian của ngày học
- **Visual archetype:** iOS-style settings row, đúng grammar `SettingRow`/`Section` đã có trong file — không invent surface
- **Placement:** section mới "Nhắc học" ngay sau section "Schedule" (dayBegins) — hai quy ước thời gian cạnh nhau
- **Row 1:** label + desc nhỏ + `Toggle size="xs"` (grammar của Answering section)
- **Row 2 (chỉ render khi enabled):** label "Giờ lý tưởng" + `Select` pill (same `pillSelect` class + `HOUR_OPTIONS` as dayBegins)
- **Row 3 (chỉ khi enabled):** status line `rowDesc`-style, 3 trạng thái: `Nhắc lúc 20:00` / `Nhắc ≈21:00 · theo thói quen của bạn` / ⚠ `Thông báo đang tắt — bật lại để được nhắc` (kèm affordance re-request)
- **Why this variant:** bất kỳ divergence nào (card riêng, icon bell, preview notification) đều phá grammar sheet và thêm scope không có trong spec. Row này phải vô hình với siblings.

ASCII layout:

```
┌─ General ─────────────────────────────┐
│ Schedule                              │
│  Day begins at            [04:00 ▾]   │
│  Show study summary       [Finished ▾]│
│ Nhắc học                              │
│  Nhắc học hằng ngày            ( ●)   │ ← toggle xs
│  └ remind me to review every day      │
│  Giờ lý tưởng              [20:00 ▾]  │ ← chỉ khi on
│  Nhắc ≈21:00 · theo thói quen         │ ← status line
│ Answering                             │
│  ...                                  │
└───────────────────────────────────────┘

Blocked state:
│  ⚠ Thông báo đang tắt — [Bật lại]     │

OS notification (content only — chrome OS renders):
┌──────────────────────────────┐
│ 🔵 Tihoka — giờ học rồi!     │
│ 23 thẻ đến hạn · streak 12d  │
│ [Học ngay]     [Nhắc lại 1h] │
└──────────────────────────────┘
```

## States

| State | Rendering |
|---|---|
| disabled | Toggle off; chỉ row 1 hiện (không Select, không status) |
| enabled + granted | Select + status `Nhắc lúc HH:00` |
| enabled + learned | Select + status `Nhắc ≈HH:00 · theo thói quen của bạn` |
| enabled + denied | Select + status ⚠ màu error-muted + ghost button "Bật lại" |
| requesting | Toggle optimistic; permission prompt là OS chrome |

## Responsive

Sheet `min(26rem, 100%)` — không đổi behavior; status line wrap tự nhiên dưới 360px; Select pill co theo content.

## Anti-patterns avoided

- Không bell icon mới — ICON_CATALOG không có `bell`, section headers hiện không icon.
- Không card/elevated surface riêng — row grammar flat như siblings.
- Không "test notification" button — ngoài spec, không verify được OS chrome.
- Không Liquid Glass — n/a cho settings row.

## Mockup

`src/entrypoints/mockup-srs-daily-reminder/` — real SrsStudySettings panel mounted (production component) vs variant: same sheet + reminder section with state switcher (enabled/learned/blocked/disabled). Notification approximation rendered as a static card.
