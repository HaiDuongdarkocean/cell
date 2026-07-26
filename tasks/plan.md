# SSOT Design System UI Redesign Plan

## Overview

Thực hiện cải thiện toàn diện hệ thống giao diện Cell theo nguyên tắc Single Source of Truth (SSOT), áp dụng cho tất cả components trong `src/shared/ui/` và các feature UI. Mục tiêu: màu sắc hài hòa, hình dáng (shape) nhất quán, hành vi (behavior) dễ tiếp cận, dark/light mode tương phản tốt trên mọi breakpoint và cross-browser.

Phát triển theo vòng lặp: **Discover → Plan → Do → Verify (subagent SA-AC/spec review) → Refind → Do → Verify**.

## Giả định

1. Hệ thống hiện đã có token SSOT (`tokens.json` → `tokens.css`) và design system cơ bản; redesign tập trung vào polish, không viết lại từ đầu.
2. Mọi thay đổi màu sắc phải duy trì WCAG 2.1 AA (4.5:1 cho body text, 3:1 cho large text / UI components).
3. Content scripts chạy trong Shadow DOM, cần fallback CSS cross-browser (đặc biệt `rgba(from ...)`).
4. Shape system tuân theo ADR-063/064: radius rõ nghĩa, không hardcode px ngoài hairline.
5. Behavior: touch target, motion, focus states đồng bộ theo `ui-ux-knowledge.md`.

## Component Inventory (Tóm tắt)

### Shared UI (`src/shared/ui/`) — 33 components
Button, Card, Input, Select, Dialog, Checkbox, Radio, Toggle, Badge, Alert, Tabs, Accordion, Tooltip, IconButton, SearchableSelect, BottomSheet, Drawer, Sidebar, ListItem, NavItem, HintIcon, Progress, Skeleton, Slider, Spinner, Textarea, Label, ShortcutInput, SearchField, EmptyState, Header, InputField, CheckboxGroup, RadioGroup, ErrorBoundary.

### Feature UI chính
- `src/features/cardCreator/ui/`
- `src/features/settings/ui/`
- `src/features/theme/ui/`
- `src/features/dictionary/ui/`
- `src/features/universalPanel/`
- `src/features/dictionaryPopup/ui/`
- `src/features/tts/ui/`

## Kiến trúc quyết định

1. **Token-first**: mọi màu, spacing, radius, shadow, motion, touch target phải xuất phát từ `tokens.json`.
2. **Dark/Light SSOT**: duy trì `[data-theme="dark"]` + media `prefers-color-scheme` fallback; bổ sung semantic tokens mới thay vì hardcode alpha.
3. **Shape semantic**: radius tokens dùng tên theo context (`radius-pill`, `radius-card`, `radius-dialog`) thay vì `sm/md/lg/xl` gây nhầm.
4. **Cross-browser CSS**: thay `rgba(from var(--color) r g b / alpha)` bằng token/color helper tính sẵn hoặc fallback.
5. **Behavior đồng bộ**: touch target 44px (mobile/overlay) / 40px (desktop), focus ring 2px offset, motion `prefers-reduced-motion`.

## Phân pha thực hiện

### Phase 1: Foundation — Critical fixes

#### Task 1: Cross-browser fallback cho `rgba(from ...)` trong content scripts
- **Mô tả**: Thay thế / cung cấp fallback cho 39 vị trí `rgba(from ...)` ở `subtitleBlockCss.ts`, `tokenSpanCss.ts`, `wordHighlight.ts`.
- **Acceptance criteria**:
  - [ ] Không còn `rgba(from var(...)` trong output production build.
  - [ ] Màu nền/overlay vẫn đúng trong cả light/dark.
  - [ ] Build pass, test content-script render pass.
- **Verification**: `npm run build`, `npm run test:unit`, manual check DevTools computed color.
- **Files**: `src/features/subtitle/ui/subtitleBlockCss.ts`, `src/features/tokenize/ui/tokenSpanCss.ts`, `src/features/dictionaryPopup/ui/wordHighlight.ts`, `src/shared/lib/theme/themeTokens.ts`.
- **Scope**: M.

#### Task 2: Trích xuất hardcoded px trong TypeScript logic
- **Mô tả**: Thay các giá trị hardcoded (`0px`, `768px`, `100px`, `84px`, `260px`, ...) bằng token constants hoặc `calc(var(--token) * N)`.
- **Acceptance criteria**:
  - [ ] `popupShell.ts`, `subtitleBlockCss.ts`, `tokenBadgeCss.ts`, `navClusterCss.ts` không còn magic px.
  - [ ] Layout popup / subtitle / nav cluster không regressed trên breakpoints chuẩn.
- **Verification**: `npm run typecheck`, `npm run test:unit`, build.
- **Files**: `src/features/dictionaryPopup/ui/popupShell.ts`, `src/features/subtitle/ui/subtitleBlockCss.ts`, `src/features/tokenize/ui/tokenBadgeCss.ts`, `src/features/subtitle/ui/navClusterCss.ts`.
- **Scope**: L.

#### Task 3: Migrate SettingsDialog sang shared Dialog
- **Mô tả**: Thay `SettingsDialog.tsx` custom overlay/popover bằng `Dialog` component từ `src/shared/ui/Dialog.tsx`, giữ lại style/settings-specific behavior.
- **Acceptance criteria**:
  - [ ] Settings dialog vẫn mở/đóng, responsive, giữ tabs và panels.
  - [ ] Không còn duplicate overlay/focus logic.
  - [ ] Dark/light mode hoạt động.
- **Verification**: unit tests, build, manual `npx vite build --mode development` + load extension.
- **Files**: `src/features/settings/ui/SettingsDialog.tsx`, `SettingsDialog.module.css`.
- **Scope**: L.

### Checkpoint 1
- [ ] `npm run typecheck` pass
- [ ] `npm run test:unit` pass
- [ ] `npm run build` pass
- [ ] Subagent review Phase 1 pass

### Phase 2: Token system refinement

#### Task 4: Radius semantic rename
- **Mô tả**: Đổi tên radius tokens: `radius-md` → `radius-pill`, `radius-lg` → `radius-card`, `radius-xl` → `radius-dialog`; cập nhật tất cả consumers và regenerate `tokens.css`.
- **Acceptance criteria**:
  - [ ] `tokens.json` có semantic radius mới.
  - [ ] Tất cả components sử dụng đúng token mới.
  - [ ] Build + generate tokens pass.
- **Verification**: `npm run build`, grep `radius-md/lg/xl` không còn kết quả.
- **Files**: `src/shared/styles/tokens.json`, `src/shared/ui/**/*.module.css`, `src/features/**/*.module.css`.
- **Scope**: M.

#### Task 5: Optional shadow tokens
- **Mô tả**: Bổ sung `shadow-floating`, `shadow-popover`, `shadow-modal` nhỏ gọn (0 1px 2px, v.v.) để dùng cho floating panels, tooltips, dialogs khi cần depth, giữ mặc định flat.
- **Acceptance criteria**:
  - [ ] `tokens.json` có shadow mới.
  - [ ] Dialog / Drawer / BottomSheet / Tooltip có thể dùng shadow token mới (opt-in), mặc định vẫn none.
- **Verification**: build, theme preview tests.
- **Files**: `src/shared/styles/tokens.json`, `src/shared/ui/Dialog.module.css`, `src/shared/ui/Tooltip.module.css`, v.v.
- **Scope**: S.

#### Task 6: Border hairline token
- **Mô tả**: Thêm `--border-width-hairline: 1px` và thay mọi `1px solid` hardcode trong CSS bằng token này.
- **Acceptance criteria**:
  - [ ] `tokens.json` có `borderWidth.hairline`.
  - [ ] Không còn hardcode `1px` cho border/divider trong shared CSS (trừ cases đặc biệt được ADR cho phép).
- **Verification**: grep `1px solid` trong `src/shared/ui` giảm đáng kể.
- **Files**: `src/shared/styles/tokens.json`, `src/shared/ui/**/*.module.css`.
- **Scope**: M.

#### Task 7: Automated contrast validation
- **Mô tả**: Thêm bước validate contrast vào `scripts/generate-tokens.js` hoặc test suite, kiểm tra từng cặp text/bg trong `tokens.json`.
- **Acceptance criteria**:
  - [ ] Script báo lỗi khi tổng hợp màu không đạt WCAG AA.
  - [ ] Bao phủ cả light và dark mode.
- **Verification**: `npm run build` hoặc test contrast mới pass.
- **Files**: `scripts/generate-tokens.js` hoặc `src/features/theme/logic/contrastValidator.ts`.
- **Scope**: M.

### Checkpoint 2
- [ ] All Phase 2 tests pass
- [ ] Build pass
- [ ] Subagent review Phase 2 pass

### Phase 3: Dark/Light harmony

#### Task 8: Frequency pills dark mode visibility
- **Mô tả**: Bổ sung border/outline cho frequency bands trong dark mode để không bị blend vào host page.
- **Acceptance criteria**:
  - [ ] Frequency tokens trong dark mode có border hoặc shadow nhẹ.
  - [ ] Hiển thị rõ trên nền xám đậm.
- **Verification**: `tokenizeBlock` tests, manual dark mode preview.
- **Files**: `src/shared/styles/tokens.json`, `src/features/tokenize/ui/tokenSpanCss.ts`.
- **Scope**: S.

#### Task 9: Theme transition animation
- **Mô tả**: Thêm `transition` mượt khi chuyển dark/light mode trên root element (color, background-color, border-color), tôn trọng `prefers-reduced-motion`.
- **Acceptance criteria**:
  - [ ] Theme switch có transition 150-200ms.
  - [ ] Giảm motion khi user bật reduced motion.
- **Verification**: manual toggle in popup theme panel.
- **Files**: `src/shared/styles/global.css`, `src/features/theme/ui/ThemeProvider.tsx`.
- **Scope**: S.

#### Task 10: Contrast audit & fix for dark mode
- **Mô tả**: Chạy audit tự động trên tất cả components trong dark mode, sửa các cặp màu không đạt 4.5:1.
- **Acceptance criteria**:
  - [ ] Tất cả text/background combinations đạt WCAG AA.
  - [ ] Các components đặc biệt (Alert, Badge, frequency) cũng pass.
- **Verification**: contrast validator tests + subagent review.
- **Files**: `src/shared/styles/tokens.json`, `src/shared/ui/**/*.module.css`.
- **Scope**: M.

### Checkpoint 3
- [ ] Dark mode tests pass
- [ ] Build pass
- [ ] Subagent review Phase 3 pass

### Phase 4: Behavior & accessibility

#### Task 11: Touch target audit
- **Mô tả**: Kiểm tra mọi interactive element đạt touch target 44px trên mobile/overlay, 40px trên desktop.
- **Acceptance criteria**:
  - [ ] Button, IconButton, Checkbox, Radio, Toggle, NavItem, ListItem, Slider đều đạt min touch target.
  - [ ] Không có interactive element < 24px gần nhau mà không có spacing.
- **Verification**: tests + DevTools computed box.
- **Files**: `src/shared/ui/**/*.module.css`, `src/features/**/*.module.css`.
- **Scope**: M.

#### Task 12: Motion standardization
- **Mô tả**: Audit transitions dùng `--duration-*` và easing đúng; thêm `prefers-reduced-motion` nơi còn thiếu.
- **Acceptance criteria**:
  - [ ] Mọi `transition` sử dụng token duration/easing.
  - [ ] `prefers-reduced-motion` được tôn trọng.
- **Verification**: grep `transition:` trong source, tests.
- **Files**: toàn bộ CSS.
- **Scope**: M.

#### Task 13: Focus states standardization
- **Mô tả**: Đảm bảo mọi interactive element có focus ring rõ ràng (`2px solid var(--color-primary)` + 2px offset), không chỉ dùng `outline: none`.
- **Acceptance criteria**:
  - [ ] Không còn `outline: none` đơn độc mà không có focus replacement.
  - [ ] Focus ring hiển thị đồng nhất trên light/dark.
- **Verification**: keyboard navigation test.
- **Files**: `src/shared/ui/**/*.module.css`.
- **Scope**: M.

### Checkpoint 4
- [ ] Accessibility tests pass
- [ ] Build pass
- [ ] Subagent review Phase 4 pass

### Phase 5: Verify & refine (Refind loop)

#### Task 14: Subagent spec/design review
- **Mô tả**: Chạy subagent review toàn bộ design system sau khi thực hiện các pha trên; lập danh sách remaining issues.
- **Acceptance criteria**:
  - [ ] Subagent report không còn high/critical issues.
  - [ ] Các medium issues được ghi nhận hoặc fixed.
- **Verification**: subagent output.
- **Scope**: S.

#### Task 15: Runtime verification (browser)
- **Mô tả**: Load extension trong Chrome/Edge, kiểm tra popup, sidepanel, content script, settings, theme toggle, dictionary popup, subtitle overlay trên light/dark.
- **Acceptance criteria**:
  - [ ] Không có lỗi visual regression rõ rệt.
  - [ ] Dark/light mode chuyển mượt.
  - [ ] Touch targets đạt chuẩn.
- **Verification**: manual DevTools + browser extension load.
- **Scope**: M.

#### Task 16: Update docs & ADRs
- **Mô tả**: Cập nhật `docs/2-architechture-system.md` (tree + token index), `docs/adr/` cho các quyết định radius/shadow/contrast mới, `docs/0-wiki.md` mục lục.
- **Acceptance criteria**:
  - [ ] Docs phản ánh token mới và component inventory.
  - [ ] ADRs ghi WHY của các thay đổi design system.
- **Verification**: `npm run build`, subagent docs review.
- **Files**: `docs/2-architechture-system.md`, `docs/0-wiki.md`, `docs/adr/`.
- **Scope**: M.

### Checkpoint Final
- [ ] All tests pass
- [ ] Production build pass (`npm run build`)
- [ ] Development build pass + 2 seed files copied
- [ ] Subagent final review: no production blockers
- [ ] Docs & ADRs updated

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Đổi tên radius token gây regression rộng | High | Dùng `replace_all` cẩn thận, kiểm tra grep trước/sau, build + tests sau mỗi bước. |
| `rgba(from ...)` fallback khó áp dụng đúng | Medium | Tạo helper `colorWithAlpha` trong `src/shared/lib/theme/colorUtils.ts`, dùng trong content scripts. |
| SettingsDialog migration phức tạp | High | Chạy song song cả 2 implementations rồi switch sau khi tests pass. |
| Contrast validation false positive | Low | Cho phép ghi chú/whitelist cho các token decorative. |
| Build size tăng do tokens | Low | Dùng CSS variables, không inline nhiều giá trị. |

## Open Questions (none — proceeding with assumptions)

- Không có câu hỏi cần user xác nhận; em sẽ dựa trên audit và conventions hiện có.
