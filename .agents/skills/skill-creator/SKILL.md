---
name: skill-creator
description: Creates new agent skills or improves existing ones following cross-platform SKILL.md best practices (Claude, Codex, Windsurf, Gemini, Cursor). Use when asked to "create a skill", "improve this skill", "write a SKILL.md", "review this skill", or when authoring reusable agent expertise. Bundles templates + 12-principle quality checklist.
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

### Step 1 — Clarify the skill's one job

A skill must do **exactly one job**. Ask the user (if not already clear):

1. **What does the skill do?** (one sentence, verb-first)
2. **When should the agent invoke it?** (trigger conditions + phrases)
3. **What is the input?** (file paths, user message, code)
4. **What is the output?** (file, report, code, decision)
5. **Are there supporting files needed?** (templates, checklists, examples)

If the request covers 2+ jobs → split into 2+ skills. Do not proceed until the job is singular.

### Step 2 — Write the description (the gateway)

The `description` field is the **only** thing the model sees before deciding to invoke. It must contain:

- **What** the skill does (verb + object)
- **When** to use it (trigger conditions)
- **Trigger phrases** users actually say (2-4 examples)

Rules:
- Max 1024 characters
- Be specific — include key terms the model will match against
- Do NOT use vague words like "help with" or "assist on"
- DO use concrete verbs: "Review", "Create", "Generate", "Audit"

**Bad**: `Helps with code reviews.`
**Good**: `Conducts multi-axis code review (correctness, security, performance, maintainability) before merge. Use when reviewing code written by yourself, another agent, or a human. Triggers on "review this code", "is this ready to merge?", "code review".`

### Step 3 — Structure the SKILL.md body

Keep the body under **500 lines**. Use progressive disclosure — put overview in SKILL.md, details in supporting files.

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

### Step 4 — Add supporting files (if needed)

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

### Step 5 — Run the 12-principle quality checklist

Read `checklists/skill-quality-checklist.md` and verify the new skill passes all 12 principles. Report pass/fail for each. Fix any failures before saving.

### Step 6 — Save and verify

1. Save `SKILL.md` + supporting files to `.agents/skills/<skill-name>/`
2. Verify by listing the folder: `ls .agents/skills/<skill-name>/`
3. Confirm the skill is discoverable: invoke `skill` tool with `list` command
4. If improving an existing skill: diff old vs new, confirm no regression

## Improving an Existing Skill

When the user says "improve this skill" with an existing SKILL.md:

1. **Read** the existing SKILL.md + all supporting files
2. **Run** the 12-principle checklist — identify failures
3. **Ask** the user what specific improvement they want (or apply all checklist fixes)
4. **Edit** in place — do not rewrite from scratch unless the structure is fundamentally broken
5. **Diff** before/after — show the user what changed
6. **Verify** the skill is still discoverable

## Cross-Platform Compatibility

The SKILL.md format (YAML frontmatter + markdown body) runs on 19+ platforms:
- Claude Code, Codex CLI, Gemini CLI, Cursor, Windsurf, Aider, Kiro, GitHub Copilot, etc.
- Do NOT use platform-specific syntax (no Claude-only XML tags, no Codex-only directives)
- Do NOT hardcode paths like `/mnt/skills/` — use relative paths within the skill folder
- Place skills in `.agents/skills/` (project) or `~/.agents/skills/` (user) for cross-agent discovery

## Boundaries

- **Always do**: Run the 12-principle checklist before saving. Keep SKILL.md <500 lines. Write a specific description with trigger phrases. Use relative paths.
- **Ask first**: Adding MCP tool dependencies, adding shell scripts that have side effects, placing skills outside `.agents/skills/`.
- **Never do**: Use platform-specific syntax. Hardcode absolute paths. Create a skill that does 2+ jobs. Use vague descriptions. Skip the checklist.

## Verification

After creating or improving a skill:

- [ ] `name` field: lowercase, hyphens only, ≤64 chars, no reserved words
- [ ] `description` field: ≤1024 chars, includes what + when + trigger phrases
- [ ] SKILL.md body: <500 lines, has all 6 required sections
- [ ] Supporting files: referenced from SKILL.md, use relative paths
- [ ] 12-principle checklist: all pass
- [ ] Skill discoverable: `skill list` shows it
- [ ] No platform-specific syntax
