---
name: skill-creator
description: Creates new agent skills or improves existing ones following cross-platform SKILL.md best practices synthesized from 9 sources (Anthropic, OpenAI Codex, Agent Skills Spec, Karpathy, Andrew Ng, Lalit Madan, mdskills.ai, Windsurf). Use when asked to "create a skill", "improve this skill", "write a SKILL.md", "review this skill", or when authoring reusable agent expertise. Bundles templates + 18-principle quality checklist covering description routing, progressive disclosure, freedom-to-fragility matching, real-prompt testing, and iteration. Do NOT use for general prompt engineering — use for SKILL.md authoring only.
---

# Skill Creator

Creates new agent skills or improves existing ones following cross-platform SKILL.md best practices distilled from Anthropic, OpenAI, Windsurf, Andrew Ng, and Andrej Karpathy.

## When to Use

- User says "create a skill that..." or "write a SKILL.md for..."
- User says "improve this skill" or "review this skill" (with an existing SKILL.md path)
- User wants to package reusable agent expertise (checklist, workflow, persona, template)
- User wants to make a one-off prompt repeatable across sessions

**Trigger phrases:**
- "create a skill"
- "improve this skill"
- "write a SKILL.md"
- "review this skill"
- "make this reusable"
- "package this as a skill"

## Input

- **For new skill**: user request describing what the skill should do + when to use it
- **For improving existing skill**: path to existing `SKILL.md` (or skill folder)

## Output

- `SKILL.md` with YAML frontmatter (`name`, `description`) + markdown body
- Optional supporting files: `templates/`, `checklists/`, `examples/`, `scripts/`
- Skill folder placed at `.agents/skills/<skill-name>/` (project-level) or `~/.agents/skills/<skill-name>/` (user-level)
- Quality checklist pass/fail report

## Process

> **Sources**: These steps synthesize 12 principles from 9 sources — Anthropic Claude Platform Docs, Anthropic Engineering Blog, Agent Skills Specification (open standard), OpenAI Codex, Andrej Karpathy, Andrew Ng (DeepLearning.AI), Lalit Madan (SKILL.md Playbook), mdskills.ai, Windsurf Cascade Rules.

### Step 0 — Check if you need a skill (Lalit Madan + Anthropic)

**Do not write a skill from vibes.** Run the task without a skill first. If the result is already good, you do not need a skill — you need to leave it alone.

A skill is worth writing when:
- The model gets the task mostly right but keeps missing the same edge case.
- The task requires project-specific knowledge the model could not have seen in training.
- The workflow has a strict sequence and the agent keeps doing steps out of order.
- The output needs a specific format and the agent keeps improvising a different one.
- The task involves running scripts or consulting reference material the agent cannot infer.

A skill is NOT worth writing when:
- The model already handles the task well (skill = context tax, no improvement).
- The task is a one-off you will not repeat.
- The "skill" is really just general advice like "write clean code" or "be thorough."

**Bar**: does this skill make the agent measurably better at this task than without it? If no, delete it.

### Step 1 — Extract from real work, clarify the one job (Lalit + Karpathy)

**Extract the skill from real work you have done with an agent**, not from imagination. Ask yourself:
- Where did you have to correct the agent?
- Which commands did it forget to run?
- Which file did it keep reading too late?
- Which edge case did it miss?
- Which output format did you have to restate?
- Which decision did it make differently from how your team works?

Those corrections are the raw material for a strong SKILL.md.

Then clarify the skill's **one job**. Ask the user (if not already clear):

1. **What does the skill do?** (one sentence, verb-first)
2. **When should the agent invoke it?** (trigger conditions + phrases)
3. **What is the input?** (file paths, user message, code)
4. **What is the output?** (file, report, code, decision)
5. **Are there supporting files needed?** (templates, checklists, examples)

If the request covers 2+ jobs → split into 2+ skills. Do not proceed until the job is singular.

**Karpathy principle**: skill = behavioral training, not prompt. Each rule = 1 concrete behavior to train. The agent CAN do the task; the skill trains it to BEHAVE correctly.

### Step 2 — Write the description (the gateway)

The `description` field is the **only** thing the model sees before deciding to invoke. It is critical for skill selection — Claude uses it to choose the right skill from potentially 100+ available skills.

#### Description principles (sourced from Anthropic Claude Platform Docs — Skill authoring best practices)

**1. Third person — mandatory.** The description is injected into the system prompt. Inconsistent point-of-view causes discovery problems.
- ✅ "Processes Excel files and generates reports"
- ❌ "I can help you process Excel files"
- ❌ "You can use this to process Excel files"

**2. WHAT + WHEN — both required.**
- **WHAT**: what the skill does (verb-first, 1-2 sentences)
- **WHEN**: when to use it (specific scenarios + key terms)

**3. Be specific, not vague.** Vague descriptions never trigger.
- ✅ "Extract text and tables from PDF files, fill forms, merge documents"
- ❌ "Helps with documents"
- ❌ "Processes data"
- ❌ "Does stuff with files"

**4. Include key terms the user actually says.** Description matching is keyword matching — use the words users use, not internal jargon.
- "PDF files", "forms", "document extraction" (not "document processing")

**5. Follow the standard pattern.**
```
[WHAT — verb-first, 1-2 sentences]. Use when [WHEN — specific scenarios + key terms].
```

**6. Add negative triggers (OpenAI Codex principle).** State when the skill should NOT trigger, if it could be confused with adjacent skills.
- ✅ "Do NOT use for visual design (color/font) — use a visual-design skill instead."
- This prevents the skill from firing on related-but-wrong requests.

**7. Constraints.**
- Max 1024 characters
- Non-empty
- No XML tags
- No reserved words ("anthropic", "claude")

**8. Concise — context window is a shared resource.** Every token in the description competes with conversation history. Do not explain what Claude already knows.

#### Examples (official Anthropic pattern)

```yaml
# PDF Processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Excel Analysis
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Git Commit Helper
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

#### Anti-patterns

```yaml
# ❌ Vague — will never trigger
description: Helps with documents

# ❌ First/second person — breaks discovery
description: I can help you process Excel files

# ❌ No WHEN — model doesn't know when to invoke
description: Conducts multi-axis code review.

# ❌ No negative trigger — fires on adjacent requests
description: Designs UI layouts. Use when designing interfaces.
# (fires on visual design requests too — should add "Do NOT use for color/font/visual style")
```

#### Good example (full, with negative trigger)

```yaml
description: Conducts multi-axis code review (correctness, security, performance, maintainability) before merge. Use when reviewing code written by yourself, another agent, or a human, or when the user asks "is this ready to merge" or "review this code". Do NOT use for visual/UI review — use a UI-UX review skill instead.
```

#### One-line summary of the principles

**Description = third-person, verb-first, WHAT + WHEN + negative triggers, specific key terms, ≤1024 chars — because it decides whether the skill triggers from 100+ available skills.**

### Step 3 — Structure the SKILL.md body (teach procedure, not background)

**Lalit Madan principle**: the body teaches a reusable **procedure**, not background knowledge. The agent already knows what PDFs are, what libraries are, how code works. Only add context the agent does NOT already have.

Keep the body under **100 lines** (hard cap — see Step 5 split rule). Use progressive disclosure — put overview in SKILL.md, details in supporting files (`checklists/`, `templates/`, `examples/`). The 100-line cap forces discipline: SKILL.md = procedure overview, supporting files = detail.

Required sections (in order):

1. **One-line summary** — what this skill does
2. **When to Use** — trigger conditions + phrases
3. **Input** — what the skill expects
4. **Output** — what the skill produces
5. **Process** — step-by-step instructions (numbered, actionable)
6. **Verification** — how to confirm the skill worked

Optional sections (add only if relevant):
- **Examples** — 1-2 concrete input→output examples
- **Boundaries** — always do / ask first / never do
- **Anti-patterns** — what NOT to do

**Anthropic principle — onboarding guide, not documentation**: Building a skill is like putting together an onboarding guide for a new hire. Procedural knowledge (how to do the task), not background knowledge (what the task is).

### Step 3b — Apply writing style patterns

These patterns make skills scannable for agents AND readable for humans. Apply when structuring the body:

| Pattern | What | Why | Example |
|---|---|---|---|
| **Visual decision tree** | ASCII art tree for branching logic | Agent scans in <3s; sub-branch shows conditional logic | `├── UI work? ──→ frontend-ui-engineering` |
| **Bad/Good contrast** | Pair wrong behavior with right behavior | Gives agent a concrete template, not abstract principle | `**Bad:** Silently guessing.` / `**Good:** "I see X but Y. Which wins?"` |
| **Mirror reinforcement** | Behaviors (positive) + Failure Modes (negative) cover same concepts | Same idea from 2 angles = deeper internalization | Behavior #1 "Surface Assumptions" ↔ Failure #1 "Making wrong assumptions without checking" |
| **Verb-first headings** | Start every heading/step with imperative verb | Agent knows immediately what to DO, not what to UNDERSTAND | "Surface Assumptions" (not "About Assumptions") |
| **Multi-view for same data** | Same info in 3 formats: tree + sequence + table | Different reader needs: navigation / planning / lookup | Decision tree + Lifecycle sequence + Quick Reference table |
| **Quantified concrete guidance** | Use numbers, not vague adjectives | Gives agent a clear boundary to judge against | "this adds ~200ms latency" not "this might be slower" |
| **Progressive disclosure strict** | Each section builds on previous; reader can stop at any section and still get value | Respects reader attention; no forced linear reading | Overview (10s) → Tree (30s) → Behaviors (1min) → Rules (30s) |
| **Plain typography, one primary language** | No mixed language mid-sentence; no long inline parentheticals; each sentence = one idea | Reduces cognitive load for scanning | Identify the dominant language by content volume; that becomes the primary language; convert all minority-language content to primary. Avoid `— aside —` interruptions |

**How to identify the primary language** (apply before writing/improving a skill):

1. Count content lines per language (ignore code blocks, file paths, frontmatter field names).
2. The language with the majority of content lines is the **primary language**.
3. Convert every minority-language content line to the primary language.
4. Tie-breaker (near 50/50): ask the user which language is primary for this skill. Do NOT guess.

**Bad**: Skill body is 80% English but section headings + a few probes are Vietnamese → reader context-switches mid-scan.
**Good**: Identify English as primary (80% of content) → translate the 20% Vietnamese headings + probes to English → single-language scan throughout.

### Step 3c — Enforce skill independence

A skill must stand alone. The agent loading it may not have any other skill's context. Apply these rules to the SKILL.md body (not the frontmatter `description`, which may legitimately cite trigger phrases):

- **No phase-system coupling**: do NOT reference phase labels from any external workflow (no "G0", "G1", "G4", "phase 0", "stage 2"). Use phase-agnostic nouns: "intent", "spec", "implementation", "verification".
- **No cross-skill citations inside the body**: do NOT write "pattern borrowed from `interview-me`" or "follows the `spec-driven-development` flow". If a pattern is needed, state it inline — the skill must be self-contained.
- **Trigger phrases in `description` are the only exception**: the frontmatter `description` MAY cite trigger phrases users say (those are user-facing, not skill-coupling).
- **Handoff mentions are allowed but minimal**: a single line like "Hand off to whoever writes the spec" is fine. Naming a specific skill as a hard dependency is not.

**Bad**: `> Pattern borrowed from interview-me: ask one question at a time.` → breaks if `interview-me` is renamed, removed, or not loaded.
**Good**: `> Ask one question per turn, attach a guess, track confidence.` → self-contained; same instruction, no external reference.

**Bad**: `After G0 intent, before G1 spec` → only meaningful inside one specific workflow.
**Good**: `After a confirmed intent, before the spec` → meaningful in any workflow.

### Step 4 — Match freedom to fragility (Anthropic + mdskills)

Not every instruction needs the same level of specificity. Match the freedom to the task's fragility:

| Freedom level | When to use | Format | Example |
|---|---|---|---|
| **High** (text instructions) | Multiple approaches valid; decisions depend on context; heuristics guide | Prose steps | "1. Analyze code structure 2. Check for bugs 3. Suggest improvements" |
| **Medium** (pseudocode + params) | Preferred pattern exists; some variation acceptable | Template with params | `def generate_report(data, format="markdown", include_charts=True)` |
| **Low** (exact scripts) | Operations fragile/error-prone; consistency critical; strict sequence | Exact command, no modification | `python scripts/migrate.py --verify --backup` — "Do not modify or add flags" |

**Analogy (Anthropic)**: Claude is a robot exploring a path:
- **Narrow bridge with cliffs**: one safe way → low freedom, exact guardrails (e.g. database migrations)
- **Open field, no hazards**: many paths succeed → high freedom, trust Claude (e.g. code reviews)

**Rule**: default to high freedom. Drop to low freedom ONLY when the operation is fragile, irreversible, or must be consistent across runs.

### Step 5 — Add supporting files (if needed)

If the skill would exceed 500 lines or needs reusable artifacts:

```
.agents/skills/<skill-name>/
├── SKILL.md                    # Main instructions (<500 lines)
├── templates/                  # Output templates
│   └── <name>-template.md
├── checklists/                 # Verification checklists
│   └── <name>-checklist.md
├── examples/                   # Concrete examples
│   └── <name>-example.md
└── scripts/                    # Shell scripts (if any)
    └── <name>.sh
```

Reference supporting files from SKILL.md:
- `Read \`checklists/<name>-checklist.md\` and run each item.`
- `Use \`templates/<name>-template.md\` as the output format.`

**Anthropic principle — structure for scale**: when SKILL.md approaches 100 lines, split content into separate files. If certain contexts are mutually exclusive or rarely used together, keeping paths separate reduces token usage. **Hard rule**: SKILL.md body ≤ 100 lines — if over, move detail to `checklists/`/`templates/`/`examples/` and reference by path.

**Lalit Madan case study**: moving dense command docs from SKILL.md to flat text references cut baseline skill cost from ~1,500 tokens to ~80 tokens. Supporting files earn their place by being loaded only when needed.

### Step 6 — Run the 18-principle quality checklist

Read `checklists/skill-quality-checklist.md` and verify the new skill passes all 18 principles. Report pass/fail for each. Fix any failures before saving.

Additionally, verify at least 3 of the 8 writing style patterns (Step 3b) are applied. A skill does not need all 8, but the most useful skills typically use:
- **Visual decision tree** (if skill has branching logic)
- **Bad/Good contrast** (if skill has behavioral rules)
- **Verb-first headings** (always — baseline)

### Step 7 — Test against real prompts (Karpathy + Andrew Ng + Lalit)

**The skill is not finished until you have tested it against real prompts.**

1. **Prepare 2-3 real user prompts** that should trigger this skill.
2. **Prepare 1-2 adjacent prompts** that should NOT trigger (test negative triggers).
3. **Run each prompt** with the skill installed.
4. **Verify**:
   - Did the skill trigger on the right prompts? (description routing works)
   - Did the agent follow the process steps correctly?
   - Did the output match the expected format?
   - Did the skill NOT trigger on adjacent prompts? (negative triggers work)
5. **If any fail**: iterate on the description (routing) or body (procedure).

**Karpathy principle — eval loops**: skill needs eval files + pass rates. Iterate overnight if needed. The biggest predictor of success (Andrew Ng) is not technical skill but disciplined evaluation.

**Lalit principle**: watch for unexpected trajectories or overreliance on certain contexts. If the agent keeps doing X when the skill says Y, the skill wording is wrong — fix the wording, not the agent.

### Step 8 — Iterate with Claude (Anthropic Engineering Blog)

As you work on tasks with Claude using the skill, capture improvements:

- **Ask Claude to self-reflect**: "You went off track on step 4 — what context would have helped?"
- **Capture successful approaches**: "You handled that edge case well — let's add it to the skill."
- **Capture common mistakes**: "You keep missing X — let's add a bad/good contrast for it."

This process helps you discover what context Claude ACTUALLY needs, instead of trying to anticipate it upfront.

**Rule**: skills are living documents. Plan to iterate based on real usage, not ship-and-forget.

### Step 9 — Save and verify

1. Save `SKILL.md` + supporting files to `.agents/skills/<skill-name>/`
2. Verify by listing the folder: `ls .agents/skills/<skill-name>/`
3. Confirm the skill is discoverable: invoke `skill` tool with `list` command
4. If improving an existing skill: diff old vs new, confirm no regression

## Improving an Existing Skill

When the user says "improve this skill" with an existing SKILL.md:

1. **Read** the existing SKILL.md + all supporting files
2. **Run** the 18-principle checklist — identify failures
3. **Audit redundancy/conflict**: grep each skill name + each rule keyword; if a rule appears 3+ times → consolidate to a single source of truth (matrix/table) and reference it from other locations
4. **Audit writing style**: check if at least 3 of 8 patterns (Step 3b) are applied; suggest additions if missing
5. **Ask** the user what specific improvement they want (or apply all checklist + style fixes)
6. **Edit** in place — do not rewrite from scratch unless the structure is fundamentally broken
7. **Diff** before/after — show the user what changed (added patterns, removed redundancy, fixed conflicts)
8. **Verify** the skill is still discoverable

## Cross-Platform Compatibility

The SKILL.md format (YAML frontmatter + markdown body) runs on 19+ platforms:
- Claude Code, Codex CLI, Gemini CLI, Cursor, Windsurf, Aider, Kiro, GitHub Copilot, etc.
- Do NOT use platform-specific syntax (no Claude-only XML tags, no Codex-only directives)
- Do NOT hardcode paths like `/mnt/skills/` — use relative paths within the skill folder
- Place skills in `.agents/skills/` (project) or `~/.agents/skills/` (user) for cross-agent discovery

## Boundaries

- **Always do**: Run the 18-principle checklist before saving. Keep SKILL.md body ≤ 100 lines (hard cap — split detail to `checklists/`/`templates/`/`examples/` if over). Write a specific description with trigger phrases + negative triggers. Use relative paths. Enforce skill independence (Step 3c) — no phase labels, no cross-skill citations in the body. Identify the primary language by content volume and sync the whole skill to it (Step 3b "Plain typography"). Match freedom to fragility (Step 4). Test against real prompts (Step 7).
- **Ask first**: Adding MCP tool dependencies, adding shell scripts that have side effects, placing skills outside `.agents/skills/`. When language split is near 50/50, ask the user which is primary.
- **Never do**: Use platform-specific syntax. Hardcode absolute paths. Create a skill that does 2+ jobs. Use vague descriptions. Skip the checklist. Reference phase labels (G0/G1/...) or other skill names inside the SKILL.md body. Mix languages mid-skill without identifying a primary.

## Verification

After creating or improving a skill:

- [ ] `name` field: lowercase, hyphens only, ≤64 chars, no reserved words
- [ ] `description` field: ≤1024 chars, includes what + when + trigger phrases
- [ ] SKILL.md body: <500 lines, has all 6 required sections
- [ ] Supporting files: referenced from SKILL.md, use relative paths
- [ ] 18-principle checklist: all pass
- [ ] Writing style: at least 3 of 8 patterns applied (Step 3b); verb-first headings required
- [ ] **Skill independence (Step 3c)**: no phase labels (G0/G1/...) in body, no cross-skill citations in body, handoff mentions are minimal and do not name a hard dependency
- [ ] **One primary language**: dominant language identified by content volume; all minority-language content converted to primary (Step 3b); no mid-skill language mixing
- [ ] No redundancy: each rule appears in exactly one place (use a matrix/table as source of truth)
- [ ] No conflicts: cross-check Skill list vs Skill Activation Matrix (if present)
- [ ] Skill discoverable: `skill list` shows it
- [ ] No platform-specific syntax
