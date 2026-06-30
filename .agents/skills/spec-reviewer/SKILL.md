---
name: spec-reviewer
description: Reviews PRD/specs from 3 perspectives (Tech Lead feasibility, QA testability, Product scope) before implementation. Use when a new spec is drafted, before G2 planning, or when asked "review this spec", "is this spec ready?", "what's missing in this PRD". Outputs review report with status (APPROVED/APPROVED_WITH_CONDITIONS/BLOCKED), risks, and open questions. Delegates review to Opus 4.8 subagent, falls back to Kimi 2.7 if quota exceeded.
---

# Spec Reviewer

Reviews PRD/specs from 3 perspectives (Tech Lead feasibility, QA testability, Product scope) before implementation. Delegates heavy review work to a subagent running on Opus 4.8 (preferred) or Kimi 2.7 (fallback).

## When to Use

- After G1 Spec is drafted, before G2 Plan
- User asks "is this spec ready for implementation?"
- User asks "what's missing in this PRD?"
- User asks "review this spec" with a spec file path
- Before committing engineering time to a feature

**Trigger phrases:**
- "review this spec"
- "is this spec ready?"
- "what's missing in this PRD?"
- "review the spec before G2"
- "spec review"

## Input

**Required reads (before review — do NOT review from memory):**

1. `docs/intent/idea-<feature>.md` or `docs/intent/intent-<feature>.md` — intent source
2. `docs/specs/spec-<feature>.md` — spec to review
3. `docs/2-architechture-system.md` — architecture map (check spec references real files)
4. `docs/mockups/` — mockup files (if spec references them)
5. Existing code referenced in spec — grep for file paths mentioned in spec, read them

If any required file is missing → report BLOCKED with "Missing input: <file path>".

## Output

Review report saved to `docs/reviews/review-<feature-name>.md`:

- **Status**: `APPROVED` / `APPROVED_WITH_CONDITIONS` / `BLOCKED`
- **Checklist results**: pass/fail/NA per section (Feasibility, Testability, Scope)
- **Risks**: severity (CRITICAL/HIGH/MEDIUM) + section + question
- **Open questions**: list of questions for user
- **Suggested spec updates**: concrete edits

## Model Selection

The review is delegated to a subagent for deep analysis. Model priority:

1. **Opus 4.8** (preferred) — deepest reasoning, best for feasibility + edge case analysis
2. **Kimi 2.7** (fallback) — used when Opus 4.8 quota is exceeded or unavailable

**Selection logic:**
- Try Opus 4.8 first via `run_subagent` with profile `subagent_general`
- If subagent returns quota error or model unavailable → retry with Kimi 2.7
- Record which model was used in the review report header

**Why subagent?** Spec review requires reading 5+ files + cross-referencing spec claims against codebase. Running in subagent keeps the main context clean and allows parallel file reads.

## Process

### Step 1 — Gather inputs

Read all 5 required files (see Input section). If any missing → BLOCKED immediately, no subagent needed.

### Step 2 — Delegate to subagent

Launch a `subagent_general` subagent with the following task:

```
You are a spec reviewer. Review the spec at <spec-path> from 3 perspectives.

Read these files:
1. <intent-path>
2. <spec-path>
3. <arch-path>
4. <mockup-path> (if exists)
5. Grep for file paths mentioned in spec, read them

Run 3 checklists (read each file and check every item):
- .agents/skills/spec-reviewer/checklists/feasibility-checklist.md
- .agents/skills/spec-reviewer/checklists/testability-checklist.md
- .agents/skills/spec-reviewer/checklists/scope-checklist.md

Use the output template:
- .agents/skills/spec-reviewer/templates/review-report-template.md

Return the completed review report.
```

If Opus 4.8 quota exceeded → retry same task with Kimi 2.7.

### Step 3 — Collect subagent output

Read the subagent's review report. Verify:
- All 3 checklists were run (Feasibility, Testability, Scope)
- Status is one of: APPROVED, APPROVED_WITH_CONDITIONS, BLOCKED
- Every FAIL has a corresponding risk entry
- Every CRITICAL risk has a corresponding open question

### Step 4 — Save review report

Save to `docs/reviews/review-<feature-name>.md` using the template format.

Add header:
```markdown
> **Model**: Opus 4.8 / Kimi 2.7 (whichever was used)
> **Date**: <date>
> **Spec**: docs/specs/spec-<feature>.md
```

### Step 5 — Present to user

Show the user:
1. Status (APPROVED / APPROVED_WITH_CONDITIONS / BLOCKED)
2. Risk summary table (severity + section + question)
3. Open questions (if any)
4. Path to full review report

If BLOCKED or APPROVED_WITH_CONDITIONS → list open questions and ask user to answer before proceeding to G2.

## Status Rules

| Status | Condition |
|--------|-----------|
| `APPROVED` | All 3 checklists pass (or NA). No CRITICAL risks. |
| `APPROVED_WITH_CONDITIONS` | 1+ HIGH risks or 1+ FAIL items. Open questions must be answered before G2. |
| `BLOCKED` | 1+ CRITICAL risks OR missing input files OR spec references non-existent files. |

## Verification

After running this skill:

- [ ] All 5 input files were read (not from memory)
- [ ] Subagent was launched (Opus 4.8 or Kimi 2.7)
- [ ] All 3 checklists were run (Feasibility, Testability, Scope)
- [ ] Review report saved to `docs/reviews/review-<feature-name>.md`
- [ ] Status is one of: APPROVED, APPROVED_WITH_CONDITIONS, BLOCKED
- [ ] Every FAIL has a risk entry
- [ ] Every CRITICAL risk has an open question
- [ ] Model used is recorded in report header
- [ ] User was presented with status + risks + open questions

## Boundaries

- **Always do**: Read all input files before review (never review from memory). Use subagent for deep analysis. Record model used. Save review report to `docs/reviews/`.
- **Ask first**: Changing spec content directly (reviewer suggests, user decides). Using a model other than Opus 4.8 or Kimi 2.7.
- **Never do**: Auto-approve a spec with CRITICAL risks. Skip checklist items. Review without reading the spec file. Overwrite an existing review report without user confirmation.
