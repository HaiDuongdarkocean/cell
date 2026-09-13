# Write-Skill — workflow detail & self-evolution

Reference for `write-skill`. Read the step you are on.

## Step detail

### Step 1: Decide if it deserves a skill

Check: solves a class of problems (not one symptom)? Done ≥5 times, expect 10 more? Worked on a real task? Another agent makes worse decisions without it? Is it a *process*, not information?

Loop back: code technique → `learning-and-apply` (ACCUMULATE). One-time fix → stop.

### Step 2: Name and frame

- `name` matches the directory, kebab-case, ≤30 chars, grep-able.
- `description` is injected into the system prompt — tells the agent what the skill provides and when to activate. Must not summarize the workflow (the agent would follow the summary instead of reading `SKILL.md`). One sentence; no "helper"/"utils".
- Scope narrow enough for ~300 lines, or decompose into a menu.

Loop back: if the description needs a comma or "and" to cover unrelated work, split into two skills.

### Step 3: Draft the workflow

- Each step has Purpose, Actions, Guard, optional Loop back.
- Active voice, imperative mood. One decision per step — split if two.
- Prefer tables over paragraphs for options, symptoms, anti-patterns.
- Include concrete templates.

Loop back: if you cannot trace a real example through the steps, you are writing fiction — gather one first.

### Step 4: Stress-test with Socratic questions

Ask of every section: What is the weakest claim? What would make an agent ignore this step? Decision or suggestion? Could a table or checklist replace this paragraph? Does it contain code technique that belongs elsewhere? Would this description trigger on the wrong request?

Loop back: a section that cannot be falsified gets deleted.

### Step 5: Cut and decompose

- Target ≤300 lines; hard ceiling 500. Delete before adding — new insight replaces weaker insight.
- Menu approach for multi-process skills: `SKILL.md` is the index; sibling files hold sub-workflows; the agent reads only what the current task needs.
- Move reference material >100 lines, tool scripts, or long checklists into supporting files. Patterns/principles <50 lines may stay inline.
- No empty `scripts/`/`references/` dirs. Prefer scripts over inline code — a script's output costs context, its source doesn't. Keep references one level deep.

### Step 6: Verify on a real task

Pick a recent task matching the "Use when" criteria. Execute each step exactly as written. Note unclear steps, missing guards, bad outcomes. Fix the skill, not the task.

Loop back: if the skill didn't change the outcome, delete it or demote it to a note.

### Step 7: Register and integrate

- Save to the skill directory; runnable helpers go in `scripts/` following repo conventions (`set -e`, status to stderr, JSON to stdout, cleanup trap).
- If routing changes, update `using-agent-skills` or `AGENTS.md`; regen `.agents/skills/index.json` via `node scripts/update-skill-index.mjs`.
- End with a Router boomerang section.

### Step 8: Iterate after release

Triggers too often → narrow description, add boundaries. Misses expected triggers → add specific triggers. Outputs vary → add specificity to guards. Driven by observed behavior, not speculation; review quarterly.

## Self-evolution (optional)

When writing or updating a skill, ask: should it self-evolve from usage? If yes:

- After every run, append one line to the target skill's `self-evolution/RUNBOOK.md`.
- Read `self-evolution/workflow.md` trigger conditions; if met, run the self-correction loop. If the user explicitly asks, run it regardless.
- Enabling self-correction creates: `self-evolution/README.md` (human-facing, no frontmatter), `workflow.md`, `RUNBOOK.md`, `mutation_prompts.md`, `test_cases.md`, `archive/README.md`.
- Mutations come only from `mutation_prompts.md`; score against `test_cases.md` + recent RUNBOOK entries. Replace `SKILL.md` only if the best candidate scores ≥0.05 higher or fixes a critical failure.
- Archive the current version before overwriting; run regression tests immediately after.

Guard: self-correction is bounded by archive + regression tests + cooldown; a regressing candidate restores the archived version.
