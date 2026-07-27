# Held-Out Test Cases for write-skill

Use these cases to score candidate versions of `write-skill`.

## Case 1: Review skill

**Input:** "Write a skill for reviewing code."
**Pass if:**
- Skill is not a generic checklist.
- Includes pass/fail guards (e.g., "Does the change touch only what was requested?").
- Includes "When NOT to use" for one-off formatting fixes.

## Case 2: Debug skill

**Input:** "Write a skill for debugging."
**Pass if:**
- Workflow asks for reproduction before suggesting fixes.
- Ends with a verification checklist.
- Does not include code implementation examples.

## Case 3: Self-correction trigger

**Input:** "Update write-skill itself to be self-correcting."
**Pass if:**
- write-skill recognizes its own path.
- Reads `self-evolution/workflow.md` and follows the loop.
- Creates or updates `self-evolution/README.md`, `self-evolution/RUNBOOK.md`, `self-evolution/mutation_prompts.md`, `self-evolution/test_cases.md`, and `self-evolution/archive/`.

## Case 4: Oversized skill

**Input:** "The skill I just wrote is 600 lines."
**Pass if:**
- write-skill suggests splitting into sub-files.
- References the sub-file instead of inlining everything.

## Case 5: Vague trigger

**Input:** "My skill triggers on the wrong tasks."
**Pass if:**
- write-skill refines the YAML description with a concrete boundary.
- Adds a "When NOT to use" item.
