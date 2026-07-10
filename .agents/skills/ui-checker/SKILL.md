---
name: ui-checker
description: Automated UI checker that runs acceptance tests (AT1-AT7) against an implemented screen using MCP edge-devtools (machine-verifiable) plus an adversarial subagent for cognitive judgment (AI-verifiable). No human eyes required. Outputs PASS or a severity-rated FAIL list. Use after UI implementation, before shipping, to verify the screen matches its UI-UX-Contract. Triggers on "check this UI", "run UI ATs", "verify UI against contract", "is this UI ready to ship", "automated UI review". Do NOT use for code logic, security, or performance review (other skills cover those). Do NOT use without a UI-UX-Contract (the contract is the standard this checker grades against).
---

# UI Checker — automated ATs via MCP + adversarial subagent

Two layers, both automated, no human eyes:

```
Layer 1 — MCP ATs (machine-verifiable, exit 0/1)
  install_extension → navigate → snapshot → evaluate_script → lighthouse → console → grep
  Checks: AT1.sees_in_3s, AT1.knows_what_to_do, AT2, AT3, AT4, AT5, AT6, AT7
  STOP: all machine-verifiable ATs pass

Layer 2 — Adversarial subagent (AI-verifiable, no human)
  spawn qa subagent → reads snapshot + screenshot → chấm AT1.needs_guide by rubric
  STOP: PASS or 3 rounds → escalate anh
```

## When to Use

- After UI implementation, before shipping.
- When the implement loop finishes a screen and needs independent verification.
- When the user asks "is this UI ready to ship" or "check UI against contract".

**Triggers**: "check this UI", "run UI ATs", "verify UI against contract", "is this UI ready to ship", "automated UI review".

**When NOT to use**: no UI-UX-Contract exists (run `design-driven-development` first); code logic / security / performance review (use other skills); unit tests not yet passing (run TDD layer first — this checker assumes unit tests are green).

## Input

| # | Input | Source | Why |
|---|---|---|---|
| 1 | **UI-UX-Contract.md** | `design-driven-development` output | The standard this checker grades against. Contains placement matrix, flows, states, ATs, design system reference. |
| 2 | **Built extension** | `dist/` (run `npm run build` first) | MCP installs this to test in real browser. |
| 3 | **Code files** | `src/<feature>/*.tsx`, `*.module.css` | For grep-based ATs (anti-slop, hex, ARIA). |
| 4 | **MCP edge-devtools** | configured MCP server | Provides browser automation: install, navigate, snapshot, evaluate, lighthouse, console. |

## Output

- **Review report**: `evidence/<screen>/review-round-N.md` — PASS or FAIL per AT, severity-rated fails.
- **Addendum** (if FAIL): appended to `UI-UX-Contract.md` under `addendum:` — each fail with severity, detail, fix instruction.
- **Evidence**: screenshots, console log, a11y report saved to `evidence/<screen>/`.

## Process

### Step 0 — Prerequisites check

Before running, confirm:
- [ ] `UI-UX-Contract.md` exists and is approved (Gate 2 passed).
- [ ] `npm run test:unit` exits 0 (unit tests green — TDD layer done).
- [ ] `npm run build` succeeds and `dist/` is fresh.
- [ ] MCP `edge-devtools` server is available (call `mcp_list_tools` for `edge-devtools`).

If any missing → stop, report what is missing, do not proceed.

### Step 1 — Read the contract

Read `UI-UX-Contract.md` in full. Extract:
- `functions:` — placement matrix (for AT7).
- `flows:` — task step counts (for AT2).
- `states:` — per-component state table (for AT7).
- `a11y:` — ARIA expectations (for AT4, AT7).
- `anti_slop.bans:` — ban list (for AT3, AT7).
- `acceptance_tests:` — AT1-AT7 definitions.
- `first_glance:` — expected 3s view (for AT1).
- `design_system:` — reference path (for AT7 token compliance).

### Step 2 — Install extension + navigate

```
mcp.install_extension({ path: "<abs path to dist/>" })
mcp.new_page({ url: "chrome-extension://<id>/options.html" })  // or popup, content
```

If install fails → stop, report. If navigate fails → check manifest, report.

### Layer 1 — MCP ATs (machine-verifiable)

Run each AT via MCP. Read `checklists/mcp-ats-checklist.md` for the exact MCP commands + evaluate_script functions per AT.

| AT | Method | MCP tools | Pass |
|----|--------|-----------|------|
| AT1a sees_in_3s | assert title + nav + primary CTA visible in first viewport | `take_snapshot` + assert bounding box in viewport | all 3 visible |
| AT1b knows_what_to_do | assert exactly 1 primary action visible, no 2+ equal-weight buttons | `evaluate_script` | count=1 |
| AT2 flow step count | count steps per task via DOM interaction | `click` + `take_snapshot` per step | all ≤3 |
| AT3 visual tell sweep | grep code for em-dash, Inter, purple, hex; snapshot for visual tells | `evaluate_script` + grep | zero tells |
| AT4 a11y runtime | lighthouse audit + ARIA assert | `lighthouse_audit` + `evaluate_script` | 0 violations |
| AT5 console clean | list console messages, count errors | `list_console_messages` | 0 errors |
| AT6 responsive | emulate 375px, assert no h-scroll + targets ≥44px + single-column | `emulate` + `evaluate_script` | all pass |
| AT7 contract compliance | grep code for hex, Inter, ARIA mismatch; assert placement matches | `evaluate_script` + grep | 100% match |

**Layer 1 STOP**: all machine-verifiable ATs pass. If any fail → record fail, do NOT proceed to Layer 2 (no point champing cognitive if DOM is broken).

### Layer 2 — Adversarial subagent (AI-verifiable)

Only AT1.needs_guide requires this — it is cognitive judgment ("does the user understand what to do next?"). Machine can measure "CTA visible" but not "CTA clear enough to act on".

```
spawn subagent (qa profile, is_background=false):
  task: |
    You are an adversarial UI reviewer. Read the snapshot and screenshot of the Options page.
    Chấm AT1.needs_guide by this rubric (answer each, then verdict):

    1. Is there exactly 1 clear next action the user understands without reading instructions?
       - YES if 1 primary CTA is visually dominant and its label is a verb phrase ("Import dictionary", not "OK").
       - NO if 2+ actions compete for attention, or the primary action label is vague.

    2. Is there any element that would confuse a new user?
       - YES (confusing) if: unlabelled icon, jargon term, dead-end link, ambiguous state.
       - NO (clear) if: every visible element has a clear purpose or is removed.

    3. Does the snapshot structure communicate the page's purpose in 3 seconds?
       - YES if: title + nav + primary zone form a clear hierarchy (title says what page, nav says what sections, primary zone says what to do).
       - NO if: structure is flat, no hierarchy, user cannot tell what matters.

    Verdict:
    - PASS if all 3 are YES.
    - FAIL if any is NO. List each NO with: question number, what you saw, why it fails, fix instruction.

    Output JSON: { verdict: "PASS"|"FAIL", fails: [{ question, observed, why, fix }] }
  input: |
    - snapshot: <paste take_snapshot output>
    - screenshot: <path to take_screenshot output>
    - contract first_glance: <paste from UI-UX-Contract.md>
```

**Layer 2 STOP**: PASS → ship. FAIL → record, retry up to 3 rounds. After 3 rounds → escalate anh (report what keeps failing).

### Step 3 — Capture evidence

Save to `evidence/<screen>/`:
- `desktop.png` — `take_screenshot` at 1440x900
- `mobile.png` — `take_screenshot` at 375x812 (after `emulate`)
- `console.txt` — `list_console_messages` output
- `a11y.json` — `lighthouse_audit` output
- `snapshot.json` — `take_snapshot` output
- `ats-result.json` — Layer 1 results per AT
- `cognitive-review.json` — Layer 2 subagent output

### Step 4 — Compile review report

Write `evidence/<screen>/review-round-N.md`:

```markdown
# UI Check — Round N

## Summary
- Overall: PASS / FAIL
- Layer 1 (MCP ATs): X/8 passed
- Layer 2 (cognitive): PASS / FAIL (round M of 3)

## Layer 1 — MCP ATs
| AT | Name | Result | Notes |
|----|------|--------|-------|
| AT1a | sees_in_3s | PASS/FAIL | <notes> |
| AT1b | knows_what_to_do | PASS/FAIL | <notes> |
| AT2 | flow step count | PASS/FAIL | <notes> |
| AT3 | visual tell sweep | PASS/FAIL | <notes> |
| AT4 | a11y runtime | PASS/FAIL | <notes> |
| AT5 | console clean | PASS/FAIL | <notes> |
| AT6 | responsive | PASS/FAIL | <notes> |
| AT7 | contract compliance | PASS/FAIL | <notes> |

## Layer 2 — Cognitive (adversarial subagent)
- Verdict: PASS / FAIL
- Fails (if any): <from subagent output>

## Verdict
- PASS: ship.
- FAIL: see addendum for fixes.
```

### Step 5 — Write addendum (if FAIL)

If any AT failed or Layer 2 FAIL, append to `UI-UX-Contract.md` under `addendum:`:

```yaml
addendum:
  round_N:
    layer1_fails:
      - at_id: AT3
        severity: 3
        detail: "<what failed>"
        fix: "<what implementer must change>"
    layer2_fails:
      - question: 2
        severity: 3
        detail: "<what subagent observed>"
        fix: "<fix instruction>"
```

The implement loop reads this addendum, fixes, rebuilds, re-runs this checker. Max 3 rounds → escalate anh.

## Verification

After running this skill:
- [ ] Prerequisites checked (contract exists, unit green, build fresh, MCP available).
- [ ] Layer 1: all 8 machine-verifiable ATs run, each has PASS/FAIL + notes.
- [ ] Layer 2: adversarial subagent spawned, AT1.needs_guide verdict recorded.
- [ ] Evidence saved to `evidence/<screen>/` (screenshots, console, a11y, snapshot, results).
- [ ] Review report saved to `evidence/<screen>/review-round-N.md`.
- [ ] If FAIL: addendum appended to `UI-UX-Contract.md` with fix instructions.
- [ ] If PASS: verdict is "ship" with no addendum.

## Boundaries

**Always do**: read the contract before checking. Check against the contract, not personal taste. Run Layer 1 before Layer 2 (cheap before expensive). Save evidence every round. Escalate after 3 rounds.
**Ask first**: if the contract is ambiguous (function has no placement row), flag as contract gap, do not guess.
**Never do**: modify code (read-only checker). Skip Layer 1 to save time (DOM broken → cognitive meaningless). Give PASS without running all 8 machine ATs. Give FAIL without a fix instruction. Run Layer 2 if Layer 1 failed (waste of subagent tokens).

## Anti-patterns

- **Skipping Layer 1, jumping to Layer 2** → cognitive subagent champing a broken DOM. Layer 1 is cheap (MCP, no LLM), Layer 2 is expensive (subagent, LLM). Always Layer 1 first.
- **No contract** → checking against personal taste. The contract is the objective standard. Without it, fails are subjective and the implementer cannot fix systematically.
- **Re-running after every tiny fix** → run full Layer 1 + Layer 2 each round, not partial. Partial checks miss regressions.
- **Vague fail notes** → "feels off" is not a fix. "3 cards equal width; contract specifies asymmetric 2-col zig-zag (section 5, functions F1-F3)" is a fix.
- **Self-checking** → the implement loop cannot invoke this on its own work. Spawn this as an independent subagent. Self-check = contract violation (maker-checker split).

## Red Flags

- You are checking without reading `UI-UX-Contract.md`. Stop. Read it first.
- You are about to edit a code file. Stop. This is read-only. Write report + addendum only.
- You gave PASS but did not run all 8 machine ATs. Re-run the missing ones.
- Layer 1 failed but you spawned Layer 2. Stop. Fix Layer 1 first.
- You are reviewing code logic or security. Stop. This is UI only. Flag for another checker.
- Your fail note says "feels wrong". Rewrite with: AT id, expected (from contract), actual (from MCP/subagent).

## Supporting files

- `checklists/mcp-ats-checklist.md` — exact MCP commands + evaluate_script functions per AT.
