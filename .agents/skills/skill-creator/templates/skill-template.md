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

- **Always do**: <rules>
- **Ask first**: <rules>
- **Never do**: <rules>

## Anti-patterns (optional)

- <What NOT to do and why>
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
