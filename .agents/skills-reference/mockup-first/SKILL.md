---
name: mockup-first
description: Build UI mockups where the mockup HTML IS the spec — single output file, zero drift. Use after /interview-me has clarified intent, when you need to design a UI screen (popup, panel, dialog, page) that matches the user's mental model and complies with the design system. Triggers on "build mockup", "design UI", "mockup-first", "make a screen", "giao diện", "thiết kế UI", "build me a mockup".
---

# Mockup-First

## Overview

The old way (spec → wireframe → mockup → contract) creates 4 artifacts that drift from each other. Every translation step loses information. The user sees the layout last, after 3 layers of interpretation.

Mockup-first collapses all 4 into **one HTML file**. The mockup IS the spec:
- User opens browser → sees layout (visual truth)
- AI reads HTML source → sees structure (machine truth)
- Handoff recipient copies file → runs it → sees exactly what user approved

**One file. One source of truth. Zero drift.**

## When to Use

After `/interview-me` has reached ≥95% confidence on **what** to build and **why**. This skill handles **how it looks** — the layout, styling, and interaction design.

**Use when:**
- You need to design a UI screen and the user wants to see it before implementation
- The user says "build mockup", "design UI", "thiết kế giao diện", "make a screen"
- You're in the design phase of `/design-driven-development` and want to skip spec/wireframe/contract overhead

**Do NOT use when:**
- `/interview-me` hasn't run yet (intent is unclear — run that first)
- The task is pure logic, no UI (use `/test-driven-development` instead)
- The screen already exists and just needs a bug fix (debug directly)

## Prerequisites

Before building, the AI must have:
1. **Intent** — from `/interview-me` output (what features, for whom, why)
2. **Design system** — `docs/mockups/design-system-showcase/design-system.md` (tokens + components)
3. **Reference** (optional) — image, sketch, or existing screen to match

## The Process — 2 Steps

### Step 1: BUILD + ITERATE (mockup HTML is the only output)

**1a. Build draft**

Create a **single standalone HTML file** at `docs/mockups/<screen-name>/index.html`:
- Inline `<style>` with CSS using design system tokens (`var(--color-*)`, `var(--space-*)`, `var(--radius-*)`)
- Inline `<script>` for interactions (toggle, dropdown, theme switch)
- No external dependencies except design system tokens (copy `:root` + `[data-theme]` from `design-system.md`)
- Dark + light theme support via `[data-theme]`

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Screen Name} — Mockup</title>
  <style>
    /* Design system tokens (copy from design-system.md) */
    :root { --color-primary: #60a5fa; --color-surface: #1e293b; ... }
    [data-theme="light"] { --color-primary: #2563eb; --color-surface: #ffffff; ... }

    /* Mockup styles — use tokens, never hardcode */
    .popup { background: var(--color-surface); border-radius: var(--radius-lg); }
  </style>
</head>
<body>
  <!-- MOCKUP: layout + content + interactions -->
  <div class="popup">...</div>

  <script>
    // Interactions (toggle, theme, dropdown)
  </script>
</body>
</html>
```

**1b. Show user, get feedback, iterate**

Serve the mockup and let the user see it in browser:
```
AI: python -m http.server <port> (background)
AI: open browser to http://localhost:<port>/index.html
AI: take screenshot, show user
User: "header sai, preview quá to, footer thiếu X"
AI: sửa mockup trực tiếp (edit HTML/CSS)
AI: refresh browser, screenshot lại
Loop cho tới khi user OK
```

**Feedback language**: user speaks naturally ("đổi chỗ này", "thêm nút kia", "màu sáng hơn"). AI translates to CSS/HTML edits. No spec update needed — the mockup IS the spec.

**Stop condition**: user says "OK", "đúng rồi", "good", or stops requesting changes.

### Step 2: LOCK (ATs + token audit, embed in same file)

After user approves the mockup, lock it so handoff recipients can verify:

**2a. Write ATs (Acceptance Criteria) as CSS selectors**

Embed in the same HTML file as `<script type="application/json" id="at-spec">`:

```html
<script type="application/json" id="at-spec">
{
  "AT01": { "selector": ".popup", "assert": "exists" },
  "AT02": { "selector": ".popup__target", "assert": "textContent === 'hello'" },
  "AT03": { "selector": ".popup__toolbar .icon-btn", "assert": "count === 4" },
  "AT04": { "selector": ".popup__footer", "assert": "exists" },
  "AT05": { "selector": "[data-theme='dark'] .popup", "assert": "visible" },
  "AT06": { "selector": "[data-theme='light'] .popup", "assert": "visible" },
  "AT07": { "selector": "console", "assert": "errorCount === 0" }
}
</script>
```

AT rules:
- Each AT = 1 CSS selector + 1 assert (exists / textContent / count / visible / errorCount)
- ATs lock **structure** (element exists), **content** (text matches), **count** (N elements), **theme** (dark+light work), **console** (no errors)
- ATs do NOT lock pixel positions (those drift with viewport) — lock structure + content instead
- 5-15 ATs per screen is enough

**2b. Token audit**

```bash
# Extract --color-* used in mockup
grep -oP '(?<=var\()--color-[a-z-]+' index.html | sort -u
# Compare with design-system.md tokens
# MISSING = 0 → pass
```

If MISSING > 0: either add token to `design-system.md` (if new token is justified) or replace with existing token.

**2c. Run ATs with Playwright**

```javascript
// AI runs this via MCP Playwright
const atSpec = JSON.parse(document.getElementById('at-spec').textContent);
const results = {};
for (const [id, at] of Object.entries(atSpec)) {
  // evaluate selector + assert
  results[id] = passOrFail;
}
// All must pass
```

**2d. Stop condition**

- All ATs pass
- Token audit MISSING = 0
- Console 0 errors
- User has approved visually

→ Mockup is ready for handoff.

## Single Output File

The final `index.html` contains:

```
index.html
├── <style>          — design system tokens + mockup CSS
├── <body>           — mockup DOM (layout + content + interactions)
├── <script>         — interactions (toggle, theme, dropdown)
├── <script json>    — ATs (acceptance criteria, machine-verifiable)
└── <script json>    — token map (which token used where, optional)
```

**One file. Copy it, run it, it works. No other artifacts needed.**

## Handoff

When handing off to a developer:
1. Give them `index.html`
2. Tell them: "Run it in browser. ATs are embedded in `<script id="at-spec">`. Implement to match."
3. Developer can run ATs themselves to verify their implementation matches the mockup

No spec doc, no wireframe, no contract file. The mockup speaks for itself.

## Anti-Patterns

- **DO NOT** write a separate spec/wireframe/contract file before building the mockup. That's the old way that drifts.
- **DO NOT** use ASCII wireframes. The browser renders HTML better than any ASCII art.
- **DO NOT** hardcode colors (`#60a5fa`). Always `var(--color-*)` from design system.
- **DO NOT** skip the iterate loop. First draft is never right. User must see it in browser.
- **DO NOT** lock ATs before user approves visually. ATs lock the approved state, not the draft.
- **DO NOT** split into multiple files (separate .css, .js). Single file = single handoff.

## Token Cost Comparison

| Approach | Artifacts | Tokens (approx) | Drift risk |
|---|---|---|---|
| Old: spec + wireframe + contract + mockup | 4 | ~10000 | High |
| This: mockup HTML with embedded ATs | 1 | ~4500 | Zero |

## Integration with other skills

```
/interview-me          → Discover (what to build, why)
  ↓
/mockup-first          → Build + Iterate + Lock (how it looks)
  ↓
/test-driven-development → Implement (real code matching mockup)
  ↓
/code-review-and-quality → Verify (implementation matches mockup ATs)
```

## Tóm tắt 1 câu

> Sau khi `/interview-me` rõ intent: build 1 HTML mockup standalone → Anh xem browser → sửa → loop đến OK → embed ATs + token audit → 1 file handoff, 0 drift.
