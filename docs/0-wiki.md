# 0-Wiki — Project Overview

> **Đọc file này đầu tiên** sau mỗi context reset để biết dự án có gì.

## Cây thư mục tổng quan

```
docs/           # Tài liệu dự án
├── 0-wiki.md                          # File này — mục lục tổng quan
├── 1-share-language.md                # Glossary human ↔ system language
├── 2-architechture-system.md          # Architecture chi tiết (src/ + tests/ + dependency + function index + data flows; Player Mode transparent/click-through overlay; host-CSS defenses; top-frame guard cho Cloudflare challenge iframe)
├── player-support.md                  # Live subtitle-list audit — player-side evidence for 9 sites; separates direct/metadata/encrypted entries, auth replay, and extension-delivery gaps; includes generic architecture constraints
├── adr/                                 # Architecture Decision Records (per AGENTS.md: quyết định kiến trúc → docs/adr/<tên>.md)
│   ├── native-fullscreen-iframe-player-mode.md  # Child-iframe Player Mode dùng native Fullscreen API và project player vào videoStage thay vì top-frame bridge
│   ├── subtitle-appearance-in-manager.md        # Di chuyển subtitle appearance customization từ Settings sang Subtitle Manager Panel
│   ├── 079-subtitle-search.md                   # WHY: client-only keys, SubDL-first, background-owns-network, quota ledger in session storage, rotate at download, no validate-on-add, discriminated union download, provider registry
│   ├── 080-subtitle-panels-atom-decomposition.md # WHY: tách god component SubtitlePanels.tsx thành 3 molecule (ClusterRightToolbar/ManagerLayer/OffsetLayer) + types SSOT + shared CSS; HostManagerSheet thin adapter; PlayerModeOverlay share toolbar
│   ├── 084-foundation-color-system.md           # WHY: neutral-first + single indigo accent, OKLCH design, warm off-white / dark faint-blue-tint
│   ├── 085-foundation-typography.md             # WHY: Inter variable, 5 roles, progressive negative tracking, weight 510
│   ├── 086-foundation-spacing.md                # WHY: 4px base, 18-step scale for dense extension UI
│   ├── 087-foundation-shape-elevation.md        # WHY: concentric radius, surface-lift over heavy shadow
│   ├── 088-foundation-motion.md                 # WHY: 120-300ms, purpose-driven easing, reduced-motion
│   ├── 089-foundation-iconography.md            # WHY: 24×24 1.5px round stroke, currentColor, semantic naming
│   ├── 090-foundation-grid-breakpoints.md       # WHY: mobile-first 320→1280, 4/12 column
│   └── 091-atomic-design-taxonomy.md            # WHY: atoms are functional UI components; color/typography/spacing/shape/motion/iconography/grid are design tokens (subatomic)
├── specs/
│   ├── liquid-glass-buttons.md         # Spec: themed liquid-glass Button/IconButton + subtitle action normalization; V4 approval gate before production
│   ├── subtitle-list-discovery-e2e.md  # E4 acceptance criteria for generic subtitle-list discovery
│   ├── subtitle-search.md              # Subtitle search (SubDL + OpenSubtitles) + multi-key management — đã qua adversarial review
│   ├── manager-host-sheet-bridge.md    # Spec: Subtitle Manager Mobile Sheet trên Host Page (Bridge Protocol)
│   ├── orca-ocr-layer.md               # Spec: OCR layer (PaddleOCR.js PP-OCRv5) — hard-sub video + image OCR, per-origin persistence, mixed CN+EN+JA, Manager Panel toggle + context menu
│   ├── subtitle-panels-atom-decomposition.md # Spec: tách SubtitlePanels god component thành atom/molecule (SSOT toolbar/manager/offset/types/CSS)
│   ├── fnc_tts.md                      # Spec: local offline TTS với Supertonic v3 cho popup từ điển + nền reader
│   ├── reader-requirements.md          # Reader feature requirements (subagent output)
│   ├── reader.md                       # Reader technical spec (SSOT)
│   └── clipboard-page.md               # Clipboard standalone page spec — orbital entry, CRUD, pagination, token SSOT
├── subtitle-manager-css-arc-prompt.md  # Prompt CSS-only tạo arc + fade cho Subtitle Manager mockup
├── design-system/                     # Design system reference docs & assets
│   ├── DESIGN.md                      # Agent-facing SSOT for UI implementation (token map, component map, audit commands)
│   ├── ROADMAP.md                     # Audit maturity 62/100 + operating model + UI test-tool target + cleanup/reorganization roadmap
│   ├── COMPONENT_INVENTORY.json       # Auto-generated public component inventory (metadata, gaps, consumers)
│   ├── COMPONENT_INVENTORY.md         # Human-readable inventory table and gap list
│   └── guides/                          # Foundation interactive guides
│       ├── foundations-tutorial.html    # Color/typography/spacing/layout/shape/motion/icon/a11y tutorial
│       └── foundations-advanced.html    # Advanced foundation patterns and edge cases
├── mockup/                            # UI mockup (HTML + README) — prototype trước khi implement
│   ├── subtitle-manager-redesign.html # Subtitle Manager Quiet List concept, interactive dark/light + responsive widths
│   ├── cue-item-redesign.html         # 3 biến thể cue item mới (timestamp trái, text phải, format human-friendly)
│   ├── README.md                      # Rationale + so sánh các mockup + token dùng
│   ├── reader.html                    # Reader UI mockup
│   ├── reader-README.md               # Reader mockup notes
│   └── screenshots/                   # Design/iteration screenshots (e.g. clipboard-v4, OCR test)
├── ideas/                             # Refined idea one-pagers (idea-refine output)
│   └── orca-ocr-layer.md              # OCR layer cho Cell (hard-sub video + image + screenshot) — PaddleOCR.js PP-OCRv5 primary, evidence-grounded
├── context/                           # Project context (persistent — skill elicitation load đầu tiên)
│   └── project-context.md             # Persona + platform + constraints + glossary + design system + existing specs
├── loop-result.md                     # Loop process log for agentic redesign tasks
├── intent/                            # Confirmed user intent (interview-me / elicitation output)
│   ├── liquid-glass-buttons.md        # Confirmed intent: themed shared Button/IconButton + subtitle overlay actions only
│   └── reader.md                      # Reader feature intent
├── knowledge-base/                    # Nguyên lý khái niệm hóa + chi tiết kỹ thuật
│   ├── learning-algorithms-summary.md # Learning algorithms summary
│   ├── design-system-learning-map.md  # Design system learning map (foundations → tokens → components → a11y → Apple lens)
│   ├── design-system-from-scratch-loop.md # Pipeline xây dựng Design System từ đầu với vòng lặp cải tiến liên tục
│   ├── sdlc-flow.md                   # SDLC — sơ đồ dòng chảy Idea → Khung quy trình → Sản phẩm (output mỗi pha + ai làm)
│   ├── agentic-sdlc.md                # Agentic SDLC — tài liệu chuẩn (định nghĩa + nguồn gốc + 5 nguyên lý + pipeline 4 ông lớn + guardrail + metric + so sánh truyền thống + takeaway Cell + 10 nguồn)
│   └── atomic-design.md               # Tổng hợp atomic design: 5 cấp độ, atom vs token, bảng tra cứu Cell, nguồn
├── memory/                            # Agent memory — long-term context
│   └── algorithm-tokenize.md          # Tokenize algorithm notes
├── research/                          # Subagent research reports
│   └── reader-technical.md            # Reader technical research
├── reviews/                           # Adversarial review outputs
│   ├── reader-adversarial-1.md        # Architecture/MV3/performance review
│   └── reader-adversarial-2.md        # UX/security/accessibility/scope review
└── shortcut-for-tw/                   # Cheatsheet phím tắt Devin Terminal workflow
    └── cheatsheet.md                  # Win+Shift+Q launcher + WT pane nav/swap/swap/resize + workflow giao việc

src/            # Source code (chi tiết trong 2-architechture-system.md)
tests/          # Test files (chi tiết trong 2-architechture-system.md)
e2e/            # Playwright E2E specs (chi tiết trong 2-architechture-system.md)
.agents/        # Agent skills
  skills/         # 25 skill addyosmani/agent-skills (Define→Plan→Build→Verify→Review→Ship) — interview-me đã gộp elicitation mode
                 # browser-testing-with-devtools/SKILL.md: có "Reliable install workflow on Devin CLI"
                 #   (copy dist/ → %TEMP%\cell-ext-dist trước khi install_extension,
                 #    vì Devin MCP client negotiate roots nhưng không gửi workspace D:\...\cell)
                 # testing-extension-browser/: SSOT profile + CDP Extensions.loadUnpacked + script/test-cell-browser.py
                 #   (Chrome 137+ blocks --load-extension; dùng nodriver + CDP loadUnpacked mỗi session; anti-bot bypass)
.devin/        # Devin config (hooks.v1.json; agents/ đã xóa — thay bằng .agents/skills/)
.windsurf/      # Windsurf config (rules consolidated vào AGENTS.md — cross-tool source of truth)
tasks/          # Active plan & task checklist (current sprint)
├── plan.md                          # Existing Orca OCR implementation plan
├── todo.md                          # Existing Orca OCR ordered checklist
├── plan-liquid-glass-buttons.md     # Liquid-glass Button/IconButton + subtitle migration implementation plan
├── todo-liquid-glass-buttons.md     # Liquid-glass ordered tasks with acceptance criteria
├── plan-design-system-v2.md         # Canonical P0-P5 implementation plan từ audit 62/100 → target ≥85/100
└── todo-design-system-v2.md         # Ordered Design System v2 execution checklist
```

||**2026-08-29 (Elicitation-to-Spec auto-pipeline)**: Mở rộng `.agents/skills/elicitation/SKILL.md` thành pipeline tự động 9 steps: sau khi user OK 8-field frame, agent tự invoke `spec-driven-development` (Autonomous Mode) để viết `docs/specs/[topic].md`, rồi `spec-review-stakeholder` để review BA/PO/TL, rồi tự sửa spec theo Blocker/Major findings. Lặp tối đa 3 vòng, cuối cùng đưa user bản spec cuối để approve. Cập nhật `.agents/skills/spec-driven-development/SKILL.md` (thêm Autonomous Mode) và `.agents/skills/spec-review-stakeholder/SKILL.md` (ghi rõ report được `elicitation` consume để edit). Thêm `/design-from-idea` vào `.agents/skills/interview-me/SKILL.md` Phase 2 prototype (Step 7) để tạo design brief trước khi viết prototype. Cập nhật `docs/0-wiki.md`. Verify: đọc lại 4 skill files, cấu trúc đồng nhất.|

## Lịch sử cập nhật wiki

|||**2026-08-29 (T4.1 Generate public component inventory)**: Thêm `scripts/generate-component-inventory.mjs` dùng `jiti` import `autoDiscovery.logic.ts` để tái dụng taxonomy; parse `src/shared/ui/index.ts` lấy public exports (cả type exports); xuất `docs/design-system/COMPONENT_INVENTORY.json` và `COMPONENT_INVENTORY.md` với metadata level/category/status, hasShowcase/hasTest/hasModuleCss, usageCount + top 10 consumers. Phát hiện gaps: missingShowcase (BottomSheet, Sheet), missingTest (LabelGroup, SettingsRow, SliderRow, SearchableSelect, HintIcon, Breadcrumb, FooterBar, Tree), zero-consumer (40 components chưa dùng production), orphan showcases (ColorScale, M3Tokens, Spacing, TypographyScale). Thêm `package.json` script `generate:component-inventory`; thêm `tests/unit/scripts/generate-component-inventory.test.ts` kiểm output shape, known gaps, ErrorBoundary, orphan showcases, stable components. Cập nhật `docs/design-system/ROADMAP.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`, `docs/0-wiki.md`. Verify: `npx tsc --noEmit` pass, `npm run test:unit:design-system` pass (76/438), `npm run build` pass, `npm run generate:component-inventory` pass, `npx eslint scripts/generate-component-inventory.mjs tests/unit/scripts/generate-component-inventory.test.ts` pass.||

||||**2026-08-29 (T4.2 Slice 1 — Close evidence gaps for SettingsRow/LabelGroup/FooterBar)**: Thêm behavior test cho 3 public export có production consumer: `src/shared/ui/SettingsRow.test.tsx` (render children, extra attributes, layout modifiers, ref forward), `src/shared/ui/LabelGroup.test.tsx` (icon/label, sublabel, hint with accessible `More info` img, trailing), `src/shared/ui/FooterBar.test.tsx` (slots/icons/labels, onClick, disabled, active). Dùng `data-cell-id` theo convention testing-library config. Chạy `npm run generate:component-inventory` lại để cập nhật `COMPONENT_INVENTORY.json`/`COMPONENT_INVENTORY.md`: SettingsRow/LabelGroup/FooterBar chuyển từ missingTest sang stable, còn 6 missing test (SliderRow, SearchableSelect, HintIcon, Breadcrumb, Tree, ...). Cập nhật `tasks/todo-design-system-v2.md`, `tasks/plan-design-system-v2.md`. Verify: `npx tsc --noEmit` pass, `npm run test:unit:design-system` pass (79/450), `npm run build` pass.||

||||**2026-08-29 (T3.1/T3.2/T3.3 Visual & responsive confidence)**: Định nghĩa `e2e/visual-matrix.ts` với 22 state cases cho Button/Input/Card/Dialog/Tabs/Select (light/dark, default/hover/focus/active/disabled/loading/error/open). Thêm `e2e/showcase-visual.spec.ts` dùng `toHaveScreenshot` với `reducedMotion: 'reduce'`, viewport 1280×720, `maxDiffPixelRatio: 0.02`; cấu hình `snapshotPathTemplate` trong `playwright.config.ts`. Thêm `e2e/showcase-responsive.spec.ts` kiểm 7 P0 components ở 5 viewport (320/600/840/1200/1600) không horizontal overflow; kiểm touch target Primary/Large >= 40px; kiểm 200% text zoom (`document.documentElement.style.fontSize = '200%'`) không overflow. Cập nhật `docs/design-system/ROADMAP.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `npx tsc --noEmit` pass, `npm run test:unit:design-system` pass (75/433), `npm run build` pass, `npm run build:design-system` pass, `npx playwright test --project=showcase e2e/showcase-visual.spec.ts` pass 22/22, `npx playwright test --project=showcase e2e/showcase-responsive.spec.ts` pass 37/37, `npm run test:e2e` pass 77/77.||

||||**2026-08-29 (T2.3 Keyboard/focus & ARIA contracts)**: Thêm `e2e/showcase-keyboard.spec.ts` với 6 tests chạy bằng keyboard event: Dialog focus trap/Tab cycle/Escape/restore focus, Button Enter/Space kích hoạt, Tabs roving tabindex + Arrow/Home/End + tabpanel focus, Select Enter mở/ArrowDown/Skip disabled/Enter chọn, Drawer focus trap/Escape, Input focus + type. Sửa `src/shared/ui/Tabs.tsx`: `TabsList` xử lý ArrowLeft/Right/Home/End, `TabsTrigger` dùng `tabIndex` roving (`0` active, `-1` others), `TabsContent` `tabIndex={0}`. Sửa `src/shared/ui/Select.tsx`: thêm `listboxRef`, focus listbox khi mở, `tabIndex={-1}`, `handleListboxKeyDown` gồm `handleMenuKeyDown` + đóng menu khi Tab. Cập nhật `docs/design-system/ROADMAP.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `npx tsc --noEmit` pass, `npm run test:unit:design-system` pass (75/433), `npm run build:design-system` pass, `npx playwright test --project=showcase e2e/showcase-keyboard.spec.ts` pass 6/6, `npm run test:e2e` pass 18/18.||

||||**2026-08-29 (T2.2 Rendered axe checks)**: Cài `@axe-core/playwright@4.12.1` như dev dependency. Thêm `e2e/showcase-axe.spec.ts` scan 6 stable components (Button, Card, Dialog, Input, Select, Tabs) với WCAG 2.1 AA tags. Sửa `e2e/showcase.fixture.ts` điều hướng đúng `design-system-showcase.html`. Sửa `src/shared/ui/Tree.tsx` dùng `role="treeitem"`, `role="group"`, `tabIndex`, `aria-expanded`/`aria-selected`, keyboard Enter/Space. Sửa `src/shared/ui/Input.tsx` bỏ `aria-hidden` trên `suffix` wrapper để button tương tác (password toggle) không bị ẩn khỏi AT. Sửa `src/shared/ui/Input.showcase.tsx`: `Field` dùng `<label htmlFor={id}>` + `cloneElement` truyền `id` vào `Input`; thêm `aria-label` cho các `Input` trong `StateCard`. Stable components đạt 0 axe violation; gallery còn nhiều swatch/component previews violation nên chưa đưa vào scope. Cập nhật `docs/design-system/ROADMAP.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `npm run test:unit:design-system` pass (75/433), `npm run build` pass, `npm run build:design-system` pass, `npx playwright test --project=showcase e2e/showcase-axe.spec.ts` pass 6/6, `npm run test:e2e` pass 12/12.||

||||**2026-08-29 (T2.1 Contrast engine)**: Thêm `src/shared/lib/contrast.ts` — canonical WCAG 2.1 color contrast engine: parse hex/rgb/rgba/color-mix, resolve `var(--color-*)` chains, alpha compositing over a backdrop, `getLuminance`, `getContrastRatio`, `pickPrimaryForeground`. Thêm `src/shared/lib/contrast.test.ts` với W3C boundary, alpha compositing, light/dark/preset, and token-resolution fixtures. Refactor `src/features/theme/logic/colorGenerator.ts` và `src/features/theme/logic/contrastValidator.ts` thành runtime facade re-export từ `contrast.ts`; `src/shared/lib/tokens.ts` import `hexToRgb` / `pickPrimaryForeground` từ `contrast.ts`. Cập nhật `scripts/generate-tokens.js` dùng `jiti` để import `contrast.ts` tại build time; build-time validation không còn silently skip pair — unsupported format hoặc contrast fail đều throw với token/pair name; hỗ trợ `rgba()` backgrounds qua `core.background` backdrop. Sửa cặp `Card Foreground` / `Popover Foreground` dùng đúng `color-surface-card` / `color-surface-popover`; đánh dấu `Primary Soft Foreground / Primary` là large-text (3:1). Cập nhật `docs/design-system/ROADMAP.md`, `docs/2-architechture-system.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `npx jest --selectProjects unit --testPathPatterns src/shared/lib/contrast.test.ts` pass (32/32), `npm run test:unit:design-system` pass (75 suites/433 tests), `npm run typecheck` pass, `npm run build` pass, `npm run build:design-system` pass, `node scripts/generate-tokens.js` pass.|

||**2026-08-29 (T1.5 CI quality pipeline)**: Thêm `.github/workflows/design-system-ci.yml` với 2 job (`quality` và `e2e`); `quality` chạy `npm run typecheck`, `npm run test:unit:design-system`, `npm run check-icons`, `npm run build`, `npm run build:design-system`; `npm run check-design-system-css` chạy non-blocking (`continue-on-error: true`) vì hiện còn 166 undefined-token violations trong `src/shared/ui/*.module.css` gây false positive/token drift, cần làm sạch trước khi chuyển thành blocking gate. `e2e` chạy `npx playwright install --with-deps chromium`, `npm run build`, `xvfb-run -a npx playwright test` (extension cần headed context nên dùng virtual X display trên Linux), upload `playwright-report/` và `test-results/` khi `failure`. Thêm script `test:unit:design-system` trong `package.json` để narrow Jest chỉ chạy `tests/unit/scripts`, `tests/unit/entrypoints/design-system-showcase` và `src/shared/ui` (do `npm run test:unit` toàn bộ còn failures ở OCR/dictionary không liên quan, ghi nợ sửa). Cập nhật `docs/design-system/ROADMAP.md`, `docs/2-architechture-system.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `npm run test:unit:design-system` pass (75 suites/433 tests), `npm run typecheck` pass, `npm run build` pass, `npm run build:design-system` pass; deliberate failing Playwright test tạo `playwright-report/` + `test-results/` artifacts.|

||**2026-08-29 (T1.4 Chromium extension E2E fixture)**: Thêm `e2e/extension.fixture.ts` (fixture `context`, `worker`, `extensionId`, `popupPage`, `mockPage`: persistent Chromium context, load built `dist/` extension, derive ID từ service worker, close context trong `test.afterAll`) và `e2e/extension.spec.ts` (3 tests: service worker running, popup page loads, content script trên mock YouTube video page). Cập nhật `playwright.config.ts`: `webServer` mảng với build/serve showcase và `node scripts/serve-mock-pages.mjs --youtube --no-build`; hai project (`chromium`/`showcase`). Cập nhật `eslint.config.ts` để tắt `react-hooks/rules-of-hooks` và `no-empty-pattern` cho Playwright fixtures. Cập nhật `docs/design-system/ROADMAP.md`, `docs/2-architechture-system.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `npx eslint e2e/extension*.ts e2e/showcase*.ts playwright.config.ts eslint.config.ts` pass, `npx tsc --noEmit -p tsconfig.e2e.json` pass, `npm run typecheck` pass, `npm run test:e2e` pass 2 lần liên tiếp (6 tests: 3 extension + 3 showcase).|

|**2026-08-29 (T1.3 Playwright showcase suite)**: Thêm `e2e/showcase.fixture.ts` (fixture `showcasePage`, đợi `document.readyState === 'complete'`, heading render, `document.fonts.ready`) và `e2e/showcase.spec.ts` (3 tests: load gallery + light theme, toggle light/dark, navigate `?showcase=Button`). Cập nhật `playwright.config.ts`: `webServer` auto build/serve với `http-server` + fallback proxy, hai project (`chromium`/`showcase`), `outputDir: 'test-results/'`, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`. Cập nhật `docs/design-system/ROADMAP.md`, `docs/2-architechture-system.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `npx eslint e2e/showcase*.ts playwright.config.ts` pass, `npx tsc --noEmit -p tsconfig.e2e.json` pass, `npm run typecheck` pass, `npm run test:e2e` pass 2 lần liên tiếp (3 tests/showcase).|

|**2026-08-29 (T1.1 + T1.2 Design-system quality gates)**: Thêm `scripts/check-design-system-css.mjs` (PostCSS parser audit: hardcoded color/spacing/radius/z-index, undefined token trong `src/shared/ui/*.module.css`) + `tests/unit/scripts/check-design-system-css.test.ts`. Mở rộng `scripts/check-icons.js` sang catalog↔file integrity, dead entry, empty tags, duplicate SVG detection; bổ sung 2 icon `panel-left-collapse` / `panel-left-expand` vào `ICON_CATALOG`. Thêm `tests/unit/scripts/check-icons.test.ts` + fixtures. Cập nhật `package.json`, `docs/design-system/ROADMAP.md`, `docs/2-architechture-system.md`, `tasks/plan-design-system-v2.md`, `tasks/todo-design-system-v2.md`. Verify: `node scripts/check-icons.js` pass 90/90, targeted Jest pass, `npm run typecheck` pass, `npm run build` pass.

**2026-08-29 (T0.2 Showcase build path)**: Bỏ `designSystemShowcase` plugin khỏi `vite.config.ts` và xóa `designSystemShowcase` khỏi `rollupOptions.input`; main build không còn ghi vào `docs/design-system/`. Đổi `vite.showcase.config.ts` build output sang `dist/design-system-showcase/`; `showcaseOutputMover` vẫn flatten `index.html` thành `design-system-showcase.html`. Cập nhật `package.json`: `design-system` serve từ `dist/design-system-showcase`. Cập nhật `docs/2-architechture-system.md`. Verify: `npm run build` pass, `git status --short -- docs/design-system` rỗng, `npm run build:design-system` + `npm run design-system` 200 OK, asset/font không 404.

**2026-08-29 (T0.5 Auto taxonomy)**: Tách `autoDiscovery.ts` thành `autoDiscovery.logic.ts` (pure taxonomy inference: path → level, basename → category, `showcaseMeta` override, `CANONICAL_META` chỉ còn <10 trường hợp đặc biệt) + `autoDiscovery.ts` (Vite glob + discovery). Mở rộng glob cho features/molecules, features/organisms, templates, shared/styles. Thêm `tests/unit/entrypoints/design-system-showcase/autoDiscovery.test.ts` (33 cases). Cập nhật `docs/2-architechture-system.md`. Typecheck, build (`npm run build` + `build:design-system`), showcase server 200 OK, navigation render đúng foundations/atoms/molecules/organisms/pages.

**2026-08-27 (Design System audit + plan)**: Thêm `docs/design-system/ROADMAP.md` — audit vận hành 62/100 với denominator minh bạch, SSOT map, toolchain Playwright/axe/parser-based CSS audit, lộ trình P0–P5, target folder structure, deletion safety gate và session worklog. Thêm canonical execution files `tasks/plan-design-system-v2.md` + `tasks/todo-design-system-v2.md`; đã qua hai fresh-context adversarial reviews.

**2026-08-28 (v4 AC)**: Căn chỉnh `Button` press/focus/ripple theo `liquid-glass-dewdrop-v4.html` — tokens `color-button-liquid-ripple/mid/primary`, `ripple-start-opacity=0.6`, press scale 0.985 trong 80ms, release 180ms ease-out; `@keyframes ripple` scale 0 → 2.8 / opacity 0.6 → 0 trong 700ms ease-out; focus-visible outline 2px `currentColor 60%` + offset 3px. Sửa `var(--transition)` chưa định nghĩa bằng token `transition` mới và duration rõ ràng trong `Button.module.css`. Cập nhật `docs/specs/liquid-glass-buttons.md`, `docs/2-architechture-system.md`, `docs/loop-result.md`. Build + typecheck + Button tests pass; verify ripple trên showcase dark mode qua stealth CDP.

**2026-08-28**: Cập nhật `Button` atom theo v4 mockup — thêm Liquid Glass tokens trong `tokens.json`, refactor `src/shared/ui/Button.module.css` (caustic surface/rim, reflex shadows, unified `outline`/`ghost` glass fill, 4 sizes/8 states), thêm gợn sóng từ điểm chạm + độ đàn hồi mặt nước khi nhấn (pointer-down ripple, spring release), cập nhật `Button.showcase.tsx`, đồng bộ `docs/2-architechture-system.md`, tạo `docs/loop-result.md`. Build + Button tests pass; verify bằng stealth CDP design-system showcase. Log: `docs/loop-result.md`.

**2026-08-28**: Redesign `src/entrypoints/design-system-showcase/` — SSOT taxonomy trong `autoDiscovery.ts`, cải tiến `ShowcaseGallery.tsx` IA/visual, tự phát hiện component thiếu showcase, tạo `.showcase.tsx` bổ sung, thêm `build:design-system`. Log: `docs/loop-result.md`.

**2026-08-27**: Xác nhận intent và thêm spec/plan cho Liquid-Glass Button System: V4 visual approval gate → themed shared `Button`/`IconButton` → migrate subtitle action buttons/Tabs → tách overlay geometry ownership khỏi shared material. Files: `docs/intent/liquid-glass-buttons.md`, `docs/specs/liquid-glass-buttons.md`, `tasks/plan-liquid-glass-buttons.md`, `tasks/todo-liquid-glass-buttons.md`.

**2026-08-26**: Thêm `docs/knowledge-base/design-system-from-scratch-loop.md` — tổng hợp pipeline xây dựng Design System từ đầu với vòng lặp cải tiến liên tục, cập nhật 0-wiki.md.

**2026-08-23**: Redesign 100% design system foundation "quiet confidence" — 7 ADRs (`084-090`) cho color/typography/spacing/shape/motion/iconography/grid, `tokens.json` v2.0.0 rewritten with neutral-first palette + indigo accent, `tokens.css` regenerated, `npm run build` pass. ADRs include rejected alternatives, dẫn chứng from Linear/Apple/Material/Carbon/Atlassian.

**2026-08-21**: Spec `docs/specs/orca-ocr-layer.md` revised sau 3-layer adversarial review (review → phản biện 1 → phản biện 2). 6 blocker + 5 major resolved: (1) ImageBitmap→ImageData via Port, (2) DRM black-frame detect, (3) bundle .wasm (MV3 cấm remotely-hosted code), (4) AC cold start <10s background, (5) script-run segmenter cho mixed intra-box, (6) spec tự mâu thuẫn native sub. Plan `tasks/plan.md` + `tasks/todo.md` updated: 27 tasks, 7 phases (T0 spike → T1-T3 foundation → T4-T7 engine → T8-T12 video pipeline → T13-T16 overlay+dict → T17-T20 Manager Panel → T21-T25 polish). Review log: `docs/specs/orca-ocr-review-final.md`. **Spike T0b PASS 5/5** (subagent browser test): frame capture mock+real (themoviebox.xyz mean luma 116.9, NOT DRM), WebGPU works, ImageData Port transfer OK, OCR POC mixed CN+EN+JA score 0.93-1.00. Test data: 4 JSON fixtures + 10 synthetic PNG frames trong `tests/data-test/ocr/`. **Phase 1+2 implemented**: T1 OcrEngine types+interface, T2 scriptRunSegmenter (SSOT upgrade detectLangCode, 15 fixture cases), T3 ocrStateStore (per-origin persistence), T4 PaddleOcrEngine (mock-tested 9 cases), T5 ocrRunner (offscreen document), T6 background OCR handler, T7 OcrController (content-script client), T7b mock-hardsub-page (port 4325, canvas burned-in subs). **Phase 3-6 implemented**: T8 frameCapture (rVFC+canvas+ImageData), T9 drmGuard (black-frame mean luma), T10 lumaDiff (region luma + pHash dedup), T11 cropRegion (bottom % subtitle crop), T12 ocrPipeline (orchestrator: DRM→luma→pHash→crop→OCR→segment), T13-T16 ocrOverlay (hitbox DOM positioning + lifecycle), T17-T20 OcrSettingsPanel (toggle + language mode + region % slider), T21-T25 ocrContentScript (OcrSession wires controller+pipeline+overlay). **128 tests pass, typecheck 0 OCR errors, build pass.** **Browser test PASS** (mock-hardsub-page port 4325): frame capture 1280x720 OK, DRM guard meanLuma 78→NOT DRM, subtitle region contrast 157-168 (text visible), pHash dedup 3 different hashes cho 3 subtitle changes (Hello World/我喜欢北京/我喜欢 watching movies). Luma diff 0.78-2.68 (below threshold 3 → pHash needed for subtitle change detection). **PaddleOCR.js browser test PASS** (prototype POC port 4326): WebGPU init 3274ms, cold OCR 5001ms (我喜欢北京 score=1.000), warm OCR 653ms (3.7x faster), mixed CN+EN+JA 3 regions: "我喜欢 watching movies" score=0.995, "日本語も勉強しています" score=1.000, "Hello 世界" score=0.935.

**2026-08-21**: Thêm `docs/ideas/orca-ocr-layer.md` — refined idea one-pager + prototype benchmark cho OCR layer (codename "Orca"): PaddleOCR.js PP-OCRv5 mobile primary (1 model CN+EN+JA, 21.5MB), OcrEngine abstraction + Tesseract fallback + ChromeLens stub, video pipeline subtitle crop + pHash skip + cache, auto-detect vs single-language mode. **Prototype VALIDATED**: mixed-language CN+EN+JA cùng frame (score 0.93-1.00), WebGPU warm 134ms vs WASM 583ms (3.7-4.3x faster sau warmup, nhưng 5s shader JIT first run), poly `[[x1,y1]...]` 4-point. POC tại `prototype/orca-ocr-poc/` (gitignored). Evidence từ 3 subagent research + real benchmark. Còn: MV3 CSP test, real video frame accuracy, pHash subtitle detection.

**2026-08-20**: Thêm spec `subtitle-panels-atom-decomposition.md` + ADR `080-subtitle-panels-atom-decomposition.md` — WHY tách god component `SubtitlePanels.tsx` (1651 dòng) thành 3 molecule (`ClusterRightToolbar`, `ManagerLayer`, `OffsetLayer`) + types SSOT (`subtitlePanelsTypes.ts`) + shared CSS (`subtitlePanelsShared.module.css`). `HostManagerSheet` thành thin adapter, `PlayerModeOverlay` share toolbar. Spec: `docs/specs/subtitle-panels-atom-decomposition.md`.

**2026-08-20**: Fix stale subtitle tracks trên SPA nav YouTube — `onSpaNav` (proactive clear trên `yt-navigate-finish`/`popstate`) và AUTO_LOAD null handler (background-driven clear khi MAIN-world detect trả 0 tracks) chỉ clear engine cues + offset, KHÔNG clear manager panel items (`autoTargetItems`/`autoNativeItems`/`targetMatches`/`nativeMatches`/`activeTargetIndex`/`activeNativeIndex`) và `useCuesStore` load status. Kết quả: SubtitleManagerPanel vẫn hiển thị track cũ (vd "EN #1 VTT") sau khi chuyển từ video có subtitle sang video không có subtitle. Fix: thêm clear panel items + `refreshPanel('target'|'native')` + `useCuesStore.setLoadStatus('none'/'idle')` vào cả 2 path. File: `src/features/subtitle/ui/contentScriptController.ts`.

**2026-08-19**: Thêm `docs/subtitle-manager-css-arc-prompt.md` — prompt triển khai arc + fade bằng CSS thuần, không SVG, gồm hướng kỹ thuật pseudo-element/mask gradient, responsive requirements, interaction constraints và AC/verification checklist.

**2026-08-19**: Subtitle Manager desktop right-aligned sidebar panel — breakpoint 768px (`BREAKPOINTS.tablet`): ≥768px → panel `width: min(100% container, 360px)` (sidebar width, cap 360px), `height: 100%` (fill full container height, không gap), `border-radius: 0` (square corners, flush sidebar style), cross-axis (horizontal) = right via `.panelLayer justify-content:flex-end`, main-axis (vertical) = stretch via `height:100%`, **background: `linear-gradient(to right, transparent 0%, var(--color-glass-sidebar-panel) 50%)`** — wide fade zone 50% (độ lan tỏa rộng) tạo chuyển giao mượt với video, không cắt đột ngột, backdrop `var(--color-glass-sidebar-backdrop)` xung quanh, click backdrop = close. Token SSOT: `--color-glass-sidebar-panel: rgba(0,0,0,0.85)` (near-black) + `--color-glass-sidebar-backdrop: rgba(0,0,0,0.5)` (heavy dim) trong `tokens.json` (light + dark). <768px → Sheet component fill toàn màn hình. Áp dụng cả normal + fullscreen mode.

**2026-08-19**: `docs/mockup-g4.html` chuyển arc từ SVG sang CSS-only: panel surface dùng một màu đồng nhất cho header/body/footer; `.panel::after` dùng solid surface + radial mask để tạo biên cong, `.panel::before` tạo outer halo blur fade ra video. Panel co theo container bằng `width:min(100%,360px)` để không tràn ở viewport hẹp.

**2026-08-19**: Subtitle Manager đồng bộ positioning với overlay subtitle — `#cell-manager-portal` chuyển từ body-level portal (`position:fixed;inset:0;z-index:2147483647` + videoRect/ResizeObserver tracking + custom fullscreen polling) sang gắn trong video container (cùng parent `#cell-subtitle-root`), `position:absolute;inset:0;z-index:2147483647`, dùng chung `attachFullscreenReparenting` từ `mountReactShadow.ts`. `.panelLayer` CSS bỏ `--video-x/y/w/h` + `--origin-x/y`, mobile giữ `position:fixed` bottom sheet. Bỏ `videoRect`/`managerOrigin` state + ResizeObserver effect. Export `attachFullscreenReparenting` từ `mountReactShadow.ts` để reuse.

**2026-08-13**: Subtitle Manager search UI sửa Shadow DOM CSS injection: thêm search/preview và shared atom CSS vào `mountSubtitle`, khắc phục layout raw browser trên host page.
**2026-08-13**: Thêm ADR `079-subtitle-search.md` — WHY decisions cho subtitle search (client-only keys, SubDL-first, background-owns-network, quota ledger in session storage, rotate at download, no validate-on-add, discriminated union download, provider registry). Spec: `docs/specs/subtitle-search.md`.
**2026-08-22**: Review + bổ sung spec `ocr-split-dual-stream.md` (messaging layer dual-engine, model distribution ADR-082, type derive từ catalog, low-RAM gate, cue flicker merge, track names cố định, 12 models verify docs) + ADR `082-ocr-multilingual-model-distribution-and-dual-engine.md` (default model bundled + 11 multilingual CDN→IndexedDB, engine map keyed by model, LRU + deviceMemory gate).

**2026-08-22**: Thêm ADR `081-ocr-region-overlay-resilience-and-tokens.md`: region selector render() chuyển sang update-node (handles bound lúc tạo — fix resize chết sau move drag), OCR auto-restore trên SPA qua `shared/lib/dom/videoReady.ts` + MutationObserver, overlay CSS class-based chạy bằng token `--overlay-ocr-region-*`, 5 icon mới (crop/move/moveVertical/moveHorizontal/scanText). `2-architechture-system.md` cập nhật 4 row + 2 function index

**2026-08-23**: Fix "OCR scan sai vùng" — region selector overlay (shell-space) ≠ crop region (intrinsic-space) khi video letterbox/control-bar. Thêm `features/ocr/pipeline/regionMapping.ts` (O(1) affine transform shell↔intrinsic, 5 object-fit + object-position, 42 unit tests). RegionSelector public API chuyển sang intrinsic-space (SSOT), internal CSS giữ shell-space, convert ở boundary. Thêm mock-youtube-hardsub page (canvas burn EN+VI hardsub, ?ar=4:3/16:9/21:9, port 4326). Debug hook mở rộng nhận splitEnabled/splitRatio/customRegion. `2-architechture-system.md` cập nhật 2 row (regionMapping + regionSelector)

**2026-08-13**: Thêm spec `subtitle-appearance-in-manager.md` + ADR `subtitle-appearance-in-manager.md`: di chuyển subtitle appearance customization (Target/Native style, Block position/scale/opacity, NavCluster) từ Settings Dialog sang Subtitle Manager Panel. 4 components moved từ `settings/ui/` sang `subtitle/ui/appearance/`. `appearanceShadowCss.ts` manifest tạo SSOT cho shadow CSS.
**2026-08-11**: Khôi phục `docs/adr/` với ADR mới `native-fullscreen-iframe-player-mode.md`: child-iframe Player Mode dùng native Fullscreen API, project player vào Cell `videoStage` slot trong cùng child document, xóa `iframePlayerModeBridge.ts`, thêm `iframeContext.ts`.
**2026-08-05**: Thêm skill `testing-extension-browser` — 1 workflow duy nhất: nodriver spawn (anti-bot) + CDP `Extensions.loadUnpacked` (Chrome 137+ blocks `--load-extension`) + load 2 ext (Cell + uBlock) + navigate + reload. Script Python `script/test-cell-browser.py` chạy qua `uv run --python 3.11 --with nodriver`.
**2026-08-03**: Cập nhật generic subtitle-list discovery (T1-T12 E2E). Pipeline/protocol adapters: cinesrc, kisskh, lookmovie, broodingmovies, lunastream, MyAsianTV, noxx, onflix HLS, videasy encrypted decoder.
**2026-08-03**: `content-script.ts` `PageScanner` chạy trong iframe có `<video>` (moviepire.ru → vidnest.fun `Nest` provider) để bắt `<track>` subtitle URLs.

## Lịch sử cleanup tài liệu

**2026-08-11**: `docs/adr/` được khôi phục. ADR `native-fullscreen-iframe-player-mode.md` ghi quyết định chuyển child-iframe Player Mode sang native Fullscreen API, project player vào `videoStage` slot, và xóa `iframePlayerModeBridge.ts`.
**2026-07-XX**: Consolidated toàn bộ docs legacy vào `2-architechture-system.md`. Đã xóa:
- `docs/adr/` (76 ADR files) — quyết định kiến trúc giờ được tham chiếu inline trong `2-architechture-system.md` qua `**ADR-NNN**` markers
- `docs/specs/` (40+ PRD files) — spec chi tiết đã được implement, code là nguồn sự thật
- `docs/intent/` (15+ interview-me output) — intent đã được hiện thực hóa
- `docs/ideas/` (7 refined idea one-pagers) — đã được implement hoặc archived
- `docs/plan/` (15+ implementation plan files) — plan đã được thực hiện
- `docs/task/` (10+ task list files) — task đã hoàn thành
- `docs/test-reports/` (15+ MCP browser test reports + screenshots) — verify đã pass
- `docs/reviews/` (8 spec/architecture review reports) — review đã được phản ánh
- `docs/mockups/` (8 HTML mockups) — prototype đã được implement
- `docs/knowledge/` (30+ principle files) — đã được migrate sang `.agents/skills/learning-and-apply/experience/`
- `docs/reference/` (5 tool guides) — đã được archived
- `docs/reading-summaries/` — đã được archived
- `docs/temp/` — đã được archived
- `interview_ui-ux-tokenize-on-media.md` — đã được implement

## Cách dùng tổng quan

| Khi nào | Đọc gì | Để biết |
|---|---|---|
| Đầu session | 0-wiki.md | Dự án có gì, docs nào tồn tại |
| Trước khi sửa code | 2-architechture-system.md | Cấu trúc src/, dependency map, function index |
| Khi hiểu sai intent | 1-share-language.md | Glossary human ↔ system language (2 chiều + Update protocol) |
| Trước khi viết function mới | grep `.agents/skills/learning-and-apply/index.json` | Nguyên lý đã học, tránh tái phạm |
| Khi gặp tool mới | `.agents/skills/` | Hướng dẫn dùng skill/tool |
| Khi thay đổi kiến trúc | inline ADR marker trong `2-architechture-system.md` | Tại sao chọn kiến trúc này (`**ADR-NNN**` markers) |

## File quan trọng (always-load)

| File | Bản chất | Khi nào load |
|---|---|---|
| AGENTS.md | Cross-tool rules + skill hierarchy (baseline + ponytail consolidated) | Mỗi session (Windsurf + Devin) |
| 0-wiki.md | Mục lục tổng quan | Đầu session |
| 1-share-language.md | Glossary human ↔ system | Đầu session |
| 2-architechture-system.md | Architecture chi tiết | Trước khi sửa code |

## Update protocol

- Thêm/xóa file docs/ → update 0-wiki.md (mục lục)
- Thêm/xóa/sửa file src/ → update 2-architechture-system.md (cây thư mục + dependency + function index)
- Thay đổi kiến trúc → ghi inline ADR marker (`**ADR-NNN**`) trong `2-architechture-system.md` (chỉ WHY)
- Đúc rút nguyên lý → thêm atom JSON vào `.agents/skills/learning-and-apply/experience/`
- Fix bug → ghi bug log + nguyên lý vào `.agents/skills/learning-and-apply/experience/`
