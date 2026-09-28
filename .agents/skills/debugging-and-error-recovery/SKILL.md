---
name: debugging-and-error-recovery
description: Reproduce, localize, fix, and guard against bugs. Use when something is broken or behaving unexpectedly.
---

# Debugging and Error Recovery

## Overview

**Debug by evidence, Socratic questioning, and falsification before fix.**

1. **Evidence first** — preserve before your next action changes the system. A hunch is not a diagnosis.
2. **Socratic questioning** — interrogate your own assumptions until the weakest one is exposed.
3. **Falsification before fix** — actively try to disprove the leading hypothesis; code only when it survives.

The goal is understanding the failure well enough that the fix is obvious and stays fixed. Code fixes themselves belong in `learning-and-apply` atoms — this skill stores methodology and diagnostic patterns.

## When to Use / NOT to Use

**Use:** tests fail, build breaks, runtime mismatch, bug report, worked-before-stopped, works on one path fails on variant, extension breaks host page, you feel confident before evidence.

**NOT:** feature design, no reproducible symptom, fix already known.

## The Debug Loop

```
0. Contract → Triage → conf ≥80% → 3. Localize → 6. Fix → 7. Verify → 8. Guard
                    → conf <80% → 1. Preserve → 2. Reproduce → 3. Localize → 4. Falsify → 5. Snippet Verify → 6. Fix → 7. Verify → 8. Guard
```

Each arrow has a guard — do not advance until it passes.

| Step | Done when |
|---|---|
| 0. Contract | Given/When/Then names concrete DOM/text/call + **every** precondition the user mentioned |
| Triage | Static code read + live probe names the culprit line at **≥80%** → skip to Localize/Fix. Below 80% → full loop. A 3-line `evaluate` (computed style, `getAttribute('style')`, `elementFromPoint`, pixel-scan a screenshot) is diagnosis evidence — don't build a reproduction harness for what a probe already proves |
| 1. Preserve | ≥3 known facts, more facts than guesses (capture DOM/console/network BEFORE reload) |
| 2. Reproduce | Bug triggers ≥2× under the **exact** contract conditions — probe the live failing state first; a repeatable spec only when the trigger needs a user-flow sequence |
| 3. Localize | One code path named that produces the bad output |
| 4. Falsify | Hypothesis survived ≥1 experiment designed to disprove it |
| 5. Snippet Verify | Injected patch removes the symptom ≥2× under the **real** flow, state logged over time. Skip when the culprit is a directly observed fact (inline style, wrong attribute, dead branch) — snippet-verify hypotheses, not observations |
| 6. Fix | Smallest change matching what the snippet proved; explainable in plain language. Fix touching `.tsx`/`.css` → UI component-check first |
| 7. Verify | Original + variant matrix + existing tests + build green; fix visible in build output. UI bugs: verify **pixels painted**, not just DOM state |
| 8. Guard | Regression test fails without the fix, passes with it |

## The three failure modes that waste the most time

1. **Isolated API call ≠ reproduction.** If the contract describes a continuous process with side effects (lifecycle hooks, timing, ancestor state), calling one function once and measuring output is NOT reproduction. Run the real flow; log state over time (interval polling) — a single before/after snapshot misses the transition.
2. **Skipped precondition.** If the contract names a layout, timing, or mode condition, set it up before triggering. A bug that only appears under that condition won't reproduce without it — and you'll "fix" a different bug.
3. **Editing source before the snippet proves it.** A rebuild costs minutes; a snippet costs seconds. If the hypothesis is wrong you've wasted the rebuild. If the snippet fixes the symptom but the source fix doesn't, the snippet patched a different code path — re-localize.
4. **UI fix that invents instead of reusing.** When the fix touches `.tsx`/`.css`, run the component check before writing markup: does the element exist in `src/shared/ui/`? Is the icon in `ICON_CATALOG`? Is the value a token in `tokens.json`? Fix markup before patching CSS; never hardcode what the design system already names. `design-system-guardian` audits the result.
5. **Harness before probe.** Before writing a reproduction spec, probe the failing page live (`evaluate`: `getAttribute('style')`, computed chain, `elementFromPoint`, pixel-scan a screenshot). DOM state correct ≠ rendered correct — an element can hold the right rect and paint nothing (ancestor `overflow:hidden`, `clip-path`, higher-z cover, contrast blend). Verify pixels, not just DOM.

→ Full step detail (preserve checklist, reproduce rules, falsify experiments, snippet patch methods by bug type, verify variant matrix): `references/debug-detail.md`
→ Root-cause patterns table, extension traps, evidence-by-category, Socratic questions, evidence board, full anti-patterns: `references/patterns.md`

## Anti-Patterns (top offenders)

- Guessing fixes without reproducing the bug; fixing symptoms instead of root causes
- "It works now" without understanding what changed; no regression test after a fix
- `setTimeout` without a real lifecycle signal; subframe DOM mutation without a top-frame guard
- Declaring pass after one successful manual test — repeat ≥2×
- Trusting the source file over the build output when runtime behaves differently — grep the bundle for the fix
- Replacing the contract's real flow with an isolated API call during reproduction or snippet verification

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
