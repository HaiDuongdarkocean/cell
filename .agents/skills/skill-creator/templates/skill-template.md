# Skill Template — SKILL.md

> Copy this template when creating a new skill. Replace `<bracketed>` placeholders.

```
---
name: <skill-name>
description: <One sentence: what the skill does + when to use it + 2-4 trigger phrases. Max 1024 chars. Be specific, use concrete verbs.>
---

# <Skill Name>

<One-line summary — what this skill does.>

## When to Use

<Trigger conditions. When should the agent invoke this skill?>

**Trigger phrases:**
- "<phrase 1>"
- "<phrase 2>"
- "<phrase 3>"

## Input

<What the skill expects as input. Be specific: file paths, user message format, code.>

- **<input 1>**: <description>
- **<input 2>**: <description>

## Output

<What the skill produces. Be specific: file path, format, structure.>

- **<output 1>**: <description>

## Process

### Step 1 — <action>

<Step-by-step instructions. Numbered, actionable, no vague advice.>

### Step 2 — <action>

<...>

### Step 3 — <action>

<...>

## Verification

After running this skill:

- [ ] <checkable condition 1>
- [ ] <checkable condition 2>
- [ ] <checkable condition 3>

## Examples (optional)

<1-2 concrete input → output examples. Skip if the process is self-explanatory.>

## Boundaries (optional)

- **Always do**: <rules>. Identify the primary language by content volume and sync the whole skill to it. Keep the skill self-contained — no phase labels (G0/G1/...), no citations of other skills inside the body.
- **Ask first**: <rules>. When language split is near 50/50, ask the user which is primary.
- **Never do**: <rules>. Mix languages mid-skill without identifying a primary. Reference other skills as hard dependencies.

## Anti-patterns (optional)

- <What NOT to do and why>

## Red Flags (optional)

- <Signs you're doing it wrong right now — distinct from anti-patterns, which are bad approaches>
```

## Supporting files (optional)

If the skill needs templates, checklists, or examples, create:

```
.agents/skills/<skill-name>/
├── SKILL.md
├── templates/
│   └── <name>-template.md
├── checklists/
│   └── <name>-checklist.md
└── examples/
    └── <name>-example.md
```

Reference them from SKILL.md:
- `Read \`checklists/<name>-checklist.md\` and run each item.`
- `Use \`templates/<name>-template.md\` as the output format.`
