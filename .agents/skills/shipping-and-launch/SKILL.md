---
name: shipping-and-launch
description: Pre-launch checklist, staged rollout, monitoring, rollback. Use when deploying to production.
---

# Shipping and Launch

## Overview

Every launch is reversible, observable, and incremental. Deploying is not the goal — deploying safely with monitoring, a rollback plan, and a known success definition is.

## When to Use

First production deploy; significant release; data/infra migration; beta opening; any risky deployment (all of them).

## Pre-launch checklist (section heads — full list in references)

- **Code:** all tests pass; clean build + lint + typecheck; reviewed; no leftover TODO/`console.log`; error handling covers expected failures
- **Security:** no secrets; `npm audit` clean of critical/high; validation + auth; security headers; rate-limited auth endpoints; scoped CORS
- **Performance:** CWV "Good"; no N+1 in critical paths; images optimized; bundle in budget; indexes + caching
- **Accessibility:** keyboard nav; screen reader; WCAG AA contrast; focus management; axe/Lighthouse clean (`e2e/showcase-axe.spec.ts`)
- **Infra:** env vars set; migrations ready; DNS/SSL/CDN; logging + error reporting; health endpoint
- **Docs:** README, API docs, ADRs, changelog current

→ Full checklists, monitoring tree, error-boundary code, flag example, rollback-plan template: `references/launch-detail.md`

## Feature flags + staged rollout

```text
Deploy flag OFF → enable for team (24h) → canary 5% (24–48h) → 25% → 50% → 100% → monitor 1 week → remove flag + dead code
```

Flag rules: owner + expiration date; cleanup within 2 weeks of full rollout; no nested flags; test both states in CI.

## Rollout decision thresholds

| Metric | Advance | Hold | Roll back |
|---|---|---|---|
| Error rate | within 10% of baseline | +10–100% | >2× baseline |
| P95 latency | within 20% | +20–50% | >50% |
| Client JS errors | none new | new <0.1% of sessions | new >0.1% |
| Business metrics | neutral/positive | decline <5% | decline >5% |

**Roll back immediately on:** error rate >2×, p95 +50%, user-report spike, data-integrity issue, security vuln.

## Post-launch verification (first hour)

Health endpoint 200 → error dashboard clean → latency normal → critical flow tested manually → logs flowing → rollback verified.

## Post-launch business review (pipeline's final gate)

Technical green ≠ built the right thing. After deploy is stable (24–48h or end of ship session), human signs off the business side:

- [ ] Actual outcome vs Success Criteria in `docs/specs/[feature].md`
- [ ] Human confirms "đúng thứ cần build" — not just "build đúng spec"
- [ ] **Comprehension debt check:** human spot-checks merged diffs — if they can't explain what the shipped code does, that's debt accruing at compound interest, not velocity. Record unexplained lanes in `docs/reviews/`.
- [ ] Miss → finding into `docs/reviews/` and/or process atom in `learning-and-apply` (`type: "process"`)

## Rationalizations / red flags

- "works in staging → works in prod" → different data/traffic/edges · "no flags needed" → every feature wants a kill switch
- "monitoring later" → can't debug what you can't see · "rollback = failure" → shipping broken is the failure
- Red flags: no rollback plan; no monitoring; big-bang release; ownerless flags; nobody watching the first hour; config by memory; Friday-afternoon ship

## Verification

- [ ] Pre-launch checklist green; flag configured; rollback documented; monitoring live; team notified
- [ ] Post-deploy: health 200, errors/latency normal, critical flow works, rollback ready, **business outcome confirmed vs spec**

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
