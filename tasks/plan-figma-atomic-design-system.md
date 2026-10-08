# Plan — Figma Atomic Design System Rebuild

> Yêu cầu gốc: dùng MCP **Figma** thiết kế lại design system — 4 theme, Atomic Design Methodology, vector variant edit được, từ foundations (color/size/spacing) → atoms → molecules → organisms → templates → pages. Bước đầu: audit tất cả màn hình hệ thống, cắt ra atoms/components.
>
> Tool: Figma remote MCP (`use_figma` = Plugin API write, `get_screenshot` verify, `create_new_file`, `get_variable_defs`, `search_design_system`). Auth ✅ `whoami` = Full seat (team "Nguyễn Hải Dương's team", starter tier, admin).
> SSOT code: `src/shared/styles/tokens.json` · `src/shared/ui/*` · `docs/design-system/COMPONENT_INVENTORY.json` · `docs/design-system/DESIGN.md`.
> Prior art: Penpot file `tihoka` (228 comps — chỉ là tham chiếu, KHÔNG target).

## 0. Truths đã verify (2026-10-05)

| Fact | Evidence |
|---|---|
| 4 theme = 4 preset `dawn · forest · ocean · warmth`, mỗi preset light+dark → **8 combo** | `PRESETS` trong `themeStorage.ts`; `presets.*` tokens.json; runtime `[data-preset][data-theme]` |
| Preset mặc định app = `dawn`; `core` quiet-confidence là merge base | `themeConfig.ts` |
| Figma MCP remote connected, `use_figma` write-capable, Full seat | `mcp_list_tools` + `whoami` |
| ⚠️ Tier `starter` → variable **modes per collection giới hạn** (free=1 mode) → verify tại Phase 2 trước khi chọn kiến trúc token | Figma plan limits |
| `use_figma` cần **file đang mở** trong Figma (desktop/web) | remote MCP semantics |
| Repo: 107 shared components; ~150 feature `.tsx` trên ~28 surfaces; 92 shared comps thực dùng (matrix: `tmp/figma-atomic-ds/extraction.json`) | extraction script |
| Showcase harness: `localhost:5180` + `?showcase=<title>&mode&viewport&data&preset` — 123 showcase titles | autoDiscovery |
| Item `player-mode-mobile-layout` owner `devin-mobile-player-1791176291` — không đụng | pipeline-state |

## 1. Scope & non-goals

**In scope**
- Audit render-based mọi surface sản phẩm → extraction table → atomic map tổng.
- Rebuild trong Figma: variable layer 4 preset × 2 mode → atoms (component sets + variants + auto layout + bound variables) → molecules → organisms → templates → pages.
- Mapping doc Figma ↔ `src/shared/ui` cho drift-check.

**Non-goals**
- Không sửa `src/` (design-tooling track).
- `mock-*` KHÔNG phải surface audit — chỉ môi trường mount overlay. `mockup-*` = design artifacts đọc tham chiếu.
- Penpot `tihoka` chỉ là prior art.

## 2. Screen inventory — danh sách audit đầy đủ

| # | Surface | Source | Render evidence |
|---|---|---|---|
| A1 | Toolbar popup | `src/entrypoints/popup` | showcase `Popup Page` / ext thật |
| A2 | Side panel | `src/entrypoints/sidepanel` | showcase `Side Panel Page` / ext thật |
| A3 | Launcher dashboard | `entrypoints/launcher-dashboard` | URL :5173 trực tiếp |
| A4 | Local player | `entrypoints/local-player` + `features/local-player` | URL :5173 |
| A5 | Reader | `entrypoints/reader` + `features/reader` | URL :5173 |
| A6 | SRS study | `entrypoints/srs-study` + `features/srs` | URL :5173 |
| A7 | Options/TTS verify | `public/options.html` | audit-lite (utility, không rebuild) |
| B1 | Subtitle overlay cluster (NavCluster, SubtitleBlock, OffsetLayer, ManagerLayer, SubtitleHint, CueRecommendFab, ClusterRightToolbar) | `features/subtitle/ui` | showcase `Subtitle Overlay Page` + mock-streaming |
| B2 | Player Mode overlay (desktop + mobile in-flight) | `features/subtitle/ui/PlayerMode*` | showcase `Player Mode Overlay Page` |
| B3 | Subtitle split-view/panel (SubtitlePanel, CueList, Manager/Search/Offset, HostManagerSheet, SubtitleToast) | `features/subtitle/ui` | mock-streaming + ext |
| B4 | Universal Panel + tabs (CardCreator, Dictionary, Playlist, Settings, Vocabulary) + TokenizeControls | `features/universalPanel` | showcase `Universal Panel Page` |
| B5 | Dictionary popup (+OrbitalBadge, CandidateView, ImagePanel, LinksPanel, TranslatePanel, PosVariantNav) | `features/dictionaryPopup` | showcase `Dictionary Popup Page`/`PopupDictionary` |
| B6 | Card Creator dialog (content, QueueSidebar, settings panels, MediaList, BottomSheet) | `features/cardCreator` | showcase `Card Creator Dialog Page` |
| B7 | Settings dialog (content + profile/dictlinks/wordbadge/dictpopup panels) | `features/settings` | showcase `Settings Dialog Page` |
| B8 | Condensed audio pill | `features/condensedAudio` | mock-streaming |
| C1 | Study Modes (CustomModeBuilder, StepEditor, PracticeOptions, SubtitlePractice, SpeedPill) | `features/studyModes` | showcase `Study Modes Panel` |
| C2 | Vocabulary tab | `features/vocabulary` | showcase `Vocabulary Panel` |
| C3 | Sync · Anki import · JobRow | `features/sync`+`ankiImport`+`jobs` | ext thật |
| C4 | Audio panels · OCR · Pronunciation · TTS | `features/audio`+`ocr`+`tts`+`pronunciation` | showcase `Pronunciation Panel` / ext |
| C5 | Theme panel (ThemePanel, PresetSwitcher, ModeCards) | `features/theme` | showcase `Theme Panel` — **bắt buộc cho 4-theme verify** |
| C6 | Dictionary mgmt (ResourcesPanel, ResourceCard, Dropzone, ImportProgress, FrequencyBandsEditor) | `features/dictionary` | showcase `Dictionary Resources Panel` |
| C7 | Session recap | `features/sessionRecap` | ext thật |
| C8 | Tokenize (ComprehensionPill/Badge) | `features/tokenize` | showcase `Tokenize Controls Concepts` |
| D1 | Component sweep — ~90 component showcases | `shared/ui/*.showcase` | gallery :5180 |

## 3. Phase plan

### Phase 0 — Re-baseline (DONE cho phần repo; Figma file mới = sạch)
- ✅ Repo truth: tokens.json (core/derived/static/component/composite/presets×4), 107 comps inventory, extraction matrix 92 comps × 20 surfaces.
- ✅ Prior-art dump: Penpot baseline `tmp/figma-atomic-ds/baseline.json` (giữ làm reference).
- Figma: `create_new_file` → "Tihoka — Design System" (hoặc file Anh chỉ định); ghi fileKey vào `tmp/figma-atomic-ds/figma-file.json`.

### Phase 1 — Screen audit & atomic extraction
1. **Render evidence:** script `tmp/figma-atomic-ds/capture.mjs` — mọi showcase × light/dark (+viewport 375, data empty/overflow cho page-level) → `tmp/figma-atomic-ds/screens/`. Standalone pages qua :5173. Overlay thật qua Playwright+ext khi showcase thiếu trạng thái.
2. **Extraction table per screen** (đã có data extraction.json — bổ sung variant axes + tokens từ đọc code):

   | Element | Vai trò | Component map (`src/shared/ui` hoặc `custom`) | Atomic level | Variant axes | Tokens chạm |

3. **Merge → atomic map:** `docs/audits/20261005-screen-atomic-map.md` — component × surfaces × variants-needed + gap list (CueCard, NavCluster, ModeCard, WordRow, ProfileRow, FabCluster, StatusPill…).
- **AC:** mọi surface có screenshot + bảng; stop khi 2 surface liên tiếp không sinh element mới.

### Phase 2 — Foundations (Figma variables, 4 themes)
1. **Kiến trúc variables** (verify mode limit đầu tiên — `use_figma` thử add 2 modes):
   - Ưu tiên (nếu ≥4 modes OK): collection `preset` modes=[dawn,forest,ocean,warmth] cho 9 core colors + collection `mode` modes=[light,dark] cho semantic → frame stack 2 collections = 8 combos, khớp `[data-preset][data-theme]`.
   - Fallback (starter 1 mode): collection `primitives` + 8 collections `semantic/<preset>-<mode>` alias primitives; theme demo = duplicate frames.
   - Semantic set đầy đủ ~170 derived tokens + static set (spacing/radius/size/fontSize/weight/leading/tracking/shadow/opacity) → variables + text/effect styles.
2. Foundations page: boards swatch per preset×mode, spacing scale, type scale — bound to variables.
- **AC:** `get_variable_defs` trên board trả đúng hex tokens.json; switch mode đổi màu frame (nếu plan cho phép).

### Phase 3 — Atoms (editable component sets)
- Thứ tự theo consumer count (Icon 107 → Button 120 → Text 43…); ~60 atoms.
- Per atom: **Component set** (Figma variants) với axes thật (Button: `variant×size×state`), auto layout, **bound variables** cho fill/stroke/text/radius/spacing, icon từ `07 Icons`-equivalent (tạo icon components vector từ `src/shared/icons` SVG paths — editable).
- Page `02 Atoms`, sections per category; verify `get_screenshot` vs showcase PNG (vision-reader chấm).
- **AC:** mọi atom trong map có component set, variants switch được, 0 hardcode color.

### Phase 4 — Molecules → `03 Molecules`
Compose từ atom instances: MenuItem, Select row, FormGroup, FieldRow, Alert + gap list (CueCard, NavCluster, ModeCard, WordRow, ProfileRow, PhonemeChip, FabCluster…).

### Phase 5 — Organisms → `04 Organisms`
Header, bottom-nav, Card Creator shell, Settings sidebar, cue-list region, dict popup shell.

### Phase 6 — Templates → `05 Templates`
Page shells + overlay shells (video stage + zones), `slot/` convention.

### Phase 7 — Pages → `06 Pages`
Rebuild surfaces bằng instances; ưu tiên B-series → A-series → C-series; breakpoint boards 375/1280; theme verify trên trang trọng yếu.

### Phase 8 — Governance
- `docs/design-system/figma-map.json`: component name ↔ Figma node/component id ↔ src path ↔ level ↔ axes.
- Regenerate `COMPONENT_INVENTORY`, update `docs/0-wiki.md`, ADR (variables architecture + sync direction Figma↔tokens.json), report → `tasks/reports/`.

## 4. Verification chuẩn

- Figma: `get_screenshot` mọi section; `get_variable_defs` assert bound; `use_figma` audit snippet (0 fills không variable trong component sets).
- Repo artifacts: `npm run typecheck && npm run build` khi đụng `src/` (không đụng tới khi có item riêng).

## 5. Decisions — CHỐT 2026-10-05 (Anh duyệt)

1. **4 themes** = dawn/forest/ocean/warmth × light/dark = 8 combos → Figma variables (modes hoặc collections tùy plan limit).
2. **Pipeline**: item `design-system-atomic-rebuild` đã init (stage=analyze, owner `devin-ds-atomic-1791216653`, uiSurface=yes).
3. **Cadence**: chạy liên tục Phase 0→3, review sau atoms.
4. **Scope**: chỉ trang hệ thống thật; `mock-*` chỉ làm mount env; `options.html` audit-lite.
5. **Tool**: FIGMA (đổi từ Penpot — Anh chỉnh 2026-10-05).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Starter tier: variable modes giới hạn | Phase 2 verify sớm; fallback multi-collection |
| `use_figma` cần file mở + rate limits trên ~100 component sets | batch nhỏ, checkpoint; Anh giữ file mở |
| Write-to-canvas beta (usage-based pricing sau này) | hiện free trong beta; snapshot map JSON giữ reproducible |
| Lệch với `player-mode-mobile-layout` owner khác | đọc-only ref; không đụng src mockup của nó |
