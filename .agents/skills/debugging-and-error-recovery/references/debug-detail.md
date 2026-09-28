# Debugging — step detail

Reference for `debugging-and-error-recovery`. Read the step you are on.

## Step 0: Contract

```text
Given: <exact starting state — including ALL preconditions>
When: <exact user or system action — the REAL flow, not an API call>
Then: <exact visible or measurable outcome>
```

Critical: the Given must capture EVERY condition the user described — timing ("when X runs to the end"), layout ("when the page is scrolled"), mode ("in mode A, not mode B"). Dropping a precondition means reproducing a different bug or no bug.

Loop back: request vague → `/pipeline-analyze` (interactive) on yourself; only ask the user if that fails.

## Triage (confidence gate)

Before entering the loop, spend minutes — not a harness — on static diagnosis: read the code path the symptom names, grep callers, and probe the live page. Probes that settle most UI/runtime bugs in seconds:

```text
el.getAttribute('style')          // inline mutations stylesheets never show
getComputedStyle(el) + walk ancestors for overflow/clip-path/contain/opacity
document.elementFromPoint(x, y)   // what's actually on top / hit-testable
screenshot + pixel scan           // painted truth — DOM rect ≠ rendered output
chrome.storage / console / network
```

Confidence **≥80%** (the evidence names the culprit line and explains the full symptom) → jump to Step 3, then Fix. Below 80% → full loop from Step 1. Skipping reproduction is only legitimate when the probe already observed the broken state directly — an unverified guess is still <80%.

## Step 1: Preserve

Collect before your next action changes the system: error output/stack trace/console logs; runtime state (DOM snapshot, variables, storage, network); code paths (callers, imports, lifecycle); project conventions (docs, ADRs, skills); environment (browser, OS, extension state, cache); reliable reproduction steps; last successful state + what changed since.

Guard: ≥3 known facts, not guesses. Loop back: only a stack trace → reproduce again and capture more state.

Common mistake: reloading before capturing DOM/console/network — a screenshot after reload is not the same evidence.

## Step 2: Reproduce

- Run the REAL flow from the contract — not a simulated API call, not a stripped-down version.
- If the contract describes a continuous process, let it run over time. Manually invoking one function once is NOT reproduction.
- Set up layout/scroll preconditions before triggering.
- Record the minimum setup that triggers the bug, including every precondition.
- For continuous-state bugs, log state over time (interval polling) — a single snapshot misses the transition.

Guard: trigger the bug ≥2× with the same steps, matching every contract condition. Loop back: doesn't reproduce → check each skipped precondition, mode, or whether the process is actually running.

Common mistake: testing in the wrong mode or context — DOM structure, scrollable ancestors, and CSS differ between modes. Confirm the mode matches the contract.

## Step 3: Localize

Binary search: which file, function, line, variable changed from expected? Tools: logs, breakpoints, `evaluate_script`, `grep` for callers.

Guard: one code path named. Loop back: still "something in the popup" → keep narrowing.

## Step 4: Falsify

1. Write the leading hypothesis in one sentence.
2. List one experiment that would prove it wrong.
3. Run it. Survives → promote to root cause. Else → next hypothesis.

Common experiments: change one variable (delay, disable feature, mock dependency); different data (first/middle/last); different context (fresh reload, incognito, different host); different precondition (layout set/unset, mode A/B, process running/paused).

## Step 5: Snippet Verify

Prove the hypothesis on the live system before touching source. Inject a minimal runtime patch, then re-run the contract's When → Then under the REAL flow — not an isolated call. Log state over time. Repeat 2–3×.

| Bug type | Snippet method | Verify by |
|---|---|---|
| CSS / layout | Inject `<style>` `!important` override into target root | `getComputedStyle`, `getBoundingClientRect`, interval log |
| JS logic | Override the suspected function/variable in the live runtime | Re-run the REAL failing flow, inspect over time |
| Config / env | Override the value in the live process | Re-trigger the code path that reads it |
| Data / state | Mutate the suspected state directly | Re-render/re-read and check output |
| Network / API | Mock the response via `fetch` override | Re-trigger the request, inspect handling |

Guard: symptom disappears under the real flow with the patch, reproduces without it, repeated 2–3×.

Skip this step when the culprit is a directly observed fact — an inline style, a wrong attribute, a branch the code provably never takes. Snippet-verify hypotheses that need behavioral proof, not observations that already are the proof.

Loop back: snippet doesn't fix → hypothesis incomplete or wrong → Step 4. The snippet must target the root cause, not paper over it with a broader override.

## Step 6: Fix

- Fix the shared function, not every caller. One fix per commit.
- No `setTimeout` without a real lifecycle signal; no subframe DOM mutation without a top-frame guard; no empty `.catch` unless proven safe.
- Prefer changing data flow over adding flags.
- The source fix must produce the same effect as the snippet — if not, the snippet targeted a different path → Step 3.

## Step 7: Verify

Run: the original reproduction (real flow), the variant matrix, existing tests, build, build-output inspection (grep the bundle for the fix), rendered-state checks for UI (`getComputedStyle`, `getBoundingClientRect`, screenshot, interval log). For UI/SPA bugs add/update a Playwright E2E via `testing-with-playwright`. Repeat the reproduction 2–3×.

**Variant matrix:** position (first/middle/last); context (empty, cached, after reload, after error); UI state (popup open/closed, selection active/inactive, layout precondition set/unset, mode A/B); data shape (phrase vs word, lemma vs surface, known vs unknown).

Guard: all variants pass, existing tests pass, fix visible in build output. Loop back: a variant fails → Step 4; fix missing from bundle → fix the build config first.

## Step 8: Guard

Add a regression test that fails without the fix. Update docs/ADR if architecture changed. Remove temporary instrumentation unless permanent. Add an invariant if the bug came from a broken assumption.
