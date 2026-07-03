---
name: design-driven-development
description: Generates visual mockups (HTML/SVG) from intent + design-system.md BEFORE writing spec, so UI is confirmed with anh before committing to code. Use after G0 intent is written, before G1 spec, when a feature has any UI surface (popup, sidepanel, content-script overlay, settings panel). Triggers on "mockup this UI", "design this feature UI", "generate mockup", "visual mockup", "tạo mockup", "thiết kế UI cho feature", "design-driven".
---

# Design-Driven Development

## One-line summary

Generate visual mockup (HTML/SVG) from G0 intent + `design-system.md` bounds, confirm UI with anh, then hand off approved mockup to G1 spec + G4 implementation + G5 verification.

## When to Use

- **After G0 intent** (`docs/intent/intent-<feature>.md` exists)
- **Before G1 spec** — mockup may change intent requirements
- Feature has ANY UI surface: popup, sidepanel, content-script overlay, settings panel, dropdown, button
- **NOT for**: pure background logic, no-UI features (skip this skill, go straight to G1)

**Trigger phrases:**
- "mockup this UI"
- "design this feature UI"
- "generate mockup"
- "visual mockup"
- "tạo mockup"
- "thiết kế UI cho feature"
- "design-driven"

## Input

- **`docs/intent/intent-<feature>.md`** — G0 output (user outcome + risk + implementation constraints)
- **`docs/design-system/design-system.md`** — living doc (tokens + components + patterns + a11y + runtime contexts — bounds for mockup)
- **`src/entrypoints/popup/styles/theme.css`** + **`src/shared/lib/themeTokens.ts`** — token values (verify, don't trust doc blindly)
- **`docs/adr/*.md`** — approved interaction patterns
- **`src/`** existing components — mimic patterns, don't invent
- **Anh's answers** to Step 0 input-gathering questions (visual reference, user flow, states, input modes, runtime, constraints, a11y, scope)

## Output

| File | When | Folder | Format |
|---|---|---|---|
| `mockup-<feature>.html` | Always (UI feature) | `docs/mockups/mockup-<feature>.html` | HTML single-file, opens in browser, clickable, imports tokens from theme.css |
| `<icon>.svg` | When feature has custom icon | `docs/mockups/icon-svg/<icon>.svg` | SVG separate file |
| `design-contract-<feature>.md` | Optional — only when UI complex (multi-state, multi-token, new interaction) | `docs/mockups/design-contract-<feature>.md` | Markdown: intent contract + bounds + approval + traceability |

## Process

### Step 0 — Gather input from anh (8 questions, 2-4 per round)

> Use `ask_user_question` tool. Skip any question already answered in `intent-<feature>.md`. Don't overload — max 4 questions per round.

**Round 1 — Visual + flow (4 questions):**
1. **Visual reference**: "Anh có app/website reference nào muốn UI giống?" (options: asbplayer / YouTube subtitle settings / Netflix / sketch vẽ tay / no reference)
2. **User flow**: "User mở feature từ đâu → làm gì → kết quả?" (free-text via Other)
3. **States**: "Feature có bao nhiêu state?" (options: just default / default+loading+error / +empty / +collapsed / multi-state complex)
4. **Input modes**: "User dùng gì?" (options: mouse only / mouse+keyboard / mouse+touch / all three)

**Round 2 — Constraints + a11y + scope (4 questions):**
5. **Runtime**: "Feature chạy ở runtime nào?" (options: popup / sidepanel / content-script overlay / multiple)
6. **Constraints**: "Có z-index / position / performance constraint gì không?" (free-text via Other, or "none")
7. **A11y**: "User có cần screen reader / keyboard only / touch / color blind support?" (multi-select)
8. **Scope**: "MVP vs nice-to-have?" (options: MVP only / MVP + nice-to-have / future version)

### Step 1 — System sync audit (read, don't grep)

> Read 1 file instead of grep-ing entire codebase. If `design-system.md` is stale → invoke `/design-system-audit` first.

1. Read `docs/design-system/design-system.md` end-to-end
2. Extract bounds for this feature:
   - **Section 1 Tokens**: which tokens to reuse (color/spacing/radius/shadow/transition for this runtime)
   - **Section 2 Components**: existing components to mimic (React vs DOM factory)
   - **Section 3 Patterns**: approved interaction patterns relevant (Pointer Events, keyboard nav, etc.)
   - **Section 4 A11y**: conventions to follow (aria-*, role, touch target, contrast)
   - **Section 5 Runtime**: token source + component convention for target runtime
3. Verify token values vs `theme.css` / `themeTokens.ts` (don't trust doc blindly — sample 3-5 tokens)

### Step 2 — Generate mockup (bounded variance)

> Use `templates/mockup-template.html` as starting point. Replace `<bracketed>` placeholders with feature-specific content.

1. Copy `templates/mockup-template.html` → `docs/mockups/mockup-<feature>.html`
2. Inject tokens from `theme.css` `:root` + `[data-theme="dark"]` (copy-paste, don't invent new tokens)
3. Build component structure matching **runtime context**:
   - **Popup/Sidepanel** → React-style structure (component composition, hooks pattern)
   - **Content-script** → DOM factory-style structure (div nesting, no JSX)
4. Render ALL states from Step 0 Q3 (default + loading + error + empty + collapsed...) — each state as visible section in mockup
5. Apply a11y conventions from Section 4 (aria-*, role, semantic HTML)
6. Add dark mode toggle button (top-right) — mockup must show both light + dark
7. Add page header: feature name + "v1 mockup" + linked ADR + linked intent file
8. If feature has custom icon → create `docs/mockups/icon-svg/<icon>.svg` separately

### Step 3 — Anh duyệt (visual + edge states + a11y + intent drift)

1. Open `docs/mockups/mockup-<feature>.html` in browser (or instruct anh to open)
2. Ask anh to verify:
   - **Visual**: "UI đúng ý chưa?" (compare with reference from Step 0 Q1)
   - **Edge states**: "Loading/error/empty/collapsed render đúng không?"
   - **A11y**: "Contrast + touch target + ARIA OK?"
   - **Dark mode**: "Dark variant OK?"
3. **Intent drift check**: "Mockup thay đổi yêu cầu so với intent không?"
   - **NO** → approve, go to Step 4
   - **YES** → ask anh to update `intent-<feature>.md` → re-confirm → then Step 4
4. If anh requests changes → revise mockup → re-confirm (loop until approved)
5. On approval: add approval line to mockup HTML header comment:
   ```html
   <!-- Approved by anh on YYYY-MM-DD. Mockup revision: vN. -->
   ```

### Step 4 — Optional contract file (only if UI complex)

> Only create if: multi-state (4+) AND multi-token (5+ reused) AND new interaction pattern. Otherwise skip — mockup header approval is enough.

1. Copy `templates/contract-template.md` → `docs/mockups/design-contract-<feature>.md`
2. Fill 5 sections:
   - **Intent contract**: user outcome + risk + platform bounds (from intent file)
   - **Bounded variance**: tokens reused (table) + new tokens (if any) + interaction patterns + a11y floor + edge states
   - **Approval**: anh's approval date + drift check result
   - **Traceability**: G4 tuân thủ + G5 drift check + accepted deviations
   - **Revision history**: mockup revision log

### Step 5 — Handoff to G1 + G4 + G5

1. **G1 spec**: cite mockup in spec — "§F1 render như mockup panel A (docs/mockups/mockup-<feature>.html)"
2. **G4 implementation**: code follows mockup structure + tokens; browser verify so sánh real render vs mockup (MCP screenshot)
3. **G5 testing**: acceptance criteria includes "UI match mockup" + drift check vs contract file (if exists)

## Verification

After running this skill:

- [ ] `docs/mockups/mockup-<feature>.html` exists, opens in browser, renders both light + dark
- [ ] Mockup imports tokens from `theme.css` (no invented tokens — grep verify)
- [ ] All states from Step 0 Q3 are rendered as visible sections
- [ ] Mockup header has approval line with date + revision
- [ ] `intent-<feature>.md` updated if intent drift detected (or confirmed no drift)
- [ ] Contract file created ONLY if UI complex (multi-state + multi-token + new pattern)
- [ ] G1 spec cites mockup file path

## Boundaries

- **Always do**: Read `design-system.md` before generating. Reuse tokens, don't invent. Render all states. Get anh's approval before handoff. Verify token values vs source files (sample 3-5).
- **Ask first**: If `design-system.md` appears stale (last updated > 1 month ago + recent refactors) → invoke `/design-system-audit` first. If feature needs new token not in `theme.css` → propose to anh, don't invent in mockup.
- **Never do**: Generate mockup before reading `design-system.md`. Invent tokens/components/patterns not in codebase. Skip edge states (empty/loading/error). Skip dark mode. Skip anh's approval. Create contract file for simple UI (YAGNI).

## Anti-patterns

- **Bad**: Generate mockup with `--color-accent: #ff6b6b` (invented token) → G4 code follows → popup has 2 accent colors → inconsistent.
- **Good**: Reuse `--color-primary` from `design-system.md` Section 1 → G4 code uses same token → consistent across popup + content-script.
- **Bad**: Mockup only shows "happy path" (default state) → G4 implements → user hits empty state → UI breaks.
- **Good**: Mockup renders default + loading + error + empty → G4 implements all → edge cases handled.
- **Bad**: Create contract file for 1-button toggle UI → 5-section contract overkill → maintenance burden.
- **Good**: Mockup header approval is enough for simple UI → contract file only for complex (multi-state + multi-token + new pattern).
- **Bad**: Skip anh's approval, hand off mockup to G4 directly → UI doesn't match anh's vision → rework.
- **Good**: Step 3 approval loop → mockup matches vision → G4 implements with confidence.

## Frequency

This skill is **invoked per feature** (not periodic). One mockup per UI feature.

| Feature type | Invoke? |
|---|---|
| UI feature (popup/sidepanel/overlay/panel) | ✅ Yes — after G0, before G1 |
| Pure background logic (no UI) | ❌ No — go straight to G1 |
| Bug fix touching UI | ⚠️ Maybe — if fix changes visual/interaction, mockup the new state |
| Refactor (no visual change) | ❌ No — refactor doesn't need mockup |
