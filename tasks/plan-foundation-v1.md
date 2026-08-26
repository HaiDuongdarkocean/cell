# Implementation Plan: Cell Foundation v1

## Objective

Turn the current proposed foundation into one lean, accepted, evidence-backed contract. Delete unused legacy decisions and tokens only after all direct, generated, transitive, Shadow DOM, content-script, preset, test, and runtime consumers are accounted for.

## Confirmed decisions

- Direction: **Quiet confidence**.
- Boundary: foundation contains only principles/direction, color, typography, spacing/adaptive density, shape/elevation, layout, iconography, motion, and accessibility.
- Density: one adaptive density; no density selector.
- Accessibility: WCAG 2.2 AA.
- Typography: self-host Inter Variable Latin/Vietnamese; system fallback for other scripts; long-form body 16px, UI/control text 14px, caption minimum 12px.
- Breakpoints: retain `compact/medium/expanded/large/extra-large = 0/600/840/1200/1600`; remove generated CSS custom properties because they cannot drive media queries.
- Removal policy: migrate active consumers first, delete only with evidence of zero remaining consumers; no permanent compatibility aliases.

## Sources of truth after completion

- `src/shared/styles/tokens.json`: canonical token values across foundation, component, preset, and domain layers.
- `src/shared/styles/STANDARD.md`: canonical foundation principles, usage rules, and accessibility contract.
- `docs/adr/084-090`: rationale for each foundation decision.
- `docs/design-system/DESIGN.md`: short agent-facing implementation checklist, not a duplicate numeric specification.
- `src/shared/styles/README.md`: entrypoint and operational instructions, not a second standard.

`tokens.json` may continue to contain active component, preset, and domain tokens. Their presence does not make them foundation. Classification and deletion are based on role plus consumer evidence.

## Dependency order

```text
Consumer/dependency inventory
        ↓
Canonical contract and ADR reconciliation
        ↓
Typography asset + semantic type migration
        ↓
Breakpoint generator cleanup
        ↓
Token-family migration and pruning
        ↓
WCAG 2.2 AA hardening
        ↓
Showcase/browser verification
        ↓
Accept ADRs and remove duplicated docs
```

## Phase 0 — Evidence baseline

### Task 1: Build the token dependency inventory

**Description:** Derive every generated custom property from `tokens.json`, then trace direct and transitive references before classifying anything for removal.

**Acceptance criteria:**
- Every token is classified as `foundation`, `active-component`, `active-domain`, `active-preset`, `migration`, or `delete-candidate`.
- Inventory includes references inside token values, generator hardcoded keys/contrast pairs, `src/shared/lib/tokens.ts`, raw CSS strings, `?raw` Shadow DOM injection, content-script token maps, presets, tests, and showcase code.
- A delete candidate has zero direct and transitive runtime/build/test consumers; docs-only references are recorded separately.

**Verification:**
- Generate tokens successfully before any edit.
- Search for unresolved `var(--*)` references against generated declarations.
- Manually inspect `injectShadowCss.ts`, `tokenSpanCss.ts`, theme preset flow, and component-token references.

**Likely files inspected:**
- `src/shared/styles/tokens.json`
- `scripts/generate-tokens.js`
- `src/shared/lib/tokens.ts`
- `src/shared/lib/shadowRoot/injectShadowCss.ts`
- `src/features/tokenize/ui/tokenSpanCss.ts`

**Dependencies:** None.

### Task 2: Capture baseline behavior

**Description:** Record the current build status and representative foundation visuals so later deletion can be compared against a known baseline.

**Acceptance criteria:**
- Light/dark foundation showcase captured at compact, medium, and expanded widths.
- Popup, sidepanel, options/showcase, one Shadow DOM subtitle UI, and one dictionary/content-script UI are included.
- Existing failures are separated from regressions introduced by foundation work.

**Verification:**
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npx vite build --mode development`
- Browser inspection through the project browser-testing workflow.

**Dependencies:** Task 1.

## Checkpoint A — No deletion yet

- Token dependency inventory is reviewable.
- Baseline build and browser behavior are known.
- Anh approves the `delete-candidate` list before destructive pruning begins.

## Phase 1 — Canonical foundation contract

### Task 3: Make `STANDARD.md` the concise foundation contract

**Description:** Add the confirmed quiet-confidence principles, foundation boundary, one adaptive-density rule, typography baseline, breakpoint policy, and WCAG 2.2 AA acceptance rules. Remove contradictory or speculative guidance from the standard.

**Acceptance criteria:**
- A designer/agent can decide whether a value belongs in foundation without consulting duplicated tables elsewhere.
- The standard distinguishes foundation tokens from active component/domain/preset tokens.
- No new design-principles, design-direction, density, or state-system ADR is created.

**Likely files touched:**
- `src/shared/styles/STANDARD.md`

**Dependencies:** Tasks 1-2.

### Task 4: Reconcile ADR-084 through ADR-090

**Description:** Update the seven ADRs to match confirmed decisions and current implementation direction while preserving their historical rationale.

**Acceptance criteria:**
- Typography states Inter self-hosting, 16px long-form body, 14px UI, caption ≥12px, and actual chosen weight tokens.
- Grid ADR uses `0/600/840/1200/1600` and explicitly says CSS custom properties are not a media-query API.
- Color, spacing, shape/elevation, motion, and icon values match the selected canonical contract.
- ADR status remains `Proposed` until final showcase/browser verification.

**Likely files touched:**
- `docs/adr/084-foundation-color-system.md`
- `docs/adr/085-foundation-typography.md`
- `docs/adr/086-foundation-spacing.md`
- `docs/adr/087-foundation-shape-elevation.md`
- `docs/adr/088-foundation-motion.md`
- `docs/adr/089-foundation-iconography.md`
- `docs/adr/090-foundation-grid-breakpoints.md`

**Dependencies:** Task 3.

## Phase 2 — Typography and responsive primitives

### Task 5: Add the production Inter font asset

**Description:** Obtain Inter Variable from its official distribution, retain its license, subset to Latin/Vietnamese, and load it locally with `font-display: swap`; retain system fallbacks for other scripts.

**Acceptance criteria:**
- No CDN or remotely hosted font is required by the MV3 extension.
- License/source is traceable and the built font payload is measured.
- Fallback remains readable when the font is blocked or while it loads.
- The font is available in normal entrypoints and injected Shadow DOM contexts without duplicate downloads.

**Verification:**
- DevTools Network confirms local load and no remote request.
- Browser renders Vietnamese diacritics and falls back correctly for CJK.
- Build output records the font asset size.

**Dependencies:** Task 4.

### Task 6: Migrate semantic typography roles

**Description:** Make long-form body, UI/control, and caption roles explicit; migrate consumers before removing contradictory aliases or values.

**Acceptance criteria:**
- Long-form content resolves to 16px, UI/control text to 14px, and caption to at least 12px.
- No active consumer depends on the old ambiguous role being removed.
- `responsiveTypography` entries are either retained with a documented role and consumer or removed by Task 1 evidence.

**Verification:**
- Typography showcase in light/dark and at 200% zoom.
- Zero undefined typography variables.
- Unit/build checks pass.

**Dependencies:** Task 5.

### Task 7: Remove the dead breakpoint CSS API

**Description:** Keep breakpoint values in JSON and the existing TypeScript contract, but stop generating `--breakpoint-*` CSS custom properties after confirming zero consumers.

**Acceptance criteria:**
- `scripts/generate-tokens.js` no longer emits breakpoint custom properties.
- `src/shared/lib/tokens.ts` remains aligned with `0/600/840/1200/1600`.
- Shared/global responsive rules use the approved breakpoint policy; feature-local content thresholds are not blindly replaced.
- No CSS/TS consumer references `var(--breakpoint-*)`.

**Verification:**
- Token generation is idempotent.
- Search for `--breakpoint-` consumers returns zero outside historical docs.
- Responsive browser checks pass at each boundary.

**Dependencies:** Task 4.

## Checkpoint B — Typography and layout

- Font loading, semantic type roles, zoom/reflow, and breakpoint boundaries pass in browser.
- Build and unit tests pass before token pruning expands.

## Phase 3 — Token pruning by family

### Task 8: Reconcile and prune color tokens

**Description:** Resolve primitive/semantic color aliases and remove only evidence-backed dead colors. Keep used preset, learning-frequency, syntax, data, glass, liquid, and domain colors classified outside foundation when they have real consumers.

**Acceptance criteria:**
- Every remaining foundation color has a unique semantic role.
- Active component/domain/preset colors remain functional but are not documented as universal foundation roles.
- Deleted colors have zero transitive consumers, including generated component tokens and raw CSS maps.

**Dependencies:** Tasks 1, 4.

### Task 9: Reconcile and prune spacing, size, radius, elevation, border, stroke, blur, and z-index

**Description:** Remove aliases and scales that do not earn their keep; preserve context-specific tokens only when consumed.

**Acceptance criteria:**
- Radius guidance and actual token values agree; duplicate semantic names are migrated or removed.
- Touch target remains 40px fine pointer / 44px coarse pointer.
- No z-index, blur, border, or size token remains solely because it might be useful later.

**Dependencies:** Task 8.

### Task 10: Reconcile and prune motion and iconography tokens

**Description:** Keep one purposeful duration/easing/icon-size vocabulary, migrate active consumers, and delete unused variants.

**Acceptance criteria:**
- Motion roles match the accepted ADR and reduced-motion behavior.
- Icon size/stroke/canvas guidance agrees across ADR, standard, catalog, and tokens.
- No active icon or animation loses its required token.

**Dependencies:** Task 9.

**Verification for Tasks 8-10:**
- Regenerate tokens after each family.
- Search for undefined custom properties after each family.
- Run targeted unit tests plus `npm run build` after every `src` token change.
- Verify theme presets, subtitle Shadow DOM, dictionary popup, tokenize highlighting, and liquid-glass consumers after relevant families.

## Checkpoint C — Pruning

- Anh reviews the actual deletion diff.
- Every removed token has evidence of zero consumer after migration.
- No compatibility alias remains without an explicit active consumer.

## Phase 4 — Accessibility foundation

### Task 11: Enforce WCAG 2.2 AA in generation and shared styles

**Description:** Correct build-time contrast validation and add shared accessibility behavior that belongs at foundation level.

**Acceptance criteria:**
- Normal text pairs require 4.5:1; large-text 3:1 exceptions are tied to known large semantic roles, not generic secondary text.
- Non-text UI/focus indicators meet 3:1 where applicable.
- Reduced motion, forced-colors fallback, visible focus, 200% zoom/reflow, and pointer-target rules are represented in the foundation contract and shared implementation.
- Semantics/ARIA remain component responsibilities and are audited, not encoded as visual tokens.

**Likely files touched:**
- `scripts/generate-tokens.js`
- `src/shared/styles/tokens.json`
- `src/shared/styles/components.css` or the existing shared accessibility stylesheet
- focused generator/unit tests

**Dependencies:** Tasks 8-10.

### Task 12: Expand the foundation showcase acceptance surface

**Description:** Demonstrate only the final foundation contract and remove obsolete showcase examples that advertise deleted or contradictory values.

**Acceptance criteria:**
- Light/dark, compact/medium/expanded, fine/coarse pointer, reduced-motion, forced-colors, and 200% zoom scenarios are inspectable.
- Showcase distinguishes foundation from component/domain/preset examples.
- No new component architecture is introduced.

**Dependencies:** Task 11.

## Phase 5 — Documentation consolidation and acceptance

### Task 13: Remove duplicated documentation

**Description:** Shorten `README.md` and `DESIGN.md` into entry/checklist documents that point to `STANDARD.md` and `tokens.json`; remove stale numeric tables and migration sections once complete.

**Acceptance criteria:**
- A value is numerically specified in one canonical location.
- `design-system-from-scratch-loop.md` remains learning material, not Cell's operational SSOT.
- `docs/0-wiki.md` and `docs/2-architechture-system.md` are updated according to repository protocol.

**Dependencies:** Tasks 3-12.

### Task 14: Final verification and ADR acceptance

**Acceptance criteria:**
- Zero SSOT contradictions found by the final audit.
- Zero unresolved custom-property references.
- Zero approved delete candidates remain.
- Every remaining token has a foundation role or real consumer.
- WCAG 2.2 AA and representative runtime checks pass.
- Only after all gates pass, ADR-084 through ADR-090 become `Accepted`.

**Required commands:**
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npx vite build --mode development`

**Browser verification:**
- Design-system showcase: light/dark at compact, medium, expanded, and large boundaries.
- Popup, sidepanel, options/showcase.
- Subtitle Shadow DOM and dictionary/content-script UI.
- Reduced motion, forced colors, keyboard focus, 200% zoom/reflow, coarse pointer target.

**Dependencies:** Task 13.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Dynamic/raw token references evade simple grep | Silent runtime style break | Build a transitive dependency inventory and explicitly inspect Shadow DOM/content-script maps |
| Generated component tokens refer to deleted semantic tokens | Invalid CSS with no compile error | Traverse token-to-token references and fail on unresolved variables |
| Preset or domain tokens are mistaken for dead foundation tokens | Theme/learning feature regression | Classify by role separately from usage; used non-foundation tokens stay |
| Font asset increases bundle or lacks script coverage | Slow load or missing glyphs | Official source, license, subset, size measurement, system fallback |
| Breakpoint cleanup changes feature behavior | Responsive regression | Remove only dead CSS-variable API; do not blindly replace feature-local thresholds |
| ADRs are accepted before visual evidence | False completion | Keep Proposed until Task 14 passes |
| Deletion scope becomes a broad redesign | Unbounded work | Prune one token family at a time and stop at the confirmed foundation boundary |

## Explicitly not doing

- No density selector or three-mode density system.
- No new state-system, mobile-pattern, extension-pattern, governance, data-visualization, or syntax-color foundation ADR.
- No Figma integration.
- No new dependency for token analysis or font loading.
- No deletion based only on naming, age, or lack of direct grep hits.
