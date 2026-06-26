---
name: conceptualization
description: Abstract bug fixes into reusable principles. Use after test pass + debug pass to extract principles that apply to multiple cases, preventing future mistakes.
---

# Conceptualization

## Overview

Bug fixes are specific to the case that triggered them. Without abstraction, the same pattern causes mistakes in other parts of the codebase. This skill abstracts bug fixes into reusable principles (nguyên lý) that apply to multiple cases.

## When to Use

Apply this skill when:
- You have just fixed a bug and tests pass
- Debug pass confirms the fix works
- The bug has a reusable pattern (not a 1-off)
- The bug relates to framework/library behavior (not just business logic)

**When NOT to use:**
- Bug is 1-off (no reusable pattern)
- Bug is business logic (not framework pattern)
- Bug is not yet verified (test fails or debug incomplete)

## 2-Layer Structure

Knowledge is stored in 2 layers:

| Layer | File | Content | Purpose |
|---|---|---|---|
| 1 (principle index) | `docs/knowledge/principles.md` | Abstract principle + cases links + apply-for | Scan nhanh, cross-project, grep-able |
| 2 (case study) | `docs/knowledge/<case-name>.md` | Problem, root causes, fix, key insight, verification | Technical detail, code paths, proof |

**Why 2 layers:**
- Principle alone: loses technical context + verification proof
- Case study alone: verbose, not scannable, codebase-coupled, stale on rename
- Hybrid: layer 1 scan fast (grep title + 1-2 sentences), layer 2 drill down when need fix detail

## The Process

### Step 1: Identify the pattern

Ask: "What is the underlying principle that caused this bug?"

Example:
- Bug: Tab-Scoping (popup showed media from wrong tab)
- Pattern: Broadcasts fan out to every listener, cannot target specific listener
- Principle: Scope by identifier in payload, listener filters by identifier

### Step 2: Write the case study (layer 2)

Create `docs/knowledge/<case-name>.md` with full technical detail:

```markdown
# <Case name> (specific, codebase-coupled)

> **Principle**: [<principle name>](principles.md#<anchor>)

## Problem
<What happened, symptoms>

## Root causes
<Why it happened, code paths>

## Fix
<What changed, which files>

## Key insight
<1-2 sentences abstract — why the fix works>

## Verification
<Evidence the fix works: test results, live debug output>
```

File naming: kebab-case, specific to the case, e.g. `tab-scoping-popup-leak.md`.

### Step 3: Add or update the principle (layer 1)

In `docs/knowledge/principles.md`, add a new section or update an existing one:

```markdown
## <Tên nguyên lý> (ngắn, abstract)

### Nguyên lý
<1-2 câu mô tả nguyên lý, không cụ thể case>

### Cases đã gặp
- [case-study-file.md](case-study-file.md) — <1 câu tóm tắt case>

### Apply cho
- <Tình huống khác nguyên lý này đúng>
- <Framework/library khác có pattern tương tự>
```

- **New principle**: add new `##` section to principles.md
- **Existing principle**: add new case link to "Cases đã gặp" section
- **Anchor**: GitHub auto-generates from heading text (lowercase, hyphens for spaces, `--` for `→`)

### Step 4: Verify bidirectional links

- Case study top: `> **Principle**: [link to principles.md#anchor]`
- Principle "Cases": `[link to case-study.md] — summary`

## Examples

### Example 1: Tab-Scoping → Broadcasts fan out

**Bug**: Popup opened for tab A showed media from background tab B. Root cause: `chrome.runtime.sendMessage` cannot target specific tab — broadcasts fan out to every listener.

**Layer 2 file**: `docs/knowledge/tab-scoping-popup-leak.md`
```markdown
# Tab-Scoping (learned while fixing popup media leak)

> **Principle**: [Broadcasts fan out → scope by identifier](principles.md#broadcasts-fan-out--scope-by-identifier)

## Problem
Popup opened for tab A showed media from background tab B...
## Fix
- DetectedMediaUpdatePayload now carries a required tabId: number...
## Key insight
Chrome MV3 chrome.runtime.sendMessage cannot target a specific tab...
```

**Layer 1 entry** in `docs/knowledge/principles.md`:
```markdown
## Broadcasts fan out → scope by identifier

### Nguyên lý
Broadcasts fan out to every listener — cannot target specific listener. Scope by identifier in payload, listener filters by identifier.

### Cases đã gặp
- [tab-scoping-popup-leak.md](tab-scoping-popup-leak.md) — chrome.runtime.sendMessage broadcasts to all tabs → pass tabId in payload, popup filters by tabId

### Apply cho
- chrome.runtime.sendMessage (Chrome extension)
- WebSocket rooms (server broadcasts to all rooms, client filters by roomId)
- Event emitters (EventEmitter emits to all listeners, filter by event type)
```

### Example 2: URL guard too coarse → Separate dedup from catch-up

**Bug**: Auto-download guard (URL-level) blocked subtitle catch-up.

**Layer 2 file**: `docs/knowledge/auto-download-subtitle-catchup.md`

**Layer 1 entry** in `docs/knowledge/principles.md`:
```markdown
## Separate dedup from catch-up

### Nguyên lý
Separate "don't redo" (dedup) from "allow new items" (catch-up). Use id-level dedup for items already processed, allow re-run for new items.

### Cases đã gặp
- [auto-download-subtitle-catchup.md](auto-download-subtitle-catchup.md) — URL guard (coarse) blocked subtitle catch-up → id-level dedup (fine) allows catch-up without re-downloading video

### Apply cho
- Incremental processing (polling with diff)
- Caching with invalidation (cache by id, invalidate by key)
- Data synchronization (sync by id, allow new items)
```

## Integration with Other Skills

This skill is typically invoked as part of:
- **code-review-and-quality** (axis 6: lessons learned) — after review, abstract lessons
- **test-driven-development** (after GREEN phase) — after test pass, conceptualize if pattern reusable
- **debugging-and-error-recovery** (after debug pass) — after root cause fix, abstract principle

## Output

The output of this skill is:
1. **Layer 2**: new or updated case study file in `docs/knowledge/<case-name>.md`
2. **Layer 1**: new or updated principle section in `docs/knowledge/principles.md`
3. **Bidirectional links**: case study → principle (top blockquote), principle → case study (Cases section)

This principle is then:
- Read before writing new code (grep principles.md for keywords)
- Used in code review to check for similar patterns
- Referenced in ADRs if the principle affects architecture decisions
