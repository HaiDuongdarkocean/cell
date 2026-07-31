# Todo: Design System Library — Foundations + Atoms

> Spec: `docs/specs/spec-design-system-library-foundations-atoms.md`
> Plan: `tasks/plan.md`

## Phase 1 — Contract and discovery

- [ ] **Task 1: Define Library metadata contract and normalization**
  - Acceptance: explicit `level` (`foundations`/`atoms`), `category`, `description`, `status`; no silent level inference.
  - Verify: discovery tests.
  - Files: `src/entrypoints/design-system-showcase/autoDiscovery.ts`, tests.

- [ ] **Task 2: Migrate Foundation and Atom showcase metadata**
  - Acceptance: Color/Spacing are Foundations; eligible primitives are Atoms; categories are UI-intent based.
  - Verify: metadata coverage check + build.
  - Files: `src/shared/ui/*.showcase.tsx`.

### Checkpoint: Taxonomy

- [ ] `npm run typecheck`
- [ ] Discovery/grouping tests
- [ ] No active item relies only on technical source group

## Phase 2 — Library shell

- [ ] **Task 3: Level → category navigation**
  - Acceptance: Foundations/Atoms active; Molecules/Organisms/Templates/Pages disabled with `Coming later`.
  - Verify: DOM/component tests.
  - Files: `ShowcaseGallery.tsx`, discovery helpers, tests.

- [ ] **Task 4: Library copy and search**
  - Acceptance: title `Design System Library`; search `Search library...`; result copy says items; search matches title/category/level/description.
  - Verify: tests + browser DOM check.
  - Files: `App.tsx`, `ShowcaseGallery.tsx`, CSS/tests.

### Checkpoint: Library shell

- [ ] Search works without flattening hierarchy.
- [ ] Higher levels disabled/non-interactive.
- [ ] Light/dark preserves hierarchy.

## Phase 3 — Level-specific presentation

- [ ] **Task 5: Foundation specimens**
  - Acceptance: Color/Spacing use foundation presentation; Foundations appear before Atoms.
  - Verify: browser check.
  - Files: gallery + CSS + foundation showcase files if needed.

- [ ] **Task 6: Atom catalog cards**
  - Acceptance: compact responsive cards with title/category/level/status/preview; no mislabeled uncertain compositions.
  - Verify: browser at 320/768/1024/1280px.
  - Files: gallery + CSS + atom showcases if needed.

### Checkpoint: Visual system

- [ ] Foundation and Atom presentation visibly distinct.
- [ ] Required responsive breakpoints pass.
- [ ] New UI uses tokens only.

## Phase 4 — Verification and docs

- [ ] **Task 7: Tests and architecture docs**
  - Acceptance: discovery/grouping/filter tests; architecture tree/function index updated; wiki index updated if needed.
  - Verify: `npm run test:unit`, `npm run typecheck`, `npm run build`.
  - Files: tests, `docs/2-architechture-system.md`, `docs/0-wiki.md`.

- [ ] **Task 8: Browser review and final quality pass**
  - Acceptance: Chrome DevTools confirms taxonomy, copy, disabled roadmap, light/dark, and no new console errors.
  - Verify: Chrome DevTools MCP + `npm run build`.
  - Files: fixes discovered during verification only.
