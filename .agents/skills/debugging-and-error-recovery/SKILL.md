---
name: debugging-and-error-recovery
description: Guides systematic root-cause debugging through a 9-step user-collaboration protocol with confidence-gated hypothesis verification. Use when tests fail, builds break, behavior doesn't match expectations, or when a bug is suspected. The skill enforces state the hypothesis, verify with MCP/browser, inject snippet to test hypothesis directly + score confidence %, re-state the bug, get user confirmation, read the codebase, conclude root cause, apply the 7-rung ponytail ladder, then fix. Triggers on "bug", "debug", "tests fail", "build breaks", "behavior doesn't match", "regression", "this looks wrong".
---

# Debugging and Error Recovery

## Overview

This skill is the **single entry point** for any bug. It auto-invokes sub-skills as needed — the user only calls this one skill:

```
Bug type?
├── Browser-facing (UI/DOM/video/content-script/extension)
│   └── auto-invoke `extension-browser-debugging` (Step 3 evidence + Step 9 verify)
├── API/background bug → read network logs, SW console, MCP
├── Test failure → run test, read full output
├── Build failure → run build, read error
└── State-dependent → reproduce exact state transition
```

Do NOT ask the user to call `extension-browser-debugging` separately. This skill is the parent; the sub-skill is invoked automatically when the bug is browser-facing.

This skill is not a generic "find and fix" checklist. It encodes a specific 9-step protocol. **Follow it exactly when invoked.** The goal is to avoid the agent silently guessing a root cause, making changes, and only then asking the user. Instead, the agent:

1. States the suspected bug(s).
2. Re-states the user's requirements.
3. Verifies with real evidence (browser/MCP, tests, logs, code).
4. **Injects snippet to test hypothesis directly + scores confidence %** (only fix when ≥90%).
5. Re-states the bug for the user and waits for confirmation.
6. Reads the relevant codebase.
7. Concludes the root cause.
8. Applies the 7-rung ponytail ladder.
9. Only then fixes.

## When to Use

- Tests fail, build breaks, runtime mismatch, bug report, error in logs, regression.
- A user says "I think X is a bug" or "this looks wrong".
- Before fixing any non-trivial behavior, especially UI/layout, fullscreen, state transitions, or anything that touches the DOM.

**When NOT to use full protocol:** typo, syntax error, 1-line fix with obvious cause → fix directly + verify.

## Input

- **User bug report**: description of symptom + reproduction steps + expected vs actual behavior.
- **Code**: the codebase where the bug lives (agent reads it during Step 3+).
- **Environment**: browser/Node version, extension build, test runner output (agent gathers during Step 3).

## Output

- **Root cause conclusion**: "The root cause is X (not the symptom Y)".
- **Confidence score**: percentage with evidence breakdown (Step 4).
- **Fix**: code change targeting root cause + regression test.
- **Verification**: test pass + browser check (for browser-facing bugs) + build success.

## The 9-Step Debug Protocol

The agent must follow these steps in order. Do not skip. Do not write code until Step 9.

### Step 1 — State the Suspected Bugs

The agent reads the user's description and any existing code, then **states, in its own words, what bugs it believes exist**.

- List each suspected bug as a separate bullet.
- Include the symptom (what looks wrong) and the suspected cause (where/why it happens).
- Do not fix anything yet. Do not ask the user for confirmation yet.
- Be honest about uncertainty: mark items as **likely**, **possible**, or **needs verification**.

### Step 2 — Re-State the User's Requirements

The agent summarizes the user's request and the bugs the user is concerned about.

- Re-state what the user wants to check or fix.
- List the bugs the user mentioned.
- List any additional bugs the agent suspects from Step 1.
- Ask clarifying questions if any requirement is ambiguous.

This step ensures the agent and the user share the same mental model before moving on.

### Step 3 — Verify with Real Evidence

The agent uses the best available tool to test the hypothesis. **Auto-invoke the matching sub-skill** — do not ask the user to call it separately:

- **Browser-facing bug** (UI, layout, fullscreen, DOM, video, extension content script) → **auto-invoke `extension-browser-debugging` skill**. It provides the MCP tooling: `install_extension`, `evaluate_script` snippets (measure, styles, F0, fullscreen, a11y), DataTransfer drop simulation, `chrome.storage` preconditions, theme token verification, C1-Cn acceptance-criteria verification. Run its Phase 0-2 (install extension → reproduce → inspect) to gather evidence. Do NOT ask the user to call `extension-browser-debugging` separately — this skill is the entry point, the sub-skill is invoked automatically.
- **API/background bug** → read network logs, background script logs, or use MCP.
- **Test failure** → run the test, read the full output.
- **Build failure** → run the build, read the error.
- **State-dependent bug** → reproduce the exact state transition carefully.

The goal is to determine: **Is the suspected bug real? Or is the actual bug somewhere else?**

Rules:
- Do not assume the first hypothesis is correct.
- If MCP is not available, say so and use the next-best evidence (unit test, code trace).
- Document exactly what was observed, including DOM measurements, screenshots, console errors, or test output.
- For UI/layout bugs, verify the **state transitions**, not just the initial state.

### Step 4 — Confidence-Gate via Snippet Injection

**This is the key gate before fixing.** The agent does NOT proceed to fix based on code-trace hypothesis alone. Instead, it **injects a snippet to test the hypothesis directly** and **scores confidence as a percentage**.

#### 4a — Inject a test snippet

Write a minimal, side-effect-free snippet that **proves or disproves** the hypothesis in the real environment:

| Bug type | Snippet method | Example |
|---|---|---|
| Browser-facing | `evaluate_script` via MCP (`edge-devtools`/`chrome-devtools`/`mcp-playwright`) — simulate the fix logic inline, fetch real data, run real detection | Simulate `extractLanguage` with ISO validation on the real subtitle URL; fetch subtitle content; run English profile topWords match |
| API/background | Inject `console.log` at the suspected code path + trigger the flow; or write a 5-line Node REPL script | Log `findSubtitlesForOverlay` input + output in SW; check if result is null |
| Test failure | Add a temporary `it('hypothesis: ...')` test that asserts the suspected cause | `it('extractLanguage returns "sub" for kisskh URL', () => expect(extractLanguage(url)).toBe('sub'))` |
| Build failure | Isolate the failing line in a temp file + run `tsc` on it alone | `echo "const x: string = 123;" > tmp.ts && npx tsc tmp.ts` |
| Logic/state | Write a 10-line assert-based demo script that reproduces the state transition | `assert(stateAfter === expected)` |

**Snippet rules:**
- The snippet must **simulate the proposed fix** (not just reproduce the bug — that was Step 3).
- The snippet must use **real data from the real environment** (real URL, real fetch, real DOM, real settings).
- The snippet must be **side-effect-free** (no file writes, no extension reload, no storage mutation).
- If the snippet cannot prove the hypothesis (e.g. CORS blocks fetch, MCP unavailable), say so and fall back to code-trace confidence (lower score).

#### 4b — Score confidence as a percentage

After the snippet runs, the agent **scores confidence** that the proposed fix will work. Report the score as a table:

```
| Step | Result | Confidence |
|---|---|---|
| Hypothesis: extractLanguage returns "sub" | ✅ confirmed | 100% |
| Fix: ISO validation → "unknown" | ✅ confirmed | 100% |
| detectLanguage will match English | ✅ 10/10 topWords match (threshold 8) | 95% |
| labelToIsoCode("english") → "en" → matches settings | ✅ code trace | 100% |
| Overall | | 95% |
```

**Confidence scoring guide:**

| Score | Meaning | Action |
|---|---|---|
| ≥90% | Hypothesis proven with real data | **Proceed to Step 5** (re-state bug for user) |
| 70-89% | Hypothesis likely but has residual risk | **Iterate** (see 4b-decision below) — close the gap with 1 more snippet, OR proceed but **name the residual risk explicitly** to the user |
| <70% | Hypothesis not proven or disproven | **Iterate or Pivot** (see 4b-decision below) — do NOT proceed to fix |

#### 4b-decision — Iterate vs Pivot (when confidence <90%)

When confidence is below 90%, the agent does NOT give up and does NOT proceed to fix. It must first decide: **can the current solution be improved, or should we pivot to a different approach?**

```
Confidence < 90%?
├── Is there a identifiable gap in the evidence? (e.g. "didn't test with real data", "didn't verify the downstream call", "didn't check the edge case")
│   ├── YES → ITERATE: add 1 more snippet to close the specific gap → re-score
│   │   └── Max 2 iterations. If still <90% after 2 iterations → Pivot or Escalate.
│   └── NO  → the hypothesis itself may be wrong
│       └── PIVOT: brainstorm alternative root causes (Step 1) → pick the one with highest potential confidence → new snippet → re-score
│           └── If no alternative hypothesis has >50% potential → ESCALATE to user (ask for help, missing environment access, third-party blocker)
```

**Iterate (improve current solution) — when to choose:**
- The snippet proved the core hypothesis but missed a downstream step (e.g. proved `extractLanguage` fix works, but didn't verify `resolveUnknownSubtitleLanguages` actually fires).
- The snippet used simulated data; real data might behave differently (e.g. CORS blocked fetch → retry via background SW fetch).
- One edge case wasn't tested (e.g. multi-language subtitle, empty subtitle, non-SRT format).
- **Action**: Write 1 more snippet targeting the specific gap. Re-score. Max 2 iterations.

**Pivot (switch to a different approach) — when to choose:**
- The snippet **disproved** the hypothesis (e.g. `extractLanguage` fix works but `detectLanguage` still returns null because the subtitle is actually Chinese, not English).
- The hypothesis is correct but the **fix approach is wrong** (e.g. ISO validation works but breaks 5 existing tests → pivot to a different validation strategy).
- After 2 iterations, confidence is still <90% with no identifiable gap.
- **Action**: Go back to Step 1, brainstorm at least 2 alternative root causes or fix approaches. Pick the one with the highest potential confidence. Write a new snippet. Re-score from scratch.

**Escalate — when to choose:**
- No alternative hypothesis has >50% potential confidence.
- The snippet cannot run (MCP unavailable, CORS unblockable, third-party blocks).
- After 1 pivot, confidence is still <70%.
- **Action**: Stop. Tell the user: "Confidence stuck at X% after Y iterations + 1 pivot. I need help with: [specific blocker]. Possible alternatives: [list]."

**Bad:** "Confidence 75%, let me just fix it and see what happens." (gambling, not engineering)
**Good:** "Confidence 75% — core hypothesis proven but `detectLanguage` script-gating unverified. Iterating: injecting snippet #2 to run the real `detectLanguage` on the fetched subtitle text. If this confirms English detection, confidence → 95%."

**Bad:** "Confidence 60%, let me try a different fix." (vague pivot, no alternative hypothesis)
**Good:** "Confidence 60% — hypothesis disproven: subtitle is Chinese, not English. Pivoting to alternative hypothesis: the issue is that `settings.subtitleOverlayTargetLanguage` is wrong, not the detection. New snippet: check `chrome.storage.local` settings value."

#### 4c — Report to user

State the confidence score + evidence table + residual risk. The user sees the confidence before the agent proceeds. This is **not** the Step 5 confirmation gate — it is the agent's self-assessment that the hypothesis is worth proposing.

### Step 5 — Re-State the Bug for the User

After verification + confidence scoring, the agent tells the user:

1. **What the bug is** — the actual root cause, not the symptom.
2. **Where it is** — file, function, line range if known.
3. **Short description of the buggy behavior** — reproduction steps.
4. **What the user wants / expects** — correct behavior.
5. **Benefit of fixing it** — UX, correctness, stability.
6. **Confidence score** — from Step 4 (e.g. "Confidence 95% — see evidence table above").

Keep it concise. The user is the gatekeeper. **The agent does not proceed until the user says "đúng", "chuẩn", "fix đi", "ok tiếp tục", or similar.**

### Step 6 — Read the Codebase (After User Confirmation)

Only after the user confirms does the agent start reading the relevant code in detail.

- Read the files around the suspected bug.
- Trace the call graph: who calls this function, what does it depend on.
- Identify all state transitions that could be affected.
- Do not modify anything yet.

### Step 7 — Conclude the Root Cause

The agent writes a short conclusion:

- "The root cause is ..."
- Distinguish symptom from cause.
- Mention any contributing factors: state leaks, async race, DOM manipulation, inline style leaks, missing cleanup, etc.

### Step 8 — Apply the Ponytail Ladder (7 Rungs)

Before writing the fix, run the ladder:

1. **YAGNI** — Does this fix need to exist? Maybe the buggy code itself is unnecessary.
2. **Reuse codebase** — grep for an existing fix pattern.
3. **Stdlib** — does the standard library do it?
4. **Native platform** — does a native feature cover it?
5. **Installed dependency** — does an already-installed dep solve it?
6. **One line** — can the fix be one line?
7. **Only then** — write the minimum code that works.

Document the ladder result briefly. Mark intentional simplifications with a `ponytail:` comment (name ceiling + upgrade path).

### Step 9 — Fix

Now the agent may write or edit code.

- Fix the root cause, not the symptom.
- Add a regression test if possible.
- Verify after the fix: unit test, browser, build.
- For UI/layout bugs, verify all state transitions and do a visual check.
- **Browser-facing extension bug** → auto-invoke `extension-browser-debugging` Phase 5-7 (reload extension → re-injection check → state transitions → acceptance-criteria → performance/a11y). Do NOT ask the user to call it separately.

## Stop-the-Line Rules

During any step:

- **Verify before assuming.** Read code + inspect DOM this session before stating a root cause.
- **Inject before fixing.** Snippet-test the hypothesis (Step 4) before writing any fix code (Step 9). No fix based on code-trace hypothesis alone.
- **Score before proceeding.** Confidence <90% → iterate (close the gap) or pivot (switch approach) or escalate (ask user). Do not fix.
- **Preserve evidence.** Screenshot, DOM dump, test output, console log, snippet result.
- **Track hypotheses.** Never hold >3 competing causes in head; use a small board.
- **Don't push past a failing test.** Fix first, then continue.
- **Don't skip Step 5.** If the user has not confirmed, stop and wait.
- **One fix per layer.** If a bug has multiple layers, commit after each layer and re-verify.

## When to Stop / Escalate

- 3+ fix attempts failed → re-read code from scratch.
- Confidence stuck <90% after 2 iterations + 1 pivot → escalate to user (specific blocker + possible alternatives).
- Confidence stuck <70% after 1 pivot → escalate immediately (do not attempt a 2nd pivot without user input).
- Root cause is third-party code → workaround + ADR.
- Fix requires large refactor → ship symptom fix + debt ticket.
- User rejects the bug framing → go back to Step 2.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know the bug, I'll just fix it" | Right 70% of the time. The other 30% costs hours. Verify first. |
| "Code trace is enough, no need to inject snippet" | Code trace proves the hypothesis is plausible, not that the fix works. Inject a snippet (Step 4) to prove it with real data. |
| "I'm confident this will work" | Vague confidence is a guess. Score it as a % with an evidence table (Step 4b). |
| "The failing test is probably wrong" | Verify. If test is wrong, fix it. Don't skip. |
| "It works on my machine" | Environments differ. Check CI, config, dependencies. |
| "I'll fix it in the next commit" | Fix it now. Next commit adds new bugs on top. |
| "This is a flaky test, ignore it" | Flaky tests mask real bugs. Fix flakiness or understand why. |
| "This is probably because [hypothesis]" | Hypothesis without evidence is a guess. Verify first. |
| "Unit test passes, bug is fixed" | Unit tests don't catch layout/visual bugs. Browser-verify. |
| "I fixed one layer, bug is gone" | Bugs stack. Re-verify after each fix to find the next layer. |
| "Confidence 90%, no residual risk" | Every fix has residual risk. Name it explicitly (Step 4b). |
| "Confidence 75%, let me just fix it and see" | Gambling, not engineering. <90% → iterate (close the gap) or pivot (switch approach), do not fix-and-pray. |
| "Confidence 60%, let me try a different fix" | Vague pivot. A pivot needs a named alternative hypothesis + a new snippet, not a random retry. |
| "2 iterations done, still 80%, I'll proceed" | 80% after 2 iterations = no more identifiable gaps. Pivot to a different approach or escalate. Do not proceed with known-unverifiable risk. |

## Verification Checklist

- [ ] Step 1: suspected bugs stated
- [ ] Step 2: user's requirements re-stated
- [ ] Step 3: verified with MCP/browser/test
- [ ] Step 4: snippet injected + confidence scored (≥90% to proceed, <90% → iterate/pivot/escalate)
- [ ] Step 5: bug re-stated + confidence reported + user confirmed
- [ ] Step 6: relevant code read
- [ ] Step 7: root cause concluded
- [ ] Step 8: ponytail ladder applied
- [ ] Step 9: fix applied
- [ ] Regression test added
- [ ] All tests pass, build succeeds
- [ ] UI/layout: all state transitions tested
- [ ] Visual check performed
- [ ] Inline-style leaks audited (every `setProperty(..., 'important')` has a matching restore)
