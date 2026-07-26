# SSOT UI Redesign — Task Checklist

## Phase 1: Foundation — Critical fixes
- [ ] Task 1: Cross-browser fallback cho `rgba(from ...)` trong content scripts
- [ ] Task 2: Trích xuất hardcoded px trong TypeScript logic
- [ ] Task 3: Migrate SettingsDialog sang shared Dialog

### Checkpoint 1
- [ ] `npm run typecheck` pass
- [ ] `npm run test:unit` pass
- [ ] `npm run build` pass
- [ ] Subagent review Phase 1 pass

## Phase 2: Token system refinement
- [ ] Task 4: Radius semantic rename
- [ ] Task 5: Optional shadow tokens
- [ ] Task 6: Border hairline token
- [ ] Task 7: Automated contrast validation

### Checkpoint 2
- [ ] All Phase 2 tests pass
- [ ] Build pass
- [ ] Subagent review Phase 2 pass

## Phase 3: Dark/Light harmony
- [ ] Task 8: Frequency pills dark mode visibility
- [ ] Task 9: Theme transition animation
- [ ] Task 10: Contrast audit & fix for dark mode

### Checkpoint 3
- [ ] Dark mode tests pass
- [ ] Build pass
- [ ] Subagent review Phase 3 pass

## Phase 4: Behavior & accessibility
- [ ] Task 11: Touch target audit
- [ ] Task 12: Motion standardization
- [ ] Task 13: Focus states standardization

### Checkpoint 4
- [ ] Accessibility tests pass
- [ ] Build pass
- [ ] Subagent review Phase 4 pass

## Phase 5: Verify & refine (Refind loop)
- [ ] Task 14: Subagent spec/design review
- [ ] Task 15: Runtime verification (browser)
- [ ] Task 16: Update docs & ADRs

### Checkpoint Final
- [ ] All tests pass
- [ ] Production build pass (`npm run build`)
- [ ] Development build pass + 2 seed files copied
- [ ] Subagent final review: no production blockers
- [ ] Docs & ADRs updated
