# Cell Foundation v1 — Task Checklist

## Phase 0 — Evidence baseline

- [ ] T1 Build transitive token dependency inventory and classify every token
- [ ] T2 Capture baseline build results and representative browser visuals

### Checkpoint A
- [ ] Review inventory and approve the evidence-backed delete-candidate list
- [ ] Confirm no deletion has occurred before approval

## Phase 1 — Canonical contract

- [ ] T3 Make `STANDARD.md` the concise foundation contract
- [ ] T4 Reconcile ADR-084 through ADR-090; keep status Proposed

## Phase 2 — Typography and responsive primitives

- [ ] T5 Add licensed, subsetted Inter Variable Latin/Vietnamese with system fallback
- [ ] T6 Migrate to 16px long-form body / 14px UI / ≥12px caption roles
- [ ] T7 Stop generating dead `--breakpoint-*` CSS variables; retain 0/600/840/1200/1600 in JSON/TS

### Checkpoint B
- [ ] Verify font loading, fallback, Vietnamese/CJK, 200% zoom, and breakpoint boundaries
- [ ] Run typecheck, unit tests, production build, and development build

## Phase 3 — Token pruning

- [ ] T8 Reconcile and prune color tokens by transitive consumer evidence
- [ ] T9 Reconcile and prune spacing/size/radius/elevation/border/stroke/blur/z-index
- [ ] T10 Reconcile and prune motion and iconography tokens

### Checkpoint C
- [ ] Review actual deletion diff
- [ ] Confirm every removed token has zero remaining consumer
- [ ] Verify presets, Shadow DOM, content-script maps, learning colors, and liquid-glass consumers

## Phase 4 — Accessibility

- [ ] T11 Enforce WCAG 2.2 AA in token generation and shared styles
- [ ] T12 Update foundation showcase for final acceptance scenarios

## Phase 5 — Consolidation and acceptance

- [ ] T13 Remove duplicated numeric guidance from README/DESIGN and update required docs indexes
- [ ] T14 Run final gates; mark ADR-084 through ADR-090 Accepted only after all pass

## Final gates

- [ ] Zero SSOT contradictions
- [ ] Zero unresolved custom-property references
- [ ] Zero approved legacy/delete candidates remaining
- [ ] Every remaining token has a foundation role or real consumer
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] `npx vite build --mode development`
- [ ] Browser: showcase light/dark at compact/medium/expanded/large
- [ ] Browser: popup, sidepanel, options/showcase
- [ ] Browser: subtitle Shadow DOM and dictionary/content-script UI
- [ ] Browser: keyboard focus, reduced motion, forced colors, 200% zoom/reflow, coarse pointer targets
- [ ] Anh reviews and approves the completed foundation
