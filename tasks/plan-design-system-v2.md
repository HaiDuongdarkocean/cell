# Implementation Plan: Cell Design System v2

> Canonical roadmap: `docs/design-system/ROADMAP.md`  
> Execution checklist: `tasks/todo-design-system-v2.md`  
> Status: Proposed — implementation starts only after human approval of this plan and the destructive cleanup list.

## 1. Overview

Nâng Cell Design System từ baseline vận hành 62/100 lên tối thiểu 85/100 mà không redesign sản phẩm hoặc tăng component count vô mục đích. Plan ưu tiên theo dependency:

1. Khôi phục SSOT và ranh giới source/generated.
2. Tạo deterministic quality gates bằng tool đang có.
3. Sửa accessibility correctness.
4. Thêm visual/responsive confidence.
5. Productize component/pattern theo production usage.
6. Thiết lập governance và health metrics.

Plan này supersede phạm vi chưa hoàn thành của:

- `tasks/plan-design-system-enforcement.md`
- `tasks/todo-design-system-enforcement.md`
- `tasks/plan-foundation-v1.md`
- `tasks/todo-foundation-v1.md`

Các quyết định foundation và baseline hữu ích từ hai plan cũ đã được giữ lại. Không tiếp tục chạy checklist cũ song song.

## 2. Binding decisions

1. `tokens.json` là SSOT cho value; `STANDARD.md` là SSOT cho semantics/rules; `DESIGN.md` chỉ là quick contract.
2. ADR 084–091 giữ ở `docs/adr/`; không xóa hoặc di chuyển.
3. Showcase source ở `src/entrypoints/design-system-showcase/`; output chỉ ở `dist/design-system-showcase/`.
4. Jest tiếp tục phục vụ pure logic và behavior tests. Không migration wholesale sang Vitest nếu chưa có benchmark chứng minh lợi ích.
5. Playwright đang cài là browser-test runner chính cho showcase, visual và extension E2E.
6. `@axe-core/playwright` chỉ được thêm sau dependency-age/size/security check; dev-only, không vào extension bundle.
7. Playwright Component Testing experimental không nằm trên critical path.
8. Manual stealth/DevTools MCP là exploratory/release smoke, không phải merge gate.
9. CSS enforcement phải parser-based và scoped; audit shell M3 hiện tại không được dùng làm blocking gate.
10. Mọi deletion phải có dependency proof và path-specific human confirmation.

## 3. Dependency graph

```text
Human approval of plan + deletion batch
  ↓
P0 SSOT/build boundary
  ├─→ clean docs tree
  └─→ reliable showcase build
        ↓
P1 Playwright + parser-based quality gates
        ↓
P2 contrast/a11y correctness
        ↓
P3 visual/responsive baselines
        ↓
P4 component/pattern productization
        ↓
P5 lifecycle/adoption metrics
        ↓
Final maturity audit ≥85/100
```

## 4. Tasks

## Phase 0 — Trust and repository boundary

### Task 0.1: Approve cleanup manifest

**Description:** Chốt exact tracked/ignored paths được xóa, file được move và source thay thế trước khi thao tác destructive.

**Acceptance criteria:**
- [ ] Manifest phân biệt `delete`, `move`, `keep`, `generated`.
- [ ] Mọi delete path có inbound-reference search và replacement/justification.
- [ ] Anh yêu xác nhận path-specific batch.

**Verification:**
- [ ] `git ls-files "docs/design-system/**"` được lưu trong review output.
- [ ] `git status --short --ignored "docs/design-system"` khớp manifest.

**Dependencies:** None.

**Files likely touched:** None.

**Estimated scope:** XS.

### Task 0.2: Make showcase build single-path and disposable

**Description:** Bỏ showcase-copy plugin khỏi extension build, đổi standalone showcase output sang `dist/design-system-showcase/`, và update scripts để build/serve từ output mới.

**Acceptance criteria:**
- [x] Main `npm run build` không ghi vào `docs/design-system/`.
- [x] `npm run build:design-system` chỉ ghi vào `dist/design-system-showcase/`.
- [x] Một command dev và một command built-preview đều chạy được.

**Verification:**
- [x] Snapshot `docs/design-system/`, chạy cả hai build, diff directory bằng 0.
- [x] Open built showcase và verify asset/font load không 404.
- [x] `npm run build` pass.

**Dependencies:** Task 0.1.

**Files likely touched:**
- `vite.config.ts`
- `vite.showcase.config.ts`
- `package.json`

**Estimated scope:** M.

### Task 0.3: Clean and reorganize design-system docs

**Description:** Thực hiện approved manifest: xóa generated/duplicate/stale artifacts, move hai foundation guides, giữ core docs.

**Acceptance criteria:**
- [ ] Root chỉ còn `DESIGN.md`, `ROADMAP.md`, `guides/`.
- [ ] Không còn manifest/model/FFmpeg/WASM/font/icon/build asset trong docs.
- [ ] Mọi file xóa nằm trong approved manifest.

**Verification:**
- [ ] `git status --short --ignored "docs/design-system"` không có ignored build pollution.
- [ ] `git diff --name-status` khớp approved batch.
- [ ] Internal link giữa hai foundation guide hoạt động.

**Dependencies:** Tasks 0.1–0.2.

**Files likely touched:**
- `docs/design-system/*`
- `docs/0-wiki.md`
- `docs/2-architechture-system.md`

**Estimated scope:** M; nhiều delete path nhưng một bounded cleanup batch.

### Task 0.4: Reconcile SSOT documents and dead references

**Description:** Rút `DESIGN.md`/README về đúng vai trò, sửa numeric/alias contradiction và xóa link tới tài liệu không tồn tại.

**Acceptance criteria:**
- [ ] Một value chỉ được canonical ở `tokens.json`.
- [ ] `DESIGN.md` không tự tạo numeric standard cạnh tranh với `STANDARD.md`.
- [ ] 0 link tới `daft.md`, old icon-system directories hoặc showcase output trong docs path.

**Verification:**
- [ ] Search toàn repo cho stale paths trả 0 ngoài history/roadmap record.
- [ ] `git diff --check` pass.

**Dependencies:** Task 0.3.

**Files likely touched:**
- `docs/design-system/DESIGN.md`
- `src/shared/styles/README.md`
- `src/shared/styles/STANDARD.md`
- `docs/0-wiki.md`
- `.agents/skills-reference/mockup-first/SKILL.md`

**Estimated scope:** M.

### Task 0.5: Automate showcase taxonomy and discovery

**Description:** Thay thế phân loại dựa trên `CANONICAL_META` cứng bằng inference từ đường dẫn và `showcaseMeta`. Showcase tự động phát hiện và xếp component mới đúng tầng foundation/atom/molecule/organism/template/page mà không cần sửa danh sách hardcoded.

**Acceptance criteria:**
- [x] Mọi `.showcase.tsx` mới được discover tự động qua `import.meta.glob` mở rộng hoặc convention hiện tại.
- [x] Level được suy ra từ đường dẫn trước, `showcaseMeta.level` sau, `CANONICAL_META` chỉ còn override cho trường hợp đặc biệt (hidden, deprecated, experimental rename).
- [x] Category được suy ra từ `showcaseMeta.category` hoặc pattern tên file; category không xác định rơi vào `Other` thay vì gây unclassified.
- [x] Các vị trí component được hỗ trợ: `src/shared/ui/`, `src/shared/domain/*/atoms/`, `src/features/*/ui/`, `src/features/*/molecules/`, `src/features/*/organisms/`, `src/entrypoints/design-system-showcase/pages/`, `src/entrypoints/design-system-showcase/templates/`.
- [x] Component thiếu `.showcase.tsx` vẫn render `MissingShowcasePlaceholder` với metadata đúng level/category.

**Verification:**
- [x] Thêm file `.showcase.tsx` test trong từng vị trí, rebuild showcase và xác minh navigation đặt đúng level/category.
- [x] `npm run build` và `npm run build:design-system` pass sau khi sửa `autoDiscovery.ts`.
- [x] Số lượng `unclassified` giảm về 0; `CANONICAL_META` chỉ còn <10 override.

**Dependencies:** Task 0.2.

**Files touched:**
- `src/entrypoints/design-system-showcase/autoDiscovery.ts`
- `src/entrypoints/design-system-showcase/autoDiscovery.logic.ts`
- `src/entrypoints/design-system-showcase/ShowcaseGallery.tsx`
- `tests/unit/entrypoints/design-system-showcase/autoDiscovery.test.ts`
- `docs/2-architechture-system.md`
- `docs/0-wiki.md`

**Estimated scope:** M.

### Checkpoint A — Repository boundary

- [ ] Showcase source/build/docs có ba trách nhiệm tách biệt.
- [ ] Build không repopulate docs.
- [ ] 0 dead Design System link.
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build`, `npx vite build --mode development` đã chạy; pre-existing failure nếu có được phân biệt bằng evidence.
- [ ] Anh yêu review cleanup diff trước khi tiếp tục.

## Phase 1 — Deterministic quality gates

### Task 1.1: Replace noisy M3 shell audit with scoped parser audit

**Description:** Spike parser-based CSS policy trên `src/shared/ui`; so sánh precision với audit shell hiện tại trước khi chọn Stylelint plugin/config hoặc Node checker nhỏ.

**Acceptance criteria:**
- [x] Detector phân biệt production, showcase, mock-site và documented exceptions.
- [x] Detect hardcoded color/spacing/radius/z-index và undefined token theo Cell rules, không theo M3 visual language.
- [ ] False-positive rate <5% trên sample review tối thiểu 100 findings hoặc toàn scope nếu ít hơn.

**Verification:**
- [x] Có fixture good/bad cho mỗi policy.
- [x] Command trả exit code 1 chỉ với actionable violation.
- [x] Dependency mới, nếu có, đã kiểm tuổi phiên bản, install size và dev-only impact.

**Dependencies:** Checkpoint A.

**Files likely touched:**
- `package.json`
- lockfile
- parser/lint config hoặc `scripts/check-design-system-css.mjs`
- focused test fixtures

**Estimated scope:** M.

### Task 1.2: Extend icon integrity gate

**Description:** Mở rộng icon QC từ geometry sang file↔catalog integrity và semantic metadata.

**Acceptance criteria:**
- [x] Mỗi SVG có đúng một catalog entry.
- [x] Mỗi catalog entry trỏ tới SVG tồn tại và có tags không rỗng.
- [x] Duplicate normalized SVG content bị flag.

**Verification:**
- [x] Existing 90 icons pass.
- [x] Fixtures missing-entry, dead-entry, empty-tags, duplicate fail đúng lý do.

**Dependencies:** Checkpoint A.

**Files likely touched:**
- `scripts/check-icons.js`
- icon-check test file

**Estimated scope:** S.

### Task 1.3: Establish Playwright showcase suite

**Description:** Tạo test directory/fixture thật, start showcase server tự động và kiểm critical navigation/theme/component interactions.

**Acceptance criteria:**
- [x] `npm run test:e2e` không còn trỏ tới empty directory.
- [x] Fixture đợi font/app readiness, không dùng sleep tùy ý.
- [x] Light/dark và component route chính có deterministic assertions.

**Verification:**
- [x] Playwright suite pass hai lần liên tiếp local.
- [x] Trace giữ khi retry/failure.

**Dependencies:** Task 0.2.

**Files likely touched:**
- `playwright.config.ts`
- `e2e/showcase.fixture.ts`
- `e2e/showcase.spec.ts`
- `package.json`

**Estimated scope:** M.

### Task 1.4: Establish Chromium extension E2E fixture

**Description:** Load built extension bằng Playwright bundled Chromium persistent context theo official extension workflow; test popup/service-worker/content-script smoke flow.

**Acceptance criteria:**
- [x] Extension ID lấy từ service worker, không hardcode.
- [x] Test build artifact, không test source server giả.
- [x] Ít nhất popup open và một mock-page content-script flow pass.

**Verification:**
- [x] Headless bundled Chromium pass local.
- [x] Failure lưu trace/screenshot.

**Dependencies:** Tasks 1.3 và successful production build.

**Files likely touched:**
- `e2e/extension.fixture.ts`
- `e2e/extension.spec.ts`
- `playwright.config.ts`
- `package.json`

**Estimated scope:** M.

### Task 1.5: Add required CI quality pipeline

**Description:** Chạy deterministic checks trong pinned environment; manual MCP không nằm trong CI.

**Acceptance criteria:**
- [x] CI chạy typecheck, unit (narrow design-system), production build, development build, token/icon checks và Playwright suites.
- [x] CSS audit chạy non-blocking (166 undefined-token violations cũ cần làm sạch trước khi chuyển blocking gate).
- [x] Failure artifact gồm Playwright report/trace.

**Verification:**
- [x] Workflow file tạo và các command tương ứng pass local.
- [x] Deliberate failing fixture làm Playwright job fail và upload report/trace.

**Dependencies:** Tasks 1.1–1.4.

**Files likely touched:**
- `.github/workflows/design-system-ci.yml`
- `package.json`
- `playwright.config.ts`

**Note:** `npm run test:unit` toàn bộ vẫn có failures ở các suite OCR/dictionary không liên quan T1.5; CI tạm narrow design-system unit để xanh. Nợ xử lý khi làm ổn định test cũ hoặc tách job riêng.

**Estimated scope:** M.

### Checkpoint B — Automated gates

- [ ] CSS/icon/token/browser checks tạo signal actionable.
- [ ] Showcase + extension Playwright pass local và CI.
- [ ] Không có manual-only step được mô tả là merge gate.

## Phase 2 — Accessibility correctness

### Task 2.1: Create one contrast engine

**Description:** Tách contrast/color parsing thành pure module dùng chung cho build và runtime; hỗ trợ hex, rgb, rgba, CSS alpha compositing trong phạm vi token format Cell.

**Acceptance criteria:**
- [x] Một implementation luminance/contrast canonical.
- [x] Normal text 4.5:1; large text 3:1 chỉ qua explicit semantic role.
- [x] Không silently skip pair vì unsupported format.

**Verification:**
- [x] W3C boundary fixtures, alpha fixtures và light/dark/preset tests pass.
- [x] Mọi skipped pair làm test/build fail với token name.

**Dependencies:** Checkpoint B.

**Files touched:**
- `src/shared/lib/contrast.ts` (new canonical engine)
- `src/shared/lib/contrast.test.ts` (W3C/alpha/preset fixtures)
- `src/features/theme/logic/colorGenerator.ts` (re-exports from contrast)
- `src/features/theme/logic/contrastValidator.ts` (runtime facade)
- `src/shared/lib/tokens.ts` (uses contrast helpers)
- `scripts/generate-tokens.js` (build-time validation via jiti)
- `src/shared/styles/tokens.css` (regenerated)

**Estimated scope:** M.

### Task 2.2: Integrate rendered axe checks

**Description:** Thêm `@axe-core/playwright` và scan stable showcase pages/components sau khi mở đúng interactive state.

**Acceptance criteria:**
- [x] Dependency dev-only (`@axe-core/playwright@4.12.1`), không xuất hiện extension production bundle.
- [x] Stable showcase scope (Button, Card, Dialog, Input, Select, Tabs) có 0 axe violation.
- [ ] Shadow DOM representative được scan.

**Verification:**
- [x] `npx playwright test --project=showcase e2e/showcase-axe.spec.ts` pass 6/6.
- [x] `npm run build` + `npm run test:e2e` pass toàn bộ (12/12).
- [x] Production bundle comparison không tăng vì axe (chỉ dùng trong `e2e/`).

**Dependencies:** Tasks 1.3, 1.5, 2.1.

**Files likely touched:**
- `package.json`
- lockfile
- `e2e/a11y.spec.ts`
- Playwright fixture/config

**Estimated scope:** M.

### Task 2.3: Add keyboard, focus and ARIA contracts

**Description:** Kiểm Dialog, Drawer, Sheet, Tabs, Select và subtitle controls bằng keyboard; dùng ARIA snapshots cho semantic structure quan trọng.

**Acceptance criteria:**
- [x] Focus order/trap/restore được assertion (Dialog, Drawer).
- [x] Escape/Enter/Space/Arrow behavior theo component contract (Button, Tabs, Select, Input).
- [x] Stable role/name/order có reviewed ARIA snapshots (Tabs tabIndex/role/aria-selected, Select listbox/aria-activedescendant, Dialog aria-modal/aria-labelledby).

**Verification:**
- [x] `e2e/showcase-keyboard.spec.ts` chạy bằng `keyboard.press`, không gọi handler trực tiếp.
- [ ] `prefers-reduced-motion` scenario pass (ghi nợ T3 visual testing).

**Dependencies:** Task 2.2.

**Files likely touched:**
- `e2e/a11y-keyboard.spec.ts`
- ARIA snapshots
- tối đa ba component source files mỗi remediation slice

**Estimated scope:** M per remediation slice.

### Checkpoint C — Accessibility

- [ ] 0 unsupported/skipped contrast pair.
- [ ] 0 unwaived axe violation trong stable scope.
- [ ] 100% P0 interactive components có keyboard/focus evidence.
- [ ] NVDA + real Chrome manual checklist được chạy ở release checkpoint, không thay automation.

## Phase 3 — Visual and responsive confidence

### Task 3.1: Define representative visual state matrix

**Description:** Chọn state có blast radius cao, tránh snapshot mọi permutation.

**Acceptance criteria:**
- [x] Matrix gồm light/dark, default/hover/focus/disabled/error/open khi applicable.
- [x] P0 scope: Button, Input, Card, Dialog, Tabs, Select (thay Sheet), overlay và page shell gallery.
- [x] Dynamic data/animation được cố định theo test contract (`reducedMotion: 'reduce'`, `waitForTimeout` 100ms cho transitions).

**Verification:**
- [x] Matrix được review qua `e2e/visual-matrix.ts` và generate baselines.

**Dependencies:** Checkpoint C.

**Files likely touched:**
- `e2e/visual-matrix.ts`
- `docs/design-system/ROADMAP.md` nếu baseline metric đổi

**Estimated scope:** S.

### Task 3.2: Add Playwright visual baselines

**Description:** Dùng `toHaveScreenshot()` trong pinned CI environment; update baseline luôn qua review.

**Acceptance criteria:**
- [x] P0 matrix có approved baseline (22 snapshots trong `e2e/__snapshots__/showcase/showcase-visual.spec.ts/`).
- [x] Snapshot path bao gồm project context (`showcase`) qua `snapshotPathTemplate`.
- [x] Tolerance hạn chế (`maxDiffPixelRatio: 0.02`, `threshold: 0.2`).

**Verification:**
- [x] Deliberate visual change tạo diff dễ đọc.
- [ ] Ba CI runs liên tiếp không flake (ghi nợ khi chạy trên CI Linux khác Windows).

**Dependencies:** Task 3.1.

**Files likely touched:**
- `e2e/visual.spec.ts`
- snapshot files
- Playwright config

**Estimated scope:** M.

### Task 3.3: Add responsive, zoom and pointer scenarios

**Description:** Test foundation boundaries 320/600/840/1200/1600, 200% zoom/reflow và coarse pointer.

**Acceptance criteria:**
- [x] 0 horizontal overflow ngoài documented exception (7 P0 components × 5 viewports + 200% zoom).
- [x] Fine target ≥40px, coarse target ≥44px cho critical controls (Primary/Large buttons ≥40px; Large button 48px do size="lg").
- [x] Responsive test assertion dựa trên available space (scrollWidth/clientWidth), không user-agent sniffing.

**Verification:**
- [x] Automated bounding-box/overflow assertions pass.
- [x] Real browser spot-check ở compact (320) và expanded (1600).

**Dependencies:** Task 3.2.

**Files likely touched:**
- `e2e/responsive.spec.ts`
- Playwright projects/fixtures
- focused component source per failed slice

**Estimated scope:** M.

### Checkpoint D — Visual confidence

- [ ] P0 visual matrix pass.
- [ ] Snapshot flake <1% mục tiêu sau 30 runs; ghi baseline nếu chưa đủ 30 runs.
- [ ] Responsive/zoom/pointer matrix pass.

## Phase 4 — Component and pattern productization

### Task 4.1: Generate public component inventory

**Description:** Derive export, test, showcase, status và usage count từ source thay cho plan 79 atom cũ.

**Acceptance criteria:**
- [ ] 100% public exports có level/status/test/showcase/usage metadata hoặc exemption.
- [ ] Inventory phát hiện orphan showcase, missing test/showcase và zero-consumer stable export.
- [ ] Output được generate, không chỉnh tay.

**Verification:**
- [ ] Known BottomSheet/ErrorBoundary/Sheet gaps xuất hiện đúng.
- [ ] Deliberate missing metadata làm command fail.

**Dependencies:** Checkpoint B.

**Files likely touched:**
- inventory script
- inventory test
- `src/entrypoints/design-system-showcase/autoDiscovery.ts`
- `package.json`

**Estimated scope:** M.

### Task 4.2: Close stable component evidence gaps

**Description:** Bổ sung test/showcase hoặc exemption; audit states cho component có production consumer trước.

**Acceptance criteria:**
- [ ] 100% stable visual public export có showcase + behavior test.
- [ ] Non-visual exports có documented exemption.
- [ ] Applicable states có behavior/a11y/visual evidence.

**Verification:**
- [ ] Inventory gate pass.
- [ ] Targeted tests + showcase Playwright pass sau mỗi tối đa ba components.

**Dependencies:** Task 4.1.

**Files likely touched:** Tối đa ba component families mỗi slice.

**Estimated scope:** M per slice.

### Task 4.3: Productize only proven UX patterns

**Description:** Trích pattern từ production flows: loading, empty, error recovery, search→result, form submit, subtitle acquisition, vocabulary capture.

**Acceptance criteria:**
- [ ] Mỗi pattern có problem, when/when-not, anatomy, states, a11y và production consumer.
- [ ] Pattern showcase compose existing components; không tạo visual language mới.
- [ ] Không thêm pattern không có consumer thật.

**Verification:**
- [ ] Pattern Playwright behavior/a11y tests pass.
- [ ] Human validates flow, không chỉ screenshot.

**Dependencies:** Task 4.2.

**Files likely touched:**
- showcase pattern source/glob
- representative production consumer only if convergence is needed
- pattern tests

**Estimated scope:** M per pattern.

### Checkpoint E — Productized library

- [ ] Không còn stable visual export thiếu evidence.
- [ ] Pattern catalog chỉ chứa proven production patterns.
- [ ] Không đặt target tăng component count.

## Phase 5 — Governance and evolution

### Task 5.1: Define lifecycle and contribution contract

**Description:** Ghi flow experimental→stable→deprecated→removed, contribution requirements và breaking-change migration trong existing operational docs.

**Acceptance criteria:**
- [ ] Component/token mới cần reuse-gap evidence, showcase, tests và owner.
- [ ] Breaking change có migration note + deprecation window.
- [ ] ADR chỉ dùng cho quyết định khó đảo ngược, không cho CSS tweak.

**Verification:**
- [ ] Một example proposal được dry-run qua checklist.

**Dependencies:** Checkpoint E.

**Files likely touched:**
- `docs/design-system/DESIGN.md`
- `docs/design-system/ROADMAP.md`
- optional ADR nếu tool/governance decision đủ lớn

**Estimated scope:** S.

### Task 5.2: Add Design System health report

**Description:** Báo adoption, undefined/unused tokens, hardcoded drift, missing evidence, visual flake và bundle impact từ machine data.

**Acceptance criteria:**
- [ ] Report không require manual counting.
- [ ] Shared UI adoption target ≥95% hoặc documented exception.
- [ ] Undefined token = 0; zero-consumer stable API được flag.

**Verification:**
- [ ] CI publish report artifact.
- [ ] Deliberate violation xuất hiện trong report và gate phù hợp.

**Dependencies:** Tasks 1.1, 4.1, 5.1.

**Files likely touched:**
- health-report script
- script test
- `package.json`
- CI workflow

**Estimated scope:** M.

### Task 5.3: Re-audit maturity and accept release

**Description:** Chấm lại cùng rubric 100 điểm; không thay denominator để làm score đẹp.

**Acceptance criteria:**
- [ ] Operational maturity ≥85/100.
- [ ] Mọi Phase exit criterion có evidence link.
- [ ] Remaining gaps có owner, severity và next review date.

**Verification:**
- [ ] Full commands và browser checks pass.
- [ ] Fresh-context adversarial review hoàn tất.
- [ ] Anh yêu approve release state.

**Dependencies:** All previous tasks.

**Files likely touched:**
- `docs/design-system/ROADMAP.md`
- `docs/0-wiki.md`

**Estimated scope:** S.

## 5. Required final verification

```bash
npm run typecheck
npm run test:unit
npm run build
npx vite build --mode development
npm run build:design-system
npm run test:e2e
npm run lint
```

Ngoài command:

- Built showcase loads without 404.
- Bundled Chromium extension E2E pass.
- Real Chrome release smoke pass qua project browser workflow.
- Light/dark, reduced motion, keyboard, 200% zoom/reflow và coarse pointer pass.
- `git diff --check` pass.
- `docs/0-wiki.md` và `docs/2-architechture-system.md` phản ánh cây file thật.

## 6. Parallelization

### Safe after Checkpoint A

- Task 1.1 CSS audit spike và Task 1.2 icon gate.
- Task 1.3 showcase Playwright có thể chạy song song với 1.1/1.2.
- Task 4.1 inventory có thể bắt đầu sau quality-gate contract ổn định.

### Must stay sequential

- Task 0.2 trước 0.3: đổi build destination trước khi xóa generated output.
- Task 2.1 trước 2.2/2.3: contrast correctness trước a11y acceptance.
- Task 3.1 trước visual baselines.
- Task 4.1 trước closing component gaps.
- Task 5.3 cuối cùng.

### Coordination rule

Không giao hai agent sửa cùng một file shared (`package.json`, Playwright config, `ROADMAP.md`, token generator) cùng lúc.

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Showcase build vẫn copy toàn `public/` vào dist | Build lớn/chậm | Kiểm output; nếu cần dùng explicit asset allowlist |
| Deleting stale docs loses unique contract | Knowledge loss | Extract surviving contract first; exact approval; Git history remains |
| CSS parser tool becomes another noisy gate | Team ignores gate | Spike on bounded scope; require <5% false positives |
| Screenshot flakes by OS/font/animation | Untrusted visual tests | Pin environment/font/browser; stable readiness; representative matrix |
| axe gives false sense of full WCAG compliance | A11y gaps | Keyboard, ARIA snapshots và manual NVDA remain required |
| Extension flags differ from real Chrome | CI/runtime mismatch | Bundled Chromium deterministic E2E + real-Chrome release smoke |
| Jest→Vitest migration expands scope | Delays core roadmap | Benchmark only; no migration task in this plan |
| 403-test suite contains pre-existing failures | Blocks unrelated phase | Capture baseline; distinguish regression; do not weaken gates silently |
| Tool dependency adds supply-chain risk | Security/bloat | Dev-only, release age ≥7 days, lockfile, size/license review |

## 8. Explicitly out of scope

- Redesigning Cell visual direction.
- Adopting Material 3 token names or visual style.
- Figma/Code Connect integration before operational maturity ≥85.
- Building components to reach a numeric inventory target.
- Replacing all unit tests with browser tests.
- Supporting Chrome Android as an extension runtime.
- Deleting ADR history.
- Performing any cleanup deletion without new explicit confirmation.

## 9. Approval gate

Before implementation, Anh yêu reviews:

1. Binding decisions.
2. Cleanup manifest in Task 0.1.
3. Phase order and scope.
4. Permission for any new dev dependency.
5. Which task/phase to start.
