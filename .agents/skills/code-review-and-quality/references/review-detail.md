# Code Review — detail reference

## Five-axis checklists

### Correctness
- Matches the spec/task? Edge cases (null, empty, boundary)? Error paths, not just happy path?
- Tests pass and test the right things? Off-by-one, races, state inconsistencies?

### Readability & simplicity
→ `code-simplification` when complexity is the finding.
- Names descriptive and conventional (no bare `temp`/`data`/`result`)? Control flow straightforward (no nested ternaries, deep callbacks)?
- Logical organization and module boundaries? "Clever" tricks that should be simplified?
- Could it be fewer lines? Do abstractions earn their complexity (don't generalize before the third use)?
- Comments clarify non-obvious intent (without narrating obvious code)?
- Dead artifacts: no-op vars, backwards-compat shims, `// removed` comments?
- New conditional bolted onto an unrelated flow → design smell; push logic into its own helper/state/policy.
- Repeated conditionals on the same shape → missing model or dispatcher; "temporary" branches are usually permanent.

### Architecture
- Follows existing patterns or justified new one? Clean boundaries? Duplication that should be shared?
- Dependencies flow the right way (no cycles)? Right abstraction level?
- Does the refactor **reduce** complexity or relocate it — count concepts a reader must hold. Prefer restructuring that makes branches/modes/layers disappear; prefer deleting an abstraction to polishing it.
- Feature-specific logic leaking into shared modules? Keep logic in its owning layer; reuse the canonical helper.
- Type boundaries explicit? Question gratuitous `any`/`unknown`/casts and silent fallbacks that hide an unclear invariant.

### Security
→ `security-and-hardening` for the full treatment. Quick pass: input validated; secrets out of code/logs/VCS; auth checks; parameterized queries; encoded output; trusted deps; external data (APIs, logs, user content, config) treated as untrusted and validated at boundaries.

### Performance
→ `performance-optimization`. Quick pass: N+1 queries; unbounded loops/fetches; sync ops that should be async; unnecessary re-renders; missing pagination; large objects in hot paths.

## Change descriptions

First line: short, imperative, standalone ("Delete the FizzBuzz RPC" not "Deleting..."). Informative to someone searching history without reading the diff.
Body: what + why, context, decisions, reasoning not visible in code; link bugs/benchmarks/design docs; acknowledge shortcomings.
Anti-patterns: "Fix bug," "Fix build," "Add patch," "Moving code from A to B," "Phase 1," "Add convenience functions."

## Multi-model review

```text
Model A writes → Model B reviews correctness + architecture → A addresses → human decides
```

Different models have different blind spots. Review prompt:

```text
Review this code change for correctness, security, and adherence to
our project conventions. The spec says [X]. The change should [Y].
Flag any issues as Critical, Required, Optional, or Nit.
```

## Dead code hygiene

After refactor/implementation, check for orphaned code — identify, list explicitly, ask before deleting:

```text
DEAD CODE IDENTIFIED:
- formatLegacyDate() in src/utils/date.ts — replaced by formatDate()
- OldTaskCard in src/components/ — replaced by TaskCard
- LEGACY_API_URL in src/config.ts — no remaining references
→ Safe to remove these?
```

## Review speed

Respond within one business day (max, not target); prioritize fast responses over fast approval; large changes → ask the author to split rather than review a monolith.

## Honesty

Don't rubber-stamp; don't soften real issues ("minor concern" for a production bug is dishonest); quantify impact; push back with alternatives; accept override gracefully — code, not people.

## Dependency upgrade discipline

1. **Read the changelog**, not just the version — a "patch" can carry a behavioral change; majors need migration notes.
2. **One dependency per change** — a bulk bump that breaks the build hides which package did it.
3. **Let tests decide** — green suite before *and* after; thin coverage around the dep is the real finding.
4. **Mind the transitive graph** — review the lockfile diff, not just `package.json`.
5. **Keep the lockfile honest** — commit it, review its diff, never hand-edit.

## Full review checklist

```markdown
## Review: [PR/Change title]

### Context
- [ ] I understand what this change does and why

### Correctness
- [ ] Change matches spec/task requirements
- [ ] Edge cases handled
- [ ] Error paths handled
- [ ] Tests cover the change adequately

### Readability
- [ ] Names are clear and consistent
- [ ] Logic is straightforward
- [ ] No unnecessary complexity

### Architecture
- [ ] Follows existing patterns
- [ ] No unnecessary coupling or dependencies
- [ ] Appropriate abstraction level
- [ ] Refactors reduce complexity rather than relocate it
- [ ] No feature logic in shared modules; file stays within a healthy size

### Security
- [ ] No secrets in code
- [ ] Input validated at boundaries
- [ ] No injection vulnerabilities
- [ ] Auth checks in place
- [ ] External data sources treated as untrusted

### Performance
- [ ] No N+1 patterns
- [ ] No unbounded operations
- [ ] Pagination on list endpoints

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Manual verification done (if applicable)

### Verdict
- [ ] **Approve** — Ready to merge
- [ ] **Request changes** — Issues must be addressed
```

## Common rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Unreadable/insecure/wrong-arch code compounds debt. |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. |
| "We'll clean it up later" | Later never comes — review is the quality gate. |
| "AI-generated code is probably fine" | AI code needs more scrutiny — confident and plausible even when wrong. |
| "The tests pass, so it's good" | Tests don't catch architecture, security, or readability problems. |
| "The refactor makes it cleaner" | Relocating complexity isn't reducing it. |
| "It's only a small addition to this file" | Judge the resulting structure, not the diff size. |
| "It's just a version bump" | A bump is a behavior change you didn't write — read the changelog. |
| "Upgrade everything in one PR to save time" | A bulk break hides which package did it. |
