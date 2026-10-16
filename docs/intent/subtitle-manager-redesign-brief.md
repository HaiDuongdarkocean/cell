# Subtitle Manager — redesign brief (design phase)

## Goal

Redesign `SubtitleManagerPanel` tracks view + absorb subtitle settings, per
travel-app UI kit reference (clean cards, pill segmented, airy rhythm).

**Output của phase này = mockup + brief + component mapping. KHÔNG implement
vào product code.** User là grader — design được chấm trước khi deliver.

## Reference & evidence

- Style reference: `C:\Users\The0cean\Downloads\01f0bfd38f9027a573d43001fd2e5b8f.jpg`
  (travel-app UI kit: light cards, radius lớn ~16-20px, pill segmented controls,
  blue accent, bottom icon+label bar, list rows thumb+title+meta+trailing action)
- Current mobile shot (user): `C:\Users\The0cean\Documents\ShareX\Screenshots\2026-10\brave_4PmF67Xm84.png`
- Current desktop shot (live Brave debug): `tmp/debug-brave-pushy-magic/manager-desktop.png`
- Measured: panel 420×527px, bg `rgba(45.5,45.5,45.5,0.88)`, Inter;
  tracksBody 377px tall, dead space ~300px khi ít track; displayRow 45px;
  footer 57px (5 icon+label: Search/OCR/Customize/Hide/Generate).

## Current structure (source of truth: code)

`src/features/subtitle/ui/SubtitleManagerPanel.tsx`:
- views: `tracks` (default) | `appearance` | `search` | `ocr`
- tracks view: header (List icon + title + X) → section bar (InkTabs
  TARGET(n)/NATIVE(n) + [+ import, eye-off hide, audio-lines condense]) →
  TrackList (Off row + ItemRow: radio, name, tags format/ASR/size/source,
  download btn) → OffsetStepper (Latency label + Saved status + −0.5s/val/+0.5s
  pill + reset) → dead space → "Cue display" row (label + InkTabs
  LIST|ACTIVE CUE ONLY, persists `STORAGE_KEYS.PLAYER_MODE_CUE_DISPLAY`) →
  `SubtitleManagerFooter`.
- Appearance view already lives in manager (block/target/native/buttons tabs).

## Required changes

### A. Move settings → manager (P0)
Settings "Phụ đề" section (`SettingsDialogContent.tsx`, data-section="block")
has 3 toggles — move all into manager, then the settings section is deleted in
deliver phase:
- `subtitleOverlayAutoLoad` ("Tự tải phụ đề")
- `subtitleOverlayAutoLoadAsr` ("Cả phụ đề tự động của YouTube") — disabled when
  autoLoad off (keep dependency)
- `subtitleOverlayAutoTranslate` ("Dịch khi thiếu phụ đề bản địa") — same

Design decision needed: placement inside manager. Candidate: "Tự động" group
under Latency in tracks view (same playback context). Mockup phải show vị trí
chốt + disabled state chain.

### B. Cue display + layout redesign (P1)
- Kill ~300px dead space: content top-aligned, display row + footer pin đáy.
- "Cue display" → segmented pill control theo reference (container pill, active
  = solid accent). Gom sát footer thành 1 cụm playback controls (Proximity).
- Track item → card row (radius lớn; selected = accent tint + filled radio).
- Footer: giữ grid icon+label, nhưng Generate nâng primary hoặc tách riêng —
  giảm 5 choice ngang hàng (Hick's).
- Hit target ≥40px mọi icon button (`--touch-target`, Fitts).

### C. Constraints (hard)
- Panel là overlay đè video: giữ dark glass — mượn layout grammar của
  reference (card/pill/hierarchy), KHÔNG clone nền sáng (contrast chết).
- Shadow DOM surface — mount qua `mountReactShadow`; escape qua
  `pushEscapeLayer`; outside-click `composedPath()`.
- Tokens only: sửa `tokens.json`, không hardcode; component từ
  `src/shared/ui/`; icon từ `ICON_CATALOG` (`src/shared/icons/index.ts`).
- i18n en+vi; vi labels dài hơn — check wrap.
- a11y: role/aria giữ nguyên contract (`data-tihoka-id` hooks cho e2e:
  `pm-cue-display-row`, `manager-*`).
- States bắt buộc trong mockup: hover/focus/disabled/saved, 0-track empty,
  nhiều-track scroll.

## Method

Follow `visual-reference-design` pipeline (decompose → compose → place →
size&type → color → icon → reconstruct → verify). Mockup entrypoint:
`src/entrypoints/mockup-subtitle-manager-redesign/` (design-time, xóa khi ship).

Live capture nếu cần thêm state thật: Brave debug session `pushy-magic` port
9331 đang chạy — `node .agents/skills/testing-browser-with-profile/script/probe.mjs
--match youtube --eval "..." --shot name.png` (manager đang mở trên YouTube tab).

## Deliverables

1. Mockup entrypoint render được trong dev server (`npm run dev` →
   `?showcase=` nếu tích hợp showcase, hoặc entry html riêng).
2. `docs/intent/subtitle-manager-redesign-design.md`: atom inventory, component
   tree, size table (px→token→hit target), type table, color map, icon table
   (collision check), state matrix, motion spec, deviation list.
3. Evidence screenshots `tmp/subtitle-manager-redesign/`: desktop + mobile
   width, dark + light, state sweep.
