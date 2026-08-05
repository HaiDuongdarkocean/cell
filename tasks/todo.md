# Player Mode Prototype Tasks

- [x] Task 1: Define pure Player Mode geometry/state contract
  - Acceptance: mode toggle state, dock height, viewport bounds, and dictionary sheet clamp are typed/pure and cover 320px/480px edge cases.
  - Verify: focused unit tests pass; `npm run typecheck`.
  - Files: subtitle logic/types and tests only.
  - Dependencies: None.

- [x] Task 2: Build the fixed Player Mode shell and bottom Player Action Dock
  - Acceptance: VideoStage, empty ContentOther, and PlayerActionDock render only when active; SubtitleBlock is above NavCluster; host caption layer remains independent.
  - Verify: component tests; `npm run build`.
  - Files: subtitle UI components/CSS and tests, max 5 files.
  - Dependencies: Task 1.

- [x] Task 3: Move toolbar actions without losing current functionality
  - Acceptance: player-mode button uses the old generate-native slot; generate-native remains reachable under tools toggle; all existing callbacks remain wired.
  - Verify: component tests query each `data-cell-id`; `npm run typecheck` and `npm run build`.
  - Files: `SubtitlePanels.tsx`, related test/CSS.
  - Dependencies: Task 2.

- [x] Task 4: Integrate resizable Dictionary sheet above the dock
  - Acceptance: lookup opens the existing Dictionary behavior; sheet can resize with Pointer Events; min/max clamp leaves PlayerActionDock visible; Escape and close work.
  - Verify: geometry/component tests; `npm run test:unit`; `npm run build`.
  - Files: dictionary positioning integration, subtitle shell/CSS, tests.
  - Dependencies: Task 2.

- [x] Task 5: Responsive polish and accessibility
  - Acceptance: 320px, 480px, tablet, desktop, safe-area, reduced-motion, focus, and no-subtitle states work without overflow or inaccessible controls.
  - Verify: `npm run typecheck`, `npm run test:unit`, `npm run build`, `npx vite build --mode development`.
  - Files: relevant CSS/tests only.
  - Dependencies: Tasks 3–4.

- [x] Task 6: Real browser prototype verification
  - Acceptance: extension loads in stealth Chrome; verify Player Mode on/off, simultaneous captions, dictionary resize/coverage, and all actions at required breakpoints.
  - Verify: `testing-extension-browser` + `browser-testing-with-devtools`; record pass/fail evidence.
  - Files: no source changes unless a defect is found.
  - Dependencies: Task 5.
  - Evidence: VidNest live browser verified video top alignment, dock composition, and host-style restore; Dictionary bounds verified by unit test because this page exposed no Cell subtitle cue to trigger a live lookup.

## Checkpoints

- After Tasks 1–2: shell renders and tests/build pass.
- After Tasks 3–4: full core flow works with tools and dictionary.
- After Tasks 5–6: responsive/accessibility and real-browser verification pass.
