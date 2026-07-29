# INTENT — Content-script UI → React + shadow root (SSOT)

> Confirmed intent. Source of truth cho mọi phase implementation.
> Related: `src/shared/styles/STANDARD.md` (design system standard), `docs/design-system/daft.md` (reference).

## Outcome

Một codebase React component duy nhất cho mọi UI (popup, sidepanel, content-script, design-system-showcase). Sửa 1 chỗ, áp dụng everywhere.

## User

Anh yêu (maintainer). Pain point: phải viết 2 cách (React cho popup/sidepanel, HTML/CSS thuần cho content-script), migrate popup dictionary + card creator sang UniversalPanel phải viết lại, giao diện vỡ, duplicate nhiều.

## Why now

Đã có design-system-showcase + UniversalPanel (React). Token system đã có. Đã có `mountUniversalPanel` pattern. Đủ nền tảng để thống nhất.

## Success

- Mọi chrome UI container render bằng React component. Phần lớn mount trong shadow root; card creator / settings / universal panel chỉ chuyển sang shadow root nếu Phase 1b PoC chứng minh `position: fixed` overlay hoạt động đúng. Text-level decoration (token span, word highlight overlay) ở lại light DOM vì neo vào văn bản trang chủ.
- Cùng component xuất hiện trong design-system-showcase mà không sửa code.
- `tokens.json` có 3 lớp token đầy đủ (primitive → semantic → component) theo STANDARD.md.
- 0 hardcoded color/spacing/z-index ngoài `tokens.json` + `SubtitlePreview`.
- Popup dictionary và `DictionaryTab` trong UniversalPanel dùng chung `DictionaryCore`, đạt feature parity.

## Constraint

- MV3, content-script IIFE bundle, phải chạy được trên YouTube/Netflix/GeeksforGeeks.
- Refactor data flow: cues → Zustand/React state, content-script chỉ dispatch events.
- Xóa code cũ sau khi migrate xong từng phase.
- Tuân thủ `src/shared/styles/STANDARD.md` (naming convention, when-to-use).

## Out of scope

- Migration ngược (giữ code cũ làm fallback) — xóa sạch sau mỗi phase.
- Refactor business logic (chỉ refactor UI layer + data flow binding).

## Phases

### Phase 0 — Design system standard + tokens migration

**Mục tiêu:** Thiết lập ngôn ngữ chung + áp dụng 3 lớp token vào `tokens.json`.

**Tasks:**
1. Viết `src/shared/styles/STANDARD.md` — ngôn ngữ chung, naming convention, when-to-use. ✅
2. Update `src/shared/styles/README.md` trỏ đến STANDARD.md. ✅
3. Apply migration plan vào `tokens.json`:
   - Rename + alias ngược: `--color-foreground` → `--color-text-primary`, `--color-text-muted` → `--color-text-secondary`, `--color-card` → `--color-surface-card`, `--color-popover` → `--color-surface-popover`.
   - Add semantic layer mới: `--color-text-disabled`, `--color-icon-primary/secondary/disabled`, `--color-on-success/warning/error`, `--color-overlay/hover/pressed`, `--color-border-emphasized`, `--color-skeleton`.
   - Add semantic radius: `--radius-inner`, `--radius-element`, `--radius-container`, `--radius-page`.
   - Add semantic typography: `--text-body`, `--text-label`, `--text-heading-1/2/3`, `--text-supporting`.
4. Update `scripts/generate-tokens.js` để sinh alias + semantic tokens mới.
5. Regenerate `tokens.css` + `tokens.ts`.
6. Audit: dùng `rg` kiểm hardcoded color/spacing, đảm bảo 0 ngoài `tokens.json` + `SubtitlePreview`.
7. Capture baseline bundle + RAM trước khi bước vào Phase 1.
7. Verify build pass + design-system-showcase render đúng.

**Thành công khi:** `tokens.json` có 3 lớp token đầy đủ theo STANDARD.md, `tokens.css` regenerate không lỗi, build pass, showcase render đúng.

---

### Phase 1 — Infra: shadow root + React mount helper

**Mục tiêu:** Xây dựng infrastructure để mount React component vào shadow root của content-script.

**Tasks:**
1. Tạo `src/shared/lib/shadowRoot/mountReactShadow.ts` — helper tạo shadow root + inject CSS (tokens + component CSS) + createRoot.
2. Tạo `src/shared/lib/shadowRoot/injectShadowCss.ts` — extract CSS từ Vite bundle, inject vào shadow root.
3. Tạo `src/stores/cuesStore.ts` — Zustand store cho subtitle cues (target + native + active cue index).
4. Tạo `src/shared/lib/shadowRoot/ShadowThemeProvider.tsx` — ThemeProvider cho shadow root (inject tokens + data-theme).
5. Sửa `jest.config.ts` để support `?inline` CSS module trong test.
6. PoC: mount 1 Button vào shadow root trên trang test, verify CSS cách ly.
7. Verify trên YouTube + Netflix + GeeksforGeeks.
8. Định nghĩa z-index + shadow host ordering contract.

**Thành công khi:** Button React render trong shadow root, style đúng, không bị CSS trang đè, theme toggle hoạt động.

---

### Phase 2 — Subtitle block + nav cluster + subtitle panels

**Mục tiêu:** Chuyển subtitle overlay (target + native) + nav cluster + manager/offset/toast/hint panels sang React component + shadow root.

**Tasks:**
1. Tạo `src/features/subtitle/ui/SubtitleBlock.tsx` — React component render target + native subtitle từ cuesStore.
2. Tạo `src/features/subtitle/ui/NavCluster.tsx` — React component render nút prev/next/replay/repeat.
3. Tạo `SubtitleManagerPanel.tsx`, `SubtitleOffsetPanel.tsx`, `SubtitleToast.tsx`, `SubtitleHint.tsx` từ các file vanilla tương ứng.
4. Refactor data flow: content-script detect cues → dispatch events → cuesStore → SubtitleBlock re-render.
5. Mount SubtitleBlock + NavCluster + panels vào shadow root trên video player element.
6. Áp dụng `OverlayStyleConfig` (target + native) từ settings qua React props.
7. Xóa code subtitle cũ sau verify.
8. Thêm previews vào design-system-showcase.
9. Verify trên YouTube + Netflix: realtime cues, style đúng, nav cluster click hoạt động.

**Thành công khi:** Toàn bộ subtitle UI render bằng React trong shadow root, đúng style, realtime, không bị CSS trang đè. Cùng component xuất hiện trong showcase.

---

### Phase 3 — Orbital badge

**Mục tiêu:** Chuyển `createOrbitalBadge` sang React component + shadow root.

**Tasks:**
1. Tạo `src/features/dictionaryPopup/ui/OrbitalBadge.tsx` — React component, giữ gesture/drag/expand/collapse logic.
2. Refactor gesture detection thành hook `useOrbitalGesture`.
3. Mount OrbitalBadge vào shadow root trên body.
4. Xóa `createOrbitalBadge.ts` + `orbitalBadgeCss.ts` + helper files.
5. Thêm OrbitalBadge vào design-system-showcase.
6. Verify: drag, expand, collapse, edge-snap, pointer preset, click → open panel.

**Thành công khi:** OrbitalBadge render bằng React, gesture hoạt động đúng, position persist, không bị CSS trang đè.

---

### Phase 4 — Popup dictionary

**Mục tiêu:** Tái sử dụng vanilla popup dictionary đã có đầy đủ tính năng; chuyển thành `DictionaryCore` dùng chung cho popup shadow root và `DictionaryTab` trong UniversalPanel.

**Tasks:**
1. Tách `DictionaryCore` (headless hooks + presentation), `DictionaryToolbar` 4 tab (audio/image/translate/links).
2. Bổ sung 4 lazy tab panels cho `DictionaryTab` (hiện thiếu ở bản React).
3. Tạo `PopupDictionary.tsx` với shell + anchor positioning + resize handle từ `popupShell.ts`.
4. Refactor lookup logic thành hook `useDictionaryLookup`.
5. Mount PopupDictionary vào shadow root, position theo orbital badge pointer tip.
6. Xóa code popup dictionary vanilla sau verify.
7. Thêm PopupDictionary vào design-system-showcase (mock data).
8. Verify: lookup, candidate selection, TTS, external links, 4 tab toolbar.

**Thành công khi:** PopupDictionary render bằng React, lookup hoạt động, position theo pointer, 4 tab toolbar hoạt động, `DictionaryTab` cũng dùng chung core, không bị CSS trang đè.

---

### Phase 5 — Tokenize (word badges + FAB)

**Mục tiêu:** Chuyển tokenize FAB + panel sang React + shadow root; token spans vẫn ở light DOM vì neo vào văn bản trang chủ.

**Tasks:**
1. Tạo `src/features/tokenize/ui/TokenizeFab.tsx` — React component thay thế `tokenBadge.ts`.
2. Refactor tokenize logic thành hook `useTokenize`.
3. Mount `TokenizeFab` vào shadow root trên body.
4. Giữ `tokenSpanRenderer.ts` + `tokenSpanCss.ts` ở light DOM, chỉ dọn token hardcoded.
5. Xóa `tokenBadge.ts` + `tokenBadgeCss.ts` cũ.
6. Thêm TokenizeFab vào design-system-showcase.
7. Verify: FAB toggle, token spans đúng frequency tier/status, position trên subtitle.

**Thành công khi:** Tokenize FAB render bằng React trong shadow root, token spans vẫn hoạt động ở light DOM, đúng tier color.

---

### Phase 6 — Card Creator

**Mục tiêu:** Chuyển Card Creator (Dialog, BottomSheet, QueueSidebar, MediaList) sang React. Mount ưu tiên shadow root, fallback light DOM nếu fixed overlay PoC thất bại.

**Tasks:**
1. Refactor `CardCreatorDialog`, `CardCreatorBottomSheet`, `QueueSidebar`, `MediaList` thành React components đã có → mount theo cơ chế đã chọn (shadow hoặc light DOM + reset).
2. Refactor card creator state thành Zustand store `useCardCreatorStore`.
3. Mount Card Creator trên body.
4. Xóa code card creator HTML/CSS thuần cũ (nếu có).
5. Thêm Card Creator vào design-system-showcase (mock data).
6. Verify: queue, media list, field edit, preview, export to Anki.

**Thành công khi:** Card Creator render bằng React, queue/media/field/preview hoạt động, không bị CSS trang đè.

---

### Phase 7 — Settings Dialog (content-script mount)

**Mục tiêu:** Settings Dialog mount trong content-script. Ưu tiên shadow root, fallback light DOM nếu fixed overlay PoC thất bại.

**Tasks:**
1. `SettingsDialog` đã là React — chỉ cần mount theo cơ chế đã chọn.
2. Update `mountSettingsDialog` để dùng helper từ Phase 1.
3. Verify: tất cả settings sections render đúng, save/load settings, theme toggle.

**Thành công khi:** Settings Dialog render đúng cơ chế, không bị CSS trang đè, settings save/load hoạt động.

---

### Phase 8 — UniversalPanel mount

**Mục tiêu:** UniversalPanel chuyển sang cơ chế đã chọn. Ưu tiên shadow root, fallback light DOM nếu fixed overlay PoC thất bại.

**Tasks:**
1. Update `mountUniversalPanel` để dùng helper từ Phase 1.
2. Đảm bảo Dialog/Drawer/Tooltip portal nằm đúng chỗ.
3. Verify: tab switch, dictionary tab, settings tab, card creator tab, tokenize toggle.

**Thành công khi:** UniversalPanel render đúng cơ chế, không bị CSS trang đè, tất cả tabs hoạt động.

---

### Phase 9 — Design-system-showcase auto-discovery

**Mục tiêu:** Design-system-showcase tự động phát hiện + render mọi component, không cần sửa tay.

**Tasks:**
1. Tạo auto-discovery mechanism: scan `src/shared/ui/` + `src/features/*/ui/` → render mọi component với default props.
2. Scan `ICON_CATALOG` → render icon grid.
3. Scan `tokens.json` → render token swatches.
4. Thêm mock data provider cho components cần data (cues, dictionary, card creator).
5. Verify: showcase tự động cập nhật khi thêm/sửa component mới.

**Thành công khi:** Showcase tự động phản ánh mọi component mà không cần sửa `App.tsx`.

---

## Nguyên tắc chung (áp dụng mọi phase)

1. **Chrome UI containers → viết React → ưu tiên mount vào shadow root → nếu fixed overlay không ổn thì giữ light DOM + class prefix `cell-` + local reset. Token span / word highlight overlay giữ light DOM.**
2. **Cùng component dùng được cả content-script lẫn showcase mà không sửa.**
3. **Data flow refactor: content-script chỉ dispatch events, React component đọc từ Zustand store.**
4. **Tuân thủ `src/shared/styles/STANDARD.md` — naming convention, when-to-use, audit checklist.**
5. **Mỗi phase: build pass + typecheck pass + test mới viết trước khi xóa test cũ + verify trên trang web thật (YouTube, Netflix, GeeksforGeeks).**
6. **Commit riêng cho mỗi phase, kèm feature flag rollback cho UI thay thế.

## Tham chiếu

- Spec: `docs/specs/content-script-react-shadow-root.md`
- ADR: `docs/adr/075-shadow-root-react.md`
- Standard: `src/shared/styles/STANDARD.md`
- Reference: `docs/design-system/daft.md`
- Tokens source: `src/shared/styles/tokens.json`
- Token generator: `scripts/generate-tokens.js`
- Current showcase: `docs/design-system/design-system-showcase.html`
- Showcase entrypoint: `src/entrypoints/design-system-showcase/`
