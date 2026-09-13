---
name: performance-optimization
description: Measure-driven optimization across frontend, backend, queries. Use for perf regressions, CWV, or suspected bottlenecks.
---

# Performance Optimization

## Overview

Measure before optimizing — performance work without measurement is guessing, and guessing is premature optimization that adds complexity without improving what matters. Profile → identify the actual bottleneck → fix → measure again → guard.

## When to Use / NOT

**Use:** perf budgets/SLAs in spec; reported slowness; CWV below thresholds; suspected regression; large datasets/high traffic features.

**NOT:** no evidence of a problem yet.

## Core Web Vitals targets

| Metric | Good | Poor |
|---|---|---|
| LCP | ≤2.5s | >4.0s |
| INP | ≤200ms | >500ms |
| CLS | ≤0.1 | >0.25 |

## Workflow

```text
1. MEASURE (baseline) → 2. IDENTIFY (actual bottleneck) → 3. FIX → 4. VERIFY (re-measure) → 5. GUARD (monitor/test)
```

- **Synthetic** (Lighthouse, DevTools Performance): reproducible, CI regression detection.
- **RUM** (`web-vitals`, CrUX): real conditions — required to prove a fix helped users.

## Where to measure first (symptom → probe)

```text
First page load     → bundle size + code splitting · TTFB in network waterfall
                      (DNS→prefetch/preconnect · TCP/TLS→HTTP/2/edge · server→queries/cache)
                      · render-blocking CSS/JS
Sluggish interaction→ long tasks >50ms · re-renders/controlled overhead · layout thrashing
Post-navigation     → API response times + waterfalls · component render time · N+1 fetches
Backend/API         → query log + indexes (one endpoint) · pool/memory/CPU (all endpoints)
                      · lock contention/GC/external deps (intermittent)
```

## Performance budget

```text
JS <200KB gz (initial) · CSS <50KB gz · images <200KB above-fold · fonts <100KB
API p95 <200ms · TTI <3.5s on 4G · Lighthouse ≥90
```

Enforce in CI: `bundlesize`, `lhci autorun`.

## Common fixes (by bottleneck)

N+1 → join/include. Unbounded fetch → paginate. Images → dimensions + `srcset`/`sizes` + `loading="lazy"` below-fold + `fetchpriority="high"` for LCP. Re-renders → stable references, `memo`/`useMemo` for expensive paths only. Bundle → dynamic `import()` + route-level splitting (named imports already tree-shake in Vite). Caching → TTL for hot reads + immutable static assets + `Cache-Control` on APIs.

→ Full bottleneck tables, before/after code (N+1, images, React, bundle, caching), measurement snippets: `references/perf-patterns.md`

## Rationalizations / red flags

- "Optimize later" → perf debt compounds · "fast on my machine" → profile representative hardware
- "obvious optimization" → no measurement = don't know · "framework handles it" → not N+1 or bundle size
- Red flags: optimizing without profiling; N+1 in fetching; unpaginated lists; dimension-less images; bundle growth unreviewed; no production monitoring; `memo`/`useMemo` sprayed everywhere

## Verification

- [ ] Before/after numbers exist; the specific bottleneck was identified and addressed
- [ ] CWV within "Good"; bundle not significantly grown; no new N+1
- [ ] Budget passes in CI (if configured); existing tests still pass

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
