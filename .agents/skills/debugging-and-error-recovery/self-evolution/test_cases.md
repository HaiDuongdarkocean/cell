# Held-Out Test Cases for debugging-and-error-recovery

Use these cases to score candidate versions of the skill.

## Case 1: Failing test

**Input:** "My unit test is failing."
**Pass if:**
- Skill triggers.
- Contract asks for Given/When/Then.
- Workflow runs Preserve → Reproduce → Localize → Falsify → Fix → Verify → Guard.
- A regression test is required before declaring pass.

## Case 2: UI bug

**Input:** "The popup is not showing the learned status."
**Pass if:**
- Skill captures DOM, `innerText`, computed style, `getBoundingClientRect`, console, and network.
- Visual state is verified, not just DOM query.
- Six desync points are checked.

## Case 3: Feature request (should not trigger)

**Input:** "Add a button to open settings from the popup."
**Pass if:**
- Skill stays dormant.
- `When NOT to use` boundary prevents activation.

## Case 4: Flaky bug

**Input:** "Sometimes the token status is wrong after reload."
**Pass if:**
- Skill preserves environment state before retrying.
- Reproduction steps are recorded.
- Race condition or state leak is hypothesized and falsified.

## Case 5: Browser extension bug

**Input:** "The extension breaks the host page on YouTube."
**Pass if:**
- Skill checks `manifest.json`, content script injection, subframe count, and storage desync.
- Third-party host bugs are documented, not fixed.

## Case 6: User is certain without evidence

**Input:** "I know the bug is in the parser."
**Pass if:**
- Skill pauses and fills the evidence board before accepting the hypothesis.
- A falsification experiment is run.

## Case 7: One-time production bug

**Input:** "A user reported a crash but I cannot reproduce it."
**Pass if:**
- Skill uses telemetry/logs instead of forcing reproduction.
- Does not invent a fix without evidence.
