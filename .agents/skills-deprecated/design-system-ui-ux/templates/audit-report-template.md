# Drift Audit Report Template

> Fill this during Step 5. Re-run quarterly or before major release.

## Audit metadata

- **Date**: <YYYY-MM-DD>
- **Auditor**: <name/agent>
- **Last audit**: <YYYY-MM-DD or "first">
- **Codebase snapshot**: <commit hash>

## Per-axis pass/fail

| Axis | Status | Inconsist count | Critical? | Notes |
|---|---|---|---|---|
| Border-radius | PASS / FAIL | <n> | yes/no | <which files> |
| Color (token vs raw) | PASS / FAIL | <n> | yes/no | <which files> |
| Spacing | PASS / FAIL | <n> | yes/no | <which files> |
| Hover state | PASS / FAIL | <n> | yes/no | <which files> |
| Focus state | PASS / FAIL | <n> | yes/no | <which files> |
| Active/selected state | PASS / FAIL | <n> | yes/no | <which files> |
| Typography (font-size/weight) | PASS / FAIL | <n> | yes/no | <which files> |
| Cross-runtime token coverage | PASS / FAIL | <n> | yes/no | <which contexts> |

**Pass criteria**: 0 critical inconsist on that axis.
**Fail criteria**: ≥1 critical inconsist (token undefined, missing hover/focus, raw hex in production).

## New inconsist since last audit

| # | Description | File:line | Type | Introduced by |
|---|---|---|---|---|
| <n> | <description> | <file:line> | Visual/Architecture/Interaction | <commit/PR> |

## Resolved inconsist since last audit

| # | Description | Resolved by |
|---|---|---|
| <n> | <description> | <commit/PR> |

## Atom registry health

| Atom | Call sites | Drift? | Notes |
|---|---|---|---|
| IconButton | <n> | yes/no | <if drift, which call site diverged> |
| Card | <n> | yes/no | ... |

**Wrong abstraction signals** (back out if any true):
- [ ] Any atom has a `mode` prop changing behavior
- [ ] Any atom has slots for one caller's edge case
- [ ] Any atom file grows faster than features using it
- [ ] Any atom has callbacks through 3 layers for one call site

## Token registry health

- **Total tokens**: <n>
- **Tokens with >3 word names** (Token Fatigue): <n> — list if any
- **Tokens referenced but undefined** (bug): <n> — list if any
- **Mirror file in sync** (if applicable): yes/no

## Recommendation

- [ ] APPROVED — ship as-is
- [ ] APPROVED_WITH_CONDITIONS — fix <n> critical before next release
- [ ] BLOCKED — <n> critical must fix now

## Next audit

- **Scheduled**: <YYYY-MM-DD>
- **Trigger**: quarterly / before major release / new runtime context added
