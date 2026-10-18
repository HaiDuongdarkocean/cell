---
name: debugging-and-error-recovery
description: Reproduce, localize, fix, and guard against bugs. Use when something is broken or behaving unexpectedly.
---

# Debugging and Error Recovery

**Evidence before fix: probe the live failing state, falsify the hypothesis, fix the root cause, leave a regression test.**

Use when: tests fail, build breaks, runtime mismatch, bug report, works on one path fails on variant. Not for: feature design, fix already known.

## Loop

```text
Contract → (user-reported bug: consent gate) → Triage → conf ≥80% → Fix → Verify → Guard
                                                      → conf <80% → Reproduce → Localize → Falsify → (Snippet) → Fix → Verify → Guard
```

## Contract

```text
BAD:  "badge should stay floating"                          → no measurable outcome
GOOD: Given: badge floating at (609,400), data-edge=null
      When:  scrollbar toggles
      Then:  badge center stays ≈(609,400), data-edge stays null
```

Every precondition the user named — timing, layout, mode — goes in Given. Dropping one = reproducing a different bug.

Bug report comes from a human → infer the Contract from their report, present it, wait for consent. HARD GATE: no Triage, no probes, no code changes until the user confirms the Contract. An unconfirmed Contract = unknown bug. Machine-reported failures (CI, failing tests) skip the gate.

## Triage — diagnose before reproducing

Worked-before? `git log -p` / `git blame` the failing region first — most regressions name their culprit in the diff. Then read the code path, grep callers, probe the live page:

```text
BAD:  el.getBoundingClientRect() → rect correct → "element is fine" → write spec
GOOD: el.getAttribute('style')        → 'overflow: hidden' — inline mutation, no stylesheet shows this
      getComputedStyle + ancestor walk for overflow/clip-path/contain/opacity
      document.elementFromPoint(x,y)  → js-Tihoka-popup-host — something is on top
      screenshot + pixel scan         → 67 blue pixels / 0 — DOM rect ≠ painted output
      console / storage / network
```

≥80% = evidence names the culprit line AND explains the full symptom → fix directly. An unverified guess is always <80%.

## Full loop (only when triage fails)

1. **Preserve + Reproduce** — capture DOM/console/network before reload destroys it; trigger the real flow ≥2× with every contract condition set.

```text
BAD:  call processPoint() once, measure output            → transition missed
GOOD: setInterval log of badge state while the real
      drag → hover → popup-open flow runs                  → catch the snap mid-flow
```

2. **Localize** — name one code path producing the bad output.
3. **Falsify** — one experiment designed to DISPROVE the hypothesis: change a variable, different data, different context. Hypothesis survives → fix. Dies → re-localize.
4. **Snippet verify** — inject a runtime patch → symptom gone with it, present without it. Skip for directly observed facts — verify hypotheses, not observations.

```text
BAD:  edit source → rebuild 4 min → still broken → wrong path → repeat
GOOD: page.evaluate: host.style.overflow='visible' → dot paints → culprit confirmed → now edit source
```

## Fix

```text
BAD:  if (caller === 'orbital-badge') skipRipple()          → per-caller patch, sibling still broken
GOOD: data-tihoka-no-ripple on the host                        → one guard at the shared mechanism

BAD:  setTimeout(() => close(), 400)                         → races slower devices
GOOD: listen for the real signal (animationend / state event)
```

`.tsx`/`.css` fix → check `src/shared/ui/`, `ICON_CATALOG`, `tokens.json` first; fix markup before patching CSS.

## Verify

```text
BAD:  rect.y === expected && getComputedStyle(el).opacity === '0.7' → declare pass
GOOD: screenshot → pixel scan finds the painted pixels; elementFromPoint hits the target

BAD:  run happy path once
GOOD: original flow + variants that matter (first/middle/last, empty/cached, mode A/B) + tests + build
      green; fix present in the bundle when runtime ≠ source
```

## Guard

Regression test that **fails without the fix, passes with it** — prove it by reverting the fix once. Remove temporary instrumentation.

## Recurring failure modes

- Skipped contract precondition; isolated API call posing as reproduction
- DOM correct ≠ painted: right rect, zero pixels (ancestor `overflow:hidden`, `clip-path`, higher-z cover, contrast blend)
- Symptom fixed but a second hidden root cause remains — re-probe after each fix
- Snippet works, source fix doesn't → it patched a different path, re-localize
- `role="button"` containers pick up delegated effects (ripple permanently sets `overflow:hidden` on its host) — opt out via `data-tihoka-no-ripple`
- Extension: service worker terminated (MV3), script in wrong world, `all_frames` hits ad frames

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route.
