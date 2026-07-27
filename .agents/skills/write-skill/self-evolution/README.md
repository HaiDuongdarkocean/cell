# Self-Evolution in Agent Skills: A Design Report

> **Note:** This is a human-readable design report, not an agent skill file. It has no YAML frontmatter and is not parsed by the agent loader. The skill only reads `SKILL.md` and files explicitly referenced in `self-evolution/workflow.md`.

## Abstract

This report describes Self-Evolution, an autonomous improvement mechanism for agent `SKILL.md` files. A skill is treated not as static documentation but as a learnable control program. The mechanism records usage episodes, detects repeated failures or missed triggers, generates candidate edits through prompt-based mutation, evaluates candidates against held-out test cases, and replaces the current skill only when a candidate demonstrates a measurable improvement. The design is grounded in experience-dependent neuroplasticity, meta-learning, and self-referential prompt evolution. Automatic safeguards — archive, regression testing, cooldown, and stop conditions — bound the risk of self-degradation. The intended application is any skill that runs repeatedly and produces measurable outcomes.

---

## 1. Introduction

### 1.1 Problem statement

Agent `SKILL.md` files encode decision workflows. Once written, they typically remain unchanged until a human notices a defect. This creates a maintenance gap: the author of the skill is not always the user, and the user is not always able to articulate why the skill failed. Consequently, small ambiguities in description, missing guards, and obsolete examples accumulate over time.

### 1.2 Research question

Can a skill observe its own usage, diagnose its own weaknesses, and modify its own instructions autonomously while remaining safe and reversible?

### 1.3 Hypothesis

A skill represented as a Markdown file can be improved by a closed feedback loop in which (a) every execution produces an observable outcome, (b) repeated patterns of failure generate a directed error signal, (c) candidate edits are produced by a fixed set of mutation operators, and (d) adoption of a candidate is conditional on a held-out fitness test.

### 1.4 Significance

If the hypothesis holds, agent skills can become adaptive systems that improve with use, reducing the manual maintenance burden and increasing robustness against concept drift in the tasks they handle.

---

## 2. Theoretical background

### 2.1 Experience-dependent neuroplasticity

Neural plasticity is the activity-dependent modification of neural circuits (Kleim & Jones, 2008). Ten principles govern effective plasticity, among which the following are most relevant to the present design:

- **Use it or lose it.** Unused pathways degrade; a skill section that is never exercised should be removed.
- **Use it and improve it.** Repeated use strengthens a pathway; a frequently used guard becomes more reliable.
- **Specificity.** The nature of the training determines the nature of the change; a skill should be updated only by task-relevant failures.
- **Salience.** Feedback must be strong enough to drive change; critical failures produce stronger error signals than minor deviations.
- **Repetition.** Sufficient trials are required for durable change; a single failure should not rewrite a skill.

### 2.2 Meta-learning

Meta-learning, or learning to learn, studies how a system improves at learning across tasks (Vanschoren, 2018). A skill that writes skills is already a meta-learning system. Extending this capacity to self-modification means the meta-learner operates on its own control structure, transferring knowledge from many skill-writing episodes into improved instructions.

### 2.3 Self-referential systems and prompt evolution

Maturana and Varela (1972) introduced autopoiesis: a living system produces and maintains the components that produce it. In large language model research, Fernando et al. (2023) demonstrated Promptbreeder, in which an LLM evolves both task prompts and mutation prompts in a self-referential manner. Tao et al. (2026) extended this idea with SePO, treating the prompt optimizer's own system prompt as an optimization target. Shinn et al. (2023) showed that verbal self-reflection stored in episodic memory improves agent performance. These results support the conjecture that a `SKILL.md` file can contain the instructions for its own revision.

---

## 3. Methods

### 3.1 System design

The self-evolution mechanism consists of five files located in a `self-evolution/` folder within the skill directory:

1. **`README.md`** — this report, explaining the feature to human readers.
2. **`workflow.md`** — the operational protocol for self-correction.
3. **`RUNBOOK.md`** — an append-only episodic log of every skill invocation and its outcome.
4. **`mutation_prompts.md`** — a fixed set of operators that generate candidate edits.
5. **`test_cases.md`** — held-out tasks used as a fitness function.
6. **`archive/`** — a directory of previous `SKILL.md` versions for rollback.

### 3.2 Data collection

After each invocation of the skill, one line is appended to `RUNBOOK.md`. Each line contains a timestamp, a brief task description, an outcome classification (`success`, `partial`, or `fail`), and a one-line observation. This log constitutes the primary training signal.

### 3.3 Mutation operators

Candidate edits are generated by applying prompts from `mutation_prompts.md` to the current `SKILL.md`. Example operators include:

- tighten the YAML description;
- add a pass/fail guard to a workflow step;
- insert a Good/Bad example pair;
- remove a section not used in the last ten invocations;
- split the skill if it exceeds 500 lines;
- refine the "When NOT to use" boundary.

### 3.4 Fitness function

Each candidate is scored as follows:

```text
score = pass_rate × 0.50
      + failure_fix_rate × 0.30
      - (line_count / 500) × 0.10
      - (meta_text_count × 0.05)
```

where `pass_rate` is the fraction of `test_cases.md` that pass, `failure_fix_rate` is the fraction of recent `RUNBOOK.md` failures the candidate fixes, `line_count` is the candidate length, and `meta_text_count` is the number of vague meta-sentences.

### 3.5 Safeguards

The following constraints are enforced:

- **Core-section preservation.** Any candidate must retain `name`, `description`, `When to Use`, at least one workflow step, a `Verification` checklist, and a `Router boomerang` section.
- **Archive-before-overwrite.** The current `SKILL.md` is copied to `self-evolution/archive/SKILL.<timestamp>.md` before replacement.
- **Line budget.** Candidates exceeding 500 lines are rejected or split.
- **Scope restriction.** Modifications are limited to files inside the skill directory.
- **Regression testing.** `test_cases.md` is run after every overwrite; if the pass rate drops, the archived version is restored.
- **Stop conditions.** The loop halts after three consecutive non-improving self-corrections, if a candidate would delete `SKILL.md`, or if a candidate removes all workflow steps.

---

## 4. Procedure

The self-correction procedure is executed as follows:

```text
1. Observe
   └── Append one line to self-evolution/RUNBOOK.md.

2. Trigger
   └── Enter self-correction if one of the following holds:
       - a critical failure occurred in the last run;
       - three repeated failures/partials occurred in the last ten runs;
       - ten new episodes have accumulated since the last correction;
       - a section has not been used in the last ten runs;
       - the user explicitly requests self-improvement.

3. Diagnose
   └── Read the last thirty RUNBOOK entries and identify the most valuable fix.

4. Mutate
   └── Apply up to three mutation prompts to produce candidate SKILL.md variants.

5. Evaluate
   └── Score each candidate against self-evolution/test_cases.md and recent failures.

6. Select
   └── If best_score > current_score + 0.05, or a critical failure is fixed, select the candidate.

7. Update
   └── Archive the current SKILL.md and overwrite it with the selected candidate.

8. Validate
   └── Run regression tests. If the pass rate drops, restore the archived version.

9. Cooldown
   └── Suspend self-correction for at least five episodes or twenty-four hours.
```

---

## 5. Application and discussion

### 5.1 When to enable self-evolution

Self-evolution is appropriate when three conditions hold:

1. the skill is invoked repeatedly;
2. its outcomes are measurable as pass/fail or partial success; and
3. the cost of a bad edit is bounded by the archive and rollback mechanism.

Examples include `write-skill` and `browser-testing-with-devtools`. Skills that are invoked rarely or produce purely subjective outputs are poor candidates.

### 5.2 How to enable self-evolution

When `write-skill` writes or updates a skill, it asks whether the skill should self-evolve. If the answer is affirmative, `write-skill` creates the `self-evolution/` folder with the required files. The operator then populates `mutation_prompts.md` and `test_cases.md` with domain-specific content.

### 5.3 How to monitor and disable

The operator monitors `RUNBOOK.md` to see what the skill has learned and inspects `archive/` for previous versions. To disable self-evolution, the operator removes the `self-evolution/` folder and the `Self-Evolution` section from `SKILL.md`.

### 5.4 Limitations

The quality of self-evolution depends on the quality of `test_cases.md` and `RUNBOOK.md`. The mechanism cannot invent new capabilities; it can only refine existing instructions. A poorly designed fitness function may reward the wrong behavior. Finally, the system assumes that the LLM can reliably evaluate its own candidate edits, an assumption that is itself subject to empirical verification.

---

## 6. Conclusion

Self-Evolution treats an agent skill as a learnable program. By combining episodic memory, mutation operators, a fitness function, and rollback safeguards, the mechanism enables a skill to improve autonomously from its own usage. The design is grounded in neuroplasticity, meta-learning, and self-referential prompt evolution. Future work should evaluate the rate and direction of improvement across a diverse set of skills and determine the minimal test-case set required for stable self-improvement.

---

## References

- Kleim, J. A., & Jones, T. A. (2008). Principles of experience-dependent neural plasticity: Implications for rehabilitation after brain damage. *Journal of Speech, Language, and Hearing Research*, 51(1), S225-S239.
- Vanschoren, J. (2018). Meta-learning: A survey. *arXiv:1810.03548*.
- Fernando, C., Banarse, D., Michalewski, H., Osindero, S., & Rocktäschel, T. (2023). Promptbreeder: Self-referential self-improvement via prompt evolution. *arXiv:2309.16797*.
- Tao, W., Wu, H., & Wong, W. F. (2026). SePO: Self-evolving prompt agent for system prompt optimization. *arXiv:2606.04465*.
- Shinn, N., Cassano, F., Berman, E., Gopinath, A., Narasimhan, K., & Yao, S. (2023). Reflexion: Language agents with verbal reinforcement learning. *Advances in Neural Information Processing Systems 36 (NeurIPS 2023)*.
- Maturana, H. R., & Varela, F. J. (1972). *Autopoiesis and cognition: The realization of the living*. D. Reidel Publishing Company.
