# Settings tab — interaction-level audit (post-redesign)

> Audit động trên SettingsDialogContent thật (design-system showcase mount production component), viewport 600/320, light/dark. Mọi finding có evidence: DOM role/aria, computed style, rect, element screenshot. Scripts: `tmp/settings-tab-redesign/audit{,2,3,4,5}.mjs` → `tmp/settings-tab-redesign/audit/`.

## Design Read

Settings tab sau redesign dùng grammar Section→Group→Row phẳng — hình thái đúng hướng (YouTube/Spotify-like bands). Audit tương tác lộ **một P0 toàn cục ở atom Toggle** (không phải lỗi redesign — regression từ commit khác) cộng các P1/P2 về overflow hẹp, a11y naming, và nhất quán menu chrome.

## Verified tốt (không phải finding)

| Behavior | Evidence |
|---|---|
| Select → menu mở, `aria-expanded=true`, listbox/option roles | report.json selects ×8 |
| Selected option có `aria-selected` + check icon + `primary-subtle` bg | `select-*.png`, computed `rgba(94,165,233,0.12)` |
| Keyboard nav qua `aria-activedescendant`, ArrowDown đổi option, Esc đóng | report.json `keynav`/`esc` |
| Menu không tràn ở 320 | `narrow320.rect.right=228 < vw=261` |
| Focus-visible ring 2px primary, cả dark (`rgb(106,178,245)`) | report2 `darkFocus`, `focus-tab.png` |
| MultiSelect: chips, `+` affordance/option, exclusive "All languages", menu giữ mở cho multi-pick | `p3-multiselect.png`, `msAfterSelect` |
| `labelFor`/`id` resolve tới control focusable (set-parallel → BUTTON) | report5 `labelClick.focused=true` |
| ShortcutInput: click→focus→gõ `J` capture được, có listening visual | report5 `shortcut.captured=true` |
| Profile radio cards: selected = primary-subtle + border + dot | `segmented-languageProfile.png` |
| Kebab menu: `role=menu`, menuitems Edit/Move up/down/Delete | report5 `kebabMenu` |
| HintIcon: tooltip `role=tooltip`, radius 12px + shadow token | report2 `hint_audio-mode-hint` |
| Nav `aria-current="true"` trên General; fade mask khi overflow | report.json `nav`, `navBtns.scrollable` |
| Dark menu: surface đậm + hairline + selected `primary-subtle` | report2 `darkMenu` |

## Findings

### P0 — Toggle track vô hình: mọi toggle render thành "chấm tròn trôi"

- **Question**: control có truyền đạt được trạng thái on/off không?
- **Aspect**: Components & States (function-blocking visual).
- **Evidence**: element screenshot `p4-switch-0-general.png` = chấm tròn đặc, không có pill track. Computed: `label._toggle_xs` 36×20; `input` `height:100%` + `box-sizing:border-box` + `border-block: (40−20)/2 = 10px` → `background-clip:padding-box` = **0px painted** → track `var(--toggle-default|active)` không bao giờ hiện. Chỉ `.thumb` (svg dot, `fill: var(--toggle-dot)`) render.
- **Root cause**: commit `c15604c4` "drop the touch-target min-size floor" gỡ `min-height: var(--touch-target)` khỏi `.toggle` → label co về `--toggle-h` (20px xs / 32px sm) → invariant "border insets track" vỡ. Trước đó label ≥40 → padding-box = 20px → track paint đúng (ảnh `before-direct-600-light-general.png` vẫn thấy pill xanh).
- **Blast radius**: `Toggle` default `size='xs'` và gần như mọi call site không truyền size → Settings (9+), `SrsStudySettings` ×6, `ResourceCard`, `SourceDetailPanel`, `AnkiStatusSyncPanel`, `StudyModesTab`, `CleanupRulesSection`, `TtsLanguagePanel`, popup `VideoCard`/`SubtitleCard`/`DownloadCard`… `sm` cũng bị degrade (track 24px thay vì 32px).
- **Fix (SSOT, 1 file `Toggle.module.css`)**: cho `.input` `box-sizing: content-box; width: var(--toggle-w); height: var(--toggle-h)` — border-transparent mở rộng hit-area ra **ngoài** thay vì ăn vào trong; track luôn paint đủ `toggle-h`. `.toggle` giữ `align-items:center` để input overflow đối xứng. md (pad=0) không đổi. Verify: element-shot toggle checked hiện pill xanh 36×20 + ring 40×40 hit area.

### P1 — ResourcesPanel band-input rows tràn ở ≤320px

- **Question**: layout hierarchy có sống sót ở độ rộng mobile tối thiểu không?
- **Aspect**: Layout & Responsive.
- **Evidence**: `report2.overflow320` — `[class*=bandInputWrap]` w=156 `flex:0 0 auto` trong `.bandRow` w=197 → `right=264–272 > vw=261` (~10–70px tràn); `_root/_wrapper/_input` theo sau. Ảnh 320 có horizontal scrollbar.
- **Fix**: `.bandInputWrap`/`bandInput` += `min-width:0` + `flex:1 1 auto` (hoặc `flex-shrink:1`) trong `ResourcesPanel.module.css`; input bên trong `width:100%`. Verify pixel: không element nào `right > vw` ở 320.

### P1 — `[role="listbox"]` của Select thiếu accessible name

- **Question**: screen reader đọc menu là "list của cái gì"?
- **Aspect**: Accessibility.
- **Evidence**: `lbInfo.lbLabel=null, lbLabelledBy=null` trên mọi select đã đo (8/8). Trigger có `aria-haspopup` nhưng popup không thừa hưởng label.
- **Fix (SSOT `Select.tsx`)**: `aria-labelledby={triggerId}` (id trigger) hoặc `aria-label` mirror label của control — một chỗ sửa phủ toàn app.

### P2 — Menu chrome không nhất quán giữa Select và Menu

- **Question**: hai loại floating menu trong cùng tab có cùng "shape language" không?
- **Aspect**: Visual System / SSOT.
- **Evidence**: Select menu surface `radius=12px`, `shadow 0 4px 6px -1px 6%`, bg `color(srgb 0.856 0.873 0.89)` (field-gray — gần trùng bg trigger → menu "chảy" liền trigger thay vì nổi); Menu (kebab LPP) `radius=6px`, bg gần-trắng `0.976`. Cùng là popup-menu mà 2 radius + 2 surface + cùng 1 shadow yếu.
- **Proposal**: converge cả hai lên **một** menu-surface recipe: `--color-surface` (elevated, không phải field) + `--radius-lg` + `--shadow-menu`/menu-level shadow. Select listbox hiện dùng surface riêng — đổi token một chỗ trong `Select.module.css`/Menu.

### P2 — Subnav affordance ở 320 chỉ còn fade, không còn chevron

- **Question**: user 5–80 tuổi có nhận ra còn section ẩn sau mép phải không?
- **Aspect**: Information Architecture / discoverability.
- **Evidence**: `navBtns.btns=[]` — không có `data-cell-id` scroll button nào trong DOM ở 320 (nav `sw=1183 > cw=213`, có `_fadeEnd_`). Commit `70a5d597` từng thêm chevron Buttons (`up-settings-subnav`), hiện code chỉ còn fade — chevron mất lúc nào đó trong rebuild.
- **Proposal**: fade-only là YouTube-acceptable nhưng yếu hơn spec trước; hoặc khôi phục bound-aware chevron (đã từng có), hoặc chấp nhận fade + cập nhật spec `up-settings-subnav` cho khớp reality. Quyết định cần Anh yêu.

### P3 — Row-level hover absent là cố ý; note để không "fix" nhầm

- SettingsRow không đổi bg khi hover (report5 `rowHover.changes=false`) — đúng grammar band tĩnh (chỉ control tương tác). Giữ.

## Mock limitations (không verify được trong showcase)

- Resources enable-toggles không flip: `onToggleComponent`/`setResourceEnabled` đi async IDB — showcase không có backend → im lặng. Cần spot-check trên extension thật.
- `resources`/`sync` panels render mock rỗng — cấu trúc row kiểm được nhưng data-state (progress bars, error alerts) không đầy.

## Verify commands

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run build
node tmp/settings-tab-redesign/audit4.mjs   # element-shot toggle sau fix — phải thấy pill
```
