# Interview Me — prototype phase (elicitation mode, steps 7–14)

Skip entirely in interview-only mode. Runs when the user can't articulate needs abstractly.

## Step 7: Design concepts & mockup

Invoke `idea-to-interface` with the confirmed 8-field frame. Full pipeline: Socratic anchoring → 3 unconstrained concepts → interactive mockup site (Real panel + Concept A/B/C + Mobile/Desktop + Light/Dark) → user choice.

Yields `docs/intent/[topic]-design-brief.md` (3 concept cards) + `src/entrypoints/mockup-[topic]/` + post-choice `docs/intent/[topic]-component-mapping.md` (reuse/extend/redesign/create). The chosen brief + mapping are the SSOT for the prototype's visual/interaction/component decisions.

Loop back: no concept matches the frame → re-anchor at `idea-to-interface` Step 1 or reconcile with the user before building.

## Step 8: Generate prototype page

Real Cell components, not throwaway HTML:

1. Use the component mapping for every UI element's reuse/extend/redesign/create decision.
2. Showcase page: import from `@/shared/ui/`, tokens from `tokens.css`.
3. Logic: React-hooks state model — flow detect → list → pick → action → result.
4. UI: real components, responsive (desktop + tablet + Android).
5. Build: `npx vite build --mode development`; open via `browser_preview` or the showcase URL.

Logic + UI evolve in parallel, not sequentially.

## Step 9: User drives the prototype

Open `browser_preview`; user presses buttons and tries the flow; agent observes state changes + UI reactions.

## Step 10: Feedback → rephrase → confirm → log

```text
AI: "Anh thấy prototype này thế nào?"
User feedback (possibly vague) → AI rephrases → "Em hiểu góp ý là [X]. Đúng chưa?"
  ├─ Confirm → LOG immediately → proceed
  └─ Correct → rephrase → confirm → LOG → repeat
```

**Every confirmed feedback is logged immediately** — don't rely on memory:

```markdown
## Prototype feedback log

### Round N — [date]
- [feedback #1]: [rephrased confirmed statement]
- [feedback #2]: [rephrased confirmed statement]
- Frame updates: [fields changed]
- Prototype updates: [what changed in code]
```

Appended to `docs/intent/[topic].md` before proceeding. Log not updated → stop and update.

## Step 11: Analyze feedback

| Type | Action |
|---|---|
| Logic gap | Fix logic in prototype |
| UI gap | Fix UI in prototype |
| Missing feature | Update frame + log |
| Constraint conflict | Update frame + domain map + log |

AI judgment: correct → accept → update frame + prototype → log. Incorrect → explain why + suggest alternative → confirm → log.

## Step 12: Update frame + intent doc

Correct feedback → update frame fields AND `docs/intent/[topic].md`. Frame is SSOT; prototype reflects frame; doc reflects frame.

## Step 13: Sync component

| Feedback | Sync action |
|---|---|
| New variant | Add variant to `src/shared/ui/` |
| New component | Add to `src/shared/ui/` + catalog |
| Token change | Edit `tokens.json` (NOT `tokens.css`/`tokens.ts`) → `npm run build` |
| New icon | Read `ICON_CATALOG` first → reuse or create + catalog |

Always `npm run build` after sync; update `docs/2-architechture-system.md` when `src/` changed.

## Step 14: Loop or exit

```text
"Em đã cập nhật [X]. Anh cần góp ý thêm, hay confirm chuyển sang phase tiếp theo?"
  ├─ More feedback → Step 8 (prototype v2) or Step 7 if the brief changes
  └─ Confirm → Phase 2 DONE
```
