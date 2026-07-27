---
name: write-skill
description: Guides agents through writing, reviewing, refactoring, and self-correcting agent SKILL.md workflow files. Use when creating a new skill, updating an existing skill, splitting an oversized skill, diagnosing why a skill fails to trigger, or making a skill self-correcting. Not for writing general documentation, one-off prompts, or implementation code.
---

# Write Skill

## Overview

A skill is not a note, a cheat sheet, or a list of tips. It is a decision workflow encoded as a markdown file with guard conditions, loops, and verification. Writing a skill means turning an implicit habit into an explicit process another agent can run. Good skills are small, opinionated, and falsifiable.

Only the `name` and `description` in the YAML frontmatter influence whether an agent triggers the skill. The body determines what the skill does once triggered.

## When to Use

- You want to capture a recurring decision process (debugging, scoping, reviewing, designing, etc.).
- A pattern keeps solving real problems and you want other agents to reuse it.
- You are about to write instructions that span more than a few turns.
- You need to prune, split, or refactor an existing skill.
- A skill is triggering too often, too rarely, or on the wrong tasks.
- You want a skill to self-correct based on its own usage (self-evolution).

**When NOT to use:**

- One-off command or a single code snippet (use docs or comments instead).
- A generic checklist without loop-backs and guards.
- A tutorial or reference material.
- A workflow that has never been tested on a real task.
- Writing implementation code or long-form documentation.

## What a Skill Stores

A skill stores a *decision process*, not facts or code.

| Type | What it is | Good in a skill? | Better home |
|---|---|---|---|
| Methodology | Reusable way to reason | Yes | — |
| Diagnostic pattern | Signature you recognize after applying the methodology | Yes | — |
| Workflow gate | A condition that must pass before advancing | Yes | — |
| Trigger rules | When the skill activates and when it stays dormant | Yes | — |
| Code technique | Concrete implementation | No | `learning-and-apply` |
| Reference data | Facts, constants, API listings | No | `docs/specs/` |
| Opinion | Unverified preference | No | nowhere |

## The Skill Anatomy

Every skill lives in its own directory under the project's skill directory (commonly `.agents/skills/<name>/`). The only required file is `SKILL.md`; optional `scripts/` and supporting files may be added when the skill actually needs them.

1. **YAML frontmatter** — `name` and `description` (these two control triggering).
2. **Overview** — why this skill exists and what it produces.
3. **When to Use / When NOT to use** — entry and exit criteria.
4. **The workflow** — named steps with purpose, actions, guard, and loop-back.
5. **Templates** — copy-pasteable forms the agent emits.
6. **Tables** — quick-scan decision maps and anti-patterns.
7. **Examples** — weak vs strong snippets that show the pattern.
8. **Testing & Validation** — how to verify triggering and execution.
9. **Verification** — a checklist that must pass before the skill is done.
10. **Self-evolution** (optional) — `self_evolution.md`, `RUNBOOK.md`, `mutation_prompts.md`, `test_cases.md`, and `archive/` for skills that self-correct.
11. **Router boomerang** — pointer back to `using-agent-skills`.

## How Skill Triggering Works

- The agent evaluates the `description` semantically, not by keyword matching.
- A vague description reduces accuracy; an overly generic description causes false activations.
- Missing use cases in the description cause missed activations.
- Multiple skills can activate if they address different aspects of a complex task.
- The body only runs after the skill is triggered.

## The Write-Skill Loop

```
Decide → Draft → Stress-test → Cut → Verify → Register → Iterate
```

### Step 1: Decide if it deserves to be a skill

**Purpose:** Avoid skill inflation.

**Check:**

- Does it solve a class of problems, not one symptom?
- Have you done this task at least five times and expect to do it ten more times?
- Has it worked on at least one real task?
- Will another agent make a worse decision without it?
- Is it a *process* (sequence of decisions), not just information?

**Guard:** All answers are yes.

**Loop back:** If it is a code technique, go to `learning-and-apply` (ACCUMULATE). If it is a one-time fix, stop.

### Step 2: Name and frame

**Purpose:** Make the skill discoverable and invocable.

**Rules:**

- `name` must match the directory name, kebab-case, ≤30 chars, grep-able.
- `description` is the trigger. It is injected into the system prompt, so it must tell the agent what the skill provides and when to activate it.
- A strong description lists capabilities, triggers, use cases, and boundaries.
- Description must not summarize the workflow — if it contains process steps, the agent may follow the summary instead of reading the full `SKILL.md`.
- Description ≤1024 characters.
- One sentence. No generic words like "helper" or "utils".
- Scope is narrow enough to fit in ~300 lines, or decompose into a menu.

**Template:**

```yaml
---
name: <kebab-name>
description: <Capability>. Use when <trigger 1>, <trigger 2>, or <trigger 3>. Not for <boundary>.
---
```

**Example — weak description:**

`This skill helps with documents.`

**Example — strong description:**

`Extract text and tables from PDFs and convert them to CSV. Use when the user asks to parse, analyze, or batch-process PDF documents for data extraction. Not for simple PDF viewing or basic file conversion.`

**Guard:** You can explain the skill's boundary in one sentence, and the description names at least one thing the skill does *not* do.

**Loop back:** If the description needs a comma or "and" to cover unrelated work, split it into two skills.

### Step 3: Draft the workflow

**Purpose:** Turn the implicit process into explicit steps.

**Rules:**

- Each step has a **Purpose**, **Actions**, **Guard**, and optional **Loop back**.
- Use active voice and imperative mood.
- One decision per step. If a step has two decisions, split it.
- Prefer tables over paragraphs when listing options, symptoms, or anti-patterns.
- Include concrete templates (Given/When/Then, evidence board, etc.).

**Guard:** You can trace a real past task through every step and every guard.

**Loop back:** If you cannot trace a real example, you are writing fiction. Stop and gather one.

### Step 4: Stress-test with Socratic questions

**Purpose:** Remove fluff and opinions.

**Ask for every section:**

- What is the weakest claim here?
- What would make an agent ignore this step?
- Is this a decision or a suggestion?
- Can I replace this paragraph with a table or checklist?
- Does this contain any code technique that belongs elsewhere?
- Would this description trigger on the wrong request?

**Guard:** Every recommendation has a guard or a "why not" in the anti-patterns table.

**Loop back:** If a section cannot be falsified, delete it.

### Step 5: Cut and decompose

**Purpose:** Keep skills small enough to read and trigger reliably.

**Rules:**

- Target ≤300 lines; hard ceiling 500 lines.
- Delete before adding. New insight replaces weaker insight.
- One section must go for every section added.
- Remove examples that do not reveal a guard or anti-pattern.
- If the skill covers multiple distinct processes, use a **menu approach**: keep `SKILL.md` as an index and reference sibling files by relative path. The agent reads only the file relevant to the current task.
- Move reference material over 100 lines, tool scripts, or long checklists into supporting files in the skill directory. Keep patterns and principles under 50 lines inline.
- Do not create empty `scripts/` or `references/` directories.
- Prefer scripts over inline code: a script runs without consuming context; only its output does.
- Keep file references one level deep. Do not chain through intermediate documents.

**Example menu structure:**

```
my-skill/
├── SKILL.md          # overview + decision tree + links to sub-files
├── extract.md        # extraction workflow
├── convert.md        # conversion workflow
└── verify.md         # verification workflow
```

**Guard:** The skill is shorter after editing than after the first draft, or it has been decomposed into sub-files.

**Loop back:** If over 500 lines, split the skill or remove the least-used section.

### Step 6: Verify the skill on a real task

**Purpose:** Prove the skill runs in practice.

**Run a live task through the skill:**

- Pick a recent or current task that matches the "Use when" criteria.
- Execute each step exactly as written.
- Note where the skill is unclear, missing a guard, or produces a bad outcome.
- Fix the skill, not the task.

**Guard:** The skill produced a better decision than the agent would have made without it.

**Loop back:** If the skill did not change the outcome, delete it or move it to a note.

### Step 7: Register and integrate

**Purpose:** Make the skill discoverable.

**Actions:**

- Save to the project's skill directory.
- If the skill ships runnable helpers, put them in `scripts/` and follow the repo's script conventions (e.g., `set -e`, status to `stderr`, JSON output to `stdout`, cleanup trap).
- If the skill changes the router map in `using-agent-skills` or `AGENTS.md`, update it.
- Add a `Router boomerang` section at the end.
- Ensure `description` appears in any skill index.

**Guard:** `skill search` or the project's skill discovery shows the skill.

**Loop back:** If the skill is not discoverable, check the directory and frontmatter.

### Step 8: Iterate after release

**Purpose:** Improve triggering and output quality based on real usage.

**Actions:**

- If the skill triggers too often or on the wrong tasks, narrow the description and add boundaries.
- If the skill fails to trigger when expected, add specific triggers and use cases.
- If outputs vary unexpectedly, add specificity to instructions and guards.
- Update or retire the skill every quarter.

**Guard:** Changes are driven by observed behavior, not speculation.

## Self-Evolution

**Purpose:** Let the skill improve itself from observed usage.

**Actions:**

- After every run, append one line to `RUNBOOK.md`.
- If the target skill is `write-skill` itself, or if the user asks for self-correction, read `self_evolution.md` and follow its loop.
- When writing a skill that should self-correct, create `self_evolution.md`, `RUNBOOK.md`, `mutation_prompts.md`, `test_cases.md`, and `archive/README.md` in the new skill directory.
- Generate candidate mutations only from `mutation_prompts.md`; score them against `test_cases.md` and recent `RUNBOOK.md` entries.
- Replace `SKILL.md` only if the best candidate scores higher by at least 0.05 or fixes a critical failure.
- Archive the current version before overwriting and run regression tests immediately after.

**Guard:** Self-correction is bounded by archive, regression tests, and cooldown; if a candidate causes regression, restore the archived version.

## Writing Style

Apply these principles when drafting a new skill or tightening an existing one. Good skills are scannable before they are complete.

### 1. Lead with a bold punchline

Every section should open with one bold sentence that states the core idea. The reader should get the point before reading the bullets.

**Good:**

> **Don't assume. Surface tradeoffs.**

**Bad:**

> This section discusses the importance of not making assumptions and how to handle uncertainty in the implementation process.

### 2. Use a predictable rhythm

Keep the same structure across sections: **heading → punchline → bullets → closing test**. Rhythm makes the skill scannable and reduces cognitive load.

### 3. Use negative constraints

Say what not to do. "Don't" and "No" are easier to verify than "should".

**Good:**

- No features beyond what was asked.
- Don't refactor things that aren't broken.

**Bad:**

- Consider limiting scope to the requested features.
- Avoid unnecessary refactoring.

### 4. One bullet, one idea

Keep each bullet to one line and one thought. No nested bullets. No long paragraphs inside lists.

### 5. Replace definitions with before/after examples

Instead of explaining an abstract concept, show the transformation.

**Good:**

- "Fix the bug" → "Write a test that reproduces it, then make it pass."

**Bad:**

- A verifiable goal is one that can be tested and confirmed to be complete.

### 6. Replace long checklists with a self-check question

One sharp question can replace a five-item checklist.

**Good:**

> Would a senior engineer say this is overcomplicated?

**Bad:**

- [ ] Is the code simple?
- [ ] Are there unnecessary abstractions?
- [ ] Could this be shorter?

### 7. No meta-text

Do not write "This section will..." or "It is important to note...". Every sentence must carry value.

### 8. State tradeoffs in one line

If a guideline has exceptions, capture them in a single sentence.

**Good:**

> These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 9. Use plain, concrete vocabulary

Prefer words that paint a picture. Avoid buzzwords.

**Good:** "surgical changes", "trace directly to the user's request".

**Bad:** "holistic optimization", "synergistic alignment".

## Prose Craft

These habits keep a skill easy to scan and easy to act on.

### 1. Omit needless words

Every word, sentence, and section must earn its place. Cut what the reader would skip.

### 2. Write in active voice and short sentences

Prefer direct statements. Passive voice hides who does what; long sentences hide the point.

### 3. Concrete nouns, active verbs, few modifiers

Show the action. "The build failed" beats "The build was observed to be in a failed state." Cut adjectives and adverbs that repeat what the noun or verb already implies.

### 4. Write like you talk, then read it out loud

If you wouldn't say it to a colleague, don't write it. Read the skill aloud and fix anything that makes you stumble.

### 5. One idea per sentence, one point per paragraph

Don't pack. Short blocks with white space create rhythm and make the skill scannable.

### 6. Rewrite before you ship

The first draft is for discovering what you mean. The second and third drafts are for cutting, tightening, and finding the rhythm.

### 7. Clarity, simplicity, brevity, humanity

Zinsser's standard: be clear first, then simple, then brief, then human. If a tradeoff is needed, clarity wins.

## Skill Quality Gates

| Gate | Check |
|---|---|
| Scoped | Does one thing; not a grab bag. |
| Triggerable | Description names capabilities, triggers, and boundaries. |
| Punchy | Every major section leads with a bold punchline; bullets are one line; no meta-text. |
| Readable | Active voice, short sentences, concrete nouns; read aloud without stumbling. |
| Actionable | Every section tells the agent what to do, not just what to think. |
| Guarded | Every major step has a pass/fail condition. |
| Looped | Failing a guard sends the agent somewhere specific. |
| Falsifiable | Anti-patterns and rationalizations are named. |
| Portable | No project-specific code or paths unless unavoidable. |
| Verifiable | Ends with a checklist. |
| Evolving | If self-correction is claimed, it has RUNBOOK, mutation_prompts, test_cases, archive, and a rollback path. |

## Decision Flow for Adding Content

```
Does it help an agent make a decision?
├── No → Reject.
└── Yes → Has it been tested on a real task?
    ├── No → Reject.
    └── Yes → Can it replace an older/weaker entry?
        ├── Yes → Replace.
        └── No → Will the file exceed 500 lines?
            ├── Yes → Remove weakest entry or split into sub-file, then add.
            └── No → Add.
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's just a few tips" | A skill is a workflow, not a list. Put tips in a doc. |
| "The more examples, the better" | Examples earn their lines only if they reveal a guard or anti-pattern. |
| "I'll keep it short by removing guards" | Guards are the skill. Removing them makes it a suggestion. |
| "This skill covers everything" | Broad skills are ignored. Split by decision boundary. |
| "I'll add code samples so it's concrete" | Code techniques belong in `learning-and-apply` atoms, not skills. |
| "It's close enough to an existing skill" | If close, extend or replace. Don't duplicate. |
| "If the body is good, the description doesn't matter" | The body only runs if the description triggers the skill. |

## Red Flags

- No "When NOT to use".
- No concrete template or checklist.
- A step without a guard.
- A guard that says "use your judgment".
- Long paragraphs where a table would work.
- Sections open with explanations instead of a bold punchline.
- Bullets contain multiple ideas or long paragraphs.
- Code implementation examples.
- Generic description ("Helps with development").
- More than one decision per step.
- No `Router boomerang` section.
- Skill longer than 500 lines after editing.

## Testing & Validation

Before declaring a skill ready, run a test matrix:

### Triggering tests

- [ ] Skill activates on a direct request: "Write a skill for X."
- [ ] Skill activates on a natural request: "How should I turn this debugging workflow into a skill?"
- [ ] Skill stays dormant for out-of-scope requests: "Fix this typo" or "Write a README."
- [ ] Skill does not activate for similar but distinct skills.

### Functional tests

- [ ] Run the workflow steps against a real task and produce a better decision.
- [ ] Run the same task twice; outputs are consistent.
- [ ] Examples in the skill match actual behavior.
- [ ] The skill is usable by someone who did not write it.
- [ ] Self-evolution workflow archives the current version and rolls back on regression.

### Edge cases

- [ ] Skill handles missing context gracefully.
- [ ] Skill handles ambiguous scope by asking, not guessing.
- [ ] Skill does not mutate unrelated files.

## Verification

After writing a skill:

- [ ] Frontmatter has `name` and `description`; `name` matches the directory name.
- [ ] Description is one sentence, in third person, includes a boundary, and does not summarize the workflow.
- [ ] "When to Use" and "When NOT to use" are present.
- [ ] Workflow steps have purpose, actions, guard, and loop-back.
- [ ] Every guard is a pass/fail condition, not advice.
- [ ] Includes at least one concrete template or checklist.
- [ ] Contains a "Common Rationalizations" or "Anti-Patterns" table.
- [ ] No code implementation details (only process).
- [ ] Writing style follows the Concise Writing Principles (bold punchlines, one-line bullets, no meta-text).
- [ ] The skill is read out loud; no sentence feels awkward or overlong.
- [ ] Every word, sentence, and section earns its place (no needless words).
- [ ] Line count ≤500 (ideally ≤300), or split into sub-files.
- [ ] No empty `scripts/` or `references/` directories; supporting files only added when needed.
- [ ] Includes `Router boomerang` pointer.
- [ ] Skill was run on at least one real task and improved the outcome.
- [ ] If self-evolution is enabled, `self_evolution.md`, `RUNBOOK.md`, `mutation_prompts.md`, `test_cases.md`, and `archive/` exist.
- [ ] Self-correction trigger is based on observed behavior, scoring, and cooldown.
- [ ] Router map / skill index updated if needed.

---

## Router boomerang

Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route. Router protocol is in `AGENTS.md` (always-on).
