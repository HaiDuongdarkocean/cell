# Skill Quality Checklist — 18 Principles

> Run this checklist against any new or improved skill. All 18 must pass before saving.
> Sources: Anthropic Claude Platform Docs, Anthropic Engineering Blog, Agent Skills Specification (open standard), OpenAI Codex, Andrej Karpathy, Andrew Ng (DeepLearning.AI), Lalit Madan (SKILL.md Playbook), mdskills.ai, Windsurf Cascade Rules.

## How to Use

For each principle, mark PASS or FAIL with a one-line note. If any FAIL, fix before saving.

## The 18 Principles

### 1. Description is the gateway (sourced from Anthropic Claude Platform Docs)
- [ ] **PASS / FAIL**: `description` says WHAT the skill does (verb-first, 1-2 sentences) + WHEN to use it (specific scenarios + key terms)
- [ ] **PASS / FAIL**: Written in **third person** (no "I can help you", no "You can use this") — inconsistent POV breaks discovery
- [ ] **PASS / FAIL**: Specific, not vague (no "helps with documents", "processes data", "does stuff with files")
- [ ] **PASS / FAIL**: Includes **key terms the user actually says** (keyword matching drives trigger)
- [ ] **PASS / FAIL**: Includes **negative triggers** if skill could be confused with adjacent skills (OpenAI Codex principle)
- [ ] **PASS / FAIL**: Follows pattern `[WHAT]. Use when [WHEN].`
- [ ] **PASS / FAIL**: ≤1024 characters, non-empty, no XML tags, no reserved words ("anthropic", "claude")
- Note: <if FAIL, which principle violated>

### 2. One skill = one job
- [ ] **PASS / FAIL**: The skill does exactly one job (not 2+)
- [ ] **PASS / FAIL**: If the request covers 2+ jobs, it was split into 2+ skills
- Note: <if FAIL, which jobs are mixed>

### 3. Progressive disclosure
- [ ] **PASS / FAIL**: SKILL.md body is ≤100 lines (hard cap — split detail to `checklists/`/`templates/`/`examples/` if over)
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

### 13. Skill independence (stands alone)
- [ ] **PASS / FAIL**: No phase-system labels in the SKILL.md body (no "G0", "G1", "G4", "phase 0", "stage 2") — use phase-agnostic nouns ("intent", "spec", "implementation", "verification")
- [ ] **PASS / FAIL**: No cross-skill citations inside the body (no "pattern borrowed from `interview-me`", no "follows the `spec-driven-development` flow") — state patterns inline
- [ ] **PASS / FAIL**: Handoff mentions (if any) are minimal and do not name a hard dependency on another skill
- [ ] **PASS / FAIL**: Frontmatter `description` trigger phrases are the only allowed external reference (user-facing, not skill-coupling)
- [ ] **PASS / FAIL**: SKILL.md body has a single primary language — dominant language identified by content volume, all minority-language content converted to primary (no mid-skill mixing; near 50/50 split was resolved by asking the user)
- Note: <if FAIL, what coupling or language mixing exists>

### 14. Need verified (Lalit Madan — don't write skill from vibes)
- [ ] **PASS / FAIL**: Task was run without a skill first → result was NOT good enough → skill is justified
- [ ] **PASS / FAIL**: Skill is NOT for a one-off task (will be reused)
- [ ] **PASS / FAIL**: Skill is NOT just general advice ("write clean code", "be thorough")
- Note: <if FAIL, skill may be context tax with no improvement>

### 15. Extracted from real work (Lalit + Karpathy)
- [ ] **PASS / FAIL**: Skill content comes from real corrections/observations with an agent, not imagination
- [ ] **PASS / FAIL**: Each behavioral rule traces to a concrete failure mode the agent exhibited
- Note: <if FAIL, skill may be generic restatement of what model already knows>

### 16. Freedom matched to fragility (Anthropic + mdskills)
- [ ] **PASS / FAIL**: Fragile/irreversible operations use LOW freedom (exact scripts, no modification)
- [ ] **PASS / FAIL**: Flexible/context-dependent tasks use HIGH freedom (prose steps)
- [ ] **PASS / FAIL**: Default is high freedom; low freedom only where justified
- Note: <if FAIL, freedom level mismatched to task fragility>

### 17. Tested against real prompts (Karpathy + Andrew Ng + Lalit)
- [ ] **PASS / FAIL**: 2-3 real user prompts tested → skill triggered correctly
- [ ] **PASS / FAIL**: 1-2 adjacent prompts tested → skill did NOT trigger (negative triggers work)
- [ ] **PASS / FAIL**: Agent followed process steps correctly in test runs
- [ ] **PASS / FAIL**: Output matched expected format in test runs
- Note: <if FAIL, which test failed — description routing or body procedure>

### 18. Iteration plan (Anthropic Engineering Blog)
- [ ] **PASS / FAIL**: Skill is treated as living document (not ship-and-forget)
- [ ] **PASS / FAIL**: Plan exists to capture improvements from real usage (self-reflect, capture successes, capture mistakes)
- Note: <if FAIL, skill will stagnate — no iteration mechanism>

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
| 13. Skill independence | PASS / FAIL |
| 14. Need verified | PASS / FAIL |
| 15. Extracted from real work | PASS / FAIL |
| 16. Freedom matched to fragility | PASS / FAIL |
| 17. Tested against real prompts | PASS / FAIL |
| 18. Iteration plan | PASS / FAIL |

**Overall**: APPROVED / NEEDS_FIXES (fix all FAIL before saving)
