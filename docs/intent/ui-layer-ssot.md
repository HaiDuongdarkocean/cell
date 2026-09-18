# Intent: ui-layer-ssot

> Slug: `ui-layer-ssot` · Mode: all · Source: backlog row #18 (internal-audit, `docs/audits/20260916_src-features-entrypoints-shared.md` item 2 residual)
> ui_surface: no
> confidence: high

## Analysis

**The boundary gaps the row names are all closed or guarded** — the audit's own text concedes "Cycles/inversions fixed"; the residuals it listed have since landed:

| Backlog claim | Current code |
|---|---|
| CueList lives in entrypoints; 5 feature files deep-import upward | `CueList.tsx` now at `src/features/subtitle/ui/`; **zero** `from '@/entrypoints` imports under `src/features/` |
| features→entrypoints inversion unguarded | `eslint.config.ts` `no-restricted-imports` bans `@/entrypoints/**` inside `src/features/**` (plus shared/entities → features bans and a per-feature DAG rule set) |
| `src/stores/` outside layering | directory no longer exists |
| 7/21 barrels `export *` | only `export * as subtitleDiscovery` (namespaced, not wildcard) remains — in `features/detection/index.ts:66` |
| no `import/no-cycle` | `scripts/check-feature-cycles.mjs` runs in `npm run build` — 22 features, 42 cross-feature edges, clean; KNOWN_CYCLES ratchet |
| ~845 deep imports vs barrels | `scripts/check-deep-imports.mjs` build gate — committed baseline (174 pairs), **new deep imports fail the build**; existing pairs ratchet down only |

Residual: 174 baselined deep-import pairs still exist. That is guarded, shrinking-by-policy debt — converting them is mechanical churn, not boundary SSOT work, and the ratchet already prevents regression. Not worth an L★4 slot.

## Residual follow-ups (recorded, not implemented)

- Baseline-pair reduction can proceed opportunistically when touching an area — no dedicated item needed.

## Decision

**no-go** — every gap the row names is closed (CueList relocated, stores/ dissolved, barrels named, cycles+deep-imports build-gated, ESLint layering enforced); only guarded baseline debt remains.

## Acceptance criteria

- n/a — dropped at analyze (boundary already enforced).
