---
name: debugging-and-error-recovery
description: Guides systematic root-cause debugging through an 8-step user-collaboration protocol. Use when tests fail, builds break, behavior doesn't match expectations, or when a bug is suspected. The skill enforces state the hypothesis, verify with MCP/browser, re-state the bug, get user confirmation, read the codebase, conclude root cause, apply the 7-rung ponytail ladder, then fix.
---

# Debugging and Error Recovery

## Overview

This skill is the **single entry point** for any bug. It auto-invokes sub-skills as needed — the user only calls this one skill:

- Browser-facing extension bug → auto-invokes `extension-browser-debugging` (Step 3 for evidence, Step 8 for verify)
- Other bug types (test/build/API/logic) → handled inline, no sub-skill needed

Do NOT ask the user to call `extension-browser-debugging` separately. This skill is the parent; the sub-skill is invoked automatically when the bug is browser-facing.

This skill is not a generic "find and fix" checklist. It encodes a specific 8-step protocol that the user has defined. **Follow it exactly when invoked.** The goal is to avoid the agent silently guessing a root cause, making changes, and only then asking the user. Instead, the agent:

1. States the suspected bug(s).
2. Re-states the user's requirements.
3. Verifies with real evidence (browser/MCP, tests, logs, code).
4. Re-states the bug for the user and waits for confirmation.
5. Reads the relevant codebase.
6. Concludes the root cause.
7. Applies the 7-rung ponytail ladder.
8. Only then fixes.

## When to Use

- Tests fail, build breaks, runtime mismatch, bug report, error in logs, regression.
- A user says "I think X is a bug" or "this looks wrong".
- Before fixing any non-trivial behavior, especially UI/layout, fullscreen, state transitions, or anything that touches the DOM.

**When NOT to use full protocol:** typo, syntax error, 1-line fix with obvious cause → fix directly + verify.

## The 8-Step Debug Protocol

The agent must follow these steps in order. Do not skip. Do not write code until Step 8.

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

### Step 4 — Re-State the Bug for the User

After verification, the agent tells the user:

1. **What the bug is** — the actual root cause, not the symptom.
2. **Where it is** — file, function, line range if known.
3. **Short description of the buggy behavior** — reproduction steps.
4. **What the user wants / expects** — correct behavior.
5. **Benefit of fixing it** — UX, correctness, stability.

Keep it concise. The user is the gatekeeper. **The agent does not proceed until the user says "đúng", "chuẩn", "fix đi", or similar.**

### Step 5 — Read the Codebase (After User Confirmation)

Only after the user confirms does the agent start reading the relevant code in detail.

- Read the files around the suspected bug.
- Trace the call graph: who calls this function, what does it depend on.
- Identify all state transitions that could be affected.
- Do not modify anything yet.

### Step 6 — Conclude the Root Cause

The agent writes a short conclusion:

- "The root cause is ..."
- Distinguish symptom from cause.
- Mention any contributing factors: state leaks, async race, DOM manipulation, inline style leaks, missing cleanup, etc.

### Step 7 — Apply the Ponytail Ladder (7 Rungs)

Before writing the fix, run the ladder:

1. **YAGNI** — Does this fix need to exist? Maybe the buggy code itself is unnecessary.
2. **Reuse codebase** — grep for an existing fix pattern.
3. **Stdlib** — does the standard library do it?
4. **Native platform** — does a native feature cover it?
5. **Installed dependency** — does an already-installed dep solve it?
6. **One line** — can the fix be one line?
7. **Only then** — write the minimum code that works.

Document the ladder result briefly. Mark intentional simplifications with a `ponytail:` comment (name ceiling + upgrade path).

### Step 8 — Fix

Now the agent may write or edit code.

- Fix the root cause, not the symptom.
- Add a regression test if possible.
- Verify after the fix: unit test, browser, build.
- For UI/layout bugs, verify all state transitions and do a visual check.
- **Browser-facing extension bug** → auto-invoke `extension-browser-debugging` Phase 5-7 (reload extension → re-injection check → state transitions → acceptance-criteria → performance/a11y). Do NOT ask the user to call it separately.

## Stop-the-Line Rules

During any step:

- **Verify before assuming.** Read code + inspect DOM this session before stating a root cause.
- **Preserve evidence.** Screenshot, DOM dump, test output, console log.
- **Track hypotheses.** Never hold >3 competing causes in head; use a small board.
- **Don't push past a failing test.** Fix first, then continue.
- **Don't skip Step 4.** If the user has not confirmed, stop and wait.
- **One fix per layer.** If a bug has multiple layers, commit after each layer and re-verify.

## When to Stop / Escalate

- 3+ fix attempts failed → re-read code from scratch.
- Root cause is third-party code → workaround + ADR.
- Fix requires large refactor → ship symptom fix + debt ticket.
- User rejects the bug framing → go back to Step 2.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know the bug, I'll just fix it" | Right 70% of the time. The other 30% costs hours. Verify first. |
| "The failing test is probably wrong" | Verify. If test is wrong, fix it. Don't skip. |
| "It works on my machine" | Environments differ. Check CI, config, dependencies. |
| "I'll fix it in the next commit" | Fix it now. Next commit adds new bugs on top. |
| "This is a flaky test, ignore it" | Flaky tests mask real bugs. Fix flakiness or understand why. |
| "This is probably because [hypothesis]" | Hypothesis without evidence is a guess. Verify first. |
| "Unit test passes, bug is fixed" | Unit tests don't catch layout/visual bugs. Browser-verify. |
| "I fixed one layer, bug is gone" | Bugs stack. Re-verify after each fix to find the next layer. |

## Verification Checklist

- [ ] Step 1: suspected bugs stated
- [ ] Step 2: user's requirements re-stated
- [ ] Step 3: verified with MCP/browser/test
- [ ] Step 4: bug re-stated and user confirmed
- [ ] Step 5: relevant code read
- [ ] Step 6: root cause concluded
- [ ] Step 7: ponytail ladder applied
- [ ] Step 8: fix applied
- [ ] Regression test added
- [ ] All tests pass, build succeeds
- [ ] UI/layout: all state transitions tested
- [ ] Visual check performed
- [ ] Inline-style leaks audited (every `setProperty(..., 'important')` has a matching restore)
