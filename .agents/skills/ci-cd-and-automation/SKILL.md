---
name: ci-cd-and-automation
description: Design and maintain CI/CD pipelines and automation. Use when creating or changing workflows, gates, or release automation.
---

# CI/CD and Automation

## Overview

Automate quality gates so no change reaches production without passing tests, lint, typecheck, and build. CI/CD enforces every other skill consistently on every change.

- **Shift Left:** catch problems as early as possible — lint before tests, tests before staging, staging before production.
- **Faster is Safer:** small batches + frequent releases reduce risk; a 3-change deploy is easier to debug than a 30-change one.

## When to Use

Setting up CI, adding/modifying automated checks, deployment pipelines, automated verification triggers, debugging CI failures.

## The quality gate order

```text
lint → typecheck → unit tests → build → integration → e2e (optional) → security audit → bundle size
```

**No gate is skipped.** Lint fails → fix lint, don't disable the rule. Test fails → fix code, don't skip the test.

## Feeding CI failures back to agents

CI's power with agents is the feedback loop:

```text
CI fails → copy the failure output → feed to the agent:
"CI failed with this error: [...]. Fix and verify locally before pushing."
→ agent fixes → pushes → CI re-runs
```

Routing: lint failure → `npm run lint --fix`; type error → fix at error location; test failure → `debugging-and-error-recovery`; build error → config/deps.

## Deployment strategies

- **Preview deployments:** every PR gets a preview for manual testing.
- **Feature flags:** decouple deploy from release — ship disabled, canary 1%→10%→100%, roll back by disabling. Lifecycle: create → test → canary → full → **remove flag + dead code** (set a cleanup date at creation).
- **Staged rollout:** merge → staging (auto) → manual verify → production → monitor 15 min → errors → rollback.
- **Rollback:** every deployment reversible; a `workflow_dispatch` rollback workflow taking a version input.

## Environment management

```text
.env.example → committed (template)     .env      → never committed
.env.test    → committed (no secrets)   CI/prod   → secrets manager only
```

CI never holds production secrets — separate CI-only credentials.

## Automation beyond CI

- **Dependabot/Renovate** for dependency PRs (weekly, PR-limit ~5).
- **Build Cop:** one owner keeps CI green — fixes or reverts a broken build rather than waiting for the author.
- **PR checks:** ≥1 approval, required status checks, no force-push to main, auto-merge when green.

## CI optimization (when the pipeline exceeds ~10 min)

In order of impact: cache dependencies → parallelize lint/typecheck/test/build jobs → path filters (skip e2e on docs-only PRs) → matrix/shard test suites → move slow tests off the critical path to a schedule → larger runners.

→ Ready-to-adapt YAML (basic CI, DB services, Playwright e2e, preview deploy, rollback workflow, dependabot, parallel-job example): `references/ci-patterns.md`

## Rationalizations / red flags

- "CI is too slow" → optimize, don't skip · "trivial change, skip CI" → trivial changes break builds
- "flaky test, just re-run" → fix the flakiness · "add CI later" → day one
- Red flags: no CI; ignored failures; tests disabled to pass; prod deploys without staging; no rollback; secrets in code/config; slow CI with no optimization effort

## Verification

- [ ] All gates present (lint, types, tests, build, audit); runs on every PR + push to main
- [ ] Failures block merge (branch protection); results feed the dev loop
- [ ] Secrets in the manager, not code; deployment has rollback; pipeline <10 min

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
