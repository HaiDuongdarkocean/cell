---
name: design-system-guardian
description: Audit any UI change against Cell's design system (DESIGN.md). Run before merging a UI task or when the user asks "is this design correct?". Checks token usage (no M3), component reuse (src/shared/ui/*), hardcoded values, inline SVG, and z-index. Returns pass/fail with specific fixes.
---

# Design System Guardian

## Overview

Kiểm tra bất kỳ UI change nào trước khi merge. Đảm bảo agent tuân thủ `docs/design-system/DESIGN.md`: dùng đúng token, đúng component, không hardcode, không M3.

## When to Use

- Trước khi tuyên bố "xong" một UI task.
- Khi user hỏi "giao diện này đúng không?", "check design", "audit UI".
- Sau khi refactor component/page.
- Trước khi commit bất kỳ file `.css`/`.tsx` liên quan UI.

## When NOT to Use

- Logic-only changes (no UI).
- Tests, docs, backend.

## Prerequisites

- `docs/design-system/DESIGN.md` đã tồn tại.
- Target files đã được sửa (không chạy trên file chưa tạo).

## Workflow

### Step 1: Identify target files

**Purpose:** Biết file nào cần audit.

**Actions:**
1. Hỏi user nếu không rõ: "Anh muốn audit file nào?" hoặc audit tất cả file UI đã sửa trong session hiện tại.
2. Nếu user không chỉ định → chạy `git status --short` để tìm file `.css`/`.tsx`/`.module.css` modified.

### Step 2: Run audit commands

**Purpose:** Phát hiện vi phạm design system.

**Commands (run từ repo root):**

```bash
cd "C:\Users\The0cean\Programming\The0cean ecosystem\cell"

echo "=== 1. M3 tokens ==="
grep -rn 'md-sys-color' src/ --include="*.css" --include="*.module.css" --include="*.tsx" --include="*.ts" || true

echo "=== 2. Hardcoded hex colors ==="
grep -rn '#[0-9a-fA-F]\{3,8\}' src/ --include="*.css" --include="*.module.css" | grep -v tokens.css || true

echo "=== 3. Hardcoded px outside obvious exceptions ==="
grep -rn 'padding:\|margin:\|gap:\|top:\|left:\|right:\|bottom:\|border-radius:\|font-size:\|width:\|height:' src/ --include="*.module.css" | grep -v 'var(' | grep -v '0px' | head -100 || true

echo "=== 4. Inline SVG ==="
grep -rn '<svg' src/ --include="*.tsx" | grep -v src/shared/icons | grep -v Icon.tsx || true

echo "=== 5. Hardcoded z-index ==="
grep -rn 'z-index:' src/ --include="*.css" --include="*.module.css" | grep -v 'var(--z-' | grep -v tokens || true

echo "=== 6. Component from src/shared/ui check ==="
grep -rn 'import.*from.*@/shared/ui' {TARGET_TSX} || true
```

**Guard:** Nếu lệnh 1-5 trả về output → FAIL. Lệnh 6 chỉ là gợi ý.

### Step 3: Classify failures

**Purpose:** Distinguish real violations vs false positives.

**Rules:**
- `md-sys-color` → ALWAYS FAIL. Must be replaced with `var(--color-*)`.
- `#RRGGBB` in CSS → FAIL unless inside `tokens.css`.
- `12px`, `8px`, etc. in CSS → FAIL if it should be a spacing/radius token.
- `<svg>` in `.tsx` → FAIL unless inside `src/shared/icons/`.
- `z-index: 50` → FAIL unless using `var(--z-*)`.
- Missing `src/shared/ui/*` imports → WARN if custom HTML elements (`<button>`, `<input>`, `<div className={styles.something}>`) are used where a shared component exists.

### Step 4: Propose fixes

**Purpose:** Convert failures into an actionable checklist.

**Output format:**

```markdown
## Audit Result: FAIL

### Critical (must fix)
1. `src/.../X.module.css:42` uses `var(--md-sys-color-surface)` → replace with `var(--color-surface)`
2. `src/.../Y.tsx:55` uses `<button className={styles.kebab}>` → replace with `IconButton`

### Warnings (should fix)
1. `src/.../Z.tsx:20` custom `<input>` → use `Input` from `@/shared/ui`

### Pass
- No inline SVG found
- No hardcoded z-index found

Run `npm run typecheck` after fixes.
```

### Step 5: Re-run until pass

**Purpose:** Ensure all violations fixed.

**Actions:**
1. Agent fix the issues.
2. Re-run commands.
3. If still failing, repeat Step 3-4.
4. If pass → output `## Audit Result: PASS` and allow user to proceed.

---

## Verification Checklist

- [ ] Target files identified.
- [ ] 5 audit commands run.
- [ ] Failures classified and reported.
- [ ] Fixes applied by agent.
- [ ] Re-run commands → pass.
- [ ] `npm run typecheck` run (if files changed).

---

## Anti-patterns

| Anti-pattern | Why bad | Do instead |
|-------------|---------|-----------|
| Audit only one file | Misses shared CSS / copied patterns | Audit all modified `.css`/`.tsx` files |
| Ignore warnings | Warnings become critical in next round | Fix warnings before merge |
| Skip typecheck | Token rename can break types | Always run `npm run typecheck` after CSS/TS changes |

---

## Router boomerang

When the task shifts from audit to fix → `design-system-guardian` can also do the fix.
When the task shifts to build/ship → invoke `/using-agent-skills` to re-route.
