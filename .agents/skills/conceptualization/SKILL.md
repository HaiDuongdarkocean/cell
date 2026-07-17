---
name: conceptualization
description: "Two modes. APPLY: grep index.json BEFORE writing code (css/async/messaging/state/data/detection/build/ux tasks) to avoid known bad patterns — read matching atom JSON, check bad/good. ACCUMULATE: after test pass + root cause understood, extract reusable principle to atom JSON with bad/good code."
---

# Conceptualization

## Overview

Bug fixes are specific to the case that triggered them. Without abstraction, the same pattern causes mistakes in other parts of the codebase. This skill abstracts bug fixes into reusable principles (nguyên lý) that apply to multiple cases.

## When to Use

Two modes: **ACCUMULATE** (rút kinh nghiệm sau task) and **APPLY** (tra cứu trước/during task).

### ACCUMULATE — Khi nào rút kinh nghiệm

Apply this mode when **insight is reusable** — any of 5 triggers:

| # | Trigger | Condition | Example |
|---|---|---|---|
| 1 | **Bug fix verified** | Test pass + root cause understood | Tab-scoping, Edge app-window leak |
| 2 | **Feature implementation insight** | Code pass + pattern reusable across features | Hybrid detection (script→frequency), dead field linking |
| 3 | **Architecture decision** | ADR written or design decision made | ASS→SRT reuse existing converter, layered clean architecture |
| 4 | **Refactor discovery** | Code pass + simplification pattern found | ftyp+moov stripping, tfdt offset patching |
| 5 | **Cross-cutting pattern** | Same logic appears 2+ times in codebase | Broadcasts fan out (popup + background + content script) |

**When NOT to accumulate:**
- Bug is 1-off (no reusable pattern)
- Bug is business logic (not framework pattern)
- Code is not yet verified (test fails or unverified)
- Trivial one-liner (ponytail: no insight to abstract)
- No insight beyond "I implemented the spec" (spec-driven, no surprise)

### APPLY — Khi nào tra cứu

| # | Trigger | Action |
|---|---------|--------|
| 1 | **Trước khi viết code mới** | Grep `index.json` theo constructs (css, shadow-dom, async...) → đọc matching principles → check bad patterns |
| 2 | **During code review** | Grep `index.json` theo tags liên quan đến PR → verify code không match bad patterns |
| 3 | **Khi gặp bug** | Grep `index.json` xem đã có principle cho pattern này chưa → nếu có, apply good pattern |

## File Layout

```
conceptualization/
├── SKILL.md                      # this file — workflow only
├── index.json                    # metadata tất cả principles — grep entry point
├── knowledge/                    # 1 principle = 1 JSON atom
│   ├── css-shadow-dom-token-injection.json
│   ├── css-shadow-dom-theme-propagation.json
│   └── ...
└── scripts/
    └── validate.cjs              # check index sync với knowledge/ folder
```

Self-contained trong skill folder → portable, mang đi project khác.

## Atom JSON Schema

Mỗi `knowledge/<id>.json`:

```json
{
  "id": "kebab-case-specific",
  "title": "Short title — abstract principle",
  "category": ["css", "rendering"],
  "tags": ["shadow-dom", "tokens", "vite-raw-import"],
  "trigger": "1 câu — khi nào principle áp dụng",
  "principle": "1-2 câu — nguyên lý cốt lõi, không cụ thể case",
  "cases": [
    {
      "context": "Tình huống cụ thể, abstract (không gắn file path)",
      "bad": "Code sai — pattern gây bug",
      "good": "Code đúng — fix"
    }
  ],
  "applyFor": ["Tình huống khác principle đúng", "Framework/library tương tự"]
}
```

**Quy tắc:**
- `id`: kebab-case, cụ thể, grep-able
- `category[]`: 1-2 category từ: css, rendering, async, state, messaging, data, detection, ux, build, testing
- `tags[]`: 3-5 keyword grep-able (technology, pattern, symptom)
- `trigger`: 1 câu — "khi nào áp dụng principle này"
- `principle`: 1-2 câu — nguyên lý abstract, không cụ thể codebase
- `cases[]`: ít nhất 1 case, mỗi case có `context` + `bad` + `good`
- `applyFor[]`: 3-5 tình huống khác principle đúng (cross-project)
- **KHÔNG có `files[]`** — không gắn file path (portability)

## ACCUMULATE Mode — Rút kinh nghiệm

### Step 1: Identify the pattern

Ask: "What is the underlying principle that caused this bug?"

Example:
- Bug: Tab-Scoping (popup showed media from wrong tab)
- Pattern: Broadcasts fan out to every listener, cannot target specific listener
- Principle: Scope by identifier in payload, listener filters by identifier

### Step 2: Create atom JSON

Create `knowledge/<id>.json` with full detail (15-25 dòng):

```json
{
  "id": "messaging-broadcasts-fan-out-scope-by-id",
  "title": "Broadcasts fan out → scope by identifier",
  "category": ["messaging"],
  "tags": ["chrome-runtime", "sendmessage", "broadcast", "tabid", "filter"],
  "trigger": "Broadcast message cần target specific listener, không fan out tất cả",
  "principle": "Broadcasts fan out to every listener — cannot target specific listener. Scope by identifier in payload, listener filters by identifier.",
  "cases": [
    {
      "context": "Popup mở cho tab A nhưng nhận media từ tab B — sendMessage broadcast tất cả tabs",
      "bad": "chrome.runtime.sendMessage({ type: 'MEDIA_UPDATE', media: [...] }); // mọi popup nhận, không lọc theo tab",
      "good": "chrome.runtime.sendMessage({ type: 'MEDIA_UPDATE', tabId: activeTabId, media: [...] });\n// popup filter: if (msg.tabId !== myTabId) return;"
    }
  ],
  "applyFor": [
    "chrome.runtime.sendMessage (Chrome extension)",
    "WebSocket rooms (server broadcasts, client filters by roomId)",
    "Event emitters (EventEmitter emits to all, filter by event type)"
  ]
}
```

### Step 3: Update index.json

Append entry vào `index.json` `principles[]`:

```json
{
  "id": "messaging-broadcasts-fan-out-scope-by-id",
  "title": "Broadcasts fan out → scope by identifier",
  "category": ["messaging"],
  "tags": ["chrome-runtime", "sendmessage", "broadcast", "tabid", "filter"],
  "trigger": "Broadcast message cần target specific listener, không fan out tất cả"
}
```

### Step 4: Validate

```bash
node scripts/validate.cjs
```

Checks: valid JSON, no duplicate id, index sync với knowledge/ folder, required fields present, categories valid.

## APPLY Mode — Tra cứu kiến thức

### Step 1: Identify task constructs

Ask: "Task này liên quan gì?" → map to tags/categories.

Example:
- Task: "Tích hợp dark mode vào popup dictionary"
- Constructs: css, shadow-dom, theme

### Step 2: Grep index.json

```bash
# By tag
grep '"shadow-dom"' index.json

# By category
grep '"category":.*css' index.json

# By trigger keyword
grep '"theme"' index.json
```

→ List matching principles.

### Step 3: Open matching atom files

Read `knowledge/<id>.json` for each match:
- Read `principle` — hiểu nguyên lý
- Read `cases[].bad` — check code mình đang viết có match pattern bad không
- Read `cases[].good` — áp dụng fix

### Step 4: Apply

- Nếu code match bad pattern → sửa theo good pattern
- Nếu không match → proceed

## Integration with Other Skills

This skill is typically invoked as part of:
- **code-review-and-quality** (axis 6: lessons learned) — after review, accumulate if pattern reusable (trigger 1, 2, 5)
- **test-driven-development** (after GREEN phase) — after test pass, accumulate if pattern reusable (trigger 1, 2)
- **debugging-and-error-recovery** (after debug pass) — after root cause fix, accumulate principle (trigger 1)
- **system-architecture-design** (after ADR) — after architecture decision, accumulate principle (trigger 3)
- **code-simplification** (after refactor) — after simplification, accumulate pattern (trigger 4)

## Verification

- [ ] ACCUMULATE: atom JSON có đủ required fields (id, title, category, tags, trigger, principle, cases, applyFor)
- [ ] ACCUMULATE: mỗi case có context + bad + good
- [ ] ACCUMULATE: index.json updated với entry mới
- [ ] ACCUMULATE: `node scripts/validate.cjs` passes
- [ ] APPLY: grep index.json theo constructs của task
- [ ] APPLY: đọc matching principles trước khi viết code
- [ ] APPLY: code không match bad patterns từ principles

---

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke `/using-agent-skills` để re-route. Router protocol trong AGENTS.md (always-on).
