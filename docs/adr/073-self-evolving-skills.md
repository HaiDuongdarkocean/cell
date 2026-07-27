# ADR-073: Self-evolving agent skills

## Status

Accepted — implemented 2026-08-10.

## Context

Agent skills in `.agents/skills/<name>/SKILL.md` encode decision workflows. Once written, most skills stay static until a human notices a problem and edits them. This creates a gap: the skill that writes skills (`write-skill`) should be able to improve itself, and it should be able to produce other skills that improve themselves from observed usage.

Research in self-referential prompt evolution (Promptbreeder, SePO), meta-learning, and neuroplasticity suggests that a system can learn from its own outputs when it:

- Records outcomes (episodic memory / RUNBOOK).
- Detects repeated failures or missed triggers (error signal / surprise minimization).
- Generates candidate mutations.
- Evaluates them against held-out test cases.
- Replaces the current version only when a candidate is measurably better.
- Rolls back immediately if a regression is detected.

## Decision

1. Add a self-evolution sub-workflow to `write-skill`.
   - When writing or updating a skill, ask: *"Should this skill self-evolve from its own usage?"*.
   - After each run, if the skill has a `self-evolution/` folder, append an entry to `self-evolution/RUNBOOK.md`.
   - When a trigger condition is met, read `self-evolution/RUNBOOK.md`, diagnose, generate candidate mutations using `self-evolution/mutation_prompts.md`, evaluate them against `self-evolution/test_cases.md`, and replace `SKILL.md` only if a candidate scores higher with a safety margin.
   - Keep archived versions in `self-evolution/archive/` for rollback.
2. Make the workflow autonomous and bounded.
   - No human approval is required for routine self-corrections.
   - Automatic safeguards prevent deletion, unbounded growth, and regression.
   - Cooldown periods stop oscillation.
3. Provide reusable templates for any self-evolving skill.
   - Create a `self-evolution/` folder inside the skill directory.
   - `self-evolution/README.md` explains the feature to human readers.
   - `self-evolution/workflow.md` defines the generic loop.
   - `self-evolution/RUNBOOK.md`, `self-evolution/mutation_prompts.md`, `self-evolution/test_cases.md`, and `self-evolution/archive/` hold the data and operators.
4. Keep the main `SKILL.md` under 500 lines.
   - Detailed mechanics live in `self-evolution/workflow.md`.
   - The main file references the `self-evolution/` folder and lists the trigger and safeguards.

## Consequences

- `write-skill` can now update its own `SKILL.md` based on observed behavior.
- New skills may include self-evolution scaffolding, reducing manual maintenance.
- Risk of self-degradation is bounded by archive, regression tests, and cooldowns.
- Self-evolution is opt-in per skill; skills that do not need it remain unchanged.
