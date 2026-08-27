# Cell Design System — Audit, Operating Model và Roadmap

> Trạng thái audit: 2026-08-27  
> Phạm vi: Design System phục vụ Chrome-family MV3 extension Cell, UI React 19 + Vite 8, Shadow DOM, desktop/tablet và responsive viewport.  
> Đây là assessment nội bộ có denominator minh bạch, không phải chứng nhận tiêu chuẩn ngành.

## 1. Mục tiêu thành công

Cell có Design System thành công khi team luôn trả lời được năm câu hỏi:

1. **Mình đang làm gì?** Mọi UI task bắt đầu từ user problem, layer trong hệ thống và acceptance criteria.
2. **Mình đang có gì?** Inventory token, component, pattern, trạng thái và coverage được sinh từ code thực tế.
3. **Mình chưa có gì?** Gap có owner, mức ưu tiên, dependency và exit criteria.
4. **Mình kiểm chứng bằng gì?** Quality gate tự động, tái lập trong CI; manual browser chỉ bổ sung cho exploratory smoke test.
5. **Mình thay đổi hệ thống thế nào?** Có governance, versioning, migration và vòng lặp đo adoption.

Target không phải “có nhiều component nhất”. Target là hệ thống nhỏ nhất giúp Cell nhất quán, accessible, responsive và an toàn khi thay đổi.

## 2. Product-specific design direction

### 2.1 Bối cảnh Cell

- Sản phẩm học ngoại ngữ chạy dưới dạng MV3 extension.
- Persona rất rộng 5–80 tuổi, nhóm chính 10–25 tuổi.
- Chạy trên máy RAM khả dụng từ 1 GB và nhiều kích thước viewport.
- UI xuất hiện trong popup, side panel, options/page, player overlay và Shadow DOM trên website bên thứ ba.
- Phải phản hồi dưới 3 giây và tránh phụ thuộc runtime không cần thiết.
-  tôi là Dương, dương của hải dương cũng là dương của thái dương, tôi yêu thiên
  nhiên, bản mệnh là mộc, tôi thích những hàng cây với những tán lá đung đưa theo gió, tôi yêu nước vì nó yên bình, nhẹ nhàng, lả
  lướt, mọi thứ đều cần nước để tồn tại, nước phản ánh bản tâm, phản ánh thế giới, cell được sinh ra cũng từ nước lớn lên và phát
  triển, những cú cá tung tắng ở dưới nước làm mặt hồ gợn sóng, những viên sỏi nằm ở dưới đáy hồ cũng làm tôi cảm thấy chúng có một
  vị trí đặc biệt mà chỉ cần nằm im cũng chứng tỏ sự quan trọng quả nó, tôi yêu bầu trời với màu xanh dương nhẹ nhàng. đó chính là
  tôi người muốn có một cuộc sống gần gũi với thiên nhiên tôi muốn liquic glass sẽ là design system style, màu chủ đạo là màu xanh
  dương của bầu trời, tiếp đó là màu xanh lá của cây, trong suốt của nước, màu xám của các viên sỏi, màu nâu của đất, màu vàng của
  ánh mặt trời. tôi muốn chúng là một phần của hệ thống này.

### 2.2 Nguyên tắc quyết định

1. **Learning first:** nội dung học và hành động tiếp theo luôn nổi bật hơn chrome trang trí.
2. **Quiet confidence:** neutral-first, một accent có chủ đích, hierarchy bằng surface và typography.
3. **Accessible by default:** WCAG 2.2 AA là minimum gate, không phải bước polish cuối.
4. **Host-resistant:** style trong content script/Shadow DOM không phụ thuộc CSS của website chủ.
5. **Responsive by available space:** layout phản ứng theo không gian thực, không giả định loại thiết bị.
6. **Progressive disclosure:** không đưa cấu hình nâng cao vào luồng chính.
7. **Performance-budgeted:** animation, blur, font và asset đều phải có lý do và budget.
8. **SSOT before reuse:** token → primitive → component → pattern → page; feature không tạo ngôn ngữ riêng.

## 3. Nguồn sự thật

| Câu hỏi | SSOT | Vai trò |
|---|---|---|
| Giá trị token hiện tại | `src/shared/styles/tokens.json` | Canonical machine-readable values |
| Quy tắc, naming, semantics | `src/shared/styles/STANDARD.md` | Foundation contract |
| Checklist nhanh cho agent | `docs/design-system/DESIGN.md` | Short operational contract, không chứa value cạnh tranh |
| Component thực tế | `src/shared/ui/` và `src/shared/ui/index.ts` | Public UI API |
| Icon thực tế | `src/shared/icons/index.ts`, `src/shared/icons/svg/` | Catalog + assets |
| Tại sao foundation được chọn | `docs/adr/084-091` | Decision history; không xóa |
| Showcase thực tế | `src/entrypoints/design-system-showcase/` | Living visual documentation source |
| Audit và lộ trình | File này | Baseline, gap, phases và exit criteria |

Thứ tự giải quyết xung đột: **code/token hiện tại → STANDARD → ADR rationale → DESIGN quick guide → tài liệu học tập/lịch sử**.

## 4. Audit bằng chứng hiện tại

### 4.1 Đã có

| Area | Evidence | Kết luận |
|---|---|---|
| Product principles | `STANDARD.md` định nghĩa quiet confidence và 6 foundation principles | Có nền tảng rõ |
| Token architecture | `tokens.json`: core, derived, static, component, composite và presets | Mạnh nhưng còn alias/domain bloat |
| Foundation | ADR 084–091: color, typography, spacing, shape/elevation, motion, iconography, grid, taxonomy | Đủ rationale chính |
| Component library | 81 file TSX nguồn trong `src/shared/ui`; barrel có 80 export statements | Library rộng, taxonomy còn drift |
| Component tests | 70 file `src/shared/ui/*.test.tsx` | Coverage file-level cao nhưng chưa chứng minh interaction/a11y |
| Showcase | 82 showcase files tổng; chỉ BottomSheet, ErrorBoundary, Sheet thiếu showcase trong shared UI | Living showcase gần đầy đủ |
| Icon system | 90 SVG; `scripts/check-icons.js` mở rộng kiểm geometry + file↔catalog 1:1 + tags + duplicate SVG | 90/90 pass; gate hoạt động với Jest fixtures |
| Token pipeline | `generate-tokens.js` → `tokens.css`; predev/prebuild tự sinh | Có automation |
| UI browser tool | Playwright 1.61; `e2e/showcase.spec.ts` (3 tests) + fixture, `e2e/extension.spec.ts` (3 tests) + fixture, webServer auto-build/serve | Showcase + extension suites pass local 2x, trace retain-on-failure |
| Unit infrastructure | Jest + Testing Library, 403 test/spec files toàn repo | Không nên migration wholesale thiếu benchmark |

### 4.2 Chưa có hoặc chưa đạt

1. `playwright.config.ts` trỏ tới `./e2e`; `e2e/showcase.fixture.ts` + `e2e/showcase.spec.ts` và `e2e/extension.fixture.ts` + `e2e/extension.spec.ts` đã tạo, webServer tự động build/serve cho showcase và mock YouTube, `npm run test:e2e` chạy đúng showcase và extension suites.
2. CI workflow `.github/workflows/design-system-ci.yml` chạy typecheck, design-system unit (`test:unit:design-system`), icon check, CSS audit (non-blocking do 166 undefined-token violations cũ), production build, development build và Playwright E2E; failure upload report/trace.
3. Không có visual regression baseline tự động.
4. Không có runtime accessibility scan; token contrast không đủ để chứng minh component accessible.
5. Chưa có pattern library cho flow học tập, loading, empty, error recovery, search và form.
6. Chưa có contribution, lifecycle, versioning và deprecation policy hoạt động.
7. Documentation đã dọn dẹp các link chết tới file và thư mục không còn tồn tại (`daft.md`, icon-system directories, showcase artifacts cũ, v.v.).
8. `atom-design-plan.md` dùng naming cũ (`Figtree`, `--spacing-*`, `--color-background-surface`) và không còn là inventory đáng tin.
9. `DESIGN.md`, `README.md`, `STANDARD.md` và ADR có một số value/alias mâu thuẫn; nhiều nguồn cùng cố làm SSOT.
10. Build output showcase đang ghi vào `docs/design-system/`, trộn source docs với hashed assets và public extension files.
11. `m3-design-standard/audit.sh` trả 534 finding, có shell error tại heuristic count và flag mock pages/wrapper hợp lệ; tín hiệu thấp, không thể dùng làm gate.
12. `generate-tokens.js` gắn 3:1 cho secondary/muted text dù role mặc định là 12–14px; normal text cần 4.5:1. Resolver cũng skip pair `rgba()` vì chỉ validate màu bắt đầu bằng `#`.
13. Contrast math tồn tại ở cả build script và runtime theme validator, có nguy cơ drift.
14. Icon QC đã mở rộng kiểm geometry + file↔catalog 1:1 + tags + duplicate SVG; 90/90 pass.

## 5. Maturity score

### 5.1 Rubric nội bộ

| Dimension | Weight | Score | Bằng chứng chính |
|---|---:|---:|---|
| Product context và principles | 8 | 8 | Persona, platform, quiet confidence, a11y principles |
| Foundations | 15 | 13 | 8 ADR; một số contract/value drift |
| Token architecture | 12 | 9 | Ba tầng + generation; alias/domain bloat, contrast validator gap |
| Components và states | 15 | 12 | 81 TSX, 70 tests, gần đủ showcase; state coverage chưa tự động |
| Patterns và templates | 8 | 3 | Feature patterns tồn tại nhưng chưa formal hóa/reuse |
| Documentation và discoverability | 10 | 5 | Nhiều docs tốt nhưng trùng lặp, stale links, stale plan |
| Accessibility | 10 | 4 | Principles/touch/focus/reduced-motion có; runtime gate chưa có |
| Automated UI quality | 10 | 6 | Unit/icon/token checks + Playwright E2E + CI workflow có; visual/a11y chưa có |
| Governance và lifecycle | 7 | 2 | Có conventions; thiếu contribution/versioning/deprecation flow |
| Adoption và continuous evolution | 5 | 3 | Showcase/loop log có; chưa đo adoption/drift |
| **Tổng** | **100** | **62** | **Operational maturity = 62% theo rubric này** |

### 5.2 Cách hiểu con số

- **Asset completeness:** khá cao; foundations, tokens, components và icons đã hình thành.
- **Operational maturity:** trung bình; chưa có reliable browser gate, governance và pattern layer.
- **Confidence:** medium-high cho inventory; medium cho maturity vì trọng số là rubric nội bộ.
- Không nên báo “Cell đạt 62% chuẩn quốc tế”. Cách nói đúng: **Cell đạt 62/100 theo rubric vận hành được định nghĩa ở trên**.

## 6. Cái gì nên giữ, improve hoặc xóa

### 6.1 Giữ làm core

- `src/shared/styles/tokens.json`
- `src/shared/styles/STANDARD.md`
- `src/shared/ui/`
- `src/shared/icons/`
- `docs/adr/084-091`
- `docs/design-system/DESIGN.md`, sau khi rút về quick contract không duplicate numeric values
- `src/entrypoints/design-system-showcase/`
- `scripts/generate-tokens.js` và `scripts/check-icons.js`, sau khi sửa correctness gap
- Jest cho pure logic và component behavior hiện tại cho đến khi benchmark chứng minh migration đáng giá

### 6.2 Improve

- Tạo inventory tự động từ barrel/showcase/tests thay vì duy trì danh sách tay.
- Mỗi component public phải có owner, layer, status, variants, states, a11y contract, test và showcase hoặc lý do exemption.
- Tách generic token khỏi domain token; migrate alias theo release, không xóa hàng loạt.
- Formal hóa pattern từ flow thật, không xây một catalog pattern dự đoán trước.
- Chuyển UI verification từ manual-only sang Playwright deterministic gate.
- Dùng parser-based CSS lint thay cho grep/bash heuristic toàn repo.
- Hợp nhất contrast logic thành pure SSOT dùng được bởi build và runtime.

### 6.3 Xóa hoặc đưa ra khỏi working source

#### Generated/duplicate — đủ bằng chứng để xóa sau khi đổi build destination

- `docs/design-system/assets/` — 48 tracked hashed assets.
- `docs/design-system/design-system-showcase.html`.
- `docs/design-system/fonts/` — font trùng byte-for-byte với `public/fonts/`.
- `docs/design-system/icons/` — ba PNG trùng byte-for-byte với `public/icons/`.
- Build pollution đang ignored: `ffmpeg/`, `models/`, `manifest.json`, `options.html`, `options.js`, `sql-wasm.wasm`.

#### Stale/completed — xóa sau khi xác nhận không còn unique active contract

- `atom-design-plan.md` — plan cũ và naming drift; code + generated inventory thay thế.
- `showcase-dark-redesign-brief.md` — brief đã hoàn tất.
- `tri-thuc-design-system.md` — nội dung chung trùng knowledge base và phụ thuộc `daft.md` không tồn tại.
- `navcluster-shadow-mockup.html` — mockup cũ không có inbound reference.
- `mockups/ocr-settings-panel-mockup.html` — mockup feature đã triển khai, không có inbound reference.
- `mockups/liquid-glass/*.png` — 17 historical screenshots không có inbound reference; active AC là HTML source trong showcase mockups và spec.

#### Giữ nhưng sắp xếp

- `foundations-tutorial.html` → `guides/foundations-tutorial.html`.
- `foundations-advanced.html` → `guides/foundations-advanced.html`.
- Giữ link tương đối giữa hai guide.

Git history là archive cho artifact đã superseded. Không tạo thêm `archive/` trừ khi một file còn giá trị pháp lý hoặc nghiên cứu mà không có nguồn thay thế.

## 7. Target structure

```text
docs/design-system/
├── DESIGN.md                    # quick implementation contract
├── ROADMAP.md                   # file này: audit + operating model + roadmap
└── guides/
    ├── foundations-tutorial.html
    └── foundations-advanced.html

src/shared/styles/
├── tokens.json                  # value SSOT
├── STANDARD.md                  # semantic/rule SSOT
├── tokens.css                   # generated
└── README.md                    # build/import guide

src/entrypoints/design-system-showcase/  # showcase source

dist/design-system-showcase/             # generated, ignored, disposable
```

`docs/design-system/` không chứa extension manifest, OCR models, FFmpeg, WASM, public icons/font hay hashed JavaScript/CSS.

## 8. Tooling target

### 8.1 Tool matrix

| Need | Tool | Quyết định |
|---|---|---|
| Pure logic/unit | Jest hiện tại | Giữ; chỉ cân nhắc Vitest sau benchmark trên suite thật |
| Component behavior | Testing Library + Jest hiện tại | Giữ ngắn hạn; behavior không phụ thuộc layout |
| Real layout/interactions | Playwright Test | Dùng showcase URL; không cần experimental component testing |
| Visual regression | Playwright `toHaveScreenshot()` | Có sẵn trong dependency hiện tại |
| Semantic regression | Playwright ARIA snapshots | Có sẵn; dùng cho role/name/order quan trọng |
| Runtime accessibility | `@axe-core/playwright` | Một dev dependency mới, sau bundle/dev-cost check |
| CSS/token policy | `scripts/check-design-system-css.mjs` (PostCSS parser gate) | Parser gate đang chạy trên `src/shared/ui`; Stylelint chỉ thêm nếu benchmark chứng minh lợi ích |
| Token contrast | Pure contrast module dùng chung | Fix threshold/alpha compositing và reuse build/runtime |
| Icon integrity | `scripts/check-icons.js` (regex parser + CLI paths + Jest fixtures) | Verify file↔catalog 1:1, semantic tags, duplicate SVG — implemented |
| Extension E2E | Playwright bundled Chromium + persistent context | Official deterministic path cho CI |
| Chrome/Edge/Brave thực | Existing nodriver + DevTools MCP | Exploratory/manual smoke test, không phải merge gate |
| Performance/a11y diagnosis | Chrome DevTools MCP | Dùng khi cần trace, computed accessibility tree, runtime debug |

### 8.2 Điều không làm

- Không dùng MCP click-through thủ công như bằng chứng duy nhất.
- Không thêm Chromatic/Percy khi Playwright screenshot đã đủ cho local/CI baseline.
- Không chuyển 403 tests sang Vitest chỉ vì “modern hơn”. Đo cold run, watch latency, flake và migration diff trước.
- Không dùng Playwright Component Testing experimental trên critical path.
- Không chạy extension E2E trên Firefox/WebKit rồi gọi đó là Chrome-extension compatibility. MV3 package của Cell cần Chromium-family E2E; showcase CSS có thể có browser matrix riêng nếu sản phẩm thật hỗ trợ.
- Không coi Chrome Android là extension runtime được hỗ trợ khi Chrome Android không cài desktop extension; chỉ kiểm responsive viewport cho UI độc lập.

### 8.3 Nguồn chính thức

- Chrome extension E2E guidance: https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing
- Playwright Chrome extensions: https://playwright.dev/docs/chrome-extensions
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright accessibility testing với axe: https://playwright.dev/docs/accessibility-testing
- Playwright ARIA snapshots: https://playwright.dev/docs/aria-snapshots

## 9. Quy trình chuẩn cho một UI change

```text
Problem / user flow
  → classify layer (token / component / pattern / page)
  → search existing token + component + icon
  → write acceptance criteria (behavior + responsive + a11y)
  → prototype in living showcase
  → implement smallest reusable change
  → unit/behavior test
  → Playwright interaction + responsive check
  → axe + ARIA + visual snapshot
  → extension E2E nếu chạm integration boundary
  → manual real-Chrome smoke cho host-specific risk
  → review + document decision/migration
  → release + measure adoption/drift
```

### Definition of Done cho UI

- Không có M3 token trong production source.
- Không có token undefined, unregistered icon hoặc duplicate SVG.
- Không có hardcoded design value ngoài documented exception.
- Keyboard flow và focus visible hoạt động.
- `prefers-reduced-motion`, 200% zoom/reflow, light/dark và forced-colors không làm mất chức năng chính.
- 0 axe violation thuộc scope đã khai báo.
- ARIA snapshot của flow quan trọng được review.
- Visual snapshot pass trong cùng pinned CI environment.
- Playwright interaction pass ở viewport 320, 600, 840, 1200 và một coarse-pointer profile phù hợp.
- Nếu chạm extension boundary: bundled Chromium E2E pass; real Chrome smoke pass cho release candidate.
- Build, typecheck, unit tests pass.

## 10. Roadmap thực thi

## Phase 0 — Khôi phục trust và ranh giới

**Mục tiêu:** một SSOT rõ, docs không chứa build output.

1. Chốt SSOT map ở mục 3 và rút `DESIGN.md` thành quick contract.
2. Sửa/xóa mọi link tới file không tồn tại.
3. Bỏ plugin copy showcase trong main `vite.config.ts`; showcase chỉ có một build path qua `vite.showcase.config.ts`.
4. Đổi output sang `dist/design-system-showcase/`; update `package.json`, comments, wiki và architecture map.
5. Move hai foundation guide; xóa generated/duplicate/stale artifacts sau explicit confirmation.
6. Sinh inventory machine-readable từ code để thay plan 79 atom cũ.

**Exit criteria**

- `git status --ignored docs/design-system` không xuất hiện artifact build.
- Root folder chỉ còn `DESIGN.md`, `ROADMAP.md`, `guides/`.
- 0 inbound link chết trong docs/source/skills.
- `npm run design-system:dev` và built showcase đều mở được.
- Build showcase không copy model/FFmpeg/WASM/public extension manifest.

## Phase 1 — Deterministic quality gates

**Mục tiêu:** thay manual/regex-only checks bằng kiểm tra tái lập.

1. Tạo Playwright showcase suite với fixture light/dark, breakpoint và reduced motion.
2. [x] Tạo extension fixture theo official persistent-context workflow trên bundled Chromium (`e2e/extension.fixture.ts` + `e2e/extension.spec.ts`, pass `npm run test:e2e`).
3. Thêm CI chạy typecheck, unit, build, icon/token checks và Playwright.
4. Parser-based CSS audit gate `scripts/check-design-system-css.mjs` kiểm `src/shared/ui/*.module.css` (bỏ `*.showcase.module.css` và code showcase/feature) với PostCSS; gồm fixtures good/bad. Mở rộng scope sau khi false-positive <5%.
5. Mở rộng icon checker: mọi SVG phải có đúng một catalog entry và tags không rỗng.

**Exit criteria**

- `npm run test:e2e` chạy test thật, không fail vì test directory vắng.
- CI bắt buộc pass trước merge.
- CSS audit có <5% false positive trên sample đã review; không còn shell runtime error.
- 100% SVG ↔ catalog 1:1.

## Phase 2 — Accessibility by default

**Mục tiêu:** chứng minh rendered UI, không chỉ token.

1. [x] Hợp nhất contrast math thành `src/shared/lib/contrast.ts`, hỗ trợ hex/rgb/rgba/color-mix/alpha compositing, được build (`scripts/generate-tokens.js` qua jiti) và runtime dùng chung.
2. [x] Áp 4.5:1 cho normal text; chỉ 3:1 khi pair được đánh dấu explicit large-text.
3. Thêm axe scan cho stable showcase components/pages.
4. Thêm keyboard/focus tests cho Dialog, Drawer, Sheet, Tabs, Select, Menu/Popover nếu có.
5. Thêm ARIA snapshots cho navigation, form error, dialog và subtitle controls.
6. Manual screen-reader matrix cho các flow critical; automation không thay thế hoàn toàn.

**Exit criteria**

- [x] 0 skipped contrast pair vì unsupported color format.
- 0 axe violation ở component stable.
- 100% interactive stable component có keyboard/focus assertion hoặc documented exemption.
- Critical flows có NVDA + Chrome smoke checklist và kết quả lưu theo release.

## Phase 3 — Visual và responsive confidence

**Mục tiêu:** phát hiện design drift trước merge.

1. Chọn representative state matrix, không snapshot mọi permutation.
2. Baseline light/dark cho Button, Input, Card, Dialog, Tabs, Sheet, overlay và ba page shell.
3. Pin browser/OS/font trong CI; disable animation/dynamic timestamp khi chụp.
4. Kiểm 320/600/840/1200/1600 theo foundation breakpoint thực tế.
5. Thêm coarse pointer và 200% zoom/reflow scenarios.

**Exit criteria**

- 100% P0 components/pages có approved baseline.
- Snapshot update luôn được human review; không auto-accept.
- 0 horizontal overflow ở viewport/zoom matrix ngoài documented data-table exception.

## Phase 4 — Component và pattern productization

**Mục tiêu:** library phục vụ user flow, không chỉ collection component.

1. Inventory public API theo actual usage; đánh dấu stable/experimental/deprecated.
2. Bổ sung showcase còn thiếu hoặc documented exemption cho non-visual component.
3. Audit states: default, hover, pressed, focus-visible, disabled, loading, selected, error khi applicable.
4. Trích pattern từ flow thật: loading, empty, error recovery, search→result, form submit, subtitle acquisition, vocabulary capture.
5. Xóa component/token không consumer sau dependency proof; không chạy theo số lượng 79 atom.

**Exit criteria**

- 100% public export có metadata, owner/status và usage count.
- 100% stable visual component có showcase + behavior test.
- Mỗi pattern có problem, when/when-not, anatomy, a11y và production consumer.
- Không có component stable 0 consumer trừ documented primitive.

## Phase 5 — Governance và continuous evolution

**Mục tiêu:** giữ hệ thống đúng sau khi roadmap kết thúc.

1. Contribution flow: request → evidence of reuse gap → proposal → showcase → tests → approval.
2. Semantic lifecycle cho token/component: experimental → stable → deprecated → removed.
3. Changelog tập trung vào breaking behavior/token/API, không log mọi CSS tweak.
4. Dashboard định kỳ: adoption, hardcoded drift, undefined/unused token, a11y, visual flake, bundle impact.
5. Quarterly review principles/foundations theo user evidence; không redesign theo trend.

**Exit criteria**

- Breaking change có migration note và deprecation window.
- Shared UI adoption ở production interactive controls ≥95% hoặc có documented exception.
- Undefined token = 0; dead token/component được review mỗi release.
- Visual test flake <1% trong 30 runs.
- Design System health review có owner và cadence hàng quý.

## 11. Ưu tiên và thứ tự phụ thuộc

```text
P0 SSOT + folder/build boundary
  → P1 deterministic Playwright/CI gate
    → P2 accessibility correctness
      → P3 visual/responsive baselines
        → P4 component/pattern completeness
          → P5 governance + metrics
```

Không xây thêm component trước P0/P1 trừ khi feature thật bị block. Không migration Jest trước khi P1 có benchmark. Không xóa alias/token trước usage proof và migration.

## 12. Metrics baseline và target

| Metric | Baseline 2026-08-27 | Target |
|---|---:|---:|
| Operational maturity | 62/100 | ≥85/100 |
| Shared UI TSX files | 81 | Không đặt target tăng |
| Shared UI colocated tests | 70 | 100% stable visual/interactive exports |
| Shared UI missing showcase | 3 | 0 hoặc documented exemption |
| Icons passing geometry QC | 90/90 | 100% + catalog 1:1 |
| Playwright E2E tests | 3 (showcase) + 3 (extension) | Critical showcase + extension flows |
| CI workflows | 1 (`design-system-ci.yml`) | 1 required quality pipeline |
| Runtime a11y automation | 0 | 100% stable showcase scope |
| Visual baselines | 0 | 100% P0 state matrix |
| Dead documentation links | Nhiều | 0 |
| Build artifacts trong docs | 48 hashed assets + output/public copies | 0 |

## 13. Deletion safety gate

Không xóa file chỉ vì “có vẻ cũ”. Trước mỗi batch:

1. `git ls-files` xác nhận tracked/ignored.
2. Search inbound references toàn repo.
3. Xác nhận có source thay thế hoặc Git history đủ làm archive.
4. Đổi build/config trước nếu artifact sẽ được regenerate.
5. Trình exact grouped paths và nhận explicit confirmation.
6. Xóa/move theo batch nhỏ.
7. Build showcase, link audit và `git diff --check` sau mỗi batch.

## 14. Doubt-Driven review record

Artifact này đã qua hai fresh-context adversarial reviews. Findings được reconcile như sau:

- Actionable: sửa denominator, giữ tutorial độc lập, khai báo hidden coupling của hai Vite configs, thêm CI/exit criteria, sửa contrast validator và icon catalog checks.
- Trade-off: giữ Jest; dùng Git thay working-tree archive; build contrast vẫn là blocking gate.
- Rejected as noise bằng lệnh trực tiếp: reviewer count 66/83/95; reviewer cho rằng ignored files không tồn tại; reviewer gắn FooterBar/HintIcon vào missing-showcase list.
- Cross-model second opinion: user chọn skip; roadmap dùng single-model/fresh-context findings hiện tại.

## 15. Plan và task execution

Plan triển khai canonical:

- `tasks/plan-design-system-v2.md` — dependency graph, 22 task theo P0–P5, acceptance criteria, verification, file scope, checkpoint, risk và approval gate.
- `tasks/todo-design-system-v2.md` — checklist một-một với plan để theo dõi execution qua nhiều session.

Hai plan cũ đã được đọc và hợp nhất vào v2, không chạy song song:

- `tasks/plan-design-system-enforcement.md` / `todo-design-system-enforcement.md`: giữ lịch sử giai đoạn tạo DESIGN.md, guardian và Clipboard prototype.
- `tasks/plan-foundation-v1.md` / `todo-foundation-v1.md`: giữ lịch sử baseline/foundation; các task còn hợp lệ về token dependency, WCAG, pruning và SSOT đã được đưa vào v2.

Thứ tự bắt buộc:

```text
T0.1 human approval
  → T0.2 build boundary
  → T0.3 cleanup
  → T0.4 SSOT reconciliation
  → P1 deterministic gates
  → P2 accessibility
  → P3 visual/responsive
  → P4 component/pattern productization
  → P5 governance + maturity re-audit
```

Không bắt đầu cleanup destructive hoặc thêm dependency chỉ vì plan đã tồn tại. T0.1 và dependency review vẫn là approval gates.

## 16. Worklog đã thực hiện

### 2026-08-27 — Audit và planning baseline

**Đã hoàn thành**

1. Đọc nguồn bắt buộc: `docs/0-wiki.md`, `docs/1-share-language.md`, `docs/2-architechture-system.md`, `src/shared/styles/README.md`, `STANDARD.md`, `tokens.json`, `DESIGN.md`, ADR/foundation plan và design-system learning loop.
2. Inventory `docs/design-system/`: xác định 78 tracked files, 48 tracked hashed assets và sáu ignored build-output path đang bị copy vào docs.
3. Xác minh duplicate bằng SHA-256: font trong docs trùng `public/fonts`; ba icon PNG trong docs trùng `public/icons`.
4. Xác minh library baseline: 81 shared UI TSX source files, 80 barrel export statements, 70 colocated TSX tests, ba TSX component thiếu showcase, 90 SVG icons.
5. Chạy icon QC: `90/90` pass.
6. Chạy M3 audit hiện tại: báo 534 findings nhưng có shell runtime error và nhiều heuristic false positives; kết luận không đủ tin cậy để làm blocking gate.
7. Audit test stack: Jest/Testing Library đang phục vụ 403 test/spec files; Playwright đã cài nhưng `e2e/` chưa tồn tại; chưa có CI, visual baseline hoặc runtime axe scan.
8. Kiểm tra official guidance cho Chrome extension E2E, Playwright extension fixture, screenshot, axe và ARIA snapshot.
9. Chạy hai fresh-context adversarial reviews; reconcile finding thành actionable/trade-off/noise. User chọn skip cross-model review.
10. Tạo assessment nội bộ 62/100 với denominator 100 và target ≥85/100; không trình bày như chứng nhận ngành.
11. Tạo `ROADMAP.md`, cập nhật `docs/0-wiki.md` và tạo plan/task v2.

**File đã tạo/sửa**

- Tạo `docs/design-system/ROADMAP.md`.
- Tạo `tasks/plan-design-system-v2.md`.
- Tạo `tasks/todo-design-system-v2.md`.
- Sửa `docs/0-wiki.md` để đăng ký roadmap và worklog entry.

**Chưa thực hiện**

- Chưa xóa hoặc move file nào trong `docs/design-system/`.
- Chưa sửa `vite.config.ts`, `vite.showcase.config.ts` hoặc `package.json`.
- Chưa thêm dependency `@axe-core/playwright`, Stylelint hoặc tool khác.
- Chưa implement Playwright suite/CI/visual baseline.
- Chưa sửa contrast engine hoặc token/component source.
- Chưa commit.

**Lý do dừng đúng gate**

Cleanup là destructive operation nên phải chờ T0.1: Anh yêu xác nhận exact path-specific delete/move manifest. Implementation tiếp theo phải bắt đầu từ `tasks/plan-design-system-v2.md`, không từ checklist cũ.

### 2026-08-27 — Plan refinement: showcase auto-discovery

**Đã hoàn thành**

1. Xác định vấn đề: `CANONICAL_META` trong `autoDiscovery.ts` là hardcoded map, component mới không có entry sẽ bị `unclassified` hoặc rơi `Other`.
2. Thêm Task 0.5 "Automate showcase taxonomy and discovery" vào `tasks/plan-design-system-v2.md`.
3. Thêm T0.5 tương ứng vào `tasks/todo-design-system-v2.md`.
4. Cập nhật số task trong `docs/design-system/ROADMAP.md` từ 21 lên 22.

**File đã tạo/sửa**

- Sửa `tasks/plan-design-system-v2.md`.
- Sửa `tasks/todo-design-system-v2.md`.
- Sửa `docs/design-system/ROADMAP.md`.

**Chưa thực hiện**

- Chưa sửa `src/entrypoints/design-system-showcase/autoDiscovery.ts`.
- Chưa thêm test cho auto-discovery.
- Chưa chạy build/showcase để verify.

### 2026-08-29 — Implemented T0.5 auto-discovery

**Đã hoàn thành**

1. Tách `autoDiscovery.ts` thành `autoDiscovery.logic.ts` (pure taxonomy inference) + `autoDiscovery.ts` (Vite glob + discovery).
2. Giảm `CANONICAL_META` từ 68 entry xuống còn 5 override đặc biệt (M3Tokens, ErrorBoundary, useFocusTrap, useIsMobile, useSheet).
3. Level inference từ đường dẫn: `shared/ui` → atoms, `features/*/ui` → organisms, `features/*/molecules` → molecules, `features/*/organisms` → organisms, `design-system-showcase/pages` → pages, `templates` → templates.
4. Category inference từ `showcaseMeta.category` hoặc basename pattern; fallback `Other`.
5. Thêm 33 unit tests trong `tests/unit/entrypoints/design-system-showcase/autoDiscovery.test.ts`.
6. Mở rộng `import.meta.glob` patterns cho `shared/styles`, `features/*/molecules`, `features/*/organisms`, `templates`.
7. Cập nhật `docs/2-architechture-system.md` và `docs/0-wiki.md`.

**Kết quả verify**

- `npm run typecheck`: pass.
- `npm run build`: pass.
- `npm run build:design-system`: pass.
- `npx jest tests/unit/entrypoints/design-system-showcase/autoDiscovery.test.ts`: 33/33 pass.
- `npm run design-system` + Chrome CDP: navigation render đúng foundations/atoms/molecules/organisms/pages.

### 2026-08-29 — Implemented T0.2 showcase build path

**Đã hoàn thành**

1. Xóa `designSystemShowcase` plugin khỏi `vite.config.ts` — main build không còn copy showcase sang `docs/design-system/`.
2. Xóa `designSystemShowcase` khỏi `rollupOptions.input` của main build.
3. Đổi `vite.showcase.config.ts` `outDir` sang `dist/design-system-showcase/`; giữ `showcaseOutputMover` flatten output.
4. Cập nhật `package.json` `design-system` script serve từ `dist/design-system-showcase`.
5. Cập nhật `docs/2-architechture-system.md` và `docs/0-wiki.md`.

**Kết quả verify**

- `npm run typecheck`: pass.
- `npm run build`: pass; `git status --short -- docs/design-system` rỗng.
- `npm run build:design-system`: pass; output chỉ trong `dist/design-system-showcase/`.
- `npm run design-system`: 200 OK, `assets/` và `fonts/` load không 404, navigation render đúng.

### 2026-08-29 — Implemented T0.3 cleanup docs/design-system

**Đã hoàn thành**

1. Tạo `docs/design-system/guides/`.
2. Move `foundations-tutorial.html` và `foundations-advanced.html` vào `guides/`.
3. Xóa `design-system-showcase.html`, `assets/` (50 hashed files), `fonts/`, `icons/`, `mockups/`, `atom-design-plan.md`, `showcase-dark-redesign-brief.md`, `tri-thuc-design-system.md`, `navcluster-shadow-mockup.html`.
4. Cập nhật `docs/0-wiki.md` tree.

**Kết quả verify**

- `git ls-files "docs/design-system/**"` chỉ còn DESIGN.md, ROADMAP.md, guides/*.
- `npm run build` không repopulate docs/design-system.
- `git status --short -- docs/design-system` khớp approved cleanup manifest.
