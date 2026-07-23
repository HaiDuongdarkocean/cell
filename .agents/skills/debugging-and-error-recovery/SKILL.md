---
name: debugging-and-error-recovery
description: Guides systematic root-cause debugging using Socratic questioning. Use when tests fail, builds break, behavior doesn't match expectations, or you encounter any unexpected error. Use when you need a systematic approach to finding and fixing the root cause rather than guessing.
---

# Debugging and Error Recovery

## Methodology

This skill runs on three principles:

1. **Ocean = evidence first.** Do not form a root-cause theory before you preserve evidence. A hunch is not a diagnosis.
2. **Socratic questioning.** Interrogate your own assumptions until the weakest one is exposed.
3. **Falsification before fix.** Actively try to disprove your leading hypothesis. Only code when the hypothesis survives.

The goal is not to make the symptom disappear. It is to understand the failure well enough that the fix is obvious and stays fixed. A fix that only works on one path is a delayed bug.

## skill kèm theo

1. ALWAYS apply `caveman ultra` mode from step 1 - 7.
2. ALWAYS apply `ponytail` rules from step 1 - 7.

## What This Skill Stores

This skill stores **methodology** and **diagnostic patterns**, not code techniques or opinions.

| Term | Meaning | Good example | Bad example |
|---|---|---|---|
| **Methodology** | Reusable way to reason about a class of problems. | Trace six desync points: write, wrong-key, read-before-write, read-wrong-key, render-wrong-source, cache-hid-update. | "Use `getTokenStatus` as fallback." |
| **Diagnostic pattern** | Signature you recognize after applying the methodology. | "Status mismatch often means `setWordStatus` and `getWordStatus` use different keys or a DB race." | "The code is messy and should be refactored." |
| **Technique** | Concrete coding move. | — | "Use `getTokenStatus` as fallback in `webTextController`." |
| **Opinion** | Unverified preference. | — | "React renders too many times." |
| **Symptom** | Visible failure. | — | "The popup shows unknown." |

Code fixes belong in `learning-and-apply` atoms. Symptoms belong in the evidence board. This skill only stores methodology and the patterns that emerge from it.

## When to Use

- Tests fail after a code change.
- The build breaks.
- Runtime behavior does not match expectations.
- A bug report arrives.
- An error appears in logs or console.
- Something worked before and stopped working.
- A feature works on one path but fails on a variant.
- You feel confident about a cause before gathering enough evidence.
- A browser extension breaks a host page.
- A feature works on first load but breaks on reload / restore / navigation.

## The Debug Loop

```
0. Contract → 1. Preserve → 2. Reproduce → 3. Localize → 4. Falsify → 5. Fix → 6. Verify → 7. Guard
```

Each arrow has a **guard**. If the guard fails, go back. Do not advance until the guard passes.

## Step 0: Contract

**Purpose:** Turn the request into an observable Given/When/Then.

**Template:**
```
Given: <exact starting state>
When: <exact user or system action>
Then: <exact visible or measurable outcome>
```

**Example:**
```
Given: token "learning" is unknown
When: hover it → press 2 → click it
Then: popup status button shows "tracking"
```

**Guard:** Contract names a concrete DOM element, text, class, or call. "It works" is not a contract.

**Loop back:** Request is vague. Invoke `/interview-me` on yourself. Only ask the user if `/interview-me` fails.

## Step 1: Preserve

**Purpose:** Capture data before your next action changes the system.

**Collect:**
- Error output / stack trace / console logs.
- Runtime state: DOM snapshot, variables, storage, network.
- Code paths: callers, imports, lifecycle hooks.
- Project conventions: docs, architecture, skills, prior ADRs.
- Environment: browser, OS, extension state, cached data.
- Reproduction steps that make the bug appear reliably.
- Last successful state and what changed since then.

**Guard:** At least three known facts, not guesses.

**Loop back:** You only have a stack trace. Run the reproduction again and capture more state.

**Common mistake:** Reloading before capturing DOM, console, or network state. A screenshot after reload is not the same evidence.

## Step 2: Reproduce

**Purpose:** Confirm the bug is real and repeatable.

**Actions:**
- Run the exact steps from the contract.
- Run the same steps on a clean profile / fresh reload.
- Strip unrelated parts until the bug still appears.
- Record the minimum setup that triggers the bug.

**Guard:** You can trigger the bug at least twice with the same steps.

**Loop back:** The bug is flaky. Capture environment noise and try again.

## Step 3: Localize

**Purpose:** Narrow the bug to one surface.

**Binary search:**
- Which file?
- Which function?
- Which line?
- Which variable changed from expected?
- Which state transition produced the bad output?

**Tools:** logs, breakpoints, `evaluate_script` in DevTools, `grep` for callers.

**Guard:** You can name one code path that produces the bad output.

**Loop back:** You still describe the bug as "something in the popup". Keep narrowing.

## Step 4: Falsify

**Purpose:** Identify the root cause and try to disprove it.

**Actions:**
1. Write the leading hypothesis in one sentence.
2. List one experiment that would prove it wrong.
3. Run the experiment.
4. If it survives, promote it to root cause. If not, pick the next hypothesis.

**Guard:** You have run at least one falsification experiment.

**Loop back:** Your hypothesis changed but you did not run a new experiment.

**Common experiments:**
- Change one variable: delay, disable feature, mock dependency.
- Use different data: first, middle, last item.
- Different context: fresh reload, hot reload, incognito, different host.

## Step 5: Fix

**Purpose:** Change the smallest code that removes the root cause.

**Rules:**
- Fix the shared function, not every caller.
- No `setTimeout` without a real lifecycle signal.
- No subframe DOM mutation without a top-frame guard.
- No empty `.catch` unless proven safe.
- One fix per commit.
- Prefer changing data flow over adding flags.

**Guard:** You can explain the fix in plain language without jargon.

**Loop back:** The fix touches more than one responsibility. Split it.

## Step 6: Verify

**Purpose:** Prove the fix fixed the root cause.

**Run:**
- The original reproduction.
- The variant matrix.
- Existing tests.
- Build.
- Visual / rendered state for UI: `getComputedStyle`, `getBoundingClientRect`, screenshot. DOM text alone is not proof.
- Repeat the reproduction 2-3 times before declaring pass.

**Variant matrix:**
- Position: first, middle, last item.
- Context: empty, cached, after reload, after error.
- UI state: popup open/closed, selection active/inactive.
- Data shape: phrase vs. word, lemma vs. surface, known vs. unknown.

**Guard:** All variants pass and existing tests still pass.

**Loop back:** A variant fails. Go back to Step 4.

## Step 7: Guard

**Purpose:** Make the same failure expensive to reintroduce.

**Actions:**
- Add a regression test that fails without the fix.
- Update docs / ADR if architecture changed.
- Remove temporary instrumentation unless permanent.
- Add an invariant if the bug came from a broken assumption.

**Guard:** The regression test exists and passes.

**Loop back:** The fix is not covered by any test or doc.

## Guard Reference

| Step | Input | Output | Done when |
|---|---|---|---|
| 0. Contract | User request | Given/When/Then | Names concrete DOM/text/call |
| 1. Preserve | Bug observed | Evidence board | ≥3 facts, more facts than guesses |
| 2. Reproduce | Evidence board | Minimum steps | Bug triggers twice |
| 3. Localize | Reproduction | Single surface | One code path identified |
| 4. Falsify | Localized surface | Root cause | Hypothesis survived a test |
| 5. Fix | Root cause | Minimal code change | Explained in plain language |
| 6. Verify | Fix applied | All variants pass | Original + matrix + tests + build green |
| 7. Guard | Verified fix | Regression test + docs | Test fails without fix, passes with it |

## Evidence by Bug Category

| Bug type | Gather first |
|---|---|
| Test failure | Full output, order dependence, isolation, recent changes |
| Build error | Exact error line, config diff, lockfile, Node version |
| Runtime crash | Stack trace, input data, state at crash, last action |
| UI/SPA bug | DOM snapshot, `innerText`, computed style, bounding rect, visibility, `readyState`, network, console, iframes |
| Extension bug | `manifest.json`, injection logs, top/subframe state, storage |
| Performance | Flame graph, memory snapshot, network waterfall, metrics |

## Socratic Questions

Ask before any hypothesis:
- Clarification: What exactly is failing?
- Assumption probe: What am I taking for granted?
- Evidence: What do I know and why?
- Counter-evidence: What would disprove my theory?
- Consequence: If X is true, what follows?
- Viewpoint challenge: Could there be another cause?

## Evidence Board Template

```
Known facts:
-
-
-

Guesses / theories:
-  ← test this
-  ← test this
```

Do not start Step 5 until the evidence board has more facts than guesses.

## Pause at Certainty

When you feel 90% confident, answer:
- What evidence have I not gathered?
- What is the weakest link in my reasoning?
- If I am wrong, what will I have wasted?
- Can I explain the bug without jargon?
- Have I repeated the action at least twice?

If the last answer is no, you do not understand it yet.

## Common Root-Cause Patterns

| Symptom | Likely root cause | Falsify by |
|---|---|---|
| Works once, fails on reload | State leaks or not initialized | Fresh profile reload |
| Works locally, fails on host | Host page interference | Test on clean page |
| Works first item, fails others | Off-by-one, cursor offset, phrase boundary | Test middle and last |
| Works fast, fails slow | Race condition or missing await | Throttle network / CPU |
| Works one word, fails another | Casing, lemma, or phrase mismatch | Test same action with different words |
| UI updated but reverts | Cache not invalidated or stale source | Rebind and check source of truth |
| Popup wrong but token right | Different term keys between set and get | Log both keys |
| UI data exists but user does not see it | DOM queried but not rendered/visible | `getComputedStyle` + `getBoundingClientRect` vs `innerText` |
| Works first time, fails the second | State leak or cache reuse | Repeat the same action without reloading |

## Data Flow Desync Patterns

When UI state looks wrong, one of these is broken:

1. Write did not happen.
2. Write happened in the wrong place.
3. Read happened before write.
4. Read returned the wrong key.
5. Render used the wrong source.
6. Cache hid the update.

Map the symptom to one of these six before writing a fix.

## Browser Extension Traps

| Trap | Why | Falsify by |
|---|---|---|
| Service worker terminated | MV3 ephemeral | Reload and re-run immediately |
| Content script in wrong world | `chrome.runtime` missing | Check injection target and `world` |
| Subframe injection | `all_frames` hits ads/challenge frames | Count injection logs per frame |
| Storage desync | Different `dbHash` in contexts | Compare `getDbHash()` in both |
| Handler not registered | Handler added after message | Check registration order |
| Host page mutates DOM | Re-render wipes tokenized nodes | Watch `MutationObserver` and rebind count |

## Anti-Patterns

Forbidden unless justified with evidence:
- Skipping a failing test to work on new features.
- Guessing fixes without reproducing the bug.
- Fixing symptoms instead of root causes.
- "It works now" without understanding what changed.
- No regression test after a fix.
- Multiple unrelated changes while debugging.
- Adding `setTimeout` without a real lifecycle signal.
- Mutating subframe DOM without a top-frame guard.
- Stopping at the first plausible explanation.
- Writing the fix before the failing regression test.
- Declaring pass after one successful manual test or click. Repeat the action at least twice.
- Treating DOM text as user-visible behavior.
- Calling the same probe multiple times instead of capturing all needed evidence in one pass.

## Verification Checklist

After any fix:

- [ ] Root cause identified and documented.
- [ ] Fix addresses the root cause, not symptoms.
- [ ] At least one alternative hypothesis falsified.
- [ ] Evidence board updated before the fix.
- [ ] Regression test exists and fails without the fix.
- [ ] All existing tests pass.
- [ ] Build succeeds.
- [ ] Original scenario verified end-to-end.
- [ ] UI is visually verified (rendered rect, opacity, display), not just queried from DOM.
- [ ] Boundary guards in place (frame, lifecycle, state).
- [ ] Temporary instrumentation removed unless permanent.
- [ ] Fix explained without jargon.

## How This Skill Evolves

This skill has a **hard line budget of 500 lines**. It does not grow by appending. It grows by replacing.

### Rules for skill maintenance

1. **Line budget is absolute.** Before adding anything, count the current lines. If adding would exceed 500, remove old content first.
2. **Replace, do not append.** New methodology replaces outdated methodology. New diagnostic patterns replace weaker ones.
3. **Only add verified patterns.** A pattern must have solved a real bug. Abstract lessons are not allowed.
4. **Prefer tables over prose.** If a new insight cannot be a table row or checklist item, it is not ready.
5. **Prune annually.** If a section has not been used in six months, remove it.
6. **Code fixes go to `learning-and-apply`.** This skill never stores code techniques.
7. **Update the Maintenance Log.** Every replacement gets a row: date, what changed, which bug verified it.

### Decision flow for adding knowledge

```
Does it help diagnose a class of bugs?
├── No → Reject.
└── Yes → Has it solved a real bug?
    ├── No → Reject.
    └── Yes → Can it replace an older/weaker entry?
        ├── Yes → Replace.
        └── No → Will the file exceed 500 lines?
            ├── Yes → Remove the weakest existing entry, then add.
            └── No → Add.
```

### Good vs bad skill updates

| Update | Verdict | Reason |
|---|---|---|
| Add "trace six desync points" | ✅ Good | Methodological pattern, reusable. |
| Add "test second word of phrase" | ✅ Good | Diagnostic pattern, verified on `learning` bug. |
| Add "use `getTokenStatus` fallback" | ❌ Bad | Code technique, belongs in `learning-and-apply`. |
| Add "code is messy" | ❌ Bad | Opinion, no contract. |
| Keep an unused section because it might help later | ❌ Bad | Skill rots by accumulation. Delete it. |

## Maintenance Log

| Date | Change | Verified by |
|---|---|---|
| 2026-07-22 | Add DOM-vs-visible and probe batching patterns | `learning` popup candidate verification |
| 2026-07-22 | Add repeat-action anti-pattern and first-vs-second failure pattern | `learning` popup candidates disappear on repeat |

Add a row only for verified replacements or additions. Empty rows forbidden. Code fixes forbidden here.

## Timeboxing

If stuck in a loop for more than 20 minutes, escalate:
- Summarize the evidence board.
- List falsified hypotheses.
- State the next experiment.
- Ask one focused question.

Do not spin. A stuck loop means the contract or evidence is incomplete.

## Edge Cases

- One-time production bugs: use telemetry, not reproduction.
- Third-party host page bugs: document and guard, do not fix the host.
- Flaky tests: suspect shared state or order dependence.
- Heisenbugs: add logging without changing timing.
- Cross-browser issues: verify in Chrome, Edge, Brave.
- Memory pressure: suspect quota or eviction.
- Cached data: clear storage and reload when state seems inconsistent.

## Final Note

A debugger who reasons well beats a debugger who codes fast. The loop is the discipline. The contract is the contract. If you cannot write it, you cannot verify it. If you cannot verify it, you cannot ship it.

## Router boomerang

Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route. Router protocol is in AGENTS.md (always-on).
