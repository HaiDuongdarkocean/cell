---
name: debugging-and-error-recovery
description: Reproduce, localize, fix, and guard against bugs. Use when something is broken or behaving unexpectedly.
---

# Debugging and Error Recovery

**Evidence before fix: probe the live failing state, falsify the hypothesis, fix the root cause, leave a regression test.**

Use when: tests fail, build breaks, runtime mismatch, bug report, works on one path fails on variant. Not for: feature design, fix already known.

## Loop

```text
Contract → Triage → conf ≥80% → Fix → Verify → Guard
                 → conf <80% → Reproduce → Localize → Falsify → (Snippet) → Fix → Verify → Guard
```

## Contract

Given (every precondition the user named — timing, layout, mode) / When (the real flow, not an isolated call) / Then (measurable outcome). Dropping a precondition = reproducing a different bug.

## Triage — diagnose before reproducing

If it worked before: `git log -p` / `git blame` the failing region first — most regressions name their culprit in the diff. Then read the code path the symptom names, grep callers, probe the live page. A 3-line `evaluate` settles most UI/runtime bugs:

- `el.getAttribute('style')` — inline mutations stylesheets never show
- `getComputedStyle` + ancestor walk for `overflow`/`clip-path`/`contain`/`opacity`
- `document.elementFromPoint(x, y)` — what's on top / hit-testable
- screenshot + pixel-scan — DOM rect ≠ painted output
- console / storage / network

≥80% = the evidence names the culprit line AND explains the full symptom → Fix directly. Below → full loop. An unverified guess is always <80%.

## Full loop (only when triage fails)

1. **Preserve + Reproduce** — capture DOM/console/network/state before your next action destroys it; then trigger the real flow ≥2× with every contract condition set. A continuous process must run over time (interval log); a spec harness only when the trigger needs a user-flow sequence.
2. **Localize** — name one code path producing the bad output.
3. **Falsify** — hypothesis in one sentence + one experiment designed to disprove it (change a variable, different data, different context).
4. **Snippet verify** — inject a runtime patch (style `!important`, function override, state mutation, fetch mock) → symptom gone with, present without. Skip for directly observed facts — verify hypotheses, not observations.

## Fix

Smallest change at the shared function, not per-caller. No `setTimeout` without a lifecycle signal. `.tsx`/`.css` → check `src/shared/ui/`, `ICON_CATALOG`, `tokens.json` first; fix markup before patching CSS.

## Verify

Re-run the original flow + the variants that matter (first/middle/last, empty/cached, mode A/B); tests + build green; fix present in the bundle when runtime ≠ source. UI bugs: confirm **pixels painted**, not just DOM state.

## Guard

Regression test that fails without the fix. Remove temporary instrumentation.

## Recurring failure modes

- Skipped contract precondition; wrong mode/context; isolated API call posing as reproduction
- DOM correct ≠ painted: right rect, zero pixels (ancestor `overflow:hidden`, `clip-path`, higher-z cover, contrast blend)
- Symptom fixed but a second hidden root cause remains — re-probe after each fix
- Snippet works, source fix doesn't → it patched a different path, re-localize
- `role="button"` containers pick up delegated effects (ripple permanently sets `overflow:hidden` on its host) — opt out via `data-cell-no-ripple`
- Extension: service worker terminated (MV3), script in wrong world, `all_frames` hits ad frames

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route.
