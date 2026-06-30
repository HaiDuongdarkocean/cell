# Skill Quality Checklist — 12 Principles

> Run this checklist against any new or improved skill. All 12 must pass before saving.
> Sources: Anthropic, OpenAI Codex, Windsurf, Andrew Ng (DeepLearning.AI), Andrej Karpathy.

## How to Use

For each principle, mark PASS or FAIL with a one-line note. If any FAIL, fix before saving.

## The 12 Principles

### 1. Description is the gateway
- [ ] **PASS / FAIL**: `description` field says WHAT the skill does + WHEN to use it + 2-4 trigger phrases
- [ ] **PASS / FAIL**: Description is specific (no "help with", "assist on", "improve")
- [ ] **PASS / FAIL**: Description is ≤1024 characters
- Note: <if FAIL, what's missing>

### 2. One skill = one job
- [ ] **PASS / FAIL**: The skill does exactly one job (not 2+)
- [ ] **PASS / FAIL**: If the request covers 2+ jobs, it was split into 2+ skills
- Note: <if FAIL, which jobs are mixed>

### 3. Progressive disclosure
- [ ] **PASS / FAIL**: SKILL.md body is <500 lines
- [ ] **PASS / FAIL**: Detailed content is in supporting files, not in SKILL.md
- [ ] **PASS / FAIL**: Supporting files are referenced from SKILL.md
- Note: <if FAIL, what to move out>

### 4. Cross-platform format
- [ ] **PASS / FAIL**: YAML frontmatter has `name` + `description` only (no platform-specific fields)
- [ ] **PASS / FAIL**: No platform-specific syntax (no Claude XML tags, no Codex directives)
- [ ] **PASS / FAIL**: No hardcoded absolute paths (use relative paths within skill folder)
- Note: <if FAIL, what's platform-specific>

### 5. Explicit input / output
- [ ] **PASS / FAIL**: Input section lists what the skill expects (file paths, message format)
- [ ] **PASS / FAIL**: Output section lists what the skill produces (file, report, decision)
- [ ] **PASS / FAIL**: Agent does not need to guess input or output
- Note: <if FAIL, what's ambiguous>

### 6. Step-by-step process
- [ ] **PASS / FAIL**: Process section has numbered steps (Step 1, Step 2, ...)
- [ ] **PASS / FAIL**: Each step is actionable (verb-first, concrete)
- [ ] **PASS / FAIL**: No vague advice like "be thorough" or "consider edge cases"
- Note: <if FAIL, which steps are vague>

### 7. Real-world triggers
- [ ] **PASS / FAIL**: Trigger phrases are things users actually say
- [ ] **PASS / FAIL**: At least 2 trigger phrases listed
- [ ] **PASS / FAIL**: Triggers are specific enough to not fire on unrelated requests
- Note: <if FAIL, which triggers are too generic>

### 8. Supporting files bundled (if needed)
- [ ] **PASS / FAIL**: If skill needs templates/checklists/examples, they exist in the skill folder
- [ ] **PASS / FAIL**: Supporting files use the folder structure (templates/, checklists/, examples/)
- [ ] **PASS / FAIL**: Supporting files are referenced from SKILL.md with relative paths
- Note: <if FAIL, what's missing>

### 9. High-signal instructions
- [ ] **PASS / FAIL**: Every line in SKILL.md has value when loaded (no filler)
- [ ] **PASS / FAIL**: Instructions are concrete, not generic
- [ ] **PASS / FAIL**: Examples (if any) are real, not placeholder
- Note: <if FAIL, which lines are filler>

### 10. Evaluation-driven output
- [ ] **PASS / FAIL**: Output is verifiable (checklist pass/fail, status, test result)
- [ ] **PASS / FAIL**: Verification section exists with checkable conditions
- [ ] **PASS / FAIL**: Success/failure is binary, not subjective
- Note: <if FAIL, what's not verifiable>

### 11. Clear tool descriptions (if using MCP/tools)
- [ ] **PASS / N/A**: No MCP tools used (skip)
- [ ] **PASS / FAIL**: Tool descriptions are distinct, high-signal, namespaced
- [ ] **PASS / FAIL**: Bad descriptions would not send agent down wrong path
- Note: <if FAIL, which tool description is weak>

### 12. Boring over clever
- [ ] **PASS / FAIL**: Skill uses simple, composable patterns (no over-engineering)
- [ ] **PASS / FAIL**: No unrequested abstractions
- [ ] **PASS / FAIL**: Skill is the minimum needed to do the job well
- Note: <if FAIL, what's over-engineered>

## Summary

| Principle | Status |
|-----------|--------|
| 1. Description is the gateway | PASS / FAIL |
| 2. One skill = one job | PASS / FAIL |
| 3. Progressive disclosure | PASS / FAIL |
| 4. Cross-platform format | PASS / FAIL |
| 5. Explicit input / output | PASS / FAIL |
| 6. Step-by-step process | PASS / FAIL |
| 7. Real-world triggers | PASS / FAIL |
| 8. Supporting files bundled | PASS / FAIL |
| 9. High-signal instructions | PASS / FAIL |
| 10. Evaluation-driven output | PASS / FAIL |
| 11. Clear tool descriptions | PASS / FAIL / N/A |
| 12. Boring over clever | PASS / FAIL |

**Overall**: APPROVED / NEEDS_FIXES (fix all FAIL before saving)
