# Sync All Icon Buttons to DS

## Problem Statement

HMW đồng bộ tất cả icon button trên video overlay (subtitle cluster, upload/manage subtitle, toggle side panel) với IconButton atom trong popup, sao cho cả hai thế giới (React popup + content-script overlay) cùng tuân theo 1 DS spec duy nhất?

## Recommended Direction

Đồng bộ toàn bộ icon button (React + content-script) về DS spec `## 2. Icon Button`:
- `radius: --radius-full` (circular)
- `size: 40×40` (DS default, md)
- `no border at rest` (YouTube pattern borderless)
- `no shadow` (P1 content-first)
- `hover: --color-surface-hover fill`
- `focus: 2px --color-primary ring, offset 2px`

Cluster button giữ resizable override qua `--sb-btn-size` (user setting). DS spec ghi default 40px, `--sb-btn-size` override khi user change.

React IconButton size scale shift: xs=28, sm=32, md=40 (was xs=24, sm=28, md=32).

## Key Assumptions to Validate

- [ ] **40×40 fit popup header** — verified: 480px header, 4×40=160px, dư 266px cho title. OK.
- [ ] **No border on bright video** — icon trắng trên video sáng có thể invisible. Test trên YouTube video bright (white bg). Nếu fail → thêm `color: var(--color-text)` với text-shadow thay border (ponytail: contrast hack, not border).
- [ ] **No shadow on panel-toggle** — ☰ trên video bright có thể blend. Test thực tế. Nếu fail → dùng bg alpha `rgba(15,23,42,0.6)` thay shadow.

## MVP Scope

### In
1. Update `design-system.md` YAML: IconButton size 40×40, radius-full (đã có)
2. Update `IconButton.module.css`: size scale xs=28, sm=32, md=40
3. Update `subtitleBlockCss.ts` `.cluster-btn`: radius-md → radius-full, remove border at rest, default --sb-btn-size 40px
4. Update `subtitlePanel.ts` `createToggleButton`: remove shadow, remove border, radius-full, 40×40
5. Update `subtitleManagerPanel.ts`: same pattern
6. Update `subtitleImport.ts`: same pattern
7. Update `subtitleBlockDom.ts` card-creator buttons: inherit .cluster-btn (auto)
8. Build + verify runtime (popup + content-script overlay)

### Out (Not Doing)
- Không thêm `--icon-btn-size` token (DS spec ghi 40, --sb-btn-size là override duy nhất cho cluster)
- Không đổi NavCluster button logic (hold/repeat/seek) — chỉ đổi visual
- Không merge React IconButton và content-script CSS thành 1 file (2 thế giới khác nhau, giữ parallel)
- Không thêm variant `icon-btn--outlined` / `icon-btn--filled` (DS có nhưng YAGNI — chưa cần)

## Not Doing (and Why)

- **Không thêm 17 component DS showcase vào src/** — YAGNI, không có use case
- **Không refactor content-script sang React** — isolated world, không thể
- **Không đổi cluster resizable behavior** — user control là feature, không phải bug
- **Không thêm border variant cho overlay** — thử no-border trước, nếu invisible mới thêm ponytail hack

## Open Questions

- IconButton size scale: có cần xs/sm/md 3 cấp, hay chỉ md=40? (hiện 3 cấp, có thể drop xs)
- Card-creator buttons (quick/edit) có nên circular hay giữ square? (DS nói IconButton circular, nhưng card-creator có thể là action button khác)
