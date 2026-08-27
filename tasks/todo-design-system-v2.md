# Cell Design System v2 — Execution Checklist

> Plan: `tasks/plan-design-system-v2.md`  
> Canonical audit/roadmap: `docs/design-system/ROADMAP.md`  
> Không chạy checklist cũ `todo-design-system-enforcement.md` hoặc `todo-foundation-v1.md` song song.

## Phase 0 — Trust and repository boundary

- [ ] **T0.1 Approve cleanup manifest**
  - [ ] Manifest có delete/move/keep/generated và dependency proof.
  - [ ] Anh yêu xác nhận exact destructive paths.
- [x] **T0.2 Make showcase build single-path and disposable**
  - [x] Main build không ghi vào docs.
  - [x] Standalone build/preview chạy từ `dist/design-system-showcase/`.
- [ ] **T0.3 Clean and reorganize design-system docs**
  - [ ] Root chỉ còn DESIGN, ROADMAP, guides.
  - [ ] Không có build/public artifacts trong docs.
- [ ] **T0.4 Reconcile SSOT documents and dead references**
  - [ ] Một numeric value có một canonical source.
  - [ ] Dead Design System links = 0.
- [x] **T0.5 Automate showcase taxonomy and discovery**
  - [x] New `.showcase.tsx` files auto-classify without editing `CANONICAL_META`.
  - [x] Path-based level inference works for all component locations.
  - [x] Category inference from filename or `showcaseMeta` works.
  - [x] `CANONICAL_META` reduced to override/special cases only.

### Checkpoint A

- [ ] Showcase source/build/docs tách trách nhiệm.
- [ ] Builds không repopulate docs.
- [ ] Typecheck, unit, production build, development build đã chạy.
- [ ] Anh yêu review cleanup diff.

## Phase 1 — Deterministic quality gates

- [x] **T1.1 Replace noisy M3 shell audit with scoped parser audit**
  - [x] Cell-specific parser gate có fixtures.
  - [ ] False-positive rate <5% trên reviewed sample.
- [x] **T1.2 Extend icon integrity gate**
  - [x] SVG ↔ catalog 1:1.
  - [x] Tags bắt buộc; duplicate SVG bị phát hiện.
- [x] **T1.3 Establish Playwright showcase suite**
  - [x] `npm run test:e2e` chạy test thật.
  - [x] Theme/navigation/critical interaction pass hai lần liên tiếp.
- [x] **T1.4 Establish Chromium extension E2E fixture**
  - [x] Dynamic extension ID từ service worker.
  - [x] Popup + content-script mock flow pass.
- [x] **T1.5 Add required CI quality pipeline**
  - [x] CI chạy typecheck, design-system unit, production build, development build, icon/token/CSS checks và Playwright suites.
  - [x] Deliberate failing fixture làm job fail và lưu report/trace.

### Checkpoint B

- [ ] CSS/icon/token checks tạo actionable signal.
- [ ] Showcase + extension Playwright pass local và CI.
- [ ] Manual MCP không bị mô tả là merge gate.

## Phase 2 — Accessibility correctness

- [x] **T2.1 Create one contrast engine**
  - [x] Hex/rgb/rgba/alpha supported.
  - [x] Normal 4.5:1; large 3:1 chỉ qua explicit role.
  - [x] Unsupported/skipped pair = 0.
- [x] **T2.2 Integrate rendered axe checks**
  - [x] `@axe-core/playwright` dev-only, không tăng production bundle.
  - [x] Stable scope có 0 unwaived axe violation.
- [x] **T2.3 Add keyboard, focus and ARIA contracts**
  - [x] P0 controls có keyboard/focus assertions (Dialog, Drawer, Button, Tabs, Select, Input).
  - [x] Critical semantics có reviewed ARIA snapshots trong `showcase-keyboard.spec.ts`.

### Checkpoint C

- [ ] 0 skipped contrast pair.
- [ ] 0 unwaived axe violation.
- [ ] 100% P0 interactive components có keyboard/focus evidence.
- [ ] NVDA + real Chrome release checklist tồn tại.

## Phase 3 — Visual and responsive confidence

- [x] **T3.1 Define representative visual state matrix**
  - [x] Human approves P0 light/dark/state matrix (captured in `e2e/visual-matrix.ts`).
- [x] **T3.2 Add Playwright visual baselines**
  - [x] P0 approved snapshots exist in `e2e/__snapshots__/showcase/showcase-visual.spec.ts/`.
  - [x] Deliberate visual change produces readable diff.
- [x] **T3.3 Add responsive, zoom and pointer scenarios**
  - [x] 320/600/840/1200/1600 pass.
  - [x] 200% zoom/reflow pass; touch-target minimum asserted for Primary (>=40) and Large (>=40/48 depending on viewport) buttons.

### Checkpoint D

- [ ] P0 visual matrix pass.
- [ ] Visual flake target <1% after 30 runs or current baseline documented.
- [ ] Horizontal overflow = 0 outside documented exception.

## Phase 4 — Component and pattern productization

- [x] **T4.1 Generate public component inventory**
  - [x] All public exports have metadata/evidence/exemption qua `scripts/generate-component-inventory.mjs`.
  - [x] Missing/orphan/zero-consumer cases detected automatically.
- [x] **T4.2 Close stable component evidence gaps**
  - [x] Slice 1: thêm behavior test cho 3 public export có consumer — SettingsRow, LabelGroup, FooterBar.
  - [x] Slice 2: thêm behavior test cho 3 public export có consumer — SliderRow, SearchableSelect, HintIcon.
  - [x] Slice 3: thêm behavior test cho Breadcrumb, Tree; `missingTest` rỗng.
  - [ ] Ghi nợ: BottomSheet/Sheet là non-public và thiếu showcase — cần quyết định public/export hoặc exemption.
  - [ ] Applicable states have behavior/a11y/visual evidence.
- [~] **T4.3 Productize only proven UX patterns** [in progress]
  - [x] Slice 1: productize Async states pattern (catalog doc + PatternAsyncStates showcase + Playwright a11y/keyboard tests).
  - [x] Slice 2: productize Search → result pattern (PatternSearchResult showcase + Playwright a11y/keyboard tests).
  - [ ] Slices 3-N: productize remaining patterns (form submit, subtitle acquisition, vocabulary capture) where real consumers exist.
  - [ ] Every pattern has production consumer and when/when-not guidance.
  - [ ] Pattern interaction/a11y tests pass.

### Checkpoint E

- [ ] Stable visual export evidence gaps = 0.
- [ ] Pattern catalog contains only proven flows.
- [ ] Component count is not used as a success target.

## Phase 5 — Governance and evolution

- [ ] **T5.1 Define lifecycle and contribution contract**
  - [ ] Experimental→stable→deprecated→removed documented.
  - [ ] Breaking change requires migration note + window.
- [ ] **T5.2 Add Design System health report**
  - [ ] Adoption, drift, token, evidence, flake, bundle metrics generated.
  - [ ] Shared UI adoption ≥95% or documented exceptions.
- [ ] **T5.3 Re-audit maturity and accept release**
  - [ ] Same rubric score ≥85/100.
  - [ ] Fresh-context adversarial review done.
  - [ ] Anh yêu approves release state.

## Final gates

- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] `npx vite build --mode development`
- [ ] `npm run build:design-system`
- [ ] `npm run test:e2e`
- [ ] `npm run lint`
- [ ] Built showcase has no 404.
- [ ] Bundled Chromium extension E2E pass.
- [ ] Real Chrome release smoke pass.
- [ ] Light/dark, reduced motion, keyboard, 200% zoom and coarse pointer pass.
- [ ] `git diff --check` pass.
- [ ] Wiki + architecture map match real tree.
