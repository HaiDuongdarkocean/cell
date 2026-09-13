---
name: learning-and-apply
description: Cell's accumulated lessons - grep before coding, distill principles after fixing. Use on every Build/Verify/Review task.
---

# Learning and Apply

## Overview

Three knowledge stores, one skill:

- **knowledge/** — rules from style guides, books, external sources (Google HTML/CSS, TypeScript, BEM). Organized by topic file (`htmlcss.json`, `typescript.json`), each containing a `rules[]` array.
- **experience/** — principles extracted from real project bug fixes. One atom JSON per principle, with `cases[bad/good]` code snippets.
- **process/** — pipeline/workflow lessons (drift, skipped gates, wrong routing, doc rot). Same atom schema as experience; `cases` mô tả process failure thay vì code snippet.

All stores share the same rule schema. Knowledge rules have a `source` field at the topic level; experience/process atoms are self-contained.

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
| 6 | **Process/pipeline lesson** | Drift hoặc gate bị skip được phát hiện → root cause là process | Stale skill index, router trỏ skill không tồn tại, spec đổi không review |

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
learning/
├── SKILL.md                      # this file — workflow only
├── index.json                    # metadata tất cả entries — grep entry point
├── knowledge/                    # từ sách báo, style guides (external)
│   ├── htmlcss.json              # rules from Google HTML/CSS + BEM
│   └── typescript.json           # rules from Google TypeScript
├── experience/                   # từ project thực tế (real bug fixes)
│   ├── css-shadow-dom-token-injection.json
│   ├── css-shadow-dom-theme-propagation.json
│   └── ... (100+ atoms)
├── process/                      # pipeline/workflow lessons (process drift, gate skips)
│   └── process-generated-catalog-drift.json
└── scripts/
    ├── validate.cjs              # check index sync + schema
    └── convert-conventions.cjs   # convert style guide JSON → knowledge schema
```

Self-contained trong skill folder → portable, mang đi project khác.

## Schema

### Knowledge topic file (`knowledge/<topic>.json`)

```json
{
  "topic": "htmlcss",
  "source": "https://google.github.io/styleguide/htmlcssguide.html",
  "rules": [
    {
      "id": "htmlcss-general-001",
      "title": "Use HTTPS for embedded resources",
      "category": ["css"],
      "tags": ["htmlcss", "general", "https"],
      "trigger": "embedded resource URL",
      "principle": "Use HTTPS for embedded resources where possible.",
      "cases": [{"context": "...", "bad": "...", "good": "..."}],
      "applyFor": ["HTML", "CSS", "SCSS"]
    }
  ]
}
```

### Experience atom file (`experience/<id>.json`)

```json
{
  "id": "css-shadow-dom-token-injection",
  "title": "Rendering boundary → explicit token injection",
  "category": ["css", "rendering"],
  "tags": ["shadow-dom", "tokens", "vite-raw-import"],
  "trigger": "Shadow DOM component cần shared design tokens",
  "principle": "Rendering boundary cô lập CSS. Inject tokens via ?raw import string, remap :root→:host.",
  "cases": [{"context": "...", "bad": "...", "good": "..."}],
  "applyFor": ["Shadow DOM", "iframe widgets", "Web Worker canvas"],
  "related": ["css-shadow-dom-theme-propagation"],
  "supersedes": [],
  "source": {"commit": "abc1234", "spec": "docs/specs/feature.md", "date": "2026-09-13"}
}
```

### Index entry (`index.json`)

```json
{
  "type": "knowledge",
  "topic": "htmlcss",
  "source": "https://...",
  "ruleCount": 60,
  "categories": ["css"]
}
```
```json
{
  "type": "experience",
  "id": "css-shadow-dom-token-injection",
  "title": "Rendering boundary → explicit token injection",
  "category": ["css", "rendering"],
  "tags": ["shadow-dom", "tokens"],
  "trigger": "Shadow DOM component cần shared design tokens"
}
```
```json
{
  "type": "process",
  "id": "process-generated-catalog-drift",
  "title": "Generated SSOT catalog drift âm thầm",
  "category": ["process"],
  "tags": ["index", "drift", "hook"],
  "trigger": "Generated catalog không có gate regen"
}
```

**Quy tắc:**
- `id` (experience) / `topic` (knowledge): kebab-case, cụ thể, grep-able
- `category[]`: 1-2 category từ: css, rendering, async, state, messaging, data, detection, ux, build, testing, process
- `tags[]`: 3-5 keyword grep-able (technology, pattern, symptom)
- `trigger`: 1 câu — "khi nào áp dụng principle này"
- `principle`: 1-2 câu — nguyên lý abstract, không cụ thể codebase
- `cases[]`: ít nhất 1 case, mỗi case có `context` + `bad` + `good`
- `applyFor[]`: 3-5 tình huống khác principle đúng (cross-project)
- `related[]` (optional): ids của atoms cùng root-cause family — edge ngang, atom nào cũng đúng độc lập
- `supersedes[]` (optional): ids của atoms atom này thay thế — atom cũ giữ lại làm history, entry mới là truth hiện hành
- `source` (optional): provenance `{commit?, spec?, date?}` — atom biết nó sinh ra từ đâu; metadata tham chiếu, không phải code dep
- **KHÔNG có `files[]`** — không gắn file path (portability)
- **Knowledge** thêm `source` ở topic level (không per-rule)

## ACCUMULATE Mode — Rút kinh nghiệm

### Step 1: Identify the pattern

Ask: "What is the underlying principle that caused this bug?"

### Step 2: Dedupe/link trước khi tạo

Grep `index.json` theo tags của atom sắp tạo → đọc atoms trùng chủ đề:
- Cùng principle, case mới → **merge** case vào atom cũ, không tạo atom mới
- Principle đúng hơn/sai lệch → tạo atom mới với `supersedes: [old-id]`
- Cùng root-cause family, khác surface → tạo atom mới với `related: [old-id]`
- Không liên quan → tạo mới sạch

Điền `source` khi biết: commit hash fix, spec path, ngày — atom có provenance đáng tin hơn atom trôi nổi.

### Step 3: Create experience atom

Create `experience/<id>.json` (15-25 dòng):

```json
{
  "id": "messaging-broadcast-scope-by-identifier",
  "title": "Broadcasts fan out → scope by identifier",
  "category": ["messaging"],
  "tags": ["chrome-runtime", "sendmessage", "broadcast", "tabid"],
  "trigger": "Broadcast message cần target specific listener",
  "principle": "Broadcasts fan out to every listener. Scope by identifier in payload, listener filters by identifier.",
  "cases": [
    {
      "context": "Popup mở cho tab A nhưng nhận media từ tab B",
      "bad": "chrome.runtime.sendMessage({ type: 'MEDIA_UPDATE', media: [...] });",
      "good": "chrome.runtime.sendMessage({ type: 'MEDIA_UPDATE', tabId: activeTabId, media: [...] });"
    }
  ],
  "applyFor": ["chrome.runtime.sendMessage", "WebSocket rooms", "Event emitters"]
}
```

### Step 4: Update index.json

Append entry vào `index.json` `principles[]` with `type: "experience"` (code lessons) hoặc `type: "process"` + file trong `process/` (pipeline lessons).

### Step 5: Validate

```bash
node scripts/validate.cjs
```

## APPLY Mode — Tra cứu kiến thức

### Step 1: Identify task constructs

Ask: "Task này liên quan gì?" → map to tags/categories.

### Step 2: Grep index.json

```bash
# By tag
grep '"shadow-dom"' index.json

# By category
grep '"category":.*css' index.json

# By type
grep '"type": "knowledge"' index.json
```

### Step 3: Open matching files

- `type: "knowledge"` → open `knowledge/<topic>.json`, grep `rules[]` by tags/trigger
- `type: "experience"` → open `experience/<id>.json`, read principle + cases[bad/good]
- `type: "process"` → open `process/<id>.json`, read principle + cases[bad/good]

### Step 4: Apply

- Read `cases[].bad` — check code mình đang viết có match bad pattern không
- Read `cases[].good` — áp dụng fix
- Nếu code match bad → sửa theo good. Nếu không match → proceed.

(match ở đây có nghĩa là code mình đang viết có chứa pattern bad không không theo convention good không)

## Adding Knowledge (from external sources)

When adding rules from a new style guide or book:

1. Create `knowledge/<topic>.json` with `topic`, `source`, `rules[]`
2. Each rule follows the same schema as experience atoms
3. Add entry to `index.json` with `type: "knowledge"`
4. Run `node scripts/validate.cjs`

## Integration with Other Skills

This skill is typically invoked as part of:
- **code-review-and-quality** (axis 6: lessons learned) — after review, accumulate if pattern reusable
- **test-driven-development** (after GREEN phase) — after test pass, accumulate if pattern reusable
- **debugging-and-error-recovery** (after debug pass) — after root cause fix, accumulate principle
- **system-architecture-design** (after ADR) — after architecture decision, accumulate principle
- **code-simplification** (after refactor) — after simplification, accumulate pattern

## Verification

- [ ] ACCUMULATE: atom JSON có đủ required fields
- [ ] ACCUMULATE: mỗi case có context + bad + good
- [ ] ACCUMULATE: index.json updated với entry mới
- [ ] ACCUMULATE: `node scripts/validate.cjs` passes
- [ ] APPLY: grep index.json theo constructs của task
- [ ] APPLY: đọc matching principles trước khi viết code
- [ ] APPLY: code không match bad patterns từ principles

---

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke `/using-agent-skills` để re-route. Router protocol trong AGENTS.md (always-on).
