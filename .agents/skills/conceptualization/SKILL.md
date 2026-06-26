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

## The Process

### Step 1: Identify the pattern

Ask: "What is the underlying principle that caused this bug?"

Example:
- Bug: Tab-Scoping (popup showed media from wrong tab)
- Pattern: Broadcasts fan out to every listener, cannot target specific listener
- Principle: Scope by identifier in payload, listener filters by identifier

### Step 2: Abstract the principle

Write the principle in 1-2 sentences, abstract (not specific to the bug).

Format:
```
Nguyên lý: <short, abstract description>
```

Example:
```
Nguyên lý: Broadcasts fan out to every listener — cannot target specific listener. Scope by identifier in payload, listener filters by identifier.
```

### Step 3: Document cases

List the specific bug(s) that led to this principle.

Format:
```
Cases đã gặp:
- <Bug description>
- <Related bug>
```

Example:
```
Cases đã gặp:
- Tab-Scoping bug: chrome.runtime.sendMessage cannot target specific tab → pass tabId in payload, popup filters by tabId
```

### Step 4: Identify apply-for scenarios

List other situations where this principle applies.

Format:
```
Apply cho:
- <Framework/library with similar pattern>
- <Other domains with same principle>
```

Example:
```
Apply cho:
- chrome.runtime.sendMessage (Chrome extension)
- WebSocket rooms (server broadcasts to all rooms, client filters by roomId)
- Event emitters (EventEmitter emits to all listeners, filter by event type)
- Database queries (query returns all rows, filter by WHERE clause)
```

### Step 5: Save to docs/knowledge/

Create or update `docs/knowledge/<principle-name>.md` with the format:

```markdown
## <Tên nguyên lý> (ngắn, abstract)

### Nguyên lý
<1-2 câu mô tả nguyên lý, không cụ thể case>

### Cases đã gặp
- <Bug cụ thể dẫn đến nguyên lý này>
- <Bug khác liên quan>

### Apply cho
- <Tình huống khác nguyên lý này đúng>
- <Framework/library khác có pattern tương tự>
```

File naming: use kebab-case, e.g., `broadcasts-fan-out-scope-by-identifier.md`.

## Examples

### Example 1: Tab-Scoping → Broadcasts fan out

**Bug**: Popup opened for tab A showed media from background tab B. Root cause: `chrome.runtime.sendMessage` cannot target specific tab — broadcasts fan out to every listener.

**Principle**: Broadcasts fan out to every listener — cannot target specific listener. Scope by identifier in payload, listener filters by identifier.

**Apply for**: chrome.runtime.sendMessage, WebSocket rooms, event emitters, database queries.

**File**: `docs/knowledge/broadcasts-fan-out-scope-by-identifier.md`

### Example 2: URL guard too coarse → Separate dedup from catch-up

**Bug**: Auto-download guard (URL-level) blocked subtitle catch-up. URL guard prevented ALL re-runs for the same page, including legitimate subtitle catch-up.

**Principle**: Separate "don't redo" (dedup) from "allow new items" (catch-up). Use id-level dedup for items already processed, allow re-run for new items.

**Apply for**: Incremental processing, caching with invalidation, polling with diff.

**File**: `docs/knowledge/separate-dedup-from-catch-up.md`

### Example 3: Query assumption fragile → Gather + filter

**Bug**: `chrome.tabs.query({ active: true, currentWindow: false })` returned Edge app-window tab, not content tab. Assumption: only one other active tab is the content tab.

**Principle**: Don't assume query results match intent. Gather candidates from several query shapes, then filter by explicit criteria.

**Apply for**: chrome.tabs.query, database queries with complex WHERE, API responses with mixed data types.

**File**: `docs/knowledge/gather-candidates-filter-by-criteria.md`

## Integration with Other Skills

This skill is typically invoked as part of:
- **code-review-and-quality** (axis 6: lessons learned) — after review, abstract lessons
- **test-driven-development** (after GREEN phase) — after test pass, conceptualize if pattern reusable
- **debugging-and-error-recovery** (after debug pass) — after root cause fix, abstract principle

## Output

The output of this skill is a new or updated file in `docs/knowledge/` containing:
- Abstract principle (1-2 sentences)
- Cases that led to the principle
- Apply-for scenarios (other domains/frameworks)

This principle is then:
- Read before writing new code (grep docs/knowledge/ for keywords)
- Used in code review to check for similar patterns
- Referenced in ADRs if the principle affects architecture decisions
