# Todo: Liquid-Glass Button System

> Intent: `docs/intent/liquid-glass-buttons.md`  
> Spec: `docs/specs/liquid-glass-buttons.md`  
> Plan: `tasks/plan-liquid-glass-buttons.md`

## Phase 0 — Baseline and RED guards

- [ ] T1: Capture Button/IconButton/subtitle baseline
  - AC: Public props, variant/size/orientation matrix, subtitle native-action mapping, refs/ARIA/data hooks and overlay overrides are covered or documented in tests.
  - Verify: targeted existing unit tests pass before visual changes.
  - Files: shared UI tests + missing subtitle tests only.
  - Dependencies: none.
  - Scope: M.

- [ ] T2: Add failing style-contract guards
  - AC: RED tests/guards detect current idle drift, hover lift, missing radius-zero geometry and broad overlay material overrides without asserting exact pixels.
  - Verify: demonstrate intended failures before implementation.
  - Files: 1–2 test/guard files.
  - Dependencies: T1.
  - Scope: S.

## Phase 1 — V4 visual contract

- [ ] T3: Add V4 geometry matrix
  - AC: IconButton examples circular; horizontal buttons capsule; vertical/full-width examples radius 0; no clipping at 320/768/1280px.
  - Verify: DevTools computed width/height/radius.
  - Files: `liquid-glass-dewdrop-v4.html`.
  - Dependencies: T2.
  - Scope: S.

- [ ] T4: Calibrate light/dark/protected-overlay material in V4
  - AC: Neutral material across variants; no semantic color, idle animation, lift or animated blur; readable on white/black/gradient/pattern/photos.
  - Verify: Chrome + Edge runtime inspection and human review.
  - Files: V4 mockup only.
  - Dependencies: T3.
  - Scope: S.

### Checkpoint A — Blocking human approval

- [ ] Geometry approved.
- [ ] Light material approved.
- [ ] Dark material approved.
- [ ] Protected overlay material approved.
- [ ] Radius-zero vertical/full-width approved.
- [ ] Optical values frozen for token promotion.

## Phase 2 — Shared UI foundation

- [ ] T5: Promote approved tokens to `tokens.json`
  - AC: Component roles generated for light/dark; protected overlay final tokens can be scoped; no raw material values in component CSS.
  - Verify: token generation deterministic; `npm run build` pass.
  - Files: `tokens.json` + generated artifacts.
  - Dependencies: Checkpoint A.
  - Scope: S.

- [ ] T6: Implement shared Button liquid material
  - AC: API compatible; variants neutral; horizontal capsule; vertical/full-width radius 0; no idle drift/lift; states and ripple preserved; concurrent ripple bounded.
  - Verify: Button tests/showcase + reduced-motion/transparency.
  - Files: `Button.tsx`, `.module.css`, `.test.tsx`, `.showcase.tsx`.
  - Dependencies: T5.
  - Scope: M.

- [ ] T7: Implement shared IconButton liquid material
  - AC: Every size square/circular; material matches Button; loading/active/focus/touch behavior preserved.
  - Verify: IconButton tests and browser showcase.
  - Files: IconButton CSS/tests; TS only if approved API change is necessary.
  - Dependencies: T5.
  - Scope: M.

### Checkpoint B — Shared UI

- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] 254 shared Button/IconButton usages compile.
- [ ] No infinite animation or hover lift remains.

## Phase 3 — Subtitle migration

- [ ] T8: Migrate SubtitleSearch API action and tabs
  - AC: API Add key/Hide uses Button; Target/Native uses controlled Tabs; count badges/handlers/ARIA/data hooks unchanged; result option stays native.
  - Verify: SubtitleSearchPanel tests + keyboard navigation.
  - Files: TSX, CSS module, tests.
  - Dependencies: Checkpoint B.
  - Scope: M.

- [ ] T9: Migrate SubtitleManager step and back actions
  - AC: Latency decrement/increment use Button; header back uses IconButton with ref; offset math/focus/save/data hooks unchanged; track option stays native.
  - Verify: SubtitleManagerPanel tests.
  - Files: TSX, CSS module, tests.
  - Dependencies: Checkpoint B.
  - Scope: M.

- [ ] T10: Migrate NavCluster preset pills
  - AC: Presets use Button; `aria-pressed` and layout unchanged; alignment/shadow radios remain native; active material is neutral.
  - Verify: appearance tests + responsive wrap.
  - Files: NavClusterSettingsPanel TSX/CSS/test.
  - Dependencies: Checkpoint B.
  - Scope: S.

## Phase 4 — Overlay ownership

- [ ] T11: Refactor NavCluster material ownership
  - AC: Cluster size/icon/text opacity settings remain; shared IconButton owns material; no broad background/material selector.
  - Verify: NavCluster tests + real-overlay computed styles.
  - Files: NavCluster TSX/CSS/test.
  - Dependencies: T7.
  - Scope: M.

- [ ] T12a: Refactor Right Toolbar shared geometry/material boundary
  - AC: ClusterRightToolbar actions receive protected shared material; expansion and placement unchanged.
  - Verify: toolbar tests/computed styles.
  - Files: ClusterRightToolbar + shared CSS + tests.
  - Dependencies: T7, T11.
  - Scope: M.

- [ ] T12b: Sync Player Mode and OverlayPreview consumers
  - AC: Touch target/icon scaling preserved; preview and Player Mode match production material; no broad material override.
  - Verify: PlayerMode/OverlayPreview tests and browser comparison.
  - Files: PlayerMode/OverlayPreview CSS/tests only as required.
  - Dependencies: T12a.
  - Scope: M.

### Checkpoint C — Subtitle overlay

- [ ] Confirmed action/tab migrations pass.
- [ ] Semantic list/radio controls remain non-glass.
- [ ] NavCluster and Right Toolbar use protected shared material.
- [ ] Touch geometry and user appearance settings remain unchanged.

## Phase 5 — Verification and docs

- [ ] T13: Browser/accessibility/performance verification
  - AC: Chrome and Edge; light/dark/video; 320/480/768/1024/1280; contrast/focus/touch/reduced settings pass; no sustained frame degradation or console error.
  - Verify: DevTools runtime checks + performance trace; project quality commands.
  - Dependencies: Checkpoint C.
  - Scope: M.

- [ ] T14: Sync architecture and decision docs
  - AC: architecture index and wiki reflect final source/docs; ADR-092 relationship documented.
  - Verify: links resolve and final build remains clean.
  - Files: `docs/2-architechture-system.md`, `docs/0-wiki.md`, ADR if required.
  - Dependencies: T13.
  - Scope: S.

## Final quality gate

```text
npm run typecheck
npm run test:unit
npm run lint
npm run build
npx vite build --mode development
```

- [ ] All commands pass.
- [ ] V4 and production match approved visual contract.
- [ ] No unrelated source changes.
- [ ] Ready for code review; do not commit without explicit user request.
